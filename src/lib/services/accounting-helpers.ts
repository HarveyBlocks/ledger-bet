import { Prisma } from "@prisma/client";

import { IDEMPOTENCY_SCOPE, type IdempotencyScope, LEDGER_ENTRY_TYPE } from "@/lib/domain";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export type TransactionClient = Prisma.TransactionClient;

export type IdempotentResult<T> = {
  status: number;
  body: T;
};

export function ensureIdempotencyKey(key?: string | null) {
  if (!key || !key.trim()) {
    throw new ValidationError("Idempotency-Key header is required", "MISSING_IDEMPOTENCY_KEY");
  }

  return key.trim();
}

export async function findUserOrThrow(tx: TransactionClient, userId: number) {
  const user = await tx.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  return user;
}

export async function findBetOrThrow(tx: TransactionClient, betId: number) {
  const bet = await tx.bet.findUnique({ where: { id: betId } });

  if (!bet) {
    throw new NotFoundError("Bet not found", "BET_NOT_FOUND");
  }

  return bet;
}

export async function appendLedgerEntry(
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

export async function recomputeAndPersistBalance(tx: TransactionClient, userId: number) {
  const aggregate = await tx.ledgerEntry.aggregate({
    where: { userId },
    _sum: {
      amountDelta: true,
    },
  });

  const computedBalance = aggregate._sum.amountDelta ?? 0;

  await tx.user.update({
    where: { id: userId },
    data: { balance: computedBalance },
  });

  return computedBalance;
}

export async function resolveIdempotentReplay<T>(
  tx: TransactionClient,
  scope: IdempotencyScope,
  key: string,
  fingerprint: string,
) {
  const existing = await tx.idempotencyKey.findUnique({
    where: {
      scope_key: {
        scope,
        key,
      },
    },
  });

  if (!existing) {
    return null;
  }

  if (existing.requestFingerprint !== fingerprint) {
    throw new ConflictError("Idempotency key reused with different payload", "IDEMPOTENCY_MISMATCH");
  }

  return {
    status: existing.responseCode,
    body: JSON.parse(existing.responseBody) as T,
  };
}

export async function storeIdempotentResult<T>(
  tx: TransactionClient,
  input: {
    scope: IdempotencyScope;
    key: string;
    fingerprint: string;
    responseCode: number;
    responseBody: T;
    userId?: number;
    betId?: number;
  },
) {
  await tx.idempotencyKey.create({
    data: {
      scope: input.scope,
      key: input.key,
      requestFingerprint: input.fingerprint,
      responseCode: input.responseCode,
      responseBody: JSON.stringify(input.responseBody),
      userId: input.userId,
      betId: input.betId,
    },
  });
}

export function assertPositiveAmount(amount: number, fieldName = "amount") {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`, "INVALID_AMOUNT");
  }
}

export function assertKnownIdempotencyScope(scope: string) {
  if (!Object.values(IDEMPOTENCY_SCOPE).includes(scope as IdempotencyScope)) {
    throw new ValidationError("Unsupported idempotency scope", "INVALID_IDEMPOTENCY_SCOPE");
  }
}

export function assertLedgerType(type: string) {
  if (!Object.values(LEDGER_ENTRY_TYPE).includes(type as (typeof LEDGER_ENTRY_TYPE)[keyof typeof LEDGER_ENTRY_TYPE])) {
    throw new ValidationError("Unsupported ledger entry type", "INVALID_LEDGER_ENTRY_TYPE");
  }
}
