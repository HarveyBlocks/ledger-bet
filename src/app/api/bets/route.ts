import { NextRequest } from "next/server";

import { handleRouteError, ok } from "@/lib/http";
import { listBets, placeBet } from "@/lib/services/accounting";
import { betSchema, parseJson } from "@/lib/validation";

export async function GET() {
  try {
    const bets = await listBets();
    return ok({ bets });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = parseJson(betSchema, await request.json());
    const result = await placeBet(body, request.headers.get("Idempotency-Key"));
    return ok(result.body, result.status);
  } catch (error) {
    return handleRouteError(error);
  }
}
