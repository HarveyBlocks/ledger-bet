import { NextRequest } from "next/server";

import { handleRouteError, ok } from "@/lib/http";
import { settleBet } from "@/lib/services/accounting";
import { parseJson, parsePositiveInt, settleSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = parseJson(settleSchema, await request.json());
    const betId = parsePositiveInt(id, "betId");
    const result = await settleBet(betId, body.result);
    return ok(result, 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
