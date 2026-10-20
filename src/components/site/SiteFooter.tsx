import Link from "next/link";
import { Social } from "@/components/ui/Icons";
import type { SocialLink, ContactSettings } from "@/lib/server/settings";

const ICONS: Record<string, () => React.JSX.Element> = { Facebook: Social.Facebook, Instagram: Social.Instagram, LinkedIn: Social.LinkedIn, Pinterest: Social.Pinterest, YouTube: Social.YouTube };

export default function SiteFooter({ contact, footer, social, isAdmin, etsyUrl }: { contact: ContactSettings; footer: { blurb: string; copyright: string }; social: SocialLink[]; isAdmin: boolean; etsyUrl: string }) {
  return (
    <footer className="gx" style={{ background: "#1a2238", color: "#fff", paddingTop: 80, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 56 }}>
      <div className="footer-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <img src="/assets/logo-white-on-dark.png" alt="Grace In Design" style={{ height: 34, width: "auto", display: "block", alignSelf: "flex-start" }} />
          <p style={{ maxWidth: 360, fontSize: 14, lineHeight: 1.75, color: "#c6cbd6" }}>{footer.blurb}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {social.filter((s) => s.enabled).map((s) => { const I = ICONS[s.name]; return I ? <a key={s.name} href={s.url} target="_blank" rel="noreferrer" aria-label={s.name} className="social-circle"><I /></a> : null; })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="eyebrow eyebrow-sky" style={{ letterSpacing: ".16em" }}>Company</span>
          <Link href="/" style={{ color: "#fff", fontSize: 14 }}>Home</Link>
          <Link href="/about" style={{ color: "#c6cbd6", fontSize: 14 }}>About</Link>
          <Link href="/services" style={{ color: "#c6cbd6", fontSize: 14 }}>Services</Link>
          <Link href="/caribbean-connection" style={{ color: "#c6cbd6", fontSize: 14 }}>Caribbean Connection</Link>
          <Link href="/news" style={{ color: "#c6cbd6", fontSize: 14 }}>News &amp; Insights</Link>
          <Link href="/contact" style={{ color: "#c6cbd6", fontSize: 14 }}>Contact</Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="eyebrow eyebrow-sky" style={{ letterSpacing: ".16em" }}>Healthy Home Resources</span>
          <Link href="/healthy-home-resources/aip-products" style={{ color: "#c6cbd6", fontSize: 14 }}>AIP Products</Link>
          <Link href="/healthy-home-resources/wellness" style={{ color: "#c6cbd6", fontSize: 14 }}>WELLness Resources</Link>
          <Link href="/healthy-home-resources/home-health-series" style={{ color: "#c6cbd6", fontSize: 14 }}>Home Health Series</Link>
          <Link href="/healthy-home-resources/aip-partners" style={{ color: "#c6cbd6", fontSize: 14 }}>AIP Partners</Link>
          <a href={etsyUrl} target="_blank" rel="noreferrer" style={{ color: "#c6cbd6", fontSize: 14 }}>Etsy Shop</a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span className="eyebrow eyebrow-sky" style={{ letterSpacing: ".16em" }}>Contact</span>
          <a href={`mailto:${contact.email}`} style={{ color: "#fff", fontSize: 14 }}>{contact.email}</a>
          <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} style={{ color: "#fff", fontSize: 14 }}>{contact.phone}</a>
          {(contact.address || contact.addressLine2) && <span style={{ color: "#c6cbd6", fontSize: 14, lineHeight: 1.6 }}>{contact.address}{contact.address && contact.addressLine2 && <br />}{contact.addressLine2}</span>}
          <span style={{ color: "#c6cbd6", fontSize: 13, lineHeight: 1.6 }}>{contact.hours}<br />{contact.consultationsNote}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", paddingTop: 28, borderTop: "1px solid rgba(255,255,255,.12)", fontSize: 12.5, color: "#8c95a8" }}>
        <span>{footer.copyright}</span>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <Link href="/privacy" className="tap" style={{ color: "#8c95a8" }}>Privacy Policy</Link>
          <Link href="/terms" className="tap" style={{ color: "#8c95a8" }}>Terms</Link>
          <Link href="/accessibility" className="tap" style={{ color: "#8c95a8" }}>Accessibility</Link>
          {isAdmin && <Link href="/admin" style={{ color: "#6cb6e6", fontWeight: 600 }}>Admin</Link>}
        </div>
      </div>
    </footer>
  );
}
