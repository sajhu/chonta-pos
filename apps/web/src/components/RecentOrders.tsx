import { useState } from "react";
import type { Order } from "../lib/types.js";

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function RecentOrders({
  orders,
  onAnular,
}: {
  orders: Order[];
  onAnular: (orderId: string, reason: string) => Promise<void>;
}) {
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmCancel(orderId: string) {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onAnular(orderId, reason.trim());
      setCancelingId(null);
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  if (orders.length === 0) return null;

  return (
    <div className="border-t pt-3">
      <div className="text-sm font-medium mb-2">Últimas ventas</div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {orders.slice(0, 15).map((o) => (
          <div key={o.id} className="text-sm border rounded-lg p-2">
            <div className="flex items-center justify-between">
              <span>
                #{o.turnNumber} · {o.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
              </span>
              <span className="font-medium">{formatCOP(o.total)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span
                className={
                  o.status === "ANULADA" ? "text-red-600 text-xs font-medium" : "text-slate-400 text-xs"
                }
              >
                {o.status === "ANULADA" ? `Anulada: ${o.cancelReason ?? ""}` : "Completada"}
              </span>
              {o.status === "COMPLETADA" && cancelingId !== o.id && (
                <button onClick={() => setCancelingId(o.id)} className="text-xs text-red-600 underline">
                  Anular
                </button>
              )}
            </div>
            {cancelingId === o.id && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  placeholder="Motivo de la anulación"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex-1 border rounded-lg p-1.5 text-xs"
                />
                <button
                  onClick={() => confirmCancel(o.id)}
                  disabled={busy || !reason.trim()}
                  className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => {
                    setCancelingId(null);
                    setReason("");
                  }}
                  className="px-2 py-1 rounded-lg border text-xs"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
