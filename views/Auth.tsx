import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  collection, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { Zap, Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button, Input, Card } from '../components/UI';

const Auth: React.FC = () => {
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const performLinking = async (uid: string, userEmail: string) => {
    const staffQuery = query(
      collection(db, 'staff'), 
      where('email', '==', userEmail.trim().toLowerCase())
    );
    
    const staffSnap = await getDocs(staffQuery);
    let staffId: string | null = null;
    let linked = false;
    let role = 'User';

    if (!staffSnap.empty) {
      const staffDoc = staffSnap.docs[0];
      const staffData = staffDoc.data();
      staffId = staffDoc.id;
      linked = true;
      role = staffData.jobRole || staffData.role || 'Staff';

      await updateDoc(doc(db, 'staff', staffId), {
        userId: uid,
        linked: true,
        linkedAt: serverTimestamp()
      });
    }

    await setDoc(doc(db, 'users', uid), {
      uid,
      email: userEmail.toLowerCase(),
      staffId,
      linked,
      role,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });

    return { linked, role };
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Reset link sent! Please check your inbox.');
      setTimeout(() => setAuthMode('signIn'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (authMode === 'forgotPassword') {
      return handleForgotPassword(e);
    }

    if (authMode === 'signUp' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (authMode === 'signUp') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const { linked } = await performLinking(userCredential.user.uid, email);
        
        if (linked) {
          setSuccessMessage('Account created and linked to your staff profile automatically.');
        } else {
          setSuccessMessage('Account created. This user is not linked to a staff profile yet.');
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await performLinking(userCredential.user.uid, email);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-dark-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-pink/10 rounded-3xl mb-4">
            <Zap className="w-8 h-8 text-brand-pink" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight italic">RUBI</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-2">Agency Intelligence Command</p>
        </div>

        <Card className="p-8 shadow-2xl border-none">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
              {authMode === 'signIn' ? 'Welcome Back' : 
               authMode === 'signUp' ? 'Create Squad Account' : 
               'Reset Password'}
            </h2>
            {authMode === 'forgotPassword' && (
              <button 
                onClick={() => setAuthMode('signIn')}
                className="p-2 text-gray-400 hover:text-brand-pink transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  type="email" 
                  placeholder="name@rubi.agency" 
                  required 
                  className="pl-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {authMode !== 'forgotPassword' && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Password</label>
                    {authMode === 'signIn' && (
                      <button 
                        type="button"
                        onClick={() => setAuthMode('forgotPassword')}
                        className="text-[10px] font-black text-brand-pink hover:underline uppercase tracking-widest"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      required 
                      className="pl-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {authMode === 'signUp' && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        required 
                        className="pl-12"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-600 dark:text-red-400 leading-relaxed">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-green-600 dark:text-green-400 leading-relaxed">{successMessage}</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-14" 
              disabled={loading}
              icon={authMode === 'signUp' ? UserPlus : authMode === 'forgotPassword' ? Mail : LogIn}
            >
              {loading ? 'Processing...' : 
               authMode === 'signIn' ? 'Sign In' : 
               authMode === 'signUp' ? 'Sign Up' : 
               'Send Reset Link'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-dark-border text-center">
            <button 
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn');
              }}
              className="text-sm font-black text-gray-400 hover:text-brand-pink transition-colors uppercase tracking-widest"
            >
              {authMode === 'signIn' ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
            </button>
          </div>
        </Card>

        <p className="text-center mt-10 text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-40">
          Managed Secure Access Portal v3.1
        </p>
      </div>
    </div>
  );
};

export default Auth;