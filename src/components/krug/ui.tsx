"use client";
import { createContext, useContext, type ReactNode } from "react";
import { Button, Chip, Dialog, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";

export interface FieldProps { label: string; value: string; onChange: (value: string) => void; options?: readonly { id: string; label: string }[]; multiline?: boolean; required?: boolean; placeholder?: string; type?: string; helper?: string; disabled?: boolean; }
export interface ActionProps { children: ReactNode; onClick?: () => void; type?: "button" | "submit"; variant?: "primary" | "tonal" | "text" | "danger"; disabled?: boolean; className?: string; }
export interface ModalProps { title: string; open: boolean; onClose: () => void; children: ReactNode; }
export interface Kit { Field: (props: FieldProps) => ReactNode; Action: (props: ActionProps) => ReactNode; Modal: (props: ModalProps) => ReactNode; Pill: (props: { children: ReactNode; selected?: boolean; onClick?: () => void }) => ReactNode; }
const desktop: Kit = {
  Field: ({ label, value, onChange, options, multiline, required, placeholder, type, helper, disabled }) => <TextField label={label} value={value} onChange={(e) => onChange(e.target.value)} select={Boolean(options)} multiline={multiline} minRows={multiline ? 3 : undefined} required={required} placeholder={placeholder} type={type} helperText={helper} disabled={disabled} slotProps={type === "datetime-local" ? { inputLabel: { shrink: true } } : undefined}>{options?.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}</TextField>,
  Action: ({ children, variant = "primary", ...props }) => <Button {...props} color={variant === "danger" ? "error" : "primary"} variant={variant === "primary" || variant === "danger" ? "contained" : variant === "tonal" ? "outlined" : "text"}>{children}</Button>,
  Pill: ({ children, selected, onClick }) => <Chip label={children} color={selected ? "primary" : "default"} variant={selected ? "filled" : "outlined"} onClick={onClick} />,
  Modal: ({ title, open, onClose, children }) => <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"><DialogTitle>{title}</DialogTitle><DialogContent>{children}</DialogContent></Dialog>,
};
export const UIContext = createContext<Kit>(desktop);
export const useUI = () => useContext(UIContext);
export function Loading() { return <div className="loading" role="status"><span className="spinner"/><span>Загружаем…</span></div>; }
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div className={`notice ${error ? "notice-error" : ""}`} role={error ? "alert" : "status"}>{children}</div>; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty-state"><span className="empty-ring" aria-hidden="true">↻</span><h2>{title}</h2><p>{children}</p></div>; }
