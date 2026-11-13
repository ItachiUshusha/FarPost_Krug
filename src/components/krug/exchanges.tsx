"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/krug-api";
import type { Candidate, Circle, CircleEvent, Listing, SearchResult } from "../../../shared/krug/types";
import { areaLabel, conditionLabel, typeLabel } from "../../../shared/krug/reference";
import { useApp, useResource } from "./state";
import { Empty, Loading, Notice, useUI } from "./ui";
import { ItemArt } from "./icons";
import { ListingCard } from "./catalog";
import { CircleDiagram } from "./diagram";
const statusLabel: Record<Circle["status"], string> = { proposed: "Ждём подтверждений", agreed: "Все согласны", declined: "Участник отказался", cancelled: "Круг отменён", expired: "Время истекло", invalidated: "Круг больше не актуален" };

export function ListingDetails({ id }: { id: string }) {
  const { user, revision, refresh } = useApp(), { Action, Modal } = useUI(), router = useRouter();
  const { data, error, loading } = useResource<{ listing: Listing }>(`/listings/${id}`, revision);
  const [archive, setArchive] = useState(false), [actionError, setError] = useState(""), [busy, setBusy] = useState(false);
  if (loading) return <Loading/>;
  if (error || !data) return <Notice error>{error || "Заявка не найдена"}</Notice>;
  const l = data.listing, mine = user?.id === l.ownerId;
  return <><Link className="back-link" href="/">← Все вещи</Link><article className="detail-layout"><div className="detail-art"><ItemArt type={l.itemTypeId}/><span className="detail-art-caption">Текстовая заявка · фото пока не нужны</span></div><div className="detail-copy"><div className="card-meta"><span>{areaLabel(l.areaId)}</span><span>{l.isDemo ? "Демонстрационная заявка" : l.ownerName}</span></div><span className="eyebrow">ОТДАЮ</span><h1>{l.title}</h1><span className="status-tag">{l.status === "active" ? conditionLabel(l.condition) : l.status === "reserved" ? "Зарезервировано в круге" : "В архиве"}</span><p className="detail-description">{l.description}</p><div className="want-panel"><span className="eyebrow">ХОЧУ ПОЛУЧИТЬ</span><h2>{l.wantText}</h2>{l.wantedTypeIds.length > 0 && <p>{l.wantedTypeIds.map(typeLabel).join(" · ")}</p>}</div><div className="detail-conditions"><p><strong>Встреча:</strong> {l.pickupOnly ? `самовывоз · ${areaLabel(l.areaId)}` : l.meetingAreaIds.length ? l.meetingAreaIds.map(areaLabel).join(", ") : "любой район Владивостока"}</p><p><strong>Круг:</strong> до {l.maxParticipants} участников</p><p><strong>Состояние взамен:</strong> {conditionLabel(l.minimumCondition)}</p>{l.excludedKeywords.length > 0 && <p><strong>Не подходит:</strong> {l.excludedKeywords.join(", ")}</p>}{l.requiredKeywords.length > 0 && <p><strong>Обязательно:</strong> {l.requiredKeywords.join(", ")}</p>}{l.notes && <p>{l.notes}</p>}{l.availability.length > 0 && <p><strong>Окна встречи:</strong> {l.availability.map((w) => `${new Date(w.start).toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" })} — ${new Date(w.end).toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" })}`).join("; ")} (Владивосток)</p>}</div>
    {mine ? <div className="detail-actions"><Action disabled={l.status !== "active"} onClick={() => router.push(`/matches?listingId=${l.id}`)}>Найти мой круг ↻</Action><Action variant="tonal" disabled={l.status !== "active"} onClick={() => router.push(`/listings/${l.id}/edit`)}>Изменить</Action>{l.status === "active" && <Action variant="text" onClick={() => setArchive(true)}>В архив</Action>}</div> : <Action onClick={() => router.push("/listings/new")}>Предложить свою вещь</Action>}
    </div></article><Modal title="Убрать заявку в архив?" open={archive} onClose={() => setArchive(false)}><p className="modal-copy">Она перестанет участвовать в подборе. Предложенные круги с этой вещью станут недоступны.</p>{actionError && <Notice error>{actionError}</Notice>}<div className="modal-actions"><Action variant="text" onClick={() => setArchive(false)}>Оставить</Action><Action disabled={busy} onClick={async () => { setBusy(true); try { await api(`/listings/${id}/archive`, { version: l.version }); setArchive(false); refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>В архив</Action></div></Modal></>;
}

export function MyListings() {
  const { user, ready, revision, setGuestOpen, logout, busy } = useApp(), { Action, Pill } = useUI();
  const [tab, setTab] = useState("listings"), router = useRouter();
  const listings = useResource<{ items: Listing[] }>(user ? "/listings?mine=true&limit=50" : null, revision);
  const circles = useResource<{ items: Circle[] }>(user ? "/circles" : null, revision);
  if (!ready) return <Loading/>;
  if (!user) return <Empty title="Ваши вещи и круги будут здесь"><Action onClick={() => setGuestOpen(true)}>Представиться</Action></Empty>;
  return <><div className="page-heading heading-row"><div><span className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</span><h1>{user.name}, это ваш круг</h1><p>Следите за заявками и ответами участников.</p></div><Action onClick={() => router.push("/listings/new")}>＋ Предложить вещь</Action></div><div className="view-tabs"><Pill selected={tab === "listings"} onClick={() => setTab("listings")}>Мои вещи</Pill><Pill selected={tab === "circles"} onClick={() => setTab("circles")}>Мои круги {circles.data?.items.length || ""}</Pill><Action variant="text" disabled={busy} onClick={() => void logout()}>Выйти из профиля</Action></div>
    {tab === "listings" ? listings.error ? <Notice error>{listings.error}</Notice> : listings.loading ? <Loading/> : listings.data?.items.length ? <div className="listing-grid">{listings.data.items.map((l) => <ListingCard key={l.id} listing={l}/>)}</div> : <Empty title="Первый шаг — ваша вещь">Расскажите, что отдаёте и что хотели бы получить.</Empty> : circles.error ? <Notice error>{circles.error}</Notice> : circles.loading ? <Loading/> : circles.data?.items.length ? <div className="circle-list">{circles.data.items.map((c) => <Link key={c.id} href={`/circles/${c.id}`} className="circle-summary"><span className="circle-count">{c.members.length}</span><div><span className="status-tag">{statusLabel[c.status]}</span><h3>{c.members.find((m) => m.userId === user.id)?.giveTitle} → {c.members.find((m) => m.userId === user.id)?.receiveTitle}</h3><p>{c.members.map((m) => m.name).join(" · ")}</p></div><span aria-hidden="true">↗</span></Link>)}</div> : <Empty title="Кругов пока нет">Откройте свою заявку и нажмите «Найти мой круг».</Empty>}
  </>;
}

function CandidateCard({ candidate, onCreate, busy }: { candidate: Candidate; onCreate: () => void; busy: boolean }) {
  const { user } = useApp(), { Action } = useUI(), mine = candidate.members.find((m) => m.userId === user?.id);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { void api("/events", { type: "candidate_view", signature: candidate.signature }).catch(() => {}); observer.disconnect(); } }, { threshold: .25 });
    if (ref.current) observer.observe(ref.current); return () => observer.disconnect();
  }, [candidate.signature]);
  return <article ref={ref} className="candidate-card"><div className="candidate-top"><span className="status-tag">{candidate.members.length} участника</span><span className="muted">{candidate.members.length === 2 ? "Прямой обмен" : "Обмен по кругу"}</span></div><div className="candidate-body"><CircleDiagram members={candidate.members} compact/><div className="candidate-outcome"><span className="eyebrow">ВАШ РЕЗУЛЬТАТ</span><h2>{mine?.receiveTitle}</h2><p className="muted">взамен на {mine?.giveTitle}</p><div className="candidate-people">{candidate.members.map((m) => <span key={m.userId}>{m.name}</span>)}</div><p className="match-reason">✓ {mine?.reasons.join(" · ")}</p><p className="muted">Встреча: {candidate.commonAreas.map(areaLabel).join(", ")}</p><Action disabled={busy} onClick={onCreate}>Предложить этот круг</Action></div></div></article>;
}
export function Matches() {
  const { user, ready, revision, setGuestOpen } = useApp(), { Field, Action, Pill } = useUI(), router = useRouter(), params = useSearchParams();
  const listingId = params.get("listingId") || "";
  const own = useResource<{ items: Listing[] }>(user ? "/listings?mine=true&limit=50" : null, revision);
  const [result, setResult] = useState<SearchResult | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [size, setSize] = useState(0), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!listingId || !user) return;
    const controller = new AbortController();
    const search = async () => { setLoading(true); setError(""); setResult(null); try { const data = await api<SearchResult>("/matches", { listingId, maxParticipants: 4, limit: 30 }, "POST", controller.signal); setResult(data); } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); } finally { if (!controller.signal.aborted) setLoading(false); } };
    void search(); return () => controller.abort();
  }, [listingId, user?.id, revision, attempt, user]);
  if (!ready) return <Loading/>;
  if (!user) return <Empty title="Для подбора нужна ваша заявка"><Action onClick={() => setGuestOpen(true)}>Представиться</Action></Empty>;
  const available = own.data?.items.filter((l) => l.status === "active") || [];
  const create = async (candidate: Candidate) => { setBusy(true); setError(""); try { const data = await api<{ circle: Circle }>("/circles", { listingIds: candidate.listingIds, versions: candidate.versions }); router.push(`/circles/${data.circle.id}`); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <><div className="page-heading"><span className="eyebrow">ПОДБИРАЕМ СВЯЗИ, А НЕ СЛУЧАЙНЫЕ ВЕЩИ</span><h1>Найдём ваш круг</h1><p>Проверяем пожелания каждого участника и общие условия встречи.</p></div><div className="search-listing"><Field label="Ваша вещь для обмена" value={listingId} onChange={(id) => router.replace(`/matches?listingId=${id}`)} options={[{ id: "", label: "Выберите свою заявку" }, ...available.map((l) => ({ id: l.id, label: l.title }))]}/><Action variant="tonal" disabled={!listingId || loading} onClick={() => setAttempt(attempt + 1)}>Обновить подбор</Action></div>
    {own.error && <Notice error>{own.error}</Notice>}{error && <Notice error>{error}</Notice>}
    {loading ? <Loading/> : result ? <><div className="section-heading result-heading"><h2>{result.total ? `Найдено кругов: ${result.total}` : "Подходящего круга пока нет"}</h2><span className="muted">{Math.ceil(result.elapsedMs)} мс · {result.inputCount} заявок в расчёте</span></div>{result.total > 0 && <div className="view-tabs">{[0,2,3,4].map((n) => <Pill key={n} selected={size === n} onClick={() => setSize(n)}>{n ? `${n} участника` : "Все варианты"}</Pill>)}</div>}{result.truncated && <Notice>Поиск достиг лимита. Показана часть найденных кругов; можно уточнить пожелания и повторить подбор.</Notice>}
      <div className="candidate-list">{result.candidates.filter((c) => !size || c.members.length === size).map((c) => <CandidateCard key={c.signature} candidate={c} onCreate={() => void create(c)} busy={busy}/>)}</div>{!result.candidates.some((c) => !size || c.members.length === size) && <Empty title={size ? "Кругов такого размера нет" : "Нужно немного больше связей"}>Попробуйте расширить районы встречи или пожелания. Новые заявки могут замкнуть ваш круг.</Empty>}
    </> : !listingId && <Empty title={available.length ? "С какой вещи начнём?" : "Сначала предложите вещь"}>{available.length ? "Выберите заявку выше, и сервис проверит обмены." : <Action onClick={() => router.push("/listings/new")}>Добавить заявку</Action>}</Empty>}</>;
}

export function CircleDetails({ id }: { id: string }) {
  const { user, revision, refresh, ready, setGuestOpen } = useApp(), { Action, Modal } = useUI(), router = useRouter();
  const [tick, setTick] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [confirm, setConfirm] = useState<"decline" | "cancel" | null>(null);
  const resource = useResource<{ circle: Circle; events: CircleEvent[] }>(user ? `/circles/${id}` : null, revision + tick);
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) setTick((n) => n + 1); }, 5000); return () => clearInterval(timer); }, [id]);
  const respond = async (action: "accept" | "decline" | "cancel") => { setBusy(true); setError(""); try { await api(`/circles/${id}/${action === "cancel" ? "cancel" : "respond"}`, action === "cancel" ? {} : { decision: action }); setConfirm(null); refresh(); } catch (e) { setError((e as Error).message); setTick((v) => v + 1); } finally { setBusy(false); } };
  if (!ready) return <Loading/>;
  if (!user) return <Empty title="Круг доступен его участникам"><Action onClick={() => setGuestOpen(true)}>Представиться</Action></Empty>;
  if (resource.error) return <Notice error>{resource.error}</Notice>;
  if (!resource.data) return <Loading/>;
  const { circle: c, events } = resource.data, mine = c.members.find((m) => m.userId === user.id), active = c.status === "proposed" || c.status === "agreed";
  return <><Link className="back-link" href="/my">← Мои вещи и круги</Link><div className="page-heading"><span className={`status-tag circle-status-${c.status}`}>{statusLabel[c.status]}</span><h1>{c.status === "agreed" ? "Ваш круг сложился" : "Каждый получает нужное"}</h1><p>{c.members.length} участника · {c.members.filter((m) => m.decision === "accepted").length} подтверждений из {c.members.length}</p></div>{error && <Notice error>{error}</Notice>}
    {c.status === "agreed" && <Notice>Все подтвердили интерес. Вещи зарезервированы до {new Date(c.expiresAt).toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" })} (Владивосток). Договоритесь о встрече. Это ещё не завершённый обмен.</Notice>}
    {!active && <Notice>{c.reason || statusLabel[c.status]} {mine && <button className="inline-button" onClick={() => router.push(`/matches?listingId=${mine.listingId}`)}>Поискать другой круг →</button>}</Notice>}
    <div className="circle-detail-layout"><section className="circle-visual-panel"><CircleDiagram members={c.members}/><div className="meeting-panel"><h3>Где замыкаем круг</h3><p>{c.commonAreas.map(areaLabel).join(" · ")}</p><p className="muted">{c.commonAvailability.length ? c.commonAvailability.map((w) => `${new Date(w.start).toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" })} — ${new Date(w.end).toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" })} (Владивосток)`).join("; ") : "Время встречи нужно обсудить вместе."}</p></div></section><div><section className="your-outcome"><span className="eyebrow">ВАШ ОБМЕН · {user.name.toUpperCase()}</span><div className="outcome-row"><ItemArt type={mine?.giveTypeId || "other"} small/><div><span className="muted">Отдаёте</span><h3>{mine?.giveTitle}</h3></div></div><span className="outcome-arrow">↓</span><div className="outcome-row"><ItemArt type={mine?.receiveTypeId || "other"} small/><div><span className="muted">Получаете</span><h3>{mine?.receiveTitle}</h3></div></div><p className="match-reason">{mine?.reasons.join(" · ")}</p>
    {c.status === "proposed" && mine?.decision === "pending" && <div className="response-actions"><Action disabled={busy} onClick={() => void respond("accept")}>Подтвердить интерес</Action><Action variant="text" disabled={busy} onClick={() => setConfirm("decline")}>Мне не подходит</Action></div>}{c.status === "proposed" && mine?.decision === "accepted" && <Notice>Вы подтвердили интерес. Ждём остальных участников.</Notice>}{active && <Action variant="text" disabled={busy} onClick={() => setConfirm("cancel")}>Отменить участие в круге</Action>}</section>
    <section className="participants-panel"><h2>Участники</h2>{c.members.map((m, i) => <div className="participant-row" key={m.userId}><span className={`number person-${i}`}>{m.name[0]}</span><div><strong>{m.name}{m.userId === user.id ? " · вы" : ""}</strong><p>{m.decision === "accepted" ? "✓ Подтвердил(а)" : m.decision === "declined" ? "Отказался(ась)" : "Ожидаем ответ"}</p></div></div>)}</section></div></div>
    <section className="event-section"><h2>Что происходит в круге</h2><ol>{events.map((e) => <li key={e.id}><time>{new Date(e.createdAt).toLocaleTimeString("ru-RU", { timeZone: "Asia/Vladivostok", hour: "2-digit", minute: "2-digit" })}</time><span>{e.message}</span></li>)}</ol></section>
    <Modal title={confirm === "decline" ? "Этот круг не подходит?" : "Отменить участие?"} open={Boolean(confirm)} onClose={() => setConfirm(null)}><p className="modal-copy">Круг закроется для всех участников. Вещи снова станут доступны для подбора. Вы сможете поискать другой вариант.</p><div className="modal-actions"><Action variant="text" onClick={() => setConfirm(null)}>Вернуться</Action><Action variant="danger" disabled={busy} onClick={() => confirm && void respond(confirm)}>Подтвердить {confirm === "decline" ? "отказ" : "отмену"}</Action></div></Modal></>;
}
