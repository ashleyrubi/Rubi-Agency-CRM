import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import { Lead, LeadStatus } from '../types';
import { 
  Plus, 
  Search, 
  Zap, 
  Building2, 
  Calendar, 
  Phone, 
  Mail, 
  MoreHorizontal,
  GripVertical,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Trash2,
  Clock
} from 'lucide-react';
import { 
  PageHeader, 
  Button, 
  Card, 
  Input, 
  Select, 
  Modal, 
  EmptyState, 
  PermissionError, 
  Textarea 
} from '../components/UI';

const PIPELINE_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Proposal'];
const CLOSED_STATUSES: LeadStatus[] = ['Won', 'Lost'];

const LeadCard: React.FC<{ 
  lead: Lead; 
  onDetails: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onMoveStatus: (leadId: string, newStatus: LeadStatus) => void;
}> = ({ lead, onDetails, onDelete, onDragStart, onMoveStatus }) => {
  const currentIndex = PIPELINE_STATUSES.indexOf(lead.status);
  
  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart(e, lead.id!)}
      className="group bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl p-5 lg:p-5 mb-4 shadow-sm hover:shadow-xl hover:border-brand-pink/30 hover:-translate-y-1 transition-all cursor-grab active:cursor-grabbing relative"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-brand-pink transition-colors hidden lg:block" />
          <div className="min-w-0">
            <h4 className="text-base font-black text-gray-900 dark:text-white truncate">
              {lead.name}
            </h4>
            <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
              <Building2 className="w-3 h-3 mr-1.5 opacity-50" />
              <span className="truncate">{lead.company}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(lead.id!); }}
            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDetails(lead); }}
            className="p-1.5 text-gray-400 hover:text-brand-pink rounded-lg transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-dark-border">
        <div className="flex items-center text-brand-pink font-black text-lg tracking-tight">
          <span className="text-xs mr-0.5 opacity-50 font-black">£</span>{lead.value.toLocaleString()}
        </div>
        {lead.expectedCloseDate && (
          <div className="flex items-center text-[10px] font-black text-gray-400 bg-gray-50 dark:bg-dark-bg px-2 py-1 rounded-lg border border-gray-100 dark:border-dark-border">
            <Clock className="w-3 h-3 mr-1.5 text-brand-pink" />
            {new Date(lead.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
        )}
      </div>

      <div className="flex lg:hidden items-center justify-between gap-3 mt-6 pt-5 border-t border-gray-50 dark:border-dark-border">
        <div className="flex gap-2">
          {currentIndex > 0 && (
            <Button variant="outline" size="sm" onClick={() => onMoveStatus(lead.id!, PIPELINE_STATUSES[currentIndex - 1])}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          {currentIndex < PIPELINE_STATUSES.length - 1 && (
            <Button variant="outline" size="sm" onClick={() => onMoveStatus(lead.id!, PIPELINE_STATUSES[currentIndex + 1])}>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="danger" size="sm" onClick={() => onMoveStatus(lead.id!, 'Lost')}><X className="w-4 h-4" /></Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onMoveStatus(lead.id!, 'Won')}><Check className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn: React.FC<{ 
  status: LeadStatus; 
  leads: Lead[]; 
  onDetails: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  onDrop: (e: React.DragEvent, status: LeadStatus) => void;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onMoveStatus: (leadId: string, newStatus: LeadStatus) => void;
}> = ({ status, leads, onDetails, onDelete, onDrop, onDragStart, onMoveStatus }) => {
  const [isOver, setIsOver] = useState(false);
  const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  return (
    <div 
      className={`flex-shrink-0 lg:w-80 w-full flex flex-col rounded-3xl transition-all duration-300 ${
        isOver ? 'bg-brand-pink/5 border-2 border-dashed border-brand-pink/20' : 'bg-transparent'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => { setIsOver(false); onDrop(e, status); }}
    >
      <div className="p-5 flex justify-between items-center shrink-0 lg:sticky lg:top-0 bg-[#F9FAFB]/90 dark:bg-dark-bg/90 backdrop-blur-xl lg:z-10 rounded-t-3xl border-b border-gray-100 dark:border-dark-border lg:mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{status}</h3>
          <span className="px-2.5 py-0.5 bg-white dark:bg-dark-card text-brand-pink text-[11px] font-black rounded-full border border-brand-pink/20 shadow-sm">
            {leads.length}
          </span>
        </div>
        <div className="text-[11px] font-black text-brand-pink bg-brand-pink/5 px-2 py-1 rounded-lg border border-brand-pink/10">
          £{(totalValue / 1000).toFixed(1)}k
        </div>
      </div>
      <div className="flex-1 lg:overflow-y-auto px-4 pb-8 scrollbar-hide">
        {leads.map(lead => (
          <LeadCard 
            key={lead.id} 
            lead={lead} 
            onDetails={onDetails} 
            onDelete={onDelete} 
            onDragStart={onDragStart} 
            onMoveStatus={onMoveStatus} 
          />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300 opacity-20">
            <Zap className="w-12 h-12 mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">No active deals</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Pipeline: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [newLead, setNewLead] = useState<Partial<Lead>>({
    firstName: '', lastName: '', company: '', email: '', phone: '', value: 0, status: 'New', source: '', expectedCloseDate: '', notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
      setLoading(false);
      setHasError(false);
    }, (err) => { 
      if (err.code === 'permission-denied') setHasError(true); 
      setLoading(false); 
    });
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fullName = `${newLead.firstName || ''} ${newLead.lastName || ''}`.trim();
      if (!fullName || !newLead.company) {
        alert("Please fill in the required name and company fields.");
        return;
      }
      
      const data = {
        ...newLead,
        name: fullName,
        value: Number(newLead.value) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'leads'), data);
      setIsAddModalOpen(false);
      setNewLead({
        firstName: '', lastName: '', company: '', email: '', phone: '', value: 0, status: 'New', source: '', expectedCloseDate: '', notes: ''
      });
    } catch (err) {
      console.error("Failed to add lead:", err);
      alert("Failed to create lead. Please check your connection.");
    }
  };

  const handleStatusUpdate = async (leadId: string, newStatus: LeadStatus) => {
    const updateData: any = { status: newStatus, updatedAt: serverTimestamp() };
    if (newStatus === 'Won' || newStatus === 'Lost') {
      updateData.closedAt = serverTimestamp();
    }
    await updateDoc(doc(db, 'leads', leadId), updateData);
  };

  const filteredActiveLeads = useMemo(() => {
    const active = leads.filter(l => !l.closedAt && !CLOSED_STATUSES.includes(l.status));
    if (!searchTerm) return active;
    const s = searchTerm.toLowerCase();
    return active.filter(l => 
      l.name.toLowerCase().includes(s) || 
      l.company.toLowerCase().includes(s)
    );
  }, [leads, searchTerm]);

  if (hasError) return <div className="p-10"><PageHeader title="Lead Pipeline" /><PermissionError /></div>;

  return (
    <div className="flex flex-col min-h-screen p-6 md:p-10 max-w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        .pipeline-scrollbar-container::-webkit-scrollbar { height: 10px; width: 10px; }
        .pipeline-scrollbar-container::-webkit-scrollbar-track { background: transparent; }
        .pipeline-scrollbar-container::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .dark .pipeline-scrollbar-container::-webkit-scrollbar-thumb { background: #27272a; }
      `}} />
      
      <PageHeader 
        title="Lead Pipeline" 
        description="High-performance Kanban for agency deal flow."
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 w-4 h-4 z-10" />
              <Input 
                placeholder="Filter deals..." 
                className="pl-10 h-11 w-full sm:w-64" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <Button icon={Plus} size="sm" onClick={() => setIsAddModalOpen(true)}>Add Lead</Button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-8 lg:gap-6 lg:overflow-x-auto pipeline-scrollbar-container pb-12 w-full">
        {PIPELINE_STATUSES.map(status => (
          <KanbanColumn 
            key={status} status={status} 
            leads={filteredActiveLeads.filter(l => l.status === status)}
            onDetails={(lead) => setSelectedLead(lead)}
            onDelete={(id) => {
              if (confirm('Permanently delete this lead?')) deleteDoc(doc(db, 'leads', id));
            }}
            onDragStart={(e, id) => e.dataTransfer.setData('leadId', id)}
            onDrop={(e, s) => { 
              const id = e.dataTransfer.getData('leadId'); 
              if (id) handleStatusUpdate(id, s); 
            }}
            onMoveStatus={handleStatusUpdate}
          />
        ))}
        
        <div className="flex flex-col lg:flex-row gap-6 lg:pr-10 shrink-0">
          <div 
            className="flex-shrink-0 lg:w-80 w-full min-h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-green-500/20 rounded-3xl bg-green-500/[0.02] hover:bg-green-500/[0.05] transition-all group" 
            onDragOver={(e) => e.preventDefault()} 
            onDrop={(e) => { 
              const id = e.dataTransfer.getData('leadId'); 
              if (id) handleStatusUpdate(id, 'Won'); 
            }}
          >
            <Check className="w-8 h-8 text-green-500 mb-2 opacity-40 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-black text-green-600 uppercase tracking-widest">Drop to Won</p>
          </div>
          <div 
            className="flex-shrink-0 lg:w-80 w-full min-h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-red-500/20 rounded-3xl bg-red-500/[0.02] hover:bg-red-500/[0.05] transition-all group" 
            onDragOver={(e) => e.preventDefault()} 
            onDrop={(e) => { 
              const id = e.dataTransfer.getData('leadId'); 
              if (id) handleStatusUpdate(id, 'Lost'); 
            }}
          >
            <X className="w-8 h-8 text-red-500 mb-2 opacity-40 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-black text-red-600 uppercase tracking-widest">Drop to Lost</p>
          </div>
        </div>
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="Register New Lead"
        size="lg"
      >
        <form onSubmit={handleAddLead} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">First Name</label>
              <Input required value={newLead.firstName} onChange={e => setNewLead({...newLead, firstName: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Last Name</label>
              <Input required value={newLead.lastName} onChange={e => setNewLead({...newLead, lastName: e.target.value})} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Company</label>
              <Input required value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Email</label>
              <Input type="email" required value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Phone</label>
              <Input value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Deal Value (£)</label>
              <Input type="number" required value={newLead.value} onChange={e => setNewLead({...newLead, value: Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Initial Status</label>
              <Select value={newLead.status} onChange={e => setNewLead({...newLead, status: e.target.value as LeadStatus})}>
                {PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Source</label>
              <Input placeholder="e.g. LinkedIn" value={newLead.source} onChange={e => setNewLead({...newLead, source: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Target Closing</label>
              <Input type="date" value={newLead.expectedCloseDate} onChange={e => setNewLead({...newLead, expectedCloseDate: e.target.value})} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Deal Intelligence</label>
              <Textarea value={newLead.notes} onChange={e => setNewLead({...newLead, notes: e.target.value})} />
            </div>
          </div>
          <div className="pt-4 flex gap-4">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" type="submit">Create Lead</Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={!!selectedLead} 
        onClose={() => setSelectedLead(null)} 
        title="Deal Intelligence"
        size="lg"
      >
        {selectedLead && (
          <div className="space-y-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-brand-pink/10 text-brand-pink flex items-center justify-center text-3xl font-black shadow-inner">
                {selectedLead.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white leading-tight truncate">
                  {selectedLead.name}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center text-sm font-bold text-gray-500 truncate">
                    <Building2 className="w-4 h-4 mr-2 opacity-50" />
                    {selectedLead.company}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-brand-pink/10 text-brand-pink border border-brand-pink/20">
                    {selectedLead.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-gray-100 dark:border-dark-border">
              <Button variant="outline" className="w-full" onClick={() => setSelectedLead(null)}>Close Intel</Button>
            </div>
          </div>
        )}
      </Modal>

      {loading && (
        <div className="fixed inset-0 bg-white/90 dark:bg-dark-bg/90 backdrop-blur-md z-[200] flex items-center justify-center">
          <Zap className="w-16 h-16 text-brand-pink animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default Pipeline;