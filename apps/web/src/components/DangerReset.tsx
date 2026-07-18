import { useState } from "react";
import { api, ApiError } from "../lib/api.js";

export function DangerReset({
  title,
  description,
  confirmationPhrase,
  endpoint,
}: {
  title: string;
  description: string;
  confirmationPhrase: string;
  endpoint: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function cancel() {
    setExpanded(false);
    setTyped("");
    setError(null);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.post(endpoint, { confirmation: confirmationPhrase });
      setDone(true);
      cancel();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la acción");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-red-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
        {!expanded && (
          <button
            onClick={() => {
              setExpanded(true);
              setDone(false);
            }}
            className="shrink-0 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold"
          >
            Resetear
          </button>
        )}
      </div>

      {done && <div className="text-emerald-700 text-xs font-medium">Listo, se reseteó correctamente.</div>}

      {expanded && (
        <div className="bg-red-50 rounded-lg p-3 space-y-2">
          <div className="text-xs text-red-700 font-medium">
            Esta acción no se puede deshacer. Escribe exactamente "{confirmationPhrase}" para confirmar.
          </div>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmationPhrase}
            className="w-full border border-red-300 rounded-lg p-2 text-sm"
          />
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={confirm}
              disabled={busy || typed !== confirmationPhrase}
              className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              {busy ? "Reseteando..." : "Confirmar reset definitivo"}
            </button>
            <button onClick={cancel} className="px-3 py-2 rounded-lg border text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
