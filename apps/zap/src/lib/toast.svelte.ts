export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

let seq = 0;
/** Shared reactive toast queue — read from Toaster / call `toast.*` from anywhere. */
export let toastItems = $state<ToastItem[]>([]);

const timers = new Map<number, ReturnType<typeof setTimeout>>();

function push(kind: ToastKind, message: string, ms: number) {
  const text = message.trim();
  if (!text) return;
  const id = ++seq;
  toastItems = [...toastItems, { id, kind, message: text }];
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
  toastItems = toastItems.filter((item) => item.id !== id);
}

export const toast = {
  success: (message: string, ms = 4000) => push("success", message, ms),
  error: (message: string, ms = 6000) => push("error", message, ms),
  info: (message: string, ms = 4000) => push("info", message, ms),
};
