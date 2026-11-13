export interface TimeWindow { start: string; end: string }
export interface User { id: string; name: string; areaId: string; isDemo: boolean; demoKey?: string }
export type ListingStatus = "active" | "reserved" | "archived";
export interface ListingInput {
  title: string; description: string; itemTypeId: string; categoryId: string;
  condition: string; wantText: string; wantedTypeIds: string[]; wantedCategoryIds: string[];
  requiredKeywords: string[]; excludedKeywords: string[]; preferredKeywords: string[];
  minimumCondition: string; areaId: string; meetingAreaIds: string[]; pickupOnly: boolean;
  availability: TimeWindow[]; maxParticipants: number; notes: string;
}
export interface Listing extends ListingInput {
  id: string; ownerId: string; ownerName: string; version: number; status: ListingStatus;
  isDemo: boolean; demoKey?: string; createdAt: string; updatedAt: string; reservedBy?: string;
}
export type Decision = "pending" | "accepted" | "declined";
export type CircleStatus = "proposed" | "agreed" | "declined" | "cancelled" | "expired" | "invalidated";
export interface CircleMember {
  userId: string; name: string; listingId: string; giveTitle: string; giveTypeId: string;
  receiveTitle: string; receiveTypeId: string; receiveFromId: string; giveToId: string;
  decision: Decision; reasons: string[];
}
export interface Candidate {
  signature: string; listingIds: string[]; versions: number[]; members: CircleMember[];
  commonAreas: string[]; commonAvailability: TimeWindow[]; score: number; minScore: number;
}
export interface Circle extends Candidate {
  id: string; status: CircleStatus; revision: number; createdAt: string; updatedAt: string;
  expiresAt: string; reason?: string;
}
export interface CircleEvent { id: string; circleId: string; type: string; message: string; createdAt: string }
export interface SearchResult {
  candidates: Candidate[]; total: number; truncated: boolean; elapsedMs: number;
  examined: number; inputCount: number;
}
export interface Metrics {
  listings: number; owners: number; directOwners: number; multiwayOwners: number;
  additionalOwners: number; cycles: Record<string, number>; elapsedMs: number;
  truncated: boolean; isDemo: boolean; agreed: number; searches: number; declines: number; views: number; responses: number;
}

export function emptyListing(): ListingInput {
  return { title: "", description: "", itemTypeId: "", categoryId: "", condition: "good", wantText: "",
    wantedTypeIds: [], wantedCategoryIds: [], requiredKeywords: [], excludedKeywords: [], preferredKeywords: [],
    minimumCondition: "repair", areaId: "center", meetingAreaIds: [], pickupOnly: false,
    availability: [], maxParticipants: 4, notes: "" };
}
