import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc,
  updateDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where,
  deleteDoc,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { Task, Client, Staff, Freelancer } from '../types';
import { 
  Search, 
  Plus, 
  Trash2, 
  Link as LinkIcon,
  Edit3,
  ChevronDown,
  UserPlus,
  X,
  FileText,
  Upload,
  CheckSquare,
  Square,
  Calendar,
  Clock,
  Briefcase,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { 
  PageHeader, 
  Button, 
  Card, 
  Table, 
  Input, 
  Select, 
  PermissionError,
  Modal,
  Textarea
} from '../components/UI';
// @ts-ignore
import Papa from 'https://esm.sh/papaparse@5.4.1';
// @ts-ignore
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';
// @ts-ignore
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.2';

// --- Formatting Helpers ---
const formatDateDisplay = (dateStr: string | undefined | null) => {
  if (!dateStr || dateStr === '--' || dateStr === '') return '--';
  try {
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

const formatDateForReport = (dateStr: string | undefined | null) => {
  const display = formatDateDisplay(dateStr);
  return display === '--' ? '' : display;
};

const parseCSVDate = (csvDate: string) => {
  if (!csvDate) return '';
  const parts = csvDate.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return csvDate;
};

const migrateWhoField = (who: any): string[] => {
  if (Array.isArray(who)) return who;
  if (!who || typeof who !== 'string') return [];
  return who.split(/,|\n|&| and /i).map(s => s.trim()).filter(s => s.length > 0);
};

const ToolbarItem: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">{label}</label>
    <div className="flex items-center w-full">{children}</div>
  </div>
);

interface InlineCellProps {
  value: string | number;
  onSave: (newValue: string | number) => void;
  type?: 'text' | 'number' | 'textarea' | 'date';
  className?: string;
  placeholder?: string;
}

const InlineCell: React.FC<InlineCellProps> = ({ value, onSave, type = 'text', className = '', placeholder = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    if (currentValue !== value) onSave(currentValue);
    setIsEditing(false);
  };

  if (isEditing) {
    const commonProps = {
      ref: inputRef as any,
      value: currentValue,
      onChange: (e: any) => setCurrentValue(type === 'number' ? Number(e.target.value) : e.target.value),
      onBlur: handleSave,
      onKeyDown: (e: any) => e.key === 'Enter' && type !== 'textarea' && handleSave(),
      className: "w-full p-2 text-xs font-bold border-2 border-brand-pink rounded bg-white dark:bg-[#0f0f11] focus:outline-none shadow-lg z-10",
      placeholder
    };
    if (type === 'textarea') return <textarea {...commonProps} rows={4} />;
    if (type === 'date') return <input {...commonProps} type="date" className={`${commonProps.className} [color-scheme:light] dark:[color-scheme:dark]`} />;
    return <input {...commonProps} type={type} />;
  }

  const displayValue = type === 'date' ? formatDateDisplay(value as string) : value;
  return (
    <div onDoubleClick={() => setIsEditing(true)} className={`cursor-pointer hover:bg-brand-pink/5 px-2 py-2 rounded transition-colors group relative min-h-[2.5rem] flex items-center ${className}`}>
      <div className="whitespace-normal break-words leading-relaxed w-full">
        {displayValue || <span className="text-gray-300 dark:text-gray-600 italic">{placeholder || 'Empty'}</span>}
      </div>
      <Edit3 className="w-3 h-3 absolute right-1 top-1 text-brand-pink opacity-0 group-hover:opacity-40 transition-opacity" />
    </div>
  );
};

// --- Drive Link Cell ---
interface DriveLinkCellProps {
  value: string;
  onSave: (newValue: string) => void;
}

const DriveLinkCell: React.FC<DriveLinkCellProps> = ({ value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    let trimmed = currentValue.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    if (trimmed !== value) onSave(trimmed);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="h-9 text-[10px] font-bold py-1 px-3 !bg-white dark:!bg-[#0f0f11] border-2 border-brand-pink"
        placeholder="Paste Drive link..."
      />
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className="group relative cursor-pointer hover:bg-brand-pink/5 px-3 py-2 rounded transition-colors flex items-center gap-2 min-h-[40px]"
    >
      {value ? (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-brand-pink font-black text-[10px] uppercase hover:underline"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Open Drive
        </a>
      ) : (
        <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest italic">
          Add Link
        </span>
      )}
      <Edit3 className="w-3 h-3 absolute right-1 top-1 text-brand-pink opacity-0 group-hover:opacity-40 transition-opacity" />
    </div>
  );
};

// --- Custom Who (Assignment) Cell ---
interface SquadOption {
  id: string; // composite id: type:id
  name: string;
  roleLabel: '(rubi)' | '(freelancer)' | '(staff)';
}

interface WhoCellProps {
  assigned: string[];
  onSave: (newAssigned: string[]) => void;
  staff: Staff[];
  freelancers: Freelancer[];
  clients: Client[];
  taskClientId: string;
  selectedFilterClientId: string;
  className?: string;
}

const WhoCell: React.FC<WhoCellProps> = ({ 
  assigned, onSave, staff, freelancers, clients, taskClientId, selectedFilterClientId, className = ""
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectableOptions = useMemo(() => {
    const options: SquadOption[] = [];
    staff.forEach(s => options.push({ id: `rubi:${s.id}`, name: s.name, roleLabel: '(rubi)' }));
    freelancers.forEach(f => options.push({ id: `freelancer:${f.id}`, name: f.name, roleLabel: '(freelancer)' }));
    
    const targetClientId = taskClientId || selectedFilterClientId;
    const targetClient = clients.find(c => c.id === targetClientId);
    
    if (targetClient?.people) {
      targetClient.people.forEach(p => options.push({ id: `staff:${p.email}`, name: p.name, roleLabel: '(staff)' }));
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, freelancers, clients, taskClientId, selectedFilterClientId]);

  const resolveAssignee = (compositeId: string): string => {
    if (!compositeId.includes(':')) return compositeId;
    const [type, id] = compositeId.split(':');
    if (type === 'rubi') return staff.find(s => s.id === id) ? `${staff.find(s => s.id === id)!.name} (rubi)` : compositeId;
    if (type === 'freelancer') return freelancers.find(f => f.id === id) ? `${freelancers.find(f => f.id === id)!.name} (freelancer)` : compositeId;
    if (type === 'staff') {
      const matchingClient = clients.find(c => c.people?.some(p => p.email === id));
      const p = matchingClient?.people?.find(person => person.email === id);
      return p ? `${p.name} (staff)` : compositeId;
    }
    return compositeId;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsEditing(false);
    };
    if (isEditing) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  const togglePerson = (id: string) => {
    const newAssigned = assigned.includes(id) ? assigned.filter(pId => pId !== id) : [...assigned, id];
    onSave(newAssigned);
  };

  const filteredOptions = selectableOptions.filter(opt => 
    (opt.name.toLowerCase().includes(search.toLowerCase()) || opt.roleLabel.toLowerCase().includes(search.toLowerCase())) && 
    !assigned.includes(opt.id)
  );

  return (
    <div ref={containerRef} className={`relative group min-h-[40px] flex items-center ${className}`}>
      <div 
        onClick={() => setIsEditing(true)}
        className="flex flex-wrap gap-1.5 w-full cursor-pointer p-2 rounded hover:bg-brand-pink/5 transition-colors"
      >
        {assigned.length > 0 ? assigned.map(id => (
          <span key={id} className="inline-flex items-center px-2 py-1 bg-brand-pink/10 text-brand-pink text-[10px] font-black rounded-lg border border-brand-pink/20 whitespace-nowrap">
            {resolveAssignee(id)}
            {isEditing && <X className="w-2.5 h-2.5 ml-1.5 cursor-pointer hover:scale-125 transition-transform" onClick={(e) => { e.stopPropagation(); togglePerson(id); }} />}
          </span>
        )) : (
          <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest italic">Unassigned</span>
        )}
        {!isEditing && <Edit3 className="w-3 h-3 absolute right-1 top-1 text-brand-pink opacity-0 group-hover:opacity-40 transition-opacity" />}
      </div>
      {isEditing && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-3 border-b border-gray-50 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input autoFocus type="text" placeholder="Search (rubi, freelancer, staff)..." className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg text-xs font-bold focus:ring-2 focus:ring-brand-pink outline-none dark:text-white" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1 scrollbar-hide">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <button key={opt.id} onClick={() => togglePerson(opt.id)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-brand-pink/10 hover:text-brand-pink rounded-lg transition-colors text-left">
                <div className="flex items-center"><UserPlus className="w-3.5 h-3.5 mr-2 opacity-40" />{opt.name}</div>
                <span className="text-[9px] opacity-60 ml-2 uppercase font-black tracking-tighter">{opt.roleLabel}</span>
              </button>
            )) : <div className="p-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest italic">{!taskClientId && !selectedFilterClientId && search === "" ? "Select a company to see (staff)" : "No squad found"}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

type SortOption = 'dueDateSoonest' | 'dueDateLatest' | 'dateLoggedNewest' | 'dateLoggedOldest' | 'status' | 'who' | 'area' | 'hours';
type StatusValue = 'Not Started' | 'In Progress' | 'Complete';

interface TasksProps {
  initialFilters?: {
    status?: string[];
    searchTerm?: string;
    special?: 'overdue' | 'today' | 'unassigned' | 'assignedInProgress' | null;
  };
}

const REPORT_COLUMNS = [
  'Project', 'Brief', 'Status', 'Content Status', 'Logged', 'Due', 'Complete By', 'Progress', 'Notes', 'Who', 'Versions', 'Area', 'Drive Link', 'Hours'
];

const Tasks: React.FC<TasksProps> = ({ initialFilters }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('dueDateSoonest');
  const [statusFilter, setStatusFilter] = useState<StatusValue[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialTaskState: Partial<Task> = {
    project: '', briefCreatedRequired: '', dateSent: '', contentRequiredReceived: '',
    dateLogged: new Date().toISOString().split('T')[0], dueDate: '', completeBy: '',
    inProgress: 'Not Started', notes: '', who: [], versions: 'V1', area: '',
    driveLink: '', hoursAllocated: 0
  };
  const [newTask, setNewTask] = useState<Partial<Task>>(initialTaskState);

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Report selection state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportColumns, setSelectedReportColumns] = useState<string[]>(REPORT_COLUMNS);
  const [reportTitle, setReportTitle] = useState('Agency To Do List');
  const [reportFormat, setReportFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportStatuses, setReportStatuses] = useState<StatusValue[]>(['Not Started', 'In Progress', 'Complete']);

  useEffect(() => {
    if (initialFilters?.special) {
      if (initialFilters.special === 'unassigned') setStatusFilter(['Not Started', 'In Progress']);
      else if (initialFilters.special === 'today') { setStatusFilter(['Not Started', 'In Progress']); setSearchTerm(new Date().toISOString().split('T')[0]); }
      else if (initialFilters.special === 'overdue') setStatusFilter(['Not Started', 'In Progress']);
      else if (initialFilters.special === 'assignedInProgress') setStatusFilter(['In Progress']);
    }
  }, [initialFilters]);

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))));
    const unsubStaff = onSnapshot(query(collection(db, 'staff'), orderBy('name', 'asc')), (snap) => setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff))));
    const unsubFreelancers = onSnapshot(query(collection(db, 'freelancers'), orderBy('name', 'asc')), (snap) => setFreelancers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer))));
    return () => { unsubClients(); unsubStaff(); unsubFreelancers(); };
  }, []);

  useEffect(() => {
    let q;
    if (selectedClientId) q = query(collection(db, 'clientTasks'), where('clientId', '==', selectedClientId));
    else q = query(collection(db, 'clientTasks'), limit(500)); 
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, who: migrateWhoField(data.who), driveLink: data.driveLink || data.linksToFiles || '' } as Task;
      }));
      setHasError(false);
    }, (err) => { if (err.code === 'permission-denied') setHasError(true); });
  }, [selectedClientId]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const today = new Date().toISOString().split('T')[0];
    if (statusFilter.length > 0) result = result.filter(t => statusFilter.includes(t.inProgress as StatusValue));
    if (initialFilters?.special === 'unassigned') result = result.filter(t => !t.who || t.who.length === 0);
    else if (initialFilters?.special === 'overdue') result = result.filter(t => t.dueDate && t.dueDate < today);
    else if (initialFilters?.special === 'assignedInProgress') result = result.filter(t => t.who && t.who.length > 0);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(t => [t.project, t.notes, t.area, t.dueDate].some(f => f?.toLowerCase().includes(s)));
    }
    return result;
  }, [tasks, searchTerm, statusFilter, initialFilters]);

  const sortedTasks = useMemo(() => {
    const statusPriority: Record<string, number> = { 'Not Started': 1, 'In Progress': 2, 'Complete': 3 };
    return [...filteredTasks].sort((a, b) => {
      switch (sortOption) {
        case 'dueDateSoonest': return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        case 'dueDateLatest': return (b.dueDate || '').localeCompare(a.dueDate || '');
        case 'dateLoggedNewest': return (b.dateLogged || '').localeCompare(a.dateLogged || '');
        case 'status': return (statusPriority[a.inProgress] || 0) - (statusPriority[b.inProgress] || 0);
        case 'hours': return (Number(b.hoursAllocated) || 0) - (Number(a.hoursAllocated) || 0);
        default: return 0;
      }
    });
  }, [filteredTasks, sortOption]);

  const handleUpdateField = async (taskId: string, field: keyof Task, value: any) => {
    await updateDoc(doc(db, 'clientTasks', taskId), { [field]: value, updatedAt: serverTimestamp() });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId && !newTask.clientId) return alert("Select a client first.");
    try {
      await addDoc(collection(db, 'clientTasks'), {
        ...newTask,
        clientId: newTask.clientId || selectedClientId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsCreateModalOpen(false);
      setNewTask(initialTaskState);
    } catch (err) {
      console.error(err);
      alert("Failed to add task.");
    }
  };

  const resolveWhoToNames = (whoIds: string[]) => {
    return whoIds.map(compositeId => {
      if (!compositeId.includes(':')) return compositeId;
      const [type, id] = compositeId.split(':');
      if (type === 'rubi') { const p = staff.find(s => s.id === id); return p ? `${p.name} (rubi)` : compositeId; }
      if (type === 'freelancer') { const p = freelancers.find(f => f.id === id); return p ? `${p.name} (freelancer)` : compositeId; }
      if (type === 'staff') {
        const matchingClient = clients.find(c => c.people?.some(p => p.email === id));
        const p = matchingClient?.people?.find(person => person.email === id);
        return p ? `${p.name} (staff)` : compositeId;
      }
      return compositeId;
    }).join(', ');
  };

  const handleGenerateReport = () => {
    let baseSubset = selectedTaskIds.size > 0 
      ? sortedTasks.filter(t => selectedTaskIds.has(t.id!))
      : sortedTasks;

    // Apply report-specific filters
    let tasksToInclude = baseSubset.filter(t => reportStatuses.includes(t.inProgress as StatusValue));
    
    if (reportStartDate) {
      tasksToInclude = tasksToInclude.filter(t => t.dueDate && t.dueDate >= reportStartDate);
    }
    if (reportEndDate) {
      tasksToInclude = tasksToInclude.filter(t => t.dueDate && t.dueDate <= reportEndDate);
    }

    if (tasksToInclude.length === 0) {
      alert("No tasks match the selected report criteria.");
      return;
    }

    if (reportFormat === 'PDF') {
      const doc = new jsPDF('l', 'mm', 'a4');
      const clientName = selectedClientId ? clients.find(c => c.id === selectedClientId)?.company : 'All Clients';
      
      doc.setFontSize(22);
      doc.setTextColor(237, 9, 131); 
      doc.text(reportTitle, 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Client: ${clientName} | Range: ${reportStartDate || 'Start'} to ${reportEndDate || 'End'} | Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 28);

      const body = tasksToInclude.map(t => {
        const row: any[] = [];
        if (selectedReportColumns.includes('Project')) row.push(t.project);
        if (selectedReportColumns.includes('Brief')) row.push(t.briefCreatedRequired);
        if (selectedReportColumns.includes('Status')) row.push(t.dateSent);
        if (selectedReportColumns.includes('Content Status')) row.push(t.contentRequiredReceived);
        if (selectedReportColumns.includes('Logged')) row.push(formatDateForReport(t.dateLogged));
        if (selectedReportColumns.includes('Due')) row.push(formatDateForReport(t.dueDate));
        if (selectedReportColumns.includes('Complete By')) row.push(formatDateForReport(t.completeBy));
        if (selectedReportColumns.includes('Progress')) row.push(t.inProgress);
        if (selectedReportColumns.includes('Notes')) row.push(t.notes);
        if (selectedReportColumns.includes('Who')) row.push(resolveWhoToNames(t.who || []));
        if (selectedReportColumns.includes('Versions')) row.push(t.versions);
        if (selectedReportColumns.includes('Area')) row.push(t.area);
        if (selectedReportColumns.includes('Drive Link')) row.push(t.driveLink);
        if (selectedReportColumns.includes('Hours')) row.push(t.hoursAllocated);
        return row;
      });

      autoTable(doc, {
        head: [selectedReportColumns],
        body: body,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [237, 9, 131], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [253, 230, 243] }
      });

      doc.save(`${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } else {
      // CSV Format
      const data = tasksToInclude.map(t => {
        const row: any = {};
        if (selectedReportColumns.includes('Project')) row['Project'] = t.project;
        if (selectedReportColumns.includes('Brief')) row['Brief'] = t.briefCreatedRequired;
        if (selectedReportColumns.includes('Status')) row['Status'] = t.dateSent;
        if (selectedReportColumns.includes('Content Status')) row['Content Status'] = t.contentRequiredReceived;
        if (selectedReportColumns.includes('Logged')) row['Logged'] = formatDateForReport(t.dateLogged);
        if (selectedReportColumns.includes('Due')) row['Due'] = formatDateForReport(t.dueDate);
        if (selectedReportColumns.includes('Complete By')) row['Complete By'] = formatDateForReport(t.completeBy);
        if (selectedReportColumns.includes('Progress')) row['Progress'] = t.inProgress;
        if (selectedReportColumns.includes('Notes')) row['Notes'] = t.notes;
        if (selectedReportColumns.includes('Who')) row['Who'] = resolveWhoToNames(t.who || []);
        if (selectedReportColumns.includes('Versions')) row['Versions'] = t.versions;
        if (selectedReportColumns.includes('Area')) row['Area'] = t.area;
        if (selectedReportColumns.includes('Drive Link')) row['Drive Link'] = t.driveLink;
        if (selectedReportColumns.includes('Hours')) row['Hours'] = t.hoursAllocated;
        return row;
      });
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    setIsReportModalOpen(false);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClientId) {
      if (!selectedClientId) alert("Please select a client before importing.");
      return;
    }
    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        try {
          const batch = writeBatch(db);
          for (const row of results.data) {
            const whoNames = (row['Who'] || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const whoIds = whoNames.map((nameLabel: string) => {
              const labelMatch = nameLabel.match(/\(([^)]+)\)$/);
              const label = labelMatch ? labelMatch[1] : '';
              const name = nameLabel.replace(/\s\([^)]+\)$/, '').trim();
              if (label === 'rubi') return `rubi:${staff.find(s => s.name === name)?.id || name}`;
              if (label === 'freelancer') return `freelancer:${freelancers.find(f => f.name === name)?.id || name}`;
              if (label === 'staff') {
                const client = clients.find(c => c.id === selectedClientId);
                const person = client?.people?.find(p => p.name === name);
                return `staff:${person?.email || name}`;
              }
              return nameLabel;
            });

            const taskData = {
              clientId: selectedClientId,
              project: row['Project'] || '',
              briefCreatedRequired: row['Brief'] || '',
              dateSent: row['Status'] || '',
              contentRequiredReceived: row['Content Status'] || '',
              dateLogged: parseCSVDate(row['Logged']),
              dueDate: parseCSVDate(row['Due']),
              completeBy: parseCSVDate(row['Complete By']),
              inProgress: row['Progress'] || 'Not Started',
              notes: row['Notes'] || '',
              who: whoIds,
              versions: row['Versions'] || 'V1',
              area: row['Area'] || '',
              driveLink: row['Drive Link'] || '',
              hoursAllocated: Number(row['Hours']) || 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            const taskRef = doc(collection(db, 'clientTasks'));
            batch.set(taskRef, taskData);
          }
          await batch.commit();
          alert(`Successfully imported ${results.data.length} tasks.`);
        } catch (err) {
          console.error("Import error", err);
          alert("Import failed. Check console for details.");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === sortedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(sortedTasks.map(t => t.id!)));
    }
  };

  const toggleTaskSelection = (id: string) => {
    const next = new Set(selectedTaskIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTaskIds(next);
  };

  if (hasError) return <div className="p-4 md:p-10"><PageHeader title="To do" /><PermissionError /></div>;

  return (
    <div className="p-4 md:p-10 max-w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        .sheets-style-table th { position: sticky !important; top: 0 !important; z-index: 30 !important; background-color: #f9fafb !important; }
        .dark .sheets-style-table th { background-color: #18181b !important; }
        .sheets-style-table th:first-child { left: 0 !important; z-index: 40 !important; box-shadow: 2px 0 4px rgba(0,0,0,0.05); }
        .sheets-scrollbar-container::-webkit-scrollbar { height: 12px; width: 12px; }
        .sheets-scrollbar-container::-webkit-scrollbar-track { background: #f1f1f1; }
        .sheets-scrollbar-container::-webkit-scrollbar-thumb { background: #ccc; border: 2px solid #f1f1f1; }
        .dark .sheets-scrollbar-container::-webkit-scrollbar-track { background: #27272a; }
        .dark .sheets-scrollbar-container::-webkit-scrollbar-thumb { background: #3f3f46; border: 2px solid #27272a; }
      `}} />
      <PageHeader 
        title="Client to do" 
        description={initialFilters?.special ? `Viewing special filter: ${initialFilters.special}` : "Spreadsheet-style management."}
        actions={
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" icon={FileText} onClick={() => setIsReportModalOpen(true)}>Generate Report</Button>
            <div className="relative">
              <Button variant="outline" size="sm" icon={Upload} disabled={isImporting}>Import CSV</Button>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportCSV} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isImporting} />
            </div>
            <Button icon={Plus} size="sm" onClick={() => setIsCreateModalOpen(true)}>Add Task</Button>
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <ToolbarItem label="Client selection">
          <Select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="">-- View All Tasks --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </Select>
        </ToolbarItem>
        <ToolbarItem label="Live search">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 w-4 h-4 z-10" />
            <Input placeholder="Filter projects, areas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-[46px]" />
          </div>
        </ToolbarItem>
        <ToolbarItem label="Status Filter">
          <div className="flex items-center gap-3 px-3 bg-gray-50 dark:bg-[#0f0f11] border border-gray-100 dark:border-dark-border rounded-xl h-[46px] w-full shadow-sm">
            {(['Not Started', 'In Progress', 'Complete'] as StatusValue[]).map((status) => (
              <label key={status} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={statusFilter.includes(status)} onChange={() => setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])} className="w-3.5 h-3.5 rounded border-gray-300 text-brand-pink focus:ring-brand-pink focus:outline-none accent-brand-pink transition-all" />
                <span className={`text-[10px] font-black uppercase tracking-tighter ${statusFilter.includes(status) ? 'text-brand-pink' : 'text-gray-400 dark:text-gray-500'}`}>{status}</span>
              </label>
            ))}
          </div>
        </ToolbarItem>
        <ToolbarItem label="Sort order">
          <Select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)} className="h-[46px]">
            <option value="dueDateSoonest">Due date (soonest)</option>
            <option value="status">Status</option>
            <option value="hours">Hours</option>
          </Select>
        </ToolbarItem>
      </div>

      <Card className="border-none shadow-2xl overflow-hidden bg-white dark:bg-dark-card">
        <div className="w-full overflow-auto max-h-[calc(100vh-320px)] sheets-scrollbar-container">
          <Table className="min-w-[2700px] sheets-style-table" headers={['Project', 'Brief', 'Status', 'Content Status', 'Logged', 'Due', 'Complete By', 'Progress', 'Notes', 'Who', 'Versions', 'Area', 'Drive Link', 'Hours', 'Actions']}>
            {sortedTasks.map(task => (
              <tr key={task.id} className="hover:bg-gray-50/60 dark:hover:bg-dark-bg/50 transition-colors border-b border-gray-50 dark:border-dark-border last:border-0 align-top">
                <td className="px-4 py-2 min-w-[250px] sticky left-0 z-20 bg-white dark:bg-dark-card border-r border-gray-100 dark:border-dark-border shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                  <InlineCell value={task.project} onSave={(val) => handleUpdateField(task.id!, 'project', val)} className="font-black text-sm text-gray-900 dark:text-white" />
                </td>
                <td className="px-4 py-2 min-w-[200px]"><InlineCell value={task.briefCreatedRequired} onSave={(val) => handleUpdateField(task.id!, 'briefCreatedRequired', val)} className="text-[11px] font-bold text-gray-500" /></td>
                <td className="px-4 py-2 min-w-[130px]"><InlineCell value={task.dateSent} onSave={(val) => handleUpdateField(task.id!, 'dateSent', val)} className="text-[11px] font-bold text-gray-400" /></td>
                <td className="px-4 py-2 min-w-[200px]"><InlineCell value={task.contentRequiredReceived} onSave={(val) => handleUpdateField(task.id!, 'contentRequiredReceived', val)} className="text-[11px] font-bold text-gray-500" /></td>
                <td className="px-4 py-2 min-w-[130px]"><InlineCell type="date" value={task.dateLogged} onSave={(val) => handleUpdateField(task.id!, 'dateLogged', val)} className="text-[11px] font-bold text-gray-400 dark:text-gray-500" /></td>
                <td className="px-4 py-2 min-w-[130px]"><InlineCell type="date" value={task.dueDate} onSave={(val) => handleUpdateField(task.id!, 'dueDate', val)} className="text-[11px] font-black text-red-500" /></td>
                <td className="px-4 py-2 min-w-[130px]"><InlineCell type="date" value={task.completeBy} onSave={(val) => handleUpdateField(task.id!, 'completeBy', val)} className="text-[11px] font-black text-green-600 dark:text-green-500" /></td>
                <td className="px-4 py-4 min-w-[160px]">
                  <div className="relative w-full">
                    <select value={task.inProgress} onChange={(e) => handleUpdateField(task.id!, 'inProgress', e.target.value)} className={`w-full px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 appearance-none cursor-pointer transition-colors ${task.inProgress === 'Complete' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/40 dark:text-green-400' : task.inProgress === 'In Progress' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900/40 dark:text-blue-400' : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-dark-bg dark:border-dark-border dark:text-gray-400'}`}>
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Complete">Complete</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40 pointer-events-none" />
                  </div>
                </td>
                <td className="px-4 py-2 min-w-[400px]"><InlineCell value={task.notes} type="textarea" onSave={(val) => handleUpdateField(task.id!, 'notes', val)} className="text-[11px] font-medium text-gray-400 dark:text-gray-500" /></td>
                <td className="px-4 py-4 min-w-[220px]"><WhoCell assigned={task.who || []} staff={staff} freelancers={freelancers} clients={clients} taskClientId={task.clientId} selectedFilterClientId={selectedClientId} onSave={(val) => handleUpdateField(task.id!, 'who', val)} /></td>
                <td className="px-4 py-2 min-w-[100px]"><InlineCell value={task.versions || 'V1'} onSave={(val) => handleUpdateField(task.id!, 'versions', val)} className="text-[11px] font-black text-gray-500 dark:text-gray-400" /></td>
                <td className="px-4 py-2 min-w-[160px]"><InlineCell value={task.area} onSave={(val) => handleUpdateField(task.id!, 'area', val)} className="text-[11px] font-black text-brand-pink" /></td>
                <td className="px-4 py-2 min-w-[160px]"><DriveLinkCell value={task.driveLink || ''} onSave={(val) => handleUpdateField(task.id!, 'driveLink', val)} /></td>
                <td className="px-4 py-2 min-w-[100px]"><InlineCell value={task.hoursAllocated} type="number" onSave={(val) => handleUpdateField(task.id!, 'hoursAllocated', val)} className="text-[11px] font-black text-blue-600 dark:text-blue-400 text-center" /></td>
                <td className="px-4 py-4 text-right sticky right-0 z-20 bg-white dark:bg-dark-card shadow-[-10px_0_20px_rgba(0,0,0,0.04)]">
                  <button onClick={() => { if(confirm("Permanently remove this task?")) deleteDoc(doc(db, 'clientTasks', task.id!)); }} className="p-2.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add Task Intelligence" size="lg">
        <form onSubmit={handleAddTask} className="space-y-8">
          <div className="space-y-6">
             {!selectedClientId && (
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Client / Agency Partner</label>
                  <Select required value={newTask.clientId} onChange={e => setNewTask({...newTask, clientId: e.target.value})}>
                    <option value="">Select Company...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </Select>
               </div>
             )}

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Project Name</label>
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <Input required placeholder="e.g. Q4 Social Media Campaign" className="pl-12" value={newTask.project} onChange={e => setNewTask({...newTask, project: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Brief Status</label>
                <Input placeholder="e.g. Required" value={newTask.briefCreatedRequired} onChange={e => setNewTask({...newTask, briefCreatedRequired: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Status (Internal)</label>
                <Input placeholder="e.g. Sent for review" value={newTask.dateSent} onChange={e => setNewTask({...newTask, dateSent: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Content Status</label>
                <Input placeholder="e.g. Draft Received" value={newTask.contentRequiredReceived} onChange={e => setNewTask({...newTask, contentRequiredReceived: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Progress</label>
                <Select value={newTask.inProgress} onChange={e => setNewTask({...newTask, inProgress: e.target.value as StatusValue})}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Logged Date</label>
                <Input type="date" value={newTask.dateLogged} onChange={e => setNewTask({...newTask, dateLogged: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Due Date</label>
                <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Complete By</label>
                <Input type="date" value={newTask.completeBy} onChange={e => setNewTask({...newTask, completeBy: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Squad Assignment (Who)</label>
              <WhoCell 
                assigned={newTask.who || []} 
                staff={staff} 
                freelancers={freelancers} 
                clients={clients} 
                taskClientId={newTask.clientId || selectedClientId}
                selectedFilterClientId={selectedClientId} 
                onSave={(val) => setNewTask({...newTask, who: val})}
                className="bg-gray-50 dark:bg-[#0f0f11] border border-gray-100 dark:border-dark-border rounded-xl px-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Area</label>
                <Input placeholder="e.g. Design" value={newTask.area} onChange={e => setNewTask({...newTask, area: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Versions</label>
                <Input placeholder="e.g. V1" value={newTask.versions} onChange={e => setNewTask({...newTask, versions: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Hours</label>
                <Input type="number" value={newTask.hoursAllocated} onChange={e => setNewTask({...newTask, hoursAllocated: Number(e.target.value)})} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Drive Link</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <Input placeholder="https://drive.google.com/..." className="pl-12" value={newTask.driveLink} onChange={e => setNewTask({...newTask, driveLink: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Notes & Context</label>
              <Textarea placeholder="Any additional details..." value={newTask.notes} onChange={e => setNewTask({...newTask, notes: e.target.value})} />
            </div>
          </div>
          
          <div className="pt-6 border-t border-gray-100 dark:border-dark-border flex gap-4">
            <Button variant="outline" className="flex-1" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" type="submit">Create Task</Button>
          </div>
        </form>
      </Modal>

      {/* Enhanced Report Modal */}
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Configure Intelligence Export" size="lg">
        <div className="space-y-8">
          {/* Format Selector */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Export Format</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setReportFormat('PDF')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${reportFormat === 'PDF' ? 'border-brand-pink bg-brand-pink/5 text-brand-pink' : 'border-gray-100 dark:border-dark-border text-gray-500'}`}
              >
                <FileText className="w-5 h-5" />
                <span className="font-black text-xs uppercase tracking-widest">Portable PDF</span>
              </button>
              <button 
                onClick={() => setReportFormat('CSV')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${reportFormat === 'CSV' ? 'border-brand-pink bg-brand-pink/5 text-brand-pink' : 'border-gray-100 dark:border-dark-border text-gray-500'}`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="font-black text-xs uppercase tracking-widest">Excel CSV</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Report Title</label>
            <Input value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="e.g. Project Status Report" />
          </div>

          {/* Date Range & Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Due Date Range</label>
               <div className="flex items-center gap-2">
                 <Input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} />
                 <span className="text-gray-300">to</span>
                 <Input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} />
               </div>
            </div>
            <div className="space-y-4">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Progress Status</label>
               <div className="flex flex-wrap gap-2">
                 {(['Not Started', 'In Progress', 'Complete'] as StatusValue[]).map(status => (
                   <label key={status} className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 dark:bg-dark-bg/50 rounded-xl border border-gray-100 dark:border-dark-border">
                     <input 
                       type="checkbox" 
                       checked={reportStatuses.includes(status)} 
                       onChange={() => setReportStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])}
                       className="w-3.5 h-3.5 rounded text-brand-pink accent-brand-pink"
                     />
                     <span className="text-[10px] font-black uppercase tracking-tighter text-gray-600 dark:text-gray-400">{status}</span>
                   </label>
                 ))}
               </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase mb-3 block ml-1">Included Intelligence (Columns)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-dark-bg/50 rounded-2xl border border-gray-100 dark:border-dark-border">
              {REPORT_COLUMNS.map(col => (
                <label key={col} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedReportColumns.includes(col)}
                    onChange={() => setSelectedReportColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                    className="w-4 h-4 rounded border-gray-300 text-brand-pink focus:ring-brand-pink accent-brand-pink"
                  />
                  <span className={`text-[10px] font-bold uppercase transition-colors ${selectedReportColumns.includes(col) ? 'text-brand-pink' : 'text-gray-500 dark:text-gray-400'}`}>
                    {col}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-6 border-t border-gray-100 dark:border-dark-border">
             <div className="flex-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Base Scope</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {selectedTaskIds.size > 0 ? `${selectedTaskIds.size} manual selections` : 'Whole filtered board'}
                </p>
             </div>
             <Button variant="outline" className="flex-1" onClick={() => setIsReportModalOpen(false)}>Cancel</Button>
             <Button className="flex-1" onClick={handleGenerateReport} icon={reportFormat === 'PDF' ? FileText : Download}>
               {reportFormat === 'PDF' ? 'Generate PDF' : 'Export CSV'}
             </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Tasks;