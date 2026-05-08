import { type IdempotencyScope } from "@/lib/domain";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createIdempotencyKey,
  createLedgerEntry,
  findBetById,
  findIdempotencyKey,
  findUserById,
  sumLedgerBalance,
  updateUserBalance,
  type TransactionClient,
} from "@/lib/repositories/accounting-repository";

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
  const user = await findUserById(tx, userId);

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  return user;
}

export async function findBetOrThrow(tx: TransactionClient, betId: number) {
  const bet = await findBetById(tx, betId);

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
  return createLedgerEntry(tx, input);
}

export async function recomputeAndPersistBalance(tx: TransactionClient, userId: number) {
  const computedBalance = await sumLedgerBalance(tx, userId);
  await updateUserBalance(tx, userId, computedBalance);
  return computedBalance;
}

export async function resolveIdempotentReplay<T>(
  tx: TransactionClient,
  scope: IdempotencyScope,
  key: string,
  fingerprint: string,
) {
  const existing = await findIdempotencyKey(tx, scope, key);

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
  await createIdempotencyKey(tx, {
    scope: input.scope,
    key: input.key,
    requestFingerprint: input.fingerprint,
    responseCode: input.responseCode,
    responseBody: JSON.stringify(input.responseBody),
    userId: input.userId,
    betId: input.betId,
  });
}

export function assertPositiveAmount(amount: number, fieldName = "amount") {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`, "INVALID_AMOUNT");
  }
}
