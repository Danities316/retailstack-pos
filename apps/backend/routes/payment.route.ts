import { Router } from 'express'
import { StripeService } from '../services/stripePayment'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

//POST /api/payments/confirm — optional server-side confirm for certain flows

//POST /api/payments/refund — create refund (body: paymentId, amount, reason)

// POST /api/webhooks/stripe — webhook handler (verify signature)

// GET /api/payments/:id — fetch transaction + refund history

// GET /api/tenant/:id/balance — optional, for Connect account balances



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
router.post('/refund', async (req, res) => {
    try {
        const { transactionId, amount, reason } = req.body
        const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } })
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' })
            return
        }
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
    try {
        // TODO: verify Stripe signature and handle events accordingly.
        // For now acknowledge receipt.
        res.status(200).send('ok')
    } catch (err: any) {
        res.status(400).json({ error: err.message })
    }
})

// GET /api/payments/:id
router.get('/:id', async (req, res) => {
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: req.params.id },
            include: { refunds: true }
        })
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' })
            return
        }
        res.json(transaction)
    } catch (err: any) {
        res.status(400).json({ error: err.message })
    }
})

export default router