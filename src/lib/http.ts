import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import type { ApiErrorResponse, ApiSuccessResponse } from "@/lib/types";

export function ok<T>(data: T, status = 200) {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  return NextResponse.json(body, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    };

    return NextResponse.json(
      body,
      { status: error.statusCode },
    );
  }

  console.error(error);

  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
  };

  return NextResponse.json(
    body,
    { status: 500 },
  );
}
