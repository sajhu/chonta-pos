import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { enqueue, subscribeOutbox } from "../lib/outbox.js";
import { getAutoPrint } from "../lib/settings.js";
import { usePrintReceipt } from "../lib/usePrintReceipt.js";
import { Receipt } from "../components/Receipt.js";
import type { CajaActual, DiscountType, Order, PaymentMethod, Product } from "../lib/types.js";

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

interface CartLine {
  productId: string;
  quantity: number;
}

export function Pos() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [discountType, setDiscountType] = useState<DiscountType>("NONE");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [authorizerPin, setAuthorizerPin] = useState("");
  const [cashActual, setCashActual] = useState<CajaActual | null>(null);
  const [pendingVentas, setPendingVentas] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { lastOrder, setLastOrder, printReceipt } = usePrintReceipt();

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => {
    const map = new Map(products.map((p) => [p.category.id, p.category]));
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [products]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) setSelectedCategoryId(categories[0].id);
  }, [categories, selectedCategoryId]);

  async function loadProducts() {
    setProducts(await api.get<Product[]>("/products"));
  }

  async function loadCaja() {
    setCashActual(await api.get<CajaActual>("/caja/actual"));
  }

  useEffect(() => {
    loadProducts().catch(() => {});
    loadCaja().catch(() => {});
    const interval = setInterval(() => {
      loadProducts().catch(() => {});
      loadCaja().catch(() => {});
    }, 20000);
    const unsubscribe = subscribeOutbox((ops) => setPendingVentas(ops.filter((o) => o.path === "/ventas").length));
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  function addToCart(productId: string) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) return prev.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { productId, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function scrollToCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    sectionRefs.current[categoryId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const subtotal = cart.reduce((sum, l) => sum + (productsById.get(l.productId)?.price ?? 0) * l.quantity, 0);
  const total = discountType === "CORTESIA" ? 0 : Math.max(0, subtotal - (discountType === "MANUAL" ? discountAmount : 0));

  const needsAuthorizerPin = discountType === "CORTESIA" && user?.role === "CAJERO";

  function resetSaleForm() {
    setCart([]);
    setDiscountType("NONE");
    setDiscountAmount(0);
    setDiscountReason("");
    setAuthorizerPin("");
  }

  async function confirmSale() {
    setError(null);
    if (cart.length === 0) return;
    if (!cashActual?.session) {
      setError("La caja no está abierta. Pide a un administrador que abra el turno.");
      return;
    }
    if ((discountType === "MANUAL" || discountType === "CORTESIA") && !discountReason.trim()) {
      setError("Escribe el motivo de la cortesía o el descuento.");
      return;
    }
    if (needsAuthorizerPin && !authorizerPin.trim()) {
      setError("Se requiere el PIN de un administrador para aplicar una cortesía.");
      return;
    }

    setSubmitting(true);
    const clientRequestId = crypto.randomUUID();
    const itemsSnapshot = cart.map((l) => {
      const p = productsById.get(l.productId)!;
      return { productId: p.id, name: p.name, price: p.price, quantity: l.quantity };
    });
    const predictedTurn = (cashActual.lastTurnNumber ?? 0) + pendingVentas + 1;

    const body = {
      clientRequestId,
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      paymentMethod,
      discountType,
      discountAmount: discountType === "MANUAL" ? discountAmount : 0,
      discountReason: discountType !== "NONE" ? discountReason : undefined,
      authorizerPin: needsAuthorizerPin ? authorizerPin.trim() : undefined,
    };

    let finalOrder: Order = {
      id: `local-${clientRequestId}`,
      turnNumber: predictedTurn,
      cashSessionId: cashActual.session.id,
      items: itemsSnapshot,
      paymentMethod,
      discountType,
      discountAmount: discountType === "MANUAL" ? discountAmount : 0,
      discountReason: discountType !== "NONE" ? discountReason : undefined,
      subtotal,
      total,
      status: "COMPLETADA",
      createdAt: new Date().toISOString(),
      clientRequestId,
      pending: true,
    };

    try {
      const created = await api.post<Order>("/ventas", body);
      finalOrder = { ...created, pending: false };
      setCashActual((prevCaja) =>
        prevCaja ? { ...prevCaja, lastTurnNumber: Math.max(prevCaja.lastTurnNumber, created.turnNumber) } : prevCaja,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setSubmitting(false);
        return;
      }
      // Network failure: queue for later sync, keep the provisional turn for the printed receipt.
      await enqueue({ id: clientRequestId, method: "POST", path: "/ventas", body, label: `Venta turno #${predictedTurn}` });
    }

    resetSaleForm();
    setSubmitting(false);
    loadCaja().catch(() => {});
    if (getAutoPrint()) printReceipt(finalOrder);
    else setLastOrder(finalOrder);
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="sticky top-0 z-10 -mx-3 px-3 pt-1 pb-2 mb-2 bg-slate-50 flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollToCategory(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border ${
                selectedCategoryId === c.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {categories.map((cat) => (
          <div
            key={cat.id}
            ref={(el) => {
              sectionRefs.current[cat.id] = el;
            }}
            className="mb-6 scroll-mt-16"
          >
            <h2 className="text-sm font-semibold text-slate-500 mb-2">{cat.name}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products
                .filter((p) => p.categoryId === cat.id)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p.id)}
                    className="text-left bg-white rounded-xl shadow border p-3 active:scale-[0.98]"
                  >
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-slate-500">{formatCOP(p.price)}</div>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l flex flex-col p-3 gap-3 overflow-y-auto">
        <div className="text-sm text-slate-500">
          {cashActual?.session ? (
            <span>
              Turno siguiente: <strong>#{(cashActual.lastTurnNumber ?? 0) + pendingVentas + 1}</strong>
            </span>
          ) : (
            <span className="text-red-600 font-medium">Caja cerrada — no se pueden registrar ventas</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y">
          {cart.length === 0 && <div className="text-slate-400 text-sm py-6 text-center">Carrito vacío</div>}
          {cart.map((l) => {
            const p = productsById.get(l.productId);
            if (!p) return null;
            return (
              <div key={l.productId} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{formatCOP(p.price)} c/u</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(l.productId, -1)} className="w-8 h-8 rounded-full border font-bold">
                    -
                  </button>
                  <span className="w-6 text-center">{l.quantity}</span>
                  <button onClick={() => changeQty(l.productId, 1)} className="w-8 h-8 rounded-full border font-bold">
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t pt-3">
          <label className="text-sm font-medium">Método de pago</label>
          <div className="flex gap-2">
            {(["EFECTIVO", "TRANSFERENCIA"] as PaymentMethod[]).map((pm) => (
              <button
                key={pm}
                onClick={() => setPaymentMethod(pm)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                  paymentMethod === pm ? "bg-slate-900 text-white" : "bg-white"
                }`}
              >
                {pm === "EFECTIVO" ? "Efectivo" : "Transferencia"}
              </button>
            ))}
          </div>

          <label className="text-sm font-medium">Cortesía / descuento</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            className="w-full border rounded-lg p-2 text-sm"
          >
            <option value="NONE">Ninguno</option>
            <option value="CORTESIA">Cortesía (sin cobro)</option>
            <option value="MANUAL">Descuento manual</option>
          </select>
          {discountType !== "NONE" && (
            <>
              {discountType === "MANUAL" && (
                <input
                  type="number"
                  placeholder="Valor del descuento"
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              )}
              <input
                type="text"
                placeholder="Motivo"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="w-full border rounded-lg p-2 text-sm"
              />
              {needsAuthorizerPin && (
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN de un administrador"
                  value={authorizerPin}
                  onChange={(e) => setAuthorizerPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              )}
            </>
          )}
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <div className="border-t pt-3 flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{formatCOP(total)}</span>
        </div>

        <button
          onClick={confirmSale}
          disabled={submitting || cart.length === 0}
          className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-lg disabled:opacity-40"
        >
          {submitting ? "Procesando..." : getAutoPrint() ? "Confirmar e imprimir" : "Confirmar venta"}
        </button>

        {!getAutoPrint() && lastOrder && (
          <button
            onClick={() => printReceipt(lastOrder)}
            className="w-full py-2 rounded-xl border border-slate-900 text-slate-900 font-semibold"
          >
            Imprimir comanda del turno #{lastOrder.turnNumber}
          </button>
        )}
      </div>

      {lastOrder && <Receipt order={lastOrder} />}
    </div>
  );
}
