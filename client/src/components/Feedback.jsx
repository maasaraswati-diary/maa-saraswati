import Icon from './Icons';

/** Centered spinner with a brand message. */
export function Loader({ label = 'Loading…', minHeight = 320 }) {
  return (
    <div className="loader" style={{ minHeight }}>
      <div className="loader-ring" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="muted">{label}</p>
    </div>
  );
}

/** Card-shaped placeholder used while the product grid loads. */
export function CardSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-products">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skel-card">
          <div className="skeleton" style={{ aspectRatio: '1 / 1' }} />
          <div className="skel-lines">
            <div className="skeleton" style={{ height: 12, width: '35%' }} />
            <div className="skeleton" style={{ height: 20, width: '80%' }} />
            <div className="skeleton" style={{ height: 12, width: '100%' }} />
            <div className="skeleton" style={{ height: 12, width: '60%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Error state with a retry affordance. */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <span className="error-icon">
        <Icon.Alert size={30} />
      </span>
      <h3 className="h3">Something went wrong</h3>
      <p className="muted">{message}</p>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          <Icon.Refresh size={16} /> Try again
        </button>
      )}
    </div>
  );
}

/** Friendly empty state for zero-result lists. */
export function EmptyState({ title, message, action }) {
  return (
    <div className="error-state">
      <span className="error-icon empty-icon">
        <Icon.Search size={30} />
      </span>
      <h3 className="h3">{title}</h3>
      {message && <p className="muted">{message}</p>}
      {action}
    </div>
  );
}

/** Page header used on inner pages. */
export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <section className="page-header">
      <div className="page-header-bg" aria-hidden="true" />
      <div className="container">
        <div className="page-header-in">
          {eyebrow && <span className="eyebrow reveal">{eyebrow}</span>}
          <h1 className="h2 reveal reveal-d1">{title}</h1>
          {subtitle && (
            <p className="lead reveal reveal-d2" style={{ marginTop: 14 }}>
              {subtitle}
            </p>
          )}
          {children && (
            <div className="reveal reveal-d3" style={{ marginTop: 26 }}>
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
