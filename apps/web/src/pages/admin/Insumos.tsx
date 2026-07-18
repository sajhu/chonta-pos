import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import type { Insumo, InsumoUnit } from "../../lib/types.js";

export function Insumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<InsumoUnit>("UNIDAD");
  const [newThreshold, setNewThreshold] = useState(0);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setInsumos(await api.get<Insumo[]>("/insumos"));
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function createInsumo() {
    if (!newName.trim()) return;
    await api.post("/insumos", { name: newName.trim(), unit: newUnit, minThreshold: newThreshold });
    setNewName("");
    setNewThreshold(0);
    await load();
  }

  async function cargaInicial(id: string) {
    setError(null);
    const qty = amounts[id];
    if (!qty || qty <= 0) return;
    try {
      await api.post(`/insumos/${id}/carga-inicial`, { quantity: qty, note: "Cargue inicial" });
      setAmounts((a) => ({ ...a, [id]: 0 }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar inventario");
    }
  }

  async function baja(id: string) {
    setError(null);
    const qty = amounts[id];
    const reason = reasons[id];
    if (!qty || qty <= 0) return;
    if (!reason?.trim()) {
      setError("Escribe el motivo de la baja.");
      return;
    }
    try {
      await api.post(`/insumos/${id}/baja`, { quantity: qty, reason });
      setAmounts((a) => ({ ...a, [id]: 0 }));
      setReasons((r) => ({ ...r, [id]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al dar de baja");
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Insumos e inventario</h1>

      <div className="bg-white rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">Nuevo insumo</h2>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Nombre"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-w-40 border rounded-lg p-2 text-sm"
          />
          <select
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value as InsumoUnit)}
            className="border rounded-lg p-2 text-sm"
          >
            <option value="UNIDAD">Unidad</option>
            <option value="ML">Mililitros</option>
            <option value="GR">Gramos</option>
          </select>
          <input
            type="number"
            placeholder="Umbral mínimo"
            value={newThreshold || ""}
            onChange={(e) => setNewThreshold(Number(e.target.value))}
            className="w-36 border rounded-lg p-2 text-sm"
          />
          <button onClick={createInsumo} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">
            Crear
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border divide-y">
        {insumos.map((ins) => {
          const low = ins.stockQty <= ins.minThreshold;
          return (
            <div key={ins.id} className={`p-4 ${low ? "bg-red-50" : ""}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium">{ins.name}</div>
                  <div className={`text-sm ${low ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                    Stock: {ins.stockQty} {ins.unit.toLowerCase()} (mínimo {ins.minThreshold})
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Cantidad"
                    value={amounts[ins.id] || ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [ins.id]: Number(e.target.value) }))}
                    className="w-24 border rounded-lg p-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Motivo (para baja)"
                    value={reasons[ins.id] || ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [ins.id]: e.target.value }))}
                    className="w-40 border rounded-lg p-2 text-sm"
                  />
                  <button
                    onClick={() => cargaInicial(ins.id)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
                  >
                    Cargar
                  </button>
                  <button onClick={() => baja(ins.id)} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">
                    Dar de baja
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
