
import React, { useState } from 'react';
import { AppData, BusinessInfo, AppTheme, User } from '../types';
import { saveData } from '../utils/storage';
import { initGoogleAuth } from '../utils/googleDrive';
import { initOneDriveAuth } from '../utils/oneDrive';

interface SettingsProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onManualSync: () => void;
  onLogout: () => void;
  onSetLocalHandle: (handle: any) => void;
}

const Settings: React.FC<SettingsProps> = ({ data, updateData, onManualSync, onLogout, onSetLocalHandle }) => {
  const isAdmin = data.currentUser?.role === 'admin';
  const [formData, setFormData] = useState<BusinessInfo>(data.business!);
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });

  const THEMES: { id: AppTheme; color: string; label: string }[] = [
    { id: 'indigo', color: 'bg-indigo-600', label: 'Indigo' },
    { id: 'emerald', color: 'bg-emerald-600', label: 'Emerald' },
    { id: 'rose', color: 'bg-rose-600', label: 'Rose' },
    { id: 'cyan', color: 'bg-cyan-600', label: 'Cyan' }
  ];

  const handlePickFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('Your browser does not support folder picking. Please use a modern version of Chrome, Edge, or Brave.');
        return;
      }
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      onSetLocalHandle(handle);
    } catch (err) {
      console.error('Folder picker cancelled or failed', err);
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.username || !newStaff.password) return;
    const staff: User = {
      id: crypto.randomUUID(),
      username: newStaff.username,
      passwordHash: newStaff.password,
      role: 'staff',
      createdAt: new Date().toISOString()
    };
    updateData(prev => ({ ...prev, users: [...prev.users, staff] }));
    setNewStaff({ username: '', password: '' });
    alert('Staff ID Created Successfully!');
  };

  const deleteUser = (id: string) => {
    if (confirm('Delete this user? They will lose access immediately.')) {
      updateData(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
    }
  };

  const handleBackup = () => {
    const backupData = {
      ...data,
      exportTimestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `AM_Food_Backup_Manual_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* User Management (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-8 py-4"><h3 className="text-lg font-bold text-slate-800">User & Staff Management</h3><p className="text-sm text-slate-500 font-medium">Create IDs for your factory employees.</p></div>
          <div className="p-8 space-y-8">
            <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <input type="text" placeholder="Staff Username" required className="px-4 py-2 border rounded-xl outline-none" value={newStaff.username} onChange={e => setNewStaff({ ...newStaff, username: e.target.value })} />
              <input type="password" placeholder="Set Password" required className="px-4 py-2 border rounded-xl outline-none" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} />
              <button type="submit" className="bg-indigo-600 text-white font-bold rounded-xl py-2 shadow-md hover:bg-indigo-700 transition-all">Create Staff ID</button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-sm transition-all">
                  <div><p className="font-bold text-slate-800">{user.username}</p><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{user.role}</p></div>
                  {user.role === 'staff' && <button onClick={() => deleteUser(user.id)} className="text-red-500 hover:text-red-700 font-bold text-xs p-2">Remove</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Local Folder Sync (Primary Feature) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-900 border-b border-indigo-950 px-8 py-4 flex justify-between items-center text-white">
          <div>
            <h3 className="text-lg font-bold">Local Automatic Backup</h3>
            <p className="text-xs text-indigo-200">Safely store every bill in a folder on your computer.</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest">Immediate Save</span>
            <button 
              onClick={() => updateData(prev => ({ ...prev, syncImmediatelyLocal: !prev.syncImmediatelyLocal }))}
              className={`w-10 h-5 rounded-full relative transition-colors ${data.syncImmediatelyLocal ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${data.syncImmediatelyLocal ? 'left-5.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Connected Folder:</p>
              <p className="text-lg font-black text-indigo-600">{data.isLocalFolderConnected ? `📁 ${data.localFolderName}` : 'None Selected'}</p>
              <p className="text-xs text-slate-500 mt-1">Files are saved as .json automatically after every new bill.</p>
            </div>
            <button 
              onClick={handlePickFolder}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 whitespace-nowrap"
            >
              {data.isLocalFolderConnected ? 'Change Backup Folder' : 'Select Local Backup Folder'}
            </button>
          </div>
        </div>
      </div>

      {/* Legacy Cloud Sync (Background Only) */}
      {isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden opacity-80">
          <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">Secondary Cloud Sync</h3>
            <button onClick={onManualSync} className="text-[10px] font-black uppercase text-indigo-600">Sync Now</button>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <div className="w-8 h-8"><svg viewBox="0 0 48 48"><path fill="#FFC107" d="M17 6h14l9 16H8z"/><path fill="#1976D2" d="M31 6l9 16-7 13H19z"/><path fill="#4CAF50" d="M17 6L8 22l7 13h16z"/></svg></div>
                    <span className="text-xs font-bold">{data.isDriveConnected ? 'G-Drive Connected' : 'Google Drive'}</span>
                 </div>
                 <button onClick={() => initGoogleAuth(() => updateData(d => ({...d, isDriveConnected: true})))} className="text-[10px] font-black uppercase hover:underline">Connect</button>
              </div>
              <div className="p-4 bg-slate-50 border rounded-2xl flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <div className="w-8 h-8"><svg viewBox="0 0 24 24" fill="#0078D4"><path d="M17.5 19C15.01 19 13 16.99 13 14.5C13 13.91 13.34 13.31 12.82C12.11 12.29 10.74 12 9.25 12C5.8 12 3 14.8 3 18.25C3 21.7 5.8 24.5 9.25 24.5H17.5C21.09 24.5 24 21.59 24 18C24 14.41 21.09 11.5 17.5 11.5L24 18Z"/></svg></div>
                    <span className="text-xs font-bold">{data.isOneDriveConnected ? 'OneDrive Connected' : 'MS OneDrive'}</span>
                 </div>
                 <button onClick={() => initOneDriveAuth(() => updateData(d => ({...d, isOneDriveConnected: true})))} className="text-[10px] font-black uppercase hover:underline">Connect</button>
              </div>
          </div>
        </div>
      )}

      {/* Data Management */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800">System Records</h3><button onClick={handleBackup} className="text-[10px] font-black uppercase text-indigo-600">Manual JSON Export</button></div>
        <div className="p-8 space-y-6">
           <div className="flex flex-wrap gap-4">
              {THEMES.map(t => (
                <button key={t.id} onClick={() => updateData(prev => ({ ...prev, theme: t.id }))} className={`flex items-center space-x-2 px-4 py-2 rounded-xl border-2 transition-all ${data.theme === t.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100'}`}>
                  <div className={`w-4 h-4 rounded-full ${t.color}`}></div><span className="text-xs font-bold text-slate-700">{t.label}</span>
                </button>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
