"use client";

/**
 * Offline outbox for new complaints (docs/07 section 4).
 *
 * A complaint written without a connection is stored in IndexedDB with the
 * Idempotency-Key it was created with, then sent when the device is back
 * online. The server treats a repeated key as the same complaint, so retries
 * can never create duplicates.
 */

export type QueuedComplaint = {
  key: string;
  createdAt: number;
  payload: {
    categoryId: string;
    issueTypeId?: string | null;
    title: string;
    description: string;
    location?: string | null;
    isAnonymous: boolean;
  };
  images: Blob[];
  status: "queued" | "failed";
  error?: string;
};

const DB_NAME = "campusconnect";
const STORE = "outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueComplaint(item: Omit<QueuedComplaint, "status" | "createdAt">) {
  await run("readwrite", (s) => s.put({ ...item, status: "queued", createdAt: Date.now() }));
  notifyChange();
  try {
    const registration = await navigator.serviceWorker?.ready;
    // Background Sync where supported (Chromium); other browsers flush on the `online` event.
    await (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register(
      "complaint-outbox",
    );
  } catch {
    // not supported
  }
}

export async function listOutbox(): Promise<QueuedComplaint[]> {
  try {
    return (await run("readonly", (s) => s.getAll())) as QueuedComplaint[];
  } catch {
    return [];
  }
}

export async function removeFromOutbox(key: string) {
  await run("readwrite", (s) => s.delete(key));
  notifyChange();
}

export async function clearOutbox() {
  await run("readwrite", (s) => s.clear());
  notifyChange();
}

function notifyChange() {
  window.dispatchEvent(new Event("outbox-change"));
}

let flushing = false;

/** Sends every queued complaint. Returns how many were submitted. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of await listOutbox()) {
      if (item.status !== "queued") continue;
      const response = await fetch("/api/v1/complaints", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": item.key },
        body: JSON.stringify(item.payload),
      }).catch(() => null);

      if (!response) break; // still offline
      if (response.status === 401 || response.status === 429 || response.status >= 500) break;

      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        await run("readwrite", (s) =>
          s.put({ ...item, status: "failed", error: problem.detail ?? "The complaint could not be submitted." }),
        );
        notifyChange();
        continue;
      }

      const complaint = (await response.json()) as { id: string };
      for (const image of item.images) {
        const form = new FormData();
        form.append("file", image, "photo.jpg");
        await fetch(`/api/v1/complaints/${complaint.id}/attachments`, {
          method: "POST",
          credentials: "same-origin",
          body: form,
        }).catch(() => null);
      }
      await removeFromOutbox(item.key);
      sent++;
    }
  } finally {
    flushing = false;
  }
  return sent;
}
