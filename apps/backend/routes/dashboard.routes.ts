import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  startOfDay, endOfDay, subDays,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  addHours, addDays, addWeeks,
  format, getDay, isSameWeek
} from 'date-fns';
import { ReportService } from '../services/report.service';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

// ── ALL routes in this file use req.user.tenantId exclusively. ────────────────
// There is no fallback to req.query or req.headers.
// The protect() middleware in index.ts guarantees req.user is set before
// any route here is reached. If it is missing, something is misconfigured
// at the router-mount level — return 401 immediately.

function requireTenantId(req: AuthRequest, res: any): string | null {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    res.status(401).json({ error: 'Unauthorized: tenant context missing.' });
    return null;
  }
  return tenantId;
}

// ── GET /dashboard/quick-stats ────────────────────────────────────────────────
router.get('/quick-stats', async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = requireTenantId(req, res);
    if (!tenantId) return;

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));

    const [todaySales, yesterdaySales] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      }),
    ]);

    const totalSales = todaySales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const transactions = todaySales.length;
    const avgSale = transactions > 0 ? totalSales / transactions : 0;
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const pct = yesterdayTotal === 0
      ? '+100%'
      : `${((totalSales - yesterdayTotal) / yesterdayTotal * 100).toFixed(0)}%`;

    res.json({
      totalSales: `₦${totalSales.toFixed(2)}`,
      transactions,
      avgSale: `₦${avgSale.toFixed(2)}`,
      taxCollected: `₦0.00`,
      compareYesterday: pct.startsWith('-') ? pct : `+${pct}`,
    });
  } catch (err) {
    console.error('[quick-stats]', err);
    res.status(500).json({ error: 'Failed to fetch quick stats.' });
  }
});

// ── GET /dashboard/sales-chart ────────────────────────────────────────────────
router.get('/sales-chart', async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = requireTenantId(req, res);
    if (!tenantId) return;

    const range = (req.query.range as string) || 'today';
    const now = new Date();

    if (range === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      const sales = await prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      });
      const data = Array.from({ length: 24 }, (_, hour) => {
        const label = format(addHours(start, hour), 'haaa');
        const group = sales.filter(s => new Date(s.createdAt).getHours() === hour);
        return {
          time: label,
          sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
          transactions: group.length,
        };
      });
      res.json({ data });
      return;
    }

    if (range === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      const sales = await prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      });
      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const group = sales.filter(s => getDay(new Date(s.createdAt)) === getDay(date));
        return {
          time: dayLabels[i],
          sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
          transactions: group.length,
        };
      });
      res.json({ data });
      return;
    }

    if (range === 'month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      const sales = await prisma.sale.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      });
      const weeks: Date[] = [];
      let weekStart = startOfWeek(start, { weekStartsOn: 1 });
      while (weekStart < end) {
        weeks.push(weekStart);
        weekStart = addWeeks(weekStart, 1);
      }
      const data = weeks.map((week, i) => {
        const group = sales.filter(s =>
          isSameWeek(new Date(s.createdAt), week, { weekStartsOn: 1 })
        );
        return {
          time: `Week ${i + 1}`,
          sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
          transactions: group.length,
        };
      });
      res.json({ data });
      return;
    }

    res.status(400).json({ error: 'Invalid range. Use: today, week, month.' });
  } catch (err) {
    console.error('[sales-chart]', err);
    res.status(500).json({ error: 'Failed to fetch sales chart data.' });
  }
});

// ── GET /dashboard/recent-sales ───────────────────────────────────────────────
router.get('/recent-sales', async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = requireTenantId(req, res);
    if (!tenantId) return;

    const limit = Math.min(parseInt(req.query.limit as string) || 5, 50);
    const sales = await prisma.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { items: { select: { quantity: true } } },
    });

    const data = sales.map(sale => ({
      id: sale.id,
      customer: 'N/A',
      items: sale.items.reduce((sum, i) => sum + i.quantity, 0),
      total: Number(sale.totalAmount),
      time: sale.createdAt,
      status: 'Completed',
    }));

    res.json({ data });
  } catch (err) {
    console.error('[recent-sales]', err);
    res.status(500).json({ error: 'Failed to fetch recent sales.' });
  }
});

// ── GET /dashboard/daily-summary ─────────────────────────────────────────────
router.get('/daily-summary', async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = requireTenantId(req, res);
    if (!tenantId) return;

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));

    const [salesReport, profitReport, todaySales, yesterdaySales, saleItems] =
      await Promise.all([
        ReportService.generateSalesReport(tenantId, todayStart, todayEnd, 'daily'),
        ReportService.generateProfitLoss(tenantId, todayStart, todayEnd),
        prisma.sale.findMany({
          where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } },
        }),
        prisma.sale.findMany({
          where: { tenantId, createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        }),
        prisma.saleItem.findMany({
          where: { sale: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } },
          include: { product: true },
        }),
      ]);

    const itemsSold = saleItems.reduce((sum, item) => sum + item.quantity, 0);
    const taxCollected = todaySales.reduce((sum, s) => sum + Number(s.taxAmount), 0);
    const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const pct = yesterdayTotal === 0
      ? '+100%'
      : `${((salesReport.totalSales - yesterdayTotal) / yesterdayTotal * 100).toFixed(0)}%`;

    const productMap = new Map<string, { productId: string; productName: string; quantitySold: number }>();
    saleItems.forEach(({ productId, quantity, product }) => {
      const name = product?.productName || 'Unknown';
      const existing = productMap.get(productId);
      if (!existing) {
        productMap.set(productId, { productId, productName: name, quantitySold: quantity });
      } else {
        existing.quantitySold += quantity;
      }
    });
    const topProduct = Array.from(productMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)[0] || null;

    const isCashier = req.user?.role === 'CASHIER';

    res.json({
      totalSales: salesReport.totalSales,
      transactions: salesReport.transactionCount,
      averageOrderValue: salesReport.averageOrderValue,
      taxCollected,
      compareYesterday: pct.startsWith('-') ? pct : `+${pct}`,
      costOfGoodsSold: isCashier ? null : profitReport.totalCOGS,
      grossProfit: isCashier ? null : profitReport.grossProfit,
      itemsSold,
      topProduct,
    });
  } catch (err) {
    console.error('[daily-summary]', err);
    res.status(500).json({ error: 'Failed to fetch daily summary.' });
  }
});

// ── GET /dashboard/top-products ───────────────────────────────────────────────
router.get('/top-products', async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = requireTenantId(req, res);
    if (!tenantId) return;

    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const saleItems = await prisma.saleItem.findMany({
      where: { sale: { tenantId, createdAt: { gte: todayStart, lte: todayEnd } } },
      select: {
        quantity: true,
        productId: true,
        product: { select: { productName: true } },
      },
    });

    const counts = new Map<string, { productName: string; quantitySold: number }>();
    saleItems.forEach(item => {
      const name = item.product?.productName ?? 'Unknown';
      const existing = counts.get(item.productId);
      if (!existing) {
        counts.set(item.productId, { productName: name, quantitySold: item.quantity });
      } else {
        existing.quantitySold += item.quantity;
      }
    });

    const ranked = Array.from(counts.entries())
      .sort(([, a], [, b]) => b.quantitySold - a.quantitySold)
      .slice(0, limit)
      .map(([productId, { productName, quantitySold }], idx) => ({
        rank: idx + 1,
        productId,
        productName,
        quantitySold,
      }));

    res.json(ranked);
  } catch (err) {
    console.error('[top-products]', err);
    res.status(500).json({ error: 'Failed to fetch top products.' });
  }
});

router.get('/weekly-summary', async (_req, res) => res.json({}));
router.get('/monthly-summary', async (_req, res) => res.json({}));

export default router;


// import { Router, Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';
// import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addHours, addDays, addWeeks, format, getDay, getWeek, isSameWeek } from 'date-fns';
// import { ReportService } from '../services/report.service';

// const prisma = new PrismaClient();
// const router = Router();

// // Helper to get tenantId from user session or query/header
// function getTenantId(req: any): string | undefined {
//   // Adjust this logic based on your auth/session implementation
//   // Example: tenantId from req.user (populated by auth middleware)
//   if (req.user && req.user.tenantId) return req.user.tenantId;
//   if (req.query.tenantId) return req.query.tenantId as string;
//   if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
//   return undefined;
// }

// router.get('/quick-stats', async (req: any, res: any): Promise<void> => {
//   try {

//     const tenantId = getTenantId(req);

//     if (!tenantId) {
//       res.status(400).json({ error: 'Missing tenantId' });
//       return;
//     }

//     // Today
//     const todayStart = startOfDay(new Date());
//     const todayEnd = endOfDay(new Date());

//     console.log("todayStart: ", todayStart);

//     // Yesterday
//     const yesterdayStart = startOfDay(subDays(new Date(), 1));
//     const yesterdayEnd = endOfDay(subDays(new Date(), 1));

//     // Sales for today
//     const todaySales = await prisma.sale.findMany({
//       where: {
//         tenantId,
//         createdAt: { gte: todayStart, lte: todayEnd }
//       }
//     });

//     // Sales for yesterday
//     const yesterdaySales = await prisma.sale.findMany({
//       where: {
//         tenantId,
//         createdAt: { gte: yesterdayStart, lte: yesterdayEnd }
//       }
//     });

//     // Calculate stats
//     const totalSales = todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
//     const transactions = todaySales.length;
//     const avgSale = transactions > 0 ? totalSales / transactions : 0;

//     // Tax: If you have a tax field, sum it. Otherwise, set to 0 or calculate if possible.
//     const taxCollected = 0; // Placeholder

//     // Compare with yesterday
//     const yesterdayTotal = yesterdaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
//     const compareYesterday = yesterdayTotal === 0
//       ? '+100%'
//       : `${((totalSales - yesterdayTotal) / yesterdayTotal * 100).toFixed(0)}%`;

//     const result = {
//       totalSales: `₦${totalSales.toFixed(2)}`,
//       transactions,
//       avgSale: `₦${avgSale.toFixed(2)}`,
//       taxCollected: `₦${taxCollected.toFixed(2)}`,
//       compareYesterday: compareYesterday.startsWith('-') ? compareYesterday : `+${compareYesterday}`
//     }
//     res.json(result);

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch quick stats', message: err instanceof Error ? err.message : String(err) });
//   }
// });

// router.get('/sales-chart', async (req: any, res: any): Promise<void> => {
//   try {

//     const tenantId = getTenantId(req);
//     if (!tenantId) {
//       res.status(400).json({ error: 'Missing tenantId' });
//       return;
//     }
//     const range = (req.query.range as string) || 'today';
//     const now = new Date();
//     let sales: any[] = [];
//     if (range === 'today') {
//       const start = startOfDay(now);
//       const end = endOfDay(now);
//       sales = await prisma.sale.findMany({
//         where: { tenantId, createdAt: { gte: start, lte: end } },
//       });
//       // Group by hour
//       const hours = Array.from({ length: 24 }, (_, i) => i);
//       const data = hours.map(hour => {
//         const label = format(addHours(start, hour), 'haaa').replace('AM', 'AM').replace('PM', 'PM');
//         const group = sales.filter(sale => new Date(sale.createdAt).getHours() === hour);
//         return {
//           time: label,
//           sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
//           transactions: group.length,
//         };
//       });
//       res.json({ data });
//       return;
//     } else if (range === 'week') {
//       const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
//       const end = endOfWeek(now, { weekStartsOn: 1 });
//       sales = await prisma.sale.findMany({
//         where: { tenantId, createdAt: { gte: start, lte: end } },
//       });
//       // Group by day
//       const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
//       const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
//       const data = days.map((date, i) => {
//         const group = sales.filter(sale => getDay(new Date(sale.createdAt)) === getDay(date));
//         return {
//           time: dayLabels[i],
//           sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
//           transactions: group.length,
//         };
//       });
//       res.json({ data });
//       return;
//     } else if (range === 'month') {
//       const start = startOfMonth(now);
//       const end = endOfMonth(now);
//       sales = await prisma.sale.findMany({
//         where: { tenantId, createdAt: { gte: start, lte: end } },
//       });
//       // Group by week number in month
//       const weeks = [];
//       let weekStart = startOfWeek(start, { weekStartsOn: 1 });
//       while (weekStart < end) {
//         weeks.push(weekStart);
//         weekStart = addWeeks(weekStart, 1);
//       }
//       const data = weeks.map((week, i) => {
//         const group = sales.filter(sale => isSameWeek(new Date(sale.createdAt), week, { weekStartsOn: 1 }));
//         return {
//           time: `Week ${i + 1}`,
//           sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
//           transactions: group.length,
//         };
//       });
//       res.json({ data });
//       return;
//     } else {
//       res.status(400).json({ error: 'Invalid range' });
//       return;
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch sales chart data', message: err instanceof Error ? err.message : String(err) });
//   }
// });

// router.get('/recent-sales', async (req: any, res: any): Promise<void> => {
//   try {

//     const tenantId = getTenantId(req);
//     if (!tenantId) {
//       res.status(400).json({ error: 'Missing tenantId' });
//       return;
//     }
//     const limit = parseInt(req.query.limit as string) || 5;
//     const sales = await prisma.sale.findMany({
//       where: { tenantId },
//       orderBy: { createdAt: 'desc' },
//       take: limit,
//     });


//     const data = sales.map(sale => ({
//       id: sale.id,
//       customer: 'N/A',
//       items: 0, // Since items is not in the Sale model, default to 0
//       total: Number(sale.totalAmount),
//       time: sale.createdAt,
//       status: 'Completed',
//     }));

//     res.json({ data });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch recent sales', message: err instanceof Error ? err.message : String(err) });
//   }
// });

// router.get('/daily-summary', async (req: any, res: any): Promise<void> => {
//   try {
//     const tenantId = getTenantId(req);
//     if (!tenantId) {
//       res.status(400).json({ error: 'Missing tenantId' });
//       return;
//     }

//     console.log("Fetching daily summary for tenantId: ", tenantId);

//     const todayStart = startOfDay(new Date());
//     const todayEnd = endOfDay(new Date());

//     const todaySales = await prisma.sale.findMany({
//       where: {
//         tenantId,
//         createdAt: { gte: todayStart, lte: todayEnd }
//       }
//     });

//     const [salesReport, profitReport] = await Promise.all([
//       ReportService.generateSalesReport(tenantId, todayStart, todayEnd, 'daily'),
//       ReportService.generateProfitLoss(tenantId, todayStart, todayEnd),
//     ]);

//     const saleItems = await prisma.saleItem.findMany({
//       where: {
//         sale: {
//           tenantId,
//           createdAt: { gte: todayStart, lte: todayEnd }
//         }
//       },
//       include: { product: true }
//     });

//     const itemsSold = saleItems.reduce((sum, item) => sum + item.quantity, 0);

//     const productQuantityMap = new Map<string, { productId: string; productName: string; quantitySold: number }>();
//     saleItems.forEach((item) => {
//       const { productId, quantity, product } = item;
//       const existing = productQuantityMap.get(productId);
//       const name = product?.productName || 'Unknown';
//       if (!existing) {
//         productQuantityMap.set(productId, {
//           productId,
//           productName: name,
//           quantitySold: quantity,
//         });
//       } else {
//         existing.quantitySold += quantity;
//       }
//     });

//     const topProduct = Array.from(productQuantityMap.values())
//       .sort((a, b) => b.quantitySold - a.quantitySold)[0] || null;

//     const yesterdayStart = startOfDay(subDays(new Date(), 1));
//     const yesterdayEnd = endOfDay(subDays(new Date(), 1));
//     const yesterdaySales = await prisma.sale.findMany({
//       where: {
//         tenantId,
//         createdAt: { gte: yesterdayStart, lte: yesterdayEnd }
//       }
//     });

//     const yesterdayTotal = yesterdaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
//     const compareYesterday = yesterdayTotal === 0
//       ? '+100%'
//       : `${((salesReport.totalSales - yesterdayTotal) / yesterdayTotal * 100).toFixed(0)}%`;

//     const isCashier = req.user?.role === 'CASHIER';
//     const taxCollected = todaySales.reduce((sum, sale) => sum + Number(sale.taxAmount), 0);

//     res.json({
//       totalSales: salesReport.totalSales,
//       transactions: salesReport.transactionCount,
//       averageOrderValue: salesReport.averageOrderValue,
//       taxCollected,
//       compareYesterday: compareYesterday.startsWith('-') ? compareYesterday : `+${compareYesterday}`,
//       costOfGoodsSold: isCashier ? null : profitReport.totalCOGS,
//       grossProfit: isCashier ? null : profitReport.grossProfit,
//       itemsSold,
//       topProduct,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch daily summary', message: err instanceof Error ? err.message : String(err) });
//   }
// });
// router.get('/weekly-summary', async (req: any, res: any): Promise<void> => { });
// router.get('/monthly-summary', async (req: any, res: any): Promise<void> => { });

// // ─── GET /dashboard/top-products ─────────────────────────────────────────────
// // Returns the top N selling products for today, ranked by units sold.
// // Query param: limit (default 5, max 20)
// // Response: Array<{ rank, productId, productName, quantitySold }>
// router.get('/top-products', async (req: any, res: any): Promise<void> => {
//   try {
//     const tenantId = getTenantId(req);
//     if (!tenantId) {
//       res.status(400).json({ error: 'Missing tenantId' });
//       return;
//     }

//     const limit = Math.min(Number(req.query.limit) || 5, 20);
//     const todayStart = startOfDay(new Date());
//     const todayEnd = endOfDay(new Date());

//     // Fetch all sale items for today in a single query, join product name
//     const saleItems = await prisma.saleItem.findMany({
//       where: {
//         sale: {
//           tenantId,
//           createdAt: { gte: todayStart, lte: todayEnd },
//         },
//       },
//       select: {
//         quantity: true,
//         productId: true,
//         product: { select: { productName: true } },
//       },
//     });

//     // Aggregate quantity by productId
//     const counts = new Map<string, { productName: string; quantitySold: number }>();
//     saleItems.forEach(item => {
//       const existing = counts.get(item.productId);
//       const name = item.product?.productName ?? 'Unknown';
//       if (!existing) {
//         counts.set(item.productId, { productName: name, quantitySold: item.quantity });
//       } else {
//         existing.quantitySold += item.quantity;
//       }
//     });

//     // Sort descending, take top N, add rank
//     const ranked = Array.from(counts.entries())
//       .sort(([, a], [, b]) => b.quantitySold - a.quantitySold)
//       .slice(0, limit)
//       .map(([productId, { productName, quantitySold }], idx) => ({
//         rank: idx + 1,
//         productId,
//         productName,
//         quantitySold,
//       }));

//     res.json(ranked);
//   } catch (err) {
//     console.error('[top-products]', err);
//     res.status(500).json({ error: 'Failed to fetch top products' });
//   }
// });

// export default router;