import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      { status: error.statusCode },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
    { status: 500 },
  );
}
