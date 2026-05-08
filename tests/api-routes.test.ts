import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as getUsers } from "@/app/api/users/route";
import { POST as depositPost } from "@/app/api/users/[id]/deposit/route";
import { POST as settlePost } from "@/app/api/bets/[id]/settle/route";

describe("api routes", () => {
  it("wraps successful responses in the standard api envelope", async () => {
    const response = await getUsers();
    const json = (await response.json()) as {
      success: boolean;
      data: {
        users: unknown[];
      };
    };

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.users)).toBe(true);
  });

  it("returns structured validation errors for invalid route params", async () => {
    const request = new NextRequest("http://localhost/api/users/not-a-number/deposit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "invalid-id",
      },
      body: JSON.stringify({ amount: 100 }),
    });

    const response = await depositPost(request, {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    const json = (await response.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    expect(response.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_INTEGER");
  });

  it("returns structured validation errors for invalid settle payload", async () => {
    const request = new NextRequest("http://localhost/api/bets/1/settle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ result: "INVALID" }),
    });

    const response = await settlePost(request, {
      params: Promise.resolve({ id: "1" }),
    });
    const json = (await response.json()) as {
      success: boolean;
      error: {
        code: string;
        message: string;
      };
    };

    expect(response.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_REQUEST_BODY");
  });
});
