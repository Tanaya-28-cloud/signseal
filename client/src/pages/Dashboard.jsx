import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Loading, ErrorBox, StatusBadge } from '../components';

export default function Dashboard() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/projects').then(setProjects).catch(setError);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!projects) return <Loading />;

  return (
    <>
      <h1>Projects</h1>
      {projects.length === 0 ? (
        <div className="card empty">
          <p>No projects yet.</p>
          <Link to="/new" className="btn btn-primary">Create your first project</Link>
        </div>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="card project-card">
              <div className="row between">
                <strong>{p.title}</strong>
                <StatusBadge status={p.status} />
              </div>
              <div className="muted">Client: {p.client_name}</div>
              <div className="progress"><div style={{ width: `${p.total ? (p.approved / p.total) * 100 : 0}%` }} /></div>
              <div className="muted">{p.approved} / {p.total} approved</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
