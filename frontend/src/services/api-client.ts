export class ApiError extends Error {
  readonly status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let csrfToken: string | null = null;

export function clearCsrfToken() {
  csrfToken = null;
}

function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SAVORA_API_BASE_URL ||
    (typeof window === "undefined" ? process.env.SAVORA_INTERNAL_API_URL : window.location.origin);
  if (!configured) throw new ApiError(null, "API URL is not configured");
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ApiError(null, "API URL is invalid");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") {
    throw new ApiError(null, "API URL is invalid");
  }
  return url.origin;
}

export async function apiRequest<T>(
  path: `/api/${string}`,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; csrf?: "login" | "session"; signal?: AbortSignal } = {},
): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.csrf === "login") headers.set("X-Savora-CSRF", "1");
  if (options.csrf === "session") headers.set("X-Savora-CSRF", await getCsrfToken());

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
      cache: "no-store",
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw new ApiError(null, "Request cancelled");
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiError(null, "Request timed out");
    }
    throw new ApiError(null, "Cannot reach the server");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) clearCsrfToken();
    throw new ApiError(response.status, response.status === 401 ? "Unauthorized" :
      response.status === 403 ? "Request rejected" :
      response.status === 429 ? "Too many requests" : "Request failed");
  }
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw new ApiError(null, "Invalid server response");
  }
}

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await apiRequest<{ csrfToken: unknown }>("/api/auth/csrf");
  if (typeof response?.csrfToken !== "string" || !/^[0-9a-f]{64}$/.test(response.csrfToken)) {
    throw new ApiError(null, "Invalid server response");
  }
  csrfToken = response.csrfToken;
  return csrfToken;
}
