// Error thrown for any non-2xx response. Keeps the HTTP status and the JSON
// body so pages can react to specific cases (e.g. 429 rate limiting).
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown> | null;

  constructor(message: string, status: number, body: Record<string, unknown> | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// True when the server says email sending hit its quota (HTTP 429 + rateLimited).
export function isRateLimited(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 429 && err.body?.rateLimited === true;
}

export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let body: Record<string, unknown> | null = null;
    try {
      body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {}

    throw new ApiError(message, res.status, body);
  }

  return res.json();
}
