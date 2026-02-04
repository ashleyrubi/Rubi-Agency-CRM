import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Lead, Client, Task, Staff } from '../types';
import { TrendingUp, Users, CheckCircle, Briefcase, Zap, Star } from 'lucide-react';
import { PageHeader, StatCard, Card, Button, PermissionError } from '../components/UI';

const Dashboard: React.FC = () => {
  const [hasError, setHasError] = useState(false);
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
      // Only count revenue for active leads and won leads? Let's keep it as active pipeline value as requested
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
      setStats(prev => ({ ...prev, tasks: snap.size }));
    }, handleError);

    const unsubS = onSnapshot(collection(db, 'staff'), (snap) => {
      setStats(prev => ({ ...prev, staff: snap.size }));
    }, handleError);
    
    return () => { unsubL(); unsubC(); unsubT(); unsubS(); };
  }, []);

  if (hasError) return <div className="p-4 md:p-10"><PageHeader title="Rubi Command" /><PermissionError /></div>;

  return (
    <div className="p-4 md:p-10">
      <PageHeader 
        title="Rubi Command" 
        description="Creativity is intelligence having fun."
        actions={<Button icon={Star} variant="outline" size="sm">Quick Star</Button>}
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
              {[
                { label: 'Lead Velocity', sub: 'Movement speed', value: '+12%', color: 'text-brand-pink' },
                { label: 'Utilisation', sub: 'Team workload', value: '84%', color: 'text-blue-600' },
                { label: 'Throughput', sub: 'Delivery rate', value: '92%', color: 'text-green-600' }
              ].map((item, i) => (
                <div key={i} className="p-4 md:p-5 rounded-2xl bg-gray-50 dark:bg-dark-bg flex items-center justify-between border border-gray-100/50 dark:border-dark-border/50">
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 dark:text-white text-base md:text-lg truncate">{item.label}</p>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{item.sub}</p>
                  </div>
                  <span className={`${item.color} font-black text-xl md:text-2xl ml-4`}>{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="bg-gray-900 dark:bg-brand-pink text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl md:text-2xl font-black mb-2">Team Core</h3>
            <p className="text-gray-400 dark:text-brand-pinkLight font-bold uppercase text-[9px] md:text-[10px] tracking-widest">Global Roster</p>
            <p className="text-5xl md:text-6xl font-black mt-4 md:mt-6 tracking-tighter">{stats.staff}</p>
            <p className="text-sm font-medium mt-4 text-gray-400 dark:text-brand-pinkLight">
              The internal engine powering Rubi Agency's creative excellence.
            </p>
          </div>
          <div className="mt-8 md:mt-12">
            <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white hover:text-gray-900" size="lg">Manage Staff</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;