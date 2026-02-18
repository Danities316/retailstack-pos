/**
 * Sample data seed for offline-first demo.
 * Pre-populate IndexedDB with sample data for testing offline functionality.
 */

import { OfflineEntity, createOfflineEntity } from '../domain/OfflineEntity';
import { putInStore } from '../offline/db';

export interface SampleDataOptions {
    tenantId: string;
    productCount?: number;
    categoryCount?: number;
    saleCount?: number;
}

/**
 * Seed sample data into IndexedDB.
 */
export async function seedSampleData(db: IDBDatabase, options: SampleDataOptions): Promise<void> {
    const { tenantId, productCount = 10, categoryCount = 5, saleCount = 5 } = options;

    console.log('Seeding sample data...');

    // Create categories
    const categories = createSampleCategories(tenantId, categoryCount);
    for (const category of categories) {
        await putInStore(db, 'categories', category);
    }
    console.log(`✓ Seeded ${categories.length} categories`);

    // Create products
    const products = createSampleProducts(tenantId, productCount, categories);
    for (const product of products) {
        await putInStore(db, 'products', product);
    }
    console.log(`✓ Seeded ${products.length} products`);

    // Create sales
    const sales = createSampleSales(tenantId, saleCount, products);
    for (const sale of sales) {
        await putInStore(db, 'sales', sale);
    }
    console.log(`✓ Seeded ${sales.length} sales`);

    console.log('Sample data seeded successfully!');
}

/**
 * Create sample categories.
 */
function createSampleCategories(
    tenantId: string,
    count: number
): OfflineEntity<any>[] {
    const categoryNames = [
        'Electronics',
        'Clothing',
        'Food & Beverage',
        'Home & Garden',
        'Sports',
    ];

    return categoryNames.slice(0, count).map((name, idx) =>
        createOfflineEntity(
            `cat_${idx + 1}`,
            tenantId,
            {
                tenantId,
                name,
                description: `${name} category`,
                displayOrder: idx,
            },
            1,
            'CLEAN'
        )
    );
}

/**
 * Create sample products.
 */
function createSampleProducts(
    tenantId: string,
    count: number,
    categories: OfflineEntity<any>[]
): OfflineEntity<any>[] {
    const productNames = [
        'Laptop',
        'Mouse',
        'Keyboard',
        'Monitor',
        'Headphones',
        'Webcam',
        'USB Cable',
        'Phone',
        'Tablet',
        'Charger',
    ];

    return productNames.slice(0, count).map((name, idx) => {
        const category = categories[idx % categories.length];
        const categoryId = category?.id || `cat_${Math.floor(idx % 5) + 1}`;

        return createOfflineEntity(
            `prod_${idx + 1}`,
            tenantId,
            {
                tenantId,
                name,
                sku: `SKU-${String(idx + 1).padStart(4, '0')}`,
                categoryId,
                price: 99.99 + idx * 50,
                cost: 49.99 + idx * 25,
                quantity: Math.floor(Math.random() * 100),
                description: `Sample product: ${name}`,
            },
            1,
            'CLEAN'
        );
    });
}

/**
 * Create sample sales.
 */
function createSampleSales(
    tenantId: string,
    count: number,
    products: OfflineEntity<any>[]
): OfflineEntity<any>[] {
    const sales: OfflineEntity<any>[] = [];

    for (let i = 0; i < count; i++) {
        const itemCount = Math.floor(Math.random() * 5) + 1;
        const items = [];
        let totalAmount = 0;

        for (let j = 0; j < itemCount; j++) {
            const product = products[Math.floor(Math.random() * products.length)];
            if (!product) continue;

            const quantity = Math.floor(Math.random() * 5) + 1;
            const price = (product.data.price as number) || 99.99;
            const itemTotal = quantity * price;

            items.push({
                productId: product.id,
                productName: product.data.name,
                quantity,
                price,
                subtotal: itemTotal,
            });

            totalAmount += itemTotal;
        }

        sales.push(
            createOfflineEntity(
                `sale_${i + 1}`,
                tenantId,
                {
                    tenantId,
                    items,
                    totalAmount,
                    itemCount: items.length,
                    paymentMethod: ['CASH', 'CARD', 'MOBILE'][Math.floor(Math.random() * 3)],
                    saleDate: new Date().toISOString(),
                    notes: `Sample sale ${i + 1}`,
                },
                1,
                'CLEAN'
            )
        );
    }

    return sales;
}

/**
 * Clear all sample data from IndexedDB.
 */
export async function clearSampleData(db: IDBDatabase): Promise<void> {
    const stores = ['products', 'sales', 'categories', 'inventory'];

    for (const storeName of stores) {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    console.log('Sample data cleared');
}
