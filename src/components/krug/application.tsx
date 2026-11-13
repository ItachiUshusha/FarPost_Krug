"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/krug-api";
import { areas } from "../../../shared/krug/reference";
import { AppStateProvider, useApp } from "./state";
import { Brand } from "./icons";
import { Catalog } from "./catalog";
import { ListingForm } from "./listing-form";
import { CircleDetails, ListingDetails, Matches, MyListings } from "./exchanges";
import { Notice, useUI } from "./ui";
import tokens from "@/theme/krug-tokens.json";
const MobileHost = dynamic(() => import("./mobile-host"), { ssr: false });
const mobileQuery = `(max-width: ${tokens.layout.expanded - 1}px)`;
const subscribe = (callback: () => void) => { const query = window.matchMedia(mobileQuery); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;
export function KrugApplication({ children }: { children: ReactNode }) { return <AppStateProvider><Application>{children}</Application></AppStateProvider>; }

function Application({ children }: { children: ReactNode }) {
  const mobile = useSyncExternalStore(subscribe, mobileSnapshot, serverSnapshot), pathname = usePathname();
  const studio = pathname.startsWith("/studio");
  return <><Suspense fallback={null}><MobileHost active={mobile && !studio}/></Suspense>{!studio && children}{studio ? <div className="studio-scope">{children}</div> : !mobile && <div className="krug-app desktop-app"><DesktopHeader/><div className="app-container"><CommonContent/></div><footer className="desktop-footer"><Link href="/"><Brand/></Link><span>Вещам — новую жизнь. Городу — больше связей.</span><Link href="/studio">Data Studio ↗</Link></footer></div>}</>;
}
function DesktopHeader() {
  const pathname = usePathname(), { user, setGuestOpen, logout } = useApp(), { Action } = useUI(), router = useRouter();
  return <header className="desktop-header"><div className="header-inner"><Link href="/" aria-label="Круг — главная"><Brand/></Link><nav aria-label="Основная навигация"><Link className={pathname === "/" ? "nav-active" : ""} href="/">Все вещи</Link><Link className={pathname === "/matches" ? "nav-active" : ""} href="/matches">Найти круг</Link><Link className={pathname === "/my" ? "nav-active" : ""} href="/my">Мои вещи и круги</Link></nav><div className="header-actions">{user ? <><button className="profile-button" onClick={() => router.push("/my")}><span className="avatar">{user.name[0]}</span>{user.name}</button><button className="logout-button" aria-label="Выйти из профиля" onClick={() => void logout()}>↪</button></> : <Action variant="tonal" onClick={() => setGuestOpen(true)}>Представиться</Action>}</div></div></header>;
}
export function CommonContent() {
  const pathname = usePathname(), { error, refresh } = useApp();
  let content: ReactNode;
  if (pathname === "/") content = <Catalog/>;
  else if (pathname === "/listings/new") content = <ListingForm/>;
  else if (/^\/listings\/[^/]+\/edit$/.test(pathname)) content = <ListingForm id={pathname.split("/")[2]}/>;
  else if (/^\/listings\/[^/]+$/.test(pathname)) content = <ListingDetails id={pathname.split("/")[2]}/>;
  else if (pathname === "/matches") content = <Matches/>;
  else if (pathname === "/my") content = <MyListings/>;
  else if (/^\/circles\/[^/]+$/.test(pathname)) content = <CircleDetails id={pathname.split("/")[2]}/>;
  else content = <Notice error>Страница не найдена. <Link href="/">Открыть каталог</Link></Notice>;
  return <><a className="skip-link" href="#main-content">К содержимому</a><DemoBar/>{error && <Notice error>{error} <button className="inline-button" onClick={refresh}>Повторить подключение</button></Notice>}<main id="main-content" key={pathname}>{content}</main><GuestModal/></>;
}
function DemoBar() {
  const { user, demoMode, people, demoLogin, busy, refresh } = useApp(), { Field, Action, Modal } = useUI();
  const [reset, setReset] = useState(false), [resetBusy, setBusy] = useState(false), [error, setError] = useState("");
  if (!demoMode) return null;
  return <><aside className="demo-bar" aria-label="Демонстрационный режим"><div className="demo-label"><span>ДЕМО</span><p>Попробуйте обмен за разных участников</p></div><div className="demo-controls"><Field label="Демопрофиль" value={user?.demoKey || ""} disabled={busy} onChange={(key) => { if (key) void demoLogin(key).catch(() => {}); }} options={[{ id: "", label: user?.isDemo ? "Выберите участника" : "Выбрать участника" }, ...people.map((p) => ({ id: p.demoKey!, label: `${p.name} · ${p.demoKey}` }))]}/>{user && <button className="demo-reset" onClick={() => setReset(true)}>Сбросить демо</button>}</div></aside><Modal title="Начать демонстрацию сначала?" open={reset} onClose={() => setReset(false)}><p className="modal-copy">Удалятся демонстрационные заявки и круги. Останутся 12 демопрофилей и 11 исходных вещей. Личные заявки других профилей сохранятся.</p>{error && <Notice error>{error}</Notice>}<div className="modal-actions"><Action variant="text" onClick={() => setReset(false)}>Отмена</Action><Action disabled={resetBusy} onClick={async () => { setBusy(true); setError(""); try { await api("/demo/reset", {}); refresh(); setReset(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Сбросить демо</Action></div></Modal></>;
}
function GuestModal() {
  const { guestOpen, setGuestOpen, guestLogin, busy, error } = useApp(), { Field, Action, Modal } = useUI();
  const [name, setName] = useState(""), [area, setArea] = useState("center");
  return <Modal title="Давайте знакомиться" open={guestOpen} onClose={() => setGuestOpen(false)}><p className="modal-copy">Имя увидят участники вашего круга. Локальный профиль сохранится в этом браузере.</p><form className="guest-form" onSubmit={(event) => { event.preventDefault(); void guestLogin(name, area).catch(() => {}); }}><Field label="Ваше имя" value={name} onChange={setName} required/><Field label="Район" value={area} onChange={setArea} options={areas}/>{error && <Notice error>{error}</Notice>}<Action type="submit" disabled={busy || name.trim().length < 2}>{busy ? "Создаём профиль…" : "Продолжить"}</Action></form></Modal>;
}
