// DEMO-ONLY helpers used by both the dev endpoints and scripts/tamper.js.
const db = require('./db');
const { computeHash } = require('./ledger');

function tamper(entryId, mode = 'edit') {
  const row = db.prepare('SELECT * FROM ledger WHERE id = ?').get(entryId);
  if (!row) throw new Error(`Ledger entry id ${entryId} not found`);

  db.prepare('INSERT OR IGNORE INTO dev_backup (entry_id, project_id, row) VALUES (?, ?, ?)')
    .run(row.id, row.project_id, JSON.stringify(row));

  if (mode === 'delete') {
    db.prepare('DELETE FROM ledger WHERE id = ?').run(row.id);
    return `Deleted entry #${row.idx} (id ${row.id}). Verify should report a break at #${row.idx}.`;
  }

  const forged = { ...row, actor: 'Someone Else' };

  if (mode === 'forge') {
    // Attacker also recomputes THIS entry's hash so it looks self-consistent.
    forged.hash = computeHash(forged);
    db.prepare('UPDATE ledger SET actor = ?, hash = ? WHERE id = ?').run(forged.actor, forged.hash, row.id);
    return `Forged entry #${row.idx} and recomputed its hash. The break shows up at the NEXT entry (#${row.idx + 1}) because its prevHash no longer matches. (If this is the last entry, nothing breaks, which is why anchoring the latest hash externally matters.)`;
  }

  db.prepare('UPDATE ledger SET actor = ? WHERE id = ?').run(forged.actor, row.id);
  return `Edited actor on entry #${row.idx} (id ${row.id}) without fixing its hash. Verify should report a break at #${row.idx}.`;
}

function restoreAll() {
  const backups = db.prepare('SELECT * FROM dev_backup').all();
  const put = db.prepare(
    `INSERT OR REPLACE INTO ledger (id, project_id, idx, timestamp, action, actor, payload, prev_hash, hash)
     VALUES (@id, @project_id, @idx, @timestamp, @action, @actor, @payload, @prev_hash, @hash)`
  );
  db.transaction(() => {
    for (const b of backups) put.run(JSON.parse(b.row));
    db.prepare('DELETE FROM dev_backup').run();
  })();
  return `Restored ${backups.length} entr${backups.length === 1 ? 'y' : 'ies'}.`;
}

module.exports = { tamper, restoreAll };
