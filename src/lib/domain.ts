export const BET_STATUS = {
  PLACED: "PLACED",
  SETTLED: "SETTLED",
  CANCELLED: "CANCELLED",
} as const;

export const SETTLEMENT_RESULT = {
  WIN: "WIN",
  LOSE: "LOSE",
} as const;

export const LEDGER_ENTRY_TYPE = {
  INITIAL_BALANCE: "INITIAL_BALANCE",
  DEPOSIT: "DEPOSIT",
  BET_DEBIT: "BET_DEBIT",
  BET_REFUND: "BET_REFUND",
  BET_PAYOUT: "BET_PAYOUT",
} as const;

export const IDEMPOTENCY_SCOPE = {
  DEPOSIT: "DEPOSIT",
  BET: "BET",
} as const;

export type BetStatus = (typeof BET_STATUS)[keyof typeof BET_STATUS];
export type SettlementResult = (typeof SETTLEMENT_RESULT)[keyof typeof SETTLEMENT_RESULT];
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPE)[keyof typeof LEDGER_ENTRY_TYPE];
export type IdempotencyScope = (typeof IDEMPOTENCY_SCOPE)[keyof typeof IDEMPOTENCY_SCOPE];
