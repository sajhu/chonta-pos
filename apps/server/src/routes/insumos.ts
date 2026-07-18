import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const insumosRouter = Router();

insumosRouter.use(requireAuth);

insumosRouter.get("/", async (_req, res) => {
  const insumos = await prisma.insumo.findMany({ orderBy: { name: "asc" } });
  res.json(insumos);
});

const createSchema = z.object({
  name: z.string().min(1),
  unit: z.enum(["ML", "UNIDAD", "GR"]),
  minThreshold: z.number().nonnegative().optional(),
  packageLabel: z.string().min(1).optional(),
  packageSize: z.number().positive().optional(),
});

insumosRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const insumo = await prisma.insumo.create({ data: { ...parsed.data, stockQty: 0 } });
  res.status(201).json(insumo);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.enum(["ML", "UNIDAD", "GR"]).optional(),
  minThreshold: z.number().nonnegative().optional(),
  packageLabel: z.string().min(1).nullable().optional(),
  packageSize: z.number().positive().nullable().optional(),
});

insumosRouter.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const insumo = await prisma.insumo.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(insumo);
});

const cargaSchema = z.object({
  quantity: z.number().positive(),
  note: z.string().optional(),
});

insumosRouter.post("/:id/carga-inicial", requireRole("ADMIN"), async (req, res) => {
  const parsed = cargaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const insumo = await prisma.$transaction(async (tx) => {
    const updated = await tx.insumo.update({
      where: { id: req.params.id },
      data: { stockQty: { increment: parsed.data.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        insumoId: req.params.id,
        type: "CARGA_INICIAL",
        quantityDelta: parsed.data.quantity,
        note: parsed.data.note,
        userId: req.user!.sub,
      },
    });
    return updated;
  });
  res.json(insumo);
});

const bajaSchema = z.object({
  quantity: z.number().positive(),
  reason: z.string().min(1),
});

insumosRouter.post("/:id/baja", requireRole("ADMIN"), async (req, res) => {
  const parsed = bajaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    const insumo = await prisma.$transaction(async (tx) => {
      const current = await tx.insumo.findUniqueOrThrow({ where: { id: req.params.id } });
      if (current.stockQty < parsed.data.quantity) {
        throw new Error("STOCK_INSUFICIENTE");
      }
      const updated = await tx.insumo.update({
        where: { id: req.params.id },
        data: { stockQty: { decrement: parsed.data.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          insumoId: req.params.id,
          type: "BAJA",
          quantityDelta: -parsed.data.quantity,
          note: parsed.data.reason,
          userId: req.user!.sub,
        },
      });
      return updated;
    });
    res.json(insumo);
  } catch (err) {
    if (err instanceof Error && err.message === "STOCK_INSUFICIENTE") {
      return res.status(400).json({ error: "No hay suficiente stock para dar de baja esa cantidad" });
    }
    throw err;
  }
});

insumosRouter.get("/:id/movimientos", requireRole("ADMIN"), async (req, res) => {
  const movimientos = await prisma.inventoryMovement.findMany({
    where: { insumoId: req.params.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(movimientos);
});
