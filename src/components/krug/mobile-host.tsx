"use client";
import Framework7 from "framework7/lite-bundle";
import Framework7React, { App, View, Page, Navbar, Toolbar, Link as F7Link, Button, List, ListInput, Chip, Popup } from "framework7-react";
import { useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UIContext, type ActionProps, type FieldProps, type Kit, type ModalProps } from "./ui";
import { Brand } from "./icons";
import { CommonContent } from "./application";
import { useApp } from "./state";
// Framework7's plugin registration is a static method, not a React hook.
// eslint-disable-next-line react-hooks/rules-of-hooks
Framework7.use(Framework7React);

function MobileField({ label, value, onChange, options, multiline, required, placeholder, type, helper, disabled }: FieldProps) {
  const id = useId();
  return <List className="mobile-field"><ListInput inputId={id} type={options ? "select" : multiline ? "textarea" : type || "text"} value={value} onInput={options ? undefined : (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} onChange={options ? (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value) : undefined} required={required} disabled={disabled} placeholder={placeholder} info={helper} outline resizable={multiline}><label slot="label" htmlFor={id}>{label}</label>{options?.map((o) => <option value={o.id} key={o.id}>{o.label}</option>)}</ListInput></List>;
}
function MobileAction({ children, variant = "primary", disabled, type = "button", ...props }: ActionProps) { return <Button {...props} type={type} disabled={disabled} fill={variant === "primary" || variant === "danger"} tonal={variant === "tonal"} round large className={`mobile-action ${variant === "danger" ? "danger-action" : ""} ${props.className || ""}`}>{children}</Button>; }
function MobileModal({ title, open, onClose, children }: ModalProps) {
  const label = useId(), previousFocus = useRef<HTMLElement | null>(null);
  return <Popup className="krug-popup" opened={open} onPopupOpen={() => { previousFocus.current = document.activeElement as HTMLElement; }} onPopupOpened={(popup) => { const first = popup?.el.querySelector<HTMLElement>("input,select,textarea") || popup?.el.querySelector<HTMLElement>("button,a"); first?.focus(); }} onPopupClosed={() => { onClose(); previousFocus.current?.focus(); }} closeOnEscape closeByBackdropClick><div className="mobile-modal-content" role="dialog" aria-modal="true" aria-labelledby={label} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex='0']")].filter((el) => el.offsetParent !== null);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}><div className="mobile-modal-title"><h2 id={label}>{title}</h2><Button type="button" onClick={onClose} aria-label="Закрыть окно">✕</Button></div>{children}</div></Popup>;
}
const mobileKit: Kit = { Field: MobileField, Action: MobileAction, Modal: MobileModal, Pill: ({ children, selected, onClick }) => <button type="button" className="chip-control" aria-pressed={Boolean(selected)} onClick={onClick}><Chip text={typeof children === "string" ? children : undefined} className={selected ? "chip-selected" : ""}>{typeof children !== "string" ? children : undefined}</Chip></button> };

// This host persists across routes and widths: F7 has one application instance.
// Its View has no router; only Next.js owns browser history and deep links.
export default function MobileHost({ active }: { active: boolean }) {
  const router = useRouter(), pathname = usePathname(), { user, setGuestOpen } = useApp();
  const [activated, setActivated] = useState(false);
  if (active && !activated) setActivated(true);
  if (!active && !activated) return null;
  return <div className="mobile-host" style={{ display: active ? undefined : "none" }}><App theme="md" name="Круг" className="krug-mobile md krug-app" clicks={{ externalLinks: "a" }} touch={{ activeState: false, touchRipple: false }}>
    {active && <UIContext.Provider value={mobileKit}><View main router={false}><Page className="krug-page"><Navbar className="krug-navbar"><div className="mobile-header"><F7Link external onClick={(e) => { e.preventDefault(); router.push("/"); }}><Brand/></F7Link><button className="mobile-profile" onClick={() => user ? router.push("/my") : setGuestOpen(true)}>{user ? <><span className="avatar">{user.name[0]}</span>{user.name}</> : "Представиться"}</button></div></Navbar><Toolbar bottom tabbar className="krug-tabbar"><F7Link external tabLinkActive={pathname === "/"} onClick={(e) => { e.preventDefault(); router.push("/"); }}><span className="tab-icon">▦</span><span>Вещи</span></F7Link><F7Link external tabLinkActive={pathname === "/listings/new"} onClick={(e) => { e.preventDefault(); router.push("/listings/new"); }}><span className="tab-icon">＋</span><span>Предложить</span></F7Link><F7Link external tabLinkActive={pathname === "/matches"} onClick={(e) => { e.preventDefault(); router.push("/matches"); }}><span className="tab-icon">↻</span><span>Найти круг</span></F7Link><F7Link external tabLinkActive={pathname === "/my"} onClick={(e) => { e.preventDefault(); router.push("/my"); }}><span className="tab-icon">◎</span><span>Моё</span></F7Link></Toolbar><div className="mobile-content"><CommonContent/></div></Page></View></UIContext.Provider>}
  </App></div>;
}
