import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { protect, AuthRequest } from '../middleware/auth.middleware';

import superAdminRoutes from '../routes/superadmin.routes';
import authRoutes from '../routes/auth.routes';
import tenantRoutes from '../routes/tenant.routes';
import userRoutes from '../routes/user.routes';
import productRoutes from '../routes/product.routes';
import saleRoutes from '../routes/sale.routes';
import categoryRoutes from '../routes/category.routes';
import inventoryRoutes from '../routes/inventory.routes';
import dashboardRoutes from '../routes/dashboard.routes';
import managerDashboardRoutes from '../routes/manager.routes';
import settingsRoutes from '../routes/setting.routes';
import reportsRoutes from '../routes/reports.routes';
import shiftRoutes from '../routes/shift.routes';
import syncRoutes from '../routes/sync.routes';
import globalCatalogRoutes from '../routes/global-catalog.routes';
import creditRoutes from '../routes/credit.routes';


dotenv.config();
const app = express();

// CORS configuration for production and local development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://retailstack-pos.vercel.app',
];

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-Id', 'x-tenant-id', 'X-Idempotency-Key', 'Accept'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// --- Public Routes ---
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/auth', authRoutes);
// --- Protected Routes ---
// All routes defined after this line require a valid JWT.
app.use('/api/tenant', protect, tenantRoutes);
app.use('/api/products', protect, productRoutes);
app.use('/api/sales', protect, saleRoutes);
app.use('/api/shifts', protect, shiftRoutes);
app.use('/api/users', protect, userRoutes);
app.use('/api/categories', protect, categoryRoutes);
app.use('/api/inventory', protect, inventoryRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);
app.use('/api/dashboard/manager', protect, managerDashboardRoutes);
app.use('/api/settings', protect, settingsRoutes);
app.use('/api/reports', protect, reportsRoutes);
app.use('/api/sync', protect, syncRoutes);
app.use('/api/credit', protect, creditRoutes);
app.use('/api/global-catalog', protect, globalCatalogRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port:${PORT}`);
});