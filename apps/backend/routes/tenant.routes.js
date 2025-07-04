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
const password_service_1 = require("../services/password.service");
const role_middleware_1 = require("../middleware/role.middleware");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// This entire route is protected and requires SUPER_ADMIN role
router.use((0, role_middleware_1.checkRole)([client_1.UserRole.SUPER_ADMIN]));
// POST /api/tenants - Create a new tenant and its first owner
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tenantName, ownerEmail, ownerPassword, ownerName, phoneNumber } = req.body;
    if (!tenantName || !ownerEmail || !ownerPassword || !phoneNumber) {
        return res.status(400).json({ error: 'Tenant name, owner email, phoneNumber, and owner password are required.' });
    }
    try {
        const hashedPassword = yield (0, password_service_1.hashPassword)(ownerPassword);
        // Use a transaction to ensure both tenant and user are created or neither are.
        const newTenant = yield prisma.tenant.create({
            data: {
                name: tenantName,
                phoneNumber: phoneNumber,
                users: {
                    create: {
                        email: ownerEmail,
                        password: hashedPassword,
                        phoneNumber: phoneNumber,
                        name: ownerName,
                        role: client_1.UserRole.OWNER, // The first user is the Owner 
                    },
                },
            },
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                createdAt: true,
                users: {
                    select: { id: true, email: true, role: true, phoneNumber: true }
                }
            }
        });
        res.status(201).json({ message: 'Tenant created successfully', tenant: newTenant });
    }
    catch (error) {
        // Check for unique constraint violation (e.g., email already exists)
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A user with this email already exists.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to create tenant.' });
    }
}));
exports.default = router;
