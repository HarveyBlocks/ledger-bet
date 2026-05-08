import { NextRequest } from "next/server";

import { handleRouteError, ok } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { reconcileUser } from "@/lib/services/accounting";
import { parsePositiveInt } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const userIdParam = request.nextUrl.searchParams.get("userId");
    if (!userIdParam) {
      throw new ValidationError("userId query parameter is required", "MISSING_USER_ID");
    }

    const result = await reconcileUser(parsePositiveInt(userIdParam, "userId"));
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
