const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'signseal.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  note TEXT
);

-- One hash chain per project. payload is stored as the exact JSON string that was hashed.
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  UNIQUE (project_id, idx)
);

-- Demo only: stores original rows so tampering can be undone between demos.
CREATE TABLE IF NOT EXISTS dev_backup (
  entry_id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  row TEXT NOT NULL
);
`);

module.exports = db;
