const crypto = require('crypto');
const db = require('./db');

const GENESIS = '0'.repeat(64);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// hash = SHA-256( index | timestamp | action | actor | JSON(payload) | prevHash )
// `payload` is already the stored JSON string, so verify hashes exactly what was hashed at write time.
function computeHash(e) {
  return sha256([e.idx, e.timestamp, e.action, e.actor, e.payload, e.prev_hash].join('|'));
}

// Append-only: the app only ever INSERTs into the ledger.
const append = db.transaction((projectId, action, actor, payloadObj) => {
  const last = db
    .prepare('SELECT idx, hash FROM ledger WHERE project_id = ? ORDER BY idx DESC LIMIT 1')
    .get(projectId);

  const entry = {
    project_id: projectId,
    idx: last ? last.idx + 1 : 0,
    timestamp: new Date().toISOString(),
    action,
    actor,
    payload: JSON.stringify(payloadObj),
    prev_hash: last ? last.hash : GENESIS,
  };
  entry.hash = computeHash(entry);

  db.prepare(
    `INSERT INTO ledger (project_id, idx, timestamp, action, actor, payload, prev_hash, hash)
     VALUES (@project_id, @idx, @timestamp, @action, @actor, @payload, @prev_hash, @hash)`
  ).run(entry);

  return entry;
});

// Walk the chain from entry 0; the first mismatch is the break point.
function verify(projectId) {
  const rows = db.prepare('SELECT * FROM ledger WHERE project_id = ? ORDER BY idx').all(projectId);
  let prev = GENESIS;

  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    if (e.idx !== i) {
      return { valid: false, brokenAt: i, reason: `Entry #${i} is missing (index gap)`, total: rows.length };
    }
    if (e.prev_hash !== prev) {
      return { valid: false, brokenAt: i, reason: "prevHash does not match the previous entry's hash", total: rows.length };
    }
    if (computeHash(e) !== e.hash) {
      return { valid: false, brokenAt: i, reason: 'Entry contents do not match its stored hash', total: rows.length };
    }
    prev = e.hash;
  }
  return { valid: true, total: rows.length };
}

module.exports = { append, verify, computeHash, GENESIS };
