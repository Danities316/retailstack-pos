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
// POST /api/sales - Create a new sale (Accessible to all roles)
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { paymentMethod, items } = req.body;
    // `items` should be an array like: [{ productId: '...', quantity: 2 }, ...]
    const tenantId = req.user.tenantId;
    // console.log("See items: ", items)
    if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Payment method and a non-empty array of items are required.' });
        return;
    }
    try {
        const sale = yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Calculate the total amount based on current product prices
            let totalAmount = 0;
            const saleItemsData = [];
            for (const item of items) {
                const product = yield tx.product.findUnique({
                    where: { id: item.productId, tenantId },
                });
                if (!product) {
                    throw new Error(`Product with ID ${item.productId} not found.`);
                }
                if (product.stock < item.quantity) {
                    throw new Error(`Not enough stock for product "${product.productName}". Available: ${product.stock}, Requested: ${item.quantity}`);
                }
                const itemTotal = Number(product.sellingPrice) * Number(item.quantity);
                console.log("See itemsTotl: ", itemTotal);
                totalAmount += itemTotal;
                saleItemsData.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: product.sellingPrice,
                    updatedAt: new Date()
                });
            }
            // 2. Create the main Sale record
            const newSale = yield tx.sale.create({
                data: {
                    tenantId: tenantId,
                    totalAmount,
                    paymentMethod,
                    updatedAt: new Date(),
                    items: {
                        create: saleItemsData,
                    },
                },
            });
            // 3. Create the associated SaleItem records
            yield tx.saleItem.createMany({
                data: saleItemsData.map(item => (Object.assign(Object.assign({}, item), { saleId: newSale.id }))),
            });
            for (const item of items) {
                const product = yield tx.product.findUnique({ where: { id: item.productId } });
                const newStockLevel = product.stock - item.quantity;
                // 1. Update the product's stock count
                yield tx.product.update({
                    where: { id: item.productId },
                    data: { stock: newStockLevel },
                });
                // 2. Create an immutable log of this change
                yield tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        saleId: newSale.id,
                        tenantId: tenantId,
                        change: -item.quantity,
                        newStockLevel: newStockLevel,
                        reason: 'SALE',
                    },
                });
            }
            //TODO: add logic here to decrease product stock levels
            return newSale;
        }));
        res.status(201).json(sale);
    }
    catch (error) {
        console.error('Sale creation failed:', error);
        res.status(500).json({ error: 'Failed to create sale.', details: error instanceof Error ? error.message : String(error) });
    }
}));
// GET /api/sales - List all sales for the tenant - Restricted to Owner/Manager
router.get('/', (0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tenantId = req.user.tenantId;
    const sales = yield prisma.sale.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
            items: {
                include: {
                    product: { select: { productName: true } },
                },
            },
        },
    });
    res.json(sales);
}));
// GET /api/sales/:id - Get a single sale's details (Restricted to Owner/Manager)
router.get('/:id', (0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const sale = yield prisma.sale.findUnique({
        where: { id, tenantId },
        include: {
            items: { include: { product: { select: { productName: true } } } },
        },
    });
    if (!sale) {
        res.status(404).json({ error: 'Sale not found.' });
        return;
    }
    res.json(sale);
}));
router.put('/:id', (0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { items, updatedAt, paymentMethod } = req.body;
    const tenantId = req.user.tenantId;
    try {
        const existingSale = yield prisma.sale.findUnique({
            where: { id, tenantId },
            include: { items: true },
        });
        if (!existingSale) {
            res.status(404).json({ error: 'Sale not found.' });
            return;
        }
        // If client update is newer, apply it
        if (new Date(updatedAt) > existingSale.updatedAt) {
            const updatedSale = yield prisma.sale.update({
                where: { id, tenantId },
                data: {
                    items: {
                        deleteMany: {},
                        create: items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price,
                        })),
                    },
                    paymentMethod,
                },
            });
            res.json(updatedSale);
            return;
        }
        else {
            // Server has newer data, ignore client update
            res.status(409).json({ message: 'Conflict: server has newer data', serverData: existingSale });
            return;
        }
    }
    catch (error) {
        console.error('Sale update failed:', error);
        res.status(500).json({ error: 'Failed to update sale.', details: error instanceof Error ? error.message : String(error) });
    }
}));
router.post('/sync', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Example sync endpoint: return all sales for the tenant (can be adapted)
    try {
        const tenantId = req.user.tenantId;
        const sales = yield prisma.sale.findMany({ where: { tenantId } });
        res.status(200).json({ message: 'Sync successful', sales });
    }
    catch (error) {
        console.error('Sync failed:', error);
        res.status(500).json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) });
    }
}));
exports.default = router;
