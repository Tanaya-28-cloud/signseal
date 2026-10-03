// DEMO ONLY. Simulates someone editing the database directly, bypassing the app.
// Usage (run from the server/ folder):
//   node scripts/tamper.js list <projectId>   show entries and their ids
//   node scripts/tamper.js edit <entryId>     change actor, leave hash alone  -> breaks AT that entry
//   node scripts/tamper.js forge <entryId>    change actor + recompute its hash -> breaks at the NEXT entry
//   node scripts/tamper.js delete <entryId>   remove the entry                  -> breaks at the gap
//   node scripts/tamper.js restore            undo all tampering
const db = require('../db');
const dev = require('../dev');

const [, , cmd, arg] = process.argv;

try {
  if (cmd === 'list') {
    const rows = db.prepare('SELECT id, idx, action, actor, substr(hash,1,12) AS hash FROM ledger WHERE project_id = ? ORDER BY idx').all(Number(arg));
    console.table(rows);
  } else if (['edit', 'forge', 'delete'].includes(cmd) && arg) {
    console.log(dev.tamper(Number(arg), cmd));
  } else if (cmd === 'restore') {
    console.log(dev.restoreAll());
  } else {
    console.log('Usage: node scripts/tamper.js <list <projectId> | edit <entryId> | forge <entryId> | delete <entryId> | restore>');
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
