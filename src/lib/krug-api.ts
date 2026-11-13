export class KrugApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST", signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/krug${path}`, { method, credentials: "same-origin", signal,
      headers: { "Content-Type": "application/json", "X-Krug-Client": "krug" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store" });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new KrugApiError("Нет связи с сервером. Проверьте подключение и повторите действие.", 0);
  }
  if (response.status === 204) return undefined as T;
  if (!response.headers.get("content-type")?.includes("application/json")) throw new KrugApiError("Сервис временно недоступен. Проверьте запуск сервера и повторите действие.", response.status);
  const data = await response.json();
  if (!response.ok) throw new KrugApiError(data.error?.message || data.error || "Не удалось выполнить запрос. Попробуйте ещё раз.", response.status);
  return data as T;
}
