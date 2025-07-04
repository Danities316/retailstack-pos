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
const express_1 = require("express");
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const password_service_1 = require("../services/password.service");
const crypto_1 = __importDefault(require("crypto"));
const password_service_2 = require("../services/password.service");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// POST /api/auth/login
router.post('/login', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    const user = yield prisma.user.findUnique({ where: { email } });
    if (!user || !(yield (0, password_service_1.comparePassword)(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }
    // Ensure the JWT_SECRET is loaded
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET not found in environment variables.');
        return res.status(500).json({ error: 'Internal server error: JWT secret is not configured.' });
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, tenantId: user.tenantId, role: user.role }, jwtSecret, { expiresIn: '1d' });
    res.json({
        message: 'Login successful',
        token,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId
        }
    });
}));
// POST /api/auth/setup-account - This is a public route
router.post('/setup-account', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: 'Token and password are required.' });
    }
    // Hash the token provided by the user to find it in the database
    const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
    const user = yield prisma.user.findUnique({
        where: { setupToken: hashedToken },
    });
    if (!user || !user.setupTokenExpires || user.setupTokenExpires < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired setup token.' });
    }
    const newHashedPassword = yield (0, password_service_2.hashPassword)(password);
    // Update user with new password and clear the token fields
    yield prisma.user.update({
        where: { id: user.id },
        data: {
            password: newHashedPassword,
            setupToken: null,
            setupTokenExpires: null,
        },
    });
    res.json({ message: 'Account setup successful. You can now log in.' });
}));
exports.default = router;
