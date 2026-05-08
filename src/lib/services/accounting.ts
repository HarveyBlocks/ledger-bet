import { Prisma } from "@prisma/client";

import { prisma } from "../db.ts";
import {
  BET_STATUS,
  IDEMPOTENCY_SCOPE,
  LEDGER_ENTRY_TYPE,
  SETTLEMENT_RESULT,
  type IdempotencyScope,
  type SettlementResult,
} from "../domain.ts";
import { ConflictError, NotFoundError } from "../errors.ts";
import { stableStringify } from "../serialize.ts";
import {
  appendLedgerEntry,
  assertPositiveAmount,
  ensureIdempotencyKey,
  findBetOrThrow,
  findUserOrThrow,
  recomputeAndPersistBalance,
  resolveIdempotentReplay,
  storeIdempotentResult,
} from "./accounting-helpers.ts";

type DepositPayload = {
  amount: number;
};

type BetPayload = {
  userId: number;
  gameId: string;
  amount: number;
};

function payoutForWin(amount: number) {
  return amount * 2;
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { id: "asc" },
  });
}

export async function listBets() {
  return prisma.bet.findMany({
    include: {
      user: true,
    },
    orderBy: { id: "desc" },
  });
}

export async function depositToUser(userId: number, payload: DepositPayload, idempotencyKey?: string | null) {
  assertPositiveAmount(payload.amount);
  const key = ensureIdempotencyKey(idempotencyKey);
  const fingerprint = stableStringify({ userId, ...payload });

  return prisma.$transaction(async (tx) => {
    const replay = await resolveIdempotentReplay(tx, IDEMPOTENCY_SCOPE.DEPOSIT, key, fingerprint);
    if (replay) {
      return replay;
    }

    await findUserOrThrow(tx, userId);

    await appendLedgerEntry(tx, {
      userId,
      type: LEDGER_ENTRY_TYPE.DEPOSIT,
      amountDelta: payload.amount,
      note: `Deposit with idempotency key ${key}`,
    });

    const balance = await recomputeAndPersistBalance(tx, userId);
    const responseBody = {
      userId,
      balance,
      depositedAmount: payload.amount,
    };

    await storeIdempotentResult(tx, {
      scope: IDEMPOTENCY_SCOPE.DEPOSIT,
      key,
      fingerprint,
      responseCode: 200,
      responseBody,
      userId,
    });

    return { status: 200, body: responseBody };
  });
}

export async function placeBet(payload: BetPayload, idempotencyKey?: string | null) {
  assertPositiveAmount(payload.amount);
  const key = ensureIdempotencyKey(idempotencyKey);
  const fingerprint = stableStringify(payload);

  return prisma.$transaction(async (tx) => {
    const replay = await resolveIdempotentReplay(tx, IDEMPOTENCY_SCOPE.BET, key, fingerprint);
    if (replay) {
      return replay;
    }

    const user = await findUserOrThrow(tx, payload.userId);

    if (user.balance < payload.amount) {
      throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");
    }

    const bet = await tx.bet.create({
      data: {
        userId: payload.userId,
        gameId: payload.gameId,
        amount: payload.amount,
        status: BET_STATUS.PLACED,
      },
    });

    await appendLedgerEntry(tx, {
      userId: payload.userId,
      betId: bet.id,
      type: LEDGER_ENTRY_TYPE.BET_DEBIT,
      amountDelta: -payload.amount,
      note: `Bet placement for game ${payload.gameId}`,
    });

    const balance = await recomputeAndPersistBalance(tx, payload.userId);
    const responseBody = {
      betId: bet.id,
      userId: payload.userId,
      gameId: payload.gameId,
      amount: payload.amount,
      status: bet.status,
      balance,
    };

    await storeIdempotentResult(tx, {
      scope: IDEMPOTENCY_SCOPE.BET,
      key,
      fingerprint,
      responseCode: 201,
      responseBody,
      userId: payload.userId,
      betId: bet.id,
    });

    return { status: 201, body: responseBody };
  });
}

export async function settleBet(betId: number, result: SettlementResult) {
  return prisma.$transaction(async (tx) => {
    const bet = await findBetOrThrow(tx, betId);

    if (bet.status !== BET_STATUS.PLACED) {
      throw new ConflictError("Only PLACED bets can be settled", "INVALID_BET_STATE");
    }

    if (result === SETTLEMENT_RESULT.WIN) {
      await appendLedgerEntry(tx, {
        userId: bet.userId,
        betId: bet.id,
        type: LEDGER_ENTRY_TYPE.BET_PAYOUT,
        amountDelta: payoutForWin(bet.amount),
        note: "Winning bet payout",
      });
    }

    const updatedBet = await tx.bet.update({
      where: { id: betId },
      data: {
        status: BET_STATUS.SETTLED,
        settlementResult: result,
      },
    });

    const balance = await recomputeAndPersistBalance(tx, bet.userId);

    return {
      betId: updatedBet.id,
      userId: updatedBet.userId,
      status: updatedBet.status,
      settlementResult: updatedBet.settlementResult,
      balance,
    };
  });
}

export async function cancelBet(betId: number) {
  return prisma.$transaction(async (tx) => {
    const bet = await findBetOrThrow(tx, betId);

    if (bet.status !== BET_STATUS.PLACED) {
      throw new ConflictError("Only PLACED bets can be cancelled", "INVALID_BET_STATE");
    }

    await appendLedgerEntry(tx, {
      userId: bet.userId,
      betId: bet.id,
      type: LEDGER_ENTRY_TYPE.BET_REFUND,
      amountDelta: bet.amount,
      note: "Bet cancelled and refunded",
    });

    const updatedBet = await tx.bet.update({
      where: { id: betId },
      data: {
        status: BET_STATUS.CANCELLED,
      },
    });

    const balance = await recomputeAndPersistBalance(tx, bet.userId);

    return {
      betId: updatedBet.id,
      userId: updatedBet.userId,
      status: updatedBet.status,
      balance,
    };
  });
}

export async function reconcileUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  const [ledgerEntries, bets] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    }),
    prisma.bet.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    }),
  ]);

  const computedBalance = ledgerEntries.reduce((sum, entry) => sum + entry.amountDelta, 0);

  const statusCounts = {
    PLACED: bets.filter((bet) => bet.status === BET_STATUS.PLACED).length,
    SETTLED: bets.filter((bet) => bet.status === BET_STATUS.SETTLED).length,
    CANCELLED: bets.filter((bet) => bet.status === BET_STATUS.CANCELLED).length,
  };

  const anomalies: string[] = [];

  if (user.balance !== computedBalance) {
    anomalies.push("Cached balance does not match ledger-derived balance");
  }

  const entriesByBetId = new Map<number, typeof ledgerEntries>();

  for (const entry of ledgerEntries) {
    if (entry.betId === null) {
      continue;
    }

    const bucket = entriesByBetId.get(entry.betId) ?? [];
    bucket.push(entry);
    entriesByBetId.set(entry.betId, bucket);
  }

  for (const bet of bets) {
    const relatedEntries = entriesByBetId.get(bet.id) ?? [];
    const debitEntries = relatedEntries.filter((entry) => entry.type === LEDGER_ENTRY_TYPE.BET_DEBIT);
    const refundEntries = relatedEntries.filter((entry) => entry.type === LEDGER_ENTRY_TYPE.BET_REFUND);
    const payoutEntries = relatedEntries.filter((entry) => entry.type === LEDGER_ENTRY_TYPE.BET_PAYOUT);

    if (debitEntries.length !== 1) {
      anomalies.push(`Bet ${bet.id} has ${debitEntries.length} debit entries`);
    }

    if (bet.status === BET_STATUS.CANCELLED && refundEntries.length !== 1) {
      anomalies.push(`Cancelled bet ${bet.id} has ${refundEntries.length} refund entries`);
    }

    if (bet.status !== BET_STATUS.CANCELLED && refundEntries.length > 0) {
      anomalies.push(`Non-cancelled bet ${bet.id} has unexpected refund entries`);
    }

    if (bet.status === BET_STATUS.SETTLED && bet.settlementResult === SETTLEMENT_RESULT.WIN) {
      if (payoutEntries.length !== 1) {
        anomalies.push(`Winning settled bet ${bet.id} has ${payoutEntries.length} payout entries`);
      }
    }

    if (bet.status === BET_STATUS.SETTLED && bet.settlementResult === SETTLEMENT_RESULT.LOSE && payoutEntries.length > 0) {
      anomalies.push(`Losing settled bet ${bet.id} has unexpected payout entries`);
    }

    if (payoutEntries.length > 1) {
      anomalies.push(`Bet ${bet.id} appears to have duplicate settlement payouts`);
    }
  }

  return {
    userId,
    username: user.username,
    databaseBalance: user.balance,
    computedBalance,
    isConsistent: anomalies.length === 0,
    statusCounts,
    anomalies,
  };
}
