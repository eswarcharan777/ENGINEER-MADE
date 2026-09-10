import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return <section className="route-state route-state-not-found">
    <div className="route-state-code" aria-hidden="true">404</div>
    <p className="route-state-kicker">UNCHARTED TERRITORY</p>
    <h1>This path is not in the kingdom</h1>
    <p>The address may be incorrect, or this learning resource may have moved.</p>
    <div className="route-state-actions"><Link className="btn btn-primary" to="/paths">Explore learning paths</Link><Link className="btn btn-secondary" to="/">Return home</Link></div>
  </section>;
}
