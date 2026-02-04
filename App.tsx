import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Pipeline from './views/Pipeline';
import ClosedDeals from './views/ClosedDeals';
import Clients from './views/Clients';
import Tasks from './views/Tasks';
import Staff from './views/Staff';
import Freelancers from './views/Freelancers';
import Files from './views/Files';
import Dashboard from './views/Dashboard';
import Auth from './views/Auth';
import { ThemeProvider } from './components/ThemeContext';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from './types';
import { Menu, Zap } from 'lucide-react';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Single Source of Truth for Auth State
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      // If no user is detected, immediately clear profile and stop initialization
      if (!firebaseUser) {
        setProfile(null);
        setInitializing(false);
        setActiveTab('dashboard'); // Reset navigation state on logout
      }
    });
    return unsubAuth;
  }, []);

  // Profile Listener - only active when a user is logged in
  useEffect(() => {
    if (user) {
      const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        setInitializing(false);
      }, (err) => {
        console.error("Profile fetch error:", err);
        setInitializing(false);
      });
      return unsubProfile;
    }
  }, [user]);

  // Close sidebar when tab changes on mobile
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'pipeline': return <Pipeline />;
      case 'closed-deals': return <ClosedDeals />;
      case 'clients': return <Clients />;
      case 'tasks': return <Tasks />;
      case 'staff': return <Staff />;
      case 'freelancers': return <Freelancers />;
      case 'files': return <Files />;
      default: return <Dashboard />;
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-bg flex flex-col items-center justify-center">
        <Zap className="w-12 h-12 text-brand-pink animate-pulse mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Authenticating Rubi Identity...</p>
      </div>
    );
  }

  // Redirect/Show Auth if user is null
  if (!user) {
    return <Auth />;
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] dark:bg-dark-bg transition-colors">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        profile={profile}
      />

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[40] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="lg:hidden h-16 flex items-center justify-between px-4 bg-white dark:bg-dark-card border-b border-gray-100 dark:border-dark-border sticky top-0 z-[30]">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-brand-pink tracking-tight">RUBI</h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-500 hover:text-brand-pink transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-[1600px] mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <AppContent />
  </ThemeProvider>
);

export default App;