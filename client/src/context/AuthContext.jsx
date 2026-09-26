import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';

const AuthContext = createContext(null);

/** The shop owner. Sees every product and every enquiry. */
const OWNER_EMAIL = 'kunalkalia261085@gmail.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!auth) return undefined;
    const off = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return off;
  }, []);

  const value = {
    ready,
    configured: isFirebaseConfigured,
    user,
    isOwner: user?.email?.toLowerCase() === OWNER_EMAIL,
    ownerEmail: OWNER_EMAIL,

    async signIn(email, password) {
      if (!auth) throw new Error('Firebase is not configured yet.');
      await signInWithEmailAndPassword(auth, email, password);
    },

    async signUp(name, email, password) {
      if (!auth) throw new Error('Firebase is not configured yet.');
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });
      return cred.user;
    },

    async resetPassword(email) {
      if (!auth) throw new Error('Firebase is not configured yet.');
      await sendPasswordResetEmail(auth, email);
    },

    async signOut() {
      if (auth) await fbSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
