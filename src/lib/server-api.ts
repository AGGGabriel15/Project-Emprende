export async function serverApi<T>(path: string): Promise<T | null> {
  try {
    const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { data: T };
    return body.data;
  } catch {
    return null;
  }
}

export async function serverApiEnvelope<T>(path: string): Promise<{
  data: T;
  meta?: { page?: number; pages?: number; total?: number; limit?: number };
} | null> {
  try {
    const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
