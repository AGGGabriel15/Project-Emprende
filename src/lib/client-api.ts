export async function clientApi<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error?.message ?? "No se pudo completar la solicitud.",
    );
  return body.data as T;
}
