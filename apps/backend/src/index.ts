import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
<<<<<<< HEAD
import { protect, AuthRequest } from '../middleware/auth.middleware';
=======
import { protect } from '../middleware/auth.middleware';
>>>>>>> f3fdb7e (Initial commit)

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

<<<<<<< HEAD
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
=======
app.use(cors());
>>>>>>> f3fdb7e (Initial commit)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Public Routes ---
<<<<<<< HEAD
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});
=======
app.get('/api/health', (req: Request, res: Response) => res.json({ status: 'ok' }));
>>>>>>> f3fdb7e (Initial commit)
app.use('/api/auth', authRoutes);

// --- Protected Routes ---
// All routes defined after this line require a valid JWT.
<<<<<<< HEAD
app.use('/api/superadmin', protect, superAdminRoutes);
app.use('/api/products', protect, productRoutes);
app.use('/api/sales', protect, saleRoutes);
// app.use('/api/tenants', tenantRoutes); // Protected by SUPER_ADMIN role
app.use('/api/users', protect, userRoutes);
app.use('/api/categories', protect, categoryRoutes);
app.use('/api/inventory', protect, inventoryRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);
=======
app.use('/api/superadmin', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), superAdminRoutes);
app.use('/api/products', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), productRoutes);
app.use('/api/sales', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), saleRoutes);
// app.use('/api/tenants', tenantRoutes); // Protected by SUPER_ADMIN role
app.use('/api/users', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), userRoutes);
app.use('/api/categories', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), categoryRoutes);
app.use('/api/inventory', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), inventoryRoutes);
app.use('/api/dashboard', (req: Request, res: Response, next: NextFunction) => protect(req, res, next), dashboardRoutes);
>>>>>>> f3fdb7e (Initial commit)
// ... Add other protected routes (e.g., sales, dashboard) here

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});