import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

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
 * Apply mutation to database (placeholder).
 * In production, this would route to appropriate handlers based on entityType.
 */
async function applyMutation(mutation: SyncMutation, tenantId: string): Promise<any> {
    const { entityType, entityId, mutationType, payload } = mutation;

    // Route to appropriate handler based on entity type
    // This is a placeholder - implement actual business logic
    console.log(`Applying ${mutationType} mutation for ${entityType}:${entityId}`);

    return {
        entityType,
        entityId,
        mutationType,
        status: 'processed',
    };
}

export default router;
