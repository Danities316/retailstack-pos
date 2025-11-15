import { Router } from 'express'
import { StripeService } from '../services/stripePayment'
import { PrismaClient, UserRole } from '@prisma/client';
import { checkRole } from '../middleware/role.middleware';

const router = Router()
const prisma = new PrismaClient()

// All category management routes are protected and restricted
router.use(checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]));

// POST /api/payments/create-intent
router.post('/create-intent', async (req, res) => {
    try {
        const { amount, currency, tenantId, saleId, metadata } = req.body
        // Fetch tenant Stripe account if available
        const tenantAccount = await prisma.tenantPaymentAccount.findUnique({ where: { tenantId } })
        const intent = await StripeService.createPaymentIntent({
            amount,
            currency,
            tenantStripeAccountId: tenantAccount?.stripeAccountId,
            metadata: { ...metadata, saleId, tenantId }
        })
        // Persist Transaction in DB
        await prisma.transaction.create({
            data: {
                tenantId,
                saleId,
                provider: 'STRIPE',
                providerPaymentId: intent.id,
                amount,
                currency,
                status: 'PENDING',
                paymentMethod: 'CARD',
                metadata,
            }
        })
        res.json({ client_secret: intent.client_secret })
    } catch (err: any) {
        res.status(400).json({ error: err.message })
    }
})

// POST /api/payments/refund
router.post('/refund', async (req: any, res: any) => {
    try {
        const { transactionId, amount, reason } = req.body
        const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } })
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' })
        const refund = await StripeService.createRefund({
            paymentIntentId: transaction.providerPaymentId,
            amount,
            reason,
        })
        // Persist Refund in DB
        await prisma.refund.create({
            data: {
                transactionId,
                amount,
                providerRefundId: refund.id,
                reason,
                status: 'PENDING',
            }
        })
        res.json({ refundId: refund.id })
    } catch (err: any) {
        res.status(400).json({ error: err.message })
    }
})

// POST /api/webhooks/stripe
router.post('/webhooks/stripe', async (req, res) => {
    await StripeService.handleWebhook(req, res)
})

// GET /api/payments/:id
router.get('/:id', async (req: any, res: any) => {
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: req.params.id },
            include: { refunds: true }
        })
        if (!transaction) return res.status(404).json({ error: 'Transaction not found' })
        res.json(transaction)
    } catch (err: any) {
        res.status(400).json({ error: err.message })
    }
})

export default router