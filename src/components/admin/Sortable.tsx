"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

/**
 * Generic drag-to-reorder list. Each child is wrapped in a draggable row with a ⋮⋮ handle;
 * dropping calls `onReorder(ids)` (a server action, optionally pre-bound) and refreshes.
 */
export default function Sortable<T extends string | number>({ ids, onReorder, children, gap = 8, handleTop }: { ids: T[]; onReorder: (ids: T[]) => Promise<unknown>; children: ReactNode[]; gap?: number; handleTop?: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState<T[]>(ids);
  const [drag, setDrag] = useState<T | null>(null);
  const [over, setOver] = useState<T | null>(null);
  const [pending, start] = useTransition();
  // Re-sync when the server sends a new list (e.g. after add/delete).
  const key = ids.join("|");
  const [seen, setSeen] = useState(key);
  if (seen !== key) { setSeen(key); setOrder(ids); }
  const byId = new Map<T, ReactNode>(); ids.forEach((id, i) => byId.set(id, children[i]));
  const drop = (target: T) => {
    if (drag == null || drag === target) { setDrag(null); setOver(null); return; }
    const next = order.filter((x) => x !== drag); next.splice(next.indexOf(target), 0, drag);
    setOrder(next); setDrag(null); setOver(null);
    start(async () => { await onReorder(next); router.refresh(); });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, opacity: pending ? 0.7 : 1 }}>
      {order.map((id) => (
        <div key={String(id)} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag(id); }} onDragOver={(e) => { e.preventDefault(); if (over !== id) setOver(id); }} onDragLeave={() => setOver((o) => (o === id ? null : o))} onDrop={(e) => { e.preventDefault(); drop(id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
          style={{ display: "flex", alignItems: handleTop ? "flex-start" : "center", gap: 10, borderTop: over === id && drag !== id ? "2px solid #6cb6e6" : "2px solid transparent", opacity: drag === id ? 0.4 : 1 }}>
          <span aria-hidden style={{ cursor: "grab", color: "#c6cbd6", fontSize: 14, lineHeight: 1, userSelect: "none", paddingTop: handleTop ? 12 : 0 }} title="Drag to reorder">⋮⋮</span>
          <div style={{ flex: 1, minWidth: 0 }}>{byId.get(id)}</div>
        </div>
      ))}
    </div>
  );
}
