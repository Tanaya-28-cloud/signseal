import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { Loading, ErrorBox, StatusBadge } from '../components';

export default function ReviewPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [done, setDone] = useState('');

  const load = () => api(`/review/${token}`).then(setData).catch(setError);
  useEffect(() => { load(); }, [token]);

  async function decide(milestoneId, decision) {
    setBusy(true);
    setFormErr(null);
    setDone('');
    try {
      await api(`/review/${token}/decision`, { method: 'POST', body: { milestoneId, decision, actor: name, note } });
      setNoteFor(null);
      setNote('');
      setDone(decision === 'APPROVE' ? 'Approval recorded.' : 'Change request recorded.');
      await load();
    } catch (err) {
      setFormErr(err.details?.length ? err.details : [err.message]);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <h1>{data.title}</h1>
      <p className="muted">Review prepared for {data.client_name}. Your decisions are recorded in a tamper-evident audit trail.</p>

      <label>Your name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" />
      </label>
      <ErrorBox error={formErr} />
      {done && <div className="success-box">{done}</div>}

      <div className="stack">
        {data.milestones.map((m) => (
          <div className="card" key={m.id}>
            <div className="row between">
              <strong>{m.title}</strong>
              <StatusBadge status={m.status} />
            </div>
            {m.description && <p>{m.description}</p>}
            <div className="muted small">Due {m.due_date}</div>
            {m.status === 'CHANGES_REQUESTED' && m.note && <div className="note">Your note: {m.note}</div>}

            {m.status !== 'APPROVED' && (
              noteFor === m.id ? (
                <div className="stack">
                  <textarea rows={3} placeholder="Describe the changes you need (required)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="row">
                    <button className="btn btn-danger" disabled={busy || !name.trim()} onClick={() => decide(m.id, 'REQUEST_CHANGES')}>Submit change request</button>
                    <button className="btn" onClick={() => setNoteFor(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="row">
                  <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => decide(m.id, 'APPROVE')}>Approve</button>
                  <button className="btn" disabled={!name.trim()} onClick={() => { setNoteFor(m.id); setNote(''); }}>Request changes</button>
                </div>
              )
            )}
          </div>
        ))}
      </div>
      {!name.trim() && <p className="muted small">Enter your name to enable the buttons.</p>}
    </>
  );
}
