import { ok, handleRouteError } from "@/lib/http";
import { listUsers } from "@/lib/services/accounting";

export async function GET() {
  try {
    const users = await listUsers();
    return ok({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}
