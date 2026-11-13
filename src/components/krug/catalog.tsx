"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Listing, Metrics } from "../../../shared/krug/types";
import { areaLabel, categories, areas, conditionLabel } from "../../../shared/krug/reference";
import { useApp, useResource } from "./state";
import { Empty, Loading, Notice, useUI } from "./ui";
import { ItemArt } from "./icons";

export function ListingCard({ listing }: { listing: Listing }) {
  const { user } = useApp();
  return <Link href={`/listings/${listing.id}`} className="listing-card">
    <div className="card-art"><ItemArt type={listing.itemTypeId} /><span className="art-badge">{listing.isDemo ? "Демо" : conditionLabel(listing.condition)}</span></div>
    <div className="listing-card-content"><div className="card-meta"><span>{areaLabel(listing.areaId)}</span><span>{listing.ownerId === user?.id ? "Ваша вещь" : listing.ownerName}</span></div>
      <span className="eyebrow">ОТДАЁТ</span><h3>{listing.title}</h3>
      <div className="wish-line"><span aria-hidden="true">↗</span><div><span className="muted">Хочет получить</span><p>{listing.wantText}</p></div></div>
      {listing.status !== "active" && <span className="status-tag">{listing.status === "reserved" ? "Зарезервировано" : "В архиве"}</span>}
      <div className="card-bottom"><span>Круг до {listing.maxParticipants} человек</span><span aria-hidden="true">↗</span></div>
    </div>
  </Link>;
}
function HeroArt() {
  return <div className="hero-art" aria-hidden="true"><div className="hero-orbit" /><div className="hero-orbit inner" />
    <div className="hero-center">вещи идут<br/><strong>по кругу</strong><span>↻</span></div>
    <div className="floating-item floating-monitor"><ItemArt type="monitor" small /><span>Монитор</span><b>↗</b></div>
    <div className="floating-item floating-bike"><ItemArt type="bicycle" small /><span>Велосипед</span><b>↓</b></div>
    <div className="floating-item floating-drill"><ItemArt type="drill" small /><span>Дрель</span><b>↖</b></div>
    <span className="orbit-note">Три человека. Три нужные вещи.</span></div>;
}
export function Catalog() {
  const { Field, Action, Pill } = useUI(), router = useRouter();
  const [search, setSearch] = useState(""), [category, setCategory] = useState(""), [area, setArea] = useState(""), [page, setPage] = useState(1);
  const { revision } = useApp();
  const result = useResource<{ items: Listing[]; total: number; page: number; limit: number }>(`/listings?${new URLSearchParams({ search, category, area, page: String(page), limit: "12" })}`, revision);
  const metrics = useResource<Metrics>("/metrics", revision);
  const change = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  return <>
    <section className="hero"><div className="hero-copy"><span className="location-label"><span className="location-dot"/> Владивосток · обмен рядом</span><h1>Ненужное вам.<br/><span>Нужное другому.</span></h1><p>Отдайте вещь, которая лежит без дела,<br className="desktop-break"/> и найдите нужную. Мы соединим обмены в круг.</p>
      <div className="hero-actions"><Action onClick={() => router.push("/listings/new")}>＋ Предложить вещь</Action><a href="#how-it-works" className="text-link">Как это работает <span>↘</span></a></div>
      <div className="hero-footnote"><span className="mini-avatars"><i>А</i><i>Б</i><i>В</i></span><span>От двух до четырёх участников.<br/>Каждый получает то, что искал.</span></div>
    </div><HeroArt /></section>
    <section className="catalog-section" aria-labelledby="catalog-title"><div className="section-heading"><div><span className="eyebrow">ВЕЩАМ НУЖЕН НОВЫЙ КРУГ</span><h2 id="catalog-title">Что меняют в городе <span className="count-bubble">{result.data?.total ?? "…"}</span></h2></div><span className="muted catalog-note">Одна вещь — много возможностей</span></div>
      <div className="catalog-filters"><Field label="Найти вещь или пожелание" value={search} onChange={change(setSearch)} placeholder="Например, велосипед"/><Field label="Район" value={area} onChange={change(setArea)} options={[{ id: "", label: "Весь Владивосток" }, ...areas]}/></div>
      <div className="category-chips" aria-label="Категории"><Pill selected={!category} onClick={() => change(setCategory)("")}>Все вещи</Pill>{categories.map((c) => <Pill key={c.id} selected={category === c.id} onClick={() => change(setCategory)(c.id)}>{c.label}</Pill>)}</div>
      {result.error ? <Notice error>{result.error}</Notice> : result.loading ? <Loading/> : result.data?.items.length ? <div className="listing-grid">{result.data.items.map((l) => <ListingCard key={l.id} listing={l}/>)}</div> : <Empty title="Таких вещей пока нет">Попробуйте другой запрос или предложите свою вещь.</Empty>}
      {result.data && result.data.total > 12 && <div className="pagination"><Action variant="tonal" disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</Action><span>Страница {page}</span><Action variant="tonal" disabled={page * 12 >= result.data.total} onClick={() => setPage(page + 1)}>Дальше</Action></div>}
    </section>
    <section className="how-section" id="how-it-works"><span className="eyebrow">БОЛЬШЕ ВОЗМОЖНОСТЕЙ ДЛЯ ОБМЕНА</span><h2>Прямой обмен не сложился?<br/>Попробуйте по кругу.</h2><div className="steps"><article><span>01</span><h3>Расскажите о вещи</h3><p>Что отдаёте, что ищете и где готовы встретиться.</p></article><article><span>02</span><h3>Найдите свой круг</h3><p>Сервис подберёт обмен между двумя, тремя или четырьмя людьми.</p></article><article><span>03</span><h3>Подтвердите интерес</h3><p>Когда согласны все, вещи резервируются. Остаётся договориться о встрече.</p></article></div></section>
    {metrics.data && <section className="metrics-section"><div><span className="eyebrow">ЧТО НАШЁЛ АЛГОРИТМ</span><h2>Больше связей.<br/>Больше вариантов.</h2><p>{metrics.data.isDemo ? "Расчёт на демонстрационных заявках." : "Расчёт на текущих активных заявках."} Это возможности обмена, а не совершённые сделки.</p></div><div className="metric-grid"><div><strong>{metrics.data.directOwners}</strong><span>участников с прямым обменом</span></div><div><strong>{metrics.data.multiwayOwners}</strong><span>участников с кругами до 4 человек</span></div><div><strong>+{metrics.data.additionalOwners}</strong><span>участников получили варианты благодаря кругам</span></div><div><strong>{metrics.data.agreed}</strong><span>согласованных кругов · обмен ещё не завершён</span></div></div>{metrics.data.truncated && <p className="muted">Показан ограниченный расчёт; полный граф больше лимита поиска.</p>}</section>}
  </>;
}
