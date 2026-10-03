const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { append, verify } = require('./ledger');
const dev = require('./dev');

const app = express();
app.use(express.json());

// ---------- helpers ----------
const fail = (res, status, error, details = []) => res.status(status).json({ error, details });
const isDate = (s) => typeof s === 'string' && !isNaN(Date.parse(s));

function milestoneErrors(m, label = '') {
  const errs = [];
  if (!m || typeof m.title !== 'string' || !m.title.trim()) errs.push(`${label}title is required`);
  if (!isDate(m && m.due_date)) errs.push(`${label}a valid due date is required`);
  return errs;
}

function summary(p) {
  const ms = db.prepare('SELECT status FROM milestones WHERE project_id = ?').all(p.id);
  const total = ms.length;
  const approved = ms.filter((m) => m.status === 'APPROVED').length;
  const changes = ms.filter((m) => m.status === 'CHANGES_REQUESTED').length;
  let status = 'Not started';
  if (total && approved === total) status = 'Completed';
  else if (changes) status = 'Changes requested';
  else if (approved) status = 'In progress';
  return { id: p.id, title: p.title, client_name: p.client_name, created_at: p.created_at, total, approved, status };
}

const getProject = (id) => {
  const n = Number(id);
  return Number.isInteger(n) ? db.prepare('SELECT * FROM projects WHERE id = ?').get(n) : undefined;
};

const milestonesOf = (projectId) =>
  db.prepare('SELECT id, title, description, due_date, status, note FROM milestones WHERE project_id = ? ORDER BY id').all(projectId);

// ---------- projects ----------
app.post('/api/projects', (req, res) => {
  const { title, client_name, milestones } = req.body || {};
  const errs = [];
  if (typeof title !== 'string' || !title.trim()) errs.push('Project title is required');
  if (typeof client_name !== 'string' || !client_name.trim()) errs.push('Client name is required');
  if (!Array.isArray(milestones) || milestones.length < 3) errs.push('At least 3 milestones are required');
  else milestones.forEach((m, i) => errs.push(...milestoneErrors(m, `Milestone ${i + 1}: `)));
  if (errs.length) return fail(res, 400, 'Validation failed', errs);

  const create = db.transaction(() => {
    const token = crypto.randomBytes(24).toString('hex'); // hard-to-guess review token
    const now = new Date().toISOString();
    const pid = Number(
      db.prepare('INSERT INTO projects (title, client_name, token, created_at) VALUES (?, ?, ?, ?)')
        .run(title.trim(), client_name.trim(), token, now).lastInsertRowid
    );
    const ins = db.prepare('INSERT INTO milestones (project_id, title, description, due_date) VALUES (?, ?, ?, ?)');
    const created = milestones.map((m) => {
      const id = Number(ins.run(pid, m.title.trim(), (m.description || '').trim(), m.due_date).lastInsertRowid);
      return { id, title: m.title.trim() };
    });
    append(pid, 'PROJECT_CREATED', 'agency', {
      project: { id: pid, title: title.trim(), client_name: client_name.trim() },
      milestones: created,
    });
    return pid;
  });

  res.status(201).json({ id: create() });
});

app.get('/api/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY id DESC').all();
  res.json(rows.map(summary));
});

app.get('/api/projects/:id', (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return fail(res, 404, 'Project not found');
  res.json({ ...summary(p), token: p.token, milestones: milestonesOf(p.id) });
});

// ---------- agency: add / edit milestones (each change is logged) ----------
app.post('/api/projects/:id/milestones', (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return fail(res, 404, 'Project not found');
  const errs = milestoneErrors(req.body);
  if (errs.length) return fail(res, 400, 'Validation failed', errs);

  const { title, description = '', due_date } = req.body;
  const id = db.transaction(() => {
    const mid = Number(
      db.prepare('INSERT INTO milestones (project_id, title, description, due_date) VALUES (?, ?, ?, ?)')
        .run(p.id, title.trim(), description.trim(), due_date).lastInsertRowid
    );
    append(p.id, 'MILESTONE_ADDED', 'agency', { project: p.id, milestone: { id: mid, title: title.trim(), due_date } });
    return mid;
  })();
  res.status(201).json({ id });
});

app.put('/api/projects/:id/milestones/:mid', (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return fail(res, 404, 'Project not found');
  const m = db.prepare('SELECT * FROM milestones WHERE id = ? AND project_id = ?').get(Number(req.params.mid), p.id);
  if (!m) return fail(res, 404, 'Milestone not found');

  const body = req.body || {};
  const next = {
    title: body.title ?? m.title,
    description: body.description ?? m.description,
    due_date: body.due_date ?? m.due_date,
  };
  const errs = milestoneErrors(next);
  if (errs.length) return fail(res, 400, 'Validation failed', errs);

  db.transaction(() => {
    // Editing a milestone voids any earlier decision, so the client must review the new version.
    db.prepare("UPDATE milestones SET title = ?, description = ?, due_date = ?, status = 'PENDING', note = NULL WHERE id = ?")
      .run(next.title.trim(), next.description.trim(), next.due_date, m.id);
    append(p.id, 'MILESTONE_UPDATED', 'agency', {
      project: p.id,
      milestone: m.id,
      before: { title: m.title, description: m.description, due_date: m.due_date, status: m.status },
      after: { title: next.title.trim(), description: next.description.trim(), due_date: next.due_date, status: 'PENDING' },
    });
  })();
  res.json({ ok: true });
});

// ---------- client review (no login, token only) ----------
app.get('/api/review/:token', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE token = ?').get(req.params.token);
  if (!p) return fail(res, 404, 'This review link is invalid');
  res.json({ title: p.title, client_name: p.client_name, milestones: milestonesOf(p.id) });
});

app.post('/api/review/:token/decision', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE token = ?').get(req.params.token);
  if (!p) return fail(res, 404, 'This review link is invalid');

  const { milestoneId, decision, actor, note } = req.body || {};
  const errs = [];
  if (typeof actor !== 'string' || !actor.trim()) errs.push('Your name is required');
  if (!['APPROVE', 'REQUEST_CHANGES'].includes(decision)) errs.push('decision must be APPROVE or REQUEST_CHANGES');
  if (decision === 'REQUEST_CHANGES' && !(typeof note === 'string' && note.trim())) errs.push('A note is required when requesting changes');
  if (errs.length) return fail(res, 400, 'Validation failed', errs);

  const m = db.prepare('SELECT * FROM milestones WHERE id = ? AND project_id = ?').get(Number(milestoneId), p.id);
  if (!m) return fail(res, 404, 'Milestone not found');
  if (m.status === 'APPROVED') return fail(res, 409, 'This milestone is already approved');

  const approve = decision === 'APPROVE';
  const entry = db.transaction(() => {
    db.prepare('UPDATE milestones SET status = ?, note = ? WHERE id = ?')
      .run(approve ? 'APPROVED' : 'CHANGES_REQUESTED', approve ? null : note.trim(), m.id);
    return append(p.id, approve ? 'MILESTONE_APPROVED' : 'CHANGES_REQUESTED', actor.trim(), {
      project: p.id,
      milestone: m.id,
      note: approve ? null : note.trim(),
    });
  })();

  res.status(201).json({ ok: true, hash: entry.hash });
});

// ---------- ledger & verify ----------
app.get('/api/projects/:id/ledger', (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return fail(res, 404, 'Project not found');
  const rows = db.prepare('SELECT * FROM ledger WHERE project_id = ? ORDER BY idx').all(p.id);
  res.json(rows.map((r) => ({
    id: r.id, index: r.idx, timestamp: r.timestamp, action: r.action, actor: r.actor,
    payload: JSON.parse(r.payload), prevHash: r.prev_hash, hash: r.hash,
  })));
});

app.get('/api/projects/:id/verify', (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return fail(res, 404, 'Project not found');
  res.json(verify(p.id));
});

// ---------- DEMO ONLY: tamper tools (disabled in production) ----------
const devOnly = (req, res, next) =>
  process.env.NODE_ENV === 'production' ? fail(res, 404, 'Not found') : next();

app.post('/api/dev/tamper/:entryId', devOnly, (req, res) => {
  const mode = (req.body && req.body.mode) || 'edit';
  if (!['edit', 'forge', 'delete'].includes(mode)) return fail(res, 400, 'mode must be edit, forge or delete');
  try {
    res.json({ message: dev.tamper(Number(req.params.entryId), mode) });
  } catch (e) {
    fail(res, 404, e.message);
  }
});

app.post('/api/dev/restore', devOnly, (req, res) => res.json({ message: dev.restoreAll() }));

// ---------- fallbacks ----------
app.use('/api', (req, res) => fail(res, 404, 'Not found'));
app.use((err, req, res, next) => {
  console.error(err);
  fail(res, 500, 'Internal server error');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`SignSeal API on http://localhost:${PORT}`));
