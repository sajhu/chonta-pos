import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const ventasRouter = Router();

ventasRouter.use(requireAuth);

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const createSchema = z.object({
  clientRequestId: z.string().min(1),
  items: z.array(itemSchema).min(1),
  paymentMethod: z.enum(["EFECTIVO", "TRANSFERENCIA"]),
  discountType: z.enum(["NONE", "CORTESIA", "MANUAL"]).default("NONE"),
  discountAmount: z.number().nonnegative().default(0),
  discountReason: z.string().optional(),
  authorizerPin: z.string().optional(),
});

ventasRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const input = parsed.data;

  const existing = await prisma.order.findUnique({ where: { clientRequestId: input.clientRequestId } });
  if (existing) return res.status(200).json(existing);

  if ((input.discountType === "MANUAL" || input.discountType === "CORTESIA") && !input.discountReason) {
    return res.status(400).json({ error: "Se requiere un motivo para la cortesía o el descuento" });
  }

  let authorizedByUserId: string | undefined;
  if ((input.discountType === "CORTESIA" || input.discountType === "MANUAL") && req.user!.role === "CAJERO") {
    if (!input.authorizerPin) {
      return res.status(403).json({ error: "Se requiere el PIN de un administrador para aplicar una cortesía o un descuento" });
    }
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true } });
    const admin = admins.find((a) => bcrypt.compareSync(input.authorizerPin!, a.pinHash));
    if (!admin) {
      return res.status(403).json({ error: "PIN de administrador inválido" });
    }
    authorizedByUserId = admin.id;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.findFirst({ where: { status: "ABIERTA" } });
      if (!session) throw new Error("CAJA_CERRADA");

      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { recipeItems: true },
      });
      if (products.length !== productIds.length) throw new Error("PRODUCTO_NO_ENCONTRADO");

      const productById = new Map(products.map((p) => [p.id, p]));

      const neededByInsumo = new Map<string, number>();
      for (const item of input.items) {
        const product = productById.get(item.productId)!;
        for (const recipe of product.recipeItems) {
          const needed = recipe.quantity * item.quantity;
          neededByInsumo.set(recipe.insumoId, (neededByInsumo.get(recipe.insumoId) ?? 0) + needed);
        }
      }

      const subtotal = input.items.reduce((sum, item) => {
        const product = productById.get(item.productId)!;
        return sum + product.price * item.quantity;
      }, 0);
      const total = input.discountType === "CORTESIA" ? 0 : Math.max(0, subtotal - input.discountAmount);

      const last = await tx.order.findFirst({
        where: { cashSessionId: session.id },
        orderBy: { turnNumber: "desc" },
      });
      const turnNumber = (last?.turnNumber ?? 0) + 1;

      const itemsSnapshot = input.items.map((item) => {
        const product = productById.get(item.productId)!;
        return {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
        };
      });

      const created = await tx.order.create({
        data: {
          turnNumber,
          cashSessionId: session.id,
          items: itemsSnapshot,
          paymentMethod: input.paymentMethod,
          discountType: input.discountType,
          discountAmount: input.discountType === "MANUAL" ? input.discountAmount : 0,
          discountReason: input.discountReason,
          subtotal,
          total,
          cashierId: req.user!.sub,
          authorizedByUserId,
          clientRequestId: input.clientRequestId,
        },
      });

      for (const [insumoId, needed] of neededByInsumo) {
        await tx.insumo.update({ where: { id: insumoId }, data: { stockQty: { decrement: needed } } });
        await tx.inventoryMovement.create({
          data: {
            insumoId,
            type: "VENTA",
            quantityDelta: -needed,
            orderId: created.id,
            userId: req.user!.sub,
            note: `Venta turno #${turnNumber}`,
          },
        });
      }

      return created;
    });

    res.status(201).json(order);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CAJA_CERRADA") {
        return res.status(409).json({ error: "La caja no está abierta. Pide a un administrador que la abra." });
      }
      if (err.message === "PRODUCTO_NO_ENCONTRADO") {
        return res.status(400).json({ error: "Uno de los productos ya no existe" });
      }
    }
    throw err;
  }
});

const anularSchema = z.object({ reason: z.string().min(1) });

ventasRouter.post("/:id/anular", async (req, res) => {
  const parsed = anularSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Se requiere un motivo para anular" });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUniqueOrThrow({ where: { id: req.params.id } });
      if (existing.status === "ANULADA") return existing;

      const ventaMovements = await tx.inventoryMovement.findMany({
        where: { orderId: existing.id, type: "VENTA" },
      });
      for (const m of ventaMovements) {
        await tx.insumo.update({ where: { id: m.insumoId }, data: { stockQty: { increment: -m.quantityDelta } } });
        await tx.inventoryMovement.create({
          data: {
            insumoId: m.insumoId,
            type: "ANULACION",
            quantityDelta: -m.quantityDelta,
            orderId: existing.id,
            userId: req.user!.sub,
            note: `Anulación turno #${existing.turnNumber}: ${parsed.data.reason}`,
          },
        });
      }

      return tx.order.update({
        where: { id: existing.id },
        data: {
          status: "ANULADA",
          cancelReason: parsed.data.reason,
          cancelledAt: new Date(),
          cancelledByUserId: req.user!.sub,
        },
      });
    });
    res.json(order);
  } catch {
    res.status(404).json({ error: "Venta no encontrada" });
  }
});

ventasRouter.get("/", async (req, res) => {
  const sessionId = typeof req.query.cashSessionId === "string" ? req.query.cashSessionId : undefined;
  const orders = await prisma.order.findMany({
    where: sessionId ? { cashSessionId: sessionId } : undefined,
    orderBy: { turnNumber: "desc" },
    take: 500,
  });
  res.json(orders);
});
