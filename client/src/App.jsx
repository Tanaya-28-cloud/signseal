import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CreateProject from './pages/CreateProject';
import ProjectPage from './pages/ProjectPage';
import ReviewPage from './pages/ReviewPage';
import AuditPage from './pages/AuditPage';

export default function App() {
  const { pathname } = useLocation();
  const isClient = pathname.startsWith('/review/');

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">SignSeal</Link>
        {!isClient && (
          <nav>
            <Link to="/">Dashboard</Link>
            <Link to="/new" className="btn btn-primary">+ New project</Link>
          </nav>
        )}
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<CreateProject />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
          <Route path="/projects/:id/audit" element={<AuditPage />} />
          <Route path="/review/:token" element={<ReviewPage />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
