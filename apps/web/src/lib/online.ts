import { useEffect, useState } from "react";
import { pingHealth } from "./api.js";
import { getQueue, subscribeOutbox, trySyncOutbox, type QueuedOp } from "./outbox.js";

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState<QueuedOp[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const ok = await pingHealth();
      if (cancelled) return;
      setIsOnline(ok);
      if (ok) await trySyncOutbox();
    }

    check();
    const interval = setInterval(check, 5000);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);

    const unsubscribe = subscribeOutbox(setPending);
    getQueue().then(setPending);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      unsubscribe();
    };
  }, []);

  return { isOnline, pendingCount: pending.length };
}
