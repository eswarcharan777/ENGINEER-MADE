import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-brand">
          <h3>Engineer Kingdom</h3>
          <p>Empowering every Indian engineer to learn, build, and grow with AI-powered education. Free, professional, and accessible to all.</p>
        </div>
        <div className="footer-col">
          <h4>Learning</h4>
          <Link to="/paths">All Paths</Link>
          <Link to="/paths/ai-engineer">AI Engineer</Link>
          <Link to="/paths/fullstack-engineer">Full Stack</Link>
          <Link to="/paths/data-engineer">Data Engineer</Link>
        </div>
        <div className="footer-col">
          <h4>More Paths</h4>
          <Link to="/paths/devops-engineer">DevOps</Link>
          <Link to="/paths/cybersecurity-engineer">Cybersecurity</Link>
          <Link to="/paths/embedded-iot-engineer">Embedded / IoT</Link>
        </div>
        <div className="footer-col">
          <h4>Company</h4>
          <Link to="/about">About Us</Link>
          <a href="mailto:engineermade@gmail.com">Contact</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>&copy; {new Date().getFullYear()} Engineer Kingdom. All rights reserved.</span>
        <span>
          3D castle: <a href="https://sketchfab.com/3d-models/fantasy-castle-1b3756460dde44399fd7b9bb3b78127c" target="_blank" rel="noreferrer">Fantasy Castle</a>
          {' '}by Toni García Vilche · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
        </span>
      </div>
    </footer>
  );
}

export default Footer;
