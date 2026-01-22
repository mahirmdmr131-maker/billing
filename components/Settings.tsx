
import React, { useState, useRef, useEffect } from 'react';
import { AppData, BusinessInfo, AppTheme, User, Sale, Product, Customer, Expense } from '../types';
import { initGoogleAuth, uploadToDrive } from '../utils/googleDrive';
import { initOneDriveAuth, uploadToOneDrive } from '../utils/oneDrive';

interface SettingsProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onManualSync: () => void;
  onLogout: () => void;
  onSetLocalHandle: (handle: any) => void;
}

const Settings: React.FC<SettingsProps> = ({ data, updateData, onManualSync, onLogout, onSetLocalHandle }) => {
  const isAdmin = data.currentUser?.role === 'admin';
  const currentUser = data.currentUser;
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });
  const [ownPasswordData, setOwnPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [resetStaffPassword, setResetStaffPassword] = useState('');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [syncingCloud, setSyncingCloud] = useState<string | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [recycleTab, setRecycleTab] = useState<'sales' | 'customers' | 'products' | 'expenses'>('sales');
  const [isInIframe, setIsInIframe] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

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
    } catch (err: any) {
      if (err.name === 'SecurityError') {
        alert('SECURITY RESTRICTION: Local folder access is blocked because this app is running inside a preview frame. To use "Folder Sync", please open the app directly in a browser tab using the "Open in New Tab" button.');
      } else if (err.name === 'AbortError') {
        // User cancelled, no action needed
      } else {
        console.error('Folder picker failed', err);
        alert('Folder access failed: ' + err.message);
      }
    }
  };

  const openStandalone = () => {
    window.open(window.location.href, '_blank');
  };

  const handleGoogleConnect = () => {
    initGoogleAuth((token, email) => {
      if (email) setGoogleEmail(email);
      updateData(prev => ({ ...prev, isDriveConnected: true }));
      alert('Google Drive connected successfully!');
    });
  };

  const handleOneDriveConnect = () => {
    initOneDriveAuth((token) => {
      updateData(prev => ({ ...prev, isOneDriveConnected: true }));
      alert('OneDrive connected successfully!');
    });
  };

  const syncDriveNow = async () => {
    setSyncingCloud('drive');
    const ok = await uploadToDrive(data, data.backupFolderName);
    setSyncingCloud(null);
    if (ok) alert('Backup successfully pushed to Google Drive.');
    else alert('Google Drive sync failed. Please reconnect.');
  };

  const syncOneDriveNow = async () => {
    setSyncingCloud('onedrive');
    const ok = await uploadToOneDrive(data, data.backupFolderName);
    setSyncingCloud(null);
    if (ok) alert('Backup successfully pushed to OneDrive.');
    else alert('OneDrive sync failed. Please reconnect.');
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.username || !newStaff.password) return;
    
    if (data.users.some(u => u.username.toLowerCase() === newStaff.username.toLowerCase())) {
      alert('Username already exists. Please choose another.');
      return;
    }

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

  const handleUpdateOwnPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (ownPasswordData.current !== currentUser.passwordHash) {
      alert('Current password incorrect.');
      return;
    }
    if (ownPasswordData.new !== ownPasswordData.confirm) {
      alert('New passwords do not match.');
      return;
    }
    if (ownPasswordData.new.length < 4) {
      alert('Password must be at least 4 characters.');
      return;
    }

    updateData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === currentUser.id ? { ...u, passwordHash: ownPasswordData.new } : u),
      currentUser: { ...currentUser, passwordHash: ownPasswordData.new }
    }));
    setOwnPasswordData({ current: '', new: '', confirm: '' });
    alert('Password updated successfully!');
  };

  const handleResetStaffPassword = (staffId: string) => {
    if (!resetStaffPassword || resetStaffPassword.length < 4) {
      alert('Please enter a valid password (min 4 chars).');
      return;
    }
    updateData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === staffId ? { ...u, passwordHash: resetStaffPassword } : u)
    }));
    setEditingStaffId(null);
    setResetStaffPassword('');
    alert('Staff password reset successfully!');
  };

  const deleteUser = (id: string) => {
    if (id === currentUser?.id) {
      alert('Cannot delete yourself.');
      return;
    }
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

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (confirm('This will overwrite all current data with the backup file. Proceed?')) {
          updateData(() => ({
            ...importedData,
            currentUser: data.currentUser // Keep current session
          }));
          alert('Data imported successfully!');
        }
      } catch (err) {
        alert('Invalid backup file. Please ensure it is a valid AM Food JSON backup.');
      }
    };
    reader.readAsText(file);
  };

  const restoreItem = (type: keyof typeof data.recycleBin, item: any) => {
    updateData(prev => ({
      ...prev,
      [type]: [item, ...((prev as any)[type] as any[])],
      recycleBin: {
        ...prev.recycleBin,
        [type]: (prev.recycleBin as any)[type].filter((i: any) => i.id !== item.id)
      }
    }));
  };

  const permanentDelete = (type: keyof typeof data.recycleBin, id: string) => {
    if (!confirm('This item will be deleted forever. Proceed?')) return;
    updateData(prev => ({
      ...prev,
      recycleBin: {
        ...prev.recycleBin,
        [type]: (prev.recycleBin as any)[type].filter((i: any) => i.id !== id)
      }
    }));
  };

  const emptyRecycleBin = () => {
    if (!confirm('EMPTY ENTIRE RECYCLE BIN? This action is irreversible.')) return;
    updateData(prev => ({
      ...prev,
      recycleBin: { sales: [], customers: [], products: [], expenses: [] }
    }));
  };

  const binTotal = data.recycleBin.sales.length + data.recycleBin.customers.length + data.recycleBin.products.length + data.recycleBin.expenses.length;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* App Environment Warning */}
      {isInIframe && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in duration-500">
           <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                 <p className="font-black text-amber-800 uppercase text-[10px] tracking-widest">Running in Restricted Environment</p>
                 <p className="text-sm font-medium text-amber-700">Some security-sensitive features like <b>Local Folder Sync</b> might be disabled in this view.</p>
              </div>
           </div>
           <button 
             onClick={openStandalone}
             className="px-6 py-2 bg-amber-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-all shadow-md active:scale-95"
           >
             Open in New Tab
           </button>
        </div>
      )}

      {/* Cloud Sync Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-slate-900 border-b border-slate-950 px-8 py-6 text-white">
              <h3 className="text-xl font-black uppercase tracking-tight">Cloud Sync & Remote Backup</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Safely store all entries and credentials in your personal cloud</p>
           </div>
           <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Google Drive */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center text-center">
                 <div className="w-16 h-16 mb-4 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-12 h-12">
                       <path d="M16.5 2h-9L2 12l5.5 10h9L22 12l-5.5-10z" fill="#000" fillOpacity=".1"/>
                       <path d="M7.5 2l-5.5 10 5.5 10h9l5.5-10-5.5-10h-9z" fill="#fff"/>
                       <path d="M12 21l-4.5-8h9L12 21z" fill="#34A853"/>
                       <path d="M7.5 2l4.5 8h-9L7.5 2z" fill="#FBBC04"/>
                       <path d="M16.5 2L12 10h9l-4.5-8z" fill="#4285F4"/>
                    </svg>
                 </div>
                 <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-1">Google Drive</h4>
                 <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">
                    {data.isDriveConnected ? (googleEmail ? `Linked: ${googleEmail}` : 'Connected') : 'Not connected to Drive'}
                 </p>
                 
                 <div className="mt-auto w-full space-y-2">
                    {!data.isDriveConnected ? (
                      <button onClick={handleGoogleConnect} className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl shadow hover:bg-indigo-700 transition-all">
                        Connect Account
                      </button>
                    ) : (
                      <>
                        <button 
                          disabled={syncingCloud === 'drive'}
                          onClick={syncDriveNow} 
                          className="w-full py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl shadow hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {syncingCloud === 'drive' ? 'Backing up...' : 'Sync Now'}
                        </button>
                        <button 
                          onClick={() => updateData(prev => ({ ...prev, isDriveConnected: false }))} 
                          className="w-full py-2 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                 </div>
              </div>

              {/* OneDrive */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center text-center">
                 <div className="w-16 h-16 mb-4 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-12 h-12">
                       <path d="M12 4.5a3.5 3.5 0 0 1 3.5 3.5c0 .245-.025.484-.073.714A3.5 3.5 0 0 1 18.5 12a3.5 3.5 0 0 1-3.5 3.5H9a3.5 3.5 0 0 1-3.5-3.5 3.5 3.5 0 0 1 3.073-3.286A3.5 3.5 0 0 1 12 4.5z" fill="#0078d4"/>
                       <path d="M15.5 8c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4z" fill="#2b88d8"/>
                       <path d="M18.5 12c0 2.21-1.79 4-4 4h-1c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4z" fill="#50a6e8"/>
                    </svg>
                 </div>
                 <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-1">Microsoft OneDrive</h4>
                 <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">
                    {data.isOneDriveConnected ? 'OneDrive Linked' : 'Not connected to OneDrive'}
                 </p>
                 
                 <div className="mt-auto w-full space-y-2">
                    {!data.isOneDriveConnected ? (
                      <button onClick={handleOneDriveConnect} className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl shadow hover:bg-blue-700 transition-all">
                        Connect Account
                      </button>
                    ) : (
                      <>
                        <button 
                          disabled={syncingCloud === 'onedrive'}
                          onClick={syncOneDriveNow} 
                          className="w-full py-2 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-xl shadow hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {syncingCloud === 'onedrive' ? 'Backing up...' : 'Sync Now'}
                        </button>
                        <button 
                          onClick={() => updateData(prev => ({ ...prev, isOneDriveConnected: false }))} 
                          className="w-full py-2 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Recycle Bin Summary (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group">
          <div className="bg-slate-900 border-b border-slate-950 px-8 py-6 flex justify-between items-center text-white">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">Recycle Bin</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{binTotal} Items ready for recovery</p>
              </div>
            </div>
            <button 
              onClick={() => setShowRecycleBin(true)}
              className="px-6 py-2.5 bg-white text-slate-900 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all"
            >
              Manage Deleted Data
            </button>
          </div>
        </div>
      )}

      {/* Account Security (For everyone) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-4">
          <h3 className="text-lg font-bold text-slate-800">Account Security</h3>
          <p className="text-sm text-slate-500 font-medium">Update your login credentials.</p>
        </div>
        <div className="p-8">
          <form onSubmit={handleUpdateOwnPassword} className="max-w-md space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Password</label>
              <input 
                type="password" 
                required 
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                value={ownPasswordData.current} 
                onChange={e => setOwnPasswordData({ ...ownPasswordData, current: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">New Password</label>
                <input 
                  type="password" 
                  required 
                  className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                  value={ownPasswordData.new} 
                  onChange={e => setOwnPasswordData({ ...ownPasswordData, new: e.target.value })} 
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Confirm New</label>
                <input 
                  type="password" 
                  required 
                  className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                  value={ownPasswordData.confirm} 
                  onChange={e => setOwnPasswordData({ ...ownPasswordData, confirm: e.target.value })} 
                />
              </div>
            </div>
            <button type="submit" className="px-6 py-2 bg-slate-800 text-white font-bold rounded-xl shadow hover:bg-slate-900 transition-all text-xs uppercase tracking-widest">
              Update My Password
            </button>
          </form>
        </div>
      </div>

      {/* Inactivity Logout Settings */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-4">
          <h3 className="text-lg font-bold text-slate-800">Security: Session Timeout</h3>
          <p className="text-sm text-slate-500 font-medium">Log out automatically when the app is not in use.</p>
        </div>
        <div className="p-8">
          <div className="max-w-md space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Logout after inactivity (Minutes)</label>
              <select 
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                value={data.autoLogoutMinutes || 0}
                onChange={e => updateData(prev => ({ ...prev, autoLogoutMinutes: parseInt(e.target.value) }))}
              >
                <option value={0}>Never (Disabled)</option>
                <option value={1}>1 Minute</option>
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* User & Staff Management (Admin Only) */}
      {isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-8 py-4">
            <h3 className="text-lg font-bold text-slate-800">Staff User Management</h3>
            <p className="text-sm text-slate-500 font-medium">Create and manage IDs for your factory employees.</p>
          </div>
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Register New Staff</h4>
              <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <input type="text" placeholder="Staff Username" required className="px-4 py-2 border rounded-xl outline-none" value={newStaff.username} onChange={e => setNewStaff({ ...newStaff, username: e.target.value })} />
                <input type="password" placeholder="Initial Password" required className="px-4 py-2 border rounded-xl outline-none" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} />
                <button type="submit" className="bg-indigo-600 text-white font-bold rounded-xl py-2 shadow-md hover:bg-indigo-700 transition-all text-xs uppercase tracking-widest">Create Access</button>
              </form>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.users.map(user => (
                <div key={user.id} className="flex flex-col p-5 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{user.username}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'text-indigo-600' : 'text-slate-400'}`}>{user.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {user.role === 'staff' && (
                        <button onClick={() => setEditingStaffId(editingStaffId === user.id ? null : user.id)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                        </button>
                      )}
                      {user.id !== currentUser?.id && (
                        <button onClick={() => deleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Local Folder Sync */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-900 border-b border-indigo-950 px-8 py-4 flex justify-between items-center text-white">
          <div>
            <h3 className="text-lg font-bold">Local Specified Folder Sync</h3>
            <p className="text-xs text-indigo-200">Automatically save billing files to a chosen folder on your PC.</p>
          </div>
          <button 
            disabled={isInIframe}
            onClick={() => updateData(prev => ({ ...prev, syncImmediatelyLocal: !prev.syncImmediatelyLocal }))}
            className={`w-10 h-5 rounded-full relative transition-colors ${isInIframe ? 'opacity-30 cursor-not-allowed' : ''} ${data.syncImmediatelyLocal ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${data.syncImmediatelyLocal ? 'left-5.5' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Connection Status:</p>
              <p className="text-lg font-black text-indigo-600">{data.isLocalFolderConnected ? `📁 Connected to: ${data.localFolderName}` : 'Not Connected'}</p>
            </div>
            <button 
              onClick={handlePickFolder} 
              className={`px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 ${isInIframe ? 'bg-slate-400' : ''}`}
            >
              {data.isLocalFolderConnected ? 'Change Folder' : 'Select Folder'}
            </button>
          </div>
        </div>
      </div>

      {/* System Preferences */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">System Preferences & Backup</h3>
          <div className="flex space-x-4">
            <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase text-indigo-600">Import</button>
            <button onClick={handleBackup} className="text-[10px] font-black uppercase text-indigo-600">Export</button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
        </div>
        <div className="p-8 space-y-8">
           <div className="flex flex-wrap gap-4">
              {THEMES.map(t => (
                <button key={t.id} onClick={() => updateData(prev => ({ ...prev, theme: t.id }))} className={`flex items-center space-x-2 px-4 py-3 rounded-2xl border-2 transition-all ${data.theme === t.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-white'}`}>
                  <div className={`w-4 h-4 rounded-full ${t.color}`}></div><span className="text-xs font-bold">{t.label}</span>
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Recycle Bin Modal */}
      {showRecycleBin && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-slate-900 px-8 py-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Recycle Bin Management
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Permanently delete or restore recently removed items</p>
              </div>
              <div className="flex items-center space-x-4">
                {binTotal > 0 && (
                  <button onClick={emptyRecycleBin} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    Empty Trash
                  </button>
                )}
                <button onClick={() => setShowRecycleBin(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex border-b border-slate-100 no-print">
               {(['sales', 'customers', 'products', 'expenses'] as const).map(tab => (
                 <button 
                  key={tab} 
                  onClick={() => setRecycleTab(tab)}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${recycleTab === tab ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                 >
                   {tab} ({data.recycleBin[tab].length})
                 </button>
               ))}
            </div>

            <div className="flex-1 overflow-y-auto p-8">
               {data.recycleBin[recycleTab].length > 0 ? (
                 <div className="space-y-4">
                    {data.recycleBin[recycleTab].map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-2xl hover:border-indigo-200 transition-all group">
                         <div>
                            <p className="text-sm font-black text-slate-800">
                                {recycleTab === 'sales' ? `Invoice: ${item.invoiceNumber}` : 
                                 recycleTab === 'customers' ? `Customer: ${item.name}` :
                                 recycleTab === 'products' ? `Product: ${item.name}` :
                                 `Expense: ${item.description}`}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                {recycleTab === 'sales' ? `Amount: ₹${item.totalAmount}` : 
                                 recycleTab === 'customers' ? `Phone: ${item.phone}` :
                                 recycleTab === 'products' ? `Stock: ${item.currentStock || 0}` :
                                 `Amount: ₹${item.amount}`}
                                 <span className="mx-2 opacity-30">|</span>
                                 Deleted: {new Date(item.deletedAt).toLocaleString()}
                            </p>
                         </div>
                         <div className="flex space-x-2">
                            <button 
                              onClick={() => restoreItem(recycleTab, item)}
                              className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Restore
                            </button>
                            <button 
                              onClick={() => permanentDelete(recycleTab, item.id)}
                              className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Delete Forever
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-center py-20">
                    <div className="w-20 h-20 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </div>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Recycle Bin is empty for {recycleTab}</p>
                 </div>
               )}
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400">RESTORED ITEMS WILL BE ADDED BACK TO ACTIVE LISTS</p>
                <button onClick={() => setShowRecycleBin(false)} className="text-indigo-600 font-black text-xs uppercase hover:underline">Close Bin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
