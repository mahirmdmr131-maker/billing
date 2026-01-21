
import { AppData, User, DashboardWidget } from '../types';

const STORAGE_KEY = 'am_food_processing_data';

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
