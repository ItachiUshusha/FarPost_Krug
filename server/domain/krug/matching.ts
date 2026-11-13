import { areas, conditions, itemTypes } from "../../../shared/krug/reference";
import type { Listing, TimeWindow } from "../../../shared/krug/types";

const stops = new Set(["и", "в", "на", "с", "по", "для", "или", "мне", "хочу", "нужен", "нужна", "нужно", "нужны", "ищу", "обмен", "обменяю", "состоянии", "хорошем", "отдам", "получить"]);
export function normalize(text: string) { return text.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim(); }
export function words(text: string) { return normalize(text).split(" ").filter((word) => word && !stops.has(word)); }
export function detectTypes(text: string) {
  const positive: string[] = []; const negative: string[] = [];
  for (const clause of text.split(/[,.!?;\n]|\s+(?:но|а|зато)\s+/iu)) {
    const tokens = normalize(clause).split(" ");
    for (const type of itemTypes) {
    for (let i = 0; i < tokens.length; i++) {
      if (!(type.aliases as readonly string[]).includes(tokens[i])) continue;
      const prefix = tokens.slice(Math.max(0, i - 3), i);
      const excluded = prefix.includes("не") || prefix.includes("кроме") || prefix.includes("без");
      (excluded ? negative : positive).push(type.id);
    }
    }
  }
  return { positive: [...new Set(positive)], negative: [...new Set(negative)] };
}
function prepare(listing: Listing) {
  const offered = normalize(`${listing.title} ${listing.description}`);
  return { parsed: detectTypes(listing.wantText), offered, offeredWords: new Set(words(offered)), rank: conditions.find((item) => item.id === listing.condition)?.rank ?? -1,
    minimumRank: conditions.find((item) => item.id === listing.minimumCondition)?.rank ?? 0,
    required: listing.requiredKeywords.map(normalize), excluded: listing.excludedKeywords.map(normalize), preferred: listing.preferredKeywords.map(normalize),
    wishWords: words(listing.wantText).filter((token) => token.length >= 4) };
}
function matchPrepared(source: Listing, target: Listing, offer: ReturnType<typeof prepare>, wish: ReturnType<typeof prepare>): { score: number; reasons: string[] } | null {
  if (source.id === target.id || source.ownerId === target.ownerId || source.status !== "active" || target.status !== "active") return null;
  const parsed = wish.parsed;
  if (parsed.negative.includes(source.itemTypeId)) return null;
  const desired = target.wantedTypeIds.length ? target.wantedTypeIds : parsed.positive;
  if (desired.length && !desired.includes(source.itemTypeId)) return null;
  if (target.wantedCategoryIds.length && !target.wantedCategoryIds.includes(source.categoryId)) return null;
  if (offer.rank < wish.minimumRank) return null;
  if (wish.required.some((key) => !offer.offered.includes(key))) return null;
  if (wish.excluded.some((key) => offer.offered.includes(key))) return null;
  let score = desired.includes(source.itemTypeId) ? 85 : target.wantedCategoryIds.includes(source.categoryId) ? 70 : 0;
  if (!score) {
    if (parsed.negative.length) return null;
    const useful = wish.wishWords;
    const common = useful.filter((token) => offer.offeredWords.has(token));
    if (!common.length || common.length / Math.max(1, useful.length) < 0.5) return null;
    score = 60 + Math.min(15, common.length * 5);
  }
  score = Math.min(100, score + wish.preferred.filter((key) => offer.offered.includes(key)).length * 3);
  return { score, reasons: [desired.length ? "Подходит тип вещи" : target.wantedCategoryIds.length ? "Подходит категория" : "Совпали слова в описании", "Состояние подходит", ...(target.requiredKeywords.length ? ["Обязательные признаки совпали"] : [])] };
}
export function matchOffer(source: Listing, target: Listing) { return matchPrepared(source, target, prepare(source), prepare(target)); }
// Preparation belongs to one search snapshot, so edits cannot leave a stale cache.
export function createOfferMatcher(listings: Listing[]) {
  const prepared = new Map(listings.map((listing) => [listing.id, prepare(listing)]));
  return (source: Listing, target: Listing) => matchPrepared(source, target, prepared.get(source.id)!, prepared.get(target.id)!);
}
export function commonConditions(listings: Listing[], now = Date.now()) {
  let zones = areas.map((area) => area.id as string);
  let windows: TimeWindow[] | null = null;
  for (const listing of listings) {
    if (listing.maxParticipants < listings.length) return null;
    const allowed = listing.pickupOnly ? [listing.areaId] : listing.meetingAreaIds;
    if (allowed.length) zones = zones.filter((zone) => allowed.includes(zone));
    if (!zones.length) return null;
    if (listing.availability.length) {
      const available = listing.availability.map((window) => ({ start: new Date(Math.max(now, Date.parse(window.start))).toISOString(), end: window.end }))
        .filter((window) => Date.parse(window.end) - Date.parse(window.start) >= 15 * 60_000);
      if (windows === null) windows = available;
      else {
        const intersections: TimeWindow[] = [];
        for (const left of windows) for (const right of available) {
          const start = Math.max(Date.parse(left.start), Date.parse(right.start));
          const end = Math.min(Date.parse(left.end), Date.parse(right.end));
          if (end - start >= 15 * 60_000) intersections.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
        }
        windows = intersections;
      }
      if (!windows.length) return null;
    }
  }
  return { commonAreas: zones, commonAvailability: windows ?? [] };
}
