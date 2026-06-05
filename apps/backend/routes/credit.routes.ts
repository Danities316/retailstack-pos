import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { protect, AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import { UserRole } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ── GET /api/credit/customers ─────────────────────────────────────────────────
// List all customers with outstanding balances for this tenant.
router.get('/customers', protect, async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const customers = await prisma.customer.findMany({
            where: { tenantId },
            orderBy: { totalOwed: 'desc' },
            include: {
                creditSales: {
                    where: { settled: false },
                    orderBy: { createdAt: 'desc' },
                    include: { sale: { select: { createdAt: true, totalAmount: true } } },
                },
            },
        });
        res.json({ success: true, data: customers });
    } catch (err) {
        console.error('[credit/customers]', err);
        res.status(500).json({ error: 'Failed to fetch customers.' });
    }
});

// ── POST /api/credit/customers ────────────────────────────────────────────────
// Create or find a customer by name + phone.
router.post('/customers', protect, async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const { name, phone } = req.body;

        if (!name?.trim()) {
            res.status(400).json({ error: 'Customer name is required.' });
            return;
        }

        // Find existing customer with same name + phone to avoid duplicates
        const existing = await prisma.customer.findFirst({
            where: {
                tenantId,
                name: { equals: name.trim(), mode: 'insensitive' },
                ...(phone ? { phone: phone.trim() } : {}),
            },
        });

        if (existing) {
            res.json({ success: true, data: existing, created: false });
            return;
        }

        const customer = await prisma.customer.create({
            data: { tenantId, name: name.trim(), phone: phone?.trim() || null },
        });

        res.json({ success: true, data: customer, created: true });
    } catch (err) {
        console.error('[credit/customers POST]', err);
        res.status(500).json({ error: 'Failed to create customer.' });
    }
});

// ── POST /api/credit/record ───────────────────────────────────────────────────
// Record a credit sale against a customer.
// Called by the backend sale creation path when paymentMethod === 'CREDIT'.
router.post('/record', protect, async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const { saleId, customerId, amount } = req.body;

        if (!saleId || !customerId || !amount) {
            res.status(400).json({ error: 'saleId, customerId, and amount are required.' });
            return;
        }

        const creditSale = await prisma.$transaction(async (tx) => {
            // Create the credit record
            const cs = await tx.creditSale.create({
                data: {
                    tenantId,
                    customerId,
                    saleId,
                    amount: new Decimal(amount),
                    amountPaid: new Decimal(0),
                    balance: new Decimal(amount),
                    settled: false,
                },
            });

            // Update the customer's total owed
            await tx.customer.update({
                where: { id: customerId },
                data: { totalOwed: { increment: new Decimal(amount) } },
            });

            return cs;
        });

        res.json({ success: true, data: creditSale });
    } catch (err) {
        console.error('[credit/record]', err);
        res.status(500).json({ error: 'Failed to record credit sale.' });
    }
});

// ── POST /api/credit/settle ───────────────────────────────────────────────────
// Record a payment against an outstanding credit sale.
router.post('/settle', protect, checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const { creditSaleId, amountPaid } = req.body;

        if (!creditSaleId || !amountPaid) {
            res.status(400).json({ error: 'creditSaleId and amountPaid are required.' });
            return;
        }

        const result = await prisma.$transaction(async (tx) => {
            const creditSale = await tx.creditSale.findUnique({
                where: { id: creditSaleId },
            });

            if (!creditSale || creditSale.tenantId !== tenantId) {
                throw new Error('Credit sale not found.');
            }

            const paid = new Decimal(amountPaid);
            const newPaid = creditSale.amountPaid.plus(paid);
            const balance = creditSale.amount.minus(newPaid);
            const settled = balance.lessThanOrEqualTo(0);
            const remainingBalance = Decimal.max(creditSale.balance, new Decimal(0));
            const appliedPayment = Decimal.min(paid, remainingBalance);

            const updated = await tx.creditSale.update({
                where: { id: creditSaleId },
                data: {
                    amountPaid: newPaid,
                    balance: Decimal.max(balance, new Decimal(0)),
                    settled,
                    settledAt: settled ? new Date() : null,
                },
            });

            // Reduce the customer's total owed only by the amount that actually
            // reduces the outstanding balance.
            await tx.customer.update({
                where: { id: creditSale.customerId },
                data: { totalOwed: { decrement: appliedPayment } },
            });

            return updated;
        });

        res.json({ success: true, data: result });
    } catch (err: any) {
        console.error('[credit/settle]', err);
        res.status(500).json({ error: err.message || 'Failed to settle credit sale.' });
    }
});

// ── GET /api/credit/summary ───────────────────────────────────────────────────
// Total outstanding debt for this tenant — for the owner dashboard.
router.get('/summary', protect, async (req: AuthRequest, res) => {
    try {
        const tenantId = req.user!.tenantId;
        const result = await prisma.creditSale.aggregate({
            where: { tenantId, settled: false },
            _sum: { balance: true },
            _count: { id: true },
        });
        res.json({
            success: true,
            data: {
                totalOutstanding: result._sum.balance ?? 0,
                openCreditSales: result._count.id ?? 0,
            },
        });
    } catch (err) {
        console.error('[credit/summary]', err);
        res.status(500).json({ error: 'Failed to fetch credit summary.' });
    }
});

export default router;