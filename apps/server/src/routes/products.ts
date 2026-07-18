import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get("/", async (req, res) => {
  const includeInactive = req.query.all === "1";
  const products = await prisma.product.findMany({
    where: includeInactive ? undefined : { active: true },
    include: { category: true, recipeItems: { include: { insumo: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  res.json(products);
});

const recipeItemSchema = z.object({
  insumoId: z.string().min(1),
  quantity: z.number().positive(),
});

const upsertSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().min(1),
  price: z.number().nonnegative(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  recipeItems: z.array(recipeItemSchema).min(1),
});

productsRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { recipeItems, ...productData } = parsed.data;

  const product = await prisma.product.create({
    data: {
      ...productData,
      recipeItems: { create: recipeItems },
    },
    include: { category: true, recipeItems: { include: { insumo: true } } },
  });
  res.status(201).json(product);
});

productsRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = upsertSchema.partial({ recipeItems: true } as never).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { recipeItems, ...productData } = parsed.data;

  const product = await prisma.$transaction(async (tx) => {
    if (recipeItems) {
      await tx.recipeItem.deleteMany({ where: { productId: req.params.id } });
      await tx.recipeItem.createMany({
        data: recipeItems.map((r) => ({ ...r, productId: req.params.id })),
      });
    }
    return tx.product.update({
      where: { id: req.params.id },
      data: productData,
      include: { category: true, recipeItems: { include: { insumo: true } } },
    });
  });
  res.json(product);
});

productsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
  res.status(204).end();
});
