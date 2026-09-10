import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AppErrorBoundary from './components/AppErrorBoundary';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';
import Home from './pages/Home';
import Paths from './pages/Paths';
import PathDetail from './pages/PathDetail';
import LessonPlayer from './pages/LessonPlayer';
import About from './pages/About';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProfileSetup from './pages/ProfileSetup';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import AdminAccess from './pages/AdminAccess';
import LearningHub from './pages/LearningHub';
import Seo from './components/Seo';
import Forbidden from './pages/Forbidden';
import NotFound from './pages/NotFound';
import ServiceUnavailable from './pages/ServiceUnavailable';
import CertificateVerify from './pages/CertificateVerify';
import './App.css';

function AppShell() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isAdminPortal = location.pathname === '/admin' || location.pathname === '/admin-access';
  return <div className={`app ${isDashboard ? 'dashboard-app' : ''} ${isAdminPortal ? 'admin-app' : ''}`}>
    <Seo />
    {!isDashboard && !isAdminPortal && <Navbar />}
    <main className="main-content">
      <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/paths" element={<Paths />} />
              <Route path="/paths/:pathId" element={<PathDetail />} />
              <Route path="/learn/:pathId/:moduleId/:lessonId" element={<LessonPlayer />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route element={<RequireAuth />}>
                <Route path="/profile" element={<ProfileSetup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/hub" element={<LearningHub />} />
              </Route>
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
              <Route path="/admin-access" element={<AdminAccess />} />
              <Route path="/forbidden" element={<Forbidden />} />
              <Route path="/service-unavailable" element={<ServiceUnavailable />} />
              <Route path="/verify-certificate" element={<CertificateVerify />} />
              <Route path="/verify-certificate/:code" element={<CertificateVerify />} />
              <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    {!isDashboard && !isAdminPortal && <Footer />}
  </div>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppErrorBoundary><AppShell /></AppErrorBoundary>
      </Router>
    </AuthProvider>
  );
}

export default App;
