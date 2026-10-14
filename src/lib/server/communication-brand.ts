import { readFile } from "node:fs/promises";
import path from "node:path";

// The original artwork used by SiteNav; never approximate the wordmark with text.
export const COMMUNICATION_LOGO_PATH = "/assets/logo-dark-transparent.png";
export const COMMUNICATION_LOGO_CID = "grace-in-design-logo";
export const COMMUNICATION_LOGO_HTML = `<img src="cid:${COMMUNICATION_LOGO_CID}" alt="Grace In Design" width="280" height="49" style="display:block;width:280px;max-width:100%;height:auto;border:0;margin:0 0 24px" />`;

export function readCommunicationLogo() {
  return readFile(path.join(process.cwd(), "public", COMMUNICATION_LOGO_PATH));
}

export async function communicationLogoAttachment() {
  return {
    filename: "grace-in-design-logo.png",
    type: "image/png",
    content: (await readCommunicationLogo()).toString("base64"),
    disposition: "inline" as const,
    content_id: COMMUNICATION_LOGO_CID,
  };
}
