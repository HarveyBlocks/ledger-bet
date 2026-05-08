import { ok, handleRouteError } from "../../../lib/http.ts";
import { listUsers } from "../../../lib/services/accounting.ts";

export async function GET() {
  try {
    const users = await listUsers();
    return ok({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}
