
import React, { useState, useRef } from 'react';
import { BusinessInfo, User, AppData } from '../types';

interface SetupScreenProps {
  onComplete: (business: BusinessInfo, admin: User, recoveryCode: string) => void;
  onImport: (data: AppData) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete, onImport }) => {
  const [formData, setFormData] = useState<BusinessInfo>({
    name: 'A M Food Processing',
    phone: '',
    address: '',
    gst: '',
    tagline: 'Quality Food Processing',
    logo: ''
  });
  
  const [adminData, setAdminData] = useState({
    username: 'admin',
    password: '',
    recoveryCode: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, logo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        
        if (importedData.users && importedData.business && importedData.customers) {
          if (confirm('Valid backup detected. Restore all business data, staff credentials, and settings?')) {
            onImport({
              ...importedData,
              isInitialized: true,
              currentUser: null 
            });
          }
        } else {
          alert('Invalid backup file structure.');
        }
      } catch (err) {
        alert('Failed to parse the backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone && adminData.password && adminData.recoveryCode) {
      const admin: User = {
        id: crypto.randomUUID(),
        username: adminData.username,
        passwordHash: adminData.password,
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      onComplete(formData, admin, adminData.recoveryCode);
    } else {
      alert('Please fill all required fields including Recovery Code.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-indigo-600 p-8 text-white text-center relative">
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">Business Initializer</h2>
          <p className="text-indigo-100 opacity-90 font-medium text-sm">Configure your workspace or restore from a previous save.</p>
          
          <div className="mt-6 flex justify-center">
            <button 
              type="button"
              onClick={handleImportClick}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center space-x-2 border border-white/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Restore from Backup</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-2">Business Profile</h3>
            <div className="flex flex-col items-center">
              <label className="cursor-pointer group">
                <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group-hover:border-indigo-500 transition-colors">
                  {formData.logo ? <img src={formData.logo} alt="Logo" className="w-full h-full object-contain p-2" /> : <div className="text-slate-400 group-hover:text-indigo-500 font-bold text-xs">LOGO</div>}
                </div>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
            </div>
            <input type="text" placeholder="Business Name *" required className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <input type="tel" placeholder="Phone Number *" required className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            <textarea placeholder="Full Address *" required className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" rows={3} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-2">Admin Security</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
              <input type="text" required className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={adminData.username} onChange={e => setAdminData({ ...adminData, username: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Admin Password *</label>
              <input type="password" required className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={adminData.password} onChange={e => setAdminData({ ...adminData, password: e.target.value })} placeholder="Create password" />
            </div>
            <div>
              <label className="block text-xs font-bold text-rose-500 mb-1 uppercase tracking-tight">Recovery Code (Save this!)*</label>
              <input type="text" required className="w-full px-4 py-2 border-2 border-rose-100 bg-rose-50 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-mono text-center" value={adminData.recoveryCode} onChange={e => setAdminData({ ...adminData, recoveryCode: e.target.value })} placeholder="e.g. AMFOOD-2025" />
              <p className="text-[10px] text-slate-400 mt-2">Use this code to reset the admin password if you forget it.</p>
            </div>
            <div className="pt-4">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95">Complete Setup</button>
            </div>
          </div>
        </form>
      </div>
      
      <p className="mt-8 text-slate-500 text-xs font-medium uppercase tracking-widest opacity-50">
        A M Food Processing • System Initialization
      </p>
    </div>
  );
};

export default SetupScreen;
