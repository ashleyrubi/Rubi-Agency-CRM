import React from 'react';
import { LucideIcon, Search, X, AlertTriangle, Lock } from 'lucide-react';

// --- Page Header ---
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-4">
    <div>
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">{title}</h2>
      {description && <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium text-sm md:text-base">{description}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2 md:gap-3">{actions}</div>
  </div>
);

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
}
export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', size = 'md', icon: Icon, className = '', type = 'button', ...props 
}) => {
  const variants = {
    primary: 'bg-brand-pink text-white hover:bg-brand-pinkDark shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-dark-border dark:text-white dark:hover:bg-gray-700',
    outline: 'bg-transparent border-2 border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-dark-border dark:text-gray-400 dark:hover:bg-dark-card',
    ghost: 'bg-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
  };
  const sizes = {
    sm: children ? 'px-3 py-1.5 text-xs font-bold min-h-[36px]' : 'p-2 text-xs font-bold min-h-[36px] min-w-[36px]',
    md: children ? 'px-5 py-2.5 text-sm font-bold min-h-[44px]' : 'p-3 text-sm font-bold min-h-[44px] min-w-[44px]',
    lg: children ? 'px-8 py-4 text-lg font-black min-h-[56px]' : 'p-4 text-lg font-black min-h-[56px] min-w-[56px]'
  };
  return (
    <button 
      type={type}
      className={`inline-flex items-center justify-center rounded-xl transition-all duration-200 whitespace-nowrap ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {Icon && <Icon className={`w-4 h-4 md:w-5 md:h-5 ${children ? 'mr-2' : ''}`} />}
      {children}
    </button>
  );
};

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl shadow-sm ${className}`}>
    {children}
  </div>
);

// --- Table ---
export const Table: React.FC<{ headers: string[]; children: React.ReactNode; className?: string }> = ({ headers, children, className = '' }) => (
  <div className="relative">
    <div className={`overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-dark-border ${className}`}>
      <table className="w-full text-left table-auto">
        <thead>
          <tr className="bg-gray-50/50 dark:bg-dark-card border-b border-gray-100 dark:border-dark-border">
            {headers.map((h, i) => (
              <th key={i} className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-dark-border">
          {children}
        </tbody>
      </table>
    </div>
    {/* Small visual indicator for scroll on mobile */}
    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/50 to-transparent pointer-events-none lg:hidden dark:from-dark-card/50" />
  </div>
);

// --- Input / Select / Textarea ---
const baseInputStyle = "w-full px-4 py-3 bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded-xl focus:ring-2 focus:ring-brand-pink focus:outline-none font-bold text-sm text-gray-900 dark:text-white transition-all appearance-none";

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input className={baseInputStyle} {...props} />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select className={baseInputStyle} {...props} />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
  <textarea className={`${baseInputStyle} min-h-[100px] font-medium`} {...props} />
);

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-10 animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-dark-card rounded-3xl w-full ${sizes[size]} shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200`}>
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-bg/50 shrink-0">
          <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// --- Empty State ---
export const EmptyState: React.FC<{ icon: LucideIcon; message: string; submessage?: string }> = ({ icon: Icon, message, submessage }) => (
  <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center px-4">
    <Icon className="w-12 h-12 md:w-16 md:h-16 text-gray-200 dark:text-gray-800 mb-4" />
    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{message}</h3>
    {submessage && <p className="text-sm text-gray-400 mt-1 max-w-xs">{submessage}</p>}
  </div>
);

// --- Permission Error ---
export const PermissionError: React.FC = () => (
  <Card className="p-6 md:p-12 border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/5">
    <div className="flex flex-col items-center text-center">
      <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-6">
        <Lock className="w-6 h-6 md:w-8 md:h-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2">Access Denied</h3>
      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-md mb-8">
        Firestore security rules are blocking the data request. 
      </p>
      <div className="bg-white dark:bg-dark-bg p-4 rounded-xl border border-red-100 dark:border-dark-border text-left w-full overflow-hidden">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Suggested Rule Fix:</p>
        <pre className="text-[9px] font-mono text-red-600 dark:text-red-400 overflow-x-auto bg-gray-50 dark:bg-dark-card p-2 rounded">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
        </pre>
      </div>
    </div>
  </Card>
);

// --- Stat Card ---
export const StatCard: React.FC<{ label: string; value: string; icon: LucideIcon; color: string }> = ({ label, value, icon: Icon, color }) => (
  <Card className="p-5 md:p-6 flex items-center">
    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${color} flex items-center justify-center mr-4 md:mr-5 shrink-0`}>
      <Icon className="w-6 h-6 md:w-7 md:h-7" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest truncate">{label}</p>
      <p className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mt-0.5 truncate">{value}</p>
    </div>
  </Card>
);