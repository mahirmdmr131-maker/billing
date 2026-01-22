
export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface BusinessInfo {
  name: string;
  phone: string;
  address: string;
  gst?: string;
  logo?: string;
  tagline: string;
}

export interface Product {
  id: string;
  name: string;
  defaultRate: number;
  unit: string;
  currentStock?: number; // Tracking quantity
  minThreshold?: number; // Alert threshold
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gst?: string;
  createdAt: string;
  pendingBalance: number;
}

export interface SaleItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Pending';

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string; // Field to track when payment is expected
  customerId?: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  category: string;
  createdBy: string;
  isMistake?: boolean;
  paymentMethod: PaymentMethod;
  includePreviousBalance?: boolean; // Track if previous balance was included at time of sale
}

export interface Expense {
  id: string;
  date: string;
  dueDate?: string; // Field to track when expense payment is due
  category: string;
  description: string;
  amount: number;
}

export type DashboardWidgetType = 
  | 'kpi_sales' 
  | 'kpi_expenses' 
  | 'kpi_profit' 
  | 'kpi_customers' 
  | 'kpi_dues' 
  | 'chart_performance' 
  | 'list_activity'
  | 'list_low_stock';

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  color?: string;
  width: 'full' | 'half' | 'third' | 'two-thirds';
}

export type AppTheme = 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate' | 'cyan';

export interface AppData {
  business: BusinessInfo | null;
  users: User[];
  currentUser: User | null;
  customers: Customer[];
  products: Product[]; 
  sales: Sale[];
  expenses: Expense[];
  dashboardWidgets: DashboardWidget[];
  isInitialized: boolean;
  theme: AppTheme;
  lastBackupDate?: string; 
  isLocalFolderConnected: boolean;
  localFolderName?: string;
  syncImmediatelyLocal: boolean;
  snapshots: { date: string; data: string }[]; 
  isDriveConnected: boolean; 
  isOneDriveConnected: boolean;
  backupFolderName: string;
}

export enum NavigationTab {
  Dashboard = 'dashboard',
  Customers = 'customers',
  Products = 'products',
  Sales = 'sales',
  Expenses = 'expenses',
  Invoices = 'invoices',
  Reports = 'reports',
  Settings = 'settings'
}
