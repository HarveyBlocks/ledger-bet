"use client";

import { useEffect, useState, useTransition } from "react";

type User = {
  id: number;
  username: string;
  balance: number;
  createdAt: string;
};

type Bet = {
  id: number;
  userId: number;
  gameId: string;
  amount: number;
  status: "PLACED" | "SETTLED" | "CANCELLED";
  settlementResult: "WIN" | "LOSE" | null;
  createdAt: string;
  user: User;
};

type ReconcileResponse = {
  userId: number;
  username: string;
  databaseBalance: number;
  computedBalance: number;
  isConsistent: boolean;
  statusCounts: Record<string, number>;
  anomalies: string[];
};

type Snapshot = {
  users: User[];
  bets: Bet[];
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed");
  }

  return data;
}

export function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ users: [], bets: [] });
  const [message, setMessage] = useState<string>("Ready");
  const [log, setLog] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [depositAmount, setDepositAmount] = useState<number>(500);
  const [depositKey, setDepositKey] = useState("deposit-001");
  const [betUserId, setBetUserId] = useState<number>(1);
  const [betGameId, setBetGameId] = useState("election-2026");
  const [betAmount, setBetAmount] = useState<number>(300);
  const [betKey, setBetKey] = useState("bet-001");
  const [reconcileUserId, setReconcileUserId] = useState<number>(1);
  const [reconcileData, setReconcileData] = useState<ReconcileResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const [usersData, betsData] = await Promise.all([
      getJson<{ users: User[] }>("/api/users"),
      getJson<{ bets: Bet[] }>("/api/bets"),
    ]);

    setSnapshot({
      users: usersData.users,
      bets: betsData.bets,
    });

    if (usersData.users.length > 0) {
      setSelectedUserId((current) =>
        usersData.users.some((user) => user.id === current) ? current : usersData.users[0].id,
      );
      setBetUserId((current) =>
        usersData.users.some((user) => user.id === current) ? current : usersData.users[0].id,
      );
      setReconcileUserId((current) =>
        usersData.users.some((user) => user.id === current) ? current : usersData.users[0].id,
      );
    }
  }

  useEffect(() => {
    startTransition(() => {
      refresh()
        .then(() => setMessage("Loaded latest users and bets"))
        .catch((error: Error) => setMessage(error.message));
    });
  }, []);

  async function runAction(action: () => Promise<unknown>) {
    setMessage("Working...");

    try {
      const data = await action();
      setLog(JSON.stringify(data, null, 2));
      setMessage("Action completed");
      await refresh();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Unknown error";
      setMessage(nextMessage);
      setLog(nextMessage);
    }
  }

  function onDepositSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(() => {
      runAction(async () => {
        const response = await fetch(`/api/users/${selectedUserId}/deposit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": depositKey,
          },
          body: JSON.stringify({ amount: depositAmount }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message ?? "Deposit failed");
        }
        return data;
      });
    });
  }

  function onBetSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(() => {
      runAction(async () => {
        const response = await fetch("/api/bets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": betKey,
          },
          body: JSON.stringify({
            userId: betUserId,
            gameId: betGameId,
            amount: betAmount,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message ?? "Bet failed");
        }
        return data;
      });
    });
  }

  function actOnBet(betId: number, action: "settle-win" | "settle-lose" | "cancel") {
    startTransition(() => {
      runAction(async () => {
        if (action === "cancel") {
          const response = await fetch(`/api/bets/${betId}/cancel`, {
            method: "POST",
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message ?? "Cancel failed");
          }
          return data;
        }

        const result = action === "settle-win" ? "WIN" : "LOSE";
        const response = await fetch(`/api/bets/${betId}/settle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ result }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message ?? "Settle failed");
        }
        return data;
      });
    });
  }

  function loadReconcile() {
    startTransition(() => {
      runAction(async () => {
        const data = await getJson<ReconcileResponse>(`/api/admin/reconcile?userId=${reconcileUserId}`);
        setReconcileData(data);
        return data;
      });
    });
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="pill-row">
          <span className="pill">Next.js App Router</span>
          <span className="pill">Prisma + SQLite</span>
          <span className="pill">Append-only Ledger</span>
          <span className="pill">Idempotent APIs</span>
        </div>
        <h1>Ledger Bet</h1>
        <p>
          A focused prediction-market backend demo with strict balance accounting, transaction-backed
          state transitions, and reconciliation tooling. This page is built for fast manual verification.
        </p>
      </section>

      <section className="grid">
        <article className="card span-4">
          <h2>Deposit</h2>
          <p>Credits a seeded user and replays safely on repeated calls with the same idempotency key.</p>
          <form onSubmit={onDepositSubmit} className="form-grid">
            <div className="field">
              <label htmlFor="deposit-user">User</label>
              <select
                id="deposit-user"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(Number(event.target.value))}
              >
                {snapshot.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} (#{user.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="deposit-amount">Amount</label>
              <input
                id="deposit-amount"
                type="number"
                min={1}
                value={depositAmount}
                onChange={(event) => setDepositAmount(Number(event.target.value))}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="deposit-key">Idempotency Key</label>
              <input
                id="deposit-key"
                value={depositKey}
                onChange={(event) => setDepositKey(event.target.value)}
              />
            </div>
            <button className="button" disabled={isPending} type="submit">
              Submit deposit
            </button>
          </form>
        </article>

        <article className="card span-8">
          <h2>Place Bet</h2>
          <p>Debits funds, creates a `PLACED` bet, and prevents duplicate creation through idempotency.</p>
          <form onSubmit={onBetSubmit} className="form-grid">
            <div className="field">
              <label htmlFor="bet-user">User</label>
              <select
                id="bet-user"
                value={betUserId}
                onChange={(event) => setBetUserId(Number(event.target.value))}
              >
                {snapshot.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} (#{user.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bet-amount">Amount</label>
              <input
                id="bet-amount"
                type="number"
                min={1}
                value={betAmount}
                onChange={(event) => setBetAmount(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="bet-game">Game ID</label>
              <input
                id="bet-game"
                value={betGameId}
                onChange={(event) => setBetGameId(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bet-key">Idempotency Key</label>
              <input
                id="bet-key"
                value={betKey}
                onChange={(event) => setBetKey(event.target.value)}
              />
            </div>
            <button className="button secondary" disabled={isPending} type="submit">
              Place bet
            </button>
          </form>
        </article>

        <article className="card span-5">
          <h2>Users</h2>
          <div className="list">
            {snapshot.users.map((user) => (
              <div key={user.id} className="item">
                <div className="item-top">
                  <strong>
                    {user.username} <span className="meta">#{user.id}</span>
                  </strong>
                  <span className="status success">Balance {user.balance}</span>
                </div>
                <div className="meta">Created {new Date(user.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="card span-7">
          <h2>Reconciliation</h2>
          <p>Compares the cached user balance against the ledger sum and checks for common anomalies.</p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="reconcile-user">User</label>
              <select
                id="reconcile-user"
                value={reconcileUserId}
                onChange={(event) => setReconcileUserId(Number(event.target.value))}
              >
                {snapshot.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} (#{user.id})
                  </option>
                ))}
              </select>
            </div>
            <button className="button ghost" disabled={isPending} onClick={loadReconcile} type="button">
              Run reconcile
            </button>
          </div>
          {reconcileData ? (
            <div className="log">{JSON.stringify(reconcileData, null, 2)}</div>
          ) : null}
        </article>

        <article className="card span-12">
          <h2>Bets</h2>
          <div className="list">
            {snapshot.bets.map((bet) => (
              <div key={bet.id} className="item">
                <div className="item-top">
                  <div>
                    <strong>Bet #{bet.id}</strong>{" "}
                    <span className="meta">
                      {bet.user.username} on `{bet.gameId}`
                    </span>
                  </div>
                  <span
                    className={
                      bet.status === "PLACED"
                        ? "status"
                        : bet.status === "SETTLED"
                          ? "status success"
                          : "status danger"
                    }
                  >
                    {bet.status}
                    {bet.settlementResult ? ` / ${bet.settlementResult}` : ""}
                  </span>
                </div>
                <div className="meta">
                  Amount {bet.amount} · User #{bet.userId} · Created{" "}
                  {new Date(bet.createdAt).toLocaleString()}
                </div>
                {bet.status === "PLACED" ? (
                  <div className="actions">
                    <button
                      className="button secondary"
                      disabled={isPending}
                      onClick={() => actOnBet(bet.id, "settle-win")}
                      type="button"
                    >
                      Settle WIN
                    </button>
                    <button
                      className="button ghost"
                      disabled={isPending}
                      onClick={() => actOnBet(bet.id, "settle-lose")}
                      type="button"
                    >
                      Settle LOSE
                    </button>
                    <button
                      className="button"
                      disabled={isPending}
                      onClick={() => actOnBet(bet.id, "cancel")}
                      type="button"
                    >
                      Cancel bet
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="card span-12">
          <h2>Activity</h2>
          <p className="meta">{message}</p>
          <div className="log">{log || "No actions yet."}</div>
        </article>
      </section>
    </main>
  );
}
