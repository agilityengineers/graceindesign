/** Pre-consult checklist PDF (pdf-lib, pure JS). */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readCommunicationLogo } from "./communication-brand";

export async function buildChecklistPdf(opts: { name: string; pathLabel: string; consultType: string; when: string; items?: string[] }) {
  const pdf = await PDFDocument.create();
  const logo = await pdf.embedPng(await readCommunicationLogo());
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const navy = rgb(0.102, 0.133, 0.22), sky = rgb(0.424, 0.714, 0.902), body = rgb(0.294, 0.333, 0.412);
  let y = 740;
  page.drawRectangle({ x: 0, y: 720, width: 612, height: 72, color: navy });
  page.drawRectangle({ x: 44, y: 745, width: 224, height: 43, color: rgb(1, 1, 1) });
  page.drawImage(logo, { x: 48, y: 748, width: 216, height: 216 * logo.height / logo.width });
  page.drawText("Pre-consultation checklist", { x: 48, y: 730, size: 10, font, color: sky });
  y = 680;
  page.drawText(`Prepared for ${opts.name}`, { x: 48, y, size: 22, font: serif, color: navy }); y -= 26;
  page.drawText(`${opts.consultType} · ${opts.pathLabel} · ${opts.when}`, { x: 48, y, size: 11, font, color: body }); y -= 34;
  page.drawText("Before we talk, it helps to have these ready:", { x: 48, y, size: 12, font: bold, color: navy }); y -= 22;
  const items = opts.items || DEFAULT_ITEMS;
  for (const item of items) {
    page.drawRectangle({ x: 48, y: y - 2, width: 12, height: 12, borderColor: navy, borderWidth: 1 });
    const lines = wrap(item, 78);
    for (const [i, line] of lines.entries()) { page.drawText(line, { x: 68, y: y - i * 14, size: 11, font, color: body }); }
    y -= 14 * lines.length + 10;
  }
  y -= 10;
  page.drawText("What happens on the call", { x: 48, y, size: 12, font: bold, color: navy }); y -= 20;
  for (const line of ["We listen first: your goals, budget and timeline.", "We ask a few questions about the space and who uses it.", "You leave with a clear next step: a consultation, an assessment, or honest advice."]) {
    page.drawText(`• ${line}`, { x: 52, y, size: 11, font, color: body }); y -= 16;
  }
  page.drawText("(770) 691-1600 · support@graceindesign.net · graceindesign.net", { x: 48, y: 48, size: 9, font, color: rgb(0.55, 0.58, 0.66) });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

const DEFAULT_ITEMS = [
  "A few photos of the space (phone photos are perfect).",
  "Rough measurements, or the age of the home and any known constraints.",
  "What isn't working today, and what 'done' would look like for you.",
  "A budget range you're comfortable with, even if it's a guess.",
  "Your ideal timeline and any dates that matter (move-in, opening, a visit).",
  "Who else is involved in the decision.",
];

function wrap(text: string, max: number) {
  const words = text.split(" "); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

/** Proposal PDF (used for the signed copy download and third-party e-sign envelopes). */
export async function buildProposalPdf(opts: { title: string; body: string; amount?: string | null; recipientName?: string | null; status: string; signedAt?: Date | null; signerName?: string | null; signerIp?: string | null; code?: string }) {
  const pdf = await PDFDocument.create();
  const logo = await pdf.embedPng(await readCommunicationLogo());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const navy = rgb(0.102, 0.133, 0.22), sky = rgb(0.424, 0.714, 0.902), body = rgb(0.294, 0.333, 0.412);
  let page = pdf.addPage([612, 792]); let y = 740;
  const header = () => { page.drawRectangle({ x: 0, y: 720, width: 612, height: 72, color: navy }); page.drawRectangle({ x: 44, y: 745, width: 224, height: 43, color: rgb(1, 1, 1) }); page.drawImage(logo, { x: 48, y: 748, width: 216, height: 216 * logo.height / logo.width }); page.drawText("Proposal", { x: 48, y: 730, size: 10, font, color: sky }); y = 680; };
  const newPage = () => { page = pdf.addPage([612, 792]); header(); };
  const line = (text: string, size = 11, f = font, color = body) => { if (y < 70) newPage(); page.drawText(text, { x: 48, y, size, font: f, color }); y -= size + 5; };
  header();
  line(opts.title, 22, serif, navy); y -= 6;
  if (opts.recipientName) line(`Prepared for ${opts.recipientName}`, 11);
  if (opts.amount) line(`Investment: $${Number(opts.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 12, bold, navy);
  y -= 10;
  const text = opts.body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "");
  for (const para of text.split(/\n/)) { if (!para.trim()) { y -= 8; continue; } for (const l of wrap(para, 92)) line(l); }
  y -= 20;
  if (opts.status === "signed") { line("Signed electronically", 12, bold, navy); line(`${opts.signerName || ""} · ${opts.signedAt ? opts.signedAt.toISOString() : ""}${opts.signerIp ? ` · IP ${opts.signerIp}` : ""}`, 10); }
  else line("Awaiting signature", 12, bold, navy);
  page.drawText("(770) 691-1600 · support@graceindesign.net · graceindesign.net", { x: 48, y: 48, size: 9, font, color: rgb(0.55, 0.58, 0.66) });
  return Buffer.from(await pdf.save());
}
