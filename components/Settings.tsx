import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppData, BusinessInfo, AppTheme, User, Sale, Product, Customer, Expense, UpiQr, TemplateSettings, SaleItem } from '../types';
import { initGoogleAuth, uploadToDrive, getBackupInfo, downloadFromDrive, hasAccessToken } from '../utils/googleDrive';
import { initOneDriveAuth, uploadToOneDrive } from '../utils/oneDrive';

interface SettingsProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onManualSync: () => void;
  onLogout: () => void;
  onSetLocalHandle: (handle: any, slot: 1 | 2) => void;
}

type PrintSize = 'A4' | 'Thermal80' | 'Thermal58';

const Settings: React.FC<SettingsProps> = ({ data, updateData, onManualSync, onLogout, onSetLocalHandle }) => {
  const isAdmin = data.currentUser?.role === 'admin';
  const [settingsTab, setSettingsTab] = useState<'app' | 'template' | 'users' | 'sync'>('app');
  const [previewSize, setPreviewSize] = useState<PrintSize>('Thermal80');
  
  // Staff State
  const [newStaff, setNewStaff] = useState({ username: '', password: '' });
  
  // Cloud State
  const [syncingCloud, setSyncingCloud] = useState<string | null>(null);
  const [driveBackupStatus, setDriveBackupStatus] = useState<{ id: string; modifiedTime: string } | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.isDriveConnected) checkDriveBackup();
  }, [data.isDriveConnected]);

  const checkDriveBackup = async () => {
    if (!data.isDriveConnected || !hasAccessToken()) return;
    const info = await getBackupInfo(data.backupFolderName);
    setDriveBackupStatus(info);
  };

  const syncDriveNow = async () => {
    if (!hasAccessToken()) {
      alert('Please reconnect Google Account.');
      return;
    }
    setSyncingCloud('drive');
    const ok = await uploadToDrive(data, data.backupFolderName);
    setSyncingCloud(null);
    if (ok) checkDriveBackup();
  };

  const updateTemplate = (field: keyof TemplateSettings, value: any) => {
    updateData(prev => ({
      ...prev,
      templateSettings: { ...prev.templateSettings, [field]: value }
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateData(prev => ({
          ...prev,
          business: prev.business ? { ...prev.business, logo: reader.result as string } : { 
            name: 'A M Food Processing', phone: '', address: '', tagline: '', logo: reader.result as string 
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.username || !newStaff.password) return;
    const newUser: User = { id: crypto.randomUUID(), username: newStaff.username, passwordHash: newStaff.password, role: 'staff', createdAt: new Date().toISOString() };
    updateData(prev => ({ ...prev, users: [...prev.users, newUser] }));
    setNewStaff({ username: '', password: '' });
  };

  const handleBrowseFolder = async (slot: 1 | 2) => {
    try {
      // @ts-ignore - File System Access API
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      if (handle) {
        onSetLocalHandle(handle, slot);
        alert(`${slot === 1 ? 'Primary' : 'Secondary'} Archive connected to: ${handle.name}`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Folder selection failed:', err);
        alert('Failed to connect folder. Ensure your browser supports the File System Access API.');
      }
    }
  };

  const disconnectFolder = (slot: 1 | 2) => {
    if (confirm(`Disconnect ${slot === 1 ? 'Primary' : 'Secondary'} Archive folder?`)) {
      onSetLocalHandle(null, slot);
    }
  };

  const handleManualExport = () => {
    const backupData = { ...data, currentUser: null }; // Security: Don't export active session
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AM_Food_Manual_Backup_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleManualImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData.users && importedData.business && importedData.customers) {
          if (confirm('RESTORE WARNING: This will replace all current business data, customers, and records. Proceed?')) {
            updateData(() => ({
              ...importedData,
              isInitialized: true,
              currentUser: data.currentUser // Preserve current logged in user if possible
            }));
            alert('Restore complete. Application data updated.');
          }
        } else {
          alert('Invalid backup file. The selected JSON is not a compatible AM Manager backup.');
        }
      } catch (err) {
        alert('Restore failed: Could not parse backup file.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    if (importFileRef.current) importFileRef.current.value = '';
  };

  // Mock data for template preview
  const MOCK_SALE = useMemo<Sale>(() => ({
    id: 'mock-id',
    invoiceNumber: 'INV-00786',
    date: new Date().toISOString().split('T')[0],
    customerName: 'VALUED CUSTOMER CORP',
    items: [
      { id: '1', productName: 'PREMIUM BASMATI RICE', quantity: 50, unit: 'kg', rate: 120, total: 6000 },
      { id: '2', productName: 'REFINED SUNFLOWER OIL', quantity: 15, unit: 'ltr', rate: 165, total: 2475 },
    ],
    totalAmount: 8475,
    category: 'General',
    createdBy: 'System',
    paymentMethod: 'Cash'
  }), []);

  const formatDate = (dateStr: string) => dateStr.split('-').reverse().join('/');

  const applyTemplate = (text: string, sale: Sale) => {
    return text
      .replace('{{inv_number}}', sale.invoiceNumber)
      .replace('{{cust_name}}', sale.customerName)
      .replace('{{total_due}}', `₹${sale.totalAmount.toLocaleString()}`)
      .replace('{{date}}', formatDate(sale.date));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto no-scrollbar no-print">
        {(['app', 'template', 'users', 'sync'] as const).map(t => (
          <button key={t} onClick={() => setSettingsTab(t)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
        ))}
      </div>

      {settingsTab === 'app' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
           <div className="bg-indigo-900 px-8 py-6 text-white"><h3 className="text-xl font-black uppercase tracking-tight">Application Control</h3></div>
           <div className="p-8 space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Color Scheme</label>
                <div className="flex flex-wrap gap-3">
                  {['indigo', 'emerald', 'rose', 'cyan'].map(t => (
                    <button key={t} onClick={() => updateData(prev => ({ ...prev, theme: t as AppTheme }))} className={`px-6 py-2 rounded-xl text-xs font-black uppercase border-2 transition-all ${data.theme === t ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 text-slate-400'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
                 <div>
                   <p className="text-sm font-black text-slate-800 uppercase">Auto-Logout Security</p>
                   <p className="text-[10px] text-slate-500 uppercase font-bold">Terminate session after inactivity</p>
                 </div>
                 <div className="flex items-center gap-3">
                   <input type="number" min="0" className="w-16 p-2 border rounded-xl font-black text-center" value={data.autoLogoutMinutes} onChange={e => updateData(prev => ({...prev, autoLogoutMinutes: parseInt(e.target.value) || 0}))} />
                   <span className="text-[10px] font-black text-slate-400 uppercase">Mins</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      {settingsTab === 'template' && (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
           {/* Photoshop-style Editor Sidebar */}
           <div className="w-full lg:w-96 space-y-6 no-print">
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 space-y-8 max-h-[85vh] overflow-y-auto no-scrollbar">
                 <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">Canvas Editor</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Branding & Layout Controls</p>
                 </div>

                 {/* Master Toggle */}
                 <section className="p-1 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <label className="flex items-center justify-between p-4 cursor-pointer">
                       <div>
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Apply to Bills & Invoices</p>
                          <p className="text-[8px] text-indigo-400 font-bold uppercase">Activate your custom design</p>
                       </div>
                       <div className="relative inline-block w-10 h-5">
                          <input type="checkbox" className="sr-only peer" checked={data.templateSettings.applyToPrinting} onChange={e => updateTemplate('applyToPrinting', e.target.checked)} />
                          <div className="w-full h-full bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-5"></div>
                       </div>
                    </label>
                 </section>

                 <section className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Logo Configuration</label>
                    <div className="flex items-center gap-4">
                       <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center">
                          {data.business?.logo ? <img src={data.business.logo} alt="Logo" className="w-full h-full object-contain p-1" /> : <span className="text-[8px] font-black text-slate-300">NO LOGO</span>}
                       </div>
                       <div className="flex-1 space-y-2">
                          <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                          <button onClick={() => logoInputRef.current?.click()} className="w-full py-2 bg-indigo-600 text-white font-black text-[9px] uppercase rounded-lg shadow-sm">Browse New Logo</button>
                          {data.business?.logo && <button onClick={() => updateData(prev => ({ ...prev, business: prev.business ? { ...prev.business, logo: undefined } : null }))} className="w-full py-2 border border-rose-200 text-rose-500 font-black text-[9px] uppercase rounded-lg">Remove Logo</button>}
                       </div>
                    </div>
                    <div>
                       <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Display Size ({data.templateSettings.logoSize}px)</label>
                       <input type="range" min="40" max="200" step="5" value={data.templateSettings.logoSize} onChange={e => updateTemplate('logoSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                 </section>

                 <section>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3">Target Paper Size</label>
                    <div className="grid grid-cols-3 gap-2">
                       {(['A4', 'Thermal80', 'Thermal58'] as PrintSize[]).map(size => (
                          <button key={size} onClick={() => setPreviewSize(size)} className={`py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${previewSize === size ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}>{size}</button>
                       ))}
                    </div>
                 </section>

                 <section>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3">Text Scale ({data.templateSettings.fontSize}px)</label>
                    <input type="range" min="8" max="22" value={data.templateSettings.fontSize} onChange={e => updateTemplate('fontSize', parseInt(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                 </section>

                 <section>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3">Line Density ({data.templateSettings.lineSpacing})</label>
                    <input type="range" min="0.8" max="2.5" step="0.1" value={data.templateSettings.lineSpacing} onChange={e => updateTemplate('lineSpacing', parseFloat(e.target.value))} className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                 </section>

                 <section className="space-y-3">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Toggle Components</label>
                    {[
                       { id: 'showLogo', label: 'Company Logo' },
                       { id: 'showRatePerUnit', label: 'Rate Column' },
                       { id: 'showSKU', label: 'SKU Codes' },
                       { id: 'includeSignatures', label: 'Signatures' },
                       { id: 'compactMode', label: 'Compact Layout' }
                    ].map(item => (
                       <label key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-white hover:border-indigo-200 transition-all group">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider group-hover:text-indigo-600">{item.label}</span>
                          <input type="checkbox" checked={(data.templateSettings as any)[item.id]} onChange={e => updateTemplate(item.id as any, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                       </label>
                    ))}
                 </section>

                 <section>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3">Border Weight</label>
                    <div className="flex gap-2">
                       {[0, 1, 2, 4].map(w => (
                          <button key={w} onClick={() => updateTemplate('borderWeight', w)} className={`flex-1 py-1 rounded-lg border text-[10px] font-black ${data.templateSettings.borderWeight === w ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>{w}px</button>
                       ))}
                    </div>
                 </section>

                 <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div>
                       <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Greeting / Footer</label>
                       <textarea rows={2} value={data.templateSettings.footerText} onChange={e => updateTemplate('footerText', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-400" />
                    </div>
                    <div>
                       <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Terms & Conditions</label>
                       <textarea rows={2} value={data.templateSettings.termsText} onChange={e => updateTemplate('termsText', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-400" />
                    </div>
                 </div>

                 <section className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Custom Fields</label>
                       <button onClick={() => updateTemplate('customFields', [...(data.templateSettings.customFields || []), { id: crypto.randomUUID(), label: 'New Field', value: '' }])} className="text-[9px] font-black text-indigo-600 uppercase hover:underline">+ Add Field</button>
                    </div>
                    <div className="space-y-3">
                       {data.templateSettings.customFields?.map((field, index) => (
                          <div key={field.id} className="flex gap-2 items-center">
                             <input type="text" value={field.label} onChange={e => {
                                const newFields = [...(data.templateSettings.customFields || [])];
                                newFields[index] = { ...field, label: e.target.value };
                                updateTemplate('customFields', newFields);
                             }} className="w-1/3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-400" placeholder="Label" />
                             <input type="text" value={field.value} onChange={e => {
                                const newFields = [...(data.templateSettings.customFields || [])];
                                newFields[index] = { ...field, value: e.target.value };
                                updateTemplate('customFields', newFields);
                             }} className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-400" placeholder="Value (supports {{inv_number}} etc)" />
                             <button onClick={() => {
                                const newFields = (data.templateSettings.customFields || []).filter(f => f.id !== field.id);
                                updateTemplate('customFields', newFields);
                             }} className="p-2 text-rose-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                       ))}
                       {(!data.templateSettings.customFields || data.templateSettings.customFields.length === 0) && (
                          <p className="text-[9px] text-slate-300 italic text-center">No custom fields added</p>
                       )}
                    </div>
                 </section>

                 <button onClick={() => updateData(prev => ({...prev, templateSettings: {
                    applyToPrinting: true, showLogo: true, logoSize: 80, showSKU: false, showRatePerUnit: true, showDues: true,
                    footerText: "Thank you for your business!", termsText: "Goods once sold will not be returned.",
                    brandColor: "#4f46e5", includeSignatures: true, fontSize: 12, lineSpacing: 1.2, compactMode: false, borderWeight: 2,
                    customFields: []
                 }}))} className="w-full py-3 text-[9px] font-black text-rose-600 uppercase tracking-widest border border-rose-100 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all">Reset to Factory Default</button>
              </div>
           </div>

           {/* Live Preview Canvas */}
           <div className="flex-1 bg-slate-200 rounded-[40px] p-6 lg:p-12 flex justify-center min-h-[800px] overflow-hidden">
              <div 
                className="bg-white shadow-2xl transition-all duration-300 transform origin-top overflow-hidden"
                style={{ 
                  width: previewSize === 'Thermal58' ? '58mm' : previewSize === 'Thermal80' ? '80mm' : '210mm',
                  minHeight: previewSize === 'A4' ? '297mm' : 'auto',
                  fontSize: `${data.templateSettings.fontSize}px`,
                  lineHeight: data.templateSettings.lineSpacing,
                  fontFamily: previewSize === 'A4' ? 'inherit' : 'monospace',
                  color: 'black'
                }}
              >
                <div className={`h-full border-black ${data.templateSettings.compactMode ? 'p-3' : 'p-8'}`} style={{ borderWidth: `${data.templateSettings.borderWeight}px` }}>
                  <div className="text-center mb-6">
                    {data.templateSettings.showLogo && data.business?.logo && (
                      <img src={data.business.logo} alt="Logo" className="mx-auto mb-4 object-contain opacity-90 mix-blend-multiply" style={{ width: `${data.templateSettings.logoSize}px` }} />
                    )}
                    <h1 className="font-black uppercase tracking-tighter" style={{ fontSize: '1.8em' }}>{data.business?.name}</h1>
                    <p className="font-bold opacity-75 uppercase tracking-widest" style={{ fontSize: '0.7em' }}>{data.business?.tagline}</p>
                    <div className="mt-2 font-medium" style={{ fontSize: '0.65em' }}>
                        <p>{data.business?.address}</p>
                        <p>Ph: {data.business?.phone}</p>
                    </div>
                    <h2 className="mt-4 border-black font-black uppercase tracking-[0.2em] py-1" style={{ borderTopWidth: '1px', borderBottomWidth: '1px', fontSize: '0.8em' }}>Sale Invoice</h2>
                  </div>

                  <div className="flex justify-between mb-6 font-black uppercase" style={{ fontSize: '0.7em' }}>
                      <div className="text-left">
                         <p className="opacity-40">Billed To</p>
                         <p className="text-lg tracking-tight">{MOCK_SALE.customerName}</p>
                      </div>
                      <div className="text-right">
                         <p className="opacity-40">Invoice Reference</p>
                         <p>#{MOCK_SALE.invoiceNumber}</p>
                         <p>{formatDate(MOCK_SALE.date)}</p>
                      </div>
                  </div>

                  <table className="w-full mb-8 border-collapse">
                    <thead className="border-black uppercase" style={{ borderTopWidth: '2px', borderBottomWidth: '2px', fontSize: '0.65em' }}>
                      <tr>
                        <th className="py-2 text-left">Description</th>
                        <th className="py-2 text-center">Qty</th>
                        {data.templateSettings.showRatePerUnit && <th className="py-2 text-right">Rate</th>}
                        <th className="py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold" style={{ fontSize: '0.85em' }}>
                      {MOCK_SALE.items.map((it, i) => (
                        <tr key={i}>
                          <td className="py-3 uppercase leading-tight">
                             {it.productName}
                             {data.templateSettings.showSKU && <div className="text-[0.6em] opacity-40">SKU: PROD_{i}</div>}
                          </td>
                          <td className="py-3 text-center">{it.quantity}{it.unit}</td>
                          {data.templateSettings.showRatePerUnit && <td className="py-3 text-right">₹{it.rate}</td>}
                          <td className="py-3 text-right">₹{it.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex flex-col items-end pt-4 border-black" style={{ borderTopWidth: '2px' }}>
                     <div className="w-full space-y-2">
                        <div className="flex justify-between font-black uppercase" style={{ fontSize: '0.7em' }}>
                           <span className="opacity-50">Sub-Total Value</span>
                           <span>₹{MOCK_SALE.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-2">
                           <span className="font-black uppercase" style={{ fontSize: '0.7em' }}>Net Payable</span>
                           <span className="font-black" style={{ fontSize: '2em', letterSpacing: '-0.05em' }}>₹{MOCK_SALE.totalAmount.toLocaleString()}</span>
                        </div>
                     </div>
                  </div>

                  {data.templateSettings.footerText && (
                     <p className="mt-8 text-center font-bold italic opacity-60" style={{ fontSize: '0.65em' }}>
                       {applyTemplate(data.templateSettings.footerText, MOCK_SALE)}
                     </p>
                  )}

                  {data.templateSettings.includeSignatures && (
                    <div className="mt-16 mb-4 flex justify-between px-2">
                      <div className="text-center">
                         <div className="border-t border-black w-20 mx-auto mb-1"></div>
                         <p className="font-black uppercase opacity-60" style={{ fontSize: '0.45em' }}>Receiver</p>
                      </div>
                      <div className="text-center">
                         <div className="border-t border-black w-20 mx-auto mb-1"></div>
                         <p className="font-black uppercase opacity-60" style={{ fontSize: '0.45em' }}>Authorized</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 text-center border-t border-dotted border-gray-400 pt-4">
                    <p className="font-black uppercase tracking-widest opacity-30" style={{ fontSize: '0.5em' }}>AM Food Processing Suite</p>
                    {data.templateSettings.termsText && (
                       <p className="mt-2 font-medium opacity-40 leading-none" style={{ fontSize: '0.45em' }}>{data.templateSettings.termsText}</p>
                    )}
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {settingsTab === 'users' && isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
           <div className="bg-slate-900 px-8 py-6 text-white"><h3 className="text-xl font-black uppercase tracking-tight">Staff Credentials</h3></div>
           <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
              <form onSubmit={handleAddStaff} className="space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">New Access Node</h4>
                 <input type="text" placeholder="Username" required value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value})} className="w-full p-3 border rounded-xl font-bold" />
                 <input type="text" placeholder="Access Key" required value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} className="w-full p-3 border rounded-xl font-bold" />
                 <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase">Authorize Staff</button>
              </form>
              <div className="space-y-3">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Authorized Users</h4>
                 {data.users.map(u => (
                   <div key={u.id} className="flex justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="text-xs font-black uppercase">{u.username}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{u.role}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {settingsTab === 'sync' && isAdmin && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300">
           <div className="bg-slate-950 px-8 py-6 text-white"><h3 className="text-xl font-black uppercase tracking-tight">Data Archive Resonance</h3></div>
           <div className="p-8 space-y-8">
              {/* Local Folder Management */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Primary Local Folder */}
                 <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-200 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${data.isLocalFolderConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                       <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                       </svg>
                    </div>
                    <h4 className="font-black uppercase text-xs mb-2 tracking-widest">Primary Local Archive</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-6">
                       {data.isLocalFolderConnected ? `Connected: ${data.localFolderName}` : 'Synchronize with a local directory'}
                    </p>
                    <div className="flex w-full gap-2">
                       <button 
                          onClick={() => handleBrowseFolder(1)} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 ${data.isLocalFolderConnected ? 'bg-white text-slate-600 border border-slate-200' : 'bg-indigo-600 text-white'}`}
                       >
                          {data.isLocalFolderConnected ? 'Change Folder' : 'Browse Folder'}
                       </button>
                       {data.isLocalFolderConnected && (
                          <button onClick={() => disconnectFolder(1)} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                       )}
                    </div>
                 </div>

                 {/* Secondary Local Folder */}
                 <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-200 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${data.isLocalFolder2Connected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                       <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                       </svg>
                    </div>
                    <h4 className="font-black uppercase text-xs mb-2 tracking-widest">Secondary Redundant Archive</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-6">
                       {data.isLocalFolder2Connected ? `Connected: ${data.localFolder2Name}` : 'Parallel backup for safety'}
                    </p>
                    <div className="flex w-full gap-2">
                       <button 
                          onClick={() => handleBrowseFolder(2)} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 ${data.isLocalFolder2Connected ? 'bg-white text-slate-600 border border-slate-200' : 'bg-indigo-600 text-white'}`}
                       >
                          {data.isLocalFolder2Connected ? 'Change Folder' : 'Browse Folder'}
                       </button>
                       {data.isLocalFolder2Connected && (
                          <button onClick={() => disconnectFolder(2)} className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                       )}
                    </div>
                 </div>
              </div>

              {/* Portable File Section - New */}
              <div className="pt-8 border-t border-slate-100">
                 <h4 className="font-black uppercase text-[10px] text-slate-400 mb-6 text-center tracking-[0.4em]">Portable File Archives</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-center text-center">
                       <h4 className="font-black uppercase text-xs mb-2">Export Data File</h4>
                       <p className="text-[10px] text-slate-500 mb-6 font-bold uppercase">Download a local .JSON backup file</p>
                       <button 
                          onClick={handleManualExport}
                          className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase transition-all shadow-xl hover:bg-black active:scale-95 flex items-center justify-center space-x-2"
                       >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          <span>Generate Backup File</span>
                       </button>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-center text-center">
                       <h4 className="font-black uppercase text-xs mb-2">Import Data File</h4>
                       <p className="text-[10px] text-slate-500 mb-6 font-bold uppercase">Restore state from a .JSON backup</p>
                       <input 
                          type="file" 
                          ref={importFileRef} 
                          onChange={handleManualImport} 
                          accept=".json" 
                          className="hidden" 
                       />
                       <button 
                          onClick={() => importFileRef.current?.click()}
                          className="w-full py-4 border-2 border-slate-900 text-slate-900 font-black rounded-2xl text-[10px] uppercase transition-all hover:bg-slate-900 hover:text-white active:scale-95 flex items-center justify-center space-x-2"
                       >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <span>Restore from File</span>
                       </button>
                    </div>
                 </div>
              </div>

              {/* Cloud Resonance */}
              <div className="pt-8 border-t border-slate-100">
                 <h4 className="font-black uppercase text-[10px] text-slate-400 mb-6 text-center tracking-[0.4em]">Cloud Resonance Nodes</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                       <h4 className="font-black uppercase text-xs mb-3">Google Drive Node</h4>
                       <button onClick={syncDriveNow} className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase transition-all active:scale-95 shadow-lg">Manual Cloud Push</button>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                       <h4 className="font-black uppercase text-xs mb-3">Health Check</h4>
                       <button onClick={() => onManualSync()} className="w-full py-3 border-2 border-indigo-600 text-indigo-600 font-black rounded-xl text-[10px] uppercase transition-all active:scale-95">Test Global Resonance</button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Settings;