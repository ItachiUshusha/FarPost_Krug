import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { areas, categories, conditions, itemTypes } from "../../shared/krug/reference";
import { createCircleSchema, guestSchema, idSchema, listingSchema, respondSchema, searchSchema } from "../../shared/krug/schemas";
import { config } from "../config";
import { database } from "../db/client";
import { ApiError } from "../lib/errors";
import { circles, circleDto, events, listings, listingDto, userDto, users } from "../repositories/krug";
import { DEMO_DATASET } from "../domain/krug/demo";
import { cancelCircle, createCircle, createListing, expireCircles, metrics, respondToCircle, searchMatches, seedDemo, updateListing } from "../services/krug";
import { clearSession, createSession, currentUser, requireUser } from "../services/session";

export const krugRouter = Router();
const objectId = (value: unknown) => new ObjectId(idSchema.parse(value));
const demoOnly = () => { if (!config.demoMode) throw new ApiError(404, "Демонстрационный режим выключен."); };
const requests = new Map<string, { count: number; until: number }>();
krugRouter.use((request, _response, next) => {
  if (process.env.NODE_ENV === "test") return next();
  const now = Date.now();
  const key = `${request.ip}:${request.path.includes("session") ? "session" : "api"}`;
  const entry = requests.get(key);
  if (!entry || entry.until < now) requests.set(key, { count: 1, until: now + 60_000 });
  else if (++entry.count > (request.path.includes("session") ? 60 : 300)) return next(new ApiError(429, "Слишком много запросов. Подождите минуту."));
  if (requests.size > 1000) for (const [key, entry] of requests) if (entry.until < now) requests.delete(key);
  next();
});
krugRouter.get("/health", async (_request, response) => { await database.command({ ping: 1 }); response.json({ connected: true, demoMode: config.demoMode }); });
krugRouter.get("/reference", (_request, response) => response.json({ areas, categories, conditions, itemTypes }));
krugRouter.get("/session", async (request, response) => { const user = await currentUser(request); response.json({ user: user ? userDto(user) : null, demoMode: config.demoMode }); });
krugRouter.post("/session/guest", async (request, response) => {
  const input = guestSchema.parse(request.body);
  const user = { ...input, _id: new ObjectId(), isDemo: false, createdAt: new Date() };
  await users.insertOne(user); await createSession(user, request, response); response.status(201).json({ user: userDto(user) });
});
krugRouter.delete("/session", async (request, response) => { await clearSession(request, response); response.status(204).end(); });
krugRouter.get("/demo/people", async (_request, response) => { demoOnly(); response.json({ people: (await users.find({ datasetId: DEMO_DATASET }).sort({ demoKey: 1 }).toArray()).map(userDto) }); });
krugRouter.post("/demo/session", async (request, response) => {
  demoOnly();
  const { key } = z.object({ key: z.string().regex(/^[A-L]$/) }).strict().parse(request.body);
  const user = await users.findOne({ datasetId: DEMO_DATASET, demoKey: key });
  if (!user) throw new ApiError(404, "Демопрофиль ещё не создан. Выполните demo:seed.");
  await createSession(user, request, response); response.json({ user: userDto(user) });
});
krugRouter.post("/demo/reset", async (request, response) => { demoOnly(); await requireUser(request); await seedDemo(true); response.json({ ok: true }); });
krugRouter.get("/listings", async (request, response) => {
  await expireCircles();
  const query = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(18),
    search: z.string().max(100).default(""), category: z.string().max(40).default(""), area: z.string().max(40).default(""), mine: z.enum(["true", "false"]).default("false") }).parse(request.query);
  const user = query.mine === "true" ? await requireUser(request) : null;
  const filter = { ...(user ? { ownerId: user._id } : { status: "active" as const }),
    ...(query.category ? { categoryId: query.category } : {}), ...(query.area ? { areaId: query.area } : {}),
    ...(query.search ? { $or: [{ title: { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { wantText: { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] } : {}) };
  const [items, total] = await Promise.all([listings.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).toArray(), listings.countDocuments(filter)]);
  response.json({ items: items.map(listingDto), total, page: query.page, limit: query.limit });
});
krugRouter.get("/listings/:id", async (request, response) => { await expireCircles(); const listing = await listings.findOne({ _id: objectId(request.params.id) }); if (!listing) throw new ApiError(404, "Заявка не найдена."); response.json({ listing: listingDto(listing) }); });
krugRouter.post("/listings", async (request, response) => { const user = await requireUser(request); response.status(201).json({ listing: await createListing(listingSchema.parse(request.body), user) }); });
krugRouter.patch("/listings/:id", async (request, response) => {
  const user = await requireUser(request); const { values, version } = z.object({ values: listingSchema, version: z.number().int().positive() }).strict().parse(request.body);
  response.json({ listing: await updateListing(objectId(request.params.id), values, version, user) });
});
krugRouter.post("/listings/:id/archive", async (request, response) => {
  const user = await requireUser(request); const { version } = z.object({ version: z.number().int().positive() }).strict().parse(request.body);
  response.json({ listing: await updateListing(objectId(request.params.id), null, version, user) });
});
krugRouter.post("/matches", async (request, response) => {
  const user = await requireUser(request); const { listingId, maxParticipants, limit } = searchSchema.parse(request.body);
  response.json(await searchMatches(listingId, user, maxParticipants, limit));
});
krugRouter.get("/metrics", async (_request, response) => response.json(await metrics()));
krugRouter.post("/events", async (request, response) => {
  const user = await requireUser(request);
  const { signature } = z.object({ type: z.literal("candidate_view"), signature: z.string().min(10).max(700) }).strict().parse(request.body);
  let decoded: unknown;
  try { decoded = JSON.parse(signature); } catch { throw new ApiError(400, "Некорректная подпись варианта."); }
  const pairs = z.array(z.tuple([idSchema, z.number().int().positive()])).min(2).max(4).parse(decoded);
  if (!await listings.findOne({ _id: { $in: pairs.map(([id]) => new ObjectId(id)) }, ownerId: user._id })) throw new ApiError(403, "Можно учитывать только свои варианты.");
  await events.updateOne({ userId: user._id, type: "candidate_view", signature }, { $setOnInsert: { _id: new ObjectId(), userId: user._id, type: "candidate_view", signature,
    message: "Участник увидел вариант обмена", createdAt: new Date(), datasetId: user.datasetId } }, { upsert: true });
  response.status(204).end();
});
krugRouter.get("/circles", async (request, response) => { const user = await requireUser(request); await expireCircles(); const items = await circles.find({ participantIds: user._id }).sort({ updatedAt: -1 }).limit(50).toArray(); response.json({ items: items.map(circleDto) }); });
krugRouter.post("/circles", async (request, response) => { const user = await requireUser(request); const input = createCircleSchema.parse(request.body); response.status(201).json({ circle: await createCircle(input.listingIds, input.versions, user) }); });
krugRouter.get("/circles/:id", async (request, response) => {
  const user = await requireUser(request); await expireCircles(); const circle = await circles.findOne({ _id: objectId(request.params.id), participantIds: user._id });
  if (!circle) throw new ApiError(404, "Круг недоступен. Войдите как один из его участников.");
  const history = await events.find({ circleId: circle._id }).sort({ createdAt: 1 }).limit(30).toArray();
  response.json({ circle: circleDto(circle), events: history.map((event) => ({ id: event._id.toHexString(), circleId: circle._id.toHexString(), type: event.type, message: event.message, createdAt: event.createdAt.toISOString() })) });
});
krugRouter.post("/circles/:id/respond", async (request, response) => { const user = await requireUser(request); const { decision } = respondSchema.parse(request.body); response.json({ circle: await respondToCircle(objectId(request.params.id), decision, user) }); });
krugRouter.post("/circles/:id/cancel", async (request, response) => { const user = await requireUser(request); response.json({ circle: await cancelCircle(objectId(request.params.id), user) }); });
