import { ObjectId, type ClientSession } from "mongodb";
import { config } from "../config";
import { mongoClient } from "../db/client";
import { ApiError } from "../lib/errors";
import { addEvent, circles, circleDto, events, listings, listingDto, users, type CircleDoc, type UserDoc } from "../repositories/krug";
import type { ListingInput, Metrics } from "../../shared/krug/types";
import { findCircles, makeCandidate } from "../domain/krug/graph";
import { DEMO_DATASET, demoInput, demoPeople } from "../domain/krug/demo";

export async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = mongoClient.startSession();
  try { return (await session.withTransaction(() => work(session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10_000 }))!; }
  finally { await session.endSession(); }
}

async function closeCircle(circle: CircleDoc, status: CircleDoc["status"], reason: string, session: ClientSession, userId?: ObjectId) {
  await listings.updateMany({ reservedBy: circle._id, status: "reserved" }, { $set: { status: "active", updatedAt: new Date() }, $unset: { reservedBy: "" } }, { session });
  await circles.updateOne({ _id: circle._id }, { $set: { status, reason, updatedAt: new Date() }, $inc: { revision: 1 } }, { session });
  await addEvent(status, reason, { circle, session, userId });
}
export async function expireCircles() {
  const expired = await circles.find({ status: { $in: ["proposed", "agreed"] }, expiresAt: { $lte: new Date() } }).limit(100).toArray();
  for (const candidate of expired) await transaction(async (session) => {
    const current = await circles.findOne({ _id: candidate._id, status: { $in: ["proposed", "agreed"] }, expiresAt: { $lte: new Date() } }, { session });
    if (current) await closeCircle(current, "expired", "Срок предложения истёк. Вещи снова доступны для поиска.", session);
  });
}
export async function createListing(input: ListingInput, user: UserDoc) {
  const now = new Date();
  const document = { ...input, _id: new ObjectId(), ownerId: user._id, ownerName: user.name, isDemo: user.isDemo,
    datasetId: user.datasetId, status: "active" as const, version: 1, createdAt: now, updatedAt: now };
  await listings.insertOne(document);
  return listingDto(document);
}
export async function updateListing(id: ObjectId, input: ListingInput | null, version: number, user: UserDoc) {
  await expireCircles();
  return transaction(async (session) => {
    const current = await listings.findOne({ _id: id }, { session });
    if (!current) throw new ApiError(404, "Заявка не найдена.");
    if (!current.ownerId.equals(user._id)) throw new ApiError(403, "Изменять можно только свою заявку.");
    if (current.status === "reserved") throw new ApiError(409, "Вещь закреплена за кругом. Сначала отмените договорённость.");
    if (current.version !== version) throw new ApiError(409, "Заявка уже изменилась. Обновите страницу.");
    const updated = await listings.findOneAndUpdate({ _id: id, version }, { $set: { ...(input ?? {}), status: input ? current.status : "archived", updatedAt: new Date() }, $inc: { version: 1 } }, { session, returnDocument: "after" });
    if (!updated) throw new ApiError(409, "Заявка уже изменилась.");
    const affected = await circles.find({ listingIds: id, status: "proposed" }, { session }).toArray();
    for (const circle of affected) await closeCircle(circle, "invalidated", "Участник изменил или архивировал заявку. Найдите круг заново.", session, user._id);
    return listingDto(updated);
  });
}
export async function searchMatches(id: string, user: UserDoc, maxParticipants: number, limit: number) {
  await expireCircles();
  const root = await listings.findOne({ _id: new ObjectId(id) });
  if (!root) throw new ApiError(404, "Заявка не найдена.");
  if (!root.ownerId.equals(user._id)) throw new ApiError(403, "Поиск доступен для вашей заявки.");
  if (root.status !== "active") throw new ApiError(409, "Эта вещь сейчас недоступна для нового обмена.");
  const recent = await listings.find({ status: "active" }).sort({ createdAt: -1 }).limit(251).toArray();
  const input = [root, ...recent.filter((listing) => !listing._id.equals(root._id))];
  const rejected = await circles.find({ status: { $in: ["declined", "cancelled", "expired", "invalidated"] }, listingIds: root._id }, { projection: { signature: 1 } }).toArray();
  const result = findCircles(input.map(listingDto), id, { maxParticipants, limit, excluded: new Set(rejected.map((circle) => circle.signature)) });
  await addEvent("search", "Поиск обменного круга", { userId: user._id, datasetId: user.datasetId });
  return result;
}
export async function createCircle(ids: string[], versions: number[], user: UserDoc) {
  if (ids.length !== versions.length || new Set(ids).size !== ids.length) throw new ApiError(400, "Некорректный набор участников.");
  await expireCircles();
  return transaction(async (session) => {
    const documents = [];
    for (let i = 0; i < ids.length; i++) {
      const document = await listings.findOne({ _id: new ObjectId(ids[i]) }, { session });
      if (!document || document.version !== versions[i] || document.status !== "active") throw new ApiError(409, "Одна из заявок изменилась или уже занята. Повторите поиск.");
      documents.push(document);
    }
    if (!documents.some((listing) => listing.ownerId.equals(user._id))) throw new ApiError(403, "Вы не участник этого круга.");
    const candidate = makeCandidate(documents.map(listingDto));
    if (!candidate) throw new ApiError(409, "Условия участников больше не образуют подходящий круг.");
    const previous = await circles.findOne({ signature: candidate.signature }, { session });
    if (previous) {
      if (previous.status !== "proposed") throw new ApiError(409, "Этот вариант уже закрыт. Поищите другую комбинацию.");
      return circleDto(previous);
    }
    const now = new Date();
    const document: CircleDoc = { ...candidate, _id: new ObjectId(), listingIds: ids.map((id) => new ObjectId(id)), participantIds: documents.map((listing) => listing.ownerId),
      status: "proposed", revision: 1, createdAt: now, updatedAt: now, expiresAt: new Date(Date.now() + config.reservationHours * 3_600_000),
      datasetId: documents.every((listing) => listing.datasetId === DEMO_DATASET) ? DEMO_DATASET : undefined };
    await circles.insertOne(document, { session });
    await addEvent("proposed", "Круг найден. Участники могут подтвердить интерес.", { circle: document, session, userId: user._id });
    return circleDto(document);
  });
}
export async function respondToCircle(id: ObjectId, decision: "accept" | "decline", user: UserDoc) {
  await expireCircles();
  return transaction(async (session) => {
    const circle = await circles.findOne({ _id: id }, { session });
    if (!circle) throw new ApiError(404, "Круг не найден.");
    const member = circle.members.find((person) => person.userId === user._id.toHexString());
    if (!member) throw new ApiError(403, "Отвечать могут только участники круга.");
    if ((circle.status === "agreed" && decision === "accept" && member.decision === "accepted") || (circle.status === "declined" && decision === "decline" && member.decision === "declined")) return circleDto(circle);
    if (circle.status !== "proposed") throw new ApiError(409, "Состояние круга уже изменилось. Обновите страницу.");
    if (member.decision === "accepted" && decision === "accept") return circleDto(circle);
    const documents = [];
    for (let i = 0; i < circle.listingIds.length; i++) {
      const listing = await listings.findOne({ _id: circle.listingIds[i], version: circle.versions[i], status: "active" }, { session });
      if (!listing) throw new ApiError(409, "Вещь или условия изменились. Найдите другой круг.");
      documents.push(listing);
    }
    if (!makeCandidate(documents.map(listingDto))) throw new ApiError(409, "Общие условия больше не подходят.");
    member.decision = decision === "accept" ? "accepted" : "declined";
    const now = new Date();
    const allAccepted = circle.members.every((person) => person.decision === "accepted");
    const status = decision === "decline" ? "declined" : allAccepted ? "agreed" : "proposed";
    if (allAccepted) {
      for (let i = 0; i < circle.listingIds.length; i++) {
        const result = await listings.updateOne({ _id: circle.listingIds[i], status: "active", version: circle.versions[i] }, { $set: { status: "reserved", reservedBy: circle._id, updatedAt: now } }, { session });
        if (result.modifiedCount !== 1) throw new ApiError(409, "Вещь уже закреплена за другим кругом.");
      }
      const competing = await circles.find({ _id: { $ne: circle._id }, status: "proposed", listingIds: { $in: circle.listingIds } }, { session }).toArray();
      for (const other of competing) await closeCircle(other, "invalidated", "Одна из вещей закреплена за другим согласованным кругом.", session);
    }
    const reason = decision === "decline" ? `${user.name} отказался от этого варианта. Другие обмены остаются возможны.` : undefined;
    const updated = await circles.findOneAndUpdate({ _id: id, revision: circle.revision, status: "proposed" }, { $set: { members: circle.members, status, updatedAt: now,
      ...(reason ? { reason } : {}), ...(allAccepted ? { expiresAt: new Date(Date.now() + config.reservationHours * 3_600_000) } : {}) }, $inc: { revision: 1 } }, { session, returnDocument: "after" });
    if (!updated) throw new ApiError(409, "Другой участник уже ответил. Обновите состояние.");
    await addEvent(decision === "decline" ? "declined" : allAccepted ? "agreed" : "accepted", decision === "decline" ? reason! : allAccepted ? "Все подтвердили интерес. Вещи закреплены за этим кругом." : `${user.name} подтвердил интерес.`, { circle, session, userId: user._id });
    return circleDto(updated);
  });
}
export async function cancelCircle(id: ObjectId, user: UserDoc) {
  await expireCircles();
  return transaction(async (session) => {
    const circle = await circles.findOne({ _id: id }, { session });
    if (!circle) throw new ApiError(404, "Круг не найден.");
    if (!circle.participantIds.some((participant) => participant.equals(user._id))) throw new ApiError(403, "Вы не участник.");
    if (circle.status === "cancelled") return circleDto(circle);
    if (!["proposed", "agreed"].includes(circle.status)) throw new ApiError(409, "Этот круг уже закрыт.");
    await closeCircle(circle, "cancelled", `${user.name} отменил договорённость. Вещи снова доступны.`, session, user._id);
    return circleDto((await circles.findOne({ _id: id }, { session }))!);
  });
}
export async function seedDemo(reset = false) {
  if (reset) await transaction(async (session) => {
    const demoListings = await listings.find({ datasetId: DEMO_DATASET }, { session }).toArray();
    const affected = await circles.find({ listingIds: { $in: demoListings.map((listing) => listing._id) }, status: { $in: ["proposed", "agreed"] } }, { session }).toArray();
    for (const circle of affected) await closeCircle(circle, "invalidated", "Демонстрационный набор обновлён.", session);
    await events.deleteMany({ datasetId: DEMO_DATASET }, { session });
    await circles.deleteMany({ datasetId: DEMO_DATASET }, { session });
    await listings.deleteMany({ datasetId: DEMO_DATASET }, { session });
  });
  for (const person of demoPeople) {
    const [key, name] = person;
    const user = await users.findOneAndUpdate({ datasetId: DEMO_DATASET, demoKey: key }, { $setOnInsert: { _id: new ObjectId(), name, demoKey: key, areaId: "center", isDemo: true, datasetId: DEMO_DATASET, createdAt: new Date() } }, { upsert: true, returnDocument: "after" });
    if (key === "A") continue;
    const now = new Date();
    await listings.updateOne({ datasetId: DEMO_DATASET, demoKey: key }, { $setOnInsert: { ...demoInput(person), _id: new ObjectId(), ownerId: user!._id, ownerName: name,
      isDemo: true, datasetId: DEMO_DATASET, demoKey: key, status: "active", version: 1, createdAt: now, updatedAt: now } }, { upsert: true });
  }
}
export async function metrics(): Promise<Metrics> {
  await expireCircles();
  const input = await listings.find({ status: "active" }).limit(251).toArray();
  const rejected = await circles.find({ status: { $in: ["declined", "cancelled", "expired", "invalidated"] } }, { projection: { signature: 1 } }).toArray();
  const result = findCircles(input.map(listingDto), undefined, { limit: 10_000, timeLimitMs: 1_000, excluded: new Set(rejected.map((circle) => circle.signature)) });
  const direct = new Set<string>(); const multiway = new Set<string>();
  const counts: Record<string, number> = { "2": 0, "3": 0, "4": 0 };
  for (const circle of result.candidates) {
    counts[String(circle.members.length)]++;
    for (const member of circle.members) { multiway.add(member.userId); if (circle.members.length === 2) direct.add(member.userId); }
  }
  return { listings: input.length, owners: new Set(input.map((item) => item.ownerId.toHexString())).size,
    directOwners: direct.size, multiwayOwners: multiway.size, additionalOwners: multiway.size - direct.size, cycles: counts,
    elapsedMs: result.elapsedMs, truncated: result.truncated || result.total > result.candidates.length, isDemo: input.length > 0 && input.every((item) => item.isDemo),
    agreed: await circles.countDocuments({ status: "agreed" }), searches: await events.countDocuments({ type: "search" }), declines: await events.countDocuments({ type: "declined" }),
    views: await events.countDocuments({ type: "candidate_view" }), responses: await events.countDocuments({ type: { $in: ["accepted", "agreed", "declined"] } }) };
}
