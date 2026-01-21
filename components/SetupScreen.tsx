
import React, { useState } from 'react';
import { BusinessInfo, User } from '../types';

interface SetupScreenProps {
  onComplete: (business: BusinessInfo, admin: User) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
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
    password: ''
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, logo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone && adminData.password) {
      const admin: User = {
        id: crypto.randomUUID(),
        username: adminData.username,
        passwordHash: adminData.password,
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      onComplete(formData, admin);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-indigo-600 p-8 text-white text-center">
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">Business Initializer</h2>
          <p className="text-indigo-100 opacity-90 font-medium">Configure your workspace & admin account.</p>
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
            <input type="text" placeholder="Business Name *" required className="w-full px-4 py-2 border rounded-xl outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <input type="tel" placeholder="Phone Number *" required className="w-full px-4 py-2 border rounded-xl outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            <textarea placeholder="Full Address *" required className="w-full px-4 py-2 border rounded-xl outline-none" rows={3} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-2">Admin Account</h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
              <input type="text" required className="w-full px-4 py-2 border rounded-xl outline-none" value={adminData.username} onChange={e => setAdminData({ ...adminData, username: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Admin Password *</label>
              <input type="password" required className="w-full px-4 py-2 border rounded-xl outline-none" value={adminData.password} onChange={e => setAdminData({ ...adminData, password: e.target.value })} placeholder="Set your password" />
            </div>
            <div className="pt-10">
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95">Complete Setup</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;
