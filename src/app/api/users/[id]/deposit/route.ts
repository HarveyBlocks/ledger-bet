import { NextRequest } from "next/server";

import { handleRouteError, ok } from "@/lib/http";
import { depositToUser } from "@/lib/services/accounting";
import { parseJson, depositSchema, parsePositiveInt } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = parseJson(depositSchema, await request.json());
    const userId = parsePositiveInt(id, "userId");
    const result = await depositToUser(userId, body, request.headers.get("Idempotency-Key"));
    return ok(result.body, result.status);
  } catch (error) {
    return handleRouteError(error);
  }
}
