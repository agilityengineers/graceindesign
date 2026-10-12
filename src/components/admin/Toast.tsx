"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
/** Shows ?ok= / ?err= query feedback from server actions, then clears it. */
export default function Toast() {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const ok = sp.get("ok"), err = sp.get("err");
  const [show, setShow] = useState(!!(ok || err));
  useEffect(() => { if (!(ok || err)) return; setShow(true); const t = setTimeout(() => { setShow(false); const n = new URLSearchParams(sp.toString()); n.delete("ok"); n.delete("err"); router.replace(`${path}${n.toString() ? `?${n}` : ""}`); }, 3500); return () => clearTimeout(t); }, [ok, err]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show || !(ok || err)) return null;
  return <div role="status" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 80, padding: "12px 16px", borderRadius: 12, background: err ? "#fbe9e2" : "#1a2238", color: err ? "#9a3c1e" : "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 18px 44px rgba(26,34,56,.25)" }}>{err || ok}</div>;
}
