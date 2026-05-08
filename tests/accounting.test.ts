import { describe, expect, it } from "vitest";

import { prisma } from "../src/lib/db";
import { SETTLEMENT_RESULT } from "../src/lib/domain";
import { cancelBet, depositToUser, placeBet, reconcileUser, settleBet } from "../src/lib/services/accounting";
import { getUserByUsername } from "./helpers/db";

describe("accounting service", () => {
  it("deposit increases balance correctly", async () => {
    const alice = await getUserByUsername("alice");
    const result = await depositToUser(alice.id, { amount: 500 }, "dep-1");

    expect(result.status).toBe(200);
    expect(result.body.balance).toBe(10500);
  });

  it("deposit idempotency only applies once", async () => {
    const alice = await getUserByUsername("alice");
    const first = await depositToUser(alice.id, { amount: 400 }, "dep-repeat");
    const second = await depositToUser(alice.id, { amount: 400 }, "dep-repeat");
    const refreshedAlice = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });

    expect(first.body).toEqual(second.body);
    expect(refreshedAlice.balance).toBe(10400);
  });

  it("deposit idempotency rejects conflicting payloads", async () => {
    const alice = await getUserByUsername("alice");
    await depositToUser(alice.id, { amount: 200 }, "dep-conflict");

    await expect(depositToUser(alice.id, { amount: 300 }, "dep-conflict")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("bet placement fails on insufficient balance", async () => {
    const charlie = await getUserByUsername("charlie");

    await expect(
      placeBet(
        {
          userId: charlie.id,
          gameId: "small-bankroll",
          amount: 999999,
        },
        "bet-no-funds",
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("bet idempotency only creates one bet", async () => {
    const alice = await getUserByUsername("alice");
    const payload = {
      userId: alice.id,
      gameId: "world-cup",
      amount: 1000,
    };

    const first = await placeBet(payload, "bet-repeat");
    const second = await placeBet(payload, "bet-repeat");
    const bets = await prisma.bet.findMany({ where: { userId: alice.id, gameId: "world-cup" } });

    expect(first.body).toEqual(second.body);
    expect(bets).toHaveLength(1);
  });

  it("winning settlement increases balance correctly", async () => {
    const alice = await getUserByUsername("alice");
    const placed = await placeBet(
      {
        userId: alice.id,
        gameId: "election",
        amount: 1000,
      },
      "bet-win",
    );

    const result = await settleBet(placed.body.betId, SETTLEMENT_RESULT.WIN);
    expect(result.balance).toBe(11000);
  });

  it("settled bets cannot be settled twice", async () => {
    const alice = await getUserByUsername("alice");
    const placed = await placeBet(
      {
        userId: alice.id,
        gameId: "repeat-settlement",
        amount: 1000,
      },
      "bet-settle-once",
    );

    await settleBet(placed.body.betId, SETTLEMENT_RESULT.LOSE);

    await expect(settleBet(placed.body.betId, SETTLEMENT_RESULT.WIN)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("cancelling a placed bet refunds balance", async () => {
    const bob = await getUserByUsername("bob");
    const placed = await placeBet(
      {
        userId: bob.id,
        gameId: "cancel-me",
        amount: 1200,
      },
      "bet-cancel",
    );

    const result = await cancelBet(placed.body.betId);
    expect(result.balance).toBe(6000);
  });

  it("reconcile reports a clean normal flow", async () => {
    const alice = await getUserByUsername("alice");
    const placed = await placeBet(
      {
        userId: alice.id,
        gameId: "clean-flow",
        amount: 500,
      },
      "bet-clean",
    );

    await settleBet(placed.body.betId, SETTLEMENT_RESULT.LOSE);
    const reconcile = await reconcileUser(alice.id);

    expect(reconcile.isConsistent).toBe(true);
    expect(reconcile.anomalies).toEqual([]);
  });

  it("cancelled bets cannot be cancelled twice", async () => {
    const bob = await getUserByUsername("bob");
    const placed = await placeBet(
      {
        userId: bob.id,
        gameId: "repeat-cancel",
        amount: 300,
      },
      "bet-cancel-twice",
    );

    await cancelBet(placed.body.betId);

    await expect(cancelBet(placed.body.betId)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("reconcile detects balance mismatch anomalies", async () => {
    const alice = await getUserByUsername("alice");

    await prisma.user.update({
      where: { id: alice.id },
      data: { balance: 1 },
    });

    const reconcile = await reconcileUser(alice.id);
    expect(reconcile.isConsistent).toBe(false);
    expect(reconcile.anomalies.some((item) => item.code === "BALANCE_MISMATCH")).toBe(true);
  });
});
