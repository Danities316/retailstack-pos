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
// GET /api/products - List all products for the tenant
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tenantId = req.user.tenantId;
    const products = yield prisma.product.findMany({
        where: { tenantId },
        orderBy: { productName: 'asc' },
    });
    res.json(products);
}));
// GET /api/products/:id - Get a single product by its ID
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const product = yield prisma.product.findUnique({
        where: { id, tenantId },
    });
    if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
    }
    res.json(product);
}));
// === Write Operations (Restricted to Owner, Manager, SUPER_ADMIN) ===
// POST /api/products - Create a new product
router.post('/', (0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { productName, productImage, productColor, productDescription, costPrice, sellingPrice, quantity, stock, categoryId } = req.body;
    const tenantId = req.user.tenantId;
    if (!productName || sellingPrice === undefined || costPrice === undefined) {
        res.status(400).json({ error: 'Product Name, Selling Price, and Cost Price are required.' });
        return;
    }
    try {
        const newProduct = yield prisma.product.create({
            data: {
                productName,
                productImage,
                productColor,
                productDescription,
                costPrice,
                sellingPrice,
                quantity: quantity || 0,
                stock: stock || 0,
                tenantId: tenantId,
                categoryId,
            },
        });
        res.status(201).json(newProduct);
    }
    catch (error) {
        if (error.code === 'P2003' && ((_a = error.meta) === null || _a === void 0 ? void 0 : _a.field_name) === 'Product_categoryId_fkey (index)') {
            res.status(400).json({ error: 'Invalid categoryId. The specified category does not exist.' });
            return;
        }
        res.status(500).json({ error: 'Failed to create product.', message: error instanceof Error ? error.message : String(error) });
    }
}));
// PUT /api/products/:id - Update an existing product
router.put('/:id', (0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { id } = req.params;
    const { productName, productImage, productColor, productDescription, costPrice, sellingPrice, quantity, stock, updatedAt, categoryId } = req.body;
    const tenantId = req.user.tenantId;
    try {
        const existing = yield prisma.product.findUnique({ where: { id } });
        if (!existing || new Date(updatedAt) > existing.updatedAt) {
            const updated = yield prisma.product.update({
                where: { id, tenantId },
                data: {
                    productName,
                    productImage,
                    productColor,
                    productDescription,
                    costPrice,
                    sellingPrice,
                    quantity,
                    stock,
                    categoryId
                },
            });
            res.json(updated);
        }
    }
    catch (error) {
        if (error.code === 'P2003' && ((_a = error.meta) === null || _a === void 0 ? void 0 : _a.field_name) === 'Product_categoryId_fkey (index)') {
            res.status(400).json({ error: 'Invalid categoryId. The specified category does not exist.' });
            return;
        }
        res.status(404).json({ error: 'Product not found or you do not have permission to update it.' });
    }
}));
// DELETE /api/products/:id - Delete a product
router.delete('/:id', (0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    try {
        yield prisma.product.delete({
            where: { id, tenantId },
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(404).json({ error: 'Product not found or you do not have permission to delete it.' });
    }
}));
// PATCH /api/products/:id/stock - Manually adjust stock for a product
router.patch('/:id/stock', (0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { change, reason, notes } = req.body; // change is a number (+ or -), reason is a string
    const tenantId = req.user.tenantId;
    if (typeof change !== 'number' || !reason) {
        res.status(400).json({ error: 'A numeric "change" value and a "reason" string are required.' });
        return;
    }
    try {
        const updatedProduct = yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Find the product to ensure it exists and get its current stock
            const product = yield tx.product.findUnique({
                where: { id, tenantId },
            });
            if (!product) {
                // This will cause the transaction to rollback
                throw new Error('Product not found or you do not have permission.');
            }
            const newStockLevel = product.stock + change;
            // 2. Update the product's stock count
            const updated = yield tx.product.update({
                where: { id },
                data: { stock: newStockLevel },
            });
            // 3. Create an immutable log for this manual change
            yield tx.inventoryLog.create({
                data: {
                    productId: id,
                    tenantId: tenantId,
                    change,
                    newStockLevel,
                    reason, // e.g., "STOCK_IN", "STOCK_OUT", "DAMAGE", "INVENTORY_COUNT"
                    notes,
                },
            });
            return updated;
        }));
        res.json(updatedProduct);
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            res.status(404).json({ error: 'Product not found.' });
            return;
        }
        // Handle the custom error from inside the transaction
        if (error.message.includes('Product not found')) {
            res.status(404).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to update stock.' });
    }
}));
exports.default = router;
