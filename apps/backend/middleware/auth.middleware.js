"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const protect = (req, res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer || !bearer.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided.' });
        return;
    }
    const [, token] = bearer.split(' ');
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Invalid token format.' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized: Invalid token.' });
        return;
    }
};
exports.protect = protect;
