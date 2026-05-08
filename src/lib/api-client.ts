import type { ApiErrorResponse, ApiResponse, ApiSuccessResponse } from "@/lib/types";

export function unwrapApiResponse<T>(payload: ApiResponse<T>): T {
  if ("error" in payload) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;
  return unwrapApiResponse(data);
}
