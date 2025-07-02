import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { protect } from '../middleware/auth.middleware';

// Route Imports
import superAdminRoutes from '../routes/superadmin.routes';
import authRoutes from '../routes/auth.routes';
// import tenantRoutes from '../routes/tenant.routes';
import userRoutes from '../routes/user.routes';
import productRoutes from '../routes/product.routes';
import saleRoutes from '../routes/sale.routes';
import categoryRoutes from '../routes/category.routes';
import inventoryRoutes from '../routes/inventory.routes';
import dashboardRoutes from '../routes/dashboard.routes';


dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Public Routes ---
app.get('/api/health', (req: Request, res: Response) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);

// --- Protected Routes ---
// All routes defined after this line require a valid JWT.
app.use('/api/superadmin', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), superAdminRoutes);
app.use('/api/products', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), productRoutes);
app.use('/api/sales', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), saleRoutes);
// app.use('/api/tenants', tenantRoutes); // Protected by SUPER_ADMIN role
app.use('/api/users', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), userRoutes);
app.use('/api/categories', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), categoryRoutes);
app.use('/api/inventory', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), inventoryRoutes);
app.use('/api/dashboard', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), dashboardRoutes);
// ... Add other protected routes (e.g., sales, dashboard) here

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});