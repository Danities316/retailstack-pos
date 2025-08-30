import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';

const router = Router();
const prisma = new PrismaClient();

// POST /api/sales - Create a new sale (Accessible to all roles)
router.post('/', async (req: AuthRequest, res: any) => {
  const { paymentMethod, items } = req.body;
  // `items` should be an array like: [{ productId: '...', quantity: 2 }, ...]
  const tenantId = req.user!.tenantId;
  console.log("See items: ", items)

  if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Payment method and a non-empty array of items are required.' });
    return;
  }

  try {
   
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Calculate the total amount based on current product prices
      let totalAmount = 0;
      const saleItemsData = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId, tenantId },
        });

        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found.`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Not enough stock for product "${product.productName}". Available: ${product.stock}, Requested: ${item.quantity}`);
        }

        const itemTotal = Number(product.sellingPrice) * Number(item.quantity);
        console.log("See itemsTotl: ", itemTotal)
        totalAmount += itemTotal;
        saleItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.sellingPrice, 
        });
      }

      // 2. Create the main Sale record
      const newSale = await tx.sale.create({
        data: {
          tenantId: tenantId!,
          totalAmount,
          paymentMethod,
          items: {
            create: saleItemsData,
          },
        },
      });

      // 3. Create the associated SaleItem records
      await tx.saleItem.createMany({
        data: saleItemsData.map(item => ({
          ...item,
          saleId: newSale.id,
        })),
      });

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const newStockLevel = product!.stock - item.quantity;

        // 1. Update the product's stock count
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStockLevel },
        });

        // 2. Create an immutable log of this change
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            saleId: newSale.id, 
            tenantId: tenantId!,
            change: -item.quantity, 
            newStockLevel: newStockLevel,
            reason: 'SALE',
          },
        });
      }

      //TODO: add logic here to decrease product stock levels

      return newSale;
    });

    res.status(201).json(sale);

  } catch (error) {
    console.error('Sale creation failed:', error);
    res.status(500).json({ error: 'Failed to create sale.', details: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/sales - List all sales for the tenant - Restricted to Owner/Manager
router.get('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;

  const sales = await prisma.sale.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { // Include the items for each sale
        include: {
          product: { select: { productName: true } },
        },
      },
    },
  });

  res.json(sales);
});

// GET /api/sales/:id - Get a single sale's details (Restricted to Owner/Manager)
router.get('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const sale = await prisma.sale.findUnique({
    where: { id, tenantId },
    include: {
      items: { include: { product: { select: { productName: true } } } },
    },
  });

  if (!sale) {
    res.status(404).json({ error: 'Sale not found.' });
    return;
  }
  res.json(sale);
});

export default router;