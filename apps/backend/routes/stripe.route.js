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
const stripePayment_1 = require("../services/stripePayment");
const client_1 = require("@prisma/client");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// All category management routes are protected and restricted
router.use((0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]));
// POST /api/payments/create-intent
router.post('/create-intent', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { amount, currency, tenantId, saleId, metadata } = req.body;
        // Fetch tenant Stripe account if available
        const tenantAccount = yield prisma.tenantPaymentAccount.findUnique({ where: { tenantId } });
        const intent = yield stripePayment_1.StripeService.createPaymentIntent({
            amount,
            currency,
            tenantStripeAccountId: tenantAccount === null || tenantAccount === void 0 ? void 0 : tenantAccount.stripeAccountId,
            metadata: Object.assign(Object.assign({}, metadata), { saleId, tenantId })
        });
        // Persist Transaction in DB
        yield prisma.transaction.create({
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
        });
        res.json({ client_secret: intent.client_secret });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}));
// POST /api/payments/refund
router.post('/refund', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { transactionId, amount, reason } = req.body;
        const transaction = yield prisma.transaction.findUnique({ where: { id: transactionId } });
        if (!transaction)
            return res.status(404).json({ error: 'Transaction not found' });
        const refund = yield stripePayment_1.StripeService.createRefund({
            paymentIntentId: transaction.providerPaymentId,
            amount,
            reason,
        });
        // Persist Refund in DB
        yield prisma.refund.create({
            data: {
                transactionId,
                amount,
                providerRefundId: refund.id,
                reason,
                status: 'PENDING',
            }
        });
        res.json({ refundId: refund.id });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}));
// POST /api/webhooks/stripe
router.post('/webhooks/stripe', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield stripePayment_1.StripeService.handleWebhook(req, res);
}));
// GET /api/payments/:id
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const transaction = yield prisma.transaction.findUnique({
            where: { id: req.params.id },
            include: { refunds: true }
        });
        if (!transaction)
            return res.status(404).json({ error: 'Transaction not found' });
        res.json(transaction);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}));
exports.default = router;
