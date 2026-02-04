import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Lead, Client, Task, Staff } from '../types';
import { TrendingUp, Users, CheckCircle, Briefcase, Zap, Star } from 'lucide-react';
import { PageHeader, StatCard, Card, Button, PermissionError } from '../components/UI';

interface DashboardProps {
  onNavigateTasks?: (filters: { 
    status?: string[]; 
    searchTerm?: string; 
    special?: 'overdue' | 'today' | 'unassigned' | 'assignedInProgress' | null 
  }) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateTasks }) => {
  const [hasError, setHasError] = useState(false);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    leads: 0,
    clients: 0,
    tasks: 0,
    staff: 0,
    revenue: 0
  });

  useEffect(() => {
    const handleError = (err: any) => {
      if (err.code === 'permission-denied') setHasError(true);
    };

    const unsubL = onSnapshot(collection(db, 'leads'), (snap) => {
      const leads = snap.docs.map(d => d.data() as Lead);
      const activeRevenue = leads
        .filter(l => !l.closedAt)
        .reduce((acc, l) => acc + (Number(l.value) || 0), 0);
      setStats(prev => ({ 
        ...prev, 
        leads: snap.docs.filter(d => !d.data().closedAt).length, 
        revenue: activeRevenue 
      }));
    }, handleError);

    const unsubC = onSnapshot(collection(db, 'clients'), (snap) => {
      setStats(prev => ({ ...prev, clients: snap.size }));
    }, handleError);

    const unsubT = onSnapshot(collection(db, 'clientTasks'), (snap) => {
      const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setAllTasks(tasks);
      setStats(prev => ({ ...prev, tasks: snap.size }));
    }, handleError);

    const unsubS = onSnapshot(collection(db, 'staff'), (snap) => {
      setStats(prev => ({ ...prev, staff: snap.size }));
    }, handleError);
    
    return () => { unsubL(); unsubC(); unsubT(); unsubS(); };
  }, []);

  const performanceMetrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const dueToday = allTasks.filter(t => t.dueDate === today && t.inProgress !== 'Complete').length;
    const overdue = allTasks.filter(t => t.dueDate && t.dueDate < today && t.inProgress !== 'Complete').length;
    const unassigned = allTasks.filter(t => (!t.who || t.who.length === 0) && t.inProgress !== 'Complete').length;
    const activeAssigned = allTasks.filter(t => t.who && t.who.length > 0 && t.inProgress !== 'Complete').length;

    return { dueToday, overdue, unassigned, activeAssigned };
  }, [allTasks]);

  if (hasError) return <div className="p-4 md:p-10"><PageHeader title="Rubi Command" /><PermissionError /></div>;

  return (
    <div className="p-4 md:p-10">
      <PageHeader 
        title="Rubi Command" 
        description="Creativity is intelligence having fun."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
        <StatCard icon={TrendingUp} label="Pipeline" value={`£${(stats.revenue/1000).toFixed(0)}k`} color="bg-brand-pinkLight dark:bg-brand-pink/20 text-brand-pink" />
        <StatCard icon={Users} label="Clients" value={stats.clients.toString()} color="bg-blue-100 dark:bg-blue-900/20 text-blue-600" />
        <StatCard icon={CheckCircle} label="To Do" value={stats.tasks.toString()} color="bg-green-100 dark:bg-green-900/20 text-green-600" />
        <StatCard icon={Zap} label="Active Leads" value={stats.leads.toString()} color="bg-amber-100 dark:bg-amber-900/20 text-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2">
          <Card className="p-6 md:p-8 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 hidden sm:block">
              <Briefcase className="w-32 h-32" />
            </div>
            <h3 className="text-xl md:text-2xl font-black mb-6 md:mb-8 flex items-center dark:text-white">
              <Star className="w-5 h-5 md:w-6 md:h-6 mr-3 text-brand-pink fill-current" />
              Agency Performance
            </h3>
            <div className="space-y-4 md:space-y-6">
              <button 
                onClick={() => onNavigateTasks?.({ special: 'today' })}
                className="w-full p-4 md:p-5 rounded-2xl bg-gray-50 dark:bg-dark-bg flex items-center justify-between border border-gray-100/50 dark:border-dark-border/50 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-black text-gray-900 dark:text-white text-base md:text-lg truncate">Tasks due today</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5">Urgent deadlines</p>
                </div>
                <span className="text-brand-pink font-black text-2xl md:text-3xl ml-4">{performanceMetrics.dueToday}</span>
              </button>

              <button 
                onClick={() => onNavigateTasks?.({ special: 'overdue' })}
                className="w-full p-4 md:p-5 rounded-2xl bg-gray-50 dark:bg-dark-bg flex items-center justify-between border border-gray-100/50 dark:border-dark-border/50 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-black text-gray-900 dark:text-white text-base md:text-lg truncate">Overdue tasks</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5">Critical action needed</p>
                </div>
                <span className="text-red-600 font-black text-2xl md:text-3xl ml-4">{performanceMetrics.overdue}</span>
              </button>

              <button 
                onClick={() => onNavigateTasks?.({ special: 'unassigned' })}
                className="w-full p-4 md:p-5 rounded-2xl bg-gray-50 dark:bg-dark-bg flex items-center justify-between border border-gray-100/50 dark:border-dark-border/50 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-black text-gray-900 dark:text-white text-base md:text-lg truncate">Unassigned tasks</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5">Requires capacity check</p>
                </div>
                <span className="text-blue-600 font-black text-2xl md:text-3xl ml-4">{performanceMetrics.unassigned}</span>
              </button>
            </div>
          </Card>
        </div>

        <div className="bg-gray-900 dark:bg-brand-pink text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl md:text-2xl font-black mb-2">Team workload</h3>
            <p className="text-gray-400 dark:text-brand-pinkLight font-bold uppercase text-[9px] md:text-[10px] tracking-widest">Active Agency Volume</p>
            <p className="text-5xl md:text-6xl font-black mt-4 md:mt-6 tracking-tighter">{performanceMetrics.activeAssigned}</p>
            <p className="text-sm font-medium mt-4 text-gray-400 dark:text-brand-pinkLight">
              Tasks in progress across the team
            </p>
          </div>
          <div className="mt-8 md:mt-12">
            <Button 
              variant="outline" 
              className="w-full bg-white/10 border-white/20 text-white hover:bg-white hover:text-gray-900" 
              size="lg"
              onClick={() => onNavigateTasks?.({ special: 'assignedInProgress' })}
            >
              View tasks
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;