import { handleRouteError, ok } from "@/lib/http";
import { cancelBet } from "@/lib/services/accounting";
import { parsePositiveInt } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const betId = parsePositiveInt(id, "betId");
    const result = await cancelBet(betId);
    return ok(result, 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
