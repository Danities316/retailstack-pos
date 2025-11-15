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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {});
class StripeService {
    // Create PaymentIntent (supports Stripe Connect)
    static createPaymentIntent(_a) {
        return __awaiter(this, arguments, void 0, function* ({ amount, currency, tenantStripeAccountId, metadata, }) {
            const params = {
                amount,
                currency,
                metadata,
            };
            if (tenantStripeAccountId) {
                params.transfer_data = { destination: tenantStripeAccountId };
            }
            const intent = yield stripe.paymentIntents.create(params);
            return intent;
        });
    }
    // Create Refund
    static createRefund(_a) {
        return __awaiter(this, arguments, void 0, function* ({ paymentIntentId, amount, reason, }) {
            const refund = yield stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount,
                reason,
            });
            return refund;
        });
    }
    // Webhook handler (verify signature, idempotency, update DB)
    static handleWebhook(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const sig = req.headers['stripe-signature'];
            let event;
            try {
                event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
            }
            catch (err) {
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }
            // Idempotency: check event.id in DB before processing
            switch (event.type) {
                case 'payment_intent.succeeded':
                    // Update Transaction status in DB
                    // Push real-time update via Socket.IO if needed
                    break;
                case 'payment_intent.payment_failed':
                    // Update Transaction status in DB
                    break;
                case 'charge.refunded':
                    // Update Refund status in DB
                    break;
                // Add more event types as needed
            }
            res.json({ received: true });
        });
    }
}
exports.StripeService = StripeService;
