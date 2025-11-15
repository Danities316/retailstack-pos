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
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Protect all routes and restrict to Owner/Manager
router.use((0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]));
// GET /api/inventory/logs - Get inventory history, with optional filtering by product
router.get('/logs', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tenantId = req.user.tenantId;
    const { productId } = req.query;
    // Build the filter object based on query parameters
    const whereClause = { tenantId: tenantId };
    if (productId && typeof productId === 'string') {
        whereClause.productId = productId;
    }
    const logs = yield prisma.inventoryLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
            product: { select: { productName: true } },
        },
    });
    res.json(logs);
}));
exports.default = router;
