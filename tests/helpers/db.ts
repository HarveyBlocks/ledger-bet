import { execFileSync } from "node:child_process";

import seedUsers from "../../prisma/seed-data.json";

import { prisma } from "@/lib/db";

const testDatabaseUrl = process.env.DATABASE_URL ?? "file:./test.db";

export const testPrisma = prisma;

export function ensureTestSchema() {
  execFileSync(process.execPath, ["./node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
    stdio: "ignore",
  });
}

export async function resetTestDatabase() {
  await testPrisma.ledgerEntry.deleteMany();
  await testPrisma.idempotencyKey.deleteMany();
  await testPrisma.bet.deleteMany();
  await testPrisma.user.deleteMany();

  for (const user of seedUsers) {
    const created = await testPrisma.user.create({
      data: user,
    });

    await testPrisma.ledgerEntry.create({
      data: {
        userId: created.id,
        type: "INITIAL_BALANCE",
        amountDelta: user.balance,
        note: "Seeded initial balance",
      },
    });
  }
}

export async function getUserByUsername(username: string) {
  return testPrisma.user.findUniqueOrThrow({
    where: { username },
  });
}
