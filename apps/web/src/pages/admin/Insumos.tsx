import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { ListSkeleton } from "../../components/Skeleton.js";
import type { Insumo, InsumoUnit } from "../../lib/types.js";

interface EditDraft {
  minThreshold: number;
  packageLabel: string;
  packageSize: number | "";
}

export function Insumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState<InsumoUnit>("UNIDAD");
  const [newThreshold, setNewThreshold] = useState(0);
  const [newPackageLabel, setNewPackageLabel] = useState("");
  const [newPackageSize, setNewPackageSize] = useState<number | "">("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [qtyMode, setQtyMode] = useState<Record<string, "base" | "package">>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ minThreshold: 0, packageLabel: "", packageSize: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setInsumos(await api.get<Insumo[]>("/insumos"));
    setLoaded(true);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function createInsumo() {
    if (!newName.trim()) return;
    await api.post("/insumos", {
      name: newName.trim(),
      unit: newUnit,
      minThreshold: newThreshold,
      packageLabel: newPackageLabel.trim() || undefined,
      packageSize: newPackageSize || undefined,
    });
    setNewName("");
    setNewThreshold(0);
    setNewPackageLabel("");
    setNewPackageSize("");
    await load();
  }

  function modeFor(ins: Insumo): "base" | "package" {
    if (!ins.packageSize) return "base";
    return qtyMode[ins.id] ?? "package";
  }

  function resolveQuantity(ins: Insumo): number {
    const raw = amounts[ins.id];
    if (!raw || raw <= 0) return 0;
    if (modeFor(ins) === "package" && ins.packageSize) return raw * ins.packageSize;
    return raw;
  }

  async function cargaInicial(ins: Insumo) {
    setError(null);
    const quantity = resolveQuantity(ins);
    if (quantity <= 0) return;
    try {
      await api.post(`/insumos/${ins.id}/carga-inicial`, { quantity, note: "Cargue inicial" });
      setAmounts((a) => ({ ...a, [ins.id]: 0 }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar inventario");
    }
  }

  async function baja(ins: Insumo) {
    setError(null);
    const quantity = resolveQuantity(ins);
    const reason = reasons[ins.id];
    if (quantity <= 0) return;
    if (!reason?.trim()) {
      setError("Escribe el motivo de la baja.");
      return;
    }
    try {
      await api.post(`/insumos/${ins.id}/baja`, { quantity, reason });
      setAmounts((a) => ({ ...a, [ins.id]: 0 }));
      setReasons((r) => ({ ...r, [ins.id]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al dar de baja");
    }
  }

  function startEditPackaging(ins: Insumo) {
    setEditingId(ins.id);
    setEditDraft({
      minThreshold: ins.minThreshold,
      packageLabel: ins.packageLabel ?? "",
      packageSize: ins.packageSize ?? "",
    });
  }

  async function savePackaging(id: string) {
    await api.put(`/insumos/${id}`, {
      minThreshold: editDraft.minThreshold,
      packageLabel: editDraft.packageLabel.trim() || null,
      packageSize: editDraft.packageSize === "" ? null : editDraft.packageSize,
    });
    setEditingId(null);
    await load();
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
        <div className="flex flex-wrap gap-2 items-center pt-1">
          <span className="text-xs text-slate-500 w-full sm:w-auto">
            Opcional — si viene en presentación (ej. botella), para inventariar por unidad manteniendo la receta en{" "}
            {newUnit.toLowerCase()}:
          </span>
          <input
            placeholder="Nombre presentación (ej. Botella 350ml)"
            value={newPackageLabel}
            onChange={(e) => setNewPackageLabel(e.target.value)}
            className="flex-1 min-w-48 border rounded-lg p-2 text-sm"
          />
          <input
            type="number"
            placeholder={`Contenido por unidad en ${newUnit.toLowerCase()}`}
            value={newPackageSize}
            onChange={(e) => setNewPackageSize(e.target.value ? Number(e.target.value) : "")}
            className="w-56 border rounded-lg p-2 text-sm"
          />
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {!loaded && <ListSkeleton rows={8} />}

      <div className="bg-white rounded-xl border divide-y">
        {insumos.map((ins) => {
          const low = ins.stockQty <= ins.minThreshold;
          const mode = modeFor(ins);
          return (
            <div key={ins.id} className={`p-4 ${low ? "bg-red-50" : ""}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium">{ins.name}</div>
                  <div className={`text-sm ${low ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                    Stock: {ins.stockQty} {ins.unit.toLowerCase()} (mínimo {ins.minThreshold}
                    {ins.packageSize && ins.packageSize > 0 && (
                      <> ≈ {(ins.minThreshold / ins.packageSize).toFixed(1)} {ins.packageLabel || "unidad"}</>
                    )}
                    )
                    {ins.packageSize && ins.packageSize > 0 && (
                      <> · ≈{(ins.stockQty / ins.packageSize).toFixed(1)} {ins.packageLabel || "unidad"}</>
                    )}
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
                  {ins.packageSize && ins.packageSize > 0 && (
                    <select
                      value={mode}
                      onChange={(e) => setQtyMode((m) => ({ ...m, [ins.id]: e.target.value as "base" | "package" }))}
                      className="border rounded-lg p-2 text-sm"
                    >
                      <option value="package">{ins.packageLabel || "unidad"}</option>
                      <option value="base">{ins.unit.toLowerCase()}</option>
                    </select>
                  )}
                  <input
                    type="text"
                    placeholder="Motivo (para baja)"
                    value={reasons[ins.id] || ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [ins.id]: e.target.value }))}
                    className="w-40 border rounded-lg p-2 text-sm"
                  />
                  <button
                    onClick={() => cargaInicial(ins)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
                  >
                    Cargar
                  </button>
                  <button onClick={() => baja(ins)} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold">
                    Dar de baja
                  </button>
                  <button
                    onClick={() => (editingId === ins.id ? setEditingId(null) : startEditPackaging(ins))}
                    className="px-2 py-2 text-sm text-slate-500 underline"
                  >
                    {editingId === ins.id ? "Cerrar" : "Presentación"}
                  </button>
                </div>
              </div>

              {editingId === ins.id && (
                <div className="mt-3 flex flex-wrap gap-2 items-center border-t pt-3">
                  <label className="text-xs text-slate-500">Umbral mínimo</label>
                  <input
                    type="number"
                    value={editDraft.minThreshold}
                    onChange={(e) => setEditDraft((d) => ({ ...d, minThreshold: Number(e.target.value) }))}
                    className="w-24 border rounded-lg p-2 text-sm"
                  />
                  <label className="text-xs text-slate-500">Nombre presentación</label>
                  <input
                    placeholder="Botella 350ml"
                    value={editDraft.packageLabel}
                    onChange={(e) => setEditDraft((d) => ({ ...d, packageLabel: e.target.value }))}
                    className="flex-1 min-w-40 border rounded-lg p-2 text-sm"
                  />
                  <label className="text-xs text-slate-500">Contenido ({ins.unit.toLowerCase()})</label>
                  <input
                    type="number"
                    value={editDraft.packageSize}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, packageSize: e.target.value ? Number(e.target.value) : "" }))
                    }
                    className="w-32 border rounded-lg p-2 text-sm"
                  />
                  <button
                    onClick={() => savePackaging(ins.id)}
                    className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
