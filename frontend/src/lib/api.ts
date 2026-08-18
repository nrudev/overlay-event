import { getSessionId } from './storage';

export class ApiError extends Error {}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error ?? '알 수 없는 오류');
  return data as T;
}
