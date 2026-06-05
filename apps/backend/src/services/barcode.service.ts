import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface ProductStandard {
  barcode: string;
  productName: string | null;
  description: string | null;
  image: string | null;
  brand: string | null;
  source: 'internal' | 'openfoodfacts' | 'upcitemdb' | 'none';
  found: boolean;
}

interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  generic_name_en?: string;
  image_url?: string;
  image_front_url?: string;
  brands?: string;
}

interface OpenFoodFactsResponse {
  status?: number;
  product?: OpenFoodFactsProduct;
}

interface UpcItemDbItem {
  title?: string;
  description?: string;
  brand?: string;
  images?: string[];
}

interface UpcItemDbResponse {
  code?: string;
  message?: string;
  items?: UpcItemDbItem[];
}

const LOOKUP_TIMEOUT_MS = 5000;

export class BarcodeService {
  static async lookup(prisma: PrismaClient, tenantId: string, rawBarcode: string): Promise<ProductStandard> {
    const barcode = this.normalizeBarcode(rawBarcode);
    if (!barcode) {
      return this.emptyResult('');
    }

    const internalMatch = await this.lookupInternal(prisma, tenantId, barcode);
    if (internalMatch.found) {
      return internalMatch;
    }

    const openFoodFactsMatch = await this.lookupOpenFoodFacts(barcode);
    if (openFoodFactsMatch.found) {
      return openFoodFactsMatch;
    }

    const upcItemDbMatch = await this.lookupUpcItemDb(barcode);
    if (upcItemDbMatch.found) {
      return upcItemDbMatch;
    }

    return this.emptyResult(barcode);
  }

  private static async lookupInternal(prisma: PrismaClient, tenantId: string, barcode: string): Promise<ProductStandard> {
    const product = await prisma.product.findFirst({
      where: {
        tenantId,
        barcode,
        deleted: false,
      } as any,
    });

    if (!product) {
      return this.emptyResult(barcode);
    }

    return {
      barcode,
      productName: this.cleanText(product.productName),
      description: this.cleanText(product.productDescription),
      image: this.cleanText(product.productImage),
      brand: null,
      source: 'internal',
      found: true,
    };
  }

  private static async lookupOpenFoodFacts(barcode: string): Promise<ProductStandard> {
    try {
      const response = await this.fetchJson<OpenFoodFactsResponse>(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
      );

      if (!response || response.status !== 1 || !response.product) {
        return this.emptyResult(barcode);
      }

      const normalized = this.mapOpenFoodFactsProduct(barcode, response.product);
      return this.hasUsableProductData(normalized) ? normalized : this.emptyResult(barcode);
    } catch (error: any) {
      logger.warn(`Open Food Facts lookup failed for barcode ${barcode}: ${error?.message || 'Unknown error'}`);
      return this.emptyResult(barcode);
    }
  }

  private static async lookupUpcItemDb(barcode: string): Promise<ProductStandard> {
    try {
      const response = await this.fetchJson<UpcItemDbResponse>(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
        { Accept: 'application/json' }
      );

      if (!response) {
        return this.emptyResult(barcode);
      }

      const rateLimited =
        response.code === 'TOO_FAST' ||
        response.code === 'RATE_LIMITED' ||
        response.message?.toLowerCase().includes('limit') ||
        response.message?.toLowerCase().includes('too fast');

      if (rateLimited) {
        logger.warn(`UPCitemdb trial rate-limited for barcode ${barcode}`);
        return this.emptyResult(barcode);
      }

      const item = Array.isArray(response.items) ? response.items[0] : null;
      if (!item) {
        return this.emptyResult(barcode);
      }

      const normalized = this.mapUpcItemDbProduct(barcode, item);
      return this.hasUsableProductData(normalized) ? normalized : this.emptyResult(barcode);
    } catch (error: any) {
      logger.warn(`UPCitemdb lookup failed for barcode ${barcode}: ${error?.message || 'Unknown error'}`);
      return this.emptyResult(barcode);
    }
  }

  private static mapOpenFoodFactsProduct(barcode: string, product: OpenFoodFactsProduct): ProductStandard {
    return {
      barcode,
      productName: this.cleanText(product.product_name) || this.cleanText(product.product_name_en),
      description: this.cleanText(product.generic_name) || this.cleanText(product.generic_name_en),
      image: this.cleanText(product.image_url) || this.cleanText(product.image_front_url),
      brand: this.cleanText(product.brands),
      source: 'openfoodfacts',
      found: true,
    };
  }

  private static mapUpcItemDbProduct(barcode: string, item: UpcItemDbItem): ProductStandard {
    return {
      barcode,
      productName: this.cleanText(item.title),
      description: this.cleanText(item.description),
      image: this.cleanText(Array.isArray(item.images) ? item.images[0] : null),
      brand: this.cleanText(item.brand),
      source: 'upcitemdb',
      found: true,
    };
  }

  private static async fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 429) {
          return null;
        }

        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private static hasUsableProductData(product: ProductStandard): boolean {
    return Boolean(product.productName || product.description || product.image || product.brand);
  }

  private static normalizeBarcode(value: string): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private static cleanText(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private static emptyResult(barcode: string): ProductStandard {
    return {
      barcode,
      productName: null,
      description: null,
      image: null,
      brand: null,
      source: 'none',
      found: false,
    };
  }
}
