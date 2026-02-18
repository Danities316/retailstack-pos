import { Router, Request, Response } from 'express';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/sync/pull
 * Returns server time and empty changes object.
 */
router.post('/pull', protect, async (req: Request, res: Response) => {
    try {
        const serverTime = new Date().toISOString();

        res.json({
            success: true,
            data: {
                serverTime,
                changes: [],
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Pull phase failed',
        });
    }
});

export default router;
