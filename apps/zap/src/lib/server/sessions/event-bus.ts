import type { SessionSnapshot } from "./types";

type SnapshotListener = (snapshot: SessionSnapshot) => void;

const listenersBySession = new Map<string, Set<SnapshotListener>>();

export const sessionEventBus = {
  subscribe(sessionId: string, listener: SnapshotListener) {
    let listeners = listenersBySession.get(sessionId);
    if (!listeners) {
      listeners = new Set();
      listenersBySession.set(sessionId, listeners);
    }
    listeners.add(listener);

    return () => {
      listeners?.delete(listener);
      if (listeners && listeners.size === 0) {
        listenersBySession.delete(sessionId);
      }
    };
  },

  publish(sessionId: string, snapshot: SessionSnapshot) {
    const listeners = listenersBySession.get(sessionId);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(snapshot);
    }
  },

  closeSession(sessionId: string) {
    listenersBySession.delete(sessionId);
  },
};
