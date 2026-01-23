
import { AppData, User, DashboardWidget, RecycleBin } from '../types';

const STORAGE_KEY = 'am_food_processing_data';
const HANDLE_DB_NAME = 'am_food_handles_db';
const HANDLE_STORE_NAME = 'handles';

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
  currentUser: null,
  customers: [],
  products: [],
  upiQrs: [],
  sales: [],
  futureOrders: [],
  expenses: [],
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
  autoLogoutMinutes: 0
};

// IndexedDB Helper for FileSystemHandle persistence
export const getHandleDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(HANDLE_STORE_NAME);
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

export const loadData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_DATA;
  try {
    const data = JSON.parse(stored);
    if (!data.users) data.users = [];
    if (!data.customers) data.customers = [];
    if (!data.products) data.products = [];
    if (!data.upiQrs) data.upiQrs = [];
    if (!data.sales) data.sales = [];
    if (!data.futureOrders) data.futureOrders = [];
    if (!data.expenses) data.expenses = [];
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

    // Ensure priceHistory exists for all products
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

export const saveData = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const resetData = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};
