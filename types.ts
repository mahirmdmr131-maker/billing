
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

export interface UpiQr {
  id: string;
  name: string;
  imageData: string; // base64
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
  dueDate?: string; 
  paidDate?: string; // Track when a pending bill was cleared
  customerId?: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  category: string;
  createdBy: string;
  isMistake?: boolean;
  paymentMethod: PaymentMethod;
  selectedUpiQrId?: string; // Track which QR was used
  includePreviousBalance?: boolean; 
}

export interface Expense {
  id: string;
  date: string;
  dueDate?: string; 
  category: string;
  description: string;
  amount: number;
}

export interface RecycleBin {
  sales: (Sale & { deletedAt: string })[];
  expenses: (Expense & { deletedAt: string })[];
  customers: (Customer & { deletedAt: string })[];
  products: (Product & { deletedAt: string })[];
}

export type DashboardWidgetType = 
  | 'kpi_sales' 
  | 'kpi_sales_today'
  | 'kpi_sales_week'
  | 'kpi_sales_month'
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
  adminRecoveryCode?: string; // Secret code for admin to reset password
  customers: Customer[];
  products: Product[]; 
  upiQrs: UpiQr[]; // Added UPI QR codes
  sales: Sale[];
  expenses: Expense[];
  recycleBin: RecycleBin;
  dashboardWidgets: DashboardWidget[];
  isInitialized: boolean;
  theme: AppTheme;
  lastBackupDate?: string; 
  isLocalFolderConnected: boolean;
  localFolderName?: string;
  isLocalFolder2Connected: boolean;
  localFolder2Name?: string;
  syncImmediatelyLocal: boolean;
  snapshots: { date: string; data: string }[]; 
  isDriveConnected: boolean; 
  isOneDriveConnected: boolean;
  backupFolderName: string;
  autoLogoutMinutes?: number; 
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
