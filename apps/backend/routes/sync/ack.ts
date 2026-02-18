import { Router, Request, Response } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();

export interface AckRequest {
    idempotencyKeys: string[];
}

/**
 * POST /api/sync/ack
 * Acknowledges processed mutations and confirms which keys were received.
 * Returns list of acknowledged keys to ensure client-server alignment.
 */
router.post('/ack', protect, async (req: AuthRequest, res: Response) => {
    try {
        const { idempotencyKeys } = req.body as AckRequest;

        if (!Array.isArray(idempotencyKeys)) {
            res.status(400).json({
                success: false,
                error: 'idempotencyKeys must be an array',
            });
            return;
        }

        if (idempotencyKeys.length === 0) {
            res.json({
                success: true,
                data: {
                    acknowledged: true,
                    acknowledgedKeys: [],
                },
            });
            return;
        }

        // In production: mark mutations as archived/acknowledged in database
        // For now: return all keys as acknowledged (echo back confirmation)
        const acknowledgedKeys = idempotencyKeys;

        res.json({
            success: true,
            data: {
                acknowledged: true,
                acknowledgedKeys,
            },
        });
    } catch (error: any) {
        console.error('ACK phase error:', error);
        res.status(500).json({
            success: false,
            error: 'Ack phase failed',
        });
    }
});

export default router;
