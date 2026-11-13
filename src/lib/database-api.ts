export async function databaseApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/db${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-DB-Client": "vibe-farpost",
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(
      "Не удалось связаться с сервером базы. Проверьте, что запущен npm run dev.",
    );
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.error ||
        "Сервер базы недоступен. Проверьте, что запущен npm run dev.",
    );
  return body as T;
}
