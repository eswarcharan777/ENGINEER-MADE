import React, { useState, useEffect, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, PlayIcon, HeadphonesIcon, BookIcon, TrendingUpIcon, UsersIcon, AwardIcon } from '../components/Icons';
import axios from 'axios';

const Kingdom3D = React.lazy(() => import('../components/Kingdom3D'));
const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

function Home() {
  const [paths, setPaths] = useState<any[]>([]);
  const lessonCount = paths.reduce((total, path) => total + path.lessonCount, 0);

  useEffect(() => {
    axios.get(`${API}/api/paths`).then(res => setPaths(res.data.paths)).catch(() => {});
  }, []);

  return (
    <>
      <Suspense fallback={<div className="globe-fallback kingdom-loading" />}>
        <Kingdom3D />
      </Suspense>
      <section className="hero hero-globe kingdom-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="dot"></span>
            ENTER THE ROYAL ACADEMY
          </div>
          <h1>
            Build Your Legacy in the<br />
            <span className="gradient-text">Engineer Made</span>
          </h1>
          <p>
            Enter a living 3D citadel of engineering knowledge. Master your discipline,
            build real projects, and earn your place among tomorrow's great engineers.
          </p>
          <div className="hero-cta">
            <Link to="/paths" className="btn btn-primary">
              Explore learning paths <ArrowRightIcon />
            </Link>
            <Link to="/signup" className="btn btn-secondary">
              Join Free
            </Link>
          </div>
          <div className="hero-learners">
            <div className="learner-avatars">
              <div className="avatar" style={{ background: '#7C3AED' }}>A</div>
              <div className="avatar" style={{ background: '#2563EB' }}>R</div>
              <div className="avatar" style={{ background: '#059669' }}>S</div>
              <div className="avatar" style={{ background: '#DC2626' }}>P</div>
            </div>
            <span>Engineers learning right now across India</span>
          </div>
        </div>
      </section>

      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">6+</div>
          <div className="stat-label">Learning Paths</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{lessonCount || '—'}</div>
          <div className="stat-label">Video Lessons</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">18</div>
          <div className="stat-label">Curated Resources</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">100%</div>
          <div className="stat-label">Free Forever</div>
        </div>
      </div>

      <section className="section">
        <div className="section-header">
          <h2>Choose Your Path</h2>
          <p>Pick the engineering role you want to master. Each path is structured, project-based, and industry-ready.</p>
        </div>
        <div className="paths-grid">
          {paths.map(path => (
            <Link to={`/paths/${path.id}`} className="path-card" key={path.id} style={{ '--card-color': path.color } as React.CSSProperties}>
              <div className="path-card-icon">{path.icon}</div>
              <h3>{path.title}</h3>
              <p>{path.description}</p>
              <div className="skills-row">
                {path.skills.slice(0, 4).map((s: string) => (
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

      <section className="section">
        <div className="section-header">
          <h2>Why Engineer Made?</h2>
          <p>Built for engineers, by engineers. Here's what makes us different.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><PlayIcon size={24} /></div>
            <h3>Video Classes</h3>
            <p>Curated video lessons from the best free content on the internet, organized into structured learning paths.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><HeadphonesIcon /></div>
            <h3>Audio Lessons</h3>
            <p>Learn on the go with audio recaps and podcast-style lessons you can listen to during your commute.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><BookIcon size={24} /></div>
            <h3>Curated Resources</h3>
            <p>Hand-picked books, documentation, tools, and practice platforms for each learning path.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><TrendingUpIcon /></div>
            <h3>Industry-Ready Skills</h3>
            <p>Every path is designed around actual job requirements from top Indian and global tech companies.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><UsersIcon /></div>
            <h3>Built for India</h3>
            <p>Content curated specifically for Indian engineering students and early-career professionals.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><AwardIcon /></div>
            <h3>100% Free</h3>
            <p>No hidden fees, no premium tiers. Quality education should be accessible to everyone.</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;
