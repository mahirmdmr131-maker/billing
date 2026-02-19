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

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface TemplateSettings {
  applyToPrinting: boolean; // New: Master toggle for template application
  showLogo: boolean;
  logoSize: number; // 40 to 200
  showSKU: boolean;
  showRatePerUnit: boolean;
  showDues: boolean;
  footerText: string;
  termsText: string;
  brandColor: string;
  includeSignatures: boolean;
  fontSize: number; // 8 to 22
  lineSpacing: number; // 0.8 to 2.5
  compactMode: boolean; // Toggles dense packing
  borderWeight: number; // 0 to 4
  customFields: CustomField[];
}

export interface UpiQr {
  id: string;
  name: string;
  imageData: string; // base64
}

export interface PriceHistoryEntry {
  rate: number;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  code?: string; // SKU
  defaultRate: number;
  wholesaleRate?: number; 
  unit: string;
  currentStock?: number; 
  minThreshold?: number; 
  priceHistory?: PriceHistoryEntry[]; 
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
  batchNumber?: string; 
  expiryDate?: string;  
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Pending';

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string; 
  paidDate?: string; 
  customerId?: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  category: string;
  createdBy: string;
  isMistake?: boolean;
  paymentMethod: PaymentMethod;
  originalPaymentMethod?: PaymentMethod; 
  selectedUpiQrId?: string; 
  includePreviousBalance?: boolean; 
}

export interface FutureOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerId?: string;
  orderDate: string;
  deliveryDate: string;
  notificationTime?: string; 
  items: SaleItem[];
  totalAmount: number;
  advancePaid: number;
  status: 'Pending' | 'Delivered' | 'Cancelled';
  isNotified?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  dueDate?: string; 
  category: string;
  description: string;
  amount: number;
  paidAmount?: number;
  paymentMethod?: string;
  balance?: number;
}

export interface RecycleBin {
  sales: (Sale & { deletedAt: string })[];
  expenses: (Expense & { deletedAt: string })[];
  customers: (Customer & { deletedAt: string })[];
  products: (Product & { deletedAt: string })[];
  futureOrders: (FutureOrder & { deletedAt: string })[];
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

export type AppTheme = 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate' | 'cyan' | 'dynamic';

export interface AppData {
  business: BusinessInfo | null;
  users: User[];
  currentUser: User | null;
  adminRecoveryCode?: string; 
  customers: Customer[];
  products: Product[]; 
  upiQrs: UpiQr[]; 
  sales: Sale[];
  futureOrders: FutureOrder[]; 
  expenses: Expense[];
  recycleBin: RecycleBin;
  dashboardWidgets: DashboardWidget[];
  isInitialized: boolean;
  theme: AppTheme;
  logoThemeColor?: string; 
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
  templateSettings: TemplateSettings;
}

export enum NavigationTab {
  Dashboard = 'dashboard',
  Customers = 'customers',
  Products = 'products',
  Sales = 'sales',
  FutureOrders = 'future_orders', 
  Expenses = 'expenses',
  Invoices = 'invoices',
  Reports = 'reports',
  Settings = 'settings',
  About = 'about',
  AIAssistant = 'ai_assistant'
}