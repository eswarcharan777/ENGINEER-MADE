import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LearnerProfile, useAuth } from '../contexts/AuthContext';

const API = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000');

const emptyProfile: LearnerProfile = {
  name: '', username: '', email: '', phone: '', age: 18, gender: '',
  collegeName: '', educationStatus: 'UG', careerPathId: '',
};

// Onboarding must not become a dead end if a deployment's API is temporarily
// restarting. These IDs exactly match the server catalogue, so selecting one
// remains valid when the API returns.
const roadmapFallback = [
  ['ai-engineer', 'AI / ML Engineer', '🤖'], ['fullstack-engineer', 'Full Stack Engineer', '⚡'],
  ['data-engineer', 'Data Engineer', '📊'], ['devops-engineer', 'DevOps / Cloud Engineer', '☁️'],
  ['cybersecurity-engineer', 'Cybersecurity Engineer', '🔒'], ['embedded-iot-engineer', 'Embedded / IoT Engineer', '🔌'],
  ['mechanical-engineer', 'Mechanical Engineer', '⚙️'], ['civil-engineer', 'Civil Engineer', '🏗️'],
  ['electrical-engineer', 'Electrical Engineer', '⚡'], ['electronics-engineer', 'Electronics & Communication Engineer', '📡'],
  ['chemical-engineer', 'Chemical Engineer', '🧪'], ['aerospace-engineer', 'Aerospace Engineer', '🚀'],
  ['robotics-engineer', 'Robotics Engineer', '🦾'], ['automotive-engineer', 'Automotive Engineer', '🚗'],
  ['biomedical-engineer', 'Biomedical Engineer', '🫀'],
].map(([id, title, icon]) => ({ id, title, icon }));

export default function ProfileSetup() {
  const { user, loading: authLoading, profile, saveProfile, sendVerificationEmail } = useAuth();
  const [form, setForm] = useState<LearnerProfile>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [verificationNotice, setVerificationNotice] = useState('');
  const [roadmaps, setRoadmaps] = useState<{ id: string; title: string; icon?: string }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) setForm({ ...emptyProfile, ...profile, name: profile?.name || user.displayName || '', email: user.email || profile?.email || '' });
  }, [user, profile]);

  useEffect(() => {
    axios.get(`${API}/api/paths`)
      .then(response => setRoadmaps(response.data.paths?.length ? response.data.paths : roadmapFallback))
      .catch(() => setRoadmaps(roadmapFallback));
  }, []);

  if (authLoading) return <div className="loading"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const update = (field: keyof LearnerProfile, value: string | number) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) {
      setError('Username must be 3–20 characters using letters, numbers, or underscores.'); return;
    }
    if (!/^\+?[0-9]{10,15}$/.test(form.phone.replace(/\s/g, ''))) {
      setError('Enter a valid 10–15 digit phone number.'); return;
    }
    if (form.age < 15 || form.age > 100) { setError('Age must be between 15 and 100.'); return; }
    if (!form.careerPathId) { setError('Choose the engineering role you want to prepare for.'); return; }
    if (form.educationStatus === 'Graduated' && (form.percentage === undefined || form.percentage < 0 || form.percentage > 100)) {
      setError('Graduation percentage must be between 0 and 100.'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, phone: form.phone.replace(/\s/g, '') };
      if (payload.educationStatus !== 'Graduated') delete payload.percentage;
      await saveProfile(payload);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Could not save your profile. Please try again.');
    } finally { setSaving(false); }
  }

  async function resendVerification() {
    setError(''); setVerificationNotice('');
    try {
      await sendVerificationEmail();
      setVerificationNotice('Verification email sent. Open it and then refresh this page.');
    } catch (err: any) {
      setError(err?.code?.includes('too-many-requests') ? 'Please wait before requesting another verification email.' : 'Could not send the verification email.');
    }
  }

  return (
    <div className="profile-page">
      <form className="profile-card" onSubmit={submit}>
        <div className="profile-form-header"><span>YOUR LEARNER PROFILE</span><h1>{profile?.careerPathId ? 'Update your roadmap' : 'Tell us about yourself'}</h1><p>Choose one engineering role. Your dashboard will focus on that roadmap only.</p></div>
        {error && <div className="auth-error">{error}</div>}
        {!user.emailVerified && <div className="auth-success" role="status">Verify your email to secure this account. <button type="button" className="auth-link-button" onClick={resendVerification}>Send verification email</button></div>}
        {verificationNotice && <div className="auth-success" role="status">{verificationNotice}</div>}
        <div className="profile-grid">
          <label><span>Full name</span><input value={form.name} onChange={e => update('name', e.target.value)} required /></label>
          <label><span>Username</span><input value={form.username} onChange={e => update('username', e.target.value)} placeholder="engineer_name" required /></label>
          <label><span>Email</span><input type="email" value={form.email} readOnly /></label>
          <label><span>Phone number</span><input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 9876543210" required /></label>
          <label><span>Age</span><input type="number" min="15" max="100" value={form.age} onChange={e => update('age', Number(e.target.value))} required /></label>
          <label><span>Gender</span><select value={form.gender} onChange={e => update('gender', e.target.value)} required><option value="">Select</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></label>
          <label className="full-width"><span>College name</span><input value={form.collegeName} onChange={e => update('collegeName', e.target.value)} required /></label>
          <label><span>Education status</span><select value={form.educationStatus} onChange={e => update('educationStatus', e.target.value)}><option value="UG">Undergraduate (UG)</option><option value="PG">Postgraduate (PG)</option><option value="Graduated">Graduated</option></select></label>
          <label><span>Engineering role / roadmap</span><select value={form.careerPathId} onChange={e => update('careerPathId', e.target.value)} required><option value="">Select your target role</option>{roadmaps.map(roadmap => <option key={roadmap.id} value={roadmap.id}>{roadmap.icon ? `${roadmap.icon} ` : ''}{roadmap.title}</option>)}</select></label>
          {form.educationStatus === 'Graduated' && <label><span>Graduation percentage</span><input type="number" min="0" max="100" step="0.01" value={form.percentage ?? ''} onChange={e => update('percentage', Number(e.target.value))} required /></label>}
        </div>
        <button className="btn btn-primary profile-submit" disabled={saving}>{saving ? 'Saving profile…' : 'Save and explore roadmaps'}</button>
      </form>
    </div>
  );
}
