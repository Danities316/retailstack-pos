import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-09-30.clover' })

export class StripeService {
    // Create PaymentIntent (supports Stripe Connect)
    static async createPaymentIntent({
        amount,
        currency,
        tenantStripeAccountId,
        metadata,
    }: {
        amount: number
        currency: string
        tenantStripeAccountId?: string
        metadata?: Record<string, any>
    }) {
        const params: Stripe.PaymentIntentCreateParams = {
            amount,
            currency,
            metadata,
        }
        if (tenantStripeAccountId) {
            params.transfer_data = { destination: tenantStripeAccountId }
        }
        const intent = await stripe.paymentIntents.create(params)
        return intent
    }

    // Create Refund
    static async createRefund({
        paymentIntentId,
        amount,
        reason,
    }: {
        paymentIntentId: string
        amount: number
        reason?: string
    }) {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount,
            reason,
        })
        return refund
    }

    // Webhook handler (verify signature, idempotency, update DB)
    static async handleWebhook(req: any, res: any) {
        const sig = req.headers['stripe-signature']
        let event: Stripe.Event

        try {
            event = stripe.webhooks.constructEvent(
                req.rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET!
            )
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`)
        }

        // Idempotency: check event.id in DB before processing

        switch (event.type) {
            case 'payment_intent.succeeded':
                // Update Transaction status in DB
                // Push real-time update via Socket.IO if needed
                break
            case 'payment_intent.payment_failed':
                // Update Transaction status in DB
                break
            case 'charge.refunded':
                // Update Refund status in DB
                break
            // Add more event types as needed
        }

        res.json({ received: true })
    }
}