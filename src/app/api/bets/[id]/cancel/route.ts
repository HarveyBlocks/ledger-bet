import { handleRouteError, ok } from "@/lib/http";
import { cancelBet } from "@/lib/services/accounting";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await cancelBet(Number(id));
    return ok(result, 200);
  } catch (error) {
    return handleRouteError(error);
  }
}
