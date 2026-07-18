import type { Order } from "../lib/types.js";

const formatCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export const EVENT_NAME = "Chonta - Noche de Bebidas";

export function Receipt({ order }: { order: Order }) {
  const date = new Date(order.createdAt);

  return (
    <div
      id="receipt-print"
      className="font-mono text-black bg-white p-2 text-[12px] leading-tight fixed top-0 -left-[9999px]"
    >
      <div className="text-center mb-2">
        <div className="font-bold text-sm">{EVENT_NAME}</div>
        <div>
          {date.toLocaleDateString("es-CO")} {date.toLocaleTimeString("es-CO")}
        </div>
      </div>

      <div className="text-center my-2">
        <div className="text-[10px]">TURNO</div>
        <div className="font-bold" style={{ fontSize: "48px", lineHeight: 1 }}>
          {order.turnNumber}
        </div>
      </div>

      <div className="border-t border-black border-dashed my-1" />

      {order.items.map((item) => (
        <div key={item.productId} className="flex justify-between gap-2">
          <span>
            {item.quantity}x {item.name}
          </span>
          <span>{formatCOP(item.price * item.quantity)}</span>
        </div>
      ))}

      <div className="border-t border-black border-dashed my-1" />

      {order.discountType !== "NONE" && (
        <div className="flex justify-between">
          <span>{order.discountType === "CORTESIA" ? "Cortesía" : "Descuento"}</span>
          <span>-{formatCOP(order.discountType === "CORTESIA" ? order.subtotal : order.discountAmount)}</span>
        </div>
      )}

      <div className="flex justify-between font-bold text-sm">
        <span>TOTAL</span>
        <span>{formatCOP(order.total)}</span>
      </div>

      <div className="mt-1">Pago: {order.paymentMethod === "EFECTIVO" ? "Efectivo" : "Transferencia"}</div>

      <div className="text-center mt-3">¡Gracias por tu compra!</div>
    </div>
  );
}
