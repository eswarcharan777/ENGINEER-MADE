import React from 'react';

function About() {
  return (
    <div className="about-page">
      <h1>About Engineer Kingdom</h1>
      <p>
        Engineer Kingdom is a free, professional learning platform built for Indian engineering students
        and professionals who want to upskill with AI and modern technology.
      </p>
      <p>
        We believe every engineer in India deserves access to world-class learning resources —
        without paying thousands of rupees for courses. Our platform curates the best free video
        classes, audio lessons, and learning resources from across the internet, organized into
        clear, structured paths.
      </p>
      <p>
        Whether you want to become an AI Engineer, Full Stack Developer, Data Engineer, DevOps
        specialist, Cybersecurity expert, or IoT Engineer — we have a path for you. Each learning
        path is designed around real job requirements from top tech companies.
      </p>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2rem', marginBottom: '1rem' }}>
        Our Mission
      </h2>
      <p>
        To empower every Indian engineer with the skills they need to succeed in the AI era —
        completely free of cost. No premium tiers, no hidden charges, no barriers.
      </p>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2rem', marginBottom: '1rem' }}>
        Get in Touch
      </h2>
      <p>
        Have suggestions, want to contribute resources, or found a broken link?
        Reach out to us at <a href="mailto:engineermade@gmail.com" style={{ color: 'var(--accent-light)' }}>engineermade@gmail.com</a>
      </p>
    </div>
  );
}

export default About;
