import { ObjectId, type ClientSession, type WithId } from "mongodb";
import { emptyListing, type Candidate, type Circle, type CircleStatus, type Listing, type ListingInput, type User } from "../../shared/krug/types";
import { database } from "../db/client";

export interface UserDoc { _id: ObjectId; name: string; areaId: string; isDemo: boolean; demoKey?: string; datasetId?: string; createdAt: Date }
export interface ListingDoc extends ListingInput {
  _id: ObjectId; ownerId: ObjectId; ownerName: string; version: number;
  status: Listing["status"]; isDemo: boolean; datasetId?: string; demoKey?: string;
  createdAt: Date; updatedAt: Date; reservedBy?: ObjectId;
}
export interface CircleDoc extends Omit<Candidate, "listingIds"> {
  _id: ObjectId; listingIds: ObjectId[]; participantIds: ObjectId[];
  status: CircleStatus; revision: number; createdAt: Date; updatedAt: Date; expiresAt: Date;
  reason?: string; datasetId?: string;
}
export interface EventDoc { _id: ObjectId; circleId?: ObjectId; userId?: ObjectId; type: string; message: string; createdAt: Date; datasetId?: string; signature?: string }
export const users = database.collection<UserDoc>("krug_users");
export const sessions = database.collection<{ _id: ObjectId; tokenHash: string; userId: ObjectId; expiresAt: Date }>("krug_sessions");
export const listings = database.collection<ListingDoc>("krug_listings");
export const circles = database.collection<CircleDoc>("krug_circles");
export const events = database.collection<EventDoc>("krug_events");

export const userDto = (doc: UserDoc): User => ({ id: doc._id.toHexString(), name: doc.name, areaId: doc.areaId, isDemo: doc.isDemo, demoKey: doc.demoKey });
export const listingDto = (doc: WithId<ListingDoc>): Listing => ({ ...Object.fromEntries(Object.keys(emptyListing()).map((key) => [key, doc[key as keyof ListingInput]])) as unknown as ListingInput,
  id: doc._id.toHexString(), ownerId: doc.ownerId.toHexString(), ownerName: doc.ownerName, version: doc.version, status: doc.status, isDemo: doc.isDemo, demoKey: doc.demoKey,
  reservedBy: doc.reservedBy?.toHexString(), createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString() });
export const circleDto = (doc: CircleDoc): Circle => ({ id: doc._id.toHexString(), signature: doc.signature, versions: doc.versions, members: doc.members,
  commonAreas: doc.commonAreas, commonAvailability: doc.commonAvailability, score: doc.score, minScore: doc.minScore, status: doc.status, revision: doc.revision, reason: doc.reason,
  listingIds: doc.listingIds.map((id) => id.toHexString()),
  createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString(), expiresAt: doc.expiresAt.toISOString() });

export async function initializeKrug() {
  await users.createIndex({ datasetId: 1, demoKey: 1 }, { unique: true, partialFilterExpression: { isDemo: true } });
  await sessions.createIndex({ tokenHash: 1 }, { unique: true });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await listings.createIndex({ status: 1, itemTypeId: 1, createdAt: -1 });
  await listings.createIndex({ ownerId: 1, createdAt: -1 });
  await listings.createIndex({ datasetId: 1, demoKey: 1 }, { unique: true, partialFilterExpression: { demoKey: { $type: "string" } } });
  await circles.createIndex({ signature: 1 }, { unique: true });
  await circles.createIndex({ participantIds: 1, status: 1, updatedAt: -1 });
  await circles.createIndex({ listingIds: 1, status: 1 });
  await circles.createIndex({ expiresAt: 1, status: 1 });
  await events.createIndex({ circleId: 1, createdAt: 1 });
  await events.createIndex({ userId: 1, type: 1, signature: 1 }, { unique: true, partialFilterExpression: { type: "candidate_view", signature: { $type: "string" } } });
}
export async function addEvent(type: string, message: string, options: { circle?: CircleDoc; userId?: ObjectId; session?: ClientSession; datasetId?: string } = {}) {
  await events.insertOne({ _id: new ObjectId(), type, message, circleId: options.circle?._id, userId: options.userId,
    datasetId: options.circle?.datasetId ?? options.datasetId, createdAt: new Date() }, { session: options.session });
}
