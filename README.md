# SignSeal: Tamper-Proof Sign-offs

An agency creates a project with milestones, shares a private review link with the client,
and every approval, change request and milestone edit is written to a hash-chained audit
ledger that anyone can verify.

## Stack
Node + Express, SQLite (better-sqlite3), React (Vite), Node `crypto` for SHA-256.

## Setup
    cd server && npm install && npm start     # http://localhost:5000
    cd client && npm install && npm run dev   # http://localhost:5173

Copy `server/.env.example` to `server/.env` if you want to change the port.

## How the hash is computed
    hash = SHA-256( index | timestamp | action | actor | JSON(payload) | prevHash )

- One chain per project; the first entry uses prevHash = 64 zeros.
- The payload is stored as the exact JSON string that was hashed, so verification is deterministic.
- Verify walks from entry 0 and checks (1) no index gap, (2) prevHash equals the previous
  entry's hash, (3) the recomputed hash equals the stored hash. The first failure is reported
  as "Broken at entry #N".
- The app only INSERTs into the ledger: there are no edit or delete routes.

## Tamper demo (dev only)
- UI: Audit page, "Tamper demo" panel (edit / forge / delete, then "Restore originals").
- CLI (from server/): `node scripts/tamper.js list <projectId>`, then
  `edit|forge|delete <entryId>`, and `restore`.
- Disabled when NODE_ENV=production.

## What I'd improve
- Anchor the latest hash on a public chain (Sepolia) or sign entries with an HMAC/private key.
  A plain hash chain can be rebuilt by someone with full DB write access, and deleting the
  last entry is undetectable without an external anchor.
- Agency authentication, automated tests, pagination, a public verify page, JSON/PDF export, deployment.
