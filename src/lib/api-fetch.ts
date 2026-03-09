/** Client-seitiger Fetch mit automatischem basePath-Prefix. */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith("/") ? `${BASE}${input}` : input;
  return fetch(url, init);
}
