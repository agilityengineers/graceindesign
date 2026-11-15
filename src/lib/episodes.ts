import { EPISODES } from "@/lib/seed-data/demo";
import { fmtDate } from "@/lib/utils";

/**
 * A Home Health Series episode as the page blocks store it. `img` is the poster (thumbnail) and `video` the
 * uploaded file's link from the media library (or an upload made right in the block editor). With no video,
 * the card shows its poster and play badge as before.
 */
export type Episode = { num: string; room: string; title: string; desc: string; len: string; date: string; img: string; video: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const seedDate = (daysAgo: number) => fmtDate(new Date(Date.now() - daysAgo * 86400000), { month: "short", day: "numeric", year: "numeric" });
const fromSeed = (e: (typeof EPISODES)[number]): Episode => ({ num: e.num, room: e.room, title: e.title, desc: e.desc, len: e.len, date: seedDate(e.date), img: e.img, video: "" });

/** The starter episodes, used until the admin saves their own. */
export function defaultFeaturedEpisode(): Episode { return fromSeed(EPISODES.find((e) => e.featured) || EPISODES[0]); }
export function defaultEpisodes(): Episode[] { return EPISODES.filter((e) => !e.featured).map(fromSeed); }

export function toEpisode(v: unknown): Episode | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const e: Episode = { num: str(o.num), room: str(o.room), title: str(o.title), desc: str(o.desc), len: str(o.len), date: str(o.date), img: str(o.img), video: str(o.video) };
  return e.title || e.video || e.img ? e : null;
}
/** The featured episode a `featured_episode` block shows: its own `episode`, else the starter. */
export function featuredEpisodeOf(c: Record<string, unknown>): Episode { return toEpisode(c.episode) || defaultFeaturedEpisode(); }
/** The cards an `episode_carousel` block shows: its own `episodes` list (once saved), else the starters. */
export function carouselEpisodesOf(c: Record<string, unknown>): Episode[] {
  if (!Array.isArray(c.episodes)) return defaultEpisodes();
  return c.episodes.map(toEpisode).filter((e): e is Episode => !!e);
}
