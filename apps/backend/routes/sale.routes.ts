import { Router, Response } from 'express';
import { PrismaClient, UserRole, Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import { any } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// POST /api/sales - Create a new sale (Accessible to all roles)
// sale.routes.ts - REPLACING the existing POST /api/sales route

// POST /api/sales - Create a new sale (Accessible to all authenticated roles)
router.post('/', async (req: AuthRequest, res: any) => {

  const { paymentMethod, items } = req.body;

  const tenantId = req.user!.tenantId; // Tenant ID from Auth Token
  const cashierId = req.user!.userId; // Cashier ID from Auth Token
  const cashierRole = req.user!.role; // Cashier Role from Auth Token

  if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Payment method and a non-empty array of items are required.' });
    return;
  }

  let activeShift = null;

  const idempotencyKeyHeader = req.headers['idempotency-key'] as string | undefined;

  if (cashierRole === 'CASHIER') {
    // Only CASHIERs are REQUIRED to have an active shift
    activeShift = await prisma.shift.findFirst({
      where: { cashierId, tenantId, endTime: null },
      select: { id: true, startFloat: true }
    });

    if (!activeShift) {
      // FORBIDDEN SALE: Cashier is not clocked in
      return res.status(403).json({ error: 'You must clock in to start a shift before making sales.' });
    }
  } else {
    // MANAGER and OWNER roles can make sales without an explicit shift.
    // We still check if they happen to be clocked in, just in case.
    activeShift = await prisma.shift.findFirst({
      where: { cashierId, tenantId, endTime: null },
      select: { id: true, startFloat: true }
    });
  }

  try {
    // If no idempotency key provided, behave as before
    if (!idempotencyKeyHeader) {
      const sale = await prisma.$transaction(async (tx) => {
        let totalAmount = 0;
        const saleItemsData: any[] = [];

        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product || product.tenantId !== tenantId) {
            throw new Error(`Product not found: ${item.productId}`);
          }

          if (product.stock < item.quantity) {
            throw new Error(`Stockout: Only ${product.stock} units of ${product.productName} available.`);
          }

          const itemPrice = product.sellingPrice;
          totalAmount = Number(totalAmount) + (Number(itemPrice) * Number(item.quantity));

          saleItemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            price: itemPrice,
          });

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }

        const newSale = await tx.sale.create({
          data: {
            tenantId,
            userId: cashierId,
            shiftId: activeShift ? activeShift.id : null,
            totalAmount,
            paymentMethod,
            items: { createMany: { data: saleItemsData } },
          },
          include: { items: true },
        });

        return newSale;
      });

      return res.status(201).json(sale);
    }

    // Idempotency flow: try to create an idempotency record first to claim the key
    const key = idempotencyKeyHeader;

    const result = await prisma.$transaction(async (tx) => {
      try {
        await tx.idempotencyKey.create({
          data: {
            key,
            tenantId,
            userId: cashierId,
            status: 'IN_PROGRESS',
          },
        });
      } catch (err: any) {
        // If key already exists, return existing sale if available
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await tx.idempotencyKey.findUnique({ where: { key } });
          if (existing && existing.saleId) {
            const existingSale = await tx.sale.findUnique({ where: { id: existing.saleId } });
            return { alreadyProcessed: true, sale: existingSale };
          }
          // Key exists but not yet linked to a sale -> indicate in-progress
          return { alreadyProcessed: true, sale: null };
        }
        throw err;
      }

      // Proceed to create sale while owning the idempotency key
      let totalAmount = 0;
      const saleItemsData: any[] = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.tenantId !== tenantId) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Stockout: Only ${product.stock} units of ${product.productName} available.`);
        }

        const itemPrice = product.sellingPrice;
        totalAmount = Number(totalAmount) + (Number(itemPrice) * Number(item.quantity));

        saleItemsData.push({ productId: item.productId, quantity: item.quantity, price: itemPrice });

        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      }

      const newSale = await tx.sale.create({
        data: {
          tenantId,
          userId: cashierId,
          shiftId: activeShift ? activeShift.id : null,
          totalAmount,
          paymentMethod,
          items: { createMany: { data: saleItemsData } },
        },
        include: { items: true },
      });

      // Link idempotency record to the created sale and store serialized response
      await tx.idempotencyKey.update({
        where: { key },
        data: {
          saleId: newSale.id,
          status: 'COMPLETED',
          response: newSale as any,
        },
      });

      return { alreadyProcessed: false, sale: newSale };
    });

    if (result.alreadyProcessed) {
      if (result.sale) {
        return res.status(200).json(result.sale);
      }
      return res.status(202).json({ message: 'Request is already being processed' });
    }

    return res.status(201).json(result.sale);

  } catch (error: any) {
    console.error('Sale creation failed:', error);
    const message = error.message && error.message.includes('Stockout') ? error.message : 'Transaction failed due to an unknown error.';
    res.status(400).json({ error: message });
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


type SaleItemInput = {
  productId: string;
  quantity: number;
  price: number;
};

router.put('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { items, updatedAt, paymentMethod } = req.body as { items: SaleItemInput[]; updatedAt: string; paymentMethod: string };
  const tenantId = req.user!.tenantId;

  try {
    const existingSale = await prisma.sale.findUnique({
      where: { id, tenantId },
      include: { items: true },
    });

    if (!existingSale) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }

    // If client update is newer, apply it
    if (new Date(updatedAt) > existingSale.updatedAt) {
      const updatedSale = await prisma.sale.update({
        where: { id, tenantId },
        data: {
          items: {
            deleteMany: {},
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
          paymentMethod,
        },
      });
      res.json(updatedSale);
      return;
    } else {
      // Server has newer data, ignore client update
      res.status(409).json({ message: 'Conflict: server has newer data', serverData: existingSale });
      return;
    }
  } catch (error) {
    console.error('Sale update failed:', error);
    res.status(500).json({ error: 'Failed to update sale.', details: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/sync', async (req: AuthRequest, res: any) => {
  // Example sync endpoint: return all sales for the tenant (can be adapted)
  try {
    const tenantId = req.user!.tenantId;
    const sales = await prisma.sale.findMany({ where: { tenantId } });
    res.status(200).json({ message: 'Sync successful', sales });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;