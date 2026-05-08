import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export type TransactionClient = Prisma.TransactionClient;

export async function runInTransaction<T>(handler: (tx: TransactionClient) => Promise<T>) {
  return prisma.$transaction(handler);
}

export async function findUserById(tx: TransactionClient, userId: number) {
  return tx.user.findUnique({
    where: { id: userId },
  });
}

export async function findBetById(tx: TransactionClient, betId: number) {
  return tx.bet.findUnique({
    where: { id: betId },
  });
}

export async function listUsersOrdered() {
  return prisma.user.findMany({
    orderBy: { id: "asc" },
  });
}

export async function listBetsOrdered() {
  return prisma.bet.findMany({
    include: {
      user: true,
    },
    orderBy: { id: "desc" },
  });
}

export async function createBet(
  tx: TransactionClient,
  input: {
    userId: number;
    gameId: string;
    amount: number;
    status: string;
  },
) {
  return tx.bet.create({
    data: input,
  });
}

export async function updateBetStatus(
  tx: TransactionClient,
  betId: number,
  input: {
    status: string;
    settlementResult?: string | null;
  },
) {
  return tx.bet.update({
    where: { id: betId },
    data: input,
  });
}

export async function createLedgerEntry(
  tx: TransactionClient,
  input: {
    userId: number;
    betId?: number;
    type: string;
    amountDelta: number;
    note: string;
  },
) {
  return tx.ledgerEntry.create({
    data: {
      userId: input.userId,
      betId: input.betId,
      type: input.type,
      amountDelta: input.amountDelta,
      note: input.note,
    },
  });
}

export async function sumLedgerBalance(tx: TransactionClient, userId: number) {
  const aggregate = await tx.ledgerEntry.aggregate({
    where: { userId },
    _sum: {
      amountDelta: true,
    },
  });

  return aggregate._sum.amountDelta ?? 0;
}

export async function updateUserBalance(tx: TransactionClient, userId: number, balance: number) {
  return tx.user.update({
    where: { id: userId },
    data: { balance },
  });
}

export async function findIdempotencyKey(tx: TransactionClient, scope: string, key: string) {
  return tx.idempotencyKey.findUnique({
    where: {
      scope_key: {
        scope,
        key,
      },
    },
  });
}

export async function createIdempotencyKey(
  tx: TransactionClient,
  input: {
    scope: string;
    key: string;
    requestFingerprint: string;
    responseCode: number;
    responseBody: string;
    userId?: number;
    betId?: number;
  },
) {
  return tx.idempotencyKey.create({
    data: input,
  });
}

export async function getUserWithHistory(userId: number) {
  const [user, ledgerEntries, bets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
    }),
    prisma.ledgerEntry.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    }),
    prisma.bet.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    }),
  ]);

  return {
    user,
    ledgerEntries,
    bets,
  };
}
