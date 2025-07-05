import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { protect, AuthRequest } from '../middleware/auth.middleware';

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

// CORS configuration for production
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000', // Local backend
  'https://your-vercel-domain.vercel.app', // Replace with your actual Vercel domain
  'https://retailstack-pos.vercel.app', // Example Vercel domain
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-tenant-id']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Public Routes ---
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);

// --- Protected Routes ---
// All routes defined after this line require a valid JWT.
app.use('/api/superadmin', protect, superAdminRoutes);
app.use('/api/products', protect, productRoutes);
app.use('/api/sales', protect, saleRoutes);
// app.use('/api/tenants', tenantRoutes); // Protected by SUPER_ADMIN role
app.use('/api/users', protect, userRoutes);
app.use('/api/categories', protect, categoryRoutes);
app.use('/api/inventory', protect, inventoryRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);
// ... Add other protected routes (e.g., sales, dashboard) here

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});