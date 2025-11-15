"use strict";
//POST /api/payments/confirm — optional server-side confirm for certain flows
//POST /api/payments/refund — create refund (body: paymentId, amount, reason)
// POST /api/webhooks/stripe — webhook handler (verify signature)
// GET /api/payments/:id — fetch transaction + refund history
// GET /api/tenant/:id/balance — optional, for Connect account balances
