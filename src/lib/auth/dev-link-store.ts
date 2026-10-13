import { createHash, randomBytes } from "node:crypto";

export const DEV_LINK_TTL_SECONDS = 5 * 60;
const key = (handle: string) => createHash("sha256").update(handle).digest("hex");

/** Development-only, bounded, process-local storage. Restarting fails closed. */
export class DevLinkStore {
  private entries = new Map<string, { link: string; expires: number }>();

  constructor(private readonly capacity = 1000) {}

  put(link: string, now = Date.now()) {
    this.prune(now);
    while (this.entries.size >= this.capacity) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    const handle = randomBytes(32).toString("base64url");
    this.entries.set(key(handle), { link, expires: now + DEV_LINK_TTL_SECONDS * 1000 });
    return handle;
  }

  get(handle: string | undefined, now = Date.now()) {
    this.prune(now);
    return handle ? this.entries.get(key(handle))?.link ?? null : null;
  }

  delete(handle: string | undefined) {
    if (handle) this.entries.delete(key(handle));
  }

  private prune(now: number) {
    for (const [id, entry] of this.entries) {
      if (entry.expires <= now) this.entries.delete(id);
    }
  }
}
