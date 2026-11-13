import type { Candidate, Listing, SearchResult } from "../../../shared/krug/types";
import { commonConditions, createOfferMatcher, matchOffer } from "./matching";

export function signature(listings: Listing[]) {
  const rotations = listings.map((_, index) => [...listings.slice(index), ...listings.slice(0, index)].map((listing) => [listing.id, listing.version]));
  return rotations.map((rotation) => JSON.stringify(rotation)).sort()[0];
}
export function makeCandidate(path: Listing[], match = matchOffer): Candidate | null {
  if (path.length < 2 || path.length > 4 || new Set(path.map((listing) => listing.id)).size !== path.length || new Set(path.map((listing) => listing.ownerId)).size !== path.length) return null;
  const compatibility = commonConditions(path);
  if (!compatibility) return null;
  const matches = path.map((listing, index) => match(listing, path[(index + 1) % path.length]));
  if (matches.some((match) => !match)) return null;
  const scores = matches.map((match) => match!.score);
  return { signature: signature(path), listingIds: path.map((listing) => listing.id), versions: path.map((listing) => listing.version),
    ...compatibility, score: Math.round(scores.reduce((sum, value) => sum + value, 0) / path.length), minScore: Math.min(...scores),
    members: path.map((listing, index) => {
      const previous = path[(index + path.length - 1) % path.length];
      const next = path[(index + 1) % path.length];
      return { userId: listing.ownerId, name: listing.ownerName, listingId: listing.id, giveTitle: listing.title, giveTypeId: listing.itemTypeId,
        receiveTitle: previous.title, receiveTypeId: previous.itemTypeId, receiveFromId: previous.ownerId,
        giveToId: next.ownerId, decision: "pending", reasons: matches[(index + path.length - 1) % path.length]!.reasons };
    }) };
}
export function findCircles(input: Listing[], rootId?: string, options: { maxParticipants?: number; limit?: number; excluded?: Set<string>; maxExpansions?: number; timeLimitMs?: number; maxNodes?: number } = {}): SearchResult {
  const start = performance.now();
  const maxNodes = options.maxNodes ?? 250;
  const listings = input.filter((listing) => listing.status === "active").slice(0, maxNodes);
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  const edges = new Map<string, string[]>();
  const match = createOfferMatcher(listings);
  for (const source of listings) edges.set(source.id, listings.filter((target) => match(source, target)).map((target) => target.id));
  const found = new Map<string, Candidate>();
  let examined = 0; let truncated = input.length > maxNodes;
  let stopped = false;
  const roots = rootId ? listings.filter((listing) => listing.id === rootId) : listings;
  for (const root of roots) {
    const visit = (path: Listing[]) => {
      if (stopped) return;
      if (++examined > (options.maxExpansions ?? 100_000) || performance.now() - start > (options.timeLimitMs ?? 750)) { truncated = true; stopped = true; return; }
      const last = path.at(-1)!;
      if (path.length >= 2 && edges.get(last.id)!.includes(root.id)) {
        const candidate = makeCandidate(path, match);
        if (candidate && !options.excluded?.has(candidate.signature) && !found.has(candidate.signature)) found.set(candidate.signature, candidate);
      }
      if (path.length >= (options.maxParticipants ?? 4)) return;
      for (const nextId of edges.get(last.id)!) {
        const next = byId.get(nextId)!;
        if (!path.some((listing) => listing.ownerId === next.ownerId)) visit([...path, next]);
      }
    };
    visit([root]);
    if (stopped) break;
  }
  const candidates = [...found.values()].sort((a, b) => a.members.length - b.members.length || b.minScore - a.minScore || b.score - a.score || a.signature.localeCompare(b.signature));
  return { candidates: candidates.slice(0, options.limit ?? 30), total: candidates.length, truncated,
    elapsedMs: Math.round((performance.now() - start) * 100) / 100, examined, inputCount: listings.length };
}
