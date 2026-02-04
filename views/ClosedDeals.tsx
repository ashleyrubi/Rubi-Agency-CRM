import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, query, orderBy, where, deleteDoc } from 'firebase/firestore';
import { Lead, LeadStatus } from '../types';
import { 
  Search, 
  Filter, 
  Archive, 
  RefreshCw, 
  Building2, 
  Calendar, 
  X, 
  CheckCircle, 
  AlertCircle,
  Clock,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { 
  PageHeader, 
  Button, 
  Card, 
  Input, 
  Select, 
  EmptyState, 
  PermissionError, 
  Table 
} from '../components/UI';

const ClosedDeals: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Won' | 'Lost'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    // Listen for all leads that have been closed
    const q = query(collection(db, 'leads'), orderBy('closedAt', 'desc'));
    return onSnapshot(q, 
      (snap) => {
        const closedLeads = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Lead))
          .filter(l => !!l.closedAt);
        setLeads(closedLeads);
        setLoading(false);
        setHasError(false);
      },
      (err) => {
        if (err.code === 'permission-denied') setHasError(true);
        setLoading(false);
      }
    );
  }, []);

  const handleReopen = async (leadId: string) => {
    const leadRef = doc(db, 'leads', leadId);
    await updateDoc(leadRef, {
      status: 'Qualified',
      closedAt: null,
      lossReason: null,
      updatedAt: serverTimestamp()
    });
  };

  const handleDeleteLead = async (leadId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this closed deal record? This cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'leads', leadId));
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Failed to delete record. You may not have permission.");
      }
    }
  };

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (statusFilter !== 'All') {
      result = result.filter(l => l.status === statusFilter);
    }

    if (startDate) {
      result = result.filter(l => {
        if (!l.closedAt) return false;
        const closedDate = l.closedAt.toDate ? l.closedAt.toDate() : new Date(l.closedAt);
        return closedDate >= new Date(startDate);
      });
    }

    if (endDate) {
      result = result.filter(l => {
        if (!l.closedAt) return false;
        const closedDate = l.closedAt.toDate ? l.closedAt.toDate() : new Date(l.closedAt);
        return closedDate <= new Date(endDate);
      });
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(l => 
        l.name.toLowerCase().includes(s) || 
        l.company.toLowerCase().includes(s) || 
        l.email.toLowerCase().includes(s)
      );
    }

    return result;
  }, [leads, statusFilter, startDate, endDate, searchTerm]);

  if (hasError) return <div className="p-10"><PageHeader title="Closed Deals" /><PermissionError /></div>;

  return (
    <div className="p-10">
      <PageHeader 
        title="Closed Deals" 
        description="Review agency history and performance insights."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Card className="p-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Closed</p>
          <p className="text-3xl font-black mt-2 text-gray-900 dark:text-white">{leads.length}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-green-600">Total Won Value</p>
          <p className="text-3xl font-black mt-2 text-green-600">
            £{leads.filter(l => l.status === 'Won').reduce((acc, l) => acc + (Number(l.value) || 0), 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-red-500">Total Lost Value</p>
          <p className="text-3xl font-black mt-2 text-red-500">
            £{leads.filter(l => l.status === 'Lost').reduce((acc, l) => acc + (Number(l.value) || 0), 0).toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Search history</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search leads..." 
              className="pl-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Filter status</label>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="All">All outcomes</option>
            <option value="Won">Won only</option>
            <option value="Lost">Lost only</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">From</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">To</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table headers={['Lead & Company', 'Value', 'Closed Date', 'Status & Insight', 'Actions']}>
          {filteredLeads.map(lead => (
            <tr key={lead.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-bg/50 transition-colors">
              <td className="px-6 py-4">
                <div className="text-sm font-black text-gray-900 dark:text-white">{lead.name}</div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{lead.company}</div>
              </td>
              <td className="px-6 py-4">
                <span className={`text-sm font-black ${lead.status === 'Won' ? 'text-green-600' : 'text-red-500'}`}>
                  £{lead.value.toLocaleString()}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center text-xs font-bold text-gray-500">
                  <Clock className="w-3.5 h-3.5 mr-2 opacity-50" />
                  {lead.closedAt?.toDate ? lead.closedAt.toDate().toLocaleDateString('en-GB') : new Date(lead.closedAt).toLocaleDateString('en-GB')}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {lead.status === 'Won' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${lead.status === 'Won' ? 'text-green-600' : 'text-red-500'}`}>
                      {lead.status}
                    </span>
                  </div>
                  {lead.status === 'Lost' && lead.lossReason && (
                    <p className="text-[10px] text-gray-400 mt-1 italic line-clamp-1" title={lead.lossReason}>
                      Reason: {lead.lossReason}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    icon={RefreshCw} 
                    onClick={() => handleReopen(lead.id!)}
                    title="Move back to active pipeline"
                  >
                    Reopen
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    icon={Trash2} 
                    onClick={() => handleDeleteLead(lead.id!)}
                    title="Permanently Delete Record"
                  />
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {!loading && leads.length === 0 && (
          <EmptyState 
            icon={Archive} 
            message="No Closed Deals" 
            submessage="Archive won or lost deals from your active pipeline to see them here." 
          />
        )}
        {loading && (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-brand-pink animate-spin mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading History...</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClosedDeals;