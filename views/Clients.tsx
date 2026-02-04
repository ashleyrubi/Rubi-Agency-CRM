
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Client, ClientContact } from '../types';
import { Plus, Mail, User, Briefcase, Edit3, Phone, Users, BadgeCheck, Trash2 } from 'lucide-react';
// Added Select to the imports from '../components/UI'
import { PageHeader, Button, Card, Input, Modal, EmptyState, PermissionError, Table, Select } from '../components/UI';

// --- Inline Editor Component ---
interface InlineFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}

// Fixed: Added React import to satisfy React.FC type usage
const InlineField: React.FC<InlineFieldProps> = ({ value, onSave, placeholder, className = "" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    if (currentValue !== value) onSave(currentValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className={`w-full p-1 text-xs font-bold border border-brand-pink rounded bg-white dark:bg-dark-bg focus:outline-none ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div 
      onDoubleClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-brand-pink/5 px-2 py-1 rounded transition-colors group relative flex items-center min-h-[24px] ${className}`}
    >
      <span className="truncate flex-1">{value || <span className="text-gray-300 italic">{placeholder}</span>}</span>
      <Edit3 className="w-3 h-3 text-brand-pink opacity-0 group-hover:opacity-40 ml-1 shrink-0" />
    </div>
  );
};

// Fixed: Added React import to satisfy React.FC type usage
const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPeopleModalOpen, setIsPeopleModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '', company: '', email: '', website: '', contactPerson: '', phone: '', status: 'Active'
  });

  const [newPerson, setNewPerson] = useState<ClientContact>({ name: '', email: '', phone: '', jobRole: '' });

  const toSentenceCase = (str: string | undefined | null) => {
    if (!str) return '';
    const s = str.trim();
    if (s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, 
      (snap) => {
        setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setHasError(false);
      },
      (err) => { if (err.code === 'permission-denied') setHasError(true); }
    );
  }, []);

  const handleOpenAdd = () => {
    setFormData({ name: '', company: '', email: '', website: '', contactPerson: '', phone: '', status: 'Active' });
    setIsModalOpen(true);
  };

  const handleOpenEditClient = (client: Client) => {
    setFormData({
      id: client.id,
      name: client.name || '',
      company: client.company || '',
      email: client.email || '',
      website: client.website || '',
      contactPerson: client.contactPerson || '',
      phone: client.phone || '',
      status: client.status || 'Active'
    });
    setIsModalOpen(true);
  };

  // Fixed: Added React import to satisfy React.FormEvent type usage
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.id) {
      // Update existing
      const clientRef = doc(db, 'clients', formData.id);
      const updates = {
        ...formData,
        company: toSentenceCase(formData.company),
        name: toSentenceCase(formData.name),
        contactPerson: toSentenceCase(formData.contactPerson),
        updatedAt: serverTimestamp()
      };
      await updateDoc(clientRef, updates);
    } else {
      // Create new
      const mainContact = {
        name: toSentenceCase(formData.contactPerson),
        email: formData.email || '',
        phone: formData.phone || '',
        jobRole: 'Main Contact'
      };
      
      const data = {
        ...formData,
        company: toSentenceCase(formData.company),
        name: toSentenceCase(formData.name),
        contactPerson: mainContact.name,
        email: mainContact.email,
        phone: mainContact.phone,
        people: [mainContact],
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'clients'), data);
    }

    setIsModalOpen(false);
    setFormData({ name: '', company: '', email: '', website: '', contactPerson: '', phone: '', status: 'Active' });
  };

  const openPeopleModal = (client: Client) => {
    let updatedPeople = [...(client.people || [])];
    if (updatedPeople.length === 0) {
      updatedPeople = [{
        name: client.contactPerson || '',
        email: client.email || '',
        phone: client.phone || '',
        jobRole: 'Main Contact'
      }];
    } else {
      updatedPeople[0] = {
        ...updatedPeople[0],
        name: client.contactPerson || updatedPeople[0].name,
        email: client.email || updatedPeople[0].email,
        phone: client.phone || updatedPeople[0].phone,
        jobRole: updatedPeople[0].jobRole || 'Main Contact'
      };
    }
    
    setSelectedClient({ ...client, people: updatedPeople });
    setIsPeopleModalOpen(true);
  };

  const handleUpdatePeople = async (clientId: string, updatedPeople: ClientContact[]) => {
    try {
      const updates: any = { people: updatedPeople };
      if (updatedPeople.length > 0) {
        updates.contactPerson = updatedPeople[0].name;
        updates.email = updatedPeople[0].email;
        updates.phone = updatedPeople[0].phone;
      }
      await updateDoc(doc(db, 'clients', clientId), updates);
      if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient({ ...selectedClient, ...updates });
      }
    } catch (e) {
      console.error("Failed to update people", e);
    }
  };

  const addPerson = async () => {
    if (!selectedClient || !newPerson.name) return;
    const currentPeople = selectedClient.people || [];
    if (newPerson.email && currentPeople.some(p => p.email && p.email.toLowerCase() === newPerson.email.toLowerCase())) {
      alert('A contact with this email already exists.');
      return;
    }
    const updatedPeople = [...currentPeople, { 
      name: toSentenceCase(newPerson.name), 
      email: newPerson.email, 
      phone: newPerson.phone,
      jobRole: toSentenceCase(newPerson.jobRole) || 'Contact'
    }];
    await handleUpdatePeople(selectedClient.id!, updatedPeople);
    setNewPerson({ name: '', email: '', phone: '', jobRole: '' });
  };

  const removePerson = async (index: number) => {
    if (!selectedClient || !selectedClient.people || index === 0) return;
    const updatedPeople = [...selectedClient.people];
    updatedPeople.splice(index, 1);
    await handleUpdatePeople(selectedClient.id!, updatedPeople);
  };

  const editPerson = async (index: number, field: keyof ClientContact, value: string) => {
    if (!selectedClient || !selectedClient.people) return;
    const updatedPeople = [...selectedClient.people];
    const finalValue = (field === 'name' || field === 'jobRole') ? toSentenceCase(value) : value;
    updatedPeople[index] = { ...updatedPeople[index], [field]: finalValue };
    await handleUpdatePeople(selectedClient.id!, updatedPeople);
  };

  if (hasError) return <div className="p-4 md:p-10"><PageHeader title="Agency Clients" /><PermissionError /></div>;

  return (
    <div className="p-4 md:p-10">
      <PageHeader 
        title="Agency Clients" 
        description="Directory of core partners. Manage multi-person contacts for each brand."
        actions={<Button icon={Plus} size="sm" onClick={handleOpenAdd}>Add Client</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {clients.map(client => (
          <Card key={client.id} className="p-6 md:p-8 group hover:border-brand-pink/50 transition-all flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-50 dark:bg-dark-bg rounded-2xl flex items-center justify-center border border-gray-100 dark:border-dark-border">
                  <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-gray-400 group-hover:text-brand-pink transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleOpenEditClient(client)}
                    className="p-2 bg-gray-50 dark:bg-dark-bg text-gray-400 hover:text-brand-pink rounded-lg transition-colors border border-gray-100 dark:border-dark-border"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${client.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/20' : 'bg-gray-100 text-gray-500'}`}>
                    {client.status}
                  </span>
                </div>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white group-hover:text-brand-pink transition-colors truncate">{client.company}</h3>
              <p className="text-sm font-bold text-gray-400 mt-1">{client.name}</p>
              
              <div className="mt-8 space-y-3">
                <div className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                  <User className="w-4 h-4 mr-3 opacity-50 shrink-0" /> <span className="truncate">{client.contactPerson}</span>
                </div>
                <div className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                  <Mail className="w-4 h-4 mr-3 opacity-50 shrink-0" /> <span className="truncate">{client.email}</span>
                </div>
                {client.phone && (
                   <div className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4 mr-3 opacity-50 shrink-0" /> <span className="truncate">{client.phone}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-8 md:mt-10 pt-6 border-t border-gray-50 dark:border-dark-border grid grid-cols-3 gap-2">
              <Button variant="secondary" className="px-1" size="sm" onClick={() => openPeopleModal(client)}>People</Button>
              <Button variant="outline" className="px-1" size="sm">Projects</Button>
              <Button variant="outline" className="px-1" size="sm">Files</Button>
            </div>
          </Card>
        ))}
        {clients.length === 0 && <div className="col-span-full"><EmptyState icon={User} message="No Clients Found" /></div>}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? "Edit Brand Partner" : "New Brand Partner"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Company Name</label>
            <Input required placeholder="Rubi Agency" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Main Contact Name</label>
              <Input required placeholder="Jane Doe" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Main Phone</label>
              <Input placeholder="0400 000 000" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Main Email</label>
            <Input type="email" required placeholder="contact@company.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Website URL</label>
            <Input placeholder="https://..." value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Status</label>
            <Select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>
          <Button className="w-full mt-4" type="submit">
            {formData.id ? "Save Changes" : "Register Client"}
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isPeopleModalOpen} 
        onClose={() => setIsPeopleModalOpen(false)} 
        title={`${selectedClient?.company} - People`}
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-dark-bg/50 p-6 rounded-2xl border border-gray-100 dark:border-dark-border">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
              <Plus className="w-3 h-3 mr-2 text-brand-pink" /> Add New Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Input placeholder="Full Name" className="h-10 text-xs" value={newPerson.name} onChange={e => setNewPerson({ ...newPerson, name: e.target.value })} />
              <Input placeholder="Job Role" className="h-10 text-xs" value={newPerson.jobRole} onChange={e => setNewPerson({ ...newPerson, jobRole: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Email" type="email" className="h-10 text-xs" value={newPerson.email} onChange={e => setNewPerson({ ...newPerson, email: e.target.value })} />
              <div className="flex gap-2">
                <Input placeholder="Phone" className="h-10 text-xs flex-1" value={newPerson.phone} onChange={e => setNewPerson({ ...newPerson, phone: e.target.value })} />
                <Button size="sm" icon={Plus} onClick={addPerson} disabled={!newPerson.name}>Add Person</Button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
              <Users className="w-3 h-3 mr-2" /> Team Members
            </h4>
            <Card className="overflow-hidden border-none shadow-none bg-transparent">
              <div className="overflow-x-auto">
                <Table headers={['Name & Role', 'Email', 'Phone', '']} className="!bg-transparent">
                  {(selectedClient?.people || []).map((person, idx) => (
                    <tr key={idx} className="border-b border-gray-50 dark:border-dark-border last:border-0 align-top">
                      <td className="px-4 py-2 min-w-[180px]">
                        <div className="flex flex-col">
                          <div className="flex items-center">
                             {idx === 0 && (
                               <span title="Main Contact">
                                 <BadgeCheck className="w-3 h-3 text-brand-pink mr-1 shrink-0" />
                               </span>
                             )}
                             <InlineField value={person.name} onSave={(val) => editPerson(idx, 'name', val)} placeholder="Name" className="font-bold" />
                          </div>
                          <InlineField value={person.jobRole} onSave={(val) => editPerson(idx, 'jobRole', val)} placeholder="Job Role" className="text-[10px] text-gray-400 uppercase font-black tracking-widest" />
                        </div>
                      </td>
                      <td className="px-4 py-2 min-w-[180px]">
                        <div className="flex items-center text-xs h-full pt-1">
                          <Mail className="w-3 h-3 mr-2 opacity-30 shrink-0" />
                          <InlineField value={person.email} onSave={(val) => editPerson(idx, 'email', val)} placeholder="Email" className="flex-1" />
                        </div>
                      </td>
                      <td className="px-4 py-2 min-w-[140px]">
                        <div className="flex items-center text-xs h-full pt-1">
                          <Phone className="w-3 h-3 mr-2 opacity-30 shrink-0" />
                          <InlineField value={person.phone} onSave={(val) => editPerson(idx, 'phone', val)} placeholder="Phone" className="flex-1" />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {idx !== 0 && (
                          <button onClick={() => removePerson(idx)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all mt-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Clients;
