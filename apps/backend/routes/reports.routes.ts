import { Router, Request, Response } from 'express'
import { ReportService } from '../services/report.service'
import { PDFService } from '../services/pdf.service'
import { checkRole } from '../middleware/role.middleware';
import { PrismaClient, UserRole } from '@prisma/client'

interface AuthRequest extends Request {
    user?: { tenantId: string; id: string; role: string }
}

const router = Router()
const prisma = new PrismaClient()

// GET /api/reports/sales
router.get('/sales', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: any, res: any) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const { startDate, endDate, groupBy = 'daily' } = req.query

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' })
        }

        const start = new Date(startDate as string)
        const end = new Date(endDate as string)

        const report = await ReportService.generateSalesReport(
            tenantId,
            start,
            end,
            groupBy as 'daily' | 'weekly' | 'monthly'
        )

        return res.json(report)
    } catch (err: any) {
        console.error('GET /reports/sales error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})

// GET /api/reports/products
router.get('/products', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: any, res: any) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const { startDate, endDate, limit = '10' } = req.query

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' })
        }

        const start = new Date(startDate as string)
        const end = new Date(endDate as string)

        const report = await ReportService.generateProductReport(
            tenantId,
            start,
            end,
            parseInt(limit as string)
        )

        return res.json(report)
    } catch (err: any) {
        console.error('GET /reports/products error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})

// GET /api/reports/profit-loss
router.get('/profit-loss', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: any, res: any) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const { startDate, endDate } = req.query

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' })
        }

        const start = new Date(startDate as string)
        const end = new Date(endDate as string)

        const report = await ReportService.generateProfitLoss(tenantId, start, end)

        return res.json(report)
    } catch (err: any) {
        console.error('GET /reports/profit-loss error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})

// GET /api/reports/tax
router.get('/tax', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: any, res: any) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const { startDate, endDate } = req.query

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' })
        }

        const start = new Date(startDate as string)
        const end = new Date(endDate as string)

        const report = await ReportService.generateTaxReport(tenantId, start, end)

        return res.json(report)
    } catch (err: any) {
        console.error('GET /reports/tax error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})

// GET /api/reports/sales/export?format=pdf
router.get('/sales/export', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: any, res: any) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) return res.status(401).json({ error: 'Unauthorized' })

        const { startDate, endDate, format = 'pdf' } = req.query

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' })
        }

        const start = new Date(startDate as string)
        const end = new Date(endDate as string)

        const reportData = await ReportService.generateSalesReport(tenantId, start, end, 'daily')

        const settings = await prisma.storeSettings.findUnique({ where: { tenantId } })
        const storeName = settings?.storeName || 'Store'

        if (format === 'pdf') {
            const pdfStream = PDFService.generateSalesReportPDF(reportData, storeName)
            res.setHeader('Content-Type', 'application/pdf')
            res.setHeader('Content-Disposition', 'attachment; filename="sales-report.pdf"')
            pdfStream.pipe(res)
        } else {
            return res.status(400).json({ error: 'Unsupported format' })
        }
    } catch (err: any) {
        console.error('GET /reports/sales/export error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})

// Similar export endpoints for products, profit-loss, tax...

export default router

