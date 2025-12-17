import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {})

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
    }): Promise<Stripe.PaymentIntent> {
        try {
            if (!amount || amount <= 0) {
                throw new Error('Invalid amount; must be a positive integer representing the smallest currency unit.')
            }
            if (!currency || typeof currency !== 'string') {
                throw new Error('Invalid currency.')
            }

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
        } catch (err: any) {
            console.error('StripeService.createPaymentIntent error:', err)
            throw err
        }
    }

    // Create Refund
    static async createRefund({
        paymentIntentId,
        amount,
        reason,
    }: {
        paymentIntentId: string
        amount: number
        reason?: Stripe.RefundCreateParams.Reason
    }): Promise<Stripe.Refund> {
        try {
            if (!paymentIntentId || typeof paymentIntentId !== 'string') {
                throw new Error('paymentIntentId is required and must be a string.')
            }
            if (!amount || amount <= 0) {
                throw new Error('Invalid amount for refund; must be a positive integer representing the smallest currency unit.')
            }

            const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount,
                reason,
            })
            return refund
        } catch (err: any) {
            console.error('StripeService.createRefund error:', err)
            throw err
        }
    }

    // Webhook handler (verify signature, idempotency, update DB)
    static async handleWebhook(req: any, res: any) {
        const sig = (req.headers && (req.headers['stripe-signature'] || req.headers['Stripe-Signature'])) as string | undefined

        if (!sig) {
            console.error('Missing stripe-signature header')
            return res.status(400).send('Missing stripe-signature header')
        }
        if (!req.rawBody) {
            console.error('Missing rawBody on request; ensure raw body middleware is set up for webhook endpoint')
            return res.status(400).send('Missing rawBody on request')
        }

        let event: Stripe.Event
        try {
            event = stripe.webhooks.constructEvent(
                req.rawBody,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET!
            )
        } catch (err: any) {
            console.error('Webhook signature verification failed:', err)
            return res.status(400).send(`Webhook Error: ${err.message}`)
        }

        try {
            // Idempotency: check event.id in DB before processing (example placeholder)
            // const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } })
            // if (existing) return res.json({ received: true })
            // await prisma.webhookEvent.create({ data: { id: event.id, type: event.type, processed: false } })

            switch (event.type) {
                case 'payment_intent.succeeded': {
                    const paymentIntent = event.data.object as Stripe.PaymentIntent
                    // Update Transaction status in DB using paymentIntent.id, amount, metadata, etc.
                    // await prisma.transaction.update({ where: { stripeId: paymentIntent.id }, data: { status: 'succeeded' } })
                    break
                }
                case 'payment_intent.payment_failed': {
                    const paymentIntent = event.data.object as Stripe.PaymentIntent
                    // await prisma.transaction.update({ where: { stripeId: paymentIntent.id }, data: { status: 'failed' } })
                    break
                }
                case 'charge.refunded': {
                    const charge = event.data.object as Stripe.Charge
                    // await prisma.refund.update({ where: { stripeChargeId: charge.id }, data: { status: 'refunded' } })
                    break
                }
                // Add more event types as needed
                default:
                    console.warn(`Unhandled event type ${event.type}`)
            }

            // Optionally mark webhook event processed in DB
            // await prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true } })
        } catch (err: any) {
            console.error('Error processing webhook event:', err)
            return res.status(500).send('Internal Server Error')
        }

        res.json({ received: true })
    }
}