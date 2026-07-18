import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const reportesRouter = Router();

reportesRouter.use(requireAuth);

interface OrderItemSnapshot {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

async function loadCompletedOrders(cashSessionId?: string) {
  return prisma.order.findMany({
    where: {
      status: "COMPLETADA",
      ...(cashSessionId ? { cashSessionId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}

async function productCategoryMap() {
  const products = await prisma.product.findMany({ include: { category: true } });
  return new Map(products.map((p) => [p.id, p.category.name]));
}

function hourLabel(date: Date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

reportesRouter.get("/ventas-por-hora", async (req, res) => {
  const cashSessionId = typeof req.query.cashSessionId === "string" ? req.query.cashSessionId : undefined;
  const orders = await loadCompletedOrders(cashSessionId);
  const catByProduct = await productCategoryMap();

  const buckets = new Map<string, Map<string, { units: number; total: number }>>();

  for (const order of orders) {
    const label = hourLabel(order.createdAt);
    const items = order.items as unknown as OrderItemSnapshot[];
    for (const item of items) {
      const category = catByProduct.get(item.productId) ?? "Sin categoría";
      if (!buckets.has(label)) buckets.set(label, new Map());
      const catMap = buckets.get(label)!;
      const prev = catMap.get(category) ?? { units: 0, total: 0 };
      prev.units += item.quantity;
      prev.total += item.price * item.quantity;
      catMap.set(category, prev);
    }
  }

  const rows: { hour: string; category: string; units: number; total: number }[] = [];
  for (const [hour, catMap] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const [category, agg] of catMap) {
      rows.push({ hour, category, units: agg.units, total: agg.total });
    }
  }
  res.json(rows);
});

reportesRouter.get("/resumen", async (req, res) => {
  const cashSessionId = typeof req.query.cashSessionId === "string" ? req.query.cashSessionId : undefined;
  const orders = await loadCompletedOrders(cashSessionId);
  const anuladas = await prisma.order.count({
    where: { status: "ANULADA", ...(cashSessionId ? { cashSessionId } : {}) },
  });
  const catByProduct = await productCategoryMap();

  const byPaymentMethod: Record<string, { count: number; total: number }> = {
    EFECTIVO: { count: 0, total: 0 },
    TRANSFERENCIA: { count: 0, total: 0 },
  };
  const byCategory = new Map<string, { units: number; total: number }>();
  const byProduct = new Map<string, { name: string; units: number; total: number }>();
  let cortesias = 0;

  for (const order of orders) {
    byPaymentMethod[order.paymentMethod].count += 1;
    byPaymentMethod[order.paymentMethod].total += order.total;
    if (order.discountType === "CORTESIA") cortesias += 1;

    const items = order.items as unknown as OrderItemSnapshot[];
    for (const item of items) {
      const category = catByProduct.get(item.productId) ?? "Sin categoría";
      const cat = byCategory.get(category) ?? { units: 0, total: 0 };
      cat.units += item.quantity;
      cat.total += item.price * item.quantity;
      byCategory.set(category, cat);

      const prod = byProduct.get(item.productId) ?? { name: item.name, units: 0, total: 0 };
      prod.units += item.quantity;
      prod.total += item.price * item.quantity;
      byProduct.set(item.productId, prod);
    }
  }

  const allInsumos = await prisma.insumo.findMany();
  const lowStockInsumos = allInsumos.filter((i) => i.stockQty <= i.minThreshold);

  res.json({
    totalVentas: orders.length,
    totalAnuladas: anuladas,
    totalCortesias: cortesias,
    totalIngresos: orders.reduce((s, o) => s + o.total, 0),
    byPaymentMethod,
    byCategory: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })),
    topProducts: [...byProduct.values()].sort((a, b) => b.units - a.units).slice(0, 10),
    lowStockInsumos,
  });
});

reportesRouter.get("/export.csv", async (req, res) => {
  const cashSessionId = typeof req.query.cashSessionId === "string" ? req.query.cashSessionId : undefined;
  const orders = await prisma.order.findMany({
    where: cashSessionId ? { cashSessionId } : undefined,
    orderBy: { turnNumber: "asc" },
    include: { cashier: { select: { name: true } } },
  });

  const header = ["turno", "fecha_hora", "cajero", "items", "metodo_pago", "descuento_tipo", "subtotal", "total", "estado"];
  const lines = [header.join(",")];
  for (const order of orders) {
    const items = (order.items as unknown as OrderItemSnapshot[])
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(" | ");
    lines.push(
      [
        order.turnNumber,
        order.createdAt.toISOString(),
        order.cashier.name,
        `"${items.replace(/"/g, '""')}"`,
        order.paymentMethod,
        order.discountType,
        order.subtotal.toFixed(2),
        order.total.toFixed(2),
        order.status,
      ].join(","),
    );
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ventas.csv"`);
  res.send(lines.join("\n"));
});
