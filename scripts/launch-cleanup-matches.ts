import { CC_SUBSCRIBERS, SOCIAL_DEMO } from "../src/lib/seed-data/demo";

const empty = (v: unknown) => v != null && typeof v === "object" && Object.keys(v).length === 0;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function isSeedSocialPost(p: {
  body: string; networks: string[]; status: string; imageUrl: string | null;
  linkUrl: string | null; originPostId: number | null; results: unknown; metrics: unknown;
}) {
  return !p.imageUrl && !p.linkUrl && p.originPostId === null && empty(p.results) &&
    SOCIAL_DEMO.posts.some(([body, networks, , , status]) =>
      p.body === body && same(p.networks, networks) && p.status === status &&
      same(p.metrics, status === "published"
        ? { instagram: { impressions: 1820, engagements: 131, clicks: 34 } } : {}));
}

export function isSeedSocialAccount(a: {
  network: string; displayName: string | null; followers: number | null; status: string;
  accessTokenEnc: string | null; refreshTokenEnc: string | null; externalId: string | null;
  tokenExpiresAt: Date | null; lastSyncedAt: Date | null; meta: unknown;
}) {
  return !a.accessTokenEnc && !a.refreshTokenEnc && !a.externalId &&
    !a.tokenExpiresAt && !a.lastSyncedAt && empty(a.meta) &&
    SOCIAL_DEMO.networks.some(([network, display, followers, status]) =>
      a.network === network && a.displayName === display &&
      a.followers === followers && a.status === status);
}

// Reproduce the original seed's finite padding list, not an email-domain wildcard.
const padded = [
  ["Living in Jamaica", "living-i", 163],
  ["In the diaspora, supporting family back home", "in-the-d", 189],
  ["A caregiver or care professional", "a-caregi", 47],
  ["A community organization or agency", "a-commun", 14],
] as const;

export function isSeedSubscriber(s: {
  email: string; segment: string; location: string | null; country: string | null;
  unsubscribedAt: Date | null;
}) {
  if (s.unsubscribedAt) return false;
  if (CC_SUBSCRIBERS.some(([email, segment, location]) =>
    s.email === email && s.segment === segment && s.location === location &&
    s.country === (location.includes("Jamaica") ? "Jamaica" : "Diaspora"))) return true;
  return padded.some(([segment, prefix, count]) =>
    s.segment === segment &&
    s.location === (segment.includes("Jamaica") || segment.includes("caregiver") ? "Jamaica" : "Atlanta, USA") &&
    s.country === (segment.includes("Jamaica") ? "Jamaica" : "Diaspora") &&
    Array.from({ length: count }, (_, i) => `subscriber${prefix}${i}@example.com`).includes(s.email));
}
