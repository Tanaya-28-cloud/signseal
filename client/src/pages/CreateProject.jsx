import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ErrorBox } from '../components';

const blank = () => ({ title: '', description: '', due_date: '' });

export default function CreateProject() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [ms, setMs] = useState([blank(), blank(), blank()]);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const update = (i, k, v) => setMs(ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  async function submit(e) {
    e.preventDefault();
    const errs = [];
    if (!title.trim()) errs.push('Project title is required');
    if (!client.trim()) errs.push('Client name is required');
    if (ms.length < 3) errs.push('At least 3 milestones are required');
    ms.forEach((m, i) => {
      if (!m.title.trim()) errs.push(`Milestone ${i + 1}: title is required`);
      if (!m.due_date) errs.push(`Milestone ${i + 1}: due date is required`);
    });
    if (errs.length) return setErrors(errs);

    setBusy(true);
    setErrors([]);
    try {
      const p = await api('/projects', { method: 'POST', body: { title, client_name: client, milestones: ms } });
      nav(`/projects/${p.id}`);
    } catch (err) {
      setErrors(err.details?.length ? err.details : [err.message]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <h1>New project</h1>
      <ErrorBox error={errors.length ? errors : null} />

      <label>Project title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Website Redesign" />
      </label>
      <label>Client name
        <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Corp" />
      </label>

      <h2>Milestones</h2>
      {ms.map((m, i) => (
        <div className="card stack" key={i}>
          <div className="row between">
            <strong>Milestone {i + 1}</strong>
            {ms.length > 3 && (
              <button type="button" className="btn btn-link" onClick={() => setMs(ms.filter((_, j) => j !== i))}>Remove</button>
            )}
          </div>
          <input placeholder="Title" value={m.title} onChange={(e) => update(i, 'title', e.target.value)} />
          <textarea placeholder="Description" rows={2} value={m.description} onChange={(e) => update(i, 'description', e.target.value)} />
          <input type="date" value={m.due_date} onChange={(e) => update(i, 'due_date', e.target.value)} />
        </div>
      ))}
      <button type="button" className="btn" onClick={() => setMs([...ms, blank()])}>+ Add milestone</button>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button>
    </form>
  );
}
