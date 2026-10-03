import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { Loading, ErrorBox } from '../components';

const short = (h) => h.slice(0, 10) + '…';

export default function AuditPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [tEntry, setTEntry] = useState('');
  const [tMode, setTMode] = useState('edit');
  const [devMsg, setDevMsg] = useState('');
  const [devErr, setDevErr] = useState(null);

  const load = () =>
    Promise.all([api(`/projects/${id}`), api(`/projects/${id}/ledger`)])
      .then(([p, l]) => {
        setProject(p);
        setEntries(l);
        setTEntry((prev) => (l.some((e) => String(e.id) === prev) ? prev : l[0] ? String(l[0].id) : ''));
      })
      .catch(setError);

  useEffect(() => { load(); }, [id]);

  async function runVerify() {
    setVerifying(true);
    try {
      setResult(await api(`/projects/${id}/verify`));
    } catch (e) {
      setError(e);
    } finally {
      setVerifying(false);
    }
  }

  async function dev(path, body) {
    setDevErr(null);
    try {
      const r = await api(path, { method: 'POST', body });
      setDevMsg(r.message);
      setResult(null); // force a fresh verify after changing data
      await load();
    } catch (e) {
      setDevErr(e);
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (!entries || !project) return <Loading />;

  const brokenAt = result && !result.valid ? result.brokenAt : null;

  return (
    <>
      <Link to={`/projects/${id}`} className="muted">← Back to project</Link>
      <h1>Audit trail: {project.title}</h1>

      <div className="card stack">
        <div className="row wrap gap">
          <button className="btn btn-primary" onClick={runVerify} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify integrity'}
          </button>
          {result && (result.valid
            ? <span className="verdict ok">✔ Valid ({result.total} entries)</span>
            : <span className="verdict bad">✖ Broken at entry #{result.brokenAt}</span>)}
        </div>
        {result && !result.valid && <div className="muted">{result.reason}</div>}
      </div>

      <h2>Timeline</h2>
      {entries.length === 0 ? (
        <p className="muted">No entries yet.</p>
      ) : (
        <div className="timeline">
          {entries.map((e) => (
            <div key={e.id} className={`entry ${brokenAt === e.index ? 'entry-broken' : ''}`}>
              <div className="row between wrap">
                <strong>#{e.index} · {e.action}</strong>
                <span className="muted small">{new Date(e.timestamp).toLocaleString()}</span>
              </div>
              <div>Actor: {e.actor}</div>
              <div className="hashes">
                <span title={e.hash}>hash: <code>{short(e.hash)}</code></span>
                <span title={e.prevHash}>prev: <code>{short(e.prevHash)}</code></span>
              </div>
              <details>
                <summary className="small muted">Payload (db id {e.id})</summary>
                <pre>{JSON.stringify(e.payload, null, 2)}</pre>
              </details>
            </div>
          ))}
        </div>
      )}

      <div className="card dev-panel stack">
        <strong>⚠ Tamper demo (dev only)</strong>
        <div className="muted small">
          Simulates someone editing the database directly. After tampering, click “Verify integrity” again.
        </div>
        <ErrorBox error={devErr} />
        <div className="row wrap gap">
          <select value={tEntry} onChange={(e) => setTEntry(e.target.value)}>
            {entries.map((e) => <option key={e.id} value={e.id}>Entry #{e.index} (id {e.id})</option>)}
          </select>
          <select value={tMode} onChange={(e) => setTMode(e.target.value)}>
            <option value="edit">Edit (change actor)</option>
            <option value="forge">Forge (edit + recompute its hash)</option>
            <option value="delete">Delete entry</option>
          </select>
          <button className="btn btn-danger" disabled={!tEntry} onClick={() => dev(`/dev/tamper/${tEntry}`, { mode: tMode })}>Tamper</button>
          <button className="btn" onClick={() => dev('/dev/restore')}>Restore originals</button>
        </div>
        {devMsg && <div className="muted small">{devMsg}</div>}
      </div>
    </>
  );
}
