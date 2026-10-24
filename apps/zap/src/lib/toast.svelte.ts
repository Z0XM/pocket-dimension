export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

/** Shared reactive toast queue — mutate `.items`; do not reassign the export. */
class ToastQueue {
  items = $state<ToastItem[]>([]);
}

export const toastQueue = new ToastQueue();

function push(kind: ToastKind, message: string, ms: number) {
  const text = message.trim();
  if (!text) return;
  const id = ++seq;
  toastQueue.items = [...toastQueue.items, { id, kind, message: text }];
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  timers.set(
    id,
    setTimeout(() => dismissToast(id), ms)
  );
}

export function dismissToast(id: number) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  toastQueue.items = toastQueue.items.filter((item) => item.id !== id);
}

export const toast = {
  success: (message: string, ms = 4000) => push("success", message, ms),
  error: (message: string, ms = 6000) => push("error", message, ms),
  info: (message: string, ms = 4000) => push("info", message, ms),
};
