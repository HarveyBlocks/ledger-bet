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

function isEnumValue<T extends string>(value: string, candidates: Record<string, T>): value is T {
  return Object.values(candidates).includes(value as T);
}

export function parseBetStatus(value: string): BetStatus {
  if (!isEnumValue(value, BET_STATUS)) {
    throw new Error(`Unsupported bet status: ${value}`);
  }

  return value;
}

export function parseSettlementResult(value: string | null): SettlementResult | null {
  if (value === null) {
    return null;
  }

  if (!isEnumValue(value, SETTLEMENT_RESULT)) {
    throw new Error(`Unsupported settlement result: ${value}`);
  }

  return value;
}

export function parseLedgerEntryType(value: string): LedgerEntryType {
  if (!isEnumValue(value, LEDGER_ENTRY_TYPE)) {
    throw new Error(`Unsupported ledger entry type: ${value}`);
  }

  return value;
}

export function parseIdempotencyScope(value: string): IdempotencyScope {
  if (!isEnumValue(value, IDEMPOTENCY_SCOPE)) {
    throw new Error(`Unsupported idempotency scope: ${value}`);
  }

  return value;
}
