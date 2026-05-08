import { execFileSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";
import seedUsers from "../../prisma/seed-data.json";

const testDatabaseUrl = "file:./test.db";

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = "test";

export const testPrisma = new PrismaClient();

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
