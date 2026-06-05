/**
 * Sync API Routes: PULL, PUSH, ACK, STATUS
 * Handles offline-first synchronization with idempotency key deduplication.
 *
 * PUSH mutations are delegated to the applyMutation handler in sync/push.ts
 * which contains the correct, validated, transactional logic for each entity
 * type — including stock decrement, VAT, and SaleItem creation for sales.
 *
 * This file owns: PULL, ACK, STATUS, and the idempotency wrapper.
 * sync/push.ts owns: the actual mutation logic per entity type.
 */

import { Router, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { protect, AuthRequest } from '../middleware/auth.middleware';
import { applyMutation } from './sync/push';

const router = Router();
const prisma = new PrismaClient();

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface SyncMutation {
    idempotencyKey: string;
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

// ── PULL ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/sync/pull
 * Returns all server-side changes since lastSyncTime for this tenant.
 */
router.post('/pull', protect, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(401).json({ success: false, error: 'Unauthorized: tenant context missing.' });
            return;
        }

        const lastSyncTime = req.body.lastSyncTime ? new Date(req.body.lastSyncTime) : null;
        const serverTime = new Date();
        const since = lastSyncTime ? { updatedAt: { gt: lastSyncTime } } : {};
        const changes: any[] = [];

        const [products, sales, categories] = await Promise.all([
            prisma.product.findMany({
                where: { tenantId, ...since },
                select: {
                    id: true, productName: true, sellingPrice: true,
                    costPrice: true, stock: true, sku: true,
                    categoryId: true, version: true, updatedAt: true, deleted: true,
                },
            }),
            prisma.sale.findMany({
                where: { tenantId, ...since },
                select: {
                    id: true, totalAmount: true, paymentMethod: true,
                    userId: true, shiftId: true, items: true,
                    version: true, updatedAt: true, deleted: true,
                },
            }),
            prisma.category.findMany({
                where: { tenantId, ...since },
                select: {
                    id: true, categoryName: true,
                    version: true, updatedAt: true, deleted: true,
                },
            }),
        ]);

        products.forEach(p => changes.push({
            entityType: 'product',
            entityId: p.id,
            operation: p.deleted ? 'DELETE' : 'UPDATE',
            data: p,
            version: p.version,
            timestamp: p.updatedAt.toISOString(),
        }));

        sales.forEach(s => changes.push({
            entityType: 'sale',
            entityId: s.id,
            operation: s.deleted ? 'DELETE' : 'UPDATE',
            data: s,
            version: s.version,
            timestamp: s.updatedAt.toISOString(),
        }));

        categories.forEach(c => changes.push({
            entityType: 'category',
            entityId: c.id,
            operation: c.deleted ? 'DELETE' : 'UPDATE',
            data: c,
            version: c.version,
            timestamp: c.updatedAt.toISOString(),
        }));

        res.json({
            success: true,
            data: {
                serverTime: serverTime.toISOString(),
                changes,
                changeCount: changes.length,
            },
        });
    } catch (error: any) {
        console.error('[sync/pull]', error);
        res.status(500).json({ success: false, error: 'Pull phase failed.' });
    }
});

// ── PUSH ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/sync/push
 * Processes mutations with idempotency key deduplication.
 * Each mutation is wrapped in a single $transaction covering:
 *   1. Idempotency key claim (PENDING)
 *   2. The mutation itself (via applyMutation in sync/push.ts)
 *   3. Idempotency key resolution (COMPLETED or FAILED)
 *
 * If the server crashes between any two steps, Postgres rolls back the
 * entire transaction. On the next retry the idempotency key does not exist
 * and the mutation is processed cleanly.
 */
router.post('/push', protect, async (req: AuthRequest, res: Response) => {
    try {
        const { mutations } = req.body as { mutations: SyncMutation[] };
        const tenantId = req.user!.tenantId;
        const userId = req.user!.userId;

        if (!Array.isArray(mutations)) {
            res.status(400).json({ success: false, error: 'Mutations must be an array.' });
            return;
        }

        const results: PushResult[] = [];

        for (const mutation of mutations) {
            results.push(await processMutation(mutation, tenantId, userId));
        }

        res.json({ success: true, data: { results } });
    } catch (error: any) {
        console.error('[sync/push]', error);
        res.status(500).json({ success: false, error: 'Push phase failed.' });
    }
});

/**
 * Process a single mutation with idempotency deduplication.
 * The idempotency check + mutation + resolution are one atomic $transaction.
 */
async function processMutation(
    mutation: SyncMutation,
    tenantId: string,
    userId: string,
): Promise<PushResult> {
    const { idempotencyKey } = mutation;

    // ── Pre-flight: has this key already been processed? ─────────────────────
    // Check outside the transaction so we can return fast without acquiring
    // a transaction slot for keys that are already COMPLETED.
    const existing = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
    }).catch(() => null);

    if (existing) {
        if (existing.status === 'COMPLETED') {
            return { idempotencyKey, success: true, result: existing.response };
        }
        if (existing.status === 'PENDING') {
            return { idempotencyKey, success: false, error: 'Mutation is already being processed.' };
        }
        if (existing.status === 'FAILED') {
            return { idempotencyKey, success: false, error: 'Previous attempt failed.', result: existing.response };
        }
    }

    // ── Atomic: claim key + apply mutation + resolve key ─────────────────────
    // All three steps in one $transaction. If any step throws, Postgres rolls
    // back everything — the key is never created, the mutation is never applied.
    // The client retries and gets a clean attempt.
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Step 1: Claim the idempotency key
            // If two concurrent requests race here, the second will hit a
            // unique constraint violation and be caught by the outer catch.
            await (tx as any).idempotencyKey.create({
                data: { key: idempotencyKey, tenantId, userId, status: 'PENDING' },
            });

            // Step 2: Apply the mutation via the validated handler in sync/push.ts
            // This is the same path used by the dedicated /sync/push route.
            // It handles stock decrement, VAT, SaleItem creation, and whitelisting.
            const mutationResult = await applyMutation(mutation, tenantId, tx);

            // Step 3: Resolve the idempotency key as COMPLETED
            await (tx as any).idempotencyKey.update({
                where: { key: idempotencyKey },
                data: { status: 'COMPLETED', response: mutationResult },
            });

            return mutationResult;
        }, {
            // Use serializable isolation to prevent concurrent mutations on the
            // same entity from producing inconsistent stock or version state.
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
        });

        return { idempotencyKey, success: true, result };

    } catch (err: any) {
        // ── Race condition: another request claimed the key first ─────────────
        // Re-check — if it is now COMPLETED, return the cached result.
        const raceCheck = await prisma.idempotencyKey.findUnique({
            where: { key: idempotencyKey },
        }).catch(() => null);

        if (raceCheck?.status === 'COMPLETED') {
            return { idempotencyKey, success: true, result: raceCheck.response };
        }

        // ── Genuine mutation failure ──────────────────────────────────────────
        // The transaction rolled back so the key does not exist.
        // Record it as FAILED so the client knows not to retry blindly.
        await prisma.idempotencyKey.upsert({
            where: { key: idempotencyKey },
            create: { key: idempotencyKey, tenantId, userId, status: 'FAILED', response: { error: err.message } },
            update: { status: 'FAILED', response: { error: err.message } },
        }).catch(() => null); // best-effort — do not throw if this also fails

        return {
            idempotencyKey,
            success: false,
            error: err.message || 'Mutation processing failed.',
        };
    }
}

// ── ACK ───────────────────────────────────────────────────────────────────────

/**
 * POST /api/sync/ack
 * Client confirms it has received and persisted the push results.
 * The acknowledged keys can safely be cleaned up server-side.
 */
router.post('/ack', protect, async (req: AuthRequest, res: Response) => {
    try {
        const { idempotencyKeys } = req.body as { idempotencyKeys: string[] };

        if (!Array.isArray(idempotencyKeys)) {
            res.status(400).json({ success: false, error: 'idempotencyKeys must be an array.' });
            return;
        }

        if (idempotencyKeys.length === 0) {
            res.json({ success: true, data: { acknowledged: true, acknowledgedKeys: [] } });
            return;
        }

        // Mark acknowledged keys — client has confirmed receipt.
        // These can be archived or pruned by a scheduled cleanup job.
        await prisma.idempotencyKey.updateMany({
            where: { key: { in: idempotencyKeys } },
            data: { status: 'COMPLETED' },
        }).catch(() => null); // non-fatal if this fails

        res.json({
            success: true,
            data: { acknowledged: true, acknowledgedKeys: idempotencyKeys },
        });
    } catch (error: any) {
        console.error('[sync/ack]', error);
        res.status(500).json({ success: false, error: 'Ack phase failed.' });
    }
});

// ── STATUS ────────────────────────────────────────────────────────────────────

/**
 * GET /api/sync/status
 * Returns server time and basic sync health.
 */
router.get('/status', protect, async (req: AuthRequest, res: Response) => {
    try {
        res.json({
            success: true,
            data: {
                serverTime: new Date().toISOString(),
                pendingConflicts: 0,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: 'Status check failed.' });
    }
});

export default router;



// /**
//  * Sync API Routes: PULL, PUSH, ACK, STATUS
//  * Handles offline-first synchronization with idempotency key deduplication
//  */

// import { Router, Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';
// import { protect, AuthRequest } from '../middleware/auth.middleware';

// const router = Router();
// const prisma = new PrismaClient();

// // ============================================================================
// // PUSH PHASE: Interfaces
// // ============================================================================

// export interface SyncMutation {
//     idempotencyKey: string;
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

// // ============================================================================
// // PULL PHASE: Fetch server changes
// // ============================================================================

// /**
//  * POST /api/sync/pull
//  * Returns server changes since last sync time
//  */
// router.post('/pull', protect, async (req: AuthRequest, res: Response) => {
//     try {
//         const tenantId = req.user?.tenantId;
//         const lastSyncTime = req.body.lastSyncTime ? new Date(req.body.lastSyncTime) : null;
//         const serverTime = new Date();

//         if (!tenantId) {
//             res.status(400).json({
//                 success: false,
//                 error: 'Tenant ID not found in token',
//             });
//             return;
//         }

//         // Fetch all entities changed since last sync
//         const changes: any[] = [];

//         // Get changed products
//         const products = await prisma.product.findMany({
//             where: {
//                 tenantId,
//                 ...(lastSyncTime && { updatedAt: { gt: lastSyncTime } }),
//             },
//             select: {
//                 id: true,
//                 productName: true,
//                 sellingPrice: true,
//                 costPrice: true,
//                 stock: true,
//                 sku: true,
//                 categoryId: true,
//                 version: true,
//                 updatedAt: true,
//                 deleted: true,
//             },
//         });

//         products.forEach(p => {
//             changes.push({
//                 entityType: 'product',
//                 entityId: p.id,
//                 operation: p.deleted ? 'DELETE' : 'UPDATE',
//                 data: p,
//                 version: p.version,
//                 timestamp: p.updatedAt.toISOString(),
//             });
//         });

//         // Get changed sales
//         const sales = await prisma.sale.findMany({
//             where: {
//                 tenantId,
//                 ...(lastSyncTime && { updatedAt: { gt: lastSyncTime } }),
//             },
//             select: {
//                 id: true,
//                 totalAmount: true,
//                 paymentMethod: true,
//                 userId: true,
//                 shiftId: true,
//                 items: true,
//                 version: true,
//                 updatedAt: true,
//                 deleted: true,
//             },
//         });

//         sales.forEach(s => {
//             changes.push({
//                 entityType: 'sale',
//                 entityId: s.id,
//                 operation: s.deleted ? 'DELETE' : 'UPDATE',
//                 data: s,
//                 version: s.version,
//                 timestamp: s.updatedAt.toISOString(),
//             });
//         });

//         // Get changed categories
//         const categories = await prisma.category.findMany({
//             where: {
//                 tenantId,
//                 ...(lastSyncTime && { updatedAt: { gt: lastSyncTime } }),
//             },
//             select: {
//                 id: true,
//                 categoryName: true,
//                 version: true,
//                 updatedAt: true,
//                 deleted: true,
//             },
//         });

//         categories.forEach(c => {
//             changes.push({
//                 entityType: 'category',
//                 entityId: c.id,
//                 operation: c.deleted ? 'DELETE' : 'UPDATE',
//                 data: c,
//                 version: c.version,
//                 timestamp: c.updatedAt.toISOString(),
//             });
//         });

//         res.json({
//             success: true,
//             data: {
//                 serverTime: serverTime.toISOString(),
//                 changes: changes,
//                 changeCount: changes.length,
//             },
//         });
//     } catch (error: any) {
//         console.error('[sync/pull] Error:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Pull phase failed',
//             details: error.message,
//         });
//     }
// });

// // ============================================================================
// // PUSH PHASE: Process mutations with idempotency
// // ============================================================================

// /**
//  * POST /api/sync/push
//  * Process mutations with idempotency key deduplication
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
//  * Process a single mutation with idempotency deduplication
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

//         // Process the mutation
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
//         // Handle unique constraint violation (race condition)
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
//  * Apply mutation to database
//  */
// async function applyMutation(mutation: SyncMutation, tenantId: string): Promise<any> {
//     const { entityType, entityId, mutationType, payload } = mutation;

//     console.log(`Applying ${mutationType} mutation for ${entityType}:${entityId}`);

//     // Route to appropriate handler based on entity type
//     switch (entityType) {
//         case 'product':
//             return await handleProductMutation(entityId, mutationType, payload, tenantId);
//         case 'sale':
//             return await handleSaleMutation(entityId, mutationType, payload, tenantId);
//         case 'category':
//             return await handleCategoryMutation(entityId, mutationType, payload, tenantId);
//         default:
//             throw new Error(`Unknown entity type: ${entityType}`);
//     }
// }

// async function handleProductMutation(id: string, type: string, payload: any, tenantId: string): Promise<any> {
//     if (type === 'CREATE' || type === 'UPDATE') {
//         return await prisma.product.upsert({
//             where: { id },
//             update: { ...payload, updatedAt: new Date() },
//             create: { id, tenantId, ...payload, version: 1 },
//         });
//     } else if (type === 'DELETE') {
//         return await prisma.product.update({
//             where: { id },
//             data: { deleted: true, updatedAt: new Date() },
//         });
//     }
// }

// async function handleSaleMutation(id: string, type: string, payload: any, tenantId: string): Promise<any> {
//     if (type === 'CREATE' || type === 'UPDATE') {
//         return await prisma.sale.upsert({
//             where: { id },
//             update: { ...payload, updatedAt: new Date() },
//             create: { id, tenantId, ...payload, version: 1 },
//         });
//     } else if (type === 'DELETE') {
//         return await prisma.sale.update({
//             where: { id },
//             data: { deleted: true, updatedAt: new Date() },
//         });
//     }
// }

// async function handleCategoryMutation(id: string, type: string, payload: any, tenantId: string): Promise<any> {
//     if (type === 'CREATE' || type === 'UPDATE') {
//         return await prisma.category.upsert({
//             where: { id },
//             update: { ...payload, updatedAt: new Date() },
//             create: { id, tenantId, ...payload, version: 1 },
//         });
//     } else if (type === 'DELETE') {
//         return await prisma.category.update({
//             where: { id },
//             data: { deleted: true, updatedAt: new Date() },
//         });
//     }
// }

// // ============================================================================
// // ACK PHASE: Acknowledge processed mutations
// // ============================================================================

// export interface AckRequest {
//     idempotencyKeys: string[];
// }

// /**
//  * POST /api/sync/ack
//  * Acknowledges processed mutations and confirms which keys were received
//  */
// router.post('/ack', protect, async (req: AuthRequest, res: Response) => {
//     try {
//         const { idempotencyKeys } = req.body as AckRequest;
//         console.log('Received ACK for keys:', idempotencyKeys);

//         if (!Array.isArray(idempotencyKeys)) {
//             res.status(400).json({
//                 success: false,
//                 error: 'idempotencyKeys must be an array',
//             });
//             return;
//         }

//         if (idempotencyKeys.length === 0) {
//             res.json({
//                 success: true,
//                 data: {
//                     acknowledged: true,
//                     acknowledgedKeys: [],
//                 },
//             });
//             return;
//         }

//         // In production: mark mutations as archived/acknowledged in database
//         const acknowledgedKeys = idempotencyKeys;

//         res.json({
//             success: true,
//             data: {
//                 acknowledged: true,
//                 acknowledgedKeys,
//             },
//         });
//     } catch (error: any) {
//         console.error('ACK phase error:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Ack phase failed',
//         });
//     }
// });

// // ============================================================================
// // STATUS PHASE: Get sync status
// // ============================================================================

// /**
//  * GET /api/sync/status
//  * Returns server time and sync status
//  */
// router.get('/status', protect, async (req: AuthRequest, res: Response) => {
//     try {
//         const serverTime = new Date().toISOString();

//         res.json({
//             success: true,
//             data: {
//                 serverTime,
//                 pendingConflicts: 0,
//             },
//         });
//     } catch (error: any) {
//         res.status(500).json({
//             success: false,
//             error: 'Status check failed',
//         });
//     }
// });

// export default router;