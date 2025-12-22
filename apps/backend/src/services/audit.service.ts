import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface LoginHistoryInput {
    userId: string
    tenantId?: string
    success: boolean
    reason?: string
    ip?: string
    userAgent?: string
}

interface AuditLogInput {
    userId: string
    tenantId: string
    action: string
    resourceType: string
    resourceId?: string
    changes?: Record<string, any>
    description?: string
    ip?: string
    userAgent?: string
}

export class AuditService {
    /**
     * Log a login attempt (success or failure)
     */
    static async logLogin(input: LoginHistoryInput) {
        try {
            return await prisma.loginHistory.create({
                data: {
                    userId: input.userId,
                    tenantId: input.tenantId || 'unknown',
                    success: input.success,
                    reason: input.reason,
                    ip: input.ip,
                    userAgent: input.userAgent,
                },
            })
        } catch (error) {
            console.error('Error logging login:', error)
            // Don't throw - logging shouldn't block the main operation
        }
    }

    /**
     * Log an audit event
     */
    static async logAction(input: AuditLogInput) {
        try {
            return await prisma.auditLog.create({
                data: {
                    userId: input.userId,
                    tenantId: input.tenantId,
                    action: input.action,
                    resourceType: input.resourceType,
                    resourceId: input.resourceId,
                    changes: input.changes,
                    description: input.description,
                    ip: input.ip,
                    userAgent: input.userAgent,
                },
            })
        } catch (error) {
            console.error('Error logging audit action:', error)
            // Don't throw - logging shouldn't block the main operation
        }
    }

    /**
     * Get login history for a user
     */
    static async getUserLoginHistory(userId: string, limit: number = 50) {
        try {
            return await prisma.loginHistory.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
            })
        } catch (error) {
            console.error('Error retrieving login history:', error)
            return []
        }
    }

    /**
     * Get login history for a tenant
     */
    static async getTenantLoginHistory(tenantId: string, limit: number = 100) {
        try {
            return await prisma.loginHistory.findMany({
                where: { tenantId },
                include: {
                    user: {
                        select: { id: true, email: true, name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            })
        } catch (error) {
            console.error('Error retrieving tenant login history:', error)
            return []
        }
    }

    /**
     * Get audit logs for a tenant
     */
    static async getTenantAuditLogs(tenantId: string, limit: number = 100, action?: string) {
        try {
            return await prisma.auditLog.findMany({
                where: {
                    tenantId,
                    ...(action && { action }),
                },
                include: {
                    user: {
                        select: { id: true, email: true, name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            })
        } catch (error) {
            console.error('Error retrieving audit logs:', error)
            return []
        }
    }

    /**
     * Get audit logs for a specific resource
     */
    static async getResourceAuditLogs(tenantId: string, resourceType: string, resourceId: string) {
        try {
            return await prisma.auditLog.findMany({
                where: {
                    tenantId,
                    resourceType,
                    resourceId,
                },
                include: {
                    user: {
                        select: { id: true, email: true, name: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            })
        } catch (error) {
            console.error('Error retrieving resource audit logs:', error)
            return []
        }
    }

    /**
     * Get recent suspicious activity (multiple failed logins in short time)
     */
    static async getSuspiciousActivity(tenantId: string, minutes: number = 30) {
        try {
            const since = new Date(Date.now() - minutes * 60 * 1000)
            const failed = await prisma.loginHistory.groupBy({
                by: ['userId'],
                where: {
                    tenantId,
                    success: false,
                    createdAt: { gte: since },
                },
                _count: {
                    id: true,
                },
                having: {
                    id: {
                        _count: {
                            gt: 3, // More than 3 failed attempts
                        },
                    },
                },
            })

            if (failed.length === 0) return []

            // Get user details
            const userIds = failed.map((f) => f.userId)
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, email: true, name: true },
            })

            return failed.map((f) => ({
                ...f,
                user: users.find((u) => u.id === f.userId),
                failedAttempts: f._count.id,
            }))
        } catch (error) {
            console.error('Error retrieving suspicious activity:', error)
            return []
        }
    }
}
