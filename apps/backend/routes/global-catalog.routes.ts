import { Router } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import GlobalCatalogService from '../src/services/global-catalog.service';
import { NotificationService } from '../src/services/notification.service';

const router = Router();
const prisma = new PrismaClient();

/**
 * GlobalProductCatalog Routes
 * ================================
 * Endpoints for managing the community-driven Nigerian products database
 * 
 * This acts as a "Source of Truth" for local brands like Indomie, Gala, etc.
 * When a user manually adds a product not found in global APIs, it's upserted here.
 */

// POST /api/global-catalog/products
// Create a product in tenant inventory AND sync to GlobalProductCatalog
// This is the main endpoint for manual product entry with automatic global sync
router.post(
    '/products',
    checkRole([UserRole.OWNER, UserRole.MANAGER]),
    async (req: any, res: any) => {
        const {
            barcode,
            productName,
            productImage,
            productColor,
            productDescription,
            costPrice,
            sellingPrice,
            quantity,
            categoryId,
            sku,
            contributeToGlobalCatalog,
        } = req.body;

        const tenantId = req.user!.tenantId;
        const userId = req.user!.userId;

        // Validation
        if (!productName || sellingPrice === undefined || costPrice === undefined) {
            return res.status(400).json({
                error: 'Product Name, Selling Price, and Cost Price are required.',
            });
        }

        try {
            // Use the GlobalCatalogService to create product and sync to catalog
            const product = await GlobalCatalogService.createProductAndSyncToGlobalCatalog(
                tenantId!,
                {
                    barcode,
                    productName,
                    description: productDescription,
                    imageUrl: productImage,
                    costPrice: new Decimal(costPrice),
                    sellingPrice: new Decimal(sellingPrice),
                    quantity: quantity || 0,
                    categoryId,
                    sku,
                },
                contributeToGlobalCatalog !== false, // default true unless explicitly false
            );

            // Create sync change record for offline support
            await prisma.syncChange.create({
                data: {
                    tenantId: tenantId!,
                    entityType: 'product',
                    entityId: product.id,
                    version: product.version,
                    operation: 'CREATE',
                    data: product as any,
                    deleted: false,
                },
            });

            // Mark tenant as having products
            prisma.tenant
                .update({
                    where: { id: tenantId! },
                    data: { hasProduct: true },
                })
                .catch((err) => {
                    console.warn('[GlobalCatalog] Failed to update tenant:', err?.message);
                });

            // Log audit trail
            await prisma.auditLog.create({
                data: {
                    userId,
                    tenantId: tenantId!,
                    action: 'CREATE_PRODUCT_WITH_GLOBAL_SYNC',
                    resourceType: 'Product',
                    resourceId: product.id,
                    description: `Created product "${productName}" and synced to global catalog`,
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    changes: {
                        new: product,
                    } as any,
                },
            });

            res.status(201).json({
                product,
                message: `Product "${productName}" created and synced to global catalog!`,
            });
        } catch (error: any) {
            console.error('Error creating product with global sync:', error);

            if (error.code === 'P2002' && error.meta?.target?.includes('barcode')) {
                return res.status(409).json({
                    error: 'A product with this barcode already exists for your store.',
                    code: 'DUPLICATE_BARCODE',
                });
            }

            res.status(500).json({
                error: 'Failed to create product',
                details: error.message,
            });
        }
    }
);

// GET /api/global-catalog/search?q=indomie
// Search the GlobalProductCatalog by product name
// Useful for finding if a product already exists before adding manually
router.get(
    '/search',
    checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER]),
    async (req: any, res: any) => {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.length < 2) {
            return res.status(400).json({
                error: 'Search query must be at least 2 characters long.',
            });
        }

        try {
            const results = await GlobalCatalogService.searchGlobalCatalog(q as string);

            res.json({
                query: q,
                resultsCount: results.length,
                results,
            });
        } catch (error: any) {
            console.error('Error searching global catalog:', error);
            res.status(500).json({
                error: 'Failed to search global catalog',
                details: error.message,
            });
        }
    }
);

// GET /api/global-catalog/barcode/:barcode
// Lookup a specific product in the global catalog by barcode
router.get(
    '/barcode/:barcode',
    checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER]),
    async (req: any, res: any) => {
        const { barcode } = req.params;

        if (!barcode || barcode.length < 1) {
            return res.status(400).json({
                error: 'Barcode is required.',
            });
        }

        try {
            const product = await GlobalCatalogService.getGlobalProductByBarcode(barcode);

            if (!product) {
                return res.status(404).json({
                    error: 'Product not found in global catalog',
                    barcode,
                    suggestion: 'This product has not been added yet. You can add it as a new product.',
                });
            }

            res.json(product);
        } catch (error: any) {
            console.error('Error fetching product from catalog:', error);
            res.status(500).json({
                error: 'Failed to fetch product from catalog',
                details: error.message,
            });
        }
    }
);

// GET /api/global-catalog/contributions
// Get all products this tenant has contributed to the global catalog
// Shows the impact of this store on the community database
router.get(
    '/contributions',
    checkRole([UserRole.OWNER, UserRole.MANAGER]),
    async (req: AuthRequest, res) => {
        const tenantId = req.user!.tenantId;

        try {
            const contributions = await GlobalCatalogService.getTenantContributions(tenantId!);

            res.json({
                tenantId,
                totalContributions: contributions.length,
                contributions,
            });
        } catch (error: any) {
            console.error('Error fetching tenant contributions:', error);
            res.status(500).json({
                error: 'Failed to fetch contributions',
                details: error.message,
            });
        }
    }
);

// GET /api/global-catalog/stats
// Get statistics about the global product catalog
// Public endpoint - shows community impact and growth
router.get('/stats', async (req: AuthRequest, res) => {
    try {
        const stats = await GlobalCatalogService.getCatalogStats();

        res.json({
            globalProductDatabase: {
                ...stats,
                message: 'Community-driven database for Nigerian products',
            },
        });
    } catch (error: any) {
        console.error('Error fetching catalog stats:', error);
        res.status(500).json({
            error: 'Failed to fetch catalog statistics',
            details: error.message,
        });
    }
});

// POST /api/global-catalog/sync-existing-product
// Manually sync an existing product to the global catalog
// Use when you have local products that should be added to global database
router.post(
    '/sync-existing-product',
    checkRole([UserRole.OWNER, UserRole.MANAGER]),
    async (req: any, res: any) => {
        const { productId } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.userId;

        if (!productId) {
            return res.status(400).json({
                error: 'Product ID is required.',
            });
        }

        try {
            // Get the product
            const product = await prisma.product.findUnique({
                where: { id: productId },
            });

            if (!product) {
                return res.status(404).json({
                    error: 'Product not found.',
                });
            }

            if (product.tenantId !== tenantId) {
                return res.status(403).json({
                    error: 'You do not have permission to sync this product.',
                });
            }

            if (!product.barcode) {
                return res.status(400).json({
                    error: 'Product must have a barcode to be synced to global catalog.',
                });
            }

            // Upsert to global catalog
            const catalogEntry = await GlobalCatalogService.upsertProductToGlobalCatalog({
                barcode: product.barcode,
                productName: product.productName,
                description: product.productDescription,
                imageUrl: product.productImage,
                contributedByTenantId: tenantId,
            });

            // Link product to global catalog if not already linked
            if (!product.globalCatalogId) {
                await prisma.product.update({
                    where: { id: productId },
                    data: { globalCatalogId: catalogEntry.id },
                });
            }

            // Log audit
            await prisma.auditLog.create({
                data: {
                    userId,
                    tenantId: tenantId!,
                    action: 'SYNC_PRODUCT_TO_GLOBAL_CATALOG',
                    resourceType: 'Product',
                    resourceId: productId,
                    description: `Synced product "${product.productName}" to global catalog`,
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                },
            });

            res.json({
                product,
                catalogEntry,
                message: `Product synced to global catalog!`,
            });
        } catch (error: any) {
            console.error('Error syncing product to global catalog:', error);
            res.status(500).json({
                error: 'Failed to sync product',
                details: error.message,
            });
        }
    }
);

export default router;
