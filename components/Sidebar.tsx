import React from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CheckSquare, 
  UserCircle, 
  Zap, 
  FileText,
  Sun,
  Moon,
  X,
  Archive,
  LogOut
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { UserProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  profile?: UserProfile | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose, profile }) => {
  const { theme, toggleTheme } = useTheme();
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pipeline', label: 'Pipeline', icon: Zap },
    { id: 'closed-deals', label: 'Closed Deals', icon: Archive },
    { id: 'clients', label: 'Clients', icon: Briefcase },
    { id: 'tasks', label: 'To Do', icon: CheckSquare },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'freelancers', label: 'Freelancers', icon: UserCircle },
    { id: 'files', label: 'Files', icon: FileText },
  ];

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to log out of the Rubi Command Centre?')) {
      try {
        // This triggers the onAuthStateChanged listener in App.tsx
        await signOut(auth);
      } catch (error) {
        console.error("Sign out error:", error);
        alert("Failed to sign out. Please try again.");
      }
    }
  };

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-[50] w-64 bg-white dark:bg-dark-card border-r border-gray-100 dark:border-dark-border 
    transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    flex flex-col h-screen
  `;

  return (
    <div className={sidebarClasses}>
      <div className="p-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-pink tracking-tight">RUBI</h1>
          <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-1 uppercase">Agency Command</p>
        </div>
        <button onClick={onClose} className="lg:hidden p-2 text-gray-400 hover:text-brand-pink transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-brand-pinkLight dark:bg-brand-pink/10 text-brand-pink' 
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-bg hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-brand-pink' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-100 dark:border-dark-border space-y-3">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-dark-bg rounded-xl transition-all"
        >
          <div className="flex items-center">
            {theme === 'light' ? <Moon className="w-4 h-4 mr-3" /> : <Sun className="w-4 h-4 mr-3" />}
            <span className="truncate">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <div className={`w-10 h-5 rounded-full relative shrink-0 transition-colors ${theme === 'dark' ? 'bg-brand-pink' : 'bg-gray-300'}`}>
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-6' : 'left-1'}`} />
          </div>
        </button>

        <div className="flex items-center p-3 rounded-2xl bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-pink flex items-center justify-center text-white font-black text-sm shadow-sm">
            {profile?.email?.charAt(0).toUpperCase() || 'R'}
          </div>
          <div className="ml-3 truncate flex-1">
            <p className="text-xs font-black text-gray-900 dark:text-white truncate">
              {profile?.linked ? 'Squad Member' : 'Guest User'}
            </p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">
              {profile?.email || 'User Account'}
            </p>
          </div>
          <button 
            onClick={handleSignOut}
            className="p-2.5 text-gray-400 hover:text-brand-pink hover:bg-white dark:hover:bg-dark-card rounded-xl transition-all"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;