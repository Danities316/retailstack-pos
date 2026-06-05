import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { protect } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// ── Atomic stock decrement ────────────────────────────────────────────────────
// Single UPDATE that reads and decrements in one operation.
// Returns the updated product row, or null if stock is insufficient or
// the product does not belong to the tenant.
async function decrementStockAtomic(
    tx: any,
    productId: string,
    tenantId: string,
    quantity: number
): Promise<{ id: string; productName: string; sellingPrice: any; stock: number } | null> {
    const result = await tx.$executeRaw`
    UPDATE "Product"
    SET stock = stock - ${quantity}
    WHERE id = ${productId}
      AND "tenantId" = ${tenantId}
      AND stock >= ${quantity}
      AND deleted = false
  `;

    if (result === 0) return null;

    return tx.product.findUnique({
        where: { id: productId },
        select: { id: true, productName: true, sellingPrice: true, stock: true },
    });
}

export interface SyncMutation {
    idempotencyKey: string; // Deterministic: entityType_entityId_vbaseVersion_vclientVersion_mutationType
    entityType: string;
    entityId: string;
    mutationType: 'CREATE' | 'UPDATE' | 'DELETE';
    baseVersion: number;
    clientVersion: number;
    payload: any;
}

export interface PushResult {
    idempotencyKey: string;
    success: boolean;
    error?: string;
    result?: any;
}

/**
 * POST /api/sync/push
 * Process mutations with idempotency key deduplication.
 * Returns results array with status for each mutation.
 */
router.post('/push', protect, async (req: AuthRequest, res: Response) => {
    try {
        const { mutations } = req.body as { mutations: SyncMutation[] };
        const tenantId = req.user!.tenantId;
        const userId = req.user!.userId;

        if (!Array.isArray(mutations)) {
            res.status(400).json({
                success: false,
                error: 'Mutations must be an array',
            });
            return;
        }

        const results: PushResult[] = [];

        // Process each mutation
        for (const mutation of mutations) {
            const result = await processMutation(mutation, tenantId, userId);
            results.push(result);
        }

        res.json({
            success: true,
            data: {
                results,
            },
        });
    } catch (error: any) {
        console.error('Push phase failed:', error);
        res.status(500).json({
            success: false,
            error: 'Push phase failed',
        });
    }
});

/**
 * Process a single mutation with idempotency deduplication.
 */
async function processMutation(
    mutation: SyncMutation,
    tenantId: string,
    userId: string
): Promise<PushResult> {
    const { idempotencyKey, entityType, entityId, mutationType, payload } = mutation;

    try {
        // Check if mutation was already processed
        const existing = await prisma.idempotencyKey.findUnique({
            where: { key: idempotencyKey },
        });

        if (existing) {
            // Idempotent: return cached response or in-progress status
            if (existing.status === 'COMPLETED') {
                return {
                    idempotencyKey,
                    success: true,
                    result: existing.response,
                };
            } else if (existing.status === 'PENDING') {
                return {
                    idempotencyKey,
                    success: false,
                    error: 'Mutation is already being processed',
                };
            } else if (existing.status === 'FAILED') {
                return {
                    idempotencyKey,
                    success: false,
                    error: 'Previous attempt failed',
                    result: existing.response,
                };
            }
        }

        // Create idempotency record to claim the key
        await prisma.idempotencyKey.create({
            data: {
                key: idempotencyKey,
                tenantId,
                userId,
                status: 'PENDING',
            },
        });

        // Process the mutation (placeholder logic)
        let result: any = null;
        try {
            result = await applyMutation(mutation, tenantId);

            // Update idempotency record with success
            await prisma.idempotencyKey.update({
                where: { key: idempotencyKey },
                data: {
                    status: 'COMPLETED',
                    response: result,
                },
            });

            return {
                idempotencyKey,
                success: true,
                result,
            };
        } catch (err: any) {
            // Update idempotency record with failure
            await prisma.idempotencyKey.update({
                where: { key: idempotencyKey },
                data: {
                    status: 'FAILED',
                    response: { error: err.message },
                },
            });

            return {
                idempotencyKey,
                success: false,
                error: err.message || 'Mutation processing failed',
            };
        }
    } catch (error: any) {
        // Handle unique constraint violation (race condition where another request claimed the key)
        const existing = await prisma.idempotencyKey.findUnique({
            where: { key: idempotencyKey },
        }).catch(() => null);

        if (existing) {
            if (existing.status === 'COMPLETED') {
                return {
                    idempotencyKey,
                    success: true,
                    result: existing.response,
                };
            }
            return {
                idempotencyKey,
                success: false,
                error: 'Mutation is being processed by another request',
            };
        }

        return {
            idempotencyKey,
            success: false,
            error: error.message || 'Mutation processing failed',
        };
    }
}

/**
 * Apply mutation to database.
 * Routes by entityType + mutationType and writes to the database using Prisma.
 */
export async function applyMutation(mutation: SyncMutation, tenantId: string, _tx?: any): Promise<any> {
    const { entityType, entityId, mutationType, payload } = mutation;

    const normalizedEntityType = entityType.toLowerCase();

    // ── sale / sales CREATE ───────────────────────────────────────────────────
    if ((normalizedEntityType === 'sale' || normalizedEntityType === 'sales') && mutationType === 'CREATE') {
        // Always enforce server-side tenantId from authenticated user
        // Never trust client-provided payload.tenantId
        const effectiveTenantId = tenantId;

        const result = await prisma.$transaction(async (tx) => {
            let totalAmount = new Decimal(0);
            const saleItemsData: any[] = [];

            for (const item of payload.items) {
                const product = await decrementStockAtomic(tx, item.productId, effectiveTenantId, item.quantity);

                if (!product) {
                    const existing = await tx.product.findUnique({
                        where: { id: item.productId },
                        select: { productName: true, stock: true, tenantId: true },
                    });
                    if (!existing || existing.tenantId !== effectiveTenantId) {
                        throw new Error(`Product not found: ${item.productId}`);
                    }
                    throw new Error(
                        `Stockout: Only ${existing.stock} units of "${existing.productName}" available.`
                    );
                }

                const lineTotal = new Decimal(product.sellingPrice).times(item.quantity);
                totalAmount = totalAmount.plus(lineTotal);

                saleItemsData.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: product.sellingPrice,
                });
            }


            const settings = await tx.storeSettings.findUnique({
                where: { tenantId: effectiveTenantId },
                select: { vatEnabled: true, vatRate: true },
            });
            const taxRate = settings?.vatEnabled ? new Decimal(settings.vatRate.toString()) : new Decimal('0');
            const taxAmount = totalAmount.times(taxRate);

            const newSale = await tx.sale.create({
                data: {
                    tenantId: effectiveTenantId,
                    userId: payload.userId || null,
                    totalAmount,
                    paymentMethod: payload.paymentMethod,
                    customerName: payload.customerName || null,
                    saleNote: payload.saleNote || null,
                    taxRate,
                    taxAmount,
                    subtotal: totalAmount,
                    items: { createMany: { data: saleItemsData } },
                },
                include: { items: true },
            }) as any;

            // If this is a credit sale, create the customer debt record
            if (payload.paymentMethod === 'CREDIT') {
                const customerName = payload.customerName;
                if (!customerName?.trim()) {
                    throw new Error('Customer name is required for credit sales.');
                }

                // Find or create the customer
                let customer = await tx.customer.findFirst({
                    where: {
                        tenantId,
                        name: { equals: customerName.trim(), mode: 'insensitive' },
                    },
                });

                if (!customer) {
                    customer = await tx.customer.create({
                        data: { tenantId, name: customerName.trim() },
                    });
                }

                // Record the debt
                await tx.creditSale.create({
                    data: {
                        tenantId,
                        customerId: customer.id,
                        saleId: newSale.id,
                        amount: totalAmount,
                        amountPaid: new Decimal(0),
                        balance: totalAmount,
                        settled: false,
                    },
                });

                // Update customer total owed
                await tx.customer.update({
                    where: { id: customer.id },
                    data: { totalOwed: { increment: totalAmount } },
                });
            }

            await (tx as any).syncChange.create({
                data: {
                    tenantId: effectiveTenantId,
                    entityType: 'sale',
                    entityId: newSale.id,
                    version: 0,
                    operation: 'CREATE',
                    data: newSale as any,
                    deleted: false,
                },
            });

            return newSale;
        }, { timeout: 15000 });

        return { saleId: result.id, totalAmount: result.totalAmount };
    }

    // ── product UPDATE ────────────────────────────────────────────────────────
    // if (normalizedEntityType === 'product' && mutationType === 'UPDATE') {
    //     const updated = await prisma.product.update({
    //         where: { id: entityId, tenantId },
    //         data: {
    //             ...payload,
    //             version: { increment: 1 },
    //             updatedAt: new Date(),
    //         },
    //     });
    //     return { productId: updated.id, version: updated.version };
    // }

    // ── product UPDATE ────────────────────────────────────────────────────────
    if (normalizedEntityType === 'product' && mutationType === 'UPDATE') {

        // Whitelist every field the client is permitted to change.
        // Anything outside this list (tenantId, deleted, deletedAt, id, etc.)
        // is silently dropped — never spread payload directly into Prisma.
        const allowedUpdate: Record<string, any> = {};

        const ALLOWED_PRODUCT_FIELDS = [
            'productName',
            'productDescription',
            'productImage',
            'productColor',
            'sellingPrice',
            'costPrice',
            'stock',
            'quantity',
            'categoryId',
            'sku',
            'barcode',
        ] as const;

        for (const field of ALLOWED_PRODUCT_FIELDS) {
            if (field in payload && payload[field] !== undefined) {
                allowedUpdate[field] = payload[field];
            }
        }

        if (Object.keys(allowedUpdate).length === 0) {
            throw new Error('Product UPDATE payload contains no valid fields.');
        }

        const updated = await prisma.product.update({
            where: { id: entityId, tenantId },
            data: {
                ...allowedUpdate,
                version: { increment: 1 },
                updatedAt: new Date(),
            },
        });

        return { productId: updated.id, version: updated.version };
    }

    // ── product DELETE ────────────────────────────────────────────────────────
    // if (normalizedEntityType === 'product' && mutationType === 'DELETE') {
    //     await prisma.product.update({
    //         where: { id: entityId, tenantId },
    //         data: { deleted: true, deletedAt: new Date() },
    //     });
    //     return { productId: entityId, deleted: true };
    // }
    // ── product DELETE ────────────────────────────────────────────────────────
    if (normalizedEntityType === 'product' && mutationType === 'DELETE') {
        const exists = await prisma.product.findUnique({
            where: { id: entityId },
            select: { tenantId: true },
        });

        if (!exists || exists.tenantId !== tenantId) {
            throw new Error(`Product not found: ${entityId}`);
        }

        await prisma.product.update({
            where: { id: entityId },
            data: { deleted: true, deletedAt: new Date() },
        });

        return { productId: entityId, deleted: true };
    }

    // ── unsupported ───────────────────────────────────────────────────────────
    throw new Error(`Unsupported mutation: ${entityType}/${mutationType}`);
}

export default router;


// import { Router, Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';
// import { protect } from '../../middleware/auth.middleware';
// import { AuthRequest } from '../../middleware/auth.middleware';

// const router = Router();
// const prisma = new PrismaClient();

// export interface SyncMutation {
//     idempotencyKey: string; // Deterministic: entityType_entityId_vbaseVersion_vclientVersion_mutationType
//     entityType: string;
//     entityId: string;
//     mutationType: 'CREATE' | 'UPDATE' | 'DELETE';
//     baseVersion: number;
//     clientVersion: number;
//     payload: any;
// }

// export interface PushResult {
//     idempotencyKey: string;
//     success: boolean;
//     error?: string;
//     result?: any;
// }

// /**
//  * POST /api/sync/push
//  * Process mutations with idempotency key deduplication.
//  * Returns results array with status for each mutation.
//  */
// router.post('/push', protect, async (req: AuthRequest, res: Response) => {
//     try {
//         const { mutations } = req.body as { mutations: SyncMutation[] };
//         const tenantId = req.user!.tenantId;
//         const userId = req.user!.userId;

//         if (!Array.isArray(mutations)) {
//             res.status(400).json({
//                 success: false,
//                 error: 'Mutations must be an array',
//             });
//             return;
//         }

//         const results: PushResult[] = [];

//         // Process each mutation
//         for (const mutation of mutations) {
//             const result = await processMutation(mutation, tenantId, userId);
//             results.push(result);
//         }

//         res.json({
//             success: true,
//             data: {
//                 results,
//             },
//         });
//     } catch (error: any) {
//         console.error('Push phase failed:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Push phase failed',
//         });
//     }
// });

// /**
//  * Process a single mutation with idempotency deduplication.
//  */
// async function processMutation(
//     mutation: SyncMutation,
//     tenantId: string,
//     userId: string
// ): Promise<PushResult> {
//     const { idempotencyKey, entityType, entityId, mutationType, payload } = mutation;

//     try {
//         // Check if mutation was already processed
//         const existing = await prisma.idempotencyKey.findUnique({
//             where: { key: idempotencyKey },
//         });

//         if (existing) {
//             // Idempotent: return cached response or in-progress status
//             if (existing.status === 'COMPLETED') {
//                 return {
//                     idempotencyKey,
//                     success: true,
//                     result: existing.response,
//                 };
//             } else if (existing.status === 'PENDING') {
//                 return {
//                     idempotencyKey,
//                     success: false,
//                     error: 'Mutation is already being processed',
//                 };
//             } else if (existing.status === 'FAILED') {
//                 return {
//                     idempotencyKey,
//                     success: false,
//                     error: 'Previous attempt failed',
//                     result: existing.response,
//                 };
//             }
//         }

//         // Create idempotency record to claim the key
//         await prisma.idempotencyKey.create({
//             data: {
//                 key: idempotencyKey,
//                 tenantId,
//                 userId,
//                 status: 'PENDING',
//             },
//         });

//         // Process the mutation (placeholder logic)
//         let result: any = null;
//         try {
//             result = await applyMutation(mutation, tenantId);

//             // Update idempotency record with success
//             await prisma.idempotencyKey.update({
//                 where: { key: idempotencyKey },
//                 data: {
//                     status: 'COMPLETED',
//                     response: result,
//                 },
//             });

//             return {
//                 idempotencyKey,
//                 success: true,
//                 result,
//             };
//         } catch (err: any) {
//             // Update idempotency record with failure
//             await prisma.idempotencyKey.update({
//                 where: { key: idempotencyKey },
//                 data: {
//                     status: 'FAILED',
//                     response: { error: err.message },
//                 },
//             });

//             return {
//                 idempotencyKey,
//                 success: false,
//                 error: err.message || 'Mutation processing failed',
//             };
//         }
//     } catch (error: any) {
//         // Handle unique constraint violation (race condition where another request claimed the key)
//         const existing = await prisma.idempotencyKey.findUnique({
//             where: { key: idempotencyKey },
//         }).catch(() => null);

//         if (existing) {
//             if (existing.status === 'COMPLETED') {
//                 return {
//                     idempotencyKey,
//                     success: true,
//                     result: existing.response,
//                 };
//             }
//             return {
//                 idempotencyKey,
//                 success: false,
//                 error: 'Mutation is being processed by another request',
//             };
//         }

//         return {
//             idempotencyKey,
//             success: false,
//             error: error.message || 'Mutation processing failed',
//         };
//     }
// }

// /**
//  * Apply mutation to database (placeholder).
//  * In production, this would route to appropriate handlers based on entityType.
//  */
// async function applyMutation(mutation: SyncMutation, tenantId: string): Promise<any> {
//     const { entityType, entityId, mutationType, payload } = mutation;

//     // Route to appropriate handler based on entity type
//     // This is a placeholder - implement actual business logic
//     console.log(`Applying ${mutationType} mutation for ${entityType}:${entityId}`);

//     return {
//         entityType,
//         entityId,
//         mutationType,
//         status: 'processed',
//     };
// }

// export default router;
