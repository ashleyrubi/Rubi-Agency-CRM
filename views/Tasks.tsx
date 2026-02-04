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
  writeBatch,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { Task, Client, Staff, Freelancer } from '../types';
import { 
  Search, 
  Plus, 
  FileText,
  CheckCircle,
  FileUp,
  Trash2,
  Link as LinkIcon,
  Edit3,
  X as CloseIcon,
  ArrowUpDown,
  Filter,
  Clock,
  Download,
  Calendar
} from 'lucide-react';
import { 
  PageHeader, 
  Button, 
  Card, 
  Table, 
  Input, 
  Select, 
  Modal, 
  EmptyState, 
  PermissionError, 
  Textarea 
} from '../components/UI';
// @ts-ignore
import Papa from 'https://esm.sh/papaparse@5.4.1';
// @ts-ignore
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';
// @ts-ignore
import autoTable from 'https://esm.sh/jspdf-autotable@3.8.2';

// --- Formatting Helpers ---
const toSentenceCase = (str: any) => {
  if (!str || typeof str !== 'string') return str || '';
  const s = str.trim();
  if (s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatDateDisplay = (dateStr: string | undefined | null) => {
  if (!dateStr || dateStr === '--' || dateStr === '') return '--';
  try {
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
    }
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

// --- Shared Toolbar Component ---
const ToolbarItem: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">{label}</label>
    <div className="flex items-center w-full">{children}</div>
  </div>
);

// --- Migration Utility ---
const migrateWhoField = (who: any): string[] => {
  if (Array.isArray(who)) return who;
  if (!who || typeof who !== 'string') return [];
  return who
    .split(/,|\n|&| and /i)
    .map(s => s.trim())
    .filter(s => s.length > 0);
};

// --- Inline Editor Component ---
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
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (currentValue !== value) {
      onSave(currentValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') handleSave();
    if (e.key === 'Escape') {
      setCurrentValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    const commonProps = {
      ref: inputRef as any,
      value: currentValue,
      onChange: (e: any) => setCurrentValue(type === 'number' ? Number(e.target.value) : e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className: "w-full p-2 text-xs font-bold border-2 border-brand-pink rounded bg-white dark:bg-dark-bg focus:outline-none shadow-lg z-10",
      placeholder
    };

    if (type === 'textarea') return <textarea {...commonProps} rows={4} />;
    if (type === 'date') return <input {...commonProps} type="date" />;
    return <input {...commonProps} type={type} />;
  }

  const displayValue = type === 'date' ? formatDateDisplay(value as string) : value;

  return (
    <div 
      onDoubleClick={() => setIsEditing(true)}
      className={`cursor-pointer hover:bg-brand-pink/5 px-2 py-2 rounded transition-colors group relative min-h-[2.5rem] flex items-center ${className}`}
      title="Double-click to edit"
    >
      <div className="whitespace-normal break-words leading-relaxed w-full">
        {displayValue || <span className="text-gray-300 italic">{placeholder || 'Empty'}</span>}
      </div>
      <Edit3 className="w-3 h-3 absolute right-1 top-1 text-brand-pink opacity-0 group-hover:opacity-40 transition-opacity" />
    </div>
  );
};

type SortOption = 'dueDateSoonest' | 'dueDateLatest' | 'dateLoggedNewest' | 'dateLoggedOldest' | 'status' | 'who' | 'area' | 'hours';
type StatusValue = 'Not Started' | 'In Progress' | 'Complete';

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('dueDateSoonest');
  const [statusFilter, setStatusFilter] = useState<StatusValue[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report Config State
  const [reportConfig, setReportConfig] = useState({
    completed: true,
    inProgress: true,
    notStarted: true,
    overdue: true,
    includeNotes: true,
    includeLinks: true,
    groupByArea: false,
    groupByWho: false,
    groupByProject: false,
    includeHoursTotals: true,
    includeStatusTotals: true,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    dateBasis: 'dueDate' as 'dueDate' | 'dateLogged'
  });

  const initialTaskState: Partial<Task> = {
    project: '',
    briefCreatedRequired: '',
    contentRequiredReceived: '',
    dateLogged: '',
    dateSent: '',
    dueDate: '',
    completeBy: '',
    inProgress: 'Not Started',
    notes: '',
    who: [],
    versions: 'V1',
    area: '',
    linksToFiles: '',
    hoursAllocated: 0
  };

  const [newTask, setNewTask] = useState<Partial<Task>>(initialTaskState);

  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), 
      (snap) => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
        setHasError(false);
      },
      (err) => { if (err.code === 'permission-denied') setHasError(true); }
    );

    const unsubStaff = onSnapshot(query(collection(db, 'staff'), orderBy('name', 'asc')), 
      (snap) => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff)));
      }
    );

    const unsubFreelancers = onSnapshot(query(collection(db, 'freelancers'), orderBy('name', 'asc')), 
      (snap) => {
        setFreelancers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer)));
      }
    );

    return () => {
      unsubClients();
      unsubStaff();
      unsubFreelancers();
    };
  }, []);

  useEffect(() => {
    if (!selectedClientId) { setTasks([]); return; }
    const q = query(collection(db, 'clientTasks'), where('clientId', '==', selectedClientId));
    return onSnapshot(q, 
      (snap) => {
        const loadedTasks = snap.docs.map(d => {
          const data = d.data();
          const migratedWho = migrateWhoField(data.who);
          return { id: d.id, ...data, who: migratedWho } as Task;
        });
        setTasks(loadedTasks);
        setHasError(false);
      },
      (err) => { if (err.code === 'permission-denied') setHasError(true); }
    );
  }, [selectedClientId]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    
    // Multi-select Status Filter
    if (statusFilter.length > 0) {
      result = result.filter(t => statusFilter.includes(t.inProgress as StatusValue));
    }
    
    // Search Filter
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(t => [t.project, t.notes, t.area, ...(t.who || [])].some(f => f?.toLowerCase().includes(s)));
    }
    
    return result;
  }, [tasks, searchTerm, statusFilter]);

  const sortedTasks = useMemo(() => {
    const statusPriority: Record<string, number> = {
      'Not Started': 1,
      'In Progress': 2,
      'Complete': 3
    };

    return [...filteredTasks].sort((a, b) => {
      switch (sortOption) {
        case 'dueDateSoonest':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        case 'dueDateLatest':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return b.dueDate.localeCompare(a.dueDate);
        case 'dateLoggedNewest':
          if (!a.dateLogged) return 1;
          if (!b.dateLogged) return -1;
          return b.dateLogged.localeCompare(a.dateLogged);
        case 'dateLoggedOldest':
          if (!a.dateLogged) return 1;
          if (!b.dateLogged) return -1;
          return a.dateLogged.localeCompare(b.dateLogged);
        case 'status':
          return (statusPriority[a.inProgress] || 0) - (statusPriority[b.inProgress] || 0);
        case 'who':
          const whoA = (a.who?.[0] || '').toLowerCase();
          const whoB = (b.who?.[0] || '').toLowerCase();
          return whoA.localeCompare(whoB);
        case 'area':
          return (a.area || '').localeCompare(b.area || '');
        case 'hours':
          return (Number(b.hoursAllocated) || 0) - (Number(a.hoursAllocated) || 0);
        default:
          return 0;
      }
    });
  }, [filteredTasks, sortOption]);

  const hourStats = useMemo(() => {
    return filteredTasks.reduce((acc, task) => {
      const hrs = Number(task.hoursAllocated) || 0;
      acc.total += hrs;
      if (task.inProgress === 'Complete') acc.complete += hrs;
      if (task.inProgress === 'In Progress') acc.inProgress += hrs;
      if (task.inProgress === 'Not Started') acc.notStarted += hrs;
      return acc;
    }, { total: 0, complete: 0, inProgress: 0, notStarted: 0 });
  }, [filteredTasks]);

  const getWhoOptions = (clientId?: string) => {
    const options: { name: string; type: string }[] = [];
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client?.people && client.people.length > 0) {
        client.people.forEach(p => { if (p.name) options.push({ name: p.name, type: 'Client' }); });
      } else if (client?.contactPerson) {
        options.push({ name: client.contactPerson, type: 'Client' });
      }
    }
    staff.forEach(s => options.push({ name: s.name, type: 'Staff' }));
    freelancers.forEach(f => options.push({ name: f.name, type: 'Freelancer' }));

    const uniqueOptions = options.reduce((acc, current) => {
      const x = acc.find(item => item.name === current.name);
      if (!x) return acc.concat([current]);
      return acc;
    }, [] as { name: string; type: string }[]);

    return uniqueOptions.sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleUpdateField = async (taskId: string, field: keyof Task, value: any) => {
    try {
      let finalValue = value;
      const textFieldKeys: (keyof Task)[] = ['project', 'briefCreatedRequired', 'contentRequiredReceived', 'notes', 'area', 'versions'];
      if (textFieldKeys.includes(field)) {
        finalValue = toSentenceCase(value);
      }
      await updateDoc(doc(db, 'clientTasks', taskId), {
        [field]: finalValue,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  const handleAddWho = async (taskId: string, currentWho: string[], newPerson: string) => {
    if (!newPerson || currentWho.includes(newPerson)) return;
    const updatedWho = [...currentWho, newPerson];
    await handleUpdateField(taskId, 'who', updatedWho);
  };

  const handleRemoveWho = async (taskId: string, currentWho: string[], personToRemove: string) => {
    const updatedWho = currentWho.filter(p => p !== personToRemove);
    await handleUpdateField(taskId, 'who', updatedWho);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...newTask,
      clientId: selectedClientId,
      project: toSentenceCase(newTask.project),
      briefCreatedRequired: toSentenceCase(newTask.briefCreatedRequired),
      contentRequiredReceived: toSentenceCase(newTask.contentRequiredReceived),
      notes: toSentenceCase(newTask.notes),
      who: newTask.who || [], 
      area: toSentenceCase(newTask.area),
      versions: toSentenceCase(newTask.versions),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await addDoc(collection(db, 'clientTasks'), data);
    setIsCreateModalOpen(false);
    setNewTask(initialTaskState);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this record permanently?')) {
      await deleteDoc(doc(db, 'clientTasks', id));
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClientId) return;
    setIsImporting(true);
    setImportStatus('Syncing agency workflow...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        try {
          const batch = writeBatch(db);
          const colRef = collection(db, 'clientTasks');
          let count = 0;
          for (const row of results.data) {
            const projectName = row['Project'] || row['project'];
            if (!projectName) continue;
            const taskDoc = doc(colRef);
            batch.set(taskDoc, {
              clientId: selectedClientId,
              project: toSentenceCase(projectName),
              briefCreatedRequired: toSentenceCase(row['Brief Created/Required'] || ''),
              contentRequiredReceived: toSentenceCase(row['Content Required and Received'] || ''),
              dateLogged: row['Date Logged'] || '',
              dateSent: row['Date Sent'] || '',
              dueDate: row['Due Date'] || '',
              completeBy: row['Complete By'] || '',
              inProgress: row['In Progress'] || 'Not Started',
              notes: toSentenceCase(row['Notes'] || ''),
              who: migrateWhoField(row['Who'] || ''),
              versions: toSentenceCase(row['Versions'] || 'V1'),
              area: toSentenceCase(row['Area'] || ''),
              linksToFiles: row['Links To Files'] || '',
              hoursAllocated: Number(row['Hours Allocated']) || 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            count++;
          }
          if (count > 0) {
            await batch.commit();
            setImportStatus(`Success: ${count} items added.`);
          }
        } catch (error) {
          setImportStatus('Import failed.');
        } finally {
          setIsImporting(false);
          setTimeout(() => setImportStatus(null), 4000);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };

  const handleToggleStatus = (status: StatusValue) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter(s => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };

  // --- Report Generation Logic ---
  const reportTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let result = tasks.filter(task => {
      // Date basis filter
      const taskDate = task[reportConfig.dateBasis];
      if (!taskDate) return false;
      if (taskDate < reportConfig.startDate || taskDate > reportConfig.endDate) return false;

      // Check logic
      const isComplete = task.inProgress === 'Complete';
      const isInProgress = task.inProgress === 'In Progress' || task.inProgress === 'Yes';
      const isNotStarted = task.inProgress === 'Not Started' || task.inProgress === 'No';
      const isOverdue = task.dueDate && task.dueDate < today && task.inProgress !== 'Complete';

      const matchesCompleted = reportConfig.completed && isComplete;
      const matchesInProgress = reportConfig.inProgress && isInProgress;
      const matchesNotStarted = reportConfig.notStarted && isNotStarted;
      const matchesOverdue = reportConfig.overdue && isOverdue;

      return matchesCompleted || matchesInProgress || matchesNotStarted || matchesOverdue;
    });

    // Grouping / Sorting
    result.sort((a, b) => {
      if (reportConfig.groupByArea) {
        const areaA = (a.area || '').toLowerCase();
        const areaB = (b.area || '').toLowerCase();
        if (areaA !== areaB) return areaA.localeCompare(areaB);
      }
      if (reportConfig.groupByWho) {
        const whoA = (a.who?.[0] || '').toLowerCase();
        const whoB = (b.who?.[0] || '').toLowerCase();
        if (whoA !== whoB) return whoA.localeCompare(whoB);
      }
      if (reportConfig.groupByProject) {
        const projA = (a.project || '').toLowerCase();
        const projB = (b.project || '').toLowerCase();
        if (projA !== projB) return projA.localeCompare(projB);
      }
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });

    return result;
  }, [tasks, reportConfig]);

  const reportSummary = useMemo(() => {
    return reportTasks.reduce((acc, task) => {
      const hrs = Number(task.hoursAllocated) || 0;
      acc.totalTasks++;
      acc.totalHours += hrs;
      
      const status = task.inProgress === 'Complete' ? 'Complete' : 
                     (task.inProgress === 'In Progress' || task.inProgress === 'Yes' ? 'In Progress' : 'Not Started');
      
      acc.hoursByStatus[status] = (acc.hoursByStatus[status] || 0) + hrs;
      acc.countByStatus[status] = (acc.countByStatus[status] || 0) + 1;
      
      return acc;
    }, { 
      totalTasks: 0, 
      totalHours: 0, 
      hoursByStatus: {} as Record<string, number>, 
      countByStatus: {} as Record<string, number> 
    });
  }, [reportTasks]);

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    const todayStr = new Date().toLocaleDateString('en-GB');
    const timeStr = new Date().toLocaleTimeString('en-GB');
    const clientName = clients.find(c => c.id === selectedClientId)?.company || 'All Clients';

    // 1. styled Cover Header
    doc.setFontSize(26);
    doc.setTextColor(237, 9, 131); // Brand Pink
    doc.text('RUBI AGENCY', 14, 25);
    
    doc.setFontSize(16);
    doc.setTextColor(50, 50, 50);
    doc.text('Client To Do Report', 14, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Brand: ${clientName}`, 14, 45);
    doc.text(`Period: ${formatDateDisplay(reportConfig.startDate)} to ${formatDateDisplay(reportConfig.endDate)}`, 14, 51);
    doc.text(`Generated on: ${todayStr} at ${timeStr}`, 14, 57);

    // 2. Summary Section
    doc.setDrawColor(230, 230, 230);
    doc.line(14, 63, 196, 63);
    
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text('Agency Summary', 14, 73);
    
    doc.setFontSize(10);
    doc.text(`Total Tasks Included: ${reportSummary.totalTasks}`, 14, 82);
    doc.text(`Total Hours Allocated: ${reportSummary.totalHours.toFixed(1)} hrs`, 14, 88);
    
    let yPos = 94;
    Object.entries(reportSummary.countByStatus).forEach(([status, count]) => {
      doc.text(`${status}: ${count} items (${reportSummary.hoursByStatus[status].toFixed(1)} hrs)`, 14, yPos);
      yPos += 6;
    });
    
    const todayIso = new Date().toISOString().split('T')[0];
    const overdueCount = reportTasks.filter(t => t.dueDate && t.dueDate < todayIso && t.inProgress !== 'Complete').length;
    if (overdueCount > 0) {
      doc.setTextColor(237, 9, 131);
      doc.text(`Overdue items: ${overdueCount}`, 14, yPos);
      doc.setTextColor(100, 100, 100);
      yPos += 6;
    }

    // 3. Main Table Construction
    const tableHeaders = [['Project', 'Area', 'Who', 'Status', 'Logged', 'Due', 'By', 'Hrs']];
    if (reportConfig.includeNotes) tableHeaders[0].splice(7, 0, 'Notes');
    if (reportConfig.includeLinks) tableHeaders[0].splice(tableHeaders[0].length - 1, 0, 'Link');

    const tableData = reportTasks.map(t => {
      const row: any[] = [
        t.project,
        t.area,
        (t.who || []).join(', '),
        t.inProgress,
        formatDateDisplay(t.dateLogged),
        formatDateDisplay(t.dueDate),
        formatDateDisplay(t.completeBy),
        t.hoursAllocated
      ];
      if (reportConfig.includeNotes) row.splice(7, 0, t.notes);
      if (reportConfig.includeLinks) row.splice(row.length - 1, 0, t.linksToFiles);
      return row;
    });

    autoTable(doc, {
      startY: yPos + 10,
      head: tableHeaders,
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [237, 9, 131], 
        textColor: [255, 255, 255], 
        fontSize: 8, 
        fontStyle: 'bold' 
      },
      styles: { 
        fontSize: 7, 
        cellPadding: 2, 
        overflow: 'linebreak' 
      },
      columnStyles: {
        0: { cellWidth: 40 }, // Project
        7: { halign: 'center' } // Hours
      },
      didDrawPage: (data: any) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${data.pageNumber}`, 196, 285, { align: 'right' });
        doc.text('RUBI AGENCY COMMAND REPORT', 14, 285);
      }
    });

    doc.save(`Rubi_Agency_Report_${clientName.replace(/\s+/g, '_')}_${todayIso}.pdf`);
  };

  if (hasError) return <div className="p-4 md:p-10"><PageHeader title="To do" /><PermissionError /></div>;

  return (
    <div className="p-4 md:p-10 max-w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        .sheets-style-table th {
          position: sticky !important;
          top: 0 !important;
          z-index: 30 !important;
          background-color: #f9fafb !important;
        }
        .dark .sheets-style-table th {
          background-color: #18181b !important;
        }
        .sheets-style-table th:first-child {
          left: 0 !important;
          z-index: 40 !important;
          box-shadow: 2px 0 4px rgba(0,0,0,0.05);
        }
        /* Custom Google Sheets Scrollbars */
        .sheets-scrollbar-container::-webkit-scrollbar {
          height: 12px;
          width: 12px;
        }
        .sheets-scrollbar-container::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .sheets-scrollbar-container::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 0px;
          border: 2px solid #f1f1f1;
        }
        .sheets-scrollbar-container::-webkit-scrollbar-thumb:hover {
          background: #999;
        }
        .dark .sheets-scrollbar-container::-webkit-scrollbar-track {
          background: #27272a;
        }
        .dark .sheets-scrollbar-container::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border: 2px solid #27272a;
        }
      `}} />
      <PageHeader 
        title="Client to do" 
        description="Spreadsheet-style management. Double-click fields to edit. Manage multi-assignees instantly."
        actions={selectedClientId && (
          <div className="flex gap-2 w-full sm:w-auto">
            <Button icon={FileText} variant="outline" size="sm" onClick={() => setIsReportModalOpen(true)}>Report</Button>
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvImport} />
            <Button icon={isImporting ? undefined : FileUp} variant="outline" size="sm" disabled={isImporting} onClick={() => fileInputRef.current?.click()}>
              {isImporting ? 'Syncing...' : 'Import csv'}
            </Button>
            <Button icon={Plus} size="sm" onClick={() => setIsCreateModalOpen(true)}>Add Task</Button>
          </div>
        )}
      />

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <ToolbarItem label="Client selection">
          <Select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="">-- Choose brand partner --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </Select>
        </ToolbarItem>

        {selectedClientId && (
          <>
            <ToolbarItem label="Live search">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Filter project, who, area..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-pink focus:outline-none dark:text-white shadow-sm h-[46px]"
                />
              </div>
            </ToolbarItem>
            <ToolbarItem label="Status Filter">
              <div className="flex items-center gap-3 px-3 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-xl h-[46px] w-full shadow-sm overflow-x-auto scrollbar-hide">
                {(['Not Started', 'In Progress', 'Complete'] as StatusValue[]).map((status) => (
                  <label key={status} className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(status)}
                      onChange={() => handleToggleStatus(status)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-brand-pink focus:ring-brand-pink accent-brand-pink"
                    />
                    <span className={`text-[10px] font-black uppercase tracking-tighter whitespace-nowrap transition-colors ${statusFilter.includes(status) ? 'text-brand-pink' : 'text-gray-400 group-hover:text-gray-600'}`}>
                      {status}
                    </span>
                  </label>
                ))}
              </div>
            </ToolbarItem>
            <ToolbarItem label="Sort order">
  <Select
    value={sortOption}
    onChange={(e) => setSortOption(e.target.value as SortOption)}
  >
    <option value="dueDateSoonest">Due date (soonest first)</option>
    <option value="dueDateLatest">Due date (latest first)</option>
    <option value="dateLoggedNewest">Logged (newest first)</option>
    <option value="dateLoggedOldest">Logged (oldest first)</option>
    <option value="status">Status (logical flow)</option>
    <option value="who">Who (assignee)</option>
    <option value="area">Area</option>
    <option value="hours">Hours allocated (highest)</option>
  </Select>
</ToolbarItem>
          </>
        )}
      </div>

      {selectedClientId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white dark:bg-dark-card p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border mb-8">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-brand-pink" /> Total Visible
            </span>
            <span className="text-xl font-black text-gray-900 dark:text-white">{hourStats.total} hrs</span>
          </div>
          <div className="flex flex-col border-l border-gray-50 dark:border-dark-border pl-4">
            <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Complete</span>
            <span className="text-xl font-black text-green-600">{hourStats.complete} hrs</span>
          </div>
          <div className="flex flex-col border-l border-gray-50 dark:border-dark-border pl-4">
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">In Progress</span>
            <span className="text-xl font-black text-blue-600">{hourStats.inProgress} hrs</span>
          </div>
          <div className="flex flex-col border-l border-gray-50 dark:border-dark-border pl-4">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Not Started</span>
            <span className="text-xl font-black text-gray-500">{hourStats.notStarted} hrs</span>
          </div>
        </div>
      )}

      {!selectedClientId ? (
        <Card className="border-dashed py-32 flex justify-center bg-gray-50/10">
          <EmptyState icon={FileText} message="Brand selection required" submessage="Select a client to manage their specific agency deliverables." />
        </Card>
      ) : (
        <Card className="border-none shadow-2xl bg-white dark:bg-dark-card overflow-hidden">
          {/* Height constrained wrapper to keep horizontal scrollbar visible within the viewport area */}
          <div className="w-full overflow-auto max-h-[calc(100vh-320px)] sheets-scrollbar-container">
            <Table className="min-w-[2600px] sheets-style-table" headers={[
              'Project', 'Brief Status', 'Content Status', 'Date Logged', 'Date Sent', 'Due Date', 'Complete By', 'Progress Status', 'Notes', 'Who', 'Versions', 'Area', 'Drive Link', 'Hours', 'Actions'
            ]}>
              {sortedTasks.map(task => {
                const whoOptions = getWhoOptions(task.clientId);
                const currentWho = task.who || [];
                return (
                  <tr key={task.id} className="hover:bg-gray-50/60 dark:hover:bg-dark-bg/50 transition-colors border-b border-gray-50 dark:border-dark-border last:border-0 group align-top">
                    <td className="px-4 py-2 min-w-[250px] sticky left-0 z-20 bg-white dark:bg-dark-card border-r border-gray-100 dark:border-dark-border shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                      <InlineCell value={task.project} onSave={(val) => handleUpdateField(task.id!, 'project', val)} className="font-black text-sm text-gray-900 dark:text-white" />
                    </td>
                    <td className="px-4 py-2 min-w-[200px]">
                      <InlineCell value={task.briefCreatedRequired} onSave={(val) => handleUpdateField(task.id!, 'briefCreatedRequired', val)} className="text-[11px] font-bold text-gray-500" />
                    </td>
                    <td className="px-4 py-2 min-w-[200px]">
                      <InlineCell value={task.contentRequiredReceived} onSave={(val) => handleUpdateField(task.id!, 'contentRequiredReceived', val)} className="text-[11px] font-bold text-gray-500" />
                    </td>
                    <td className="px-4 py-2 min-w-[130px]">
                      <InlineCell type="date" value={task.dateLogged} onSave={(val) => handleUpdateField(task.id!, 'dateLogged', val)} className="text-[11px] font-bold text-gray-400" />
                    </td>
                    <td className="px-4 py-2 min-w-[130px]">
                      <InlineCell type="date" value={task.dateSent} onSave={(val) => handleUpdateField(task.id!, 'dateSent', val)} className="text-[11px] font-bold text-gray-400" />
                    </td>
                    <td className="px-4 py-2 min-w-[130px]">
                      <InlineCell type="date" value={task.dueDate} onSave={(val) => handleUpdateField(task.id!, 'dueDate', val)} className="text-[11px] font-black text-red-500" />
                    </td>
                    <td className="px-4 py-2 min-w-[130px]">
                      <InlineCell type="date" value={task.completeBy} onSave={(val) => handleUpdateField(task.id!, 'completeBy', val)} className="text-[11px] font-black text-green-600" />
                    </td>
                    <td className="px-4 py-4 min-w-[160px]">
                      <select 
                        value={task.inProgress === 'Yes' ? 'In Progress' : task.inProgress === 'No' ? 'Not Started' : task.inProgress}
                        onChange={(e) => handleUpdateField(task.id!, 'inProgress', e.target.value)}
                        className={`w-full px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border-2 focus:outline-none appearance-none cursor-pointer transition-colors ${
                          task.inProgress === 'Complete' ? 'bg-green-50 border-green-200 text-green-700' : 
                          task.inProgress === 'In Progress' || task.inProgress === 'Yes' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                          'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Complete">Complete</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 min-w-[400px]">
                      <InlineCell value={task.notes} type="textarea" onSave={(val) => handleUpdateField(task.id!, 'notes', val)} className="text-[11px] font-medium text-gray-400" />
                    </td>
                    <td className="px-4 py-4 min-w-[220px]">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {currentWho.map(person => (
                          <span key={person} className="inline-flex items-center px-2 py-1 bg-brand-pink/10 text-brand-pink text-[10px] font-black rounded-lg border border-brand-pink/20">
                            {person}
                            <button onClick={() => handleRemoveWho(task.id!, currentWho, person)} className="ml-1.5 hover:text-red-500 transition-colors">
                              <CloseIcon className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <select value="" onChange={(e) => handleAddWho(task.id!, currentWho, e.target.value)} className="w-full px-2 py-1.5 rounded-lg text-[10px] font-bold border border-gray-100 bg-gray-50/50 dark:bg-dark-bg focus:border-brand-pink focus:outline-none appearance-none cursor-pointer text-gray-500 transition-colors h-[32px]">
                        <option value="">+ Add Assignee</option>
                        {whoOptions.filter(opt => !currentWho.includes(opt.name)).map(opt => (
                          <option key={`${opt.type}-${opt.name}`} value={opt.name}>{opt.name} ({opt.type})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 min-w-[100px]">
                      <InlineCell value={task.versions || 'V1'} onSave={(val) => handleUpdateField(task.id!, 'versions', val)} className="text-[11px] font-black text-gray-500" />
                    </td>
                    <td className="px-4 py-2 min-w-[160px]">
                      <InlineCell value={task.area} onSave={(val) => handleUpdateField(task.id!, 'area', val)} className="text-[11px] font-black text-brand-pink" />
                    </td>
                    <td className="px-4 py-2 min-w-[160px]">
                      <div className="flex flex-col gap-1">
                        <InlineCell value={task.linksToFiles} placeholder="Paste link..." onSave={(val) => handleUpdateField(task.id!, 'linksToFiles', val)} className="text-[10px] text-gray-400" />
                        {task.linksToFiles && (
                          <a href={task.linksToFiles} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-pink hover:underline font-black text-[9px] uppercase px-2">
                            <LinkIcon className="w-2.5 h-2.5" /> View Folder
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 min-w-[100px]">
                      <InlineCell value={task.hoursAllocated} type="number" onSave={(val) => handleUpdateField(task.id!, 'hoursAllocated', val)} className="text-[11px] font-black text-blue-600 text-center" />
                    </td>
                    <td className="px-4 py-4 text-right sticky right-0 z-20 bg-white dark:bg-dark-card shadow-[-10px_0_20px_rgba(0,0,0,0.04)] min-w-[80px]">
                      <button onClick={() => handleDelete(task.id!)} className="p-2.5 rounded-lg bg-gray-50 dark:bg-dark-bg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
          {sortedTasks.length === 0 && <EmptyState icon={CheckCircle} message="Queue empty" submessage="Import your agency workflow or create a new entry." />}
        </Card>
      )}

      {/* Report Modal */}
      <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title="Generate report" size="lg">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Filter Basis & Date Range */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-3 h-3 text-brand-pink" /> Period & Basis
              </h4>
              <div className="flex flex-col gap-3">
                <ToolbarItem label="Date Basis">
                  <Select value={reportConfig.dateBasis} onChange={e => setReportConfig({...reportConfig, dateBasis: e.target.value as any})}>
                    <option value="dueDate">Due Date</option>
                    <option value="dateLogged">Date Logged</option>
                  </Select>
                </ToolbarItem>
                <div className="grid grid-cols-2 gap-3">
                  <ToolbarItem label="Start Date">
                    <Input type="date" value={reportConfig.startDate} onChange={e => setReportConfig({...reportConfig, startDate: e.target.value})} />
                  </ToolbarItem>
                  <ToolbarItem label="End Date">
                    <Input type="date" value={reportConfig.endDate} onChange={e => setReportConfig({...reportConfig, endDate: e.target.value})} />
                  </ToolbarItem>
                </div>
              </div>
            </div>

            {/* Status Filters */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Filter className="w-3 h-3 text-brand-pink" /> Include Statuses
              </h4>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                {[
                  { id: 'completed', label: 'Completed tasks' },
                  { id: 'inProgress', label: 'In progress tasks' },
                  { id: 'notStarted', label: 'Not started tasks' },
                  { id: 'overdue', label: 'Overdue tasks' }
                ].map(opt => (
                  <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={(reportConfig as any)[opt.id]} 
                      onChange={e => setReportConfig({...reportConfig, [opt.id]: e.target.checked})}
                      className="w-4 h-4 rounded border-gray-300 text-brand-pink accent-brand-pink focus:ring-brand-pink"
                    />
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300 group-hover:text-brand-pink transition-colors">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-gray-50 dark:border-dark-border">
            {/* Display Options */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-3 h-3 text-brand-pink" /> Content & Totals
              </h4>
              <div className="grid grid-cols-1 gap-y-3">
                {[
                  { id: 'includeNotes', label: 'Include notes' },
                  { id: 'includeLinks', label: 'Include drive links' },
                  { id: 'includeHoursTotals', label: 'Include hours totals' },
                  { id: 'includeStatusTotals', label: 'Include status time totals' }
                ].map(opt => (
                  <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={(reportConfig as any)[opt.id]} 
                      onChange={e => setReportConfig({...reportConfig, [opt.id]: e.target.checked})}
                      className="w-4 h-4 rounded border-gray-300 text-brand-pink accent-brand-pink focus:ring-brand-pink"
                    />
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300 group-hover:text-brand-pink transition-colors">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Grouping */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ArrowUpDown className="w-3 h-3 text-brand-pink" /> Grouping
              </h4>
              <div className="grid grid-cols-1 gap-y-3">
                {[
                  { id: 'groupByArea', label: 'Group by Area' },
                  { id: 'groupByWho', label: 'Group by Who' },
                  { id: 'groupByProject', label: 'Group by Project' }
                ].map(opt => (
                  <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={(reportConfig as any)[opt.id]} 
                      onChange={e => setReportConfig({...reportConfig, [opt.id]: e.target.checked})}
                      className="w-4 h-4 rounded border-gray-300 text-brand-pink accent-brand-pink focus:ring-brand-pink"
                    />
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300 group-hover:text-brand-pink transition-colors">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Report Preview Summary */}
          <div className="bg-gray-50 dark:bg-dark-bg p-6 rounded-2xl border border-gray-100 dark:border-dark-border">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Preview Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[9px] font-black text-gray-400 uppercase">Total Items</p>
                <p className="text-lg font-black text-gray-900 dark:text-white">{reportSummary.totalTasks}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-brand-pink uppercase">Total Hours</p>
                <p className="text-lg font-black text-brand-pink">{reportSummary.totalHours.toFixed(1)}</p>
              </div>
              <div className="md:col-span-2 space-y-2">
                <p className="text-[9px] font-black text-gray-400 uppercase">Hours by status</p>
                <div className="flex gap-4">
                  {Object.entries(reportSummary.hoursByStatus).map(([status, hrs]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${status === 'Complete' ? 'bg-green-500' : (status === 'In Progress' ? 'bg-blue-500' : 'bg-gray-400')}`} />
                      {/* Fixed: Cast 'hrs' to number to resolve unknown type toFixed error */}
                      <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400">{status}: <span className="font-black text-gray-900 dark:text-white">{(hrs as number).toFixed(1)}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" className="flex-1" onClick={() => setIsReportModalOpen(false)}>Close</Button>
            <Button icon={Download} className="flex-1" onClick={handleDownloadReport} disabled={reportTasks.length === 0}>Download PDF</Button>
          </div>
        </div>
      </Modal>

      {/* Creation Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add new agency record" size="lg">
        <form onSubmit={handleCreateTask} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-3">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Project title</label>
              <Input required placeholder="Campaign or asset name..." value={newTask.project} onChange={e => setNewTask({...newTask, project: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Area</label>
              <Input placeholder="e.g. Creative" value={newTask.area} onChange={e => setNewTask({...newTask, area: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Brief status</label>
              <Input value={newTask.briefCreatedRequired} onChange={e => setNewTask({...newTask, briefCreatedRequired: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Content status</label>
              <Input value={newTask.contentRequiredReceived} onChange={e => setNewTask({...newTask, contentRequiredReceived: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 md:col-span-4 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Logged</label>
                <Input type="date" value={newTask.dateLogged} onChange={e => setNewTask({...newTask, dateLogged: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Sent</label>
                <Input type="date" value={newTask.dateSent} onChange={e => setNewTask({...newTask, dateSent: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-red-500 uppercase mb-1 block ml-1">Due</label>
                <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-green-600 uppercase mb-1 block ml-1">Complete</label>
                <Input type="date" value={newTask.completeBy} onChange={e => setNewTask({...newTask, completeBy: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 md:col-span-4 gap-4">
              <div className="md:col-span-1">
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Assign Person</label>
                <Select value="" onChange={e => {
                  const val = e.target.value;
                  if (!val) return;
                  const current = newTask.who || [];
                  if (!current.includes(val)) setNewTask({...newTask, who: [...current, val]});
                }}>
                  <option value="">+ Select</option>
                  {getWhoOptions(selectedClientId).filter(opt => !(newTask.who || []).includes(opt.name)).map(opt => (
                    <option key={`${opt.type}-${opt.name}`} value={opt.name}>{opt.name} ({opt.type})</option>
                  ))}
                </Select>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(newTask.who || []).map(p => (
                    <span key={p} className="px-2 py-0.5 bg-gray-100 dark:bg-dark-bg text-[9px] font-bold rounded flex items-center">
                      {p}
                      <button type="button" onClick={() => setNewTask({...newTask, who: (newTask.who || []).filter(x => x !== p)})} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Versions</label>
                <Input value={newTask.versions} onChange={e => setNewTask({...newTask, versions: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Status</label>
                <Select value={newTask.inProgress} onChange={e => setNewTask({...newTask, inProgress: e.target.value})}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Complete">Complete</option>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Hours</label>
                <Input type="number" value={newTask.hoursAllocated} onChange={e => setNewTask({...newTask, hoursAllocated: Number(e.target.value)})} />
              </div>
            </div>
            <div className="md:col-span-4">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Drive link</label>
              <Input placeholder="Https://..." value={newTask.linksToFiles} onChange={e => setNewTask({...newTask, linksToFiles: e.target.value})} />
            </div>
            <div className="md:col-span-4">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Notes</label>
              <Textarea placeholder="Context details..." value={newTask.notes} onChange={e => setNewTask({...newTask, notes: e.target.value})} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100 dark:border-dark-border">
            <Button variant="outline" className="flex-1" type="button" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button className="flex-1" type="submit">Add Task</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Tasks;
