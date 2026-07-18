import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const cajaRouter = Router();

cajaRouter.use(requireAuth);

interface OrderItemSnapshot {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

async function buildConsolidated(cashSessionId: string) {
  const orders = await prisma.order.findMany({ where: { cashSessionId } });
  const completed = orders.filter((o) => o.status === "COMPLETADA");
  const anuladas = orders.filter((o) => o.status === "ANULADA");

  const byPaymentMethod: Record<string, { count: number; total: number }> = {
    EFECTIVO: { count: 0, total: 0 },
    TRANSFERENCIA: { count: 0, total: 0 },
  };
  const byCategoryUnits = new Map<string, number>();
  let cortesias = 0;

  const catByProduct = new Map(
    (await prisma.product.findMany({ include: { category: true } })).map((p) => [p.id, p.category.name]),
  );

  for (const order of completed) {
    byPaymentMethod[order.paymentMethod].count += 1;
    byPaymentMethod[order.paymentMethod].total += order.total;
    if (order.discountType === "CORTESIA") cortesias += 1;
    const items = order.items as unknown as OrderItemSnapshot[];
    for (const item of items) {
      const cat = catByProduct.get(item.productId) ?? "Sin categoría";
      byCategoryUnits.set(cat, (byCategoryUnits.get(cat) ?? 0) + item.quantity);
    }
  }

  return {
    totalVentas: completed.length,
    totalAnuladas: anuladas.length,
    totalCortesias: cortesias,
    totalIngresos: completed.reduce((s, o) => s + o.total, 0),
    byPaymentMethod,
    byCategoryUnits: Object.fromEntries(byCategoryUnits),
  };
}

cajaRouter.get("/actual", async (_req, res) => {
  const session = await prisma.cashSession.findFirst({
    where: { status: "ABIERTA" },
    orderBy: { openedAt: "desc" },
  });
  if (!session) return res.json({ session: null, consolidated: null, lastTurnNumber: 0 });

  const lastOrder = await prisma.order.findFirst({
    where: { cashSessionId: session.id },
    orderBy: { turnNumber: "desc" },
  });
  const consolidated = await buildConsolidated(session.id);
  res.json({ session, consolidated, lastTurnNumber: lastOrder?.turnNumber ?? 0 });
});

const abrirSchema = z.object({ base: z.number().nonnegative() });

cajaRouter.post("/abrir", requireRole("ADMIN"), async (req, res) => {
  const parsed = abrirSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Base inválida" });

  const open = await prisma.cashSession.findFirst({ where: { status: "ABIERTA" } });
  if (open) return res.status(409).json({ error: "Ya hay una caja abierta" });

  const session = await prisma.cashSession.create({
    data: { openingBase: parsed.data.base, openedByUserId: req.user!.sub },
  });
  res.status(201).json(session);
});

const cerrarSchema = z.object({ notes: z.string().optional() });

cajaRouter.post("/cerrar", requireRole("ADMIN"), async (req, res) => {
  const parsed = cerrarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const session = await prisma.cashSession.findFirst({ where: { status: "ABIERTA" } });
  if (!session) return res.status(404).json({ error: "No hay caja abierta" });

  const consolidated = await buildConsolidated(session.id);
  const expectedCash = session.openingBase + consolidated.byPaymentMethod.EFECTIVO.total;

  const closed = await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: "CERRADA",
      closedByUserId: req.user!.sub,
      closedAt: new Date(),
      notes: parsed.data.notes,
      consolidatedSnapshot: { ...consolidated, expectedCash, openingBase: session.openingBase },
    },
  });
  res.json(closed);
});

cajaRouter.get("/historial", requireRole("ADMIN"), async (_req, res) => {
  const sessions = await prisma.cashSession.findMany({
    where: { status: "CERRADA" },
    orderBy: { closedAt: "desc" },
    take: 30,
  });
  res.json(sessions);
});

const resetVentasSchema = z.object({ confirmation: z.literal("RESETEAR VENTAS") });

cajaRouter.post("/reset-ventas", requireRole("ADMIN"), async (req, res) => {
  const parsed = resetVentasSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Escribe exactamente "RESETEAR VENTAS" para confirmar' });
  }
  await prisma.$transaction([
    prisma.inventoryMovement.deleteMany({ where: { type: { in: ["VENTA", "ANULACION"] } } }),
    prisma.order.deleteMany({}),
    prisma.cashSession.deleteMany({}),
  ]);
  res.json({ ok: true });
});
