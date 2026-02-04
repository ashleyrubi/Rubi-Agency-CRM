import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import { Lead, LeadStatus } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Zap, 
  Building2, 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  MoreHorizontal,
  GripVertical,
  Clock,
  ArrowRight,
  X,
  Trash2
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
}> = ({ lead, onDetails, onDelete, onDragStart }) => {
  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart(e, lead.id!)}
      className="group bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-xl p-4 mb-3 shadow-sm hover:shadow-md hover:border-brand-pink/30 transition-all cursor-grab active:cursor-grabbing relative"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-pink transition-colors" />
          <h4 className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[140px]">
            {lead.name}
          </h4>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(lead.id!); }}
            className="p-1 text-gray-300 hover:text-red-500 rounded-md transition-colors"
            title="Quick Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDetails(lead); }}
            className="p-1 text-gray-400 hover:text-brand-pink rounded-md transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex items-center text-[11px] font-bold text-gray-500 mb-3">
        <Building2 className="w-3 h-3 mr-1.5 opacity-50" />
        <span className="truncate">{lead.company}</span>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-50 dark:border-dark-border">
        <div className="flex items-center text-brand-pink font-black text-xs">
          £{lead.value.toLocaleString()}
        </div>
        {lead.expectedCloseDate && (
          <div className="flex items-center text-[10px] font-bold text-gray-400">
            <Calendar className="w-3 h-3 mr-1 opacity-50" />
            {new Date(lead.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
        )}
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
}> = ({ status, leads, onDetails, onDelete, onDrop, onDragStart }) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDropLocal = (e: React.DragEvent) => {
    setIsOver(false);
    onDrop(e, status);
  };

  const totalValue = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  return (
    <div 
      className={`flex-shrink-0 w-80 flex flex-col h-full rounded-2xl transition-colors ${
        isOver ? 'bg-brand-pink/5 border-2 border-dashed border-brand-pink/20' : 'bg-transparent'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropLocal}
    >
      <div className="p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
            {status}
          </h3>
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-dark-bg text-gray-500 text-[10px] font-black rounded-full">
            {leads.length}
          </span>
        </div>
        <div className="text-[10px] font-black text-brand-pink">
          £{(totalValue / 1000).toFixed(1)}k
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">
        {leads.map(lead => (
          <LeadCard 
            key={lead.id} 
            lead={lead} 
            onDetails={onDetails} 
            onDelete={onDelete}
            onDragStart={onDragStart}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-300 dark:text-gray-700">
            <div className="w-10 h-10 border-2 border-dashed border-current rounded-full flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 opacity-20" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-tighter opacity-30">Drop here</p>
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
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const initialLeadState: Partial<Lead> = {
    firstName: '',
    lastName: '',
    name: '',
    company: '',
    email: '',
    phone: '',
    value: 0,
    status: 'New',
    source: '',
    expectedCloseDate: '',
    notes: ''
  };

  const [newLead, setNewLead] = useState<Partial<Lead>>(initialLeadState);

  const toSentenceCase = (str: string | undefined | null) => {
    if (!str) return '';
    const s = str.trim();
    if (s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, 
      (snap) => {
        setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
        setLoading(false);
        setHasError(false);
      },
      (err) => {
        if (err.code === 'permission-denied') setHasError(true);
        setLoading(false);
      }
    );
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${toSentenceCase(newLead.firstName)} ${toSentenceCase(newLead.lastName)}`.trim();
    const data = {
      ...newLead,
      name: fullName,
      company: toSentenceCase(newLead.company),
      source: toSentenceCase(newLead.source),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await addDoc(collection(db, 'leads'), data);
    setIsAddModalOpen(false);
    setNewLead(initialLeadState);
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: LeadStatus) => {
    const leadId = e.dataTransfer.getData('leadId');
    if (!leadId) return;

    if (newStatus === 'Lost') {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setIsLossModalOpen(true);
        return;
      }
    }

    const leadRef = doc(db, 'leads', leadId);
    const updates: any = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };

    if (newStatus === 'Won') {
      updates.closedAt = serverTimestamp();
    }

    await updateDoc(leadRef, updates);
  };

  const handleLossConfirm = async () => {
    if (!selectedLead) return;
    const leadRef = doc(db, 'leads', selectedLead.id!);
    await updateDoc(leadRef, {
      status: 'Lost',
      closedAt: serverTimestamp(),
      lossReason: lossReason,
      updatedAt: serverTimestamp()
    });
    setIsLossModalOpen(false);
    setLossReason('');
    setSelectedLead(null);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this lead? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'leads', leadId));
        if (selectedLead?.id === leadId) {
          setIsDetailsModalOpen(false);
          setSelectedLead(null);
        }
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Failed to delete lead. You may not have permission.");
      }
    }
  };

  // Filter out any lead that has a closedAt timestamp for the main Kanban view
  const activeLeads = useMemo(() => {
    return leads.filter(l => !l.closedAt && !CLOSED_STATUSES.includes(l.status));
  }, [leads]);

  const filteredActiveLeads = useMemo(() => {
    if (!searchTerm) return activeLeads;
    const s = searchTerm.toLowerCase();
    return activeLeads.filter(l => 
      l.name.toLowerCase().includes(s) || 
      l.company.toLowerCase().includes(s) || 
      l.email.toLowerCase().includes(s)
    );
  }, [activeLeads, searchTerm]);

  if (hasError) return <div className="p-10"><PageHeader title="Lead Pipeline" /><PermissionError /></div>;

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden p-6 md:p-10">
      <div className="shrink-0">
        <PageHeader 
          title="Lead Pipeline" 
          description="High-performance Kanban for agency deal flow."
          actions={
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                  placeholder="Filter deals..." 
                  className="pl-10 h-11 w-64 text-sm font-bold" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button icon={Plus} size="sm" onClick={() => setIsAddModalOpen(true)}>Add Lead</Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 border-none shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Deals</p>
              <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                {activeLeads.length}
              </p>
            </div>
            <Zap className="w-8 h-8 text-brand-pink/20" />
          </Card>
          <Card className="p-4 border-none shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pipeline Value</p>
              <p className="text-2xl font-black mt-1 text-brand-pink">
                £{activeLeads.reduce((acc, l) => acc + (Number(l.value) || 0), 0).toLocaleString()}
              </p>
            </div>
            <Clock className="w-8 h-8 text-brand-pink/20" />
          </Card>
          <Card className="p-4 border-none shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Win Rate</p>
              <p className="text-2xl font-black mt-1 text-green-600">
                {leads.length ? Math.round((leads.filter(l => l.status === 'Won').length / leads.length) * 100) : 0}%
              </p>
            </div>
            <Zap className="w-8 h-8 text-green-600/20" />
          </Card>
          <Card className="p-4 border-none shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Closed Volume</p>
              <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                {leads.filter(l => !!l.closedAt).length}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-gray-300/20" />
          </Card>
        </div>
      </div>

      <div className="flex-1 min-h-0 -mx-6 md:-mx-10 px-6 md:px-10 pb-6 overflow-x-auto scrollbar-hide flex gap-6">
        {PIPELINE_STATUSES.map(status => (
          <KanbanColumn 
            key={status} 
            status={status} 
            leads={filteredActiveLeads.filter(l => l.status === status)}
            onDetails={(lead) => {
              setSelectedLead(lead);
              setIsDetailsModalOpen(true);
            }}
            onDelete={handleDeleteLead}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}

        {/* Drop zones for closing deals */}
        <div className="flex gap-6 pr-10">
          <div 
            className="flex-shrink-0 w-80 flex flex-col items-center justify-center border-2 border-dashed border-green-500/20 rounded-2xl bg-green-500/[0.02] hover:bg-green-500/[0.05] transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'Won')}
          >
            <Zap className="w-10 h-10 text-green-500 mb-4 opacity-40" />
            <p className="text-xs font-black text-green-600 uppercase tracking-widest">Drop to mark as Won</p>
          </div>
          <div 
            className="flex-shrink-0 w-80 flex flex-col items-center justify-center border-2 border-dashed border-red-500/20 rounded-2xl bg-red-500/[0.02] hover:bg-red-500/[0.05] transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'Lost')}
          >
            <X className="w-10 h-10 text-red-500 mb-4 opacity-40" />
            <p className="text-xs font-black text-red-600 uppercase tracking-widest">Drop to mark as Lost</p>
          </div>
        </div>
      </div>

      {/* Loss Reason Modal */}
      <Modal 
        isOpen={isLossModalOpen} 
        onClose={() => { setIsLossModalOpen(false); setSelectedLead(null); }} 
        title="Reason for Loss"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 font-medium">Why was this deal lost? This helps the agency improve lead conversion.</p>
          <Textarea 
            placeholder="e.g. Budget constraints, went with competitor..." 
            value={lossReason} 
            onChange={e => setLossReason(e.target.value)} 
          />
          <div className="flex gap-3">
             <Button variant="outline" className="flex-1" onClick={() => { setIsLossModalOpen(false); setSelectedLead(null); }}>Cancel</Button>
             <Button variant="primary" className="flex-1" onClick={handleLossConfirm}>Confirm Loss</Button>
          </div>
        </div>
      </Modal>

      {/* Add Lead Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="Add Lead"
        size="lg"
      >
        <form onSubmit={handleAddLead} className="space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">First Name</label>
              <Input required value={newLead.firstName} onChange={e => setNewLead({...newLead, firstName: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Last Name</label>
              <Input required value={newLead.lastName} onChange={e => setNewLead({...newLead, lastName: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Company Name</label>
              <Input required value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Email Address</label>
              <Input type="email" required value={newLead.email} onChange={e => setNewLead({...newLead, email: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Phone Number</label>
              <Input value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Estimated Value (£)</label>
              <Input type="number" required value={newLead.value} onChange={e => setNewLead({...newLead, value: Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Status</label>
              <Select value={newLead.status} onChange={e => setNewLead({...newLead, status: e.target.value as LeadStatus})}>
                {PIPELINE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Lead Source</label>
              <Input placeholder="e.g. Referral, Website" value={newLead.source} onChange={e => setNewLead({...newLead, source: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Expected Close Date</label>
              <Input type="date" value={newLead.expectedCloseDate} onChange={e => setNewLead({...newLead, expectedCloseDate: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Notes</label>
              <Textarea value={newLead.notes} onChange={e => setNewLead({...newLead, notes: e.target.value})} />
            </div>
          </div>
          <div className="pt-4 flex gap-4">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" type="submit">Add Lead</Button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)} 
        title="Lead Intelligence"
        size="lg"
      >
        {selectedLead && (
          <div className="space-y-8">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-3xl bg-brand-pink/10 text-brand-pink flex items-center justify-center text-3xl font-black">
                {selectedLead.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white leading-tight truncate">
                  {selectedLead.name}
                </h3>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center text-sm font-bold text-gray-500 truncate">
                    <Building2 className="w-4 h-4 mr-1.5 opacity-50" />
                    {selectedLead.company}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    selectedLead.status === 'Won' ? 'bg-green-100 text-green-700' :
                    selectedLead.status === 'Lost' ? 'bg-red-100 text-red-700' :
                    'bg-brand-pink/10 text-brand-pink'
                  }`}>
                    {selectedLead.status}
                  </span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                icon={Trash2}
                className="text-gray-400 hover:text-red-500" 
                onClick={() => handleDeleteLead(selectedLead.id!)}
                title="Permanently Delete Lead"
              />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact Information</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                    <Mail className="w-4 h-4 opacity-30" />
                    {selectedLead.email}
                  </div>
                  {selectedLead.phone && (
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      <Phone className="w-4 h-4 opacity-30" />
                      {selectedLead.phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deal Details</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-900 dark:text-white">
                    <span className="text-brand-pink font-black">£</span>
                    Value: £{selectedLead.value.toLocaleString()}
                  </div>
                  {selectedLead.expectedCloseDate && (
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      <Clock className="w-4 h-4 opacity-30" />
                      Closes: {new Date(selectedLead.expectedCloseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                  {selectedLead.source && (
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      <Zap className="w-4 h-4 opacity-30" />
                      Source: {selectedLead.source}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Intelligence Notes</h4>
              <div className="p-5 bg-gray-50 dark:bg-dark-bg rounded-2xl border border-gray-100 dark:border-dark-border text-sm text-gray-600 dark:text-gray-400 leading-relaxed min-h-[120px]">
                {selectedLead.notes || 'No contextual intelligence recorded for this prospect yet.'}
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-dark-border">
              <Button variant="outline" className="flex-1" onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
              <Button variant="primary" className="flex-1">Edit Deal Intelligence</Button>
            </div>
          </div>
        )}
      </Modal>

      {loading && (
        <div className="fixed inset-0 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="flex flex-col items-center">
            <Zap className="w-12 h-12 text-brand-pink animate-pulse mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Syncing Intelligence...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pipeline;