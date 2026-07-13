const STATUS_VARIANT: Record<string, string> = {
  // project
  submitted: 'badge-blue',
  matching: 'badge-amber',
  matched: 'badge-violet',
  confirmed: 'badge-blue',
  completed: 'badge-green',
  cancelled: 'badge-gray',
  // match
  proposed: 'badge-amber',
  accepted: 'badge-green',
  declined: 'badge-red',
  // profile
  matchable: 'badge-green',
  paused: 'badge-gray',
};

/** A colored, dotted status badge with consistent styling across the app. */
export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] ?? 'badge-gray';
  return (
    <span className={`badge ${variant}`}>
      <span className="dot-mini" />
      {status}
    </span>
  );
}
