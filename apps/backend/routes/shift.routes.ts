import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';

const router = Router();
const prisma = new PrismaClient();

// ====================================================================
// GET /api/shifts/active-shift
// Checks the user's current clock-in status.
// ====================================================================
router.get('/active-shift', async (req: AuthRequest, res: Response) => {
    const cashierId = req.user!.userId;
    const tenantId = req.user!.tenantId;

    try {
        const activeShift = await prisma.shift.findFirst({
            where: {
                cashierId,
                tenantId,
                endTime: null,
            },
            // Select only necessary data to minimize payload
            select: {
                id: true,
                startTime: true,
                startFloat: true,
            }
        });

        // Returns null if no active shift, or the shift object
        res.json(activeShift);
    } catch (error) {
        console.error('Error fetching active shift:', error);
        res.status(500).json({ error: 'Failed to check active shift status.' });
    }
});


// ====================================================================
// POST /api/shifts/clock-in
// Edge Case Mitigation: Double Clock-In check
// ====================================================================
router.post('/clock-in', async (req: AuthRequest, res: any) => {
    const cashierId = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const { startFloat } = req.body;

    if (startFloat === undefined || isNaN(parseFloat(startFloat))) {
        res.status(400).json({ error: 'Starting cash float is required to clock in.' });
        return;
    }

    try {
        // 1. Double Clock-In Check
        const existingShift = await prisma.shift.findFirst({
            where: { cashierId, tenantId, endTime: null },
        });

        if (existingShift) {
            res.status(409).json({
                error: 'Conflict: User is already clocked in.',
                shiftId: existingShift.id,
            });
        }
        // 2. Create the new active shift
        const newShift = await prisma.shift.create({
            data: {
                cashierId,
                tenantId,
                startFloat: new Decimal(startFloat),
            }
        });

        res.status(201).json({
            message: 'Successfully clocked in.',
            shift: newShift,
        });

    } catch (error) {
        console.error('Clock-in failed:', error);
        res.status(500).json({ error: 'Failed to process clock-in.' });
    }
});


// ====================================================================
// POST /api/shifts/clock-out
// Closes the current active shift.
// ====================================================================
router.post('/clock-out/:shiftId', async (req: AuthRequest, res: any) => {
    const { id } = req.params;
    const cashierId = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const { endFloat, notes } = req.body;

    // Ensure endFloat is provided for reconciliation
    if (endFloat === undefined || endFloat === null) {
        return res.status(400).json({ error: 'Final cash count (endFloat) is required for clock-out.' });
    }

    // Ensure it's a number/string that can be converted to Decimal
    if (typeof endFloat !== 'number' && typeof endFloat !== 'string') {
        return res.status(400).json({ error: 'endFloat must be a number.' });
    }

    try {
        // 1. Find the active shift by ID and ownership
        const activeShift = await prisma.shift.findFirst({
            where: { id, cashierId, tenantId, endTime: null },
        });

        if (!activeShift) {
            return res.status(404).json({ error: 'No active shift found with that ID or you do not have permission.' });
        }

        // 2. Close the shift and record the reconciliation data
        const closedShift = await prisma.shift.update({
            where: { id: activeShift.id },
            data: {
                endTime: new Date(),
                // Store endFloat as Decimal
                endFloat: new Decimal(String(endFloat)),
                // Future: reconciliation object
                // reconciliation: { ... }, 
            },
            select: {
                id: true,
                startTime: true,
                endTime: true,
                startFloat: true, // Include startFloat for logging
                endFloat: true,   // Include endFloat for logging
            }
        });

        res.json({
            message: 'Successfully clocked out.',
            shift: closedShift,
        });

    } catch (error) {
        console.error('Clock-out failed:', error);
        res.status(500).json({ error: 'Failed to process clock-out.' });
    }
});

// ====================================================================
// PATCH /api/shifts/:id/force-close (Manager-only endpoint)
// Edge Case Mitigation: Manager Overrides (Force Clock-Out)
// ====================================================================
router.patch('/:id/force-close',
    checkRole([UserRole.OWNER, UserRole.MANAGER]),
    async (req: AuthRequest, res: any) => {

        const { id } = req.params;
        const tenantId = req.user!.tenantId;
        const { endTime, reason } = req.body; // reason for audit log

        // Simple validation
        if (!endTime || !reason) {
            return res.status(400).json({ error: 'Missing required fields: endTime and reason for force-close.' });
        }

        try {
            const shiftToClose = await prisma.shift.findUnique({
                where: { id, tenantId },
            });

            if (!shiftToClose) {
                return res.status(404).json({ error: 'Shift not found.' });
            }

            if (shiftToClose.endTime) {
                return res.status(409).json({ error: 'Shift is already closed.' });
            }

            // 1. Ensure the new endTime is logical (after startTime)
            if (new Date(endTime) <= shiftToClose.startTime) {
                return res.status(400).json({ error: 'Force-close time must be after the shift start time.' });
            }

            // 2. Perform the force update
            const managerReconciliation = {
                managerId: req.user!.userId,
                managerName: req.user!.name,
                forceCloseTime: new Date(),
                notes: `Force-closed by manager at ${new Date().toISOString()}. Reason: ${reason}`,
            };

            const closedShift = await prisma.shift.update({
                where: { id },
                data: {
                    endTime: new Date(endTime),
                    reconciliation: managerReconciliation, // Log the override details
                },
            });

            res.json({
                message: 'Shift successfully force-closed and logged.',
                shift: closedShift,
            });

        } catch (error) {
            console.error('Shift force-close failed:', error);
            res.status(500).json({ error: 'Failed to force-close shift.' });
        }
    });

export default router;