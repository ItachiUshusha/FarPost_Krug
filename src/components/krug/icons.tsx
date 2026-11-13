import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  monitor: <><rect x="10" y="17" width="60" height="40" rx="4"/><path d="M33 67h14M40 57v10M17 49h46"/></>,
  bicycle: <><circle cx="19" cy="54" r="13"/><circle cx="61" cy="54" r="13"/><path d="m19 54 14-26 17 26H19l11-20h22m9 20-13-35h-8m-14 7h14"/></>,
  drill: <><path d="M12 25h38l9 7v16H33l-5 22H15l8-26H12zM59 33h15M59 42h10M35 49v8"/></>,
  backpack: <><rect x="19" y="19" width="42" height="53" rx="12"/><path d="M29 19v-5h22v5M26 42h28v21H26zM33 49h14M13 37v24m54-24v24"/></>,
  guitar: <><path d="m46 34 14-23 7 4-14 24c10 15-1 20-9 25-18 17-43-4-26-21 7-8 14-14 28-9Z"/><circle cx="36" cy="47" r="6"/><path d="m31 57 8 5m21-42 7 4"/></>,
  books: <><path d="M11 20c13-5 22-1 29 4 7-5 16-9 29-4v42c-13-4-22-1-29 4-7-5-16-8-29-4zM40 24v42M19 31l12 3m-12 8 12 3m18-11 12-3m-12 14 12-3"/></>,
  camera: <><path d="M9 29h16l5-10h20l5 10h16v36H9z"/><circle cx="40" cy="47" r="12"/><path d="M60 36h3M17 23h7"/></>,
  lamp: <><path d="M25 12h30l12 33H13zM40 45v23M27 69h26M55 46v10"/></>,
  kettle: <><path d="M20 29h34l7 29c2 12-46 12-44 0zM23 21h27M36 14v7M54 32c23-7 25 24 6 23M20 36 8 32l9 22"/></>,
  toaster: <><path d="M13 32c0-16 54-16 54 0v34H13zM24 28h32M22 71v-5m36 5v-5M59 44v12m-4-8h12"/></>,
  helmet: <><path d="M12 45a28 28 0 0 1 56 0v13H12zM40 17v18M20 28l9 9m31-9-9 9M13 47h54M24 59l7 12h18l7-12"/></>,
  sewing_machine: <><path d="M14 25h44v27H40V39H27v25h42v8H11v-8h7V25M58 31h10v17H58M33 16v9M34 53v10"/></>,
};
export function ItemArt({ type, small = false }: { type: string; small?: boolean }) {
  const hues: Record<string, string> = { monitor: "#d9e9f3", bicycle: "#e5efbd", drill: "#f7dfbc", backpack: "#eadff2", guitar: "#f2d9ca", books: "#dae9d9", camera: "#dcdff3", lamp: "#f4e7b8", kettle: "#d1e8e2", toaster: "#f2ddd7", helmet: "#e3e8da" };
  return <div className={`item-art ${small ? "item-art-small" : ""}`} style={{ "--art-color": hues[type] || "#e5eae3" } as CSSProperties}><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] || <><rect x="17" y="19" width="46" height="46" rx="8"/><path d="M29 42h22M40 31v22"/></>}</svg></div>;
}
export function Brand() { return <span className="brand"><span className="brand-symbol" aria-hidden="true">к</span>круг<span className="brand-dot">.</span></span>; }
