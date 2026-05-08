import { NextRequest } from "next/server";

import { handleRouteError, ok } from "../../../../../lib/http.ts";
import { depositToUser } from "../../../../../lib/services/accounting.ts";
import { parseJson, depositSchema } from "../../../../../lib/validation.ts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = parseJson(depositSchema, await request.json());
    const result = await depositToUser(Number(id), body, request.headers.get("Idempotency-Key"));
    return ok(result.body, result.status);
  } catch (error) {
    return handleRouteError(error);
  }
}
