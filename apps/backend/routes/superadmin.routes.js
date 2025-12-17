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
const password_service_1 = require("../services/password.service");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();


// post /api/superadmin/tenants - create tenants
router.post('/tenants', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tenantName, phoneNumber, logoUrl, colorScheme, loyverseApiKey, ownerName, ownerEmail, ownerPassword, } = req.body;
    console.log("Creating tenant:", req.body);
    if (!tenantName || !phoneNumber || !ownerEmail || !ownerPassword) {
        res.status(400).json({
            error: 'Tenant Name, Tenant Phone Number, Owner Email, and Owner Password are required.'
        });
        return;
    }
    try {
        const hashedPassword = yield (0, password_service_1.hashPassword)(ownerPassword);
        const newTenant = yield prisma.tenant.create({
            data: {
                name: tenantName,
                phoneNumber,
                logoUrl,
                colorScheme,
                loyverseApiKey,
                users: {
                    create: {
                        email: ownerEmail,
                        password: hashedPassword,
                        name: ownerName,
                        phoneNumber: phoneNumber,
                        role: client_1.UserRole.OWNER,
                    }
                }
            },
            // Select the data you want to return
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                users: {
                    select: { id: true, email: true, role: true }
                }
            }
        });
        res.status(201).json({ message: 'Tenant created successfully', tenant: newTenant });
    }
    catch (error) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'A user with this email already exists.' });
            return;
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to create tenant.', message: error instanceof Error ? error.message : String(error) });
    }
}));
// Protect all routes in this file and ensure only SUPER_ADMIN can access them
router.use((0, role_middleware_1.checkRole)([client_1.UserRole.SUPER_ADMIN]));
// GET /api/superadmin/tenants/:id - Get a single tenant's details
router.get('/tenants/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tenant = yield prisma.tenant.findUnique({
        where: { id },
        include: { users: { select: { id: true, email: true, role: true } } },
    });
    if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
    }
    res.json(tenant);
}));
// PUT /api/superadmin/tenants/:id - Update a tenant
router.put('/tenants/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, logoUrl, colorScheme } = req.body;
    const updatedTenant = yield prisma.tenant.update({
        where: { id },
        data: { name, logoUrl, colorScheme },
    });
    res.json(updatedTenant);
}));
// GET /api/superadmin/tenants - List all tenants with their users
router.get('/tenants', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tenants = yield prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            phoneNumber: true,
            createdAt: true,
            users: {
                select: {
                    id: true,
                    email: true,
                    role: true,
                    phoneNumber: true,
                }
            }
        }
    });
    res.json(tenants);
}));
// DELETE /api/superadmin/tenants/:id - Delete a tenant by id
router.delete('/tenants/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tenant = yield prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
    }
    yield prisma.tenant.delete({ where: { id } });
    res.status(204).send();
}));
exports.default = router;
