import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  browserLocalPersistence,
  setPersistence,
  getRedirectResult,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  Auth,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp, Firestore } from 'firebase/firestore';
import { auth as firebaseAuth, db as firebaseDb } from '../firebase';

export interface LearnerProfile {
  name: string;
  username: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  collegeName: string;
  educationStatus: 'UG' | 'PG' | 'Graduated';
  careerPathId: string;
  percentage?: number;
}

export interface SavedBookmark {
  id: string;
  title: string;
  url: string;
  pathId?: string;
  lessonId?: string;
  savedAt: string;
}

export interface AssessmentAttempt {
  id: string;
  score: number;
  level: string;
  completedAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  markLessonComplete: (pathId: string, lessonId: string) => Promise<void>;
  completedLessons: string[];
  profile: LearnerProfile | null;
  saveProfile: (profile: LearnerProfile) => Promise<void>;
  bookmarks: SavedBookmark[];
  saveBookmark: (bookmark: Omit<SavedBookmark, 'id' | 'savedAt'>) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  assessmentAttempts: AssessmentAttempt[];
  recordAssessment: (score: number, level: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookmarks, setBookmarks] = useState<SavedBookmark[]>([]);
  const [assessmentAttempts, setAssessmentAttempts] = useState<AssessmentAttempt[]>([]);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    let unsubscribe = () => {};
    let active = true;

    async function loadUserData(u: User | null) {
      if (!active) return;
      setUser(u);
      if (u) {
        try {
          const token = await u.getIdTokenResult();
          const allowedEmails = (process.env.REACT_APP_ADMIN_EMAILS || '')
            .split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
          const allowlistedEmail = !!u.email && allowedEmails.includes(u.email.trim().toLowerCase());
          setIsAdmin(token.claims.admin === true || allowlistedEmail);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      if (u && firebaseDb) {
        try {
          const userRef = doc(firebaseDb as Firestore, 'users', u.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setCompletedLessons(userDoc.data().completedLessons || []);
            setProfile(userDoc.data().profile || null);
            setBookmarks(Array.isArray(userDoc.data().savedBookmarks) ? userDoc.data().savedBookmarks : []);
            setAssessmentAttempts(Array.isArray(userDoc.data().assessmentAttempts) ? userDoc.data().assessmentAttempts : []);
            await updateDoc(userRef, { lastActiveAt: serverTimestamp() });
          } else {
            await setDoc(userRef, {
              name: u.displayName || '', email: u.email || '',
              completedLessons: [], createdAt: serverTimestamp(), lastActiveAt: serverTimestamp(),
            });
            setCompletedLessons([]);
            setProfile(null);
            setBookmarks([]);
            setAssessmentAttempts([]);
          }
        } catch (error) {
          console.error('Could not load learner profile:', error);
        }
      } else {
        setCompletedLessons([]);
        setProfile(null);
        setBookmarks([]);
        setAssessmentAttempts([]);
      }
      if (active) setLoading(false);
    }

    // Subscribe first. A redirect-result lookup can stall in embedded browsers,
    // but Firebase's persisted user state should still unlock the application.
    unsubscribe = onAuthStateChanged(firebaseAuth as Auth, loadUserData);

    async function consumeRedirectResult() {
      try {
        const redirectResult = await Promise.race([
          getRedirectResult(firebaseAuth as Auth),
          new Promise<null>(resolve => window.setTimeout(() => resolve(null), 5000)),
        ]);
        if (redirectResult?.user) await loadUserData(redirectResult.user);
      } catch (error) {
        console.error('Google redirect sign-in failed:', error);
      }
    }

    consumeRedirectResult();
    return () => { active = false; unsubscribe(); };
  }, []);

  // A recent heartbeat lets the private admin portal distinguish signed-in
  // learners who are active now from historical account records.
  useEffect(() => {
    if (!user || !firebaseDb) return;
    const touchActivity = () => updateDoc(doc(firebaseDb as Firestore, 'users', user.uid), {
      lastActiveAt: serverTimestamp(),
    }).catch(() => undefined);
    touchActivity();
    const heartbeat = window.setInterval(touchActivity, 60_000);
    return () => window.clearInterval(heartbeat);
  }, [user]);

  async function signup(email: string, password: string, name: string) {
    if (!firebaseAuth) throw new Error('Auth not configured');
    const cred = await createUserWithEmailAndPassword(firebaseAuth as Auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    setUser(cred.user);
    if (firebaseDb) {
      try {
        await setDoc(doc(firebaseDb as Firestore, 'users', cred.user.uid), {
          name, email, completedLessons: [], createdAt: serverTimestamp(),
        });
      } catch { /* Firestore not configured yet */ }
    }
  }

  async function login(email: string, password: string) {
    if (!firebaseAuth) throw new Error('Auth not configured');
    const cred = await signInWithEmailAndPassword(firebaseAuth as Auth, email, password);
    setUser(cred.user);
  }

  async function loginWithGoogle() {
    if (!firebaseAuth) throw new Error('Auth not configured');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await setPersistence(firebaseAuth as Auth, browserLocalPersistence);
    try {
      const credential = await signInWithPopup(firebaseAuth as Auth, provider);
      setUser(credential.user);
    } catch (error: any) {
      const fallbackCodes = [
        'auth/popup-blocked', 'auth/operation-not-supported-in-this-environment',
        'auth/cancelled-popup-request', 'auth/web-storage-unsupported',
      ];
      const isEmbeddedFailure = error?.message?.includes('Pending promise was never set');
      if (!fallbackCodes.includes(error?.code) && !isEmbeddedFailure) throw error;
      await signInWithRedirect(firebaseAuth as Auth, provider);
    }
  }

  async function logout() {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth as Auth);
  }

  async function markLessonComplete(pathId: string, lessonId: string) {
    if (!user) return;
    const key = `${pathId}:${lessonId}`;
    if (completedLessons.includes(key)) return;
    setCompletedLessons(prev => [...prev, key]);
    if (firebaseDb) {
      try {
        await updateDoc(doc(firebaseDb as Firestore, 'users', user.uid), {
          completedLessons: arrayUnion(key),
        });
      } catch { /* Firestore not configured yet */ }
    }
  }

  async function saveProfile(nextProfile: LearnerProfile) {
    if (!user || !firebaseDb) throw new Error('Please sign in before saving your profile.');
    await setDoc(doc(firebaseDb as Firestore, 'users', user.uid), {
      name: nextProfile.name,
      email: nextProfile.email,
      profile: nextProfile,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (nextProfile.name !== user.displayName) {
      await updateProfile(user, { displayName: nextProfile.name });
    }
    setProfile(nextProfile);
  }

  async function persistLearningData(nextBookmarks: SavedBookmark[], nextAttempts: AssessmentAttempt[]) {
    setBookmarks(nextBookmarks);
    setAssessmentAttempts(nextAttempts);
    if (!user || !firebaseDb) return;
    await setDoc(doc(firebaseDb as Firestore, 'users', user.uid), {
      savedBookmarks: nextBookmarks,
      assessmentAttempts: nextAttempts,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async function saveBookmark(bookmark: Omit<SavedBookmark, 'id' | 'savedAt'>) {
    if (!user) throw new Error('Please sign in to save a course.');
    const alreadySaved = bookmarks.some(item => item.url === bookmark.url);
    if (alreadySaved) return;
    const next = [{ ...bookmark, id: `bookmark-${Date.now()}`, savedAt: new Date().toISOString() }, ...bookmarks].slice(0, 200);
    await persistLearningData(next, assessmentAttempts);
  }

  async function removeBookmark(bookmarkId: string) {
    await persistLearningData(bookmarks.filter(item => item.id !== bookmarkId), assessmentAttempts);
  }

  async function recordAssessment(score: number, level: string) {
    if (!user) throw new Error('Please sign in to save an assessment.');
    const attempt = { id: `assessment-${Date.now()}`, score, level, completedAt: new Date().toISOString() };
    await persistLearningData(bookmarks, [attempt, ...assessmentAttempts].slice(0, 25));
  }

  async function sendVerificationEmail() {
    if (!firebaseAuth?.currentUser) throw new Error('Please sign in before requesting verification.');
    if (!firebaseAuth.currentUser.emailVerified) await sendEmailVerification(firebaseAuth.currentUser);
  }

  async function sendPasswordReset(email: string) {
    if (!firebaseAuth) throw new Error('Auth not configured');
    await sendPasswordResetEmail(firebaseAuth as Auth, email.trim());
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, signup, loginWithGoogle, logout, markLessonComplete, completedLessons, profile, saveProfile, bookmarks, saveBookmark, removeBookmark, assessmentAttempts, recordAssessment, sendVerificationEmail, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}
