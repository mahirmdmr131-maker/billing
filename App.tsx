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
import FutureOrders from './components/FutureOrders'; 
import Expenses from './components/Expenses';
import Invoices from './components/Invoices';
import Reports from './components/Reports';
import Settings from './components/Settings';
import About from './components/About';
import AIAssistant from './components/AIAssistant';
import { IconDashboard, IconCustomers, IconProducts, IconSales, IconFutureOrders, IconExpenses, IconInvoices, IconReports, IconSettings, IconInfo, IconMenu, IconClose, IconEdit, IconStars } from './components/Icons';
import { GlobalSearch } from './components/GlobalSearch';
import { uploadToDrive, hasAccessToken, initGoogleAuth, getBackupInfo } from './utils/googleDrive';
import { uploadToOneDrive } from './utils/oneDrive';
import { listenToSales, syncSaleToFirestore } from './services/firebaseService';
import { auth } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

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
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Business Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none font-medium" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone</label>
              <input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none font-medium" />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl">Cancel</button>
            <button type="submit" className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Save Profile</button>
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
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedProductSearch, setSelectedProductSearch] = useState('');
  const [saleToDuplicate, setSaleToDuplicate] = useState<Sale | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isBusinessModalOpen, setIsBusinessModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        // For simplicity in this demo, sign in anonymously if not logged in
        signInAnonymously(auth).catch((error) => {
          console.warn('Anonymous auth not enabled. Firebase sync will be disabled.');
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const unsubscribe = listenToSales((firestoreSales) => {
      setData(prev => {
        const updatedSales = [...prev.sales];
        let hasChanges = false;
        
        firestoreSales.forEach(fSale => {
          const index = updatedSales.findIndex(s => s.id === fSale.id);
          if (index !== -1) {
            // Only update if Firestore version is newer or status changed
            if (updatedSales[index].paymentMethod !== fSale.paymentMethod) {
              updatedSales[index] = { ...updatedSales[index], ...fSale };
              hasChanges = true;
            }
          } else {
            // New sale from another device
            updatedSales.push(fSale);
            hasChanges = true;
          }
        });
        
        if (hasChanges) {
          return { ...prev, sales: updatedSales };
        }
        return prev;
      });
    });
    return () => unsubscribe();
  }, [isAuthReady]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const styleId = 'dynamic-theme-style';
    let styleTag = document.getElementById(styleId);
    if (data.theme === 'dynamic' && data.logoThemeColor) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      const primary = data.logoThemeColor;
      styleTag.innerHTML = `
        :root { --brand-primary: ${primary}; --brand-secondary: ${primary}; --brand-light: ${primary}20; }
        .bg-dynamic-primary { background-color: var(--brand-primary) !important; }
        .bg-dynamic-secondary { background-color: var(--brand-secondary) !important; }
        .bg-dynamic-light { background-color: var(--brand-light) !important; }
        .text-dynamic-primary { color: var(--brand-primary) !important; }
      `;
    } else if (styleTag) styleTag.remove();
  }, [data.theme, data.logoThemeColor]);

  useEffect(() => {
    const restoreHandles = async () => {
      try {
        const handle1 = await loadDirectoryHandle('backup-folder-1');
        const handle2 = await loadDirectoryHandle('backup-folder-2');
        
        let stateUpdates: Partial<AppData> = {};
        
        if (handle1) directoryHandle1 = handle1;
        else stateUpdates.isLocalFolderConnected = false;

        if (handle2) directoryHandle2 = handle2;
        else stateUpdates.isLocalFolder2Connected = false;

        if (Object.keys(stateUpdates).length > 0) {
          setData(prev => ({ ...prev, ...stateUpdates }));
        }
      } catch (e) {
        console.error('Failed to restore file handles:', e);
      }
    };
    restoreHandles();
  }, []);

  // Auto-connect to Google Drive on mount and verify connection
  useEffect(() => {
    if (data.isDriveConnected && !hasAccessToken()) {
      const timer = setTimeout(() => {
        console.log("Attempting Drive Auto-Connect...");
        initGoogleAuth(async (token, email) => {
          console.log('Drive auto-connected successfully for:', email);
          
          // Optional: Verify connection by checking backup folder access
          try {
            const info = await getBackupInfo(data.backupFolderName);
            if (info) {
              console.log('Drive Connection Verified: Backup folder found.', info);
            } else {
              console.log('Drive Connected: No existing backup found or folder empty.');
            }
          } catch (e) {
            console.warn('Drive Connection Warning: Could not verify folder access.', e);
          }
        }, true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [data.isDriveConnected, data.backupFolderName]);

  const handleLogout = useCallback(() => {
    setData(prev => ({ ...prev, currentUser: null }));
    directoryHandle1 = null;
    directoryHandle2 = null;
    setShowUserDropdown(false);
  }, []);

  // Session Timeout Logic
  useEffect(() => {
    if (!data.currentUser || !data.autoLogoutMinutes || data.autoLogoutMinutes <= 0) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert("Session timed out due to inactivity.");
        handleLogout();
      }, data.autoLogoutMinutes! * 60 * 1000);
    };

    // Events to track activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    // Initial start
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [data.currentUser, data.autoLogoutMinutes, handleLogout]);

  const handleLocalAutoBackup = useCallback(async (currentData: AppData) => {
    const handles = [
      { h: directoryHandle1, enabled: currentData.isLocalFolderConnected, name: 'Primary' },
      { h: directoryHandle2, enabled: currentData.isLocalFolder2Connected, name: 'Secondary' }
    ];
    
    let backedUp = false;
    for (const item of handles) {
      if (!item.h || !item.enabled) continue;
      try {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        // 1. Write Timestamped Backup (History)
        const fileNameHistory = `AM_Food_Backup_${dateStr}_${timeStr}.json`;
        const fileHandleHistory = await item.h.getFileHandle(fileNameHistory, { create: true });
        const writableHistory = await fileHandleHistory.createWritable();
        await writableHistory.write(JSON.stringify(currentData, null, 2));
        await writableHistory.close();

        // 2. Write Latest Backup (Overwrite for easy access)
        const fileNameLatest = `AM_Food_Backup_LATEST.json`;
        const fileHandleLatest = await item.h.getFileHandle(fileNameLatest, { create: true });
        const writableLatest = await fileHandleLatest.createWritable();
        await writableLatest.write(JSON.stringify(currentData, null, 2));
        await writableLatest.close();

        backedUp = true;
        console.log(`Backup successful to ${item.name} folder: ${fileNameHistory}`);
      } catch (error: any) { 
        console.error(`Local backup failed for ${item.name} folder:`, error);
        if (error.name === 'NotAllowedError') {
          console.warn(`Permission lost for ${item.name} folder. Please re-select in settings.`);
        }
      }
    }
    return backedUp;
  }, []);

  useEffect(() => {
    if (!data.isInitialized) return;
    
    // Auto-recalculate customer balances to fix any discrepancies
    setData(prev => {
      let hasChanges = false;
      const updatedCustomers = prev.customers.map(c => {
        const totalPendingSales = prev.sales
          .filter(s => s.customerId === c.id && !s.isMistake && s.paymentMethod === 'Pending')
          .reduce((sum, s) => sum + s.totalAmount, 0);
        
        const totalSettlements = (prev.settlements || [])
          .filter(s => s.customerId === c.id)
          .reduce((sum, s) => sum + s.amount, 0);
          
        const correctBalance = Math.max(0, totalPendingSales - totalSettlements);
        
        if (c.pendingBalance !== correctBalance) {
          hasChanges = true;
          return { ...c, pendingBalance: correctBalance };
        }
        return c;
      });
      
      if (hasChanges) {
        return { ...prev, customers: updatedCustomers };
      }
      return prev;
    });
  }, [data.isInitialized]);

  useEffect(() => { saveData(data); }, [data]);

  const handleSetupComplete = (business: BusinessInfo, admin: User, recoveryCode: string) => {
    setData(prev => ({ ...prev, business, users: [admin], currentUser: admin, adminRecoveryCode: recoveryCode, isInitialized: true }));
  };

  const handleLogin = (user: User) => {
    setData(prev => ({ ...prev, currentUser: user }));
    setActiveTab(NavigationTab.Dashboard);
  };

  const handleManualSync = async () => {
    await handleLocalAutoBackup(data);
    if (data.isDriveConnected) await uploadToDrive(data, data.backupFolderName);
    if (data.isOneDriveConnected) await uploadToOneDrive(data, data.backupFolderName);
    alert('Synchronization complete.');
  };

  const handleUpdateData = (updater: (prev: AppData) => AppData) => {
    setData(prev => {
      const next = updater(prev);
      
      // Sync pending sales to Firestore for payment link tracking
      const lastSale = next.sales[next.sales.length - 1];
      if (lastSale && lastSale.paymentMethod === 'Pending') {
        syncSaleToFirestore(lastSale);
      }

      if (next.syncImmediatelyLocal) {
        handleLocalAutoBackup(next);
        if (next.isDriveConnected && hasAccessToken()) uploadToDrive(next, next.backupFolderName);
        if (next.isOneDriveConnected) uploadToOneDrive(next, next.backupFolderName);
      }
      return next;
    });
  };

  const setLocalHandle = async (handle: any, slot: 1 | 2) => {
    if (slot === 1) {
      directoryHandle1 = handle;
      if (handle) await saveDirectoryHandle(handle, 'backup-folder-1');
      else await clearDirectoryHandle('backup-folder-1');
      setData(prev => ({ ...prev, isLocalFolderConnected: !!handle, localFolderName: handle ? handle.name : undefined }));
    } else {
      directoryHandle2 = handle;
      if (handle) await saveDirectoryHandle(handle, 'backup-folder-2');
      else await clearDirectoryHandle('backup-folder-2');
      setData(prev => ({ ...prev, isLocalFolder2Connected: !!handle, localFolder2Name: handle ? handle.name : undefined }));
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
      cyan: { primary: 'bg-cyan-900', secondary: 'bg-cyan-600', text: 'text-cyan-600', light: 'bg-cyan-50' },
      dynamic: { primary: 'bg-dynamic-primary', secondary: 'bg-dynamic-secondary', text: 'text-dynamic-primary', light: 'bg-dynamic-light' }
    };
    return maps[data.theme || 'indigo'];
  }, [data.theme]);

  const navigateTo = (tab: NavigationTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleGlobalNavigate = (tab: NavigationTab, item?: any) => {
    if (tab === NavigationTab.Invoices && item) {
      setSelectedInvoicingSale(item);
    } else if (tab === NavigationTab.Customers && item) {
      setSelectedCustomer(item);
    } else if (tab === NavigationTab.Products && item) {
      setSelectedProductSearch(item.name);
    }
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  if (showSplash) return <SplashScreen business={data.business} />;
  if (!data.isInitialized) return <SetupScreen onComplete={handleSetupComplete} onImport={(d) => setData(d)} />;
  if (!data.currentUser) return <Login data={data} updateData={handleUpdateData} onLogin={handleLogin} />;

  const renderTabContent = () => {
    switch (activeTab) {
      case NavigationTab.Dashboard: return <Dashboard data={data} updateData={handleUpdateData} />;
      case NavigationTab.Customers: return <Customers data={data} updateData={handleUpdateData} onNavigateToInvoices={(sale) => { setSelectedInvoicingSale(sale); setActiveTab(NavigationTab.Invoices); }} initialCustomer={selectedCustomer} onClearInitialCustomer={() => setSelectedCustomer(null)} />;
      case NavigationTab.Products: return <Products data={data} updateData={handleUpdateData} initialSearchTerm={selectedProductSearch} />;
      case NavigationTab.Sales: return <Sales data={data} updateData={handleUpdateData} onNavigateToInvoices={() => { setSelectedInvoicingSale(null); setActiveTab(NavigationTab.Invoices); }} initialSaleToDuplicate={saleToDuplicate} onClearDuplicate={() => setSaleToDuplicate(null)} />;
      case NavigationTab.FutureOrders: return <FutureOrders data={data} updateData={handleUpdateData} />;
      case NavigationTab.Expenses: return isAdmin ? <Expenses data={data} updateData={handleUpdateData} /> : <AccessRestricted />;
      case NavigationTab.Invoices: return <Invoices data={data} updateData={handleUpdateData} initialSale={selectedInvoicingSale} onResetInitialSale={() => setSelectedInvoicingSale(null)} onDuplicate={(sale) => { setSaleToDuplicate(sale); setActiveTab(NavigationTab.Sales); }} />;
      case NavigationTab.Reports: return isAdmin ? <Reports data={data} /> : <AccessRestricted />;
      case NavigationTab.AIAssistant: return isAdmin ? <AIAssistant data={data} /> : <AccessRestricted />;
      case NavigationTab.Settings: return <Settings data={data} updateData={handleUpdateData} onManualSync={handleManualSync} onLogout={handleLogout} onSetLocalHandle={setLocalHandle} />;
      case NavigationTab.About: return <About data={data} />;
      default: return <Dashboard data={data} updateData={handleUpdateData} />;
    }
  };

  return (
    <div className={`min-h-screen pb-0 ${isSidebarCollapsed ? 'md:pl-0' : 'md:pl-64'} transition-all duration-300 flex flex-col bg-slate-50 print:min-h-0 print:h-auto`}>
      {/* Main Sidebar (Drawer on Mobile) */}
      <aside className={`fixed inset-y-0 left-0 z-[50] w-64 ${themeColors.primary} text-white flex flex-col p-6 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'md:-translate-x-full' : 'md:translate-x-0'} overflow-y-auto no-print`}>
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center space-x-3 overflow-hidden">
            {data.business?.logo ? <img src={data.business.logo} alt="Logo" className="w-10 h-10 rounded bg-white p-1" /> : <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center font-bold">AM</div>}
            <h1 className="text-lg font-bold truncate">AM Food Manager</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 hover:bg-white/10 rounded-xl transition-colors">
            <IconClose className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === NavigationTab.Dashboard} onClick={() => navigateTo(NavigationTab.Dashboard)} icon={<IconDashboard />} label="Dashboard" />
          <NavItem active={activeTab === NavigationTab.Customers} onClick={() => navigateTo(NavigationTab.Customers)} icon={<IconCustomers />} label="Customers" />
          <NavItem active={activeTab === NavigationTab.Products} onClick={() => navigateTo(NavigationTab.Products)} icon={<IconProducts />} label="Products" />
          <NavItem active={activeTab === NavigationTab.Sales} onClick={() => navigateTo(NavigationTab.Sales)} icon={<IconSales />} label="Billing" />
          <NavItem active={activeTab === NavigationTab.FutureOrders} onClick={() => navigateTo(NavigationTab.FutureOrders)} icon={<IconFutureOrders />} label="Future Orders" />
          {isAdmin && <NavItem active={activeTab === NavigationTab.Expenses} onClick={() => navigateTo(NavigationTab.Expenses)} icon={<IconExpenses />} label="Expenses" />}
          <NavItem active={activeTab === NavigationTab.Invoices} onClick={() => { setSelectedInvoicingSale(null); navigateTo(NavigationTab.Invoices); }} icon={<IconInvoices />} label="Invoices" />
          {isAdmin && <NavItem active={activeTab === NavigationTab.Reports} onClick={() => navigateTo(NavigationTab.Reports)} icon={<IconReports />} label="Reports" />}
          {isAdmin && <NavItem active={activeTab === NavigationTab.AIAssistant} onClick={() => navigateTo(NavigationTab.AIAssistant)} icon={<IconStars />} label="AI Analyst" />}
          <div className="pt-4 border-t border-white/10 mt-4">
            <NavItem active={activeTab === NavigationTab.Settings} onClick={() => navigateTo(NavigationTab.Settings)} icon={<IconSettings />} label="Settings" />
            <NavItem active={activeTab === NavigationTab.About} onClick={() => navigateTo(NavigationTab.About)} icon={<IconInfo />} label="About Software" />
          </div>
        </nav>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[40] bg-slate-900/60 backdrop-blur-sm md:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <header className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-30 no-print">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors active:scale-95"
          >
            <IconMenu />
          </button>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className="hidden md:block p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 mr-2"
            title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
          >
            <IconMenu />
          </button>
          <div>
            <h2 className={`text-xl font-bold capitalize ${themeColors.text}`}>{activeTab.replace('_', ' ')}</h2>
            {(data.isLocalFolderConnected || data.isLocalFolder2Connected) && (
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest hidden md:block">
                • Auto-Sync Active
              </p>
            )}
          </div>
        </div>

        <GlobalSearch data={data} onNavigate={handleGlobalNavigate} />

        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setShowUserDropdown(!showUserDropdown)} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-2xl transition-all">
            <div className={`w-10 h-10 rounded-xl ${themeColors.light} ${themeColors.text} flex items-center justify-center font-black`}>
              {data.currentUser?.username.charAt(0).toUpperCase()}
            </div>
          </button>
          
          {showUserDropdown && (
            <div className="absolute top-14 right-0 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                <p className="font-black text-slate-800 truncate">{data.currentUser?.username}</p>
                <p className="text-xs text-slate-500 capitalize">{data.currentUser?.role}</p>
              </div>
              <div className="p-2 space-y-1">
                {isAdmin && (
                  <button
                    onClick={() => { setIsBusinessModalOpen(true); setShowUserDropdown(false); }}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center space-x-2"
                  >
                    <IconEdit className="w-4 h-4" />
                    <span>Edit Business</span>
                  </button>
                )}
                <button 
                  onClick={handleLogout} 
                  className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  <span>Change User</span>
                </button>
                <button 
                  onClick={handleLogout} 
                  className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto w-full print:p-0 print:max-w-none">{renderTabContent()}</main>

      {/* Kept bottom nav for common actions but ensured header menu is primary for all sections */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] no-print">
        <MobileNavItem active={activeTab === NavigationTab.Dashboard} onClick={() => navigateTo(NavigationTab.Dashboard)} icon={<IconDashboard />} label="Dash" themeColors={themeColors} />
        <MobileNavItem active={activeTab === NavigationTab.Customers} onClick={() => navigateTo(NavigationTab.Customers)} icon={<IconCustomers />} label="Clients" themeColors={themeColors} />
        <MobileNavItem active={activeTab === NavigationTab.Sales} onClick={() => navigateTo(NavigationTab.Sales)} icon={<IconSales />} label="Bills" themeColors={themeColors} />
        <MobileNavItem active={activeTab === NavigationTab.About} onClick={() => navigateTo(NavigationTab.About)} icon={<IconInfo />} label="About" themeColors={themeColors} />
      </nav>
      
      {isBusinessModalOpen && data.business && (
        <BusinessEditModal business={data.business} isOpen={isBusinessModalOpen} onClose={() => setIsBusinessModalOpen(false)} onSave={(info) => { handleUpdateData(prev => ({ ...prev, business: info })); setIsBusinessModalOpen(false); }} />
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

const MobileNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; themeColors: any }> = ({ active, onClick, icon, label, themeColors }) => (
  <button onClick={onClick} className={`flex flex-col items-center space-y-1 ${active ? themeColors.text : 'text-slate-400'}`}>
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export default App;