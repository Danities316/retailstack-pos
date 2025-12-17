import { Router, Request, Response } from 'express'
import { PrismaClient, UserRole } from '@prisma/client';
import { checkRole } from '../middleware/role.middleware';

interface AuthRequest extends Request {
    user?: { tenantId: string;[key: string]: any };
}

const router = Router()
const prisma = new PrismaClient()

// GET /api/settings - Get store settings for tenant
router.get('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }

        const settings = await prisma.storeSettings.findUnique({
            where: { tenantId }
        })

        if (!settings) {
            // Create default settings if not exists
            const newSettings = await prisma.storeSettings.create({
                data: { tenantId, storeName: 'My Store' }
            })
            res.json(newSettings)
            return
        }

        res.json(settings)
    } catch (err: any) {
        console.error('GET /settings error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

// PUT /api/settings - Update store settings
router.put('/', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }

        const {
            storeName,
            storeAddress,
            storePhone,
            storeTaxId,
            operatingHoursStart,
            operatingHoursEnd,
            businessType,
            currency,
            language,
            dateFormat,
            timeFormat,
            numberFormat,
            receiptHeader,
            receiptFooter,
            theme,
            offlineModeEnabled,
            autoSyncInterval,
        } = req.body

        const updated = await prisma.storeSettings.upsert({
            where: { tenantId },
            update: {
                storeName,
                storeAddress,
                storePhone,
                storeTaxId,
                operatingHoursStart,
                operatingHoursEnd,
                businessType,
                currency,
                language,
                dateFormat,
                timeFormat,
                numberFormat,
                receiptHeader,
                receiptFooter,
                theme,
                offlineModeEnabled,
                autoSyncInterval,
            },
            create: {
                tenantId,
                storeName: storeName || 'My Store',
                currency,
                language,
                dateFormat,
                timeFormat,
                numberFormat,
                receiptHeader,
                receiptFooter,
                theme,
                offlineModeEnabled,
                autoSyncInterval,
            }
        })

        res.json(updated)
    } catch (err: any) {
        console.error('PUT /settings error:', err)
        res.status(500).json({ error: 'Server error' })

    }
})
// GET /api/settings/email-templates - Get all email templates
router.get('/email-templates', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }

        const templates = await prisma.emailTemplate.findMany({
            where: { tenantId }
        })

        res.json(templates)
    } catch (err: any) {
        console.error('GET /email-templates error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})
// PUT /api/settings/email-templates/:templateType - Update email template
router.put('/email-templates/:templateType', checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]), async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId
        if (!tenantId) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }

        const { templateType } = req.params
        const { subject, htmlContent, variables, isActive } = req.body

        const updated = await prisma.emailTemplate.upsert({
            where: {
                tenantId_templateType: { tenantId, templateType }
            },
            update: { subject, htmlContent, variables, isActive },
            create: {
                tenantId,
                templateType,
                subject,
                htmlContent,
                variables,
                isActive
            }
        })

        res.json(updated)
    } catch (err: any) {
        console.error('PUT /email-templates error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

export default router;