import { useState } from "react";

export function AdminPinModal({
  title,
  onConfirm,
  onCancel,
}: {
  title: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 w-full max-w-sm space-y-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">Un administrador debe ingresar su PIN para autorizar esta acción.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="PIN de administrador"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full border rounded-lg p-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(pin.trim())}
            disabled={!pin.trim()}
            className="flex-1 py-2 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-40"
          >
            Autorizar
          </button>
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg border">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
