
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppData, NavigationTab, BusinessInfo, AppTheme, User, Sale } from './types';
import { loadData, saveData, loadDirectoryHandle, saveDirectoryHandle, clearDirectoryHandle } from './utils/storage';
import SplashScreen from './components/SplashScreen';
import SetupScreen from './components/SetupScreen';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Products from './components/Products';
import Sales from './components/Sales';
import FutureOrders from './components/FutureOrders'; // Import new component
import Expenses from './components/Expenses';
import Invoices from './components/Invoices';
import Reports from './components/Reports';
import Settings from './components/Settings';
import { IconDashboard, IconCustomers, IconProducts, IconSales, IconFutureOrders, IconExpenses, IconInvoices, IconReports, IconSettings } from './components/Icons';
import { uploadToDrive } from './utils/googleDrive';
import { uploadToOneDrive } from './utils/oneDrive';

// Directory handles for local folder sync (cannot be serialized to localStorage)
let directoryHandle1: any = null;
let directoryHandle2: any = null;

const AccessRestricted = () => (
  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h3 className="text-xl font-bold text-slate-800">Access Restricted</h3>
    <p className="text-slate-500">Only administrators can access this section.</p>
  </div>
);

const BusinessEditModal: React.FC<{
  business: BusinessInfo;
  isOpen: boolean;
  onClose: () => void;
  onSave: (info: BusinessInfo) => void;
}> = ({ business, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<BusinessInfo>(business);

  if (!isOpen) return null;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, logo: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 px-8 py-6 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">Edit Business Profile</h3>
            <p className="text-xs text-indigo-100 opacity-80 uppercase tracking-widest font-bold">Update your branding & details</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form className="p-8 space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(formData); }}>
          <div className="flex justify-center mb-6">
            <label className="cursor-pointer group relative">
              <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group-hover:border-indigo-500 transition-all">
                {formData.logo ? (
                  <img src={formData.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-slate-400 group-hover:text-indigo-500 font-bold text-xs">LOGO</div>
                )}
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors flex items-center justify-center">
                   <svg className="w-6 h-6 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812-1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Business Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tagline</label>
              <input type="text" value={formData.tagline} onChange={e => setFormData({ ...formData, tagline: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</label>
              <input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">GSTIN</label>
              <input type="text" value={formData.gst || ''} onChange={e => setFormData({ ...formData, gst: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium uppercase" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</label>
              <textarea rows={2} required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Save Profile</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(loadData());
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.Dashboard);
  const [selectedInvoicingSale, setSelectedInvoicingSale] = useState<Sale | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Notification Check Loop (For Future Orders)
  useEffect(() => {
    if (!data.currentUser) return;
    
    const checkNotifications = () => {
      const now = new Date().getTime();
      const needsNotify = data.futureOrders.filter(o => 
        o.status === 'Pending' && 
        !o.isNotified && 
        o.notificationTime && 
        new Date(o.notificationTime).getTime() <= now
      );

      if (needsNotify.length > 0) {
        needsNotify.forEach(order => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Order Reminder: A M Food', {
              body: `Order #${order.orderNumber} for ${order.customerName} is due for delivery on ${order.deliveryDate}.`,
              icon: data.business?.logo
            });
          } else {
            alert(`REMINDER: Order #${order.orderNumber} for ${order.customerName} delivery is due!`);
          }
          
          handleUpdateData(prev => ({
            ...prev,
            futureOrders: prev.futureOrders.map(o => o.id === order.id ? { ...o, isNotified: true } : o)
          }));
        });
      }
    };

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const intervalId = setInterval(checkNotifications, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [data.futureOrders, data.currentUser, data.business?.logo]);

  // Restore Local Directory Handles from IndexedDB on startup
  useEffect(() => {
    const restoreHandles = async () => {
      try {
        const handle1 = await loadDirectoryHandle('backup-folder-1');
        const handle2 = await loadDirectoryHandle('backup-folder-2');
        
        if (handle1) {
          try {
            const status = await (handle1 as any).queryPermission({ mode: 'readwrite' });
            if (status === 'granted') directoryHandle1 = handle1;
          } catch (e) { console.warn('Handle 1 permission restriction'); }
        }
        
        if (handle2) {
          try {
            const status = await (handle2 as any).queryPermission({ mode: 'readwrite' });
            if (status === 'granted') directoryHandle2 = handle2;
          } catch (e) { console.warn('Handle 2 permission restriction'); }
        }
      } catch (e) {
        console.error('Failed to restore directory handles', e);
      }
    };
    restoreHandles();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocalAutoBackup = useCallback(async (currentData: AppData) => {
    const handles = [
      { h: directoryHandle1, enabled: currentData.isLocalFolderConnected },
      { h: directoryHandle2, enabled: currentData.isLocalFolder2Connected }
    ];

    for (const item of handles) {
      if (!item.h || !item.enabled) continue;

      try {
        const status = await (item.h as any).queryPermission({ mode: 'readwrite' });
        if (status !== 'granted') continue;

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const fileName = `AM_Food_Backup_${dateStr}_${timeStr}.json`;
        
        const fileHandle = await item.h.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(currentData, null, 2));
        await writable.close();
      } catch (error) {
        console.error('Local backup iteration failed:', error);
      }
    }
  }, []);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const handleSetupComplete = (business: BusinessInfo, admin: User, recoveryCode: string) => {
    setData(prev => ({ 
      ...prev, 
      business, 
      users: [admin], 
      currentUser: admin, 
      adminRecoveryCode: recoveryCode,
      isInitialized: true 
    }));
  };

  const handleImportBackup = (importedData: AppData) => {
    setData(importedData);
    alert('Data imported successfully! Please log in to your account.');
  };

  const handleLogin = (user: User) => {
    setData(prev => ({ ...prev, currentUser: user }));
    setActiveTab(NavigationTab.Dashboard);
  };

  const handleLogout = useCallback(() => {
    setData(prev => ({ ...prev, currentUser: null }));
    directoryHandle1 = null;
    directoryHandle2 = null;
    setShowUserDropdown(false);
  }, []);

  // Idle Logout Logic
  useEffect(() => {
    if (!data.currentUser || !data.autoLogoutMinutes || data.autoLogoutMinutes <= 0) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLogout();
        alert('You have been logged out due to inactivity.');
      }, data.autoLogoutMinutes! * 60 * 1000);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => document.addEventListener(name, resetTimer));

    resetTimer(); // Initial call

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(name => document.removeEventListener(name, resetTimer));
    };
  }, [data.currentUser, data.autoLogoutMinutes, handleLogout]);

  const handleManualSync = async () => {
    let results = [];
    if (directoryHandle1 || directoryHandle2) {
      await handleLocalAutoBackup(data);
      results.push('Local Folder(s)');
    }
    
    if (data.isDriveConnected) {
      const driveOk = await uploadToDrive(data, data.backupFolderName);
      if (driveOk) results.push('Google Drive');
    }

    if (data.isOneDriveConnected) {
      const oneDriveOk = await uploadToOneDrive(data, data.backupFolderName);
      if (oneDriveOk) results.push('OneDrive');
    }

    if (results.length > 0) {
      alert(`Backup synchronization complete for: ${results.join(', ')}`);
    } else {
      alert('No active backup channels (Local Folders, Google Drive, or OneDrive) found.');
    }
  };

  const handleUpdateData = (updater: (prev: AppData) => AppData) => {
    setData(prev => {
      const next = updater(prev);
      if (next.syncImmediatelyLocal) {
        const hasStructuralChange = 
          next.sales.length !== prev.sales.length || 
          next.customers.length !== prev.customers.length || 
          next.products.length !== prev.products.length ||
          next.futureOrders.length !== prev.futureOrders.length ||
          next.expenses.length !== prev.expenses.length;

        if ((directoryHandle1 || directoryHandle2) && hasStructuralChange) {
          handleLocalAutoBackup(next);
        }
        if (next.isDriveConnected && hasStructuralChange) {
          uploadToDrive(next, next.backupFolderName);
        }
        if (next.isOneDriveConnected && hasStructuralChange) {
          uploadToOneDrive(next, next.backupFolderName);
        }
      }
      return next;
    });
  };

  const setLocalHandle = async (handle: any, slot: 1 | 2) => {
    if (slot === 1) {
      directoryHandle1 = handle;
      if (handle) await saveDirectoryHandle(handle, 'backup-folder-1');
      else await clearDirectoryHandle('backup-folder-1');
      setData(prev => ({ 
        ...prev, 
        isLocalFolderConnected: !!handle,
        localFolderName: handle ? handle.name : undefined 
      }));
    } else {
      directoryHandle2 = handle;
      if (handle) await saveDirectoryHandle(handle, 'backup-folder-2');
      else await clearDirectoryHandle('backup-folder-2');
      setData(prev => ({ 
        ...prev, 
        isLocalFolder2Connected: !!handle,
        localFolder2Name: handle ? handle.name : undefined 
      }));
    }
  };

  const isAdmin = data.currentUser?.role === 'admin';

  const themeColors = useMemo(() => {
    const maps: Record<AppTheme, { primary: string; secondary: string; text: string; light: string }> = {
      indigo: { primary: 'bg-indigo-900', secondary: 'bg-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50' },
      emerald: { primary: 'bg-emerald-900', secondary: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50' },
      rose: { primary: 'bg-rose-900', secondary: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50' },
      amber: { primary: 'bg-amber-900', secondary: 'bg-amber-600', text: 'text-amber-600', light: 'bg-amber-50' },
      slate: { primary: 'bg-slate-900', secondary: 'bg-slate-600', text: 'text-slate-600', light: 'bg-slate-50' },
      cyan: { primary: 'bg-cyan-900', secondary: 'bg-cyan-600', text: 'text-cyan-600', light: 'bg-cyan-50' }
    };
    return maps[data.theme || 'indigo'];
  }, [data.theme]);

  if (showSplash) return <SplashScreen business={data.business} />;
  if (!data.isInitialized) return <SetupScreen onComplete={handleSetupComplete} onImport={handleImportBackup} />;
  if (!data.currentUser) return <Login data={data} updateData={handleUpdateData} onLogin={handleLogin} />;

  const renderTabContent = () => {
    switch (activeTab) {
      case NavigationTab.Dashboard: return <Dashboard data={data} updateData={handleUpdateData} />;
      case NavigationTab.Customers: return <Customers data={data} updateData={handleUpdateData} onNavigateToInvoices={(sale) => { setSelectedInvoicingSale(sale); setActiveTab(NavigationTab.Invoices); }} />;
      case NavigationTab.Products: return <Products data={data} updateData={handleUpdateData} />;
      case NavigationTab.Sales: return <Sales data={data} updateData={handleUpdateData} onNavigateToInvoices={() => { setSelectedInvoicingSale(null); setActiveTab(NavigationTab.Invoices); }} />;
      case NavigationTab.FutureOrders: return <FutureOrders data={data} updateData={handleUpdateData} />;
      case NavigationTab.Expenses: return isAdmin ? <Expenses data={data} updateData={handleUpdateData} /> : <AccessRestricted />;
      case NavigationTab.Invoices: return <Invoices data={data} updateData={handleUpdateData} initialSale={selectedInvoicingSale} onResetInitialSale={() => setSelectedInvoicingSale(null)} />;
      case NavigationTab.Reports: return isAdmin ? <Reports data={data} /> : <AccessRestricted />;
      case NavigationTab.Settings: return <Settings data={data} updateData={handleUpdateData} onManualSync={handleManualSync} onLogout={handleLogout} onSetLocalHandle={setLocalHandle} />;
      default: return <Dashboard data={data} updateData={handleUpdateData} />;
    }
  };

  return (
    <div className={`min-h-screen pb-20 md:pb-0 md:pl-64 flex flex-col bg-slate-50`}>
      <aside className={`hidden md:flex fixed left-0 top-0 bottom-0 w-64 ${themeColors.primary} text-white flex-col p-6 shadow-xl z-20 overflow-y-auto`}>
        <div className="flex items-center space-x-3 mb-10 overflow-hidden">
          {data.business?.logo ? <img src={data.business.logo} alt="Logo" className="w-10 h-10 rounded bg-white p-1" /> : <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center font-bold text-xl">AM</div>}
          <h1 className="text-lg font-bold truncate leading-tight">AM Food Manager</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === NavigationTab.Dashboard} onClick={() => setActiveTab(NavigationTab.Dashboard)} icon={<IconDashboard />} label="Dashboard" />
          <NavItem active={activeTab === NavigationTab.Customers} onClick={() => setActiveTab(NavigationTab.Customers)} icon={<IconCustomers />} label="Customers" />
          <NavItem active={activeTab === NavigationTab.Products} onClick={() => setActiveTab(NavigationTab.Products)} icon={<IconProducts />} label="Products" />
          <NavItem active={activeTab === NavigationTab.Sales} onClick={() => setActiveTab(NavigationTab.Sales)} icon={<IconSales />} label="Billing" />
          <NavItem active={activeTab === NavigationTab.FutureOrders} onClick={() => setActiveTab(NavigationTab.FutureOrders)} icon={<IconFutureOrders />} label="Future Orders" />
          {isAdmin && <NavItem active={activeTab === NavigationTab.Expenses} onClick={() => setActiveTab(NavigationTab.Expenses)} icon={<IconExpenses />} label="Expenses" />}
          <NavItem active={activeTab === NavigationTab.Invoices} onClick={() => { setSelectedInvoicingSale(null); setActiveTab(NavigationTab.Invoices); }} icon={<IconInvoices />} label="Invoices" />
          {isAdmin && <NavItem active={activeTab === NavigationTab.Reports} onClick={() => setActiveTab(NavigationTab.Reports)} icon={<IconReports />} label="Reports" />}
          <div className="pt-4 border-t border-white/10 mt-4">
            <NavItem active={activeTab === NavigationTab.Settings} onClick={() => setActiveTab(NavigationTab.Settings)} icon={<IconSettings />} label="Settings" />
          </div>
        </nav>
      </aside>

      <header className="no-print sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
        <h2 className={`text-xl font-bold capitalize ${themeColors.text}`}>{activeTab.replace('_', ' ')}</h2>
        <div className="flex items-center space-x-4 relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-2xl transition-all group"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{data.currentUser?.username}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{data.currentUser?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
              {data.currentUser?.username.charAt(0).toUpperCase()}
            </div>
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-50">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">User Options</p>
                 <p className="text-sm font-bold text-slate-800">{data.currentUser?.username}</p>
              </div>
              <div className="p-2">
                {isAdmin && (
                  <button 
                    onClick={() => { setIsBusinessModalOpen(true); setShowUserDropdown(false); }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-all text-sm font-bold"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    <span>Edit Business Profile</span>
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-red-50 text-slate-700 hover:text-red-600 transition-all text-sm font-bold"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  <span>Logout Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">{renderTabContent()}</main>

      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <MobileNavItem active={activeTab === NavigationTab.Dashboard} onClick={() => setActiveTab(NavigationTab.Dashboard)} icon={<IconDashboard />} label="Dash" />
        <MobileNavItem active={activeTab === NavigationTab.Customers} onClick={() => setActiveTab(NavigationTab.Customers)} icon={<IconCustomers />} label="Clients" />
        <MobileNavItem active={activeTab === NavigationTab.Sales} onClick={() => setActiveTab(NavigationTab.Sales)} icon={<IconSales />} label="Bills" />
        <MobileNavItem active={activeTab === NavigationTab.FutureOrders} onClick={() => setActiveTab(NavigationTab.FutureOrders)} icon={<IconFutureOrders />} label="Orders" />
        <MobileNavItem active={activeTab === NavigationTab.Settings} onClick={() => setActiveTab(NavigationTab.Settings)} icon={<IconSettings />} label="Set" />
      </nav>

      {data.business && (
        <BusinessEditModal 
          business={data.business} 
          isOpen={isBusinessModalOpen} 
          onClose={() => setIsBusinessModalOpen(false)} 
          onSave={(info) => {
            handleUpdateData(prev => ({ ...prev, business: info }));
            setIsBusinessModalOpen(false);
          }} 
        />
      )}
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-white/20 text-white font-semibold' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
    <span className="w-6 h-6">{icon}</span>
    <span>{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => {
  return (
    <button onClick={onClick} className={`flex flex-col items-center space-y-1 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
      <div className={`p-1 rounded-md`}>{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
};

export default App;
