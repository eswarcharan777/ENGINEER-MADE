import React from 'react';
import { Link } from 'react-router-dom';

export function PageLoading({ label = 'Preparing your experience…' }: { label?: string }) {
  return <section className="route-state" role="status" aria-live="polite" aria-busy="true">
    <div className="route-state-emblem" aria-hidden="true">EK</div>
    <div className="spinner" aria-hidden="true" />
    <h1>{label}</h1>
    <p>Engineer Made will open in a moment.</p>
  </section>;
}

type ApiFailureProps = { title?: string; message?: string; onRetry?: () => void };

export function ApiFailure({ title = 'This service is temporarily unavailable', message = 'The application could not reach its service. Check your connection and try again.', onRetry }: ApiFailureProps) {
  const retry = onRetry || (() => window.location.reload());
  return <section className="route-state route-state-error" role="alert">
    <div className="route-state-icon" aria-hidden="true">!</div>
    <p className="route-state-kicker">CONNECTION INTERRUPTED</p>
    <h1>{title}</h1><p>{message}</p>
    <div className="route-state-actions">
      <button className="btn btn-primary" type="button" onClick={retry}>Try again</button>
      <Link className="btn btn-secondary" to="/">Return home</Link>
    </div>
  </section>;
}
