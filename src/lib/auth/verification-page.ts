/**
 * Deliberately standalone: scrub the fragment before any async work or resources.
 * Never interpolate request data or credentials into this document.
 */
export function verificationPage(nonce: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><script nonce="${nonce}">
(() => {
  let fragment = window.location.hash;
  const hadQuery = !!window.location.search;
  try {
    window.history.replaceState(null, "", "/auth/verify");
  } catch {
    window.location.replace("/login?err=invalid");
    return;
  }
  let token = new URLSearchParams(fragment.slice(1)).get("token");
  fragment = "";
  if (hadQuery || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    window.location.replace("/login?err=invalid");
    return;
  }
  const exchange = fetch("/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    credentials: "same-origin",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    redirect: "error"
  });
  token = null;
  exchange.then(async response => {
    if (!response.ok) throw new Error("Verification failed");
    const result = await response.json();
    window.location.replace(result.location);
  }).catch(() => {
    window.location.replace("/login?err=invalid");
  });
})();
</script><title>Signing in — Grace In Design</title></head><body><main><h1>Signing in…</h1><p>If sign-in does not finish, <a href="/login" rel="noreferrer">request a new sign-in link</a>.</p><noscript><p>JavaScript is required to securely exchange this sign-in link. Enable JavaScript and reopen the link from your email. Close this tab to remove the unopened link from the address bar.</p></noscript></main></body></html>`;
}
