import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();
const prisma = new PrismaClient();

router.use(checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]));

// GET /api/dashboard/manager-stats
router.get('/manager-stats', async (req: AuthRequest, res: any) => {
    const tenantId = req.user!.tenantId;
    const LOW_STOCK_THRESHOLD = 5; // Define your low stock limit

    if (!tenantId) {
        return res.status(401).json({ error: 'Tenant ID not found.' });
    }

    try {
        // --- 1. Staff Clocked In ---
        const [clockedInCount, totalStaffCount] = await prisma.$transaction([
            prisma.shift.count({
                where: { tenantId, endTime: null }, // Count active shifts
            }),
            prisma.user.count({
                where: { tenantId, role: { in: ['CASHIER', 'MANAGER'] } } // Count Cashiers and Managers
            })
        ]);

        // --- 2. Low Stock Alerts ---
        const lowStockItems = await prisma.product.findMany({
            where: { tenantId, stock: { lte: LOW_STOCK_THRESHOLD } },
            select: { id: true, productName: true, stock: true },
            orderBy: { stock: 'asc' },
            take: 5, // Limit the list
        });
        const lowStockCount = lowStockItems.length;


        // --- 3. Current Shift Sales & 4. Staff Performance Leaderboard ---
        const activeShifts = await prisma.shift.findMany({
            where: { tenantId, endTime: null },
            select: { id: true, cashierId: true },
        });
        const activeShiftIds = activeShifts.map(s => s.id);

        let currentShiftSales = new Decimal(0);
        let leaderboard: { name: string; sales: number; }[] = [];

        if (activeShiftIds.length > 0) {
            // Prisma.groupBy failed because 'cashierId' may not be a scalar field in schema.
            // Fallback to findMany + manual grouping (works regardless of schema differences).
            const salesRows = await prisma.sale.findMany({
                where: { shiftId: { in: activeShiftIds } },
                select: { userId: true, totalAmount: true } // use userId (cashier) field present on Sale
            });

            // Aggregate totals by userId (cashier)
            const salesMap = new Map<string, Decimal>();
            salesRows.forEach(r => {
                const id = r.userId || 'unknown'
                const amt = new Decimal((r.totalAmount as any) || 0)
                const prev = salesMap.get(id)
                if (prev) salesMap.set(id, prev.plus(amt))
                else salesMap.set(id, amt)
            })

            // Build salesData similar to groupBy result
            const salesData = Array.from(salesMap.entries()).map(([userId, totalAmount]) => ({
                userId,
                _sum: { totalAmount }
            }))

            // Calculate total shift sales
            currentShiftSales = salesData.reduce((sum: Decimal, entry) => sum.plus(entry._sum.totalAmount || 0), new Decimal(0));

            // Fetch User Names for Leaderboard
            const userIds = salesData.map(d => d.userId).filter(id => id !== 'unknown');
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, email: true }
            });
            const userMap = new Map(users.map(u => [u.id, u.name || u.email]));

            // Build the Leaderboard
            leaderboard = salesData
                .map(data => ({
                    name: userMap.get(data.userId) || 'Unknown Cashier',
                    sales: (data._sum.totalAmount?.toNumber?.() || Number(data._sum.totalAmount) || 0),
                }))
                .sort((a, b) => b.sales - a.sales);
        }


        res.json({
            staffClockedIn: { current: clockedInCount, total: totalStaffCount },
            lowStock: { count: lowStockCount, items: lowStockItems },
            currentShiftSales: currentShiftSales.toNumber(),
            staffLeaderboard: leaderboard,
        });

    } catch (error) {
        console.error('Error fetching manager stats:', error);
        res.status(500).json({ error: 'Failed to fetch manager dashboard statistics.' });
    }
});

export default router;