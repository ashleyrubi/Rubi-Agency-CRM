import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Staff } from '../types';
import StatusBadge from '../components/StatusBadge';
import { Plus, Users, Phone, Mail, Edit3, Trash2, Hash, Link as LinkIcon, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PageHeader, Button, Card, Modal, Input, Select, EmptyState, PermissionError, Table } from '../components/UI';

const StaffView: React.FC = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const initialFormState: Partial<Staff> = {
    employeeNumber: '',
    name: '', 
    email: '', 
    role: '', 
    jobRole: '', 
    phone: '', 
    department: '', 
    status: 'Active'
  };

  const [formData, setFormData] = useState<Partial<Staff>>(initialFormState);

  const toSentenceCase = (str: string | undefined | null) => {
    if (!str) return '';
    const s = str.trim();
    if (s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  useEffect(() => {
    const q = query(collection(db, 'staff'), orderBy('name', 'asc'));
    return onSnapshot(q, 
      (snap) => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff)));
        setHasError(false);
      },
      (err) => {
        if (err.code === 'permission-denied') setHasError(true);
        console.error("Staff Firestore Error:", err);
      }
    );
  }, []);

  // Default sorting: employeeNumber ascending, empties at the bottom
  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      const numA = a.employeeNumber || '';
      const numB = b.employeeNumber || '';
      
      if (numA === '' && numB === '') return a.name.localeCompare(b.name);
      if (numA === '') return 1;
      if (numB === '') return -1;
      
      // Try numeric sort if both are numbers, otherwise string sort
      const valA = parseInt(numA, 10);
      const valB = parseInt(numB, 10);
      if (!isNaN(valA) && !isNaN(valB)) {
        return valA - valB;
      }
      return numA.localeCompare(numB);
    });
  }, [staff]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (member: Staff) => {
    setEditingId(member.id!);
    setFormData({
      employeeNumber: member.employeeNumber || '',
      name: member.name,
      email: member.email,
      role: member.role,
      jobRole: member.jobRole,
      phone: member.phone,
      department: member.department,
      status: member.status
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate employeeNumber
    if (formData.employeeNumber) {
      const duplicate = staff.find(s => 
        s.id !== editingId && 
        s.employeeNumber?.toLowerCase() === formData.employeeNumber?.toLowerCase()
      );
      if (duplicate) {
        alert(`Employee number ${formData.employeeNumber} is already assigned to ${duplicate.name}.`);
        return;
      }
    }

    const data = {
      ...formData,
      name: toSentenceCase(formData.name),
      role: toSentenceCase(formData.role),
      jobRole: toSentenceCase(formData.jobRole || formData.role),
      phone: formData.phone || '',
      email: formData.email?.toLowerCase().trim(),
      joinedAt: editingId ? (staff.find(s => s.id === editingId)?.joinedAt || serverTimestamp()) : serverTimestamp()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'staff', editingId), data);
      } else {
        await addDoc(collection(db, 'staff'), data);
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save staff record.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this squad member? This action is permanent.')) {
      await deleteDoc(doc(db, 'staff', id));
    }
  };

  if (hasError) {
    return (
      <div className="p-10">
        <PageHeader title="Rubi Squad" />
        <PermissionError />
      </div>
    );
  }

  return (
    <div className="p-10">
      <PageHeader 
        title="Rubi Squad" 
        description="Internal team members driving agency operations."
        actions={<Button icon={Plus} size="sm" onClick={handleOpenAdd}>Add Staff</Button>}
      />

      <Card className="overflow-hidden">
        <Table headers={['#', 'Staff Member', 'Department', 'Contact', 'Account', 'Status', 'Actions']}>
          {sortedStaff.map(member => (
            <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-bg/50 transition-colors group">
              <td className="px-6 py-4">
                <span className="text-xs font-black text-brand-pink bg-brand-pink/5 px-2 py-1 rounded-lg border border-brand-pink/10">
                  {member.employeeNumber || '--'}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-dark-bg text-gray-500 font-black flex items-center justify-center mr-3 border border-gray-100 dark:border-dark-border group-hover:bg-brand-pink group-hover:text-white transition-colors">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900 dark:text-white">{member.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{member.jobRole || member.role}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{member.department}</span>
              </td>
              <td className="px-6 py-4">
                <div className="space-y-1">
                  <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 font-medium">
                    <Mail className="w-3 h-3 mr-2 opacity-50" /> {member.email}
                  </div>
                  {member.phone && (
                    <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 font-medium">
                      <Phone className="w-3 h-3 mr-2 opacity-50" /> {member.phone}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {member.linked ? (
                    <div className="flex items-center text-green-600 gap-1.5" title="Connected to Firebase Auth">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Linked</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-400 gap-1.5" title="No matching account detected">
                      <ShieldAlert className="w-4 h-4 opacity-50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Unlinked</span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={member.status} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => handleOpenEdit(member)}
                    className="p-2 bg-gray-50 dark:bg-dark-bg text-gray-400 hover:text-brand-pink rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(member.id!)}
                    className="p-2 bg-gray-50 dark:bg-dark-bg text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {staff.length === 0 && (
          <EmptyState 
            icon={Users} 
            message="Squad is Empty" 
            submessage="Build your dream team by registering your first employee." 
          />
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Squad Member' : 'New Squad Member'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Employee #</label>
              <Input placeholder="e.g. 101" value={formData.employeeNumber} onChange={e => setFormData({...formData, employeeNumber: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Full Name</label>
              <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Work Email</label>
              <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Phone</label>
              <Input placeholder="Work or direct mobile" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Job Role</label>
              <Input placeholder="e.g. Creative Director" value={formData.jobRole} onChange={e => setFormData({...formData, jobRole: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Department</label>
              <Select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                <option value="">Choose Dept</option>
                <option>Creative</option>
                <option>Accounts</option>
                <option>Tech</option>
                <option>Operations</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Status</label>
            <Select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
            </Select>
          </div>

          <Button className="w-full mt-4" type="submit">
            {editingId ? 'Update Member' : 'Add Staff'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default StaffView;