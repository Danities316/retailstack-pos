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
            vatEnabled,
            vatRate,
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
                vatEnabled,
                vatRate,
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
                vatEnabled: vatEnabled ?? false,
                vatRate: vatRate ?? 0,
            }
        })

        res.json(updated)
    } catch (err: any) {
        console.error('PUT /settings error:', err)
        res.status(500).json({ error: 'Server error' })

    }
})


export default router;