const LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes Requested',
};

export function StatusBadge({ status }) {
  const label = LABELS[status] || status;
  const cls = label.toLowerCase().replace(/\s+/g, '-');
  return <span className={`badge badge-${cls}`}>{label}</span>;
}

export function Loading({ text = 'Loading…' }) {
  return <p className="muted">{text}</p>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  const list = Array.isArray(error) ? error : [error.message || String(error)];
  return (
    <div className="error-box" role="alert">
      {list.map((m, i) => (
        <div key={i}>{m}</div>
      ))}
    </div>
  );
}
