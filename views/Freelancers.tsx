import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import { Freelancer } from '../types';
import StatusBadge from '../components/StatusBadge';
import { Plus, DollarSign, Briefcase, UserCircle, Phone, Globe, Edit3, Trash2, ExternalLink } from 'lucide-react';
import { PageHeader, Button, Card, Modal, Input, Select, EmptyState, PermissionError } from '../components/UI';

const Freelancers: React.FC = () => {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialFormState: Partial<Freelancer> = {
    name: '', 
    email: '', 
    phone: '', 
    portfolioLink: '', 
    specialization: '', 
    rate: '', 
    status: 'Active'
  };

  const [formData, setFormData] = useState<Partial<Freelancer>>(initialFormState);

  const toSentenceCase = (str: string | undefined | null) => {
    if (!str) return '';
    const s = str.trim();
    if (s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  useEffect(() => {
    const q = query(collection(db, 'freelancers'), orderBy('joinedAt', 'desc'));
    return onSnapshot(q, 
      (snap) => {
        setFreelancers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer)));
        setHasError(false);
      },
      (err) => {
        if (err.code === 'permission-denied') setHasError(true);
        console.error("Freelancers Firestore Error:", err);
      }
    );
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (fl: Freelancer) => {
    setEditingId(fl.id!);
    setFormData({
      name: fl.name,
      email: fl.email,
      phone: fl.phone || '',
      portfolioLink: fl.portfolioLink || '',
      specialization: fl.specialization,
      rate: fl.rate,
      status: fl.status
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      name: toSentenceCase(formData.name),
      specialization: toSentenceCase(formData.specialization),
      joinedAt: editingId ? (freelancers.find(f => f.id === editingId)?.joinedAt || serverTimestamp()) : serverTimestamp()
    };

    if (editingId) {
      await updateDoc(doc(db, 'freelancers', editingId), data);
    } else {
      await addDoc(collection(db, 'freelancers'), data);
    }

    setIsModalOpen(false);
    setFormData(initialFormState);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this freelancer from the network?')) {
      await deleteDoc(doc(db, 'freelancers', id));
    }
  };

  if (hasError) {
    return (
      <div className="p-10">
        <PageHeader title="Freelancer Network" />
        <PermissionError />
      </div>
    );
  }

  return (
    <div className="p-10">
      <PageHeader 
        title="Freelancer Network" 
        description="Directory of external talent and creative collaborators."
        actions={<Button icon={Plus} size="sm" onClick={handleOpenAdd}>Add Freelancer</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {freelancers.map(fl => (
          <Card key={fl.id} className="p-8 group hover:border-brand-pink/50 transition-all relative">
            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleOpenEdit(fl)}
                className="p-2 bg-gray-50 dark:bg-dark-bg text-gray-400 hover:text-brand-pink rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDelete(fl.id!)}
                className="p-2 bg-gray-50 dark:bg-dark-bg text-gray-400 hover:text-red-500 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-5 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gray-900 dark:bg-dark-bg text-white flex items-center justify-center font-black text-xl shadow-md group-hover:bg-brand-pink transition-colors">
                {fl.name.charAt(0)}
              </div>
              <div className="min-w-0 pr-12">
                <h3 className="font-black text-gray-900 dark:text-white leading-tight text-lg truncate">{fl.name}</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-tight truncate">{fl.email}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest flex items-center">
                  <Briefcase className="w-3.5 h-3.5 mr-2 opacity-50" /> Specialisation
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{fl.specialization}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest flex items-center">
                  <span className="text-brand-pink mr-2 font-black">£</span> Daily Rate
                </span>
                <span className="font-black text-brand-pink">£{fl.rate}</span>
              </div>
              {fl.phone && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest flex items-center">
                    <Phone className="w-3.5 h-3.5 mr-2 opacity-50" /> Phone
                  </span>
                  <span className="font-bold text-gray-700 dark:text-gray-300">{fl.phone}</span>
                </div>
              )}
              
              <div className="pt-6 border-t border-gray-50 dark:border-dark-border flex justify-between items-center">
                <StatusBadge status={fl.status} />
                {fl.portfolioLink ? (
                  <a href={fl.portfolioLink} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs font-black text-brand-pink hover:underline uppercase tracking-widest">
                    Portfolio <ExternalLink className="w-3 h-3 ml-1.5" />
                  </a>
                ) : (
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">No Portfolio</span>
                )}
              </div>
            </div>
          </Card>
        ))}
        {freelancers.length === 0 && <div className="col-span-full"><EmptyState icon={UserCircle} message="No Freelancers" submessage="Expand your creative reach by adding talent to your network." /></div>}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? 'Edit Freelancer' : 'Add Freelancer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Full Name</label>
            <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Specialisation</label>
              <Input required placeholder="e.g. Motion Designer" value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Daily Rate (£)</label>
              <Input required placeholder="e.g. 500/day" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Contact Email</label>
              <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Phone Number</label>
              <Input placeholder="Optional" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Portfolio Link</label>
            <Input placeholder="https://..." value={formData.portfolioLink} onChange={e => setFormData({...formData, portfolioLink: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Status</label>
            <Select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>
          <Button className="w-full mt-4" type="submit">{editingId ? 'Save Changes' : 'Add Freelancer'}</Button>
        </form>
      </Modal>
    </div>
  );
};

export default Freelancers;