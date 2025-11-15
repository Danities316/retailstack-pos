import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';

const router = Router();
const prisma = new PrismaClient();

// All category management routes are protected and restricted
router.use(checkRole([UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN]));

// POST /api/categories - Create a new category
router.post('/', async (req: AuthRequest, res) => {
  const { categoryName, parentId } = req.body;
  const tenantId = req.user!.tenantId;

  if (!categoryName) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  try {
    const newCategory = await prisma.category.create({
      data: { categoryName, parentId, updatedAt: new Date(), tenantId: tenantId! },
    });
    res.status(201).json(newCategory);
  } catch (error: any) {
    console.log('Failed to create category.', error.message)
    res.status(500).json({ error: 'Failed to create category.', message: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/categories - List all categories for a tenant as a nested tree
router.get('/', async (req: AuthRequest, res) => {
  const tenantId = req.user!.tenantId;

  const categories = await prisma.category.findMany({ where: { tenantId } });

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
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  try {
    const category = await prisma.category.findFirst({
      where: { id, tenantId },
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
router.put('/:id', async (req: AuthRequest, res: any) => {
  const { id } = req.params;
  const { categoryName, updatedAt, parentId } = req.body;
  const tenantId = req.user!.tenantId;

  try {
    const existing = await prisma.category.findUnique({ where: { id, tenantId } });

    if(!existing || new Date(updatedAt) < existing.updatedAt) {
       const updatedCategory = await prisma.category.update({
      where: { id, tenantId },
      data: { categoryName, parentId, updatedAt: new Date(updatedAt) },
    });
     return res.json(updatedCategory);
    }
    res.status(400).json({ error: 'No update performed. The provided updatedAt is not newer.' });
  } catch (error) {
    res.status(404).json({ error: 'Category not found or you do not have permission to update it.' });
  }
});

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', async (req: AuthRequest, res) => {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    try {
        // Best Practice: Prevent deletion if the category has products or sub-categories
        const hasProducts = await prisma.product.count({ where: { categoryId: id, tenantId } });
        const hasChildren = await prisma.category.count({ where: { parentId: id, tenantId } });

        if (hasProducts > 0 || hasChildren > 0) {
            res.status(400).json({ error: 'Cannot delete category. Reassign its products and sub-categories first.' });
            return;
        }

        await prisma.category.delete({ where: { id, tenantId } });
        res.status(204).send();
    } catch (error) {
        res.status(404).json({ error: 'Category not found or you do not have permission to delete it.' });
    }
});

export default router;