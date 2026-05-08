const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

if (process.env.DATABASE_URL?.startsWith("file:./")) {
  const relativePath = process.env.DATABASE_URL.slice("file:".length);
  const absolutePath = path.resolve(process.cwd(), relativePath);
  process.env.DATABASE_URL = `file:${absolutePath.replace(/\\/g, "/")}`;
}

const prisma = new PrismaClient();

const seedUsers = [
  { username: "alice", balance: 10000 },
  { username: "bob", balance: 6000 },
  { username: "charlie", balance: 2500 },
];

async function main() {
  await prisma.ledgerEntry.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.user.deleteMany();

  for (const user of seedUsers) {
    const created = await prisma.user.create({
      data: {
        username: user.username,
        balance: user.balance,
      },
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
