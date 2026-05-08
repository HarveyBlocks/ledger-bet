import { NextRequest } from "next/server";

import { handleRouteError, ok } from "../../../../lib/http.ts";
import { ValidationError } from "../../../../lib/errors.ts";
import { reconcileUser } from "../../../../lib/services/accounting.ts";

export async function GET(request: NextRequest) {
  try {
    const userIdParam = request.nextUrl.searchParams.get("userId");
    if (!userIdParam) {
      throw new ValidationError("userId query parameter is required", "MISSING_USER_ID");
    }

    const result = await reconcileUser(Number(userIdParam));
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
