// Dove l'app ricorda il login. Doppia copia: localStorage (veloce) + IndexedDB (più resistente,
// soprattutto su iPhone), così non chiede email e password a ogni apertura.

const DB = "cartella-nonna";
const STORE = "sessione";

function apri(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await apri();
    return await new Promise<T>((res, rej) => {
      const t = db.transaction(STORE, modo);
      const r = fn(t.objectStore(STORE));
      r.onsuccess = () => res(r.result as T);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return undefined;
  }
}

export const memoriaLogin = {
  async getItem(k: string): Promise<string | null> {
    try {
      const v = localStorage.getItem(k);
      if (v) return v;
    } catch {
      /* non disponibile */
    }
    const v = await idb<string>("readonly", (s) => s.get(k));
    if (v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* niente */
      }
    }
    return v ?? null;
  },
  async setItem(k: string, v: string): Promise<void> {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* niente */
    }
    await idb("readwrite", (s) => s.put(v, k));
  },
  async removeItem(k: string): Promise<void> {
    try {
      localStorage.removeItem(k);
    } catch {
      /* niente */
    }
    await idb("readwrite", (s) => s.delete(k));
  },
};

/** Chiede al browser di non cancellare i dati dell'app quando manca spazio. */
export function chiediMemoriaPersistente() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* non supportato */
  }
}

/* ---------- Copia dei dati per usarli senza internet ---------- */

export async function salvaCacheDati(dati: unknown) {
  await idb("readwrite", (s) => s.put(JSON.stringify({ quando: new Date().toISOString(), dati }), "cache-dati"));
}

export async function leggiCacheDati<T>(): Promise<{ quando: string; dati: T } | null> {
  const v = await idb<string>("readonly", (s) => s.get("cache-dati"));
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

/** Foto e PDF già aperti restano sul telefono e si vedono anche senza rete. */
export async function fileConCache(path: string, scarica: () => Promise<string>): Promise<Blob> {
  const chiave = new URL("__file/" + path, location.href).href;
  let cache: Cache | null = null;
  try {
    cache = await caches.open("cartella-nonna-file");
    const hit = await cache.match(chiave);
    if (hit) return await hit.blob();
  } catch {
    /* cache non disponibile */
  }
  const r = await fetch(await scarica());
  if (!r.ok) throw new Error("File non disponibile");
  try {
    await cache?.put(chiave, r.clone());
  } catch {
    /* spazio finito: pazienza */
  }
  return await r.blob();
}
