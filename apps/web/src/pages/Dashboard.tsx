import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api.js";
import { Skeleton, StatCardsSkeleton } from "../components/Skeleton.js";

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

interface HourRow {
  hour: string;
  category: string;
  units: number;
  total: number;
}

interface Resumen {
  totalVentas: number;
  totalAnuladas: number;
  totalCortesias: number;
  totalIngresos: number;
  byPaymentMethod: Record<string, { count: number; total: number }>;
  byCategory: { category: string; units: number; total: number }[];
  topProducts: { name: string; units: number; total: number }[];
  lowStockInsumos: { id: string; name: string; stockQty: number; minThreshold: number; unit: string }[];
}

const COLORS = ["#0f172a", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

export function Dashboard() {
  const [rows, setRows] = useState<HourRow[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [metric, setMetric] = useState<"units" | "total">("units");

  async function load() {
    const [hourRows, summary] = await Promise.all([
      api.get<HourRow[]>("/reportes/ventas-por-hora"),
      api.get<Resumen>("/reportes/resumen"),
    ]);
    setRows(hourRows);
    setResumen(summary);
    setLoaded(true);
  }

  useEffect(() => {
    load().catch(() => {});
    const interval = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))], [rows]);

  const chartData = useMemo(() => {
    const byHour = new Map<string, Record<string, number | string>>();
    for (const row of rows) {
      const label = new Date(row.hour).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      if (!byHour.has(row.hour)) byHour.set(row.hour, { hour: label, sortKey: row.hour });
      byHour.get(row.hour)![row.category] = metric === "units" ? row.units : row.total;
    }
    return [...byHour.values()].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
  }, [rows, metric]);

  return (
    <div className="p-4 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Ventas del evento</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMetric("units")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${metric === "units" ? "bg-slate-900 text-white" : "bg-white"}`}
          >
            Unidades
          </button>
          <button
            onClick={() => setMetric("total")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${metric === "total" ? "bg-slate-900 text-white" : "bg-white"}`}
          >
            Valor $
          </button>
        </div>
      </div>

      {!loaded ? (
        <StatCardsSkeleton />
      ) : (
        resumen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Ventas" value={String(resumen.totalVentas)} />
            <StatCard label="Ingresos" value={formatCOP(resumen.totalIngresos)} />
            <StatCard label="Cortesías" value={String(resumen.totalCortesias)} />
            <StatCard label="Anuladas" value={String(resumen.totalAnuladas)} />
          </div>
        )
      )}

      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold mb-3">Ventas por hora ({metric === "units" ? "unidades" : "valor $"}) por categoría</h2>
        {!loaded ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip formatter={(v: number) => (metric === "total" ? formatCOP(v) : v)} />
                <Legend />
                {categories.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} fill={COLORS[i % COLORS.length]} stackId="a" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!loaded && (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {resumen && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Por método de pago</h2>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(resumen.byPaymentMethod).map(([method, v]) => (
                  <tr key={method} className="border-b last:border-0">
                    <td className="py-2">{method === "EFECTIVO" ? "Efectivo" : "Transferencia"}</td>
                    <td className="py-2 text-right">{v.count} ventas</td>
                    <td className="py-2 text-right font-medium">{formatCOP(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Top productos</h2>
            <table className="w-full text-sm">
              <tbody>
                {resumen.topProducts.map((p) => (
                  <tr key={p.name} className="border-b last:border-0">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right">{p.units} u.</td>
                    <td className="py-2 text-right font-medium">{formatCOP(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resumen && resumen.lowStockInsumos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="font-semibold text-red-700 mb-2">Insumos con stock bajo</h2>
          <ul className="text-sm text-red-700 space-y-1">
            {resumen.lowStockInsumos.map((i) => (
              <li key={i.id}>
                {i.name}: {i.stockQty} {i.unit.toLowerCase()} (mínimo {i.minThreshold})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
