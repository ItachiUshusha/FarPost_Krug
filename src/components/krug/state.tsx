"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/krug-api";
import type { ListingInput, User } from "../../../shared/krug/types";

interface AppState {
  user: User | null; people: User[]; demoMode: boolean; ready: boolean; error: string; busy: boolean;
  guestOpen: boolean; setGuestOpen: (open: boolean) => void; refresh: () => void;
  demoLogin: (key: string) => Promise<void>; guestLogin: (name: string, areaId: string) => Promise<void>; logout: () => Promise<void>;
  drafts: Record<string, ListingInput>; saveDraft: (key: string, draft: ListingInput) => void; revision: number;
}
const Context = createContext<AppState>(null!);
export const useApp = () => useContext(Context);
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [people, setPeople] = useState<User[]>([]);
  const [demoMode, setDemo] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [guestOpen, setGuestOpen] = useState(false), [revision, setRevision] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, ListingInput>>({});
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User | null; demoMode: boolean }>("/session", undefined, "GET", controller.signal).then(async (data) => {
      setUser(data.user); setDemo(data.demoMode); setError("");
      if (data.demoMode) { const data = await api<{ people: User[] }>("/demo/people", undefined, "GET", controller.signal); setPeople(data.people); }
      setReady(true);
    }).catch((e) => { if (!controller.signal.aborted) { setError(e.message); setReady(true); } });
    return () => controller.abort();
  }, [revision]);
  const login = async (path: string, body: unknown) => {
    setBusy(true); setError("");
    try { const data = await api<{ user: User }>(path, body); setUser(data.user); setDrafts((v) => v["guest:new"] && !v[`${data.user.id}:new`] ? { ...v, [`${data.user.id}:new`]: v["guest:new"] } : v); setGuestOpen(false); refresh(); }
    catch (e) { setError((e as Error).message); throw e; } finally { setBusy(false); }
  };
  return <Context.Provider value={{ user, people, demoMode, ready, error, busy, guestOpen, setGuestOpen, refresh, revision, drafts,
    saveDraft: (key, draft) => setDrafts((v) => ({ ...v, [key]: draft })),
    demoLogin: (key) => login("/demo/session", { key }), guestLogin: (name, areaId) => login("/session/guest", { name, areaId }),
    logout: async () => { setBusy(true); setError(""); try { await api("/session", undefined, "DELETE"); setUser(null); refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } },
  }}>{children}</Context.Provider>;
}

export function useResource<T>(path: string | null, revision = 0) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: "", loading: true });
  useEffect(() => {
    const controller = new AbortController();
    if (!path) { Promise.resolve().then(() => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: "" }); }); return () => controller.abort(); }
    const load = async () => {
      setState((v) => ({ ...v, error: "", loading: true }));
      try { const data = await api<T>(path, undefined, "GET", controller.signal); setState({ data, error: "", loading: false }); }
      catch (e) { if (!controller.signal.aborted) setState({ data: null, error: (e as Error).message, loading: false }); }
    };
    void load(); return () => controller.abort();
  }, [path, revision]);
  return state;
}
