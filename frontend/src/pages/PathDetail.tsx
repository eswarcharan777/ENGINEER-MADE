import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PlayIcon, HeadphonesIcon, ExternalLinkIcon, ChevronDownIcon, ChevronUpIcon } from '../components/Icons';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

function PathDetail() {
  const { pathId } = useParams<{ pathId: string }>();
  const [path, setPath] = useState<any>(null);
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/paths/${pathId}`)
      .then(res => {
        setPath(res.data);
        if (res.data.modules?.length > 0) {
          setOpenModules(new Set([res.data.modules[0].id]));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pathId]);

  const toggleModule = (id: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!path) return <div className="path-detail"><h1>Path not found</h1></div>;

  return (
    <div className="path-detail">
      <div className="path-detail-header">
        <div className="icon">{path.icon}</div>
        <h1>{path.title}</h1>
        <p>{path.description}</p>
        <div className="skills-row" style={{ marginTop: '1.5rem' }}>
          {path.skills.map((s: string) => <span className="skill-tag" key={s}>{s}</span>)}
        </div>
      </div>

      <div className="roadmap-heading">
        <div>
          <span className="roadmap-kicker">STEP-BY-STEP ROADMAP</span>
          <h2>Modules, courses and tutorials</h2>
        </div>
        <span>{path.modules.length} stages</span>
      </div>

      <div className="roadmap-list">{path.modules.map((module: any, moduleIndex: number) => (
        <div className="module-card" key={module.id}>
          <div className="module-header" onClick={() => toggleModule(module.id)}>
            <div className="module-title"><span>{moduleIndex + 1}</span><h3>{module.title}</h3></div>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {module.lessons.length} lessons
              {openModules.has(module.id) ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </span>
          </div>
          {openModules.has(module.id) && (
            <div className="lesson-list">
              {module.lessons.map((lesson: any) => (
                <Link
                  to={`/learn/${pathId}/${module.id}/${lesson.id}`}
                  className="lesson-item"
                  key={lesson.id}
                >
                  <div className={`lesson-icon ${lesson.type}`}>
                    {lesson.type === 'video' ? <PlayIcon /> : <HeadphonesIcon />}
                  </div>
                  <div className="lesson-info">
                    <h4>{lesson.title}</h4>
                    <span>{lesson.type === 'video' ? 'Video' : 'Audio'} &middot; {lesson.duration}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}</div>

      {path.resources && path.resources.length > 0 && (
        <div className="resources-section">
          <h2>Resources & Tools</h2>
          {path.resources.map((res: any, i: number) => (
            <a href={res.url} target="_blank" rel="noopener noreferrer" className="resource-card" key={i}>
              <h4>{res.title}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="resource-type">{res.type}</span>
                <ExternalLinkIcon size={14} />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default PathDetail;
