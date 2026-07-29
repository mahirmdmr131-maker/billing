import { AppData, User, DashboardWidget, RecycleBin, TemplateSettings } from '../types';

const STORAGE_KEY = 'am_food_processing_data';
const HANDLE_DB_NAME = 'am_food_handles_db';
const HANDLE_STORE_NAME = 'handles';

const DEFAULT_TEMPLATE: TemplateSettings = {
  applyToPrinting: true, // Default to true
  showLogo: true,
  logoSize: 80,
  showSKU: false,
  showRatePerUnit: true,
  showDues: true,
  footerText: "Thank you for your business!",
  termsText: "Goods once sold will not be returned.",
  brandColor: "#4f46e5",
  includeSignatures: true,
  fontSize: 12,
  lineSpacing: 1.2,
  compactMode: false,
  borderWeight: 2,
  customFields: []
};

const DEFAULT_RECYCLE_BIN: RecycleBin = {
  sales: [],
  expenses: [],
  customers: [],
  products: [],
  futureOrders: []
};

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: '1', type: 'kpi_sales', title: 'Total Sales', color: 'indigo', width: 'third' },
  { id: '2', type: 'kpi_expenses', title: 'Total Expenses', color: 'red', width: 'third' },
  { id: '3', type: 'kpi_profit', title: 'Net Profit', color: 'emerald', width: 'third' },
  { id: '4', type: 'kpi_dues', title: 'Outstanding Dues', color: 'amber', width: 'third' },
  { id: '5', type: 'chart_performance', title: 'Weekly Performance', width: 'two-thirds' },
  { id: '6', type: 'list_activity', title: 'Recent Activity', width: 'third' }
];

const DEFAULT_DATA: AppData = {
  business: null,
  users: [],
  roles: [],
  currentUser: null,
  customers: [],
  products: [],
  upiQrs: [],
  sales: [],
  futureOrders: [],
  expenses: [],
  settlements: [],
  recycleBin: DEFAULT_RECYCLE_BIN,
  dashboardWidgets: DEFAULT_WIDGETS,
  isInitialized: false,
  theme: 'indigo',
  isLocalFolderConnected: false,
  isLocalFolder2Connected: false,
  syncImmediatelyLocal: true,
  isDriveConnected: false,
  isOneDriveConnected: false,
  backupFolderName: 'AM_Food_Manager_Backups',
  snapshots: [],
  autoLogoutMinutes: 0,
  templateSettings: DEFAULT_TEMPLATE
};

export const getHandleDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        request.result.createObjectStore(HANDLE_STORE_NAME);
      }
      if (!request.result.objectStoreNames.contains('app_data_store')) {
        request.result.createObjectStore('app_data_store');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle, key: string = 'backup-folder'): Promise<void> => {
  const db = await getHandleDB();
  const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
  tx.objectStore(HANDLE_STORE_NAME).put(handle, key);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const loadDirectoryHandle = async (key: string = 'backup-folder'): Promise<FileSystemDirectoryHandle | null> => {
  const db = await getHandleDB();
  const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
  const request = tx.objectStore(HANDLE_STORE_NAME).get(key);
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || null);
  });
};

export const clearDirectoryHandle = async (key: string = 'backup-folder'): Promise<void> => {
  const db = await getHandleDB();
  const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
  tx.objectStore(HANDLE_STORE_NAME).delete(key);
};

// Now async to support IndexedDB
export const loadDataAsync = async (): Promise<AppData> => {
  try {
    const db = await getHandleDB();
    const tx = db.transaction('app_data_store', 'readonly');
    const request = tx.objectStore('app_data_store').get(STORAGE_KEY);
    
    const stored = await new Promise<string | null>((resolve) => {
      request.onsuccess = () => resolve(request.result || localStorage.getItem(STORAGE_KEY));
      request.onerror = () => resolve(localStorage.getItem(STORAGE_KEY));
    });

    if (!stored) return DEFAULT_DATA;

    const data = JSON.parse(stored);
    
    // Polyfill missing structural arrays
    if (!data.templateSettings) data.templateSettings = DEFAULT_TEMPLATE;
    else {
      if (data.templateSettings.applyToPrinting === undefined) data.templateSettings.applyToPrinting = true;
      if (data.templateSettings.fontSize === undefined) data.templateSettings.fontSize = 12;
      if (data.templateSettings.lineSpacing === undefined) data.templateSettings.lineSpacing = 1.2;
      if (data.templateSettings.compactMode === undefined) data.templateSettings.compactMode = false;
      if (data.templateSettings.borderWeight === undefined) data.templateSettings.borderWeight = 2;
      if (data.templateSettings.logoSize === undefined) data.templateSettings.logoSize = 80;
      if (data.templateSettings.customFields === undefined) data.templateSettings.customFields = [];
    }
    if (!data.users) data.users = [];
    
    // Migration: Upgrade old "admin" role to "super_admin" since admin is no longer the highest role.
    data.users = data.users.map((u: any) => {
      if (u.role === 'admin') {
        return { ...u, role: 'super_admin' };
      }
      return u;
    });

    if (!data.customers) data.customers = [];
    if (!data.suppliers) data.suppliers = [];
    if (!data.purchases) data.purchases = [];
    if (!data.products) data.products = [];
    if (!data.upiQrs) data.upiQrs = [];
    if (!data.sales) data.sales = [];
    if (!data.futureOrders) data.futureOrders = [];
    if (!data.expenses) data.expenses = [];
    if (!data.settlements) data.settlements = [];
    if (!data.recycleBin) data.recycleBin = DEFAULT_RECYCLE_BIN;
    if (!data.recycleBin.futureOrders) data.recycleBin.futureOrders = [];
    if (!data.theme) data.theme = 'indigo';
    if (!data.snapshots) data.snapshots = [];
    if (!data.dashboardWidgets) data.dashboardWidgets = DEFAULT_WIDGETS;
    if (data.syncImmediatelyLocal === undefined) data.syncImmediatelyLocal = true;
    if (data.isLocalFolderConnected === undefined) data.isLocalFolderConnected = false;
    if (data.isLocalFolder2Connected === undefined) data.isLocalFolder2Connected = false;
    if (data.autoLogoutMinutes === undefined) data.autoLogoutMinutes = 0;
    
    data.customers = data.customers.map((c: any) => ({
      ...c,
      pendingBalance: c.pendingBalance || 0
    }));

    data.products = data.products.map((p: any) => ({
      ...p,
      priceHistory: p.priceHistory || []
    }));

    if (data.currentUser) {
      const userExists = data.users.find((u: User) => u.id === data.currentUser.id);
      if (!userExists && data.users.length > 0) data.currentUser = null;
    }

    return data;
  } catch (e) {
    console.error("Failed to parse stored data", e);
    return DEFAULT_DATA;
  }
};

// Backwards compatibility for synchronous initial render if needed
export const loadData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_DATA;
  try {
    const data = JSON.parse(stored);
    if (data.users) {
      data.users = data.users.map((u: any) => {
        if (u.role === 'admin') {
          return { ...u, role: 'super_admin' };
        }
        return u;
      });
    }
    return data;
  } catch {
    return DEFAULT_DATA;
  }
};

export const saveData = async (data: AppData): Promise<void> => {
  const jsonStr = JSON.stringify(data);
  // Save to both for fallback during transition
  localStorage.setItem(STORAGE_KEY, jsonStr);
  
  try {
    const db = await getHandleDB();
    const tx = db.transaction('app_data_store', 'readwrite');
    tx.objectStore('app_data_store').put(jsonStr, STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to save to IndexedDB', e);
  }
};

export const resetData = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  getHandleDB().then(db => {
    const tx = db.transaction('app_data_store', 'readwrite');
    tx.objectStore('app_data_store').delete(STORAGE_KEY);
    tx.oncomplete = () => window.location.reload();
  }).catch(() => window.location.reload());
};