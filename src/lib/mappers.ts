import type { Bet, LedgerEntry, User } from "@prisma/client";

import { parseBetStatus, parseLedgerEntryType, parseSettlementResult } from "@/lib/domain";
import { type DomainBet, type DomainLedgerEntry, type DomainUser } from "@/lib/types";

export function toDomainUser(user: User): DomainUser {
  return {
    ...user,
    balance: user.balance,
  };
}

export function toDomainBet(bet: Bet): DomainBet {
  return {
    ...bet,
    status: parseBetStatus(bet.status),
    settlementResult: parseSettlementResult(bet.settlementResult),
  };
}

export function toDomainLedgerEntry(entry: LedgerEntry): DomainLedgerEntry {
  return {
    ...entry,
    type: parseLedgerEntryType(entry.type),
  };
}
