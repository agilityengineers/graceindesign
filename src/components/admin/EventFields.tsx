"use client";
import { useState } from "react";
import { EVENT_REGIONS, US_STATES, type EventRegion } from "@/lib/events";

/**
 * Region picker for an event, with the place fields that depend on it: United States → state + city,
 * Caribbean → country. Renders grid cells (labels), so it drops into the existing admin form grids.
 */
export function EventRegionFields({ region, state, city, country, countries }: { region?: string | null; state?: string | null; city?: string | null; country?: string | null; countries: string[] }) {
  const [r, setR] = useState<EventRegion>(region === "us" ? "us" : "caribbean");
  const cls = "admin-input admin-input-sm";
  const countryOptions = Array.from(new Set([...(country && country !== "United States" ? [country] : []), ...countries, "Regional", "Diaspora"]));
  return (<>
    <label className="label label-caps">Region
      <select name="region" value={r} onChange={(e) => setR(e.target.value as EventRegion)} className={cls}>
        {EVENT_REGIONS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
      </select>
    </label>
    {r === "us" ? (<>
      <label className="label label-caps">State
        <select name="state" defaultValue={state || ""} required className={cls}>
          <option value="" disabled>Choose a state…</option>
          {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      <label className="label label-caps">City<input name="city" defaultValue={city || ""} placeholder="e.g. Atlanta" className={cls} /></label>
      <input type="hidden" name="country" value="United States" />
    </>) : (
      <label className="label label-caps">Country
        <select name="country" defaultValue={country && country !== "United States" ? country : "Jamaica"} className={cls}>
          {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    )}
  </>);
}

/** Copies an event's public link (shown on approved events in the admin list). */
export function CopyEventLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="link-btn" title={url} onClick={async (e) => { e.preventDefault(); e.stopPropagation(); try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1800); } catch { window.prompt("Copy this link:", url); } }}>{done ? "Copied" : "Copy link"}</button>;
}
