
import { AppData, User, DashboardWidget } from '../types';

const STORAGE_KEY = 'am_food_processing_data';
const HANDLE_DB_NAME = 'am_food_handles_db';
const HANDLE_STORE_NAME = 'handles';

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: '1', type: 'kpi_sales', title: 'Total Sales', color: 'indigo', width: 'third' },
  { id: '2', type: 'kpi_expenses', title: 'Total Expenses', color: 'red', width: 'third' },
  { id: '3', type: 'kpi_profit', title: 'Net Profit', color: 'emerald', width: 'third' },
  { id: '4', type: 'chart_performance', title: 'Weekly Performance', width: 'two-thirds' },
  { id: '5', type: 'list_activity', title: 'Recent Activity', width: 'third' }
];

const DEFAULT_DATA: AppData = {
  business: null,
  users: [],
  currentUser: null,
  customers: [],
  products: [],
  sales: [],
  expenses: [],
  dashboardWidgets: DEFAULT_WIDGETS,
  isInitialized: false,
  theme: 'indigo',
  isLocalFolderConnected: false,
  syncImmediatelyLocal: true,
  isDriveConnected: false,
  isOneDriveConnected: false,
  backupFolderName: 'AM_Food_Manager_Backups',
  snapshots: []
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

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await getHandleDB();
  const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
  tx.objectStore(HANDLE_STORE_NAME).put(handle, 'backup-folder');
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const loadDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await getHandleDB();
  const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
  const request = tx.objectStore(HANDLE_STORE_NAME).get('backup-folder');
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || null);
  });
};

export const clearDirectoryHandle = async (): Promise<void> => {
  const db = await getHandleDB();
  const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
  tx.objectStore(HANDLE_STORE_NAME).delete('backup-folder');
};

export const loadData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_DATA;
  try {
    const data = JSON.parse(stored);
    if (!data.users) data.users = [];
    if (!data.customers) data.customers = [];
    if (!data.products) data.products = [];
    if (!data.theme) data.theme = 'indigo';
    if (!data.snapshots) data.snapshots = [];
    if (!data.dashboardWidgets) data.dashboardWidgets = DEFAULT_WIDGETS;
    if (data.syncImmediatelyLocal === undefined) data.syncImmediatelyLocal = true;
    if (data.isLocalFolderConnected === undefined) data.isLocalFolderConnected = false;
    
    data.customers = data.customers.map((c: any) => ({
      ...c,
      pendingBalance: c.pendingBalance || 0
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
