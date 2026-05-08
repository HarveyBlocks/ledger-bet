import type { Bet, IdempotencyKey, LedgerEntry, User } from "@prisma/client";

import type { BetStatus, IdempotencyScope, LedgerEntryType, SettlementResult } from "@/lib/domain";

export type DomainUser = Omit<User, "balance"> & {
  balance: number;
};

export type DomainBet = Omit<Bet, "status" | "settlementResult"> & {
  status: BetStatus;
  settlementResult: SettlementResult | null;
};

export type DomainLedgerEntry = Omit<LedgerEntry, "type"> & {
  type: LedgerEntryType;
};

export type DomainIdempotencyKey = Omit<IdempotencyKey, "scope"> & {
  scope: IdempotencyScope;
};

export type ReconcileAnomalyCode =
  | "BALANCE_MISMATCH"
  | "MISSING_BET_DEBIT"
  | "UNEXPECTED_BET_DEBIT_COUNT"
  | "MISSING_REFUND"
  | "UNEXPECTED_REFUND"
  | "MISSING_PAYOUT"
  | "UNEXPECTED_PAYOUT"
  | "DUPLICATE_PAYOUT";

export type ReconcileAnomaly = {
  code: ReconcileAnomalyCode;
  betId?: number;
  message: string;
};

export type ReconcileStatusCounts = Record<BetStatus, number>;

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
