import { NextRequest } from "next/server";

import { type SettlementResult } from "@/lib/domain";
import { handleRouteError, ok } from "@/lib/http";
import { settleBet } from "@/lib/services/accounting";
import { parseJson, settleSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = parseJson(settleSchema, await request.json());
    const result = await settleBet(Number(id), body.result as SettlementResult);
    return ok(result, 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
