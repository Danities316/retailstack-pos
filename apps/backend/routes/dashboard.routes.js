"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// Helper to get tenantId from user session or query/header
function getTenantId(req) {
    // Adjust this logic based on your auth/session implementation
    // Example: tenantId from req.user (populated by auth middleware)
    if (req.user && req.user.tenantId)
        return req.user.tenantId;
    if (req.query.tenantId)
        return req.query.tenantId;
    if (req.headers['x-tenant-id'])
        return req.headers['x-tenant-id'];
    return undefined;
}
router.get('/quick-stats', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            res.status(400).json({ error: 'Missing tenantId' });
            return;
        }
        // Today
        const todayStart = (0, date_fns_1.startOfDay)(new Date());
        const todayEnd = (0, date_fns_1.endOfDay)(new Date());
        console.log("todayStart: ", todayStart);
        // Yesterday
        const yesterdayStart = (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(new Date(), 1));
        const yesterdayEnd = (0, date_fns_1.endOfDay)((0, date_fns_1.subDays)(new Date(), 1));
        // Sales for today
        const todaySales = yield prisma.sale.findMany({
            where: {
                tenantId,
                createdAt: { gte: todayStart, lte: todayEnd }
            }
        });
        // Sales for yesterday
        const yesterdaySales = yield prisma.sale.findMany({
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
        };
        res.json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch quick stats', message: err instanceof Error ? err.message : String(err) });
    }
}));
router.get('/sales-chart', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            res.status(400).json({ error: 'Missing tenantId' });
            return;
        }
        const range = req.query.range || 'today';
        const now = new Date();
        let sales = [];
        if (range === 'today') {
            const start = (0, date_fns_1.startOfDay)(now);
            const end = (0, date_fns_1.endOfDay)(now);
            sales = yield prisma.sale.findMany({
                where: { tenantId, createdAt: { gte: start, lte: end } },
            });
            // Group by hour
            const hours = Array.from({ length: 24 }, (_, i) => i);
            const data = hours.map(hour => {
                const label = (0, date_fns_1.format)((0, date_fns_1.addHours)(start, hour), 'haaa').replace('AM', 'AM').replace('PM', 'PM');
                const group = sales.filter(sale => new Date(sale.createdAt).getHours() === hour);
                return {
                    time: label,
                    sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
                    transactions: group.length,
                };
            });
            res.json({ data });
            return;
        }
        else if (range === 'week') {
            const start = (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 }); // Monday
            const end = (0, date_fns_1.endOfWeek)(now, { weekStartsOn: 1 });
            sales = yield prisma.sale.findMany({
                where: { tenantId, createdAt: { gte: start, lte: end } },
            });
            // Group by day
            const days = Array.from({ length: 7 }, (_, i) => (0, date_fns_1.addDays)(start, i));
            const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const data = days.map((date, i) => {
                const group = sales.filter(sale => (0, date_fns_1.getDay)(new Date(sale.createdAt)) === (0, date_fns_1.getDay)(date));
                return {
                    time: dayLabels[i],
                    sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
                    transactions: group.length,
                };
            });
            res.json({ data });
            return;
        }
        else if (range === 'month') {
            const start = (0, date_fns_1.startOfMonth)(now);
            const end = (0, date_fns_1.endOfMonth)(now);
            sales = yield prisma.sale.findMany({
                where: { tenantId, createdAt: { gte: start, lte: end } },
            });
            // Group by week number in month
            const weeks = [];
            let weekStart = (0, date_fns_1.startOfWeek)(start, { weekStartsOn: 1 });
            while (weekStart < end) {
                weeks.push(weekStart);
                weekStart = (0, date_fns_1.addWeeks)(weekStart, 1);
            }
            const data = weeks.map((week, i) => {
                const group = sales.filter(sale => (0, date_fns_1.isSameWeek)(new Date(sale.createdAt), week, { weekStartsOn: 1 }));
                return {
                    time: `Week ${i + 1}`,
                    sales: group.reduce((sum, s) => sum + Number(s.totalAmount), 0),
                    transactions: group.length,
                };
            });
            res.json({ data });
            return;
        }
        else {
            res.status(400).json({ error: 'Invalid range' });
            return;
        }
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch sales chart data', message: err instanceof Error ? err.message : String(err) });
    }
}));
router.get('/recent-sales', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
            res.status(400).json({ error: 'Missing tenantId' });
            return;
        }
        const limit = parseInt(req.query.limit) || 5;
        const sales = yield prisma.sale.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        const data = sales.map(sale => ({
            id: sale.id,
            customer: 'N/A',
            items: 0, // Since items is not in the Sale model, default to 0
            total: Number(sale.totalAmount),
            time: sale.createdAt,
            status: 'Completed',
        }));
        res.json({ data });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch recent sales', message: err instanceof Error ? err.message : String(err) });
    }
}));
exports.default = router;
