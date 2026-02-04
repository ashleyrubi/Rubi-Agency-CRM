
import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FileMetadata, Client } from '../types';
import { Upload, File, HardDrive, Search, Trash2, Download } from 'lucide-react';
import { PageHeader, Button, Card, Table, Input, Select, EmptyState, PermissionError } from '../components/UI';

const Files: React.FC = () => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');

  useEffect(() => {
    const handleError = (err: any) => {
      if (err.code === 'permission-denied') setHasError(true);
      console.error("Files Firestore Error:", err);
    };

    const q = query(collection(db, 'files'), orderBy('uploadedAt', 'desc'));
    const unsubF = onSnapshot(q, 
      (snap) => {
        setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as FileMetadata)));
        setHasError(false);
      }, 
      handleError
    );

    const unsubC = onSnapshot(collection(db, 'clients'), 
      (snap) => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
        setHasError(false);
      }, 
      handleError
    );

    return () => { unsubF(); unsubC(); };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClientId) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `client-files/${selectedClientId}/${file.name}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'files'), { name: file.name, url, type: file.type, size: file.size, clientId: selectedClientId, uploadedAt: serverTimestamp(), uploadedBy: 'Admin' });
      setSelectedClientId('');
    } catch (err: any) {
      console.error("Upload failed:", err);
      if (err.code === 'storage/unauthorized') {
        alert("Upload failed: Missing storage permissions. Check your Firebase Storage Rules.");
      }
    } finally { setIsUploading(false); }
  };

  const formatSize = (b: number) => {
    if (b === 0) return '0 B';
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return parseFloat((b / Math.pow(1024, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  };

  if (hasError) {
    return (
      <div className="p-10">
        <PageHeader title="Asset Library" />
        <PermissionError />
      </div>
    );
  }

  return (
    <div className="p-10">
      <PageHeader 
        title="Asset Library" 
        description="Shared project resources and client documentation."
        actions={
          <div className="flex gap-3">
            <Select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-48 py-2">
              <option value="">Choose Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </Select>
            <Button variant="primary" icon={Upload} disabled={!selectedClientId || isUploading} className="relative">
              {isUploading ? 'Uploading...' : 'Upload Asset'}
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" disabled={!selectedClientId || isUploading} onChange={handleFileUpload} />
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-card flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search library..." className="pl-10 h-10 py-0" />
          </div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
            <HardDrive className="w-4 h-4 mr-2" />
            Used Storage: {formatSize(files.reduce((a, b) => a + b.size, 0))}
          </div>
        </div>
        <Table headers={['Asset Name', 'Client', 'Size', 'Actions']}>
          {files.map(file => {
            const client = clients.find(c => c.id === file.clientId);
            return (
              <tr key={file.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-bg/50 transition-colors group">
                <td className="px-6 py-4 flex items-center">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-dark-bg rounded-xl flex items-center justify-center text-gray-400 group-hover:text-brand-pink transition-colors mr-4 shadow-sm">
                    <File className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900 dark:text-white">{file.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{file.type.split('/')[1] || 'FILE'}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-tighter">{client?.company || 'GLOBAL RESOURCE'}</td>
                <td className="px-6 py-4 text-xs font-bold text-gray-600 dark:text-gray-400">{formatSize(file.size)}</td>
                <td className="px-6 py-4 text-right">
                  <a href={file.url} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm" icon={Download} /></a>
                </td>
              </tr>
            );
          })}
        </Table>
        {files.length === 0 && <EmptyState icon={File} message="Empty Library" submessage="Upload assets to share them across the agency." />}
      </Card>
    </div>
  );
};

export default Files;
