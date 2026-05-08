import seedUsers from "./seed-data.json" with { type: "json" };
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
