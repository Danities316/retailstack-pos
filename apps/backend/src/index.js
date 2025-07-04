"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_middleware_1 = require("../middleware/auth.middleware");
// Route Imports
const superadmin_routes_1 = __importDefault(require("../routes/superadmin.routes"));
const auth_routes_1 = __importDefault(require("../routes/auth.routes"));
// import tenantRoutes from '../routes/tenant.routes';
const user_routes_1 = __importDefault(require("../routes/user.routes"));
const product_routes_1 = __importDefault(require("../routes/product.routes"));
const sale_routes_1 = __importDefault(require("../routes/sale.routes"));
const category_routes_1 = __importDefault(require("../routes/category.routes"));
const inventory_routes_1 = __importDefault(require("../routes/inventory.routes"));
const dashboard_routes_1 = __importDefault(require("../routes/dashboard.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// --- Public Routes ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
app.use('/api/auth', auth_routes_1.default);
// --- Protected Routes ---
// All routes defined after this line require a valid JWT.
app.use('/api/superadmin', auth_middleware_1.protect, superadmin_routes_1.default);
app.use('/api/products', auth_middleware_1.protect, product_routes_1.default);
app.use('/api/sales', auth_middleware_1.protect, sale_routes_1.default);
// app.use('/api/tenants', tenantRoutes); // Protected by SUPER_ADMIN role
app.use('/api/users', auth_middleware_1.protect, user_routes_1.default);
app.use('/api/categories', auth_middleware_1.protect, category_routes_1.default);
app.use('/api/inventory', auth_middleware_1.protect, inventory_routes_1.default);
app.use('/api/dashboard', auth_middleware_1.protect, dashboard_routes_1.default);
// ... Add other protected routes (e.g., sales, dashboard) here
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
