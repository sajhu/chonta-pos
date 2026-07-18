import { get, set } from "idb-keyval";
import { getToken } from "./auth.js";

const OUTBOX_KEY = "chonta_pos_outbox";

export interface QueuedOp {
  id: string;
  method: "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  createdAt: string;
  label: string;
}

type Listener = (ops: QueuedOp[]) => void;
const listeners = new Set<Listener>();

async function readQueue(): Promise<QueuedOp[]> {
  return (await get<QueuedOp[]>(OUTBOX_KEY)) ?? [];
}

async function writeQueue(ops: QueuedOp[]): Promise<void> {
  await set(OUTBOX_KEY, ops);
  listeners.forEach((l) => l(ops));
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  readQueue().then(listener);
  return () => listeners.delete(listener);
}

export async function enqueue(op: Omit<QueuedOp, "createdAt">): Promise<void> {
  const queue = await readQueue();
  queue.push({ ...op, createdAt: new Date().toISOString() });
  await writeQueue(queue);
}

export async function getQueue(): Promise<QueuedOp[]> {
  return readQueue();
}

async function sendOp(op: QueuedOp): Promise<Response> {
  const token = getToken();
  return fetch(`/api${op.path}`, {
    method: op.method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
  });
}

let syncing = false;

export async function trySyncOutbox(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    let queue = await readQueue();
    while (queue.length > 0) {
      const [next, ...rest] = queue;
      let res: Response;
      try {
        res = await sendOp(next);
      } catch {
        return; // still offline, stop and retry later
      }
      if (!res.ok && res.status >= 500) {
        return; // server issue, retry later without losing the op
      }
      // 2xx or 4xx (already applied/invalid) both remove it: 4xx won't succeed on retry either.
      queue = rest;
      await writeQueue(queue);
    }
  } finally {
    syncing = false;
  }
}
