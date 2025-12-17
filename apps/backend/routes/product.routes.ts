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
router.get('/', async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;

  const products = await prisma.product.findMany({
    where: { tenantId },
    orderBy: { productName: 'asc' },
  });

  res.json(products);
});

// GET /api/products/search?query=... - Search products by name, SKU, or barcode
router.get('/search', checkRole([UserRole.OWNER, UserRole.CASHIER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: any) => {
  const { query } = req.query;
  const tenantId = req.user!.tenantId;
  console.log('Searching product with query:', query, 'for tenant:', tenantId);

  if (!query || typeof query !== 'string' || query.length < 1) {
    // Return quick key products or recent products if no query is given
    const products = await prisma.product.findMany({
      where: { tenantId },
      take: 20, // Limit to 20 Quick Keys/Recent Items
      orderBy: { createdAt: 'desc' }
    });
    return res.json(products);
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        // Live, Instant Search: Use OR to search across key fields
        OR: [
          { productName: { contains: query, mode: 'insensitive' } },
          // { sku: { equals: query, mode: 'insensitive' } },
          { barcode: { equals: query, mode: 'insensitive' } },
        ],
        // Only include products that are in stock
        stock: { gt: 0 }
      },
      take: 50, // Limit search results
    });

    res.json(products);
  } catch (error) {
    console.error('Product search failed:', error);
    res.status(500).json({ error: 'Failed to search products.' });
  }
});

// ====================================================================
// POST /api/products/import
// Handles bulk product upload via CSV
// ====================================================================
router.post('/import',
  checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]),
  upload.single('file'),
  async (req: AuthRequest, res: any) => {
    const tenantId = req.user!.tenantId;
    const uploaderId = req.user!.userId;
    console.log(`User ${uploaderId} is uploading products for tenant ${tenantId}`);

    // 1. Check for file
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a valid CSV file.' });
    }

    const results: any[] = [];
    const fileBuffer = req.file.buffer.toString('utf8');
    const stream = Readable.from(fileBuffer);

    // 2. Parse CSV Data
    await new Promise<void>((resolve, reject) => {
      stream.pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    const importReport = {
      successCount: 0,
      failCount: 0,
      errors: [] as { row: number, sku: string, error: string }[],
    };

    // 3. Process Rows (Upsert Logic)
    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const rowNumber = i + 2; // +2 for 1-based index and header row
      try {
        // Mapping CSV columns to Prisma model fields
        const sku = row.sku.trim();
        const productName = row.product_name.trim();
        const retailPrice = parseFloat(row.retail_price);
        const supplyPrice = parseFloat(row.cost_price);
        const stock = parseInt(row['stock_quantity'], 10);
        // Basic Validation
        if (!sku || !productName || isNaN(retailPrice) || isNaN(stock)) {
          throw new Error('Missing or invalid SKU, Name, Retail Price, or Inventory.');
        }


        // 4. Find Category (and Create if necessary)
        let categoryId: string | undefined;
        if (row.category) {
          const categoryName = row.category.trim();
          let category = await prisma.category.findFirst({
            where: { categoryName: categoryName, tenantId },
          });

          if (!category) {
            category = await prisma.category.create({
              data: { categoryName: categoryName, tenantId },
            });
          }
          categoryId = category.id;
        }
        // 5. Upsert (Update or Create) the Product
        // NOTE: We use sku + tenantId as the composite unique identifier for upsert.
        const upsertedProduct = await prisma.product.upsert({
          where: { sku_tenantId: { sku, tenantId } },
          update: {
            productName,
            sellingPrice: new Decimal(retailPrice),
            costPrice: new Decimal(supplyPrice),
            categoryId,
            // Stock update should usually be an adjustment via InventoryLog
            // For a simple initial import, we set the stock level directly.
            stock: stock,
            // You can add logic here to create an InventoryLog for the stock change
          },
          create: {
            tenantId,
            sku,
            productName,
            sellingPrice: new Decimal(retailPrice),
            costPrice: new Decimal(supplyPrice),
            stock,
            categoryId,
            productDescription: row.description || '',
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

    // Final response
    res.json({
      message: `Product import complete.`,
      report: importReport,
    });

  }
);

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
  const tenantId = req.user!.tenantId;

  console.log('Update Product Payload:', req.body);

  try {
    const existing = await prisma.product.findUnique({ where: { id } });

    if (!existing || new Date(updatedAt) > existing.updatedAt) {
      const updated = await prisma.product.update({
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
