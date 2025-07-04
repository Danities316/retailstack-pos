import { Router } from 'express';
import {Prisma, PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/products - List all products for the tenant
router.get('/', async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;

  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { productName: 'asc' },
  });

  res.json(products);
});

// GET /api/products/:id - Get a single product by its ID
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const product = await prisma.product.findUnique({
    where: { id, tenantId },
  });

  if (!product) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  res.json(product);
});


// === Write Operations (Restricted to Owner, Manager, SUPER_ADMIN) ===

// POST /api/products - Create a new product
router.post('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { 
    productName, 
    productImage, 
    productColor, 
    productDescription, 
    costPrice, 
    sellingPrice, 
    quantity, 
    stock, 
    categoryId 
  } = req.body;
  const tenantId = req.user!.tenantId;
  
  if (!productName || sellingPrice === undefined || costPrice === undefined) {
    res.status(400).json({ error: 'Product Name, Selling Price, and Cost Price are required.' });
    return;
  }

  try {
    const newProduct = await prisma.product.create({
      data: {
        productName,
        productImage,
        productColor,
        productDescription,
        costPrice,
        sellingPrice,
        quantity: quantity || 0,
        stock: stock || 0,
        tenantId: tenantId!,
        categoryId,
      },
    });
    res.status(201).json(newProduct);
  } catch (error: any) {
    // P2003 is the foreign key constraint error code
    if (error.code === 'P2003' && error.meta?.field_name === 'Product_categoryId_fkey (index)') {
       res.status(400).json({ error: 'Invalid categoryId. The specified category does not exist.' });
       return;
    }
    res.status(500).json({ error: 'Failed to create product.', message: error instanceof Error ? error.message : String(error) });
  }
});

// PUT /api/products/:id - Update an existing product
router.put('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { 
    productName, 
    productImage, 
    productColor, 
    productDescription, 
    costPrice, 
    sellingPrice, 
    quantity, 
    stock, 
    categoryId 
  } = req.body;
  const tenantId = req.user!.tenantId;

  try {
    const product = await prisma.product.update({
      where: { id, tenantId },
      data: { 
        productName, 
        productImage, 
        productColor, 
        productDescription, 
        costPrice, 
        sellingPrice, 
        quantity, 
        stock, 
        categoryId 
      },
    });
    res.json(product);
  } catch (error: any) {
     if (error.code === 'P2003' && error.meta?.field_name === 'Product_categoryId_fkey (index)') {
       res.status(400).json({ error: 'Invalid categoryId. The specified category does not exist.' });
       return;
    }
    res.status(404).json({ error: 'Product not found or you do not have permission to update it.' });
  }
});

// DELETE /api/products/:id - Delete a product
router.delete('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  try {
    await prisma.product.delete({
      where: { id, tenantId }, 
    });
    res.status(204).send(); 
  } catch (error) {
    res.status(404).json({ error: 'Product not found or you do not have permission to delete it.' });
  }
});

// PATCH /api/products/:id/stock - Manually adjust stock for a product
router.patch('/:id/stock', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { change, reason, notes } = req.body; // change is a number (+ or -), reason is a string
  const tenantId = req.user!.tenantId;

  if (typeof change !== 'number' || !reason) {
    res.status(400).json({ error: 'A numeric "change" value and a "reason" string are required.' });
    return;
  }

  try {
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // 1. Find the product to ensure it exists and get its current stock
      const product = await tx.product.findUnique({
        where: { id, tenantId },
      });

      if (!product) {
        // This will cause the transaction to rollback
        throw new Error('Product not found or you do not have permission.');
      }

      const newStockLevel = product.stock + change;

      // 2. Update the product's stock count
      const updated = await tx.product.update({
        where: { id },
        data: { stock: newStockLevel },
      });

      // 3. Create an immutable log for this manual change
      await tx.inventoryLog.create({
        data: {
          productId: id,
          tenantId: tenantId!,
          change,
          newStockLevel,
          reason, // e.g., "STOCK_IN", "STOCK_OUT", "DAMAGE", "INVENTORY_COUNT"
          notes,
        },
      });

      return updated;
    });

    res.json(updatedProduct);

  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
       res.status(404).json({ error: 'Product not found.' });
       return;
    }
    // Handle the custom error from inside the transaction
    if (error.message.includes('Product not found')) {
       res.status(404).json({ error: error.message });
       return;
    }
    res.status(500).json({ error: 'Failed to update stock.' });
  }
});


export default router;
