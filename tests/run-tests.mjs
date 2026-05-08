import assert from "node:assert/strict";
import path from "node:path";
import seedUsers from "../prisma/seed-data.json" with { type: "json" };

const projectRoot = process.cwd();
process.env.DATABASE_URL = `file:${path.resolve(projectRoot, "prisma/dev.db").replace(/\\/g, "/")}`;
process.env.NODE_ENV = "test";

const { prisma } = await import("../src/lib/db.ts");
const {
  cancelBet,
  depositToUser,
  placeBet,
  reconcileUser,
  settleBet,
} = await import("../src/lib/services/accounting.ts");
const { SETTLEMENT_RESULT } = await import("../src/lib/domain.ts");

const results = [];

async function getUserByUsername(username) {
  return prisma.user.findUniqueOrThrow({
    where: { username },
  });
}

async function resetDatabase() {
  await prisma.ledgerEntry.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.user.deleteMany();

  for (const user of seedUsers) {
    const created = await prisma.user.create({
      data: user,
    });

    await prisma.ledgerEntry.create({
      data: {
        userId: created.id,
        type: "INITIAL_BALANCE",
        amountDelta: user.balance,
        note: "Seeded initial balance",
      },
    });
  }
}

async function runCase(name, fn) {
  try {
    await resetDatabase();
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

await runCase("deposit increases balance correctly", async () => {
  const alice = await getUserByUsername("alice");
  const result = await depositToUser(alice.id, { amount: 500 }, "dep-1");
  assert.equal(result.status, 200);
  assert.equal(result.body.balance, 10500);
});

await runCase("deposit idempotency only applies once", async () => {
  const alice = await getUserByUsername("alice");
  const first = await depositToUser(alice.id, { amount: 400 }, "dep-repeat");
  const second = await depositToUser(alice.id, { amount: 400 }, "dep-repeat");
  const refreshedAlice = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });

  assert.deepEqual(first.body, second.body);
  assert.equal(refreshedAlice.balance, 10400);
});

await runCase("deposit idempotency rejects conflicting payloads", async () => {
  const alice = await getUserByUsername("alice");
  await depositToUser(alice.id, { amount: 200 }, "dep-conflict");

  await assert.rejects(
    () => depositToUser(alice.id, { amount: 300 }, "dep-conflict"),
    (error) => error?.statusCode === 409,
  );
});

await runCase("bet placement fails on insufficient balance", async () => {
  const charlie = await getUserByUsername("charlie");
  await assert.rejects(
    () =>
      placeBet(
        {
          userId: charlie.id,
          gameId: "small-bankroll",
          amount: 999999,
        },
        "bet-no-funds",
      ),
    (error) => error?.statusCode === 409,
  );
});

await runCase("bet idempotency only creates one bet", async () => {
  const alice = await getUserByUsername("alice");
  const payload = {
    userId: alice.id,
    gameId: "world-cup",
    amount: 1000,
  };

  const first = await placeBet(payload, "bet-repeat");
  const second = await placeBet(payload, "bet-repeat");
  const bets = await prisma.bet.findMany({ where: { userId: alice.id, gameId: "world-cup" } });

  assert.deepEqual(first.body, second.body);
  assert.equal(bets.length, 1);
});

await runCase("winning settlement increases balance correctly", async () => {
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
  assert.equal(result.balance, 11000);
});

await runCase("settled bets cannot be settled twice", async () => {
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

  await assert.rejects(
    () => settleBet(placed.body.betId, SETTLEMENT_RESULT.WIN),
    (error) => error?.statusCode === 409,
  );
});

await runCase("cancelling a placed bet refunds balance", async () => {
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
  assert.equal(result.balance, 6000);
});

await runCase("reconcile reports a clean normal flow", async () => {
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

  assert.equal(reconcile.isConsistent, true);
  assert.deepEqual(reconcile.anomalies, []);
});

await runCase("cancelled bets cannot be cancelled twice", async () => {
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

  await assert.rejects(
    () => cancelBet(placed.body.betId),
    (error) => error?.statusCode === 409,
  );
});

await runCase("reconcile detects balance mismatch anomalies", async () => {
  const alice = await getUserByUsername("alice");

  await prisma.user.update({
    where: { id: alice.id },
    data: { balance: 1 },
  });

  const reconcile = await reconcileUser(alice.id);
  assert.equal(reconcile.isConsistent, false);
  assert.ok(reconcile.anomalies.some((item) => item.includes("Cached balance")));
});

const failures = results.filter((result) => !result.ok);

console.log("");
console.log(`Executed ${results.length} checks`);

if (failures.length > 0) {
  console.error(`${failures.length} checks failed`);
  process.exit(1);
}

console.log("All checks passed");
await prisma.$disconnect();
