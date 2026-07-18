import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api.js";
import { getAutoPrint, setAutoPrint } from "../../lib/settings.js";
import { DangerReset } from "../../components/DangerReset.js";
import { ListSkeleton } from "../../components/Skeleton.js";
import type { AppUser } from "../../lib/types.js";

export function Configuracion() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"ADMIN" | "CAJERO">("CAJERO");
  const [error, setError] = useState<string | null>(null);
  const [autoPrint, setAutoPrintState] = useState(getAutoPrint());

  async function load() {
    setUsers(await api.get<AppUser[]>("/usuarios"));
    setUsersLoaded(true);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  function toggleAutoPrint() {
    const next = !autoPrint;
    setAutoPrint(next);
    setAutoPrintState(next);
  }

  async function createUser() {
    setError(null);
    if (!name.trim() || pin.length < 4) {
      setError("Nombre y PIN de al menos 4 dígitos son obligatorios.");
      return;
    }
    try {
      await api.post("/usuarios", { name: name.trim(), pin, role });
      setName("");
      setPin("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el usuario");
    }
  }

  async function toggleActive(u: AppUser) {
    await api.put(`/usuarios/${u.id}`, { active: !u.active });
    await load();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Configuración</h1>

      <div className="bg-white rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">Impresión de comandas</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Impresión automática al confirmar el pago</div>
            <div className="text-xs text-slate-500">
              Si la desactivas, aparecerá un botón para imprimir la comanda manualmente. Reimprimir desde el
              histórico siempre está disponible, sin importar esta opción.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoPrint}
            onClick={toggleAutoPrint}
            className={`inline-flex shrink-0 items-center w-14 h-8 rounded-full p-1 transition-colors ${
              autoPrint ? "bg-emerald-600 justify-end" : "bg-slate-300 justify-start"
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-white shadow" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-2">
        <h2 className="font-semibold">Nuevo usuario</h2>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-40 border rounded-lg p-2 text-sm"
          />
          <input
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="w-28 border rounded-lg p-2 text-sm"
          />
          <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "CAJERO")} className="border rounded-lg p-2 text-sm">
            <option value="CAJERO">Cajero</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button onClick={createUser} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">
            Crear
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold text-red-700">Zona de peligro</h2>
        <DangerReset
          title="Resetear inventario"
          description="Pone el stock de todos los insumos en cero y borra el historial de movimientos (cargues, bajas, consumo por ventas). No afecta el menú, precios ni recetas."
          confirmationPhrase="RESETEAR INVENTARIO"
          endpoint="/insumos/reset"
        />
        <DangerReset
          title="Resetear ventas"
          description="Borra todas las ventas, anulaciones y cierres de caja registrados. No afecta el inventario actual ni el menú."
          confirmationPhrase="RESETEAR VENTAS"
          endpoint="/caja/reset-ventas"
        />
      </div>

      {!usersLoaded && <ListSkeleton rows={2} />}

      <div className="bg-white rounded-xl border divide-y">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between">
            <div>
              <div className={`font-medium ${!u.active ? "text-slate-400 line-through" : ""}`}>{u.name}</div>
              <div className="text-xs text-slate-500">{u.role === "ADMIN" ? "Administrador" : "Cajero"}</div>
            </div>
            <button onClick={() => toggleActive(u)} className="text-sm underline">
              {u.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
