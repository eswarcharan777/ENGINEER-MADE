import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AdminOperations from '../components/AdminOperations';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

type Lesson = { id: string; title: string; type: string; videoId?: string; duration?: string; status?: 'draft' | 'published' };
type Module = { id: string; title: string; lessons: Lesson[]; status?: 'draft' | 'published' };
type Path = { id: string; title: string; icon: string; modules: Module[]; status?: 'draft' | 'published' };
type Learner = { id: string; name: string; email: string; collegeName: string; profileCompleted: boolean; completedLessons: number; createdAt: string | null; lastActiveAt: string | null; isActive: boolean; role?: 'learner' | 'admin' };
type LearnerAnalytics = { available: boolean; message?: string; totalUsers: number; activeUsers: number; activeWindowMinutes: number; users: Learner[] };
type Overview = { pathCount: number; moduleCount: number; lessonCount: number; paths: Path[]; learnerAnalytics: LearnerAnalytics };

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.detail || error.message;
  return 'Something went wrong. Please retry.';
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
}

export default function Admin() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [pathId, setPathId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [videoId, setVideoId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken(true);
    const response = await axios.get<Overview>(`${API}/api/admin/overview`, { headers: { Authorization: `Bearer ${token}` } });
    setData(response.data);
    setPathId(current => current || response.data.paths[0]?.id || '');
  }, [user]);

  const retryLoad = useCallback(async () => {
    setMessage('');
    try {
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(errorMessage(error));
    }
  }, [load]);

  const adminHeaders = useCallback(async () => {
    if (!user) throw new Error('Administrator sign-in is required.');
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }, [user]);

  useEffect(() => {
    Promise.allSettled([load(), axios.get(`${API}/api/health`)]).then(results => {
      if (results[0].status === 'rejected') {
        setIsError(true);
        setMessage(errorMessage(results[0].reason));
      }
      setApiOnline(results[1].status === 'fulfilled');
    });
  }, [load]);

  const selectedPath = useMemo(() => data?.paths.find(path => path.id === pathId), [data, pathId]);
  useEffect(() => {
    setModuleId(current => selectedPath?.modules.some(module => module.id === current) ? current : selectedPath?.modules[0]?.id || '');
  }, [selectedPath]);

  const visiblePaths = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data?.paths || [];
    return (data?.paths || []).filter(path =>
      path.title.toLowerCase().includes(term) ||
      path.modules.some(module => module.title.toLowerCase().includes(term) || module.lessons.some(lesson => lesson.title.toLowerCase().includes(term)))
    );
  }, [data, query]);

  const videoCount = useMemo(() => data?.paths.reduce((count, path) => count + path.modules.reduce((sum, module) => sum + module.lessons.filter(lesson => lesson.type === 'video').length, 0), 0) || 0, [data]);

  async function addLesson(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(''); setIsError(false);
    try {
      await axios.post(`${API}/api/admin/paths/${pathId}/modules/${moduleId}/lessons`, { title: title.trim(), videoId: videoId.trim(), type: videoId.trim() ? 'video' : 'course', duration: '30 min' }, { headers: await adminHeaders() });
      setTitle(''); setVideoId(''); setMessage('Lesson added and saved successfully.');
      await load();
    } catch (error) {
      setIsError(true); setMessage(errorMessage(error));
    } finally { setBusy(false); }
  }

  async function removeLesson(path: string, module: string, lesson: string) {
    if (!window.confirm('Permanently remove this lesson?')) return;
    setBusy(true); setMessage(''); setIsError(false);
    try {
      await axios.delete(`${API}/api/admin/paths/${path}/modules/${module}/lessons/${lesson}`, { headers: await adminHeaders() });
      setMessage('Lesson removed successfully.'); await load();
    } catch (error) {
      setIsError(true); setMessage(errorMessage(error));
    } finally { setBusy(false); }
  }

  async function updateCatalog(url: string, payload: Record<string, unknown>, success: string) {
    setBusy(true); setMessage(''); setIsError(false);
    try {
      await axios.patch(`${API}${url}`, payload, { headers: await adminHeaders() });
      setMessage(success); await load();
    } catch (error) { setIsError(true); setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function editPath(path: Path) {
    const title = window.prompt('Roadmap title', path.title);
    if (title === null || !title.trim()) return;
    const status = window.confirm('Publish this roadmap now?\nChoose Cancel to keep it as a draft.') ? 'published' : 'draft';
    void updateCatalog(`/api/admin/paths/${path.id}`, { title: title.trim(), status }, `Roadmap saved as ${status}.`);
  }

  function editModule(path: Path, module: Module) {
    const title = window.prompt('Module title', module.title);
    if (title === null || !title.trim()) return;
    const status = window.confirm('Publish this module now?\nChoose Cancel to keep it as a draft.') ? 'published' : 'draft';
    void updateCatalog(`/api/admin/paths/${path.id}/modules/${module.id}`, { title: title.trim(), status }, `Module saved as ${status}.`);
  }

  function editLesson(path: Path, module: Module, lesson: Lesson) {
    const title = window.prompt('Lesson title', lesson.title);
    if (title === null || !title.trim()) return;
    const status = window.confirm('Publish this lesson now?\nChoose Cancel to keep it as a draft.') ? 'published' : 'draft';
    void updateCatalog(`/api/admin/paths/${path.id}/modules/${module.id}/lessons/${lesson.id}`, { title: title.trim(), status }, `Lesson saved as ${status}.`);
  }

  function setUserRole(learner: Learner, role: 'learner' | 'admin') {
    if (role === learner.role) return;
    if (!window.confirm(`Change ${learner.email || learner.name} to ${role}?`)) return;
    void updateCatalog(`/api/admin/users/${learner.id}/role`, { role }, `Role updated to ${role}. The user must sign in again for the change to apply.`);
  }

  function exportCatalog() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.paths, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `engineer-made-catalog-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <div className="admin-load-state">{!message && <div className="spinner" />}<h1>{message ? 'Admin portal unavailable' : 'Loading administration portal…'}</h1>{message && <><p>{message}</p><p className="admin-session-email">Signed in as {user?.email || 'unknown account'}</p><div><button className="btn btn-primary" onClick={retryLoad}>Retry</button><button className="btn btn-secondary" onClick={async () => { await logout(); window.location.assign('/admin-access'); }}>Switch Google account</button></div></>}</div>;
  const learnerAnalytics = data.learnerAnalytics;

  return <div className="admin-page">
    <div className="admin-header">
      <div><span className="dashboard-kicker">ENGINEER MADE CONTROL ROOM</span><h1>Content administration</h1><p>Monitor the platform, manage learning content, and prepare releases.</p></div>
      <div className="admin-header-actions"><div className={`admin-health ${apiOnline ? 'online' : apiOnline === false ? 'offline' : ''}`}><span /> API {apiOnline ? 'Online' : apiOnline === false ? 'Offline' : 'Checking'}</div><a href="/">Public website</a><button type="button" onClick={logout}>Sign out</button></div>
    </div>

    <div className="admin-stats">
      <article><strong>{data.pathCount}</strong><span>Engineering roadmaps</span></article>
      <article><strong>{data.moduleCount}</strong><span>Structured modules</span></article>
      <article><strong>{data.lessonCount}</strong><span>Total lessons</span></article>
      <article><strong>{videoCount}</strong><span>Video tutorials</span></article>
      <article><strong>{learnerAnalytics.totalUsers}</strong><span>Learner accounts</span></article>
      <article><strong>{learnerAnalytics.activeUsers}</strong><span>Active now</span></article>
    </div>

    <section className="admin-learners" aria-labelledby="learner-directory-title">
      <div className="admin-catalog-toolbar">
        <div><span className="dashboard-kicker">PRIVATE LEARNER ANALYTICS</span><h2 id="learner-directory-title">Learner directory</h2><p>“Active now” means activity within the last {learnerAnalytics.activeWindowMinutes} minutes. Showing the 100 most recently active accounts.</p></div>
        <button type="button" className="btn btn-secondary" onClick={retryLoad}>Refresh users</button>
      </div>
      {!learnerAnalytics.available ? <div className="admin-empty">{learnerAnalytics.message || 'Learner analytics is unavailable until Firestore is connected.'}</div> : learnerAnalytics.users.length ? <div className="admin-user-table-wrap"><table className="admin-user-table"><thead><tr><th>Learner</th><th>College</th><th>Progress</th><th>Last active</th><th>Status</th><th>Role</th></tr></thead><tbody>{learnerAnalytics.users.map(learner => <tr key={learner.id}><td><strong>{learner.name}</strong><small>{learner.email || 'No email recorded'}</small></td><td>{learner.collegeName}</td><td>{learner.completedLessons} lessons</td><td>{formatDate(learner.lastActiveAt)}</td><td><span className={`admin-user-status ${learner.isActive ? 'active' : ''}`}>{learner.isActive ? 'Active' : 'Offline'}</span></td><td><select aria-label={`Role for ${learner.email || learner.name}`} disabled={busy} value={learner.role || 'learner'} onChange={event => setUserRole(learner, event.target.value as 'learner' | 'admin')}><option value="learner">Learner</option><option value="admin">Administrator</option></select></td></tr>)}</tbody></table></div> : <div className="admin-empty">No learner accounts have been recorded yet.</div>}
    </section>

    <AdminOperations />

    {message && <div className={`admin-alert ${isError ? 'error' : 'success'}`}>{message}</div>}

    <div className="admin-layout">
      <form className="admin-form" onSubmit={addLesson}>
        <h2>Add a lesson</h2>
        <label>Roadmap<select value={pathId} onChange={event => setPathId(event.target.value)}>{data.paths.map(path => <option key={path.id} value={path.id}>{path.title}</option>)}</select></label>
        <label>Module<select value={moduleId} onChange={event => setModuleId(event.target.value)}>{selectedPath?.modules.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>
        <label>Lesson title<input required minLength={3} value={title} onChange={event => setTitle(event.target.value)} placeholder="Introduction to structural analysis" /></label>
        <label>YouTube video ID (optional)<input value={videoId} onChange={event => setVideoId(event.target.value)} placeholder="e.g. aircAruvnKk" /></label>
        <button className="btn btn-primary" disabled={busy || !moduleId}>{busy ? 'Saving…' : 'Add lesson'}</button>
        <small>Changes are stored in Firestore when the backend is connected to Firebase.</small>
      </form>

      <div className="admin-catalog">
        <div className="admin-catalog-toolbar"><div><h2>Learning catalog</h2><p>{visiblePaths.length} of {data.pathCount} roadmaps</p></div><button type="button" className="btn btn-secondary" onClick={exportCatalog}>Export JSON</button></div>
        <input className="admin-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search roadmaps, modules, or lessons…" aria-label="Search learning catalog" />
        {visiblePaths.map(path => <details key={path.id}>
          <summary>{path.icon} {path.title}<span>{path.status || 'published'} · {path.modules.length} modules · {path.modules.reduce((sum, module) => sum + module.lessons.length, 0)} lessons</span></summary>
          <div className="admin-edit-row"><button type="button" disabled={busy} onClick={() => editPath(path)}>Edit roadmap / publish</button></div>
          {path.modules.map(module => <div className="admin-module" key={module.id}><h4>{module.title}<small>{module.status || 'published'} · {module.lessons.length} lessons</small><button type="button" disabled={busy} onClick={() => editModule(path, module)}>Edit module</button></h4>{module.lessons.map(lesson => <div className="admin-lesson" key={lesson.id}><div><span>{lesson.title}</span><small>{lesson.status || 'published'} · {lesson.type} · {lesson.duration || 'Duration pending'}</small></div><div><button type="button" disabled={busy} onClick={() => editLesson(path, module, lesson)}>Edit / publish</button><button disabled={busy} onClick={() => removeLesson(path.id, module.id, lesson.id)}>Remove</button></div></div>)}</div>)}
        </details>)}
        {!visiblePaths.length && <div className="admin-empty">No catalog items match “{query}”.</div>}
      </div>
    </div>
  </div>;
}
