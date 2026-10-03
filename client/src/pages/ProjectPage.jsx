import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { Loading, ErrorBox, StatusBadge } from '../components';

const blank = { title: '', description: '', due_date: '' };

export default function ProjectPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | milestone id
  const [form, setForm] = useState(blank);
  const [saveErr, setSaveErr] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api(`/projects/${id}`).then(setProject).catch(setError);
  useEffect(() => { load(); }, [id]);

  if (error) return <ErrorBox error={error} />;
  if (!project) return <Loading />;

  const link = `${window.location.origin}/review/${project.token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMsg('Client link copied!');
    } catch {
      setMsg(link);
    }
  };

  const startEdit = (m) => {
    setEditing(m.id);
    setSaveErr(null);
    setForm({ title: m.title, description: m.description || '', due_date: m.due_date });
  };
  const startAdd = () => { setEditing('new'); setSaveErr(null); setForm(blank); };

  async function save(e) {
    e.preventDefault();
    setSaveErr(null);
    try {
      if (editing === 'new') await api(`/projects/${id}/milestones`, { method: 'POST', body: form });
      else await api(`/projects/${id}/milestones/${editing}`, { method: 'PUT', body: form });
      setEditing(null);
      await load();
    } catch (err) {
      setSaveErr(err.details?.length ? err.details : [err.message]);
    }
  }

  const MilestoneForm = (
    <form onSubmit={save} className="stack form-inline">
      <ErrorBox error={saveErr} />
      <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
      <div className="row">
        <button className="btn btn-primary">Save</button>
        <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </form>
  );

  return (
    <>
      <div className="row between wrap">
        <div>
          <h1>{project.title}</h1>
          <div className="muted">Client: {project.client_name} · {project.approved} / {project.total} approved</div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="row wrap gap">
        <button className="btn btn-primary" onClick={copy}>Copy client link</button>
        <Link className="btn" to={`/projects/${id}/audit`}>Audit trail &amp; verify</Link>
        <button className="btn" onClick={startAdd}>+ Add milestone</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <p className="muted small">Editing a milestone resets it to Pending so the client must re-review it. Every change is written to the audit trail.</p>

      <h2>Milestones</h2>
      <div className="stack">
        {project.milestones.map((m) => (
          <div className="card" key={m.id}>
            {editing === m.id ? MilestoneForm : (
              <>
                <div className="row between">
                  <strong>{m.title}</strong>
                  <StatusBadge status={m.status} />
                </div>
                {m.description && <p>{m.description}</p>}
                <div className="muted small">Due {m.due_date}</div>
                {m.status === 'CHANGES_REQUESTED' && m.note && <div className="note">Client note: {m.note}</div>}
                <button className="btn btn-link" onClick={() => startEdit(m)}>Edit milestone</button>
              </>
            )}
          </div>
        ))}
        {editing === 'new' && <div className="card">{MilestoneForm}</div>}
      </div>
    </>
  );
}
