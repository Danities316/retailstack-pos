import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addHours, addDays, addWeeks, format, getDay, getWeek, isSameWeek } from 'date-fns';

const prisma = new PrismaClient();
const router = Router();

// Helper to get tenantId from user session or query/header
function getTenantId(req: any): string | undefined {
  // Adjust this logic based on your auth/session implementation
  // Example: tenantId from req.user (populated by auth middleware)
  if (req.user && req.user.tenantId) return req.user.tenantId;
  if (req.query.tenantId) return req.query.tenantId as string;
  if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
  return undefined;
}

router.get('/quick-stats', async (req: any, res: any): Promise<void> => {
  try {
    
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenantId' });
      return;
    }

    // Today
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Yesterday
    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));

    // Sales for today
    const todaySales = await prisma.sale.findMany({
      where: {
        tenantId,
        createdAt: { gte: todayStart, lte: todayEnd }
      }
    });

    // Sales for yesterday
    const yesterdaySales = await prisma.sale.findMany({
      where: {
        tenantId,
        createdAt: { gte: yesterdayStart, lte: yesterdayEnd }
      }
    });

    // Calculate stats
    const totalSales = todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    const transactions = todaySales.length;
    const avgSale = transactions > 0 ? totalSales / transactions : 0;

    // Tax: If you have a tax field, sum it. Otherwise, set to 0 or calculate if possible.
    const taxCollected = 0; // Placeholder

    // Compare with yesterday
    const yesterdayTotal = yesterdaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    const compareYesterday = yesterdayTotal === 0
      ? '+100%'
      : `${((totalSales - yesterdayTotal) / yesterdayTotal * 100).toFixed(0)}%`;
      
      const result = {
        totalSales: `₦${totalSales.toFixed(2)}`,
        transactions,
        avgSale: `₦${avgSale.toFixed(2)}`,
        taxCollected: `₦${taxCollected.toFixed(2)}`,
        compareYesterday: compareYesterday.startsWith('-') ? compareYesterday : `+${compareYesterday}`
      }
     res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch quick stats', message: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/sales-chart', async (req: any, res: any): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenantId' });
      return;
    }
    const range = (req.query.range as string) || 'today';
    const now = new Date();
    let sales: any[] = [];
    if (range === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      sales = await prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      });
      // Group by hour
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const data = hours.map(hour => {
        const label = format(addHours(start, hour), 'haaa').replace('AM', 'AM').replace('PM', 'PM');
        const group = sales.filter(sale => new Date(sale.createdAt).getHours() === hour);
        return {
          time: label,
          sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
          transactions: group.length,
        };
      });
      res.json({ data });
      return;
    } else if (range === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(now, { weekStartsOn: 1 });
      sales = await prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      });
      // Group by day
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = days.map((date, i) => {
        const group = sales.filter(sale => getDay(new Date(sale.createdAt)) === getDay(date));
        return {
          time: dayLabels[i],
          sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
          transactions: group.length,
        };
      });
      res.json({ data });
      return;
    } else if (range === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      sales = await prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      });
      // Group by week number in month
      const weeks = [];
      let weekStart = startOfWeek(start, { weekStartsOn: 1 });
      while (weekStart < end) {
        weeks.push(weekStart);
        weekStart = addWeeks(weekStart, 1);
      }
      const data = weeks.map((week, i) => {
        const group = sales.filter(sale => isSameWeek(new Date(sale.createdAt), week, { weekStartsOn: 1 }));
        return {
          time: `Week ${i + 1}`,
          sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
          transactions: group.length,
        };
      });
      res.json({ data });
      return;
    } else {
      res.status(400).json({ error: 'Invalid range' });
      return;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sales chart data', message: err instanceof Error ? err.message : String(err) });
  }
});

router.get('/recent-sales', async (req: any, res: any): Promise<void> => {
  try {
   
    const tenantId = getTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenantId' });
      return;
    }
    const limit = parseInt(req.query.limit as string) || 5;
    const sales = await prisma.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    console.log("see data: ", sales)
    const data = sales.map(sale => ({
      id: sale.id,
      customer: 'N/A',
      items: 0, // Since items is not in the Sale model, default to 0
      total: Number(sale.totalAmount),
      time: sale.createdAt,
      status: 'Completed',
    }));
    
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recent sales', message: err instanceof Error ? err.message : String(err) });
  }
});

export default router; 