import { useConnectivity } from "../lib/online.js";

export function OfflineBanner() {
  const { isOnline, pendingCount } = useConnectivity();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`w-full text-center text-sm font-medium py-1.5 px-2 ${
        isOnline ? "bg-amber-500 text-white" : "bg-red-600 text-white"
      }`}
    >
      {isOnline
        ? `Sincronizando ${pendingCount} operación(es) pendiente(s)...`
        : `Sin conexión — las ventas se guardan localmente y se sincronizarán automáticamente${
            pendingCount > 0 ? ` (${pendingCount} pendientes)` : ""
          }`}
    </div>
  );
}
