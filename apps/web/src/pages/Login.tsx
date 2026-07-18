import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth.js";

export function Login() {
  const { login, error } = useAuth();
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(finalPin: string) {
    if (!finalPin) return;
    setSubmitting(true);
    try {
      await login(finalPin);
      navigate("/pos");
    } catch {
      setPin("");
    } finally {
      setSubmitting(false);
    }
  }

  function press(digit: string) {
    if (digit === "back") return setPin((p) => p.slice(0, -1));
    if (digit === "clear") return setPin("");
    if (pin.length >= 8) return;
    setPin((p) => p + digit);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (submitting) return;
      if (/^[0-9]$/.test(e.key)) {
        press(e.key);
      } else if (e.key === "Backspace") {
        press("back");
      } else if (e.key === "Escape") {
        press("clear");
      } else if (e.key === "Enter" && pin.length >= 4) {
        handleSubmit(pin);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pin, submitting]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] p-4">
      <h1 className="text-2xl font-bold mb-1">Chonta POS</h1>
      <p className="text-slate-500 mb-6">Ingresa tu PIN</p>

      <div className="flex gap-2 mb-4" aria-label="PIN ingresado">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 border-slate-400 ${i < pin.length ? "bg-slate-800 border-slate-800" : ""}`}
          />
        ))}
      </div>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="text-2xl font-semibold py-4 rounded-xl bg-white shadow border active:bg-slate-100"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => press("clear")}
          className="text-sm font-medium py-4 rounded-xl bg-white shadow border active:bg-slate-100"
        >
          Borrar
        </button>
        <button
          onClick={() => press("0")}
          className="text-2xl font-semibold py-4 rounded-xl bg-white shadow border active:bg-slate-100"
        >
          0
        </button>
        <button
          onClick={() => press("back")}
          className="text-sm font-medium py-4 rounded-xl bg-white shadow border active:bg-slate-100"
        >
          ⌫
        </button>
      </div>

      <button
        onClick={() => handleSubmit(pin)}
        disabled={submitting || pin.length < 4}
        className="mt-6 w-full max-w-xs py-3 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-40"
      >
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
    </div>
  );
}
