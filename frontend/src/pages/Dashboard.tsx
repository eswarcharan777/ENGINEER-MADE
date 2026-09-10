import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import LearningHub from './LearningHub';
import KingdomCursor from '../components/KingdomCursor';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');
const featureMenu = [
  ['overview','📊','Dashboard'], ['ai-tutor','🤖','AI Engineering Tutor'], ['doubt-upload','📷','Code & Diagram Doubts'], ['recommendation','✨','Recommendations'], ['continue','▶','Continue Learning'], ['quiz','🧠','Module Quizzes'], ['coding','💻','Coding Practice'], ['projects','🚀','Projects'], ['certificates','🏆','Certificates'], ['bookmarks','🔖','Bookmarks'], ['notes','📝','Notes'], ['discussion','💬','Discussions'], ['jobs','💼','Internships & Jobs'], ['resume','📄','Resume Builder'], ['reports','🚩','Report Content'], ['goals','🎯','Weekly Goals'], ['languages','🌐','Languages'], ['offline','📱','Mobile & Offline'], ['assessment','🧩','Skill Assessments'], ['mentor','🧑‍🏫','Mentor Booking'], ['groups','👥','Study Groups'], ['simulations','⚙️','Simulations'], ['interviews','🎙️','Mock Interviews'], ['placement','🎓','Placement Preparation'], ['repo-analysis','🔎','Repository Analysis'], ['job-board','🧳','Live Job Board'], ['leaderboard','🥇','College Leaderboard'], ['analytics','📈','Advanced Analytics'], ['skill-tree','🌳','Skill Tree'], ['adaptive-practice','🎯','Adaptive Practice'], ['weakness-heatmap','🗺️','Weakness Heatmap'], ['daily-challenge','⚡','Daily Challenge'], ['ai-summarizer','🧾','AI Summarizer'], ['cheatsheet','🗒️','Cheatsheet Generator'], ['career-explorer','🧭','Career Explorer'], ['job-readiness','📐','Job Readiness Predictor'],
];

export default function Dashboard() {
  const { user, loading: authLoading, profile, completedLessons, bookmarks, assessmentAttempts, logout } = useAuth();
  const [paths, setPaths] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; message: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureSearch, setFeatureSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState('overview');

  useEffect(() => {
    axios.get(`${API}/api/catalog`).then(response => setPaths(response.data.paths || [])).catch(() => setPaths([])).finally(() => setLoading(false));
    axios.get(`${API}/api/announcements`).then(response => setAnnouncements(response.data.announcements || [])).catch(() => setAnnouncements([]));
  }, []);

  const selectedPath = useMemo(() => paths.find(path => path.id === profile?.careerPathId), [paths, profile?.careerPathId]);
  const stats = useMemo(() => {
    const lessons = (selectedPath?.modules || []).flatMap((module: any) => module.lessons.map((lesson: any) => ({ ...lesson, moduleId: module.id })));
    const completed = lessons.filter((lesson: any) => completedLessons.includes(`${selectedPath?.id}:${lesson.id}`));
    const next = lessons.find((lesson: any) => !completedLessons.includes(`${selectedPath?.id}:${lesson.id}`));
    return { total: lessons.length, completed: completed.length, next, modules: selectedPath?.modules?.length || 0 };
  }, [selectedPath, completedLessons]);
  const percentage = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const level = Math.max(1, Math.min(10, Math.floor(stats.completed / 3) + 1));
  const levelXp = Math.min(100, (stats.completed % 3) * 34 || (stats.completed ? 100 : 0));
  const weeklyPoints = useMemo(() => {
    const end = Math.max(8, percentage); const values = [Math.max(3, end - 48), Math.max(4, end - 38), Math.max(5, end - 53), Math.max(6, end - 25), Math.max(7, end - 34), Math.max(8, end - 12), end];
    return values.map((value, index) => `${index * 115},${176 - Math.min(158, value * 1.5)}`).join(' ');
  }, [percentage]);
  const initials = (profile?.name || user?.displayName || user?.email || 'E').split(' ').map(value => value[0]).join('').slice(0, 2).toUpperCase();
  const goTo = (id: string) => { setActiveFeature(id); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const visibleMenu = featureMenu.filter(item => item[2].toLowerCase().includes(featureSearch.toLowerCase()));
  const activeLabel = featureMenu.find(item => item[0] === activeFeature)?.[2] || 'Dashboard';

  if (authLoading || loading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.careerPathId) return <Navigate to="/profile" replace />;

  const milestones = [['🚀', 'First steps', stats.completed >= 1, 'Complete your first lesson'], ['🧭', 'Track explorer', stats.completed >= 3, 'Complete 3 lessons'], ['🧠', 'Assessment ready', assessmentAttempts.length >= 1, 'Take a skill assessment'], ['🔥', 'Focused learner', stats.completed >= 6, 'Complete 6 lessons'], ['🏅', 'Roadmap maker', percentage >= 50, 'Reach 50% progress'], ['👑', 'Path champion', percentage === 100 && stats.total > 0, 'Finish your roadmap']];

  return <div className="dashboard-shell dashboard-v2">
    <KingdomCursor />
    <aside className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
      <Link to="/" className="sidebar-brand"><span>EK</span><b>Engineer Kingdom</b></Link>
      <div className="sidebar-profile"><small>WELCOME BACK</small><strong>{profile.name || user.displayName || 'Engineer'}</strong><span>{selectedPath?.title || 'Engineering learner'}</span><Link className="sidebar-change-path" to="/profile">↻ Change roadmap</Link></div>
      <div className="sidebar-search">🔍<input placeholder="Search features…" value={featureSearch} onChange={event => setFeatureSearch(event.target.value)} /></div>
      <nav className="sidebar-nav">{visibleMenu.map(([id, icon, label]) => <button key={id} className={id === activeFeature ? 'active' : ''} onClick={() => goTo(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><Link to="/">⌂ Back to website</Link><button onClick={() => void logout()}>↪ Sign out</button></div>
    </aside>
    <main className="dashboard-workspace"><header className="dashboard-topbar"><button className="sidebar-toggle" onClick={() => setSidebarOpen(value => !value)}>☰</button><h2>{activeLabel}</h2><div className="topbar-level" aria-label={`Level ${level}, ${levelXp} percent toward the next level`}><b>LVL {level}</b><span><i style={{ width: `${levelXp}%` }} /></span></div><div className="topbar-profile"><div><b>{profile.name || user.displayName || 'Engineer'}</b><span>Level {level} · {selectedPath?.title}</span></div><i>{initials}</i></div></header>
      <div className="dashboard-page" id="overview">{activeFeature === 'overview' ? <>
        <section className="dashboard-hero dashboard-v2-hero"><div><span className="dashboard-kicker">YOUR ENGINEERING COMMAND CENTER</span><h1>Good to see you, <em>{profile.name?.split(' ')[0] || 'Engineer'}!</em></h1><p>Your {selectedPath?.title} roadmap is ready. Keep the next lesson moving.</p></div><button className="btn btn-primary" onClick={() => goTo('ai-tutor')}>Ask AI Tutor →</button></section>
        {announcements.length > 0 && <section className="learner-announcements" aria-label="Platform announcements"><span className="dashboard-kicker">KINGDOM NOTICEBOARD</span>{announcements.slice(0, 3).map(announcement => <article key={announcement.id}><h2>{announcement.title}</h2><p>{announcement.message}</p></article>)}</section>}
        <section className="track-panel"><div className="track-panel-head"><div><span className="dashboard-kicker">YOUR SELECTED ROADMAP</span><h2>{selectedPath?.icon} {selectedPath?.title}</h2><p>{stats.modules} modules · {stats.total} lessons · tailored to your chosen role</p></div><Link to="/profile">Change →</Link></div><div className="track-counts"><article><strong>{stats.modules}</strong><span>Modules</span></article><article><strong>{stats.total}</strong><span>Lessons</span></article><article><strong>{percentage}%</strong><span>Complete</span></article></div></section>
        <section className="dashboard-metric-grid"><article><span>🔥</span><b>{stats.completed}</b><small>Lessons completed</small></article><article><span>🧩</span><b>{assessmentAttempts.length}</b><small>Skill assessments</small></article><article><span>🔖</span><b>{bookmarks.length}</b><small>Saved resources</small></article><article><span>🏆</span><b>{level}</b><small>Current level</small></article></section>
        <section className="level-panel"><div><span>LEVEL {level}</span><b>{levelXp} XP</b></div><div className="progress-track"><i style={{ width: `${levelXp}%` }} /></div><small>Complete 3 lessons to advance to level {Math.min(10, level + 1)}.</small></section>
        <section className="analysis-panel"><div className="panel-heading"><div><span className="dashboard-kicker">LEARNING ANALYSIS</span><h2>Weekly progress</h2></div><span>This week</span></div><svg viewBox="0 0 690 200" preserveAspectRatio="none" aria-label="Weekly progress chart" role="img"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#e847af" stopOpacity=".42"/><stop offset="1" stopColor="#8b5cf6" stopOpacity="0"/></linearGradient></defs><polygon points={`0,200 ${weeklyPoints} 690,200`} fill="url(#chart-fill)"/><polyline points={weeklyPoints} fill="none" stroke="#ed4bb3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg><div className="chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Today</span></div></section>
        <section className="continue-card"><div><span className="dashboard-kicker">CONTINUE YOUR ROADMAP</span><h2>{stats.next?.title || 'Roadmap completed — exceptional work!'}</h2><p>{stats.next ? `${selectedPath?.title} · Next lesson` : 'Choose another role when you are ready for a new challenge.'}</p></div>{stats.next ? <Link className="btn btn-secondary" to={`/learn/${selectedPath?.id}/${stats.next.moduleId}/${stats.next.id}`}>Continue lesson →</Link> : <Link className="btn btn-secondary" to="/profile">Change roadmap →</Link>}</section>
        <section className="dashboard-section"><div className="panel-heading"><div><span className="dashboard-kicker">QUICK ACCESS</span><h2>Everything you need to learn</h2></div></div><div className="quick-access-grid">{featureMenu.slice(1).map(([id, icon, label]) => <button key={id} onClick={() => goTo(id)}><span>{icon}</span><div><b>{label}</b><small>Open tool</small></div></button>)}</div></section>
        <section className="dashboard-section achievements-panel"><div className="panel-heading"><div><span className="dashboard-kicker">ACHIEVEMENTS</span><h2>{milestones.filter(([, , unlocked]) => unlocked).length} / {milestones.length} unlocked</h2></div><span>{percentage}% roadmap completion</span></div><div className="achievement-grid">{milestones.map(([icon, title, unlocked, detail]) => <article key={title as string} className={unlocked ? 'unlocked' : ''}><span>{unlocked ? icon : '🔒'}</span><b>{title}</b><small>{detail}</small></article>)}</div></section>
        <section className="dashboard-bottom-grid"><article><span className="dashboard-kicker">RECENT ACTIVITY</span><h2>{stats.completed ? `${stats.completed} lesson${stats.completed === 1 ? '' : 's'} completed` : 'Your journey starts here'}</h2><p>{stats.completed ? 'Your completed lessons are saved in your learner profile.' : 'Open your first lesson to begin tracking progress.'}</p></article><article><span className="dashboard-kicker">TODAY’S FOCUS</span><h2>{stats.next?.title || 'Plan your next milestone'}</h2><p>{stats.next ? 'A focused lesson now is the fastest route to momentum.' : 'Review your completed roadmap and select a new target role.'}</p></article></section>
      </> : <LearningHub embedded activeFeature={activeFeature} onFeatureChange={goTo} />}</div>
    </main>
  </div>;
}
