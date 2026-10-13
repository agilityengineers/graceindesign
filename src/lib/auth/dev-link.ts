import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { DevLinkStore, DEV_LINK_TTL_SECONDS } from "./dev-link-store";

const COOKIE = "gid_dev_link";
declare global {
  var __gidDevLinks: DevLinkStore | undefined;
}
const store = globalThis.__gidDevLinks ??= new DevLinkStore();
const enabled = () => !env.isProd && !env.sendgridApiKey;

/** Replace any earlier link, including when the new request has no link. */
export async function setDevLink(link: string | null) {
  const jar = await cookies();
  store.delete(jar.get(COOKIE)?.value);
  if (!enabled() || !link) {
    jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/login", maxAge: 0 });
    return;
  }
  jar.set(COOKIE, store.put(link), {
    httpOnly: true, sameSite: "lax", secure: env.baseUrl.startsWith("https:"),
    path: "/login", maxAge: DEV_LINK_TTL_SECONDS,
  });
}

export async function getDevLink() {
  if (!enabled()) return null;
  return store.get((await cookies()).get(COOKIE)?.value);
}
