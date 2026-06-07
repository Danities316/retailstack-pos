// import { prisma } from "../lib/prisma";
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Service for managing the GlobalProductCatalog
 * This acts as a community-driven database for Nigerian products
 * Supports upserting products when users manually add items not found in global APIs
 */

// Initialize the Prisma instance directly here to avoid missing file errors
const prisma = new PrismaClient();


interface UpsertProductToGlobalCatalogInput {
    barcode: string | ""; // Barcode is optional to allow non-barcode products, but only barcode products are shared globally
    productName: string;
    description?: string;
    imageUrl?: string;
    contributedByTenantId?: string; // The tenant adding this product
}

interface CreateProductWithGlobalCatalogInput extends UpsertProductToGlobalCatalogInput {
    tenantId: string;
    costPrice: Decimal;
    sellingPrice: Decimal;
    quantity?: number;
    categoryId?: string;
    sku?: string;
}

export class GlobalCatalogService {
    /**
     * Upsert a product into GlobalProductCatalog
     * If the barcode exists, update it; otherwise, create new entry
     * This is called when a user manually adds a product
     *
     * @param input Product data to upsert
     * @returns The created or updated GlobalProductCatalog record
     */
    static async upsertProductToGlobalCatalog(
        input: UpsertProductToGlobalCatalogInput
    ) {
        try {
            const catalogEntry = await prisma.globalProductCatalog.upsert({
                where: {
                    barcode: input.barcode,
                },
                update: {
                    productName: input.productName,
                    description: input.description,
                    imageUrl: input.imageUrl,
                    version: {
                        increment: 1, // Increment version on update
                    },
                    // Only update contributedByTenantId if provided and not already set
                    ...(input.contributedByTenantId && {
                        contributedByTenantId: input.contributedByTenantId,
                    }),
                },
                create: {
                    barcode: input.barcode,
                    productName: input.productName,
                    description: input.description,
                    imageUrl: input.imageUrl,
                    contributedByTenantId: input.contributedByTenantId,
                },
            });

            return catalogEntry;
        } catch (error) {
            console.error("Error upserting product to global catalog:", error);
            throw error;
        }
    }

    /**
     * Create a product in a tenant's inventory and sync it to GlobalProductCatalog
     * This is the main entry point when a user manually adds a product
     *
     * @param tenantId The tenant creating the product
     * @param productData The product data
     * @returns The created product with global catalog reference
     */
    static async createProductAndSyncToGlobalCatalog(
        tenantId: string,
        productData: Omit<CreateProductWithGlobalCatalogInput, "tenantId">,
        contributeToGlobalCatalog: boolean = true,
    ) {
        try {
            // Only sync to global catalog if the product has a barcode AND
            // the owner opted in to contributing. Products without barcodes
            // (homemade, loose goods, unlabelled items) are never shared.
            let globalCatalogId: string | undefined;

            if (productData.barcode && contributeToGlobalCatalog) {
                const globalCatalogEntry = await this.upsertProductToGlobalCatalog({
                    barcode: productData.barcode,
                    productName: productData.productName,
                    description: productData.description,
                    imageUrl: productData.imageUrl,
                    contributedByTenantId: tenantId,
                });
                globalCatalogId = globalCatalogEntry.id;
            }

            // Create the product in the tenant's inventory
            const product = await prisma.product.create({
                data: {
                    tenantId,
                    productName: productData.productName,
                    productImage: productData.imageUrl || '',
                    productDescription: productData.description || '',
                    costPrice: productData.costPrice,
                    sellingPrice: productData.sellingPrice,
                    quantity: productData.quantity || 0,
                    stock: productData.quantity || 0,
                    barcode: productData.barcode || null,
                    sku: productData.sku,
                    categoryId: productData.categoryId,
                    globalCatalogId: globalCatalogId || null,
                },
                include: {
                    category: true,
                    globalCatalog: true,
                },
            });

            return product;
        } catch (error) {
            console.error('Error creating product and syncing to global catalog:', error);
            throw error;
        }
    }
    /**
     * Get a product from GlobalProductCatalog by barcode
     *
     * @param barcode Product barcode
     * @returns The global catalog entry if found
     */
    static async getGlobalProductByBarcode(barcode: string) {
        try {
            return await prisma.globalProductCatalog.findUnique({
                where: { barcode },
                select: {
                    id: true,
                    barcode: true,
                    productName: true,
                    description: true,
                    imageUrl: true,
                    version: true,
                    _count: { select: { products: true } },
                },
            });
        } catch (error) {
            console.error("Error fetching global product:", error);
            throw error;
        }
    }

    /**
     * Search GlobalProductCatalog by product name
     * Useful for finding if a product exists before adding manually
     *
     * @param productName Product name to search
     * @returns List of matching products
     */
    static async searchGlobalCatalog(productName: string) {
        try {
            return await prisma.globalProductCatalog.findMany({
                where: {
                    productName: {
                        contains: productName,
                        mode: "insensitive",
                    },
                },
                include: {
                    contributedByTenant: true,
                    products: {
                        select: {
                            id: true,
                            barcode: true,
                            productName: true,
                            productDescription: true,
                            productImage: true,
                            version: true,
                            createdAt: true,
                        },
                    },
                },
                take: 10, // Limit results
            });
        } catch (error) {
            console.error("Error searching global catalog:", error);
            throw error;
        }
    }

    /**
     * Get all products contributed by a specific tenant
     *
     * @param tenantId The tenant ID
     * @returns List of global catalog entries contributed by this tenant
     */
    static async getTenantContributions(tenantId: string) {
        try {
            return await prisma.globalProductCatalog.findMany({
                where: {
                    contributedByTenantId: tenantId,
                },
                include: {
                    products: {
                        where: {
                            tenantId, // Only show products from this tenant
                        },
                    },
                },
            });
        } catch (error) {
            console.error("Error fetching tenant contributions:", error);
            throw error;
        }
    }

    /**
     * Get stats about the GlobalProductCatalog
     * Useful for dashboard/analytics
     */
    static async getCatalogStats() {
        try {
            const totalProducts = await prisma.globalProductCatalog.count();
            const totalContributors = await prisma.globalProductCatalog.findMany({
                where: {
                    contributedByTenantId: {
                        not: null,
                    },
                },
                distinct: ["contributedByTenantId"],
            });

            const recentAdditions = await prisma.globalProductCatalog.findMany({
                orderBy: {
                    createdAt: "desc",
                },
                take: 20,
            });

            return {
                totalProducts,
                totalContributors: totalContributors.length,
                recentAdditions,
            };
        } catch (error) {
            console.error("Error fetching catalog stats:", error);
            throw error;
        }
    }
}

export default GlobalCatalogService;
