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
// All category management routes are protected and restricted
router.use((0, role_middleware_1.checkRole)([client_1.UserRole.OWNER, client_1.UserRole.MANAGER, client_1.UserRole.SUPER_ADMIN]));
// POST /api/categories - Create a new category
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { categoryName, parentId } = req.body;
    const tenantId = req.user.tenantId;
    if (!categoryName) {
        res.status(400).json({ error: 'Category name is required.' });
        return;
    }
    try {
        const newCategory = yield prisma.category.create({
            data: { categoryName, parentId, tenantId: tenantId },
        });
        res.status(201).json(newCategory);
    }
    catch (error) {
        console.log('Failed to create category.', error.message);
        res.status(500).json({ error: 'Failed to create category.', message: error instanceof Error ? error.message : String(error) });
    }
}));
// GET /api/categories - List all categories for a tenant as a nested tree
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tenantId = req.user.tenantId;
    const categories = yield prisma.category.findMany({ where: { tenantId } });
    // Best Practice: Build a tree structure for easy frontend rendering
    const categoryMap = new Map(categories.map((c) => [c.id, Object.assign(Object.assign({}, c), { children: [] })]));
    const tree = [];
    for (const category of categoryMap.values()) {
        if (category.parentId && categoryMap.has(category.parentId)) {
            categoryMap.get(category.parentId).children.push(category);
        }
        else {
            tree.push(category);
        }
    }
    res.json(tree);
}));
// GET /api/categories/:id - Get a single category by ID
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    try {
        const category = yield prisma.category.findFirst({
            where: { id, tenantId },
        });
        if (!category) {
            res.status(404).json({ error: 'Category not found.' });
            return;
        }
        res.json(category);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch category.' });
    }
}));
// PUT /api/categories/:id - Update a category
router.put('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { categoryName, parentId } = req.body;
    const tenantId = req.user.tenantId;
    try {
        const updatedCategory = yield prisma.category.update({
            where: { id, tenantId },
            data: { categoryName, parentId },
        });
        res.json(updatedCategory);
    }
    catch (error) {
        res.status(404).json({ error: 'Category not found or you do not have permission to update it.' });
    }
}));
// DELETE /api/categories/:id - Delete a category
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    try {
        // Best Practice: Prevent deletion if the category has products or sub-categories
        const hasProducts = yield prisma.product.count({ where: { categoryId: id, tenantId } });
        const hasChildren = yield prisma.category.count({ where: { parentId: id, tenantId } });
        if (hasProducts > 0 || hasChildren > 0) {
            res.status(400).json({ error: 'Cannot delete category. Reassign its products and sub-categories first.' });
            return;
        }
        yield prisma.category.delete({ where: { id, tenantId } });
        res.status(204).send();
    }
    catch (error) {
        res.status(404).json({ error: 'Category not found or you do not have permission to delete it.' });
    }
}));
exports.default = router;
