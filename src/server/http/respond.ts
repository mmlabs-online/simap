import "server-only";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/api/error";

/** The single error shape: `{ error: { code } }`, never a message. */
export function apiError(status: number, code: ApiErrorCode): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (status === 401) headers["WWW-Authenticate"] = "Bearer";
  if (status === 503) headers["Retry-After"] = "5";
  const body: ApiErrorBody = { error: { code } };
  return Response.json(body, { status, headers });
}
