// Mock API responses for testing
export const mockProducts = [
  {
    id: '1',
    productName: 'Test Product',
    sellingPrice: 100,
    costPrice: 80,
    stock: 50,
    categoryId: 'cat1',
    tenantId: 'tenant1'
  }
]

export const mockCategories = [
  {
    id: 'cat1',
    categoryName: 'Test Category',
    tenantId: 'tenant1'
  }
]

export const mockSales = [
  {
    id: 'sale1',
    totalAmount: 200,
    paymentMethod: 'CASH',
    tenantId: 'tenant1',
    items: [
      {
        productId: '1',
        quantity: 2,
        price: 100
      }
    ],
    createdAt: '2024-01-01T00:00:00Z'
  }
]

export const mockUser = {
  id: 'user1',
  email: 'test@example.com',
  role: 'OWNER',
  tenantId: 'tenant1'
}

export const mockDashboardStats = {
  totalSales: 1000,
  totalProducts: 50,
  totalCategories: 5,
  recentSales: 10
}
