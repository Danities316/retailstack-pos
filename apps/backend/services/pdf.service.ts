import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'

export class PDFService {
    static generateSalesReportPDF(reportData: any, storeName: string): PassThrough {
        const doc = new PDFDocument()
        const stream = new PassThrough()

        doc.pipe(stream)

        // Header
        doc.fontSize(20).text(storeName, { align: 'center' }).moveDown(0.5)
        doc.fontSize(14).text('Sales Report', { align: 'center' }).moveDown(1)
        doc.fontSize(10).text(`Period: ${reportData.period}`, { align: 'center' }).moveDown(2)

        // Key Metrics
        doc.fontSize(12).text('Summary', { underline: true }).moveDown(0.5)
        doc.fontSize(10)
        doc.text(`Total Sales: ₦${reportData.totalSales.toFixed(2)}`)
        doc.text(`Transactions: ${reportData.transactionCount}`)
        doc.text(`Average Order Value: ₦${reportData.averageOrderValue.toFixed(2)}`)
        doc.moveDown(1)

        // Sales by Payment Method
        doc.fontSize(12).text('Sales by Payment Method', { underline: true }).moveDown(0.5)
        doc.fontSize(10)
        reportData.salesByPaymentMethod.forEach((method: any) => {
            doc.text(`${method.method}: ₦${method.amount.toFixed(2)} (${method.count} transactions)`)
        })
        doc.moveDown(1)

        // Daily Trend Table
        if (reportData.dailyTrend && reportData.dailyTrend.length > 0) {
            doc.fontSize(12).text('Daily Trend', { underline: true }).moveDown(0.5)
            doc.fontSize(9)
            reportData.dailyTrend.slice(0, 10).forEach((day: any) => {
                doc.text(`${day.date}: ₦${day.sales.toFixed(2)}`)
            })
        }

        doc.end()
        stream.on('end', () => { })
        return stream
    }

    static generateProductReportPDF(reportData: any[], storeName: string): PassThrough {
        const doc = new PDFDocument()
        const stream = new PassThrough()

        doc.pipe(stream)

        // Header
        doc.fontSize(20).text(storeName, { align: 'center' }).moveDown(0.5)
        doc.fontSize(14).text('Product Performance Report', { align: 'center' }).moveDown(2)

        // Table Header
        doc.fontSize(10).text('Product Name', 50, 100)
        doc.text('Qty Sold', 250)
        doc.text('Revenue', 350)
        doc.text('Profit', 450)
        doc.moveDown(0.5)
        doc.moveTo(50, 120).lineTo(550, 120).stroke()

        // Table Rows
        let y = 140
        reportData.forEach((product: any) => {
            doc.fontSize(9)
            doc.text(product.productName.substring(0, 20), 50, y)
            doc.text(product.quantitySold.toString(), 250, y)
            doc.text(`₦${product.totalRevenue.toFixed(2)}`, 350, y)
            doc.text(`₦${product.profit.toFixed(2)}`, 450, y)
            y += 20
        })

        doc.end()
        stream.on('end', () => { })
        return stream
    }

    static generateProfitLossPDF(reportData: any, storeName: string): PassThrough {
        const doc = new PDFDocument()
        const stream = new PassThrough()

        doc.pipe(stream)

        // Header
        doc.fontSize(20).text(storeName, { align: 'center' }).moveDown(0.5)
        doc.fontSize(14).text('Profit & Loss Statement', { align: 'center' }).moveDown(2)
        doc.fontSize(10).text(`Period: ${reportData.period}`, { align: 'center' }).moveDown(2)

        // P&L Data
        doc.fontSize(11).text('Revenue & Costs', { underline: true }).moveDown(0.5)
        doc.fontSize(10)
        doc.text(`Total Revenue: ₦${reportData.totalRevenue.toFixed(2)}`)
        doc.text(`Cost of Goods Sold: ₦${reportData.totalCOGS.toFixed(2)}`)
        doc.moveDown(0.5)
        doc.font('Helvetica-Bold')
        doc.text(`Gross Profit: ₦${reportData.grossProfit.toFixed(2)}`)
        doc.font('Helvetica')
        doc.text(`Gross Margin: ${reportData.grossMarginPercent.toFixed(2)}%`)
        doc.moveDown(1)
        doc.font('Helvetica-Bold')
        doc.text(`Net Profit: ₦${reportData.netProfit.toFixed(2)}`)
        doc.font('Helvetica')
        doc.text(`Net Margin: ${reportData.netMarginPercent.toFixed(2)}%`)

        doc.end()
        stream.on('end', () => { })
        return stream
    }
}
