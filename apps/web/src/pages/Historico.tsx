import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { usePrintReceipt } from "../lib/usePrintReceipt.js";
import { Receipt } from "../components/Receipt.js";
import { RecentOrders } from "../components/RecentOrders.js";
import { ListSkeleton } from "../components/Skeleton.js";
import type { CajaActual, Order } from "../lib/types.js";

export function Historico() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { lastOrder, printReceipt } = usePrintReceipt();

  async function load() {
    const actual = await api.get<CajaActual>("/caja/actual");
    if (actual.session) {
      setOrders(await api.get<Order[]>(`/ventas?cashSessionId=${actual.session.id}`));
    } else {
      setOrders(await api.get<Order[]>("/ventas"));
    }
    setLoaded(true);
  }

  useEffect(() => {
    load().catch(() => {});
    const interval = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, []);

  async function anularOrder(orderId: string, reason: string) {
    await api.post(`/ventas/${orderId}/anular`, { reason });
    await load();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto flex flex-col h-[calc(100vh-56px)]">
      <h1 className="text-xl font-bold mb-3">Histórico de ventas</h1>
      {!loaded ? <ListSkeleton rows={8} /> : <RecentOrders orders={orders} onAnular={anularOrder} onReprint={printReceipt} />}
      {lastOrder && <Receipt order={lastOrder} />}
    </div>
  );
}
