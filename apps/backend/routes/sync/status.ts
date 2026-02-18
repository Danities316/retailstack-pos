import { Router, Request, Response } from 'express';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/sync/status
 * Returns server time and zero pending conflicts.
 */
router.get('/status', protect, async (req: Request, res: Response) => {
    try {
        const serverTime = new Date().toISOString();

        res.json({
            success: true,
            data: {
                serverTime,
                pendingConflicts: 0,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Status check failed',
        });
    }
});

export default router;
