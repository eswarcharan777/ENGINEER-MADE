import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

type VerifiedCertificate = {
  code: string; learnerName: string; trackTitle: string; completedLessons: number; issuedAt?: string;
};

export default function CertificateVerify() {
  const { code: routeCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [code, setCode] = useState(routeCode || '');
  const [certificate, setCertificate] = useState<VerifiedCertificate | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const verify = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return setError('Enter the certificate code shown on the certificate.');
    setChecking(true); setCertificate(null); setError('');
    try {
      const response = await axios.get(`${API}/api/certificates/${encodeURIComponent(normalized)}`);
      setCertificate(response.data); navigate(`/verify-certificate/${normalized}`, { replace: true });
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'We could not verify this certificate right now. Please retry shortly.');
    } finally { setChecking(false); }
  };

  return <section className="certificate-verify-page">
    <span className="dashboard-kicker">ENGINEER KINGDOM · CREDENTIAL CHECK</span>
    <h1>Verify a certificate</h1>
    <p>Enter a certificate code to confirm that an Engineer Kingdom learning milestone is valid.</p>
    <form onSubmit={verify} className="certificate-verify-form">
      <label>Certificate code<input value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="EK-XXXXXXXXXXXX" autoCapitalize="characters" /></label>
      <button className="btn btn-primary" disabled={checking}>{checking ? 'Checking…' : 'Verify certificate'}</button>
    </form>
    {error && <div className="certificate-result certificate-error">⚠ {error}</div>}
    {certificate && <article className="certificate-result certificate-valid">
      <span>✓ VERIFIED CREDENTIAL</span><h2>{certificate.learnerName}</h2>
      <p>completed <b>{certificate.trackTitle}</b></p>
      <div><strong>{certificate.completedLessons}</strong><small>lessons completed</small><strong>{certificate.code}</strong><small>certificate code</small></div>
      {certificate.issuedAt && <small>Issued {new Date(certificate.issuedAt).toLocaleDateString()}</small>}
    </article>}
    <Link to="/" className="certificate-back">Return to Engineer Kingdom</Link>
  </section>;
}
