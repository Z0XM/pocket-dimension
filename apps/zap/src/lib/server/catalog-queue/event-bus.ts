import type { CatalogQueueSnapshot } from "$lib/catalog-queue";

type Listener = (snapshot: CatalogQueueSnapshot) => void;

/**
 * In-process fan-out of catalogue-queue snapshots to every open stream of a user, plus device presence
 * (open SSE streams per device). Single-instance like the session event bus.
 */
const listenersByUser = new Map<string, Set<Listener>>();
const presenceByUser = new Map<string, Map<string, number>>();

export const catalogQueueBus = {
  subscribe(userId: string, listener: Listener) {
    let set = listenersByUser.get(userId);
    if (!set) {
      set = new Set();
      listenersByUser.set(userId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) listenersByUser.delete(userId);
    };
  },

  publish(userId: string, snapshot: CatalogQueueSnapshot) {
    const set = listenersByUser.get(userId);
    if (!set) return;
    for (const listener of set) listener(snapshot);
  },

  /** Returns how many devices were online for the user before this connect. */
  connect(userId: string, deviceId: string): number {
    let devices = presenceByUser.get(userId);
    if (!devices) {
      devices = new Map();
      presenceByUser.set(userId, devices);
    }
    const before = devices.size;
    devices.set(deviceId, (devices.get(deviceId) ?? 0) + 1);
    return before;
  },

  /** Returns how many devices remain online for the user. */
  disconnect(userId: string, deviceId: string): number {
    const devices = presenceByUser.get(userId);
    if (!devices) return 0;
    const count = (devices.get(deviceId) ?? 0) - 1;
    if (count > 0) devices.set(deviceId, count);
    else devices.delete(deviceId);
    if (devices.size === 0) presenceByUser.delete(userId);
    return devices.size;
  },

  onlineDeviceIds(userId: string): Set<string> {
    return new Set(presenceByUser.get(userId)?.keys() ?? []);
  },
};
