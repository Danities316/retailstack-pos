import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';

const router = Router();
const prisma = new PrismaClient();
// Read-only routes — CASHIER, MANAGER, OWNER, SUPER_ADMIN can list and view categories
const canRead = checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.SUPER_ADMIN]);
// Write routes — MANAGER, OWNER, SUPER_ADMIN only. CASHIER cannot create, edit, or delete.
const canWrite = checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]);


// POST /api/categories - Create a new category
router.post('/', canWrite, async (req: AuthRequest, res) => {
  const { categoryName, parentId } = req.body;
  const tenantId = req.user!.tenantId as any;

  if (!categoryName) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  try {
    const newCategory = await prisma.$transaction(async (tx) => {
      const created = await tx.category.create({
        data: { categoryName, parentId, updatedAt: new Date(), tenantId: tenantId! },
      }) as any;

      await (tx as any).syncChange.create({
        data: {
          tenantId: tenantId!,
          entityType: 'category',
          entityId: created.id,
          version: created.version,
          operation: 'CREATE',
          data: created,
          deleted: created.deleted,
        },
      });

      return created;
    });
    res.status(201).json(newCategory);
  } catch (error: any) {
    console.log('Failed to create category.', error.message)
    res.status(500).json({ error: 'Failed to create category.', message: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/categories - List all categories for a tenant as a nested tree
router.get('/', canRead, async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId as any;

  const categories = await prisma.category.findMany({ where: { tenantId, deleted: false } as any });

  // Best Practice: Build a tree structure for easy frontend rendering
  const categoryMap = new Map(categories.map((c: any) => [c.id, { ...c, children: [] }]));
  const tree: any[] = [];

  for (const category of categoryMap.values()) {
    if (category.parentId && categoryMap.has(category.parentId)) {
      (categoryMap.get(category.parentId)!.children as any[]).push(category);
    } else {
      tree.push(category);
    }
  }

  res.json(tree);
});

// GET /api/categories/:id - Get a single category by ID
router.get('/:id', canRead, async (req: AuthRequest, res) => {
  const { id } = req.params as any;
  const tenantId = req.user!.tenantId as any;

  try {
    const category = await prisma.category.findFirst({
      where: { id, tenantId, deleted: false } as any,
    });
    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch category.' });
  }
});

// PUT /api/categories/:id - Update a category
router.put('/:id', canWrite, async (req: AuthRequest, res: any) => {
  const { id } = req.params as any;
  const { categoryName, updatedAt, parentId } = req.body;
  const tenantId = req.user!.tenantId as any;

  try {
    const existing = await prisma.category.findUnique({ where: { id, tenantId } });

    if (!existing || new Date(updatedAt) < existing.updatedAt) {
      const updatedCategory = await prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id, tenantId },
          data: {
            categoryName,
            parentId,
            updatedAt: new Date(updatedAt),
            version: { increment: 1 },
          } as any,
        }) as any;

        await (tx as any).syncChange.create({
          data: {
            tenantId: tenantId!,
            entityType: 'category',
            entityId: updated.id,
            version: updated.version,
            operation: 'UPDATE',
            data: updated,
            deleted: updated.deleted,
          },
        });

        return updated;
      });
      return res.json(updatedCategory);
    }
    res.status(400).json({ error: 'No update performed. The provided updatedAt is not newer.' });
  } catch (error) {
    res.status(404).json({ error: 'Category not found or you do not have permission to update it.' });
  }
});

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', canWrite, async (req: AuthRequest, res) => {
  const { id } = req.params as any;
  const tenantId = req.user!.tenantId as any;

  try {
    // Best Practice: Prevent deletion if the category has products or sub-categories
    const hasProducts = await prisma.product.count({ where: { categoryId: id, tenantId, deleted: false } as any });
    const hasChildren = await prisma.category.count({ where: { parentId: id, tenantId, deleted: false } as any });

    if (hasProducts > 0 || hasChildren > 0) {
      res.status(400).json({ error: 'Cannot delete category. Reassign its products and sub-categories first.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id, tenantId },
        data: {
          deleted: true,
          deletedAt: new Date(),
          version: { increment: 1 },
        } as any,
      }) as any;

      await (tx as any).syncChange.create({
        data: {
          tenantId: tenantId!,
          entityType: 'category',
          entityId: updated.id,
          version: updated.version,
          operation: 'DELETE',
          data: updated,
          deleted: updated.deleted,
        },
      });
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Category not found or you do not have permission to delete it.' });
  }
});

export default router;