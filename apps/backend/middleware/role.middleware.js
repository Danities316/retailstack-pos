"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRole = void 0;
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const hasRole = roles.includes(req.user.role);
        if (!hasRole) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to perform this action.' });
            return;
        }
        console.log("Roles: ", roles, "User Role:", req.user.role);
        next();
    };
};
exports.checkRole = checkRole;
