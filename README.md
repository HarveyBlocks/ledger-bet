# Ledger Bet

Ledger Bet is a simplified prediction-market demo built with `Next.js`, `Prisma`, and `SQLite`. It focuses on transaction-safe balance handling, idempotent write APIs, strict bet state transitions, and append-only ledger reconciliation.

## Features

- Static seeded users with fixed opening balances
- Append-only ledger entries for every balance change
- Deposit idempotency with payload conflict detection
- Bet placement idempotency with duplicate replay support
- Bet state machine: `PLACED -> SETTLED` or `PLACED -> CANCELLED`
- Reconciliation endpoint that compares cached balance vs ledger-derived balance
- Minimal dashboard for manual verification
- Automated business-logic tests with `Vitest`

## Stack

- `Next.js` App Router
- `TypeScript`
- `Prisma`
- `SQLite`
- `Vitest`
- `Zod`

## Project Structure

- `src/app`: pages and API route handlers
- `src/lib/services`: transactional business logic
- `src/lib`: db client, domain constants, validation, errors
- `prisma/schema.prisma`: database schema
- `prisma/seed.ts`: static user seed
- `tests`: core automated test coverage and isolated test database setup
- `docs/implementation-plan.md`: implementation plan

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file if needed:

```bash
copy .env.example .env
```

3. Generate Prisma client:

```bash
npx prisma generate
```

4. Push schema to SQLite:

```bash
npx prisma db push
```

5. Seed static users:

```bash
npx tsx prisma/seed.ts
```

6. Start development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Seeded Users

- `alice`: `10000`
- `bob`: `6000`
- `charlie`: `2500`

## API Reference

### `GET /api/users`

Returns all seeded users and current cached balances.

### `POST /api/users/:id/deposit`

Headers:

- `Idempotency-Key: <string>`

Body:

```json
{
  "amount": 500
}
```

Behavior:

- Adds a `DEPOSIT` ledger entry
- Updates cached balance inside the same transaction
- Replays the original response for repeated same-key same-payload requests
- Returns `409` when the same key is reused with a different payload

### `GET /api/bets`

Returns placed, settled, and cancelled bets.

### `POST /api/bets`

Headers:

- `Idempotency-Key: <string>`

Body:

```json
{
  "userId": 1,
  "gameId": "election-2026",
  "amount": 300
}
```

Behavior:

- Rejects insufficient balance
- Creates a `PLACED` bet
- Adds a `BET_DEBIT` ledger entry
- Replays the original response for idempotent retries

### `POST /api/bets/:id/settle`

Body:

```json
{
  "result": "WIN"
}
```

Behavior:

- Only allowed for `PLACED` bets
- `WIN` creates a `BET_PAYOUT` ledger entry worth `amount * 2`
- `LOSE` changes state only
- Terminal states cannot be settled twice

### `POST /api/bets/:id/cancel`

Behavior:

- Only allowed for `PLACED` bets
- Creates a `BET_REFUND` ledger entry
- Marks bet as `CANCELLED`

### `GET /api/admin/reconcile?userId=1`

Returns:

- cached database balance
- computed ledger balance
- bet counts by status
- anomaly list for missing or duplicate accounting side effects

## State Machine

- `PLACED -> SETTLED`
- `PLACED -> CANCELLED`
- `SETTLED` and `CANCELLED` are terminal

## Ledger Rules

- Business logic never mutates historical ledger rows
- Every balance-changing action appends a new ledger entry
- `User.balance` is treated as a cached projection refreshed from ledger sums inside the same transaction

## Testing

Run lint:

```bash
npm run lint
```

Run tests:

```bash
npm run test
```

The test suite uses a dedicated `Vitest` setup module that initializes a separate SQLite test database before the suite runs, instead of embedding Prisma bootstrap logic inside each test file.

Run production build:

```bash
npm run build
```

Covered flows include:

- deposit increases balance
- deposit idempotency only applies once
- deposit idempotency rejects conflicting payloads
- insufficient balance blocks bet placement
- bet idempotency only applies once
- winning settlement increases balance
- settled bets cannot be settled twice
- cancellation refunds balance
- reconciliation reports clean normal flow
- cancelled bets cannot be cancelled twice
- reconciliation detects cached balance drift

## Git Notes

Ignored local-only files include:

- `.env`
- `prisma/*.db`
- `prisma/*.db-journal`
- `.next`
- `coverage`
- `node_modules`

That keeps local SQLite files, build output, and dependency folders out of the final commit.
