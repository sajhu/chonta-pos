import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  res.json(categories);
});

const upsertSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

categoriesRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const category = await prisma.category.create({ data: parsed.data });
  res.status(201).json(category);
});

categoriesRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(category);
});

categoriesRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
