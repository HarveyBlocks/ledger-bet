import { BET_STATUS, IDEMPOTENCY_SCOPE, LEDGER_ENTRY_TYPE, SETTLEMENT_RESULT, type SettlementResult } from "@/lib/domain";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { toDomainBet, toDomainLedgerEntry, toDomainUser } from "@/lib/mappers";
import { buildStatusCounts, computeLedgerBalance, detectReconcileAnomalies } from "@/lib/reconciliation";
import {
  createBet,
  getUserWithHistory,
  listBetsOrdered,
  listUsersOrdered,
  runInTransaction,
  updateBetStatus,
} from "@/lib/repositories/accounting-repository";
import { stableStringify } from "@/lib/serialize";
import {
  appendLedgerEntry,
  assertPositiveAmount,
  ensureIdempotencyKey,
  findBetOrThrow,
  findUserOrThrow,
  recomputeAndPersistBalance,
  resolveIdempotentReplay,
  storeIdempotentResult,
} from "@/lib/services/accounting-helpers";

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
  return listUsersOrdered();
}

export async function listBets() {
  return listBetsOrdered();
}

export async function depositToUser(userId: number, payload: DepositPayload, idempotencyKey?: string | null) {
  assertPositiveAmount(payload.amount);
  const key = ensureIdempotencyKey(idempotencyKey);
  const fingerprint = stableStringify({ userId, ...payload });

  return runInTransaction(async (tx) => {
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

  return runInTransaction(async (tx) => {
    const replay = await resolveIdempotentReplay(tx, IDEMPOTENCY_SCOPE.BET, key, fingerprint);
    if (replay) {
      return replay;
    }

    const user = await findUserOrThrow(tx, payload.userId);

    if (user.balance < payload.amount) {
      throw new ConflictError("Insufficient balance", "INSUFFICIENT_BALANCE");
    }

    const bet = await createBet(tx, {
      userId: payload.userId,
      gameId: payload.gameId,
      amount: payload.amount,
      status: BET_STATUS.PLACED,
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
  return runInTransaction(async (tx) => {
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

    const updatedBet = await updateBetStatus(tx, betId, {
      status: BET_STATUS.SETTLED,
      settlementResult: result,
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
  return runInTransaction(async (tx) => {
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

    const updatedBet = await updateBetStatus(tx, betId, {
      status: BET_STATUS.CANCELLED,
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
  const result = await getUserWithHistory(userId);
  const user = result.user;

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  const ledgerEntries = result.ledgerEntries.map(toDomainLedgerEntry);
  const bets = result.bets.map(toDomainBet);
  const domainUser = toDomainUser(user);
  const computedBalance = computeLedgerBalance(ledgerEntries);
  const statusCounts = buildStatusCounts(bets);
  const anomalies = detectReconcileAnomalies({
    user: domainUser,
    bets,
    ledgerEntries,
  });

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
