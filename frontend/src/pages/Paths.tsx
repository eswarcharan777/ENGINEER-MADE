import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlayIcon, BookIcon } from '../components/Icons';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

function Paths() {
  const [paths, setPaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/paths`)
      .then(res => { setPaths(res.data.paths); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <section className="section" style={{ paddingTop: '7rem' }}>
      <div className="section-header">
        <h2>All Learning Paths</h2>
        <p>Choose the engineering career you want to pursue. Every path is free and structured for self-paced learning.</p>
      </div>
      <div className="paths-grid">
        {paths.map(path => (
          <Link to={`/paths/${path.id}`} className="path-card" key={path.id} style={{ '--card-color': path.color } as React.CSSProperties}>
            <div className="path-card-icon">{path.icon}</div>
            <h3>{path.title}</h3>
            <p>{path.description}</p>
            <div className="skills-row">
              {path.skills.map((s: string) => (
                <span className="skill-tag" key={s}>{s}</span>
              ))}
            </div>
            <div className="path-card-meta">
              <span><PlayIcon size={14} /> {path.lessonCount} lessons</span>
              <span><BookIcon size={14} /> {path.moduleCount} modules</span>
              <span>{path.duration}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default Paths;
