import { Router } from 'express';
import pullRoutes from './pull';
import pushRoutes from './push';
import ackRoutes from './ack';
import statusRoutes from './status';

const router = Router();

router.use('/', pullRoutes);
router.use('/', pushRoutes);
router.use('/', ackRoutes);
router.use('/', statusRoutes);

export default router;
