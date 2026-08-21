import type { z } from "zod";

import { ApiErrorSchema, type ApiErrorCode } from "@/contracts";

export class ApiClientError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
    this.name = "ApiClientError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Single entry point for browser calls to the product API. Anything the
 * transport or the contract cannot explain becomes INTERNAL_ERROR, so callers
 * only ever branch on codes the contract defines. */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError("INTERNAL_ERROR");
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("INTERNAL_ERROR");
  }

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);

    throw new ApiClientError(
      parsed.success ? parsed.data.error.code : "INTERNAL_ERROR",
    );
  }

  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiClientError("INTERNAL_ERROR");
  }

  return parsed.data;
}
