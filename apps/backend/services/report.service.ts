import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

interface DateRange {
    startDate: Date
    endDate: Date
}

interface SalesReportData {
    period: string
    totalSales: number
    transactionCount: number
    averageOrderValue: number
    salesByPaymentMethod: { method: string; amount: number; count: number }[]
    dailyTrend?: { date: string; sales: number }[]
}

interface ProductReportData {
    productId: string
    productName: string
    quantitySold: number
    totalRevenue: number
    averagePrice: number
    costOfGoodsSold: number
    profit: number
    profitMargin: number
}

interface ProfitLossData {
    period: string
    totalRevenue: number
    totalCOGS: number
    grossProfit: number
    grossMarginPercent: number
    netProfit: number
    netMarginPercent: number
}

interface TaxReportData {
    taxRate: number
    salesCount: number
    subtotalAmount: number
    taxCollected: number
}

export class ReportService {
    // Generate Sales Report
    static async generateSalesReport(
        tenantId: string,
        startDate: Date,
        endDate: Date,
        groupBy: 'daily' | 'weekly' | 'monthly' = 'daily'
    ): Promise<SalesReportData> {
        const sales = await prisma.sale.findMany({
            where: {
                tenantId,
                createdAt: { gte: startDate, lte: endDate }
            },
            include: { items: { include: { product: true } } }
        })

        if (sales.length === 0) {
            return {
                period: `${startDate.toDateString()} - ${endDate.toDateString()}`,
                totalSales: 0,
                transactionCount: 0,
                averageOrderValue: 0,
                salesByPaymentMethod: []
            }
        }

        const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)
        const transactionCount = sales.length
        const averageOrderValue = totalSales / transactionCount

        // Group by payment method
        const salesByMethod = sales.reduce((acc: Record<string, any>, sale) => {
            if (!acc[sale.paymentMethod]) {
                acc[sale.paymentMethod] = { amount: 0, count: 0 }
            }
            acc[sale.paymentMethod].amount += Number(sale.totalAmount)
            acc[sale.paymentMethod].count += 1
            return acc
        }, {})

        const salesByPaymentMethod = Object.entries(salesByMethod).map(([method, data]: [string, any]) => ({
            method,
            amount: data.amount,
            count: data.count
        }))

        // Daily trend
        const dailyTrend = this.aggregateByDate(sales, groupBy)

        return {
            period: `${startDate.toDateString()} - ${endDate.toDateString()}`,
            totalSales,
            transactionCount,
            averageOrderValue,
            salesByPaymentMethod,
            dailyTrend
        }
    }

    // Generate Product Performance Report
    static async generateProductReport(
        tenantId: string,
        startDate: Date,
        endDate: Date,
        limit: number = 10
    ): Promise<ProductReportData[]> {
        const saleItems = await prisma.saleItem.findMany({
            where: {
                sale: {
                    tenantId,
                    createdAt: { gte: startDate, lte: endDate }
                }
            },
            include: { product: true, sale: true }
        })

        if (saleItems.length === 0) return []

        // Group by product
        const productMap = new Map<string, any>()
        saleItems.forEach((item) => {
            const productId = item.productId
            if (!productMap.has(productId)) {
                productMap.set(productId, {
                    productId,
                    productName: item.product.productName,
                    quantitySold: 0,
                    totalRevenue: 0,
                    costOfGoodsSold: 0,
                    prices: []
                })
            }
            const product = productMap.get(productId)
            product.quantitySold += item.quantity
            product.totalRevenue += Number(item.price) * item.quantity
            product.costOfGoodsSold += Number(item.product.costPrice) * item.quantity
            product.prices.push(Number(item.price))
        })

        // Transform to report format
        const reports: ProductReportData[] = Array.from(productMap.values())
            .map((p) => ({
                productId: p.productId,
                productName: p.productName,
                quantitySold: p.quantitySold,
                totalRevenue: p.totalRevenue,
                averagePrice: p.totalRevenue / p.quantitySold,
                costOfGoodsSold: p.costOfGoodsSold,
                profit: p.totalRevenue - p.costOfGoodsSold,
                profitMargin: ((p.totalRevenue - p.costOfGoodsSold) / p.totalRevenue) * 100
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, limit)

        return reports
    }

    // Generate Profit & Loss Statement
    static async generateProfitLoss(
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ProfitLossData> {
        const sales = await prisma.sale.findMany({
            where: {
                tenantId,
                createdAt: { gte: startDate, lte: endDate }
            },
            include: { items: { include: { product: true } } }
        })

        let totalRevenue = 0
        let totalCOGS = 0

        sales.forEach((sale) => {
            totalRevenue += Number(sale.totalAmount)
            sale.items.forEach((item) => {
                totalCOGS += Number(item.product.costPrice) * item.quantity
            })
        })

        const grossProfit = totalRevenue - totalCOGS
        const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
        const netProfit = grossProfit // Simplified: no operating expenses
        const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

        return {
            period: `${startDate.toDateString()} - ${endDate.toDateString()}`,
            totalRevenue,
            totalCOGS,
            grossProfit,
            grossMarginPercent,
            netProfit,
            netMarginPercent
        }
    }

    // Generate Tax Report
    static async generateTaxReport(
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<TaxReportData[]> {
        const sales = await prisma.sale.findMany({
            where: {
                tenantId,
                createdAt: { gte: startDate, lte: endDate }
            }
        })

        // Group by tax rate
        const taxMap = new Map<number, any>()
        sales.forEach((sale) => {
            const taxRate = Number(sale.taxRate)
            if (!taxMap.has(taxRate)) {
                taxMap.set(taxRate, {
                    taxRate,
                    salesCount: 0,
                    subtotalAmount: 0,
                    taxCollected: 0
                })
            }
            const entry = taxMap.get(taxRate)
            entry.salesCount += 1
            entry.subtotalAmount += Number(sale.subtotal)
            entry.taxCollected += Number(sale.taxAmount)
        })

        return Array.from(taxMap.values())
    }

    // Helper: Aggregate sales by date
    private static aggregateByDate(
        sales: any[],
        groupBy: 'daily' | 'weekly' | 'monthly'
    ): { date: string; sales: number }[] {
        const dateMap = new Map<string, number>()

        sales.forEach((sale) => {
            let dateKey: string
            const date = new Date(sale.createdAt)

            if (groupBy === 'daily') {
                dateKey = date.toISOString().split('T')[0]
            } else if (groupBy === 'weekly') {
                const weekStart = new Date(date)
                weekStart.setDate(date.getDate() - date.getDay())
                dateKey = weekStart.toISOString().split('T')[0]
            } else {
                dateKey = date.toISOString().substring(0, 7)
            }

            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, 0)
            }
            dateMap.set(dateKey, dateMap.get(dateKey)! + Number(sale.totalAmount))
        })

        return Array.from(dateMap.entries())
            .map(([date, sales]) => ({ date, sales }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
}