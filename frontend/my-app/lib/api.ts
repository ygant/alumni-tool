export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}

    throw new Error(message);
  }

  return res.json();
}
