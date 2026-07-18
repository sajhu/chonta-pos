import { useState } from "react";
import type { Order } from "./types.js";

export function usePrintReceipt() {
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  function printReceipt(order: Order) {
    setLastOrder(order);
    setTimeout(() => window.print(), 150);
  }

  return { lastOrder, setLastOrder, printReceipt };
}
