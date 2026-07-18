import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { getToken } from "../lib/auth.js";
import type { CajaActual, CashSession } from "../lib/types.js";

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export function Caja() {
  const { user } = useAuth();
  const [actual, setActual] = useState<CajaActual | null>(null);
  const [historial, setHistorial] = useState<CashSession[]>([]);
  const [base, setBase] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [lastClosed, setLastClosed] = useState<CashSession | null>(null);

  async function load() {
    const data = await api.get<CajaActual>("/caja/actual");
    setActual(data);
    if (user?.role === "ADMIN") {
      const h = await api.get<CashSession[]>("/caja/historial");
      setHistorial(h);
    }
  }

  useEffect(() => {
    load().catch(() => {});
    const interval = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, [user?.role]);

  async function abrirCaja() {
    setError(null);
    try {
      await api.post("/caja/abrir", { base });
      setBase(0);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir la caja");
    }
  }

  async function cerrarCaja() {
    setError(null);
    try {
      const closed = await api.post<CashSession>("/caja/cerrar", { notes });
      setLastClosed(closed);
      setConfirmingClose(false);
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar la caja");
    }
  }

  async function exportCsv(cashSessionId: string) {
    const token = getToken();
    const res = await fetch(`/api/reportes/export.csv?cashSessionId=${cashSessionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cierre-caja-${cashSessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const c = actual?.consolidated;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Caja</h1>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {!actual?.session ? (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="text-slate-600">No hay una caja abierta.</div>
          {user?.role === "ADMIN" ? (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">Base entregada</label>
                <input
                  type="number"
                  value={base || ""}
                  onChange={(e) => setBase(Number(e.target.value))}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <button onClick={abrirCaja} className="py-2 px-4 rounded-lg bg-slate-900 text-white font-semibold">
                Abrir caja
              </button>
            </div>
          ) : (
            <div className="text-sm text-slate-500">Pide a un administrador que abra el turno de caja.</div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Abierta: {new Date(actual.session.openedAt).toLocaleString("es-CO")}</span>
            <span>Base: {formatCOP(actual.session.openingBase)}</span>
          </div>
          {c && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Ventas" value={String(c.totalVentas)} />
              <Stat label="Ingresos" value={formatCOP(c.totalIngresos)} />
              <Stat label="Efectivo" value={formatCOP(c.byPaymentMethod.EFECTIVO?.total ?? 0)} />
              <Stat label="Transferencia" value={formatCOP(c.byPaymentMethod.TRANSFERENCIA?.total ?? 0)} />
            </div>
          )}

          {user?.role === "ADMIN" && (
            <div className="border-t pt-3 space-y-2">
              {!confirmingClose ? (
                <button
                  onClick={() => setConfirmingClose(true)}
                  className="py-2 px-4 rounded-lg bg-red-600 text-white font-semibold"
                >
                  Cerrar caja
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    placeholder="Notas del cierre (opcional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={cerrarCaja} className="py-2 px-4 rounded-lg bg-red-600 text-white font-semibold">
                      Confirmar cierre definitivo
                    </button>
                    <button onClick={() => setConfirmingClose(false)} className="py-2 px-4 rounded-lg border">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {lastClosed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <h2 className="font-semibold text-emerald-800">Caja cerrada — consolidado final</h2>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(lastClosed.consolidatedSnapshot, null, 2)}</pre>
          <button onClick={() => exportCsv(lastClosed.id)} className="py-2 px-4 rounded-lg border font-medium text-sm">
            Exportar CSV
          </button>
        </div>
      )}

      {user?.role === "ADMIN" && historial.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold mb-2">Historial de cierres</h2>
          <div className="divide-y">
            {historial.map((s) => (
              <div key={s.id} className="py-2 flex items-center justify-between text-sm">
                <span>{s.closedAt ? new Date(s.closedAt).toLocaleString("es-CO") : ""}</span>
                <button onClick={() => exportCsv(s.id)} className="text-slate-600 underline">
                  Exportar CSV
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
