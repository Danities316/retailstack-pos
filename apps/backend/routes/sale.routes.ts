import { Router, Response } from 'express';
import { PrismaClient, UserRole, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import { any } from 'zod';

const router = Router();
const prisma = new PrismaClient();

async function decrementStockAtomic(
  tx: any,
  productId: string,
  tenantId: string,
  quantity: number
): Promise<{ id: string; productName: string; sellingPrice: any; stock: number } | null> {
  // Single atomic operation: read + decrement only if stock is sufficient.
  // Returns the updated product row, or null if stockout or product not found.
  const result = await tx.$executeRaw`
    UPDATE "Product"
    SET stock = stock - ${quantity}
    WHERE id = ${productId}
      AND "tenantId" = ${tenantId}
      AND stock >= ${quantity}
      AND deleted = false
  `;

  if (result === 0) return null; // stockout or product doesn't belong to tenant

  // Fetch updated row for price + name (now safe — we own the decrement)
  return tx.product.findUnique({
    where: { id: productId },
    select: { id: true, productName: true, sellingPrice: true, stock: true },
  });
}

// POST /api/sales - Create a new sale (Accessible to all roles)
// sale.routes.ts - REPLACING the existing POST /api/sales route

// POST /api/sales - Create a new sale (Accessible to all authenticated roles)
router.post('/', async (req: AuthRequest, res: any) => {

  const { paymentMethod, items } = req.body;

  const tenantId = req.user!.tenantId as any; // Tenant ID from Auth Token
  const cashierId = req.user!.userId as any; // Cashier ID from Auth Token
  const cashierRole = req.user!.role as any; // Cashier Role from Auth Token

  if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Payment method and a non-empty array of items are required.' });
    return;
  }

  let activeShift = null;

  const idempotencyKeyHeader = req.headers['idempotency-key'] as string | undefined;

  // ─── PRE-TRANSACTION VALIDATION: Check shift requirement BEFORE idempotency logic ───
  if (cashierRole === 'CASHIER') {
    // Only CASHIERs are REQUIRED to have an active shift
    activeShift = await prisma.shift.findFirst({
      where: { cashierId, tenantId, endTime: null },
      select: { id: true, startFloat: true }
    });

    if (!activeShift) {
      // Return specific error code so frontend can handle with "Clock In" modal
      return res.status(402).json({
        code: 'SHIFT_REQUIRED',
        error: 'You must clock in to start a shift before making sales.',
        action: 'CLOCK_IN_REQUIRED',
        message: 'Clock in to proceed with sales'
      });
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
        let totalAmount = new Decimal(0);
        const saleItemsData: any[] = [];

        for (const item of items) {
          const product = await decrementStockAtomic(tx, item.productId, tenantId, item.quantity);

          if (!product) {
            // Could be stockout OR wrong tenant — fetch name for a useful error message
            const existing = await tx.product.findUnique({
              where: { id: item.productId },
              select: { productName: true, stock: true, tenantId: true },
            });
            if (!existing || existing.tenantId !== tenantId) {
              throw new Error(`Product not found: ${item.productId}`);
            }
            throw new Error(
              `Stockout: Only ${existing.stock} units of "${existing.productName}" available.`
            );
          }

          totalAmount = totalAmount.plus(new Decimal(product.sellingPrice).times(item.quantity));
          saleItemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            price: product.sellingPrice,
          });
        }

        const settings = await tx.storeSettings.findUnique({
          where: { tenantId },
          select: { vatEnabled: true, vatRate: true },
        });


        const subtotal = totalAmount;
        const taxRate = settings?.vatEnabled ? new Decimal(settings.vatRate.toString()) : new Decimal('0');
        const taxAmount = subtotal.times(taxRate);
        const grandTotal = subtotal.plus(taxAmount);

        const newSale = await tx.sale.create({
          data: {
            tenantId,
            userId: cashierId,
            shiftId: activeShift ? activeShift.id : null,
            subtotal,
            taxRate,
            taxAmount,
            totalAmount: grandTotal,
            paymentMethod,
            customerName: req.body.customerName || null,
            saleNote: req.body.saleNote || null,
            items: { createMany: { data: saleItemsData } },
          },
          include: { items: true },
        }) as any;

        // If this is a credit sale, create the customer debt record
        if (paymentMethod === 'CREDIT') {
          const customerName = req.body.customerName as any;
          if (!customerName?.trim()) {
            throw new Error('Customer name is required for credit sales.');
          }

          // Find or create the customer
          let customer = await tx.customer.findFirst({
            where: {
              tenantId,
              name: { equals: customerName.trim(), mode: 'insensitive' },
            },
          });

          if (!customer) {
            customer = await tx.customer.create({
              data: { tenantId, name: customerName.trim() },
            });
          }

          // Record the debt
          await tx.creditSale.create({
            data: {
              tenantId,
              customerId: customer.id,
              saleId: newSale.id,
              amount: grandTotal,
              amountPaid: new Decimal(0),
              balance: grandTotal,
              settled: false,
            },
          }) as any;

          // Update customer total owed
          await tx.customer.update({
            where: { id: customer.id },
            data: { totalOwed: { increment: grandTotal } },
          });
        }

        await (tx as any).syncChange.create({
          data: {
            tenantId: tenantId!,
            entityType: 'sale',
            entityId: newSale.id,
            version: 0,
            operation: 'CREATE',
            data: newSale as any,
            deleted: false,
          },
        });

        return newSale;
      }, { timeout: 15000 });

      // Mark tenant as having at least one sale (fire-and-forget; non-blocking)
      if (tenantId) {
        prisma.tenant.update({
          where: { id: tenantId },
          data: { hasSale: true },
        }).catch((err: any) => {
          console.warn('[Onboarding] Failed to set hasSale:', err?.message);
        });
      }

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
      let totalAmount = new Decimal(0);
      const saleItemsData: any[] = [];

      for (const item of items) {
        const product = await decrementStockAtomic(tx, item.productId, tenantId, item.quantity);

        if (!product) {
          const existing = await tx.product.findUnique({
            where: { id: item.productId },
            select: { productName: true, stock: true, tenantId: true },
          });
          if (!existing || existing.tenantId !== tenantId) {
            throw new Error(`Product not found: ${item.productId}`);
          }
          throw new Error(
            `Stockout: Only ${existing.stock} units of "${existing.productName}" available.`
          );
        }

        totalAmount = totalAmount.plus(new Decimal(product.sellingPrice).times(item.quantity));
        saleItemsData.push({ productId: item.productId, quantity: item.quantity, price: product.sellingPrice });
      }


      const settings = await tx.storeSettings.findUnique({
        where: { tenantId },
        select: { vatEnabled: true, vatRate: true },
      });
      const subtotal = totalAmount;
      const taxRate = settings?.vatEnabled ? new Decimal(settings.vatRate.toString()) : new Decimal('0');
      const taxAmount = subtotal.times(taxRate);
      const grandTotal = subtotal.plus(taxAmount);

      const newSale = await tx.sale.create({
        data: {
          tenantId,
          userId: cashierId,
          shiftId: activeShift ? activeShift.id : null,
          subtotal,
          taxRate,
          taxAmount,
          totalAmount: grandTotal,
          paymentMethod,
          customerName: req.body.customerName || null,
          saleNote: req.body.saleNote || null,
          items: { createMany: { data: saleItemsData } },
        },
        include: { items: true },
      });

      // If this is a credit sale, create the customer debt record
      if (paymentMethod === 'CREDIT') {
        const customerName = req.body.customerName as any;
        if (!customerName?.trim()) {
          throw new Error('Customer name is required for credit sales.');
        }

        // Find or create the customer
        let customer = await tx.customer.findFirst({
          where: {
            tenantId,
            name: { equals: customerName.trim(), mode: 'insensitive' },
          },
        });

        if (!customer) {
          customer = await tx.customer.create({
            data: { tenantId, name: customerName.trim() },
          });
        }

        // Record the debt
        await tx.creditSale.create({
          data: {
            tenantId,
            customerId: customer.id,
            saleId: newSale.id,
            amount: grandTotal,
            amountPaid: new Decimal(0),
            balance: grandTotal,
            settled: false,
          },
        }) as any;

        // Update customer total owed
        await tx.customer.update({
          where: { id: customer.id },
          data: { totalOwed: { increment: grandTotal } },
        });
      }

      // Link idempotency record to the created sale and store serialized response
      await tx.idempotencyKey.update({
        where: { key },
        data: {
          saleId: newSale.id,
          status: 'COMPLETED',
          response: newSale as any,
        },
      }) as any;

      await (tx as any).syncChange.create({
        data: {
          tenantId: tenantId!,
          entityType: 'sale',
          entityId: newSale.id,
          version: 0,
          operation: 'CREATE',
          data: newSale as any,
          deleted: false,
        },
      });

      return { alreadyProcessed: false, sale: newSale };
    }, { timeout: 15000 });

    if (result.alreadyProcessed) {
      if (result.sale) {
        return res.status(200).json(result.sale);
      }
      return res.status(202).json({ message: 'Request is already being processed' });
    }

    // New sale created via idempotency path — mark tenant as having a sale
    if (tenantId) {
      prisma.tenant.update({
        where: { id: tenantId },
        data: { hasSale: true },
      }).catch((err: any) => {
        console.warn('[Onboarding] Failed to set hasSale (idempotency path):', err?.message);
      });
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
  const tenantId = req.user!.tenantId as any;

  try {
    const sales = await prisma.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 500, // guard against unbounded result sets on large tenants
      include: {
        items: {
          include: {
            product: { select: { productName: true } },
          },
        },
      },
    });

    res.json(sales);
  } catch (error) {
    console.error('Failed to fetch sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales.' });
  }
});
// router.get('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
//   const tenantId = req.user!.tenantId;

//   const sales = await prisma.sale.findMany({
//     where: { tenantId },
//     orderBy: { createdAt: 'desc' },
//     include: {
//       items: { // Include the items for each sale
//         include: {
//           product: { select: { productName: true } },
//         },
//       },
//     },
//   });

//   res.json(sales);
// });

// GET /api/sales/:id - Get a single sale's details (Restricted to Owner/Manager)
router.get('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { id } = req.params as any;
  const tenantId = req.user!.tenantId as string;

  try {
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
  } catch (error) {
    console.error('Failed to fetch sale:', error);
    res.status(500).json({ error: 'Failed to fetch sale.' });
  }
});
// router.get('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
//   const { id } = req.params;
//   const tenantId = req.user!.tenantId;

//   const sale = await prisma.sale.findUnique({
//     where: { id, tenantId },
//     include: {
//       items: { include: { product: { select: { productName: true } } } },
//     },
//   });

//   if (!sale) {
//     res.status(404).json({ error: 'Sale not found.' });
//     return;
//   }
//   res.json(sale);
// });


type SaleItemInput = {
  productId: string;
  quantity: number;
  price: number;
};

router.put('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params as any;
  const { items, updatedAt, paymentMethod } = req.body as { items: SaleItemInput[]; updatedAt: string; paymentMethod: string };
  const tenantId = req.user!.tenantId as any;

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
    const tenantId = req.user!.tenantId as any;
    const sales = await prisma.sale.findMany({ where: { tenantId } });
    res.status(200).json({ message: 'Sync successful', sales });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;


// import { PrismaClient, UserRole, Prisma } from '@prisma/client';
// import { Decimal } from '@prisma/client/runtime/library';
// import { AuthRequest } from '../middleware/auth.middleware';
// import { checkRole } from '../middleware/role.middleware';
// import { any } from 'zod';

// const router = Router();
// const prisma = new PrismaClient();

// // POST /api/sales - Create a new sale (Accessible to all roles)
// // sale.routes.ts - REPLACING the existing POST /api/sales route

// // POST /api/sales - Create a new sale (Accessible to all authenticated roles)
// router.post('/', async (req: AuthRequest, res: any) => {

//   const { paymentMethod, items } = req.body;

//   const tenantId = req.user!.tenantId; // Tenant ID from Auth Token
//   const cashierId = req.user!.userId; // Cashier ID from Auth Token
//   const cashierRole = req.user!.role; // Cashier Role from Auth Token

//   if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
//     res.status(400).json({ error: 'Payment method and a non-empty array of items are required.' });
//     return;
//   }

//   let activeShift = null;

//   const idempotencyKeyHeader = req.headers['idempotency-key'] as string | undefined;

//   if (cashierRole === 'CASHIER') {
//     // Only CASHIERs are REQUIRED to have an active shift
//     activeShift = await prisma.shift.findFirst({
//       where: { cashierId, tenantId, endTime: null },
//       select: { id: true, startFloat: true }
//     });

//     if (!activeShift) {
//       // FORBIDDEN SALE: Cashier is not clocked in
//       return res.status(403).json({ error: 'You must clock in to start a shift before making sales.' });
//     }
//   } else {
//     // MANAGER and OWNER roles can make sales without an explicit shift.
//     // We still check if they happen to be clocked in, just in case.
//     activeShift = await prisma.shift.findFirst({
//       where: { cashierId, tenantId, endTime: null },
//       select: { id: true, startFloat: true }
//     });
//   }

//   try {
//     // If no idempotency key provided, behave as before
//     if (!idempotencyKeyHeader) {
//       const sale = await prisma.$transaction(async (tx) => {
//         let totalAmount = new Decimal(0);
//         const saleItemsData: any[] = [];

//         for (const item of items) {
//           const product = await tx.product.findUnique({
//             where: { id: item.productId },
//           });

//           if (!product || product.tenantId !== tenantId) {
//             throw new Error(`Product not found: ${item.productId}`);
//           }

//           if (product.stock < item.quantity) {
//             throw new Error(`Stockout: Only ${product.stock} units of ${product.productName} available.`);
//           }

//           const itemPrice = product.sellingPrice;
//           totalAmount = totalAmount.plus(new Decimal(itemPrice).times(item.quantity));

//           saleItemsData.push({
//             productId: item.productId,
//             quantity: item.quantity,
//             price: itemPrice,
//           });

//           await tx.product.update({
//             where: { id: item.productId },
//             data: { stock: { decrement: item.quantity } },
//           });
//         }

//         const newSale = await tx.sale.create({
//           data: {
//             tenantId,
//             userId: cashierId,
//             shiftId: activeShift ? activeShift.id : null,
//             totalAmount,
//             paymentMethod,
//             items: { createMany: { data: saleItemsData } },
//           },
//           include: { items: true },
//         }) as any;

//         await (tx as any).syncChange.create({
//           data: {
//             tenantId: tenantId!,
//             entityType: 'sale',
//             entityId: newSale.id,
//             version: 0,
//             operation: 'CREATE',
//             data: newSale as any,
//             deleted: false,
//           },
//         });

//         return newSale;
//       });

//       return res.status(201).json(sale);
//     }

//     // Idempotency flow: try to create an idempotency record first to claim the key
//     const key = idempotencyKeyHeader;

//     const result = await prisma.$transaction(async (tx) => {
//       try {
//         await tx.idempotencyKey.create({
//           data: {
//             key,
//             tenantId,
//             userId: cashierId,
//             status: 'IN_PROGRESS',
//           },
//         });
//       } catch (err: any) {
//         // If key already exists, return existing sale if available
//         if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
//           const existing = await tx.idempotencyKey.findUnique({ where: { key } });
//           if (existing && existing.saleId) {
//             const existingSale = await tx.sale.findUnique({ where: { id: existing.saleId } });
//             return { alreadyProcessed: true, sale: existingSale };
//           }
//           // Key exists but not yet linked to a sale -> indicate in-progress
//           return { alreadyProcessed: true, sale: null };
//         }
//         throw err;
//       }

//       // Proceed to create sale while owning the idempotency key
//       let totalAmount = new Decimal(0);
//       const saleItemsData: any[] = [];

//       for (const item of items) {
//         const product = await tx.product.findUnique({ where: { id: item.productId } });
//         if (!product || product.tenantId !== tenantId) {
//           throw new Error(`Product not found: ${item.productId}`);
//         }
//         if (product.stock < item.quantity) {
//           throw new Error(`Stockout: Only ${product.stock} units of ${product.productName} available.`);
//         }

//         const itemPrice = product.sellingPrice;
//         totalAmount = totalAmount.plus(new Decimal(itemPrice).times(item.quantity));

//         saleItemsData.push({ productId: item.productId, quantity: item.quantity, price: itemPrice });

//         await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
//       }

//       const newSale = await tx.sale.create({
//         data: {
//           tenantId,
//           userId: cashierId,
//           shiftId: activeShift ? activeShift.id : null,
//           totalAmount,
//           paymentMethod,
//           items: { createMany: { data: saleItemsData } },
//         },
//         include: { items: true },
//       });

//       // Link idempotency record to the created sale and store serialized response
//       await tx.idempotencyKey.update({
//         where: { key },
//         data: {
//           saleId: newSale.id,
//           status: 'COMPLETED',
//           response: newSale as any,
//         },
//       }) as any;

//       await (tx as any).syncChange.create({
//         data: {
//           tenantId: tenantId!,
//           entityType: 'sale',
//           entityId: newSale.id,
//           version: 0,
//           operation: 'CREATE',
//           data: newSale as any,
//           deleted: false,
//         },
//       });

//       return { alreadyProcessed: false, sale: newSale };
//     });

//     if (result.alreadyProcessed) {
//       if (result.sale) {
//         return res.status(200).json(result.sale);
//       }
//       return res.status(202).json({ message: 'Request is already being processed' });
//     }

//     return res.status(201).json(result.sale);

//   } catch (error: any) {
//     console.error('Sale creation failed:', error);
//     const message = error.message && error.message.includes('Stockout') ? error.message : 'Transaction failed due to an unknown error.';
//     res.status(400).json({ error: message });
//   }
// });

// // GET /api/sales - List all sales for the tenant - Restricted to Owner/Manager
// router.get('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
//   const tenantId = req.user!.tenantId;

//   const sales = await prisma.sale.findMany({
//     where: { tenantId },
//     orderBy: { createdAt: 'desc' },
//     include: {
//       items: { // Include the items for each sale
//         include: {
//           product: { select: { productName: true } },
//         },
//       },
//     },
//   });

//   res.json(sales);
// });

// // GET /api/sales/:id - Get a single sale's details (Restricted to Owner/Manager)
// router.get('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
//   const { id } = req.params;
//   const tenantId = req.user!.tenantId;

//   const sale = await prisma.sale.findUnique({
//     where: { id, tenantId },
//     include: {
//       items: { include: { product: { select: { productName: true } } } },
//     },
//   });

//   if (!sale) {
//     res.status(404).json({ error: 'Sale not found.' });
//     return;
//   }
//   res.json(sale);
// });


// type SaleItemInput = {
//   productId: string;
//   quantity: number;
//   price: number;
// };

// router.put('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response): Promise<void> => {
//   const { id } = req.params;
//   const { items, updatedAt, paymentMethod } = req.body as { items: SaleItemInput[]; updatedAt: string; paymentMethod: string };
//   const tenantId = req.user!.tenantId;

//   try {
//     const existingSale = await prisma.sale.findUnique({
//       where: { id, tenantId },
//       include: { items: true },
//     });

//     if (!existingSale) {
//       res.status(404).json({ error: 'Sale not found.' });
//       return;
//     }

//     // If client update is newer, apply it
//     if (new Date(updatedAt) > existingSale.updatedAt) {
//       const updatedSale = await prisma.sale.update({
//         where: { id, tenantId },
//         data: {
//           items: {
//             deleteMany: {},
//             create: items.map(item => ({
//               productId: item.productId,
//               quantity: item.quantity,
//               price: item.price,
//             })),
//           },
//           paymentMethod,
//         },
//       });
//       res.json(updatedSale);
//       return;
//     } else {
//       // Server has newer data, ignore client update
//       res.status(409).json({ message: 'Conflict: server has newer data', serverData: existingSale });
//       return;
//     }
//   } catch (error) {
//     console.error('Sale update failed:', error);
//     res.status(500).json({ error: 'Failed to update sale.', details: error instanceof Error ? error.message : String(error) });
//   }
// });

// router.post('/sync', async (req: AuthRequest, res: any) => {
//   // Example sync endpoint: return all sales for the tenant (can be adapted)
//   try {
//     const tenantId = req.user!.tenantId;
//     const sales = await prisma.sale.findMany({ where: { tenantId } });
//     res.status(200).json({ message: 'Sync successful', sales });
//   } catch (error) {
//     console.error('Sync failed:', error);
//     res.status(500).json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) });
//   }
// });

// export default router;