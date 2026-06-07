import { Router } from 'express';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Response } from 'express';
import path from 'path';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import { json } from 'stream/consumers';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { BarcodeService } from '../src/services/barcode.service';

const router = Router();
const prisma = new PrismaClient();

// Setup Multer for memory storage (CSV files are kept in memory as Buffers)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.csv'].includes(ext) || file.mimetype === 'text/csv') {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files allowed'))
    }
  }
})

// GET /api/products - List all products for the tenant
router.get(
  '/',
  checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN]),
  async (req: AuthRequest, res) => {
    const tenantId = req.user!.tenantId as any;
    const role = req.user!.role as any;

    try {
      const products = await prisma.product.findMany({
        where: { tenantId, deleted: false } as any,
        orderBy: { productName: 'asc' },
      });

      // Cashiers do not need cost price — strip it before sending
      if (role === UserRole.CASHIER) {
        const sanitised = products.map(({ costPrice, ...rest }) => rest);
        res.json(sanitised);
        return;
      }

      res.json(products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      res.status(500).json({ error: 'Failed to fetch products.' });
    }
  }
);
// router.get('/', async (req: AuthRequest, res) => {
//   const tenantId = req.user!.tenantId;

//   const products = await prisma.product.findMany({
//     where: { tenantId, deleted: false } as any,
//     orderBy: { productName: 'asc' },
//   });

//   res.json(products);
// });

// GET /api/products/search?query=... - Search products by name, SKU, or barcode
router.get('/search', checkRole([UserRole.OWNER, UserRole.CASHIER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: any) => {
  const { query } = req.query;
  const tenantId = req.user!.tenantId as any;
  console.log('Searching product with query:', query, 'for tenant:', tenantId);

  if (!query || typeof query !== 'string' || query.length < 1) {
    // Return quick key products or recent products if no query is given
    const products = await prisma.product.findMany({
      where: { tenantId, deleted: false } as any,
      take: 20, // Limit to 20 Quick Keys/Recent Items
      orderBy: { createdAt: 'desc' }
    });
    return res.json(products);
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        deleted: false,
        // Live, Instant Search: Use OR to search across key fields
        OR: [
          { productName: { contains: query, mode: 'insensitive' } },
          // { sku: { equals: query, mode: 'insensitive' } },
          { barcode: { equals: query, mode: 'insensitive' } },
        ],
        // Only include products that are in stock
        stock: { gt: 0 }
      } as any,
      take: 50, // Limit search results
    });

    res.json(products);
  } catch (error) {
    console.error('Product search failed:', error);
    res.status(500).json({ error: 'Failed to search products.' });
  }
});

// GET /api/products/barcode-lookup/:code - Lookup product details by barcode
router.get('/barcode-lookup/:code', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const { code } = req.params as any;
  const tenantId = req.user!.tenantId as any;

  if (!code || typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'A valid barcode is required.' });
    return;
  }

  try {
    const result = await BarcodeService.lookup(prisma, tenantId!, code);
    res.json(result);
  } catch (error: any) {
    console.error('Barcode lookup failed:', error);
    res.status(500).json({ error: 'Failed to look up barcode.' });
  }
});

// ====================================================================
// POST /api/products/import
// Handles bulk product upload via CSV with resource exhaustion protection
// ====================================================================
router.post('/import',
  checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]),
  upload.single('file'),
  async (req: AuthRequest, res: any) => {
    const tenantId = req.user!.tenantId as any;
    const uploaderId = req.user!.userId as any;
    console.log(`User ${uploaderId} is uploading products for tenant ${tenantId}`);

    // 1. Check for file
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a valid CSV file.' });
    }

    // SECURITY: Define import limits
    const MAX_ROWS = 10000;
    const BATCH_SIZE = 500; // Batch upserts to reduce DB calls and memory pressure

    const importReport = {
      successCount: 0,
      failCount: 0,
      rowsProcessed: 0,
      errors: [] as { row: number, sku: string, error: string }[],
    };

    let rowCount = 0;
    const results: any[] = [];
    const fileBuffer = req.file.buffer.toString('utf8');
    const stream = Readable.from(fileBuffer);

    try {
      // 2. Parse CSV Data with row count protection and streaming backpressure
      const parseComplete = await new Promise<void>((resolve, reject) => {
        stream.pipe(csv())
          .on('data', (data) => {
            rowCount++;

            // SECURITY: Abort if row count exceeds maximum
            if (rowCount > MAX_ROWS) {
              reject(new Error(`CSV exceeds maximum row limit of ${MAX_ROWS}. Upload cancelled.`));
              return;
            }

            results.push(data);

            // BACKPRESSURE: If we have too many rows buffered, pause the stream
            if (results.length >= BATCH_SIZE * 2) {
              stream.pause();
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      // 3. Process Rows in Batches (Upsert Logic with Transactions for efficiency)
      for (let batchStart = 0; batchStart < results.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, results.length);
        const batch = results.slice(batchStart, batchEnd);

        // Process batch in a transaction for atomicity and efficiency
        await prisma.$transaction(async (tx) => {
          for (let i = 0; i < batch.length; i++) {
            const row = batch[i];
            const rowNumber = batchStart + i + 2; // +2 for header + 1-based index

            try {
              // Normalize CSV headers and clean values before field extraction
              const normalizedRow: Record<string, string> = {};
              Object.entries(row).forEach(([key, value]) => {
                const normalizedKey = key
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, '_')
                  .replace(/[^a-z0-9_]/g, '');
                normalizedRow[normalizedKey] = typeof value === 'string'
                  ? value.replace(/"/g, '').trim()
                  : String(value || '');
              });

              const sku = normalizedRow['sku'] as string;
              const productName = normalizedRow['product_name'] || normalizedRow['productname'];
              const productImage = normalizedRow['product_image'] || normalizedRow['productimage'];
              const sellingPrice = parseFloat(normalizedRow['selling_price'] || normalizedRow['retail_price'] || normalizedRow['sellingprice'] || '');
              const supplyPrice = parseFloat(normalizedRow['cost_price'] || normalizedRow['costprice'] || '0');
              const stock = parseInt(normalizedRow['stock_quantity'] || normalizedRow['stock'] || normalizedRow['stockquantity'] || '', 10);
              const normalizedProductImage = productImage ? productImage.trim() : undefined;



              // Basic Validation
              if (!sku || !productName || isNaN(sellingPrice) || isNaN(stock)) {
                console.warn(`Row ${rowNumber} validation failed`, {
                  sku,
                  productName,
                  sellingPrice,
                  stock,
                  normalizedRow,
                });
                importReport.failCount++;
                importReport.errors.push({
                  row: rowNumber,
                  sku: sku || 'N/A',
                  error: 'Missing or invalid SKU, Name, Selling Price, or Inventory.',
                });
                // Skip this row
                continue;
              }

              // 4. Build category logic (resolve category ID if needed)
              let categoryId: string | null = null;
              if (normalizedRow.category || normalizedRow.category_name) {
                const categoryName = (normalizedRow.category || normalizedRow.category_name)?.trim();
                if (categoryName) {
                  const category = await tx.category.findFirst({
                    where: { categoryName, tenantId },
                    select: { id: true }
                  });
                  if (category) {
                    categoryId = category.id;
                  }
                }
              }

              const productDescription = (normalizedRow.product_description || normalizedRow.description || '')?.trim();

              // 5. Upsert the Product
              const upsertData = {
                where: { sku_tenantId: { sku, tenantId } },
                update: {
                  productName,
                  productImage: normalizedProductImage,
                  productDescription,
                  sellingPrice: new Decimal(sellingPrice),
                  costPrice: new Decimal(supplyPrice),
                  categoryId,
                  stock,
                },
                create: {
                  tenantId,
                  sku,
                  productName,
                  productImage: normalizedProductImage,
                  sellingPrice: new Decimal(sellingPrice),
                  costPrice: new Decimal(supplyPrice),
                  stock,
                  categoryId,
                  productDescription,
                },
              };

              const product = await tx.product.upsert(upsertData) as any;

              await (tx as any).syncChange.create({
                data: {
                  tenantId: tenantId!,
                  entityType: 'product',
                  entityId: product.id,
                  version: product.version,
                  operation: 'UPDATE',
                  data: product as any,
                  deleted: product.deleted,
                },
              });

              importReport.successCount++;

            } catch (error: any) {
              importReport.failCount++;
              importReport.errors.push({
                row: rowNumber,
                sku: row.sku || 'N/A',
                error: error.message,
              });
            }
          }
        });

        importReport.rowsProcessed = batchEnd;
      }

      // Final response
      // If at least one product was imported, mark tenant as having products
      if (importReport.successCount > 0 && tenantId) {
        prisma.tenant.update({
          where: { id: tenantId },
          data: { hasProduct: true },
        }).catch((err: any) => {
          console.warn('[Onboarding] Failed to set hasProduct after import:', err?.message);
        });
      }



      res.json({
        message: `Product import complete. Processed ${rowCount} rows.`,
        report: importReport,
        limits: {
          maxRowsAllowed: MAX_ROWS,
          batchSize: BATCH_SIZE,
        }
      });

    } catch (error: any) {
      console.error('Product import error:', error);

      // Check if it was a row limit error
      if (error.message.includes('exceeds maximum row limit')) {
        return res.status(413).json({
          error: error.message,
          limits: { maxRows: MAX_ROWS }
        });
      }

      res.status(500).json({
        error: 'Failed to import products.',
        message: error instanceof Error ? error.message : String(error),
        rowsProcessedBeforeError: importReport.rowsProcessed,
      });
    }
  }
);

// GET /api/products/:id - Get a single product by its ID
router.get(
  '/:id',
  checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN]),
  async (req: AuthRequest, res) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId as string;;
    const role = req.user!.role as string;;

    try {
      const product = await prisma.product.findUnique({
        where: { id, tenantId },
      });

      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }

      // Cashiers do not need cost price — strip it before sending
      if (role === UserRole.CASHIER) {
        const { costPrice, ...sanitised } = product;
        res.json(sanitised);
        return;
      }

      res.json(product);
    } catch (error) {
      console.error('Failed to fetch product:', error);
      res.status(500).json({ error: 'Failed to fetch product.' });
    }
  }
);
// router.get('/:id', async (req: AuthRequest, res) => {
//   const { id } = req.params;
//   const tenantId = req.user!.tenantId;

//   const product = await prisma.product.findUnique({
//     where: { id, tenantId },
//   });

//   if (!product) {
//     res.status(404).json({ error: 'Product not found.' });
//     return;
//   }
//   res.json(product);
// });


// === Write Operations (Restricted to Owner, Manager, SUPER_ADMIN) ===

// POST /api/products - Create a new product
router.post('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res) => {
  const {
    barcode,
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

  const tenantId = req.user!.tenantId as any;

  if (!productName || sellingPrice === undefined || costPrice === undefined) {
    res.status(400).json({ error: 'Product Name, Selling Price, and Cost Price are required.' });
    return;
  }

  try {
    const newProduct = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          barcode,
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
      }) as any;

      await (tx as any).syncChange.create({
        data: {
          tenantId: tenantId!,
          entityType: 'product',
          entityId: created.id,
          version: created.version,
          operation: 'CREATE',
          data: created as any,
          deleted: created.deleted,
        },
      });

      return created;
    });

    // Mark tenant as having at least one product (fire-and-forget; non-blocking)
    prisma.tenant.update({
      where: { id: tenantId! },
      data: { hasProduct: true },
    }).catch((err: any) => {
      console.warn('[Onboarding] Failed to set hasProduct:', err?.message);
    });

    res.status(201).json(newProduct);
  } catch (error: any) {
    if (error.code === 'P2003' && error.meta?.field_name === 'Product_categoryId_fkey (index)') {
      res.status(400).json({ error: 'Invalid categoryId. The specified category does not exist.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create product.', message: error instanceof Error ? error.message : String(error) });
  }
});

// PUT /api/products/:id - Update an existing product
router.put('/:id', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response): Promise<void> => {
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
    updatedAt,
    categoryId
  } = req.body;
  const tenantId = req.user!.tenantId as any;

  console.log('Update Product Payload:', req.body);

  try {
    const existing = await prisma.product.findUnique({ where: { id, tenantId } });

    if (!existing || new Date(updatedAt) > existing.updatedAt) {
      const updated = await prisma.$transaction(async (tx) => {
        const updatedProduct = await tx.product.update({
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
            categoryId,
            version: { increment: 1 },
          } as any,
        });
        const updatedAny = updatedProduct as any;

        await (tx as any).syncChange.create({
          data: {
            tenantId: tenantId!,
            entityType: 'product',
            entityId: updatedAny.id,
            version: updatedAny.version,
            operation: 'UPDATE',
            data: updatedAny,
            deleted: updatedAny.deleted,
          },
        });

        return updatedAny;
      });
      res.json(updated);
    }
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
  console.log('Deleting Product:', id);
  const tenantId = req.user!.tenantId as any;

  try {

    await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id, tenantId },
        data: {
          deleted: true,
          deletedAt: new Date(),
          version: { increment: 1 },
        } as any,
      });
      const updatedAny = updated as any;

      await (tx as any).syncChange.create({
        data: {
          tenantId: tenantId!,
          entityType: 'product',
          entityId: updatedAny.id,
          version: updatedAny.version,
          operation: 'DELETE',
          data: updatedAny,
          deleted: updatedAny.deleted,
        },
      });
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
  const tenantId = req.user!.tenantId as any;

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
        data: {
          stock: newStockLevel,
          version: { increment: 1 },
        } as any,
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

      const updatedAny = updated as any;

      await (tx as any).syncChange.create({
        data: {
          tenantId: tenantId!,
          entityType: 'product',
          entityId: updatedAny.id,
          version: updatedAny.version,
          operation: 'UPDATE',
          data: updatedAny,
          deleted: updatedAny.deleted,
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


