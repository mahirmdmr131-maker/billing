
import React, { useState, useRef } from 'react';
import { AppData, BusinessInfo, AppTheme, User } from '../types';
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
  const currentUser = data.currentUser;
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });
  const [ownPasswordData, setOwnPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [resetStaffPassword, setResetStaffPassword] = useState('');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleGoogleConnect = () => {
    initGoogleAuth((token, email) => {
      if (email) setGoogleEmail(email);
      updateData(prev => ({ ...prev, isDriveConnected: true }));
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
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

      {/* Inactivity Logout Settings (Admin or All?) Let's make it for all to manage their session */}
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
              <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Recommended for shared workstations to ensure data privacy.</p>
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

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Existing User Registry</h4>
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
                          <button 
                            onClick={() => setEditingStaffId(editingStaffId === user.id ? null : user.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                            title="Reset Password"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                          </button>
                        )}
                        {user.id !== currentUser?.id && (
                          <button onClick={() => deleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete User">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {editingStaffId === user.id && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-2 animate-in slide-in-from-top-2">
                        <input 
                          type="password" 
                          placeholder="New Pass" 
                          className="flex-1 px-3 py-1 text-sm border rounded-lg outline-none" 
                          value={resetStaffPassword} 
                          onChange={e => setResetStaffPassword(e.target.value)} 
                        />
                        <button 
                          onClick={() => handleResetStaffPassword(user.id)}
                          className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Specified Folder Sync */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-indigo-900 border-b border-indigo-950 px-8 py-4 flex justify-between items-center text-white">
          <div>
            <h3 className="text-lg font-bold">Local Specified Folder Sync</h3>
            <p className="text-xs text-indigo-200">Automatically save billing files to a chosen folder on your PC.</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest">Auto Save</span>
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
              <p className="text-sm font-bold text-slate-800">Connection Status:</p>
              <p className="text-lg font-black text-indigo-600">{data.isLocalFolderConnected ? `📁 Connected to: ${data.localFolderName}` : 'Not Connected'}</p>
              {data.isLocalFolderConnected && <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">✓ Handle persists across sessions</p>}
            </div>
            <button 
              onClick={handlePickFolder}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 whitespace-nowrap"
            >
              {data.isLocalFolderConnected ? 'Change Backup Folder' : 'Select Backup Folder'}
            </button>
          </div>
        </div>
      </div>

      {/* Cloud Sync with Gmail Login */}
      {isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">Cloud Backup & Sync</h3>
            <button onClick={onManualSync} className="text-[10px] font-black uppercase text-indigo-600 font-bold hover:underline">Sync Everything Now</button>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col justify-between h-48">
                 <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 flex-shrink-0"><svg viewBox="0 0 48 48"><path fill="#FFC107" d="M17 6h14l9 16H8z"/><path fill="#1976D2" d="M31 6l9 16-7 13H19z"/><path fill="#4CAF50" d="M17 6L8 22l7 13h16z"/></svg></div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Google Drive</p>
                      <p className="text-xs text-slate-400 font-medium">Automatic billing storage</p>
                    </div>
                 </div>
                 <div className="mt-4">
                    {data.isDriveConnected ? (
                      <div className="flex flex-col space-y-2">
                        <p className="text-xs font-bold text-emerald-600 truncate">Connected: {googleEmail || 'Active Session'}</p>
                        <button onClick={handleGoogleConnect} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600">Re-authenticate</button>
                      </div>
                    ) : (
                      <button 
                        onClick={handleGoogleConnect} 
                        className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        <span>Login with Gmail</span>
                      </button>
                    )}
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col justify-between h-48 opacity-60">
                 <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 flex-shrink-0"><svg viewBox="0 0 24 24" fill="#0078D4"><path d="M17.5 19C15.01 19 13 16.99 13 14.5C13 13.91 13.34 13.31 12.82C12.11 12.29 10.74 12 9.25 12C5.8 12 3 14.8 3 18.25C3 21.7 5.8 24.5 9.25 24.5H17.5C21.09 24.5 24 21.59 24 18C24 14.41 21.09 11.5 17.5 11.5L24 18Z"/></svg></div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight">MS OneDrive</p>
                      <p className="text-xs text-slate-400 font-medium">Secondary Backup</p>
                    </div>
                 </div>
                 <div className="mt-4">
                    <button onClick={() => initOneDriveAuth(() => updateData(d => ({...d, isOneDriveConnected: true})))} className="w-full py-3 bg-white border border-slate-200 text-slate-400 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">
                       {data.isOneDriveConnected ? 'OneDrive Linked' : 'Link Account'}
                    </button>
                 </div>
              </div>
          </div>
        </div>
      )}

      {/* Data Management */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">System Preferences & Backup</h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-black uppercase text-indigo-600 font-bold hover:underline"
            >
              Import Backup
            </button>
            <span className="text-slate-300">|</span>
            <button onClick={handleBackup} className="text-[10px] font-black uppercase text-indigo-600 font-bold hover:underline">Manual Export (.json)</button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportBackup} 
            accept=".json" 
            className="hidden" 
          />
        </div>
        <div className="p-8 space-y-8">
           <div className="space-y-2">
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Interface Theme</p>
             <div className="flex flex-wrap gap-4">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => updateData(prev => ({ ...prev, theme: t.id }))} className={`flex items-center space-x-2 px-4 py-3 rounded-2xl border-2 transition-all ${data.theme === t.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-white'}`}>
                    <div className={`w-4 h-4 rounded-full ${t.color}`}></div><span className="text-xs font-bold text-slate-700">{t.label}</span>
                  </button>
                ))}
             </div>
           </div>
           <div className="pt-6 border-t border-slate-50">
             <button onClick={onLogout} className="text-red-600 font-black text-xs uppercase tracking-widest hover:underline flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                <span>Log out of current session</span>
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
