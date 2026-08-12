import { appendFileSync } from "fs";

/** Number of times a rate-limited request is re-attempted before giving up. */
const RATE_LIMIT_ATTEMPTS = 4;
/** First backoff pause; doubles on each subsequent attempt. */
const RATE_LIMIT_BASE_PAUSE_MS = 2_000;

export function getAuth(): string {
  const apiKey = process.env.INPUT_TWILIO_API_KEY;
  const apiSecret = process.env.INPUT_TWILIO_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("Missing TWILIO_API_KEY or TWILIO_API_SECRET");
  return Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
}

export function getInput(name: string, required = false): string {
  const val = (process.env[`INPUT_${name}`] ?? "").trim();
  if (required && !val) throw new Error(`Missing required input: ${name}`);
  return val;
}

export function setOutput(name: string, value: string): void {
  appendFileSync(process.env.GITHUB_OUTPUT as string, `${name}=${value}\n`);
}

export function setMultilineOutput(name: string, value: string): void {
  const delimiter = `EOF_${Math.random().toString(36).slice(2)}`;
  appendFileSync(process.env.GITHUB_OUTPUT as string, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads the pause length Twilio asks for, falling back to exponential backoff
 * when the response carries no Retry-After header.
 */
function backoffFor(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1_000;
  return RATE_LIMIT_BASE_PAUSE_MS * 2 ** attempt;
}

/**
 * Single entry point for every Twilio call. Retries while the API reports a
 * rate limit, then hands back the raw response for the caller to interpret.
 * Exported so callers with unusual bodies (multipart uploads) still get retries.
 */
export async function twilioFetch(url: string, auth: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? "GET";

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (response.status !== 429) return response;

    if (attempt + 1 >= RATE_LIMIT_ATTEMPTS) {
      throw new Error(`${method} ${url} still rate limited after ${RATE_LIMIT_ATTEMPTS} attempts`);
    }

    const wait = backoffFor(response, attempt);
    console.log(`::debug::Rate limited by Twilio, waiting ${wait}ms before retrying ${method} ${url}`);
    await pause(wait);
  }
}

/** Throws with the response body included, so failures are diagnosable from the log. */
async function raiseFor(response: Response, method: string, url: string): Promise<never> {
  throw new Error(`${method} ${url} failed (${response.status}): ${await response.text()}`);
}

export async function twilioGet(url: string, auth: string): Promise<any> {
  const response = await twilioFetch(url, auth);
  if (!response.ok) await raiseFor(response, "GET", url);
  return response.json();
}

export async function twilioPost(
  url: string,
  auth: string,
  params: Record<string, string> | URLSearchParams
): Promise<{ status: number; data: any }> {
  const body = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const response = await twilioFetch(url, auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) await raiseFor(response, "POST", url);
  return { status: response.status, data: await response.json() };
}

export async function twilioPostJson(url: string, auth: string, body: unknown): Promise<{ status: number; data: any }> {
  const response = await twilioFetch(url, auth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await raiseFor(response, "POST", url);
  return { status: response.status, data: await response.json() };
}

/** A missing resource is treated as already deleted. */
export async function twilioDelete(url: string, auth: string): Promise<void> {
  const response = await twilioFetch(url, auth, { method: "DELETE" });
  if (!response.ok && response.status !== 404) await raiseFor(response, "DELETE", url);
}

/**
 * Walks a Twilio list endpoint to the end. Omit `listKey` to take it from the
 * response's own `meta.key`, which is the only reliable source for resource
 * types whose list property is not a simple lowercasing of the URL segment.
 */
export async function twilioGetAllPages(baseUrl: string, auth: string, listKey?: string): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = baseUrl;
  while (nextUrl) {
    const data = await twilioGet(nextUrl, auth);
    const key = listKey ?? data.meta?.key;
    if (!key) throw new Error(`Could not determine the list property of ${nextUrl}`);
    results.push(...(data[key] ?? []));
    const nextUri = data.meta?.next_page_url ?? data.next_page_uri;
    nextUrl = nextUri && nextUri.startsWith("http") ? nextUri : null;
  }
  return results;
}
