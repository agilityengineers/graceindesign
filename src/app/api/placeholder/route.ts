/** Branded SVG placeholder for image slots that have no file yet. */
export const dynamic = "force-static";
export async function GET(req: Request) {
  const label = (new URL(req.url).searchParams.get("label") || "Image").slice(0, 60).replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a2238"/><stop offset="1" stop-color="#2d3a5e"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><circle cx="1380" cy="140" r="260" fill="#6cb6e6" opacity=".12"/><text x="80" y="880" font-family="Georgia,serif" font-size="64" fill="#6cb6e6">GRACE <tspan fill="#1a2238" style="font-family:Arial,sans-serif;font-weight:700" dx="6">IN</tspan> DESIGN</text><rect x="316" y="828" width="86" height="66" fill="#6cb6e6"/><text x="80" y="940" font-family="Arial,Helvetica,sans-serif" font-size="26" fill="#c6cbd6">${label}</text></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
}
