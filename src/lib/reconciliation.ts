import { BET_STATUS, LEDGER_ENTRY_TYPE, SETTLEMENT_RESULT, type BetStatus } from "@/lib/domain";
import type { DomainBet, DomainLedgerEntry, DomainUser, ReconcileAnomaly, ReconcileStatusCounts } from "@/lib/types";

export function buildStatusCounts(bets: DomainBet[]): ReconcileStatusCounts {
  return {
    [BET_STATUS.PLACED]: bets.filter((bet) => bet.status === BET_STATUS.PLACED).length,
    [BET_STATUS.SETTLED]: bets.filter((bet) => bet.status === BET_STATUS.SETTLED).length,
    [BET_STATUS.CANCELLED]: bets.filter((bet) => bet.status === BET_STATUS.CANCELLED).length,
  } satisfies Record<BetStatus, number>;
}

export function computeLedgerBalance(entries: DomainLedgerEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.amountDelta, 0);
}

export function detectReconcileAnomalies(input: {
  user: DomainUser;
  bets: DomainBet[];
  ledgerEntries: DomainLedgerEntry[];
}): ReconcileAnomaly[] {
  const anomalies: ReconcileAnomaly[] = [];
  const computedBalance = computeLedgerBalance(input.ledgerEntries);

  if (input.user.balance !== computedBalance) {
    anomalies.push({
      code: "BALANCE_MISMATCH",
      message: "Cached balance does not match ledger-derived balance",
    });
  }

  const entriesByBetId = new Map<number, DomainLedgerEntry[]>();

  for (const entry of input.ledgerEntries) {
    if (entry.betId === null) {
      continue;
    }

    const bucket = entriesByBetId.get(entry.betId) ?? [];
    bucket.push(entry);
    entriesByBetId.set(entry.betId, bucket);
  }

  for (const bet of input.bets) {
    const relatedEntries = entriesByBetId.get(bet.id) ?? [];
    const debitEntries = relatedEntries.filter((entry) => entry.type === LEDGER_ENTRY_TYPE.BET_DEBIT);
    const refundEntries = relatedEntries.filter((entry) => entry.type === LEDGER_ENTRY_TYPE.BET_REFUND);
    const payoutEntries = relatedEntries.filter((entry) => entry.type === LEDGER_ENTRY_TYPE.BET_PAYOUT);

    if (debitEntries.length === 0) {
      anomalies.push({
        code: "MISSING_BET_DEBIT",
        betId: bet.id,
        message: `Bet ${bet.id} is missing a debit ledger entry`,
      });
    } else if (debitEntries.length !== 1) {
      anomalies.push({
        code: "UNEXPECTED_BET_DEBIT_COUNT",
        betId: bet.id,
        message: `Bet ${bet.id} has ${debitEntries.length} debit entries`,
      });
    }

    if (bet.status === BET_STATUS.CANCELLED && refundEntries.length !== 1) {
      anomalies.push({
        code: refundEntries.length === 0 ? "MISSING_REFUND" : "UNEXPECTED_REFUND",
        betId: bet.id,
        message: `Cancelled bet ${bet.id} has ${refundEntries.length} refund entries`,
      });
    }

    if (bet.status !== BET_STATUS.CANCELLED && refundEntries.length > 0) {
      anomalies.push({
        code: "UNEXPECTED_REFUND",
        betId: bet.id,
        message: `Non-cancelled bet ${bet.id} has unexpected refund entries`,
      });
    }

    if (bet.status === BET_STATUS.SETTLED && bet.settlementResult === SETTLEMENT_RESULT.WIN) {
      if (payoutEntries.length === 0) {
        anomalies.push({
          code: "MISSING_PAYOUT",
          betId: bet.id,
          message: `Winning settled bet ${bet.id} is missing a payout entry`,
        });
      } else if (payoutEntries.length > 1) {
        anomalies.push({
          code: "DUPLICATE_PAYOUT",
          betId: bet.id,
          message: `Winning settled bet ${bet.id} has duplicate payout entries`,
        });
      }
    }

    if (bet.status === BET_STATUS.SETTLED && bet.settlementResult === SETTLEMENT_RESULT.LOSE && payoutEntries.length > 0) {
      anomalies.push({
        code: "UNEXPECTED_PAYOUT",
        betId: bet.id,
        message: `Losing settled bet ${bet.id} has unexpected payout entries`,
      });
    }
  }

  return anomalies;
}
