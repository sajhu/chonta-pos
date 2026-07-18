import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import type { Insumo } from "../lib/types.js";

export function LowStockBadge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lowStock, setLowStock] = useState<Insumo[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const insumos = await api.get<Insumo[]>("/insumos");
        if (!cancelled) setLowStock(insumos.filter((i) => i.stockQty <= i.minThreshold));
      } catch {
        // ignore — the badge just won't update this cycle
      }
    }

    load();
    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  if (lowStock.length === 0) return null;

  const label = `⚠ ${lowStock.length} insumo${lowStock.length === 1 ? "" : "s"} bajo${lowStock.length === 1 ? "" : "s"}`;
  const title = lowStock.map((i) => `${i.name}: ${i.stockQty} ${i.unit.toLowerCase()} (mínimo ${i.minThreshold})`).join("\n");

  if (user?.role !== "ADMIN") {
    return (
      <span
        title={title}
        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600 text-white whitespace-nowrap"
      >
        {label}
      </span>
    );
  }

  return (
    <button
      title={title}
      onClick={() => navigate("/admin/insumos")}
      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600 text-white whitespace-nowrap hover:bg-red-700"
    >
      {label}
    </button>
  );
}
