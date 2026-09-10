import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');
type Announcement = { id: string; title: string; message: string; audience: string; published: boolean };
type Report = { id: string; issueType: string; resourceUrl: string; details?: string; status: string };
type Audit = { id: string; action: string; targetId?: string; createdAt?: string };
type Metrics = { windowDays: number; events: Record<string, number>; errorCount: number };

function detail(error: unknown) {
  return axios.isAxiosError(error) ? String(error.response?.data?.detail || error.message) : 'Request failed. Please retry.';
}

export default function AdminOperations() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all'); const [published, setPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);

  const headers = useCallback(async () => ({ Authorization: `Bearer ${await user?.getIdToken()}` }), [user]);
  const load = useCallback(async () => {
    if (!user) return;
    setNotice('');
    try {
      const authHeaders = { headers: await headers() };
      const [announcementResult, reportResult, auditResult, metricsResult] = await Promise.all([
        axios.get<{ announcements: Announcement[] }>(`${API}/api/admin/announcements`, authHeaders),
        axios.get<{ reports: Report[] }>(`${API}/api/admin/reports`, authHeaders),
        axios.get<{ events: Audit[] }>(`${API}/api/admin/audit-log?limit=20`, authHeaders),
        axios.get<Metrics>(`${API}/api/admin/analytics`, authHeaders),
      ]);
      setAnnouncements(announcementResult.data.announcements); setReports(reportResult.data.reports);
      setAudits(auditResult.data.events); setMetrics(metricsResult.data);
    } catch (error) { setNotice(detail(error)); }
  }, [headers, user]);
  useEffect(() => { void load(); }, [load]);

  async function createAnnouncement(event: React.FormEvent) {
    event.preventDefault(); if (!title.trim() || !body.trim()) return;
    setBusy(true); setNotice('');
    try {
      await axios.post(`${API}/api/admin/announcements`, { title: title.trim(), message: body.trim(), audience, published }, { headers: await headers() });
      setTitle(''); setBody(''); setNotice(published ? 'Announcement published.' : 'Announcement saved as a draft.'); await load();
    } catch (error) { setNotice(detail(error)); } finally { setBusy(false); }
  }
  async function updateReport(id: string, status: string) {
    setBusy(true); try { await axios.patch(`${API}/api/admin/reports/${id}`, { status }, { headers: await headers() }); setNotice(`Report marked ${status}.`); await load(); } catch (error) { setNotice(detail(error)); } finally { setBusy(false); }
  }
  async function upload() {
    if (!file) return; setBusy(true); setNotice('');
    try { const form = new FormData(); form.append('file', file); await axios.post(`${API}/api/admin/uploads`, form, { headers: await headers() }); setFile(null); setNotice('Asset uploaded securely.'); await load(); } catch (error) { setNotice(detail(error)); } finally { setBusy(false); }
  }

  return <section className="admin-operations" aria-labelledby="operations-title">
    <div className="admin-catalog-toolbar"><div><span className="dashboard-kicker">PLATFORM OPERATIONS</span><h2 id="operations-title">Announcements, moderation & health</h2><p>All actions are recorded in the administrator audit log.</p></div><button className="btn btn-secondary" type="button" onClick={() => void load()} disabled={busy}>Refresh</button></div>
    {notice && <div className="admin-alert">{notice}</div>}
    <div className="admin-operations-grid">
      <form className="admin-operation-card" onSubmit={createAnnouncement}><h3>Publish announcement</h3><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Title" maxLength={160} required /><textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Message for learners" maxLength={4000} required /><label>Audience<select value={audience} onChange={event => setAudience(event.target.value)}><option value="all">Everyone</option><option value="learners">Learners</option><option value="admins">Administrators</option></select></label><label className="admin-check"><input type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)} /> Publish immediately</label><button className="btn btn-primary" disabled={busy}>Save announcement</button>{announcements.slice(0, 3).map(item => <div className="admin-mini-row" key={item.id}><b>{item.title}</b><small>{item.published ? 'Published' : 'Draft'} · {item.audience}</small></div>)}</form>
      <div className="admin-operation-card"><h3>Content reports</h3>{reports.length ? reports.slice(0, 6).map(report => <div className="admin-report-row" key={report.id}><div><b>{report.issueType.replace(/_/g, ' ')}</b><small>{report.resourceUrl}</small></div><select value={report.status} disabled={busy} onChange={event => void updateReport(report.id, event.target.value)}><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></div>) : <p className="admin-empty">No reports waiting for review.</p>}</div>
      <div className="admin-operation-card"><h3>Asset upload</h3><p>JPG, PNG, WebP, GIF, PDF or DOCX. Maximum 10 MB.</p><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFile(event.target.files?.[0] || null)} /><button className="btn btn-secondary" type="button" disabled={!file || busy} onClick={() => void upload()}>Upload private asset</button><small>Requires Firebase Storage server configuration.</small></div>
      <div className="admin-operation-card"><h3>Platform health</h3>{metrics ? <><strong className="admin-metric">{metrics.errorCount}</strong><p>captured errors in the last {metrics.windowDays} days</p>{Object.entries(metrics.events).map(([event, count]) => <div className="admin-mini-row" key={event}><span>{event.replace(/_/g, ' ')}</span><b>{count}</b></div>)}</> : <p>Loading operational metrics…</p>}<h4>Recent audit history</h4>{audits.length ? audits.slice(0, 5).map(event => <div className="admin-mini-row" key={event.id}><span>{event.action}</span><small>{event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Recent'}</small></div>) : <p className="admin-empty">No recorded changes yet.</p>}</div>
    </div>
  </section>;
}
