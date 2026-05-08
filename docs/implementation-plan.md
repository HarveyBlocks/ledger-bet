# Ledger Bet Implementation Plan

## 1. Goal

Build a simplified forecasting platform with Next.js, Prisma, and SQLite that satisfies:

- Static seeded users
- Append-only ledger accounting
- Idempotent deposit and bet creation
- Bet state machine with strict transitions
- Reconciliation endpoint for anomaly detection
- Automated tests covering critical business flows
- README with setup, API, and testing instructions

## 2. Delivery Scope

The implementation will include:

- `Next.js` application using App Router
- `Prisma` schema, migrations, and seed data
- Layered backend structure:
  - route handlers
  - validation layer
  - service layer
  - repository or db access helpers
  - domain error handling
- Minimal but useful frontend pages for inspection and manual verification
- Automated test suite using `Vitest`
- Final repository review and Git commit

## 3. Functional Requirements Breakdown

### 3.1 User System

- Preload users via seed data only
- Store:
  - `id`
  - `username`
  - `balance`
  - `createdAt`
- `balance` is treated as a derived cached field maintained only by ledger-driven service logic

### 3.2 Deposit

- Endpoint: `POST /api/users/:id/deposit`
- Requires `Idempotency-Key` header
- Validates `amount > 0`
- On first success:
  - append ledger credit
  - update cached `User.balance` inside one transaction
- On repeated request with same key and same payload:
  - return the original logical result
- On repeated request with same key but different payload:
  - return `409 Conflict`

### 3.3 Bet Placement

- Endpoint: `POST /api/bets`
- Requires `Idempotency-Key` header
- Validates:
  - valid user
  - non-empty `gameId`
  - `amount > 0`
  - sufficient balance
- On success:
  - create bet in `PLACED`
  - append ledger debit
  - update cached balance
- Enforce idempotency with conflict detection

### 3.4 Bet Settlement

- Endpoint: `POST /api/bets/:id/settle`
- Accepts `WIN` or `LOSE`
- Allowed only from `PLACED`
- `WIN`:
  - append payout ledger credit
  - move bet to `SETTLED`
- `LOSE`:
  - move bet to `SETTLED`
  - no refund ledger entry
- Repeated settlement must fail once terminal state is reached

### 3.5 Bet Cancellation

- Endpoint: `POST /api/bets/:id/cancel`
- Allowed only from `PLACED`
- Must:
  - append refund ledger credit
  - update cached balance
  - move bet to `CANCELLED`

### 3.6 Reconciliation

- Endpoint: `GET /api/admin/reconcile?userId=...`
- Returns:
  - cached database balance
  - computed ledger balance
  - bet counts by state
  - anomaly flags and details
- Detect at minimum:
  - balance mismatch
  - placed bet without debit ledger
  - cancelled bet without refund ledger
  - settled win without payout ledger
  - duplicate settlement side effects

## 4. Data Model Plan

### 4.1 Core Tables

- `User`
- `Bet`
- `LedgerEntry`
- `IdempotencyKey`

### 4.2 Key Modeling Decisions

- `LedgerEntry` is append-only
- `User.balance` is a cached projection, never changed outside accounting services
- `IdempotencyKey` stores:
  - operation type
  - request fingerprint
  - linked entity ids
  - response snapshot or essential replay data
- `Bet` stores:
  - `gameId`
  - `amount`
  - `status`
  - `settlementResult`

### 4.3 Ledger Entry Types

- `DEPOSIT`
- `BET_DEBIT`
- `BET_REFUND`
- `BET_PAYOUT`

## 5. Architecture Plan

### 5.1 Backend Layers

- `lib/db`: Prisma client bootstrap
- `lib/errors`: domain and HTTP-safe errors
- `lib/validation`: request body parsing and guards
- `lib/services`: all business logic and transactions
- `app/api/...`: thin route handlers only

### 5.2 Transaction Strategy

Every balance-affecting action will run in a single Prisma transaction:

- read current state
- validate transition or funds
- append ledger entries
- update projection balance
- create or update related business records
- persist idempotency record

## 6. Frontend Plan

Provide a simple internal dashboard to inspect the system:

- seeded users and balances
- create deposit
- place bet
- settle or cancel bets
- view reconciliation output

The UI will prioritize clarity for manual review instead of marketing polish.

## 7. Testing Plan

### 7.1 Required Tests

- deposit increases balance
- deposit idempotency only applies once
- insufficient balance rejects bet
- bet idempotency only applies once
- win settlement increases balance
- settled bet cannot be settled twice

### 7.2 Additional Coverage

- cancel refunds correctly
- same idempotency key with different payload returns conflict
- lose settlement does not refund
- reconcile endpoint reports clean state for valid flow

### 7.3 Test Strategy

- service-layer tests for business logic
- API route tests where useful for status codes and payloads
- isolated SQLite test database
- deterministic seed reset between tests

## 8. Documentation Plan

README will contain:

- project overview
- architecture notes
- local setup
- Prisma commands
- test commands
- API examples
- state machine summary
- reconciliation notes

## 9. Review Checklist

Before commit:

- verify routes match requirement paths
- verify all balance changes come from ledger services only
- verify terminal state protection
- verify idempotency conflict behavior
- run tests
- run production build if possible
- inspect for dead code and inconsistent naming

## 10. Git Plan

- implement in small coherent steps
- run final review
- create one clear commit message summarizing the delivery
- push to the configured GitHub remote if local credentials allow
