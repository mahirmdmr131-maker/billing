export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  phone?: string; // Registered mobile number for OTP
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

export type ProductType = 'FinishedGood' | 'RawMaterial';

export interface InventoryBatch {
  batchNumber: string;
  quantity: number;
  manufacturingDate?: string;
  expiryDate?: string;
  warehouseId?: string;
}

export interface Product {
  id: string;
  name: string;
  code?: string; // SKU
  productType?: ProductType;
  defaultRate: number;
  wholesaleRate?: number; 
  unit: string;
  currentStock?: number; 
  minThreshold?: number; 
  priceHistory?: PriceHistoryEntry[]; 
  batches?: InventoryBatch[];
  hsnCode?: string;
  gstPercent?: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gst?: string;
  createdAt: string;
  pendingBalance: number;
}

export interface PurchaseItem {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
}

export interface Purchase {
  id: string;
  invoiceNumber: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  supplierContact?: string;
  items: PurchaseItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  createdBy: string;
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
  gstPercent?: number;
  taxAmount?: number;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Pending' | 'Cash Settled';

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string; 
  paidDate?: string; 
  customerId?: string;
  customerName: string;
  customerContact?: string; // New: Contact number for pending transactions
  items: SaleItem[];
  subTotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  category: string;
  createdBy: string;
  isMistake?: boolean;
  paymentMethod: PaymentMethod;
  isPaid?: boolean; // New: Status flag for pending/credit
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

export type AttendanceStatus = 'Present' | 'Absent' | 'Half-Day' | 'Leave';

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string; 
  checkOut?: string;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  baseSalary: number;
  bonus: number;
  deductions: number;
  netPay: number;
  paidAt?: string;
  status: 'Pending' | 'Paid';
}

export interface Settlement {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  status: 'Settled' | 'Unsettled';
  paymentMethod?: 'Cash' | 'UPI' | 'Cheque' | 'Other';
  notes?: string;
}

export interface ProductionRecord {
  id: string;
  recipeId: string;
  date: string;
  quantityProduced: number;
  costPerUnit: number;
  status: 'Planned' | 'In Progress' | 'Completed';
  notes?: string;
}

export interface RecipeItem {
  productId: string;
  productName: string;
  quantityRequired: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  outputProductId: string;
  outputQuantity: number;
  ingredients: RecipeItem[];
  estimatedCost?: number;
}

export interface AppData {
  business: BusinessInfo | null;
  users: User[];
  attendance?: AttendanceRecord[];
  payroll?: PayrollRecord[];
  recipes?: Recipe[];
  productionRecords?: ProductionRecord[];
  currentUser: User | null;
  adminRecoveryCode?: string; 
  customers: Customer[];
  suppliers?: Supplier[];
  products: Product[]; 
  purchases?: Purchase[];
  upiQrs: UpiQr[]; 
  sales: Sale[];
  futureOrders: FutureOrder[]; 
  expenses: Expense[];
  settlements: Settlement[]; // New: Settlement Management
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
  Suppliers = 'suppliers',
  Products = 'products',
  Inventory = 'inventory',
  Purchases = 'purchases',
  Sales = 'sales',
  FutureOrders = 'future_orders', 
  Expenses = 'expenses',
  Invoices = 'invoices',
  Reports = 'reports',
  Employees = 'employees',
  Manufacturing = 'manufacturing',
  Settings = 'settings',
  About = 'about',
  AIAssistant = 'ai_assistant'
}