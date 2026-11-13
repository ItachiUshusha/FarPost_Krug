"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/krug-api";
import { listingSchema } from "../../../shared/krug/schemas";
import { emptyListing, type Listing, type ListingInput } from "../../../shared/krug/types";
import { areas, categories, conditions, itemTypes } from "../../../shared/krug/reference";
import { useApp, useResource } from "./state";
import { Loading, Notice, useUI } from "./ui";
const split = (text: string) => text.split(",").map((v) => v.trim());

export function ListingForm({ id }: { id?: string }) {
  const { user, ready, setGuestOpen, drafts, saveDraft, refresh } = useApp();
  const resource = useResource<{ listing: Listing }>(id ? `/listings/${id}` : null);
  const key = `${user?.id || "guest"}:${id || "new"}`;
  const values = drafts[key] || resource.data?.listing || emptyListing();
  const { Field, Action, Pill } = useUI(), router = useRouter();
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [start, setStart] = useState(""), [end, setEnd] = useState("");
  useEffect(() => {
    if (!drafts[key] && resource.data) saveDraft(key, resource.data.listing);
  }, [key, resource.data, drafts, saveDraft]);
  const update = <K extends keyof ListingInput>(field: K, value: ListingInput[K]) => saveDraft(key, { ...values, [field]: value });
  const setType = (value: string) => { const type = itemTypes.find((t) => t.id === value); saveDraft(key, { ...values, itemTypeId: value, categoryId: type?.categoryId || "other" }); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (!user) { setGuestOpen(true); return; }
    // Pick only input fields: stored DTOs also contain server-owned metadata.
    const input = Object.fromEntries(Object.keys(emptyListing()).map((field) => [field, values[field as keyof ListingInput]]));
    for (const field of ["requiredKeywords", "excludedKeywords", "preferredKeywords"] as const) input[field] = values[field].filter(Boolean);
    const parsed = listingSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues.map((i) => i.message).join(" · ")); return; }
    setSaving(true);
    try {
      const data = await api<{ listing: Listing }>(id ? `/listings/${id}` : "/listings", id ? { values: parsed.data, version: resource.data?.listing.version } : parsed.data, id ? "PATCH" : "POST");
      saveDraft(key, emptyListing()); refresh(); router.push(`/listings/${data.listing.id}`);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  if (!ready || (id && resource.loading)) return <Loading/>;
  if (resource.error) return <Notice error>{resource.error}</Notice>;
  if (id && resource.data?.listing.ownerId !== user?.id) return <Notice error>Редактировать заявку может только её владелец.</Notice>;
  return <div className="form-page"><div className="page-heading"><span className="eyebrow">НОВЫЕ СВЯЗИ НАЧИНАЮТСЯ С ВЕЩИ</span><h1>{id ? "Изменить заявку" : "Что хотите обменять?"}</h1><p>Опишите вещь и пожелания. Мы поищем, как замкнуть круг.</p></div>
    {!user && <Notice>Чтобы сохранить заявку, представьтесь. <button className="inline-button" onClick={() => setGuestOpen(true)}>Создать локальный профиль</button></Notice>}
    <form onSubmit={submit} className="listing-form"><section className="form-panel"><div className="form-section-heading"><span className="number">1</span><div><h2>Отдаю</h2><p>Одна заявка — одна вещь или один набор.</p></div></div>
      <Field label="Название вещи" value={values.title} onChange={(v) => update("title", v)} required placeholder="Например, монитор Samsung 24 дюйма"/>
      <div className="field-row"><Field label="Тип вещи" value={values.itemTypeId} onChange={setType} options={[{ id: "", label: "Выберите тип" }, ...itemTypes]} required/><Field label="Состояние" value={values.condition} onChange={(v) => update("condition", v)} options={conditions}/></div>
      <Field label="Описание" value={values.description} onChange={(v) => update("description", v)} multiline required helper="Расскажите о комплекте и недостатках. От 10 символов."/>
    </section><section className="form-panel"><div className="form-section-heading"><span className="number">2</span><div><h2>Хочу получить</h2><p>Чем понятнее пожелание, тем точнее подбор.</p></div></div>
      <Field label="Что ищете взамен?" value={values.wantText} onChange={(v) => update("wantText", v)} required multiline placeholder="Ищу взрослый велосипед для города"/>
      <p className="field-label">Подходящие типы вещей <span className="muted">· можно несколько</span></p><div className="choice-chips">{itemTypes.filter((t) => t.id !== "other").map((t) => <Pill key={t.id} selected={values.wantedTypeIds.includes(t.id)} onClick={() => update("wantedTypeIds", values.wantedTypeIds.includes(t.id) ? values.wantedTypeIds.filter((id) => id !== t.id) : [...values.wantedTypeIds, t.id])}>{t.label}</Pill>)}</div><p className="field-help">Если типы не выбраны, сервис распознает знакомые слова в пожелании. Неизвестные вещи сравниваются по словам описания.</p>
    </section><section className="form-panel"><div className="form-section-heading"><span className="number">3</span><div><h2>Где встречаемся</h2><p>Учитываем район и общую точку встречи для всего круга.</p></div></div>
      <Field label="Ваш район" value={values.areaId} onChange={(v) => update("areaId", v)} options={areas}/><label className="checkbox-row"><input type="checkbox" checked={values.pickupOnly} onChange={(e) => update("pickupOnly", e.target.checked)}/>Только самовывоз из моего района</label>
      {!values.pickupOnly && <><p className="field-label">Удобные районы встречи</p><div className="choice-chips">{areas.map((a) => <Pill key={a.id} selected={values.meetingAreaIds.includes(a.id)} onClick={() => update("meetingAreaIds", values.meetingAreaIds.includes(a.id) ? values.meetingAreaIds.filter((id) => id !== a.id) : [...values.meetingAreaIds, a.id])}>{a.label}</Pill>)}</div><p className="field-help">Без выбора — готовы обсудить любой район Владивостока.</p></>}
    </section><details className="form-panel advanced"><summary>Дополнительные условия <span>＋</span></summary><div className="advanced-fields"><div className="field-row"><Field label="Минимальное состояние взамен" value={values.minimumCondition} onChange={(v) => update("minimumCondition", v)} options={conditions}/><Field label="Максимум участников" value={String(values.maxParticipants)} onChange={(v) => update("maxParticipants", Number(v))} options={[2,3,4].map((n) => ({ id: String(n), label: `${n} человека` }))}/></div>
      <Field label="Категория вместо конкретного типа" value={values.wantedCategoryIds[0] || ""} onChange={(v) => update("wantedCategoryIds", v ? [v] : [])} options={[{ id: "", label: "Любая / по пожеланию" }, ...categories]} helper="Работает вместе с выбранными типами и текстом пожелания."/>
      <Field label="Обязательные слова" value={values.requiredKeywords.join(", ")} onChange={(v) => update("requiredKeywords", split(v))} helper="Через запятую: например, взрослый"/>
      <Field label="Исключить слова" value={values.excludedKeywords.join(", ")} onChange={(v) => update("excludedKeywords", split(v))}/>
      <Field label="Желательные слова" value={values.preferredKeywords.join(", ")} onChange={(v) => update("preferredKeywords", split(v))}/>
      <Field label="Комментарий к встрече" value={values.notes} onChange={(v) => update("notes", v)} multiline/>
      <p className="field-label">Окно встречи · время Владивостока</p><div className="field-row"><Field label="С" type="datetime-local" value={start} onChange={setStart}/><Field label="До" type="datetime-local" value={end} onChange={setEnd}/></div>
      <Action variant="tonal" disabled={!start || !end || values.availability.length >= 5} onClick={() => { const s = new Date(`${start}:00+10:00`), e = new Date(`${end}:00+10:00`); if (e.getTime() - s.getTime() < 15 * 60_000) { setError("Окно встречи должно быть не меньше 15 минут."); return; } update("availability", [...values.availability, { start: s.toISOString(), end: e.toISOString() }]); setStart(""); setEnd(""); }}>Добавить окно</Action>
      {values.availability.map((w, i) => <div className="window-row" key={i}><span>{new Date(w.start).toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" })} — {new Date(w.end).toLocaleString("ru-RU", { timeZone: "Asia/Vladivostok" })}</span><Action variant="text" onClick={() => update("availability", values.availability.filter((_, index) => index !== i))}>Удалить</Action></div>)}
      <p className="field-help">Без окон — время обсуждается после согласия. Сервис проверяет пересечение окон всех участников.</p>
    </div></details>
    {error && <Notice error>{error}</Notice>}<div className="form-submit"><span className="muted">Вещи и пожелания можно изменить позже.</span><Action type="submit" disabled={saving}>{saving ? "Сохраняем…" : id ? "Сохранить изменения" : "Опубликовать заявку"}</Action></div></form></div>;
}
