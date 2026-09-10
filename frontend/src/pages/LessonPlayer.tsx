import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

function LessonPlayer() {
  const { pathId, moduleId, lessonId } = useParams<{ pathId: string; moduleId: string; lessonId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user, completedLessons, markLessonComplete, bookmarks, saveBookmark } = useAuth();

  useEffect(() => {
    axios.get(`${API}/api/paths/${pathId}/modules/${moduleId}/lessons/${lessonId}`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [pathId, moduleId, lessonId]);

  useEffect(() => {
    if (!data?.lesson) return;
    const item = { title: data.lesson.title, url: `/learn/${pathId}/${moduleId}/${lessonId}`, watchedAt: Date.now() };
    try {
      const current = JSON.parse(localStorage.getItem('engineer-made-history') || '[]');
      localStorage.setItem('engineer-made-history', JSON.stringify([item, ...current.filter((entry: any) => entry.url !== item.url)].slice(0, 20)));
    } catch { /* local history is optional */ }
  }, [data, pathId, moduleId, lessonId]);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data) return <div className="lesson-player"><h1>Lesson not found</h1></div>;

  const { lesson, path, module } = data;
  const completionKey = `${pathId}:${lessonId}`;
  const isComplete = completedLessons.includes(completionKey);
  const lessonUrl = `/learn/${pathId}/${moduleId}/${lessonId}`;
  const isSaved = bookmarks.some(bookmark => bookmark.url === lessonUrl);

  return (
    <div className="lesson-player">
      <div className="lesson-breadcrumb">
        <Link to="/paths">Paths</Link>
        <span>/</span>
        <Link to={`/paths/${pathId}`}>{path}</Link>
        <span>/</span>
        <span>{module}</span>
      </div>

      {lesson.type === 'video' && lesson.videoId && (
        <div className="video-container">
          <iframe
            src={`https://www.youtube.com/embed/${lesson.videoId}`}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {lesson.type === 'audio' && (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem',
          textAlign: 'center',
          marginBottom: '2rem',
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎧</div>
          <p style={{ color: 'var(--text-secondary)' }}>Audio lesson coming soon</p>
        </div>
      )}

      {lesson.type === 'course' && (
        <div className="external-course-card"><div>🎓</div><h2>Course lesson</h2><p>This roadmap stage uses an external university course.</p><a className="btn btn-primary" href={lesson.externalUrl} target="_blank" rel="noopener noreferrer">Open course</a></div>
      )}

      <h1 className="lesson-title">{lesson.title}</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        {lesson.type === 'video' ? 'Video' : 'Audio'} &middot; {lesson.duration}
      </p>
      {user ? (
        <div className="lesson-actions">
          <button
            type="button"
            className={`btn lesson-complete-btn ${isComplete ? 'is-complete' : 'btn-primary'}`}
            disabled={isComplete}
            onClick={() => markLessonComplete(pathId!, lessonId!)}
          >
            {isComplete ? '✓ Lesson completed' : 'Mark as complete'}
          </button>
          <button type="button" className="btn btn-secondary" disabled={isSaved} onClick={() => saveBookmark({ title: lesson.title, url: lessonUrl, pathId, lessonId })}>
            {isSaved ? '🔖 Saved to bookmarks' : '🔖 Save lesson'}
          </button>
        </div>
      ) : (
        <p className="lesson-signin-note"><Link to="/login">Sign in</Link> to save your progress.</p>
      )}
    </div>
  );
}

export default LessonPlayer;
