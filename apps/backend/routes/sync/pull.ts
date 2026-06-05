import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { protect } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/sync/pull
 * Returns server changes since last sync time
 * The client sends lastSyncTime and we return all changes since then
 */
router.post('/pull', protect, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId;
        const lastSyncTime = req.body.lastSyncTime ? new Date(req.body.lastSyncTime) : null;
        const serverTime = new Date();

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'Tenant ID not found in token',
            });
        }

        // Fetch all entities changed since last sync
        const changes: any[] = [];

        // Get changed products
        const products = await prisma.product.findMany({
            where: {
                tenantId,
                ...(lastSyncTime && { updatedAt: { gt: lastSyncTime } }),
            },
            select: {
                id: true,
                productName: true,
                sellingPrice: true,
                costPrice: true,
                stock: true,
                sku: true,
                categoryId: true,
                version: true,
                updatedAt: true,
                deleted: true,
            },
        });

        products.forEach(p => {
            changes.push({
                entityType: 'product',
                entityId: p.id,
                operation: p.deleted ? 'DELETE' : 'UPDATE',
                data: p,
                version: p.version,
                timestamp: p.updatedAt.toISOString(),
            });
        });

        // Get changed sales
        const sales = await prisma.sale.findMany({
            where: {
                tenantId,
                ...(lastSyncTime && { updatedAt: { gt: lastSyncTime } }),
            },
            select: {
                id: true,
                totalAmount: true,
                paymentMethod: true,
                taxRate: true,
                taxAmount: true,
                subtotal: true,
                createdAt: true,
                updatedAt: true,
                tenantId: true,
                userId: true,
                shiftId: true,
                items: true,
            },
        });

        sales.forEach(s => {
            const version = s.updatedAt.getTime();
            changes.push({
                entityType: 'sale',
                entityId: s.id,
                operation: 'UPDATE',
                data: s,
                version,
                timestamp: s.updatedAt.toISOString(),
            });
        });

        // Get changed categories
        const categories = await prisma.category.findMany({
            where: {
                tenantId,
                ...(lastSyncTime && { updatedAt: { gt: lastSyncTime } }),
            },
            select: {
                id: true,
                categoryName: true,
                version: true,
                updatedAt: true,
                deleted: true,
            },
        });

        categories.forEach(c => {
            changes.push({
                entityType: 'category',
                entityId: c.id,
                operation: c.deleted ? 'DELETE' : 'UPDATE',
                data: c,
                version: c.version,
                timestamp: c.updatedAt.toISOString(),
            });
        });

        res.json({
            success: true,
            data: {
                serverTime: serverTime.toISOString(),
                changes: changes,
                changeCount: changes.length,
            },
        });
    } catch (error: any) {
        console.error('[sync/pull] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Pull phase failed',
            details: error.message,
        });
    }
});

export default router;
