import { Permission, UserRole, Role, User, AuditLogEntry } from '../types';

export interface PermissionCategory {
  category: string;
  label: string;
  permissions: { key: Permission; label: string; description: string }[];
}

export const ALL_PERMISSIONS_BY_CATEGORY: PermissionCategory[] = [
  {
    category: 'Dashboard',
    label: 'Dashboard & Analytics',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard', description: 'Access main executive dashboard and summary widgets' },
    ],
  },
  {
    category: 'Products',
    label: 'Product Management',
    permissions: [
      { key: 'products.view', label: 'View Products', description: 'View list of products and prices' },
      { key: 'products.add', label: 'Add Product', description: 'Create new products' },
      { key: 'products.edit', label: 'Edit Product', description: 'Modify existing product details' },
      { key: 'products.delete', label: 'Delete Product', description: 'Remove products from catalog' },
      { key: 'products.import', label: 'Import Products', description: 'Bulk import products via CSV/Excel' },
      { key: 'products.export', label: 'Export Products', description: 'Export catalog data' },
    ],
  },
  {
    category: 'Inventory',
    label: 'Inventory & Stock Control',
    permissions: [
      { key: 'inventory.view', label: 'View Inventory', description: 'View stock levels and warehouse data' },
      { key: 'inventory.add', label: 'Add Stock', description: 'Add inventory batches' },
      { key: 'inventory.edit', label: 'Edit Inventory', description: 'Modify batch and stock information' },
      { key: 'inventory.delete', label: 'Delete Stock', description: 'Remove inventory items' },
      { key: 'inventory.stock_adjustment', label: 'Stock Adjustment', description: 'Perform manual stock count adjustments' },
      { key: 'inventory.stock_transfer', label: 'Stock Transfer', description: 'Transfer stock between locations' },
      { key: 'inventory.view_cost_price', label: 'View Cost Price', description: 'Access purchase cost and valuation' },
    ],
  },
  {
    category: 'Sales',
    label: 'Sales & Billing',
    permissions: [
      { key: 'sales.view', label: 'View Sales', description: 'Access billing history and sales records' },
      { key: 'sales.create', label: 'Create Invoice', description: 'Generate new sales bills and receipts' },
      { key: 'sales.edit', label: 'Edit Invoice', description: 'Update existing invoices' },
      { key: 'sales.cancel', label: 'Cancel Invoice', description: 'Cancel billed invoices' },
      { key: 'sales.delete', label: 'Delete Invoice', description: 'Permanently remove sales records' },
      { key: 'sales.print', label: 'Print Invoice', description: 'Print bill receipts' },
      { key: 'sales.share', label: 'Share Invoice', description: 'Share invoice via WhatsApp/Email' },
      { key: 'sales.apply_discount', label: 'Apply Discount', description: 'Apply custom discounts to bills' },
      { key: 'sales.view_profit', label: 'View Profit', description: 'See profit margin per sale' },
    ],
  },
  {
    category: 'Customers',
    label: 'Customer Relations',
    permissions: [
      { key: 'customers.view', label: 'View Customers', description: 'View customer directory and balance' },
      { key: 'customers.add', label: 'Add Customer', description: 'Register new customers' },
      { key: 'customers.edit', label: 'Edit Customer', description: 'Update customer details and credit limits' },
      { key: 'customers.delete', label: 'Delete Customer', description: 'Delete customer profiles' },
    ],
  },
  {
    category: 'Suppliers',
    label: 'Supplier Management',
    permissions: [
      { key: 'suppliers.view', label: 'View Suppliers', description: 'View vendor list and ledger' },
      { key: 'suppliers.add', label: 'Add Supplier', description: 'Add new vendors' },
      { key: 'suppliers.edit', label: 'Edit Supplier', description: 'Update vendor details' },
      { key: 'suppliers.delete', label: 'Delete Supplier', description: 'Remove vendor profiles' },
    ],
  },
  {
    category: 'Purchases',
    label: 'Purchases & Procurement',
    permissions: [
      { key: 'purchases.view', label: 'View Purchases', description: 'Access purchase orders and bills' },
      { key: 'purchases.create', label: 'Create Purchase', description: 'Record new purchase invoices' },
      { key: 'purchases.edit', label: 'Edit Purchase', description: 'Update purchase entries' },
      { key: 'purchases.delete', label: 'Delete Purchase', description: 'Remove purchase records' },
    ],
  },
  {
    category: 'Manufacturing',
    label: 'Manufacturing & Processing',
    permissions: [
      { key: 'manufacturing.view', label: 'View Batches & Recipes', description: 'View production runs and BOM' },
      { key: 'manufacturing.create_batch', label: 'Create Batch', description: 'Start new production batches' },
      { key: 'manufacturing.edit_batch', label: 'Edit Batch', description: 'Update production status' },
      { key: 'manufacturing.delete_batch', label: 'Delete Batch', description: 'Remove production batches' },
      { key: 'manufacturing.view_cost', label: 'View Manufacturing Cost', description: 'Access detailed batch costing' },
    ],
  },
  {
    category: 'Expenses',
    label: 'Expense Tracking',
    permissions: [
      { key: 'expenses.view', label: 'View Expenses', description: 'View business expenses' },
      { key: 'expenses.add', label: 'Add Expense', description: 'Record new operational expenses' },
      { key: 'expenses.edit', label: 'Edit Expense', description: 'Modify expense records' },
      { key: 'expenses.delete', label: 'Delete Expense', description: 'Remove expense entries' },
    ],
  },
  {
    category: 'Reports',
    label: 'Reports & Analytics',
    permissions: [
      { key: 'reports.view_sales', label: 'Sales Reports', description: 'Access sales and revenue reports' },
      { key: 'reports.view_purchase', label: 'Purchase Reports', description: 'Access procurement reports' },
      { key: 'reports.view_inventory', label: 'Inventory Reports', description: 'Access stock valuation and movement reports' },
      { key: 'reports.view_profit', label: 'Profit & Loss Reports', description: 'Access margin and P&L statements' },
      { key: 'reports.export', label: 'Export Reports', description: 'Export report data to PDF/Excel' },
    ],
  },
  {
    category: 'Employees',
    label: 'Employee Management',
    permissions: [
      { key: 'employees.view', label: 'View Employees', description: 'View staff directory' },
      { key: 'employees.add', label: 'Add Employee', description: 'Register new employee accounts' },
      { key: 'employees.edit', label: 'Edit Employee', description: 'Update employee profiles' },
      { key: 'employees.delete', label: 'Delete Employee', description: 'Remove employee records' },
    ],
  },
  {
    category: 'Access Control',
    label: 'Role & Access Control',
    permissions: [
      { key: 'access_control.view', label: 'View Access Control', description: 'View role matrix and permission screens' },
      { key: 'access_control.manage_roles', label: 'Manage Roles', description: 'Create, edit, copy and delete custom roles' },
      { key: 'access_control.manage_users', label: 'Manage User Permissions', description: 'Assign roles, reset passwords, lock/disable user accounts' },
    ],
  },
  {
    category: 'Audit Logs',
    label: 'Audit & Compliance',
    permissions: [
      { key: 'audit.view', label: 'View Audit Logs', description: 'Access detailed system activity logs' },
    ],
  },
  {
    category: 'Settings',
    label: 'System Settings',
    permissions: [
      { key: 'settings.view', label: 'View Settings', description: 'View business configurations' },
      { key: 'settings.modify', label: 'Modify Settings', description: 'Change business settings, invoice templates, UPI QR codes' },
    ],
  },
  {
    category: 'AI Assistant',
    label: 'AI Analyst',
    permissions: [
      { key: 'ai.allow', label: 'Allow AI Analyst', description: 'Access Gemini AI business analyst' },
    ],
  },
  {
    category: 'Backup & Cloud',
    label: 'Backup, Sync & Devices',
    permissions: [
      { key: 'backup.create', label: 'Create Backup', description: 'Generate data backups' },
      { key: 'backup.restore', label: 'Restore Backup', description: 'Restore system snapshot' },
      { key: 'printer.print', label: 'Thermal Printing', description: 'Print receipts' },
      { key: 'printer.configure', label: 'Configure Printer', description: 'Setup printer settings' },
      { key: 'cloud.enable', label: 'Cloud Drive Sync', description: 'Connect cloud storage' },
      { key: 'cloud.disable', label: 'Disconnect Cloud Sync', description: 'Disconnect cloud backups' },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = ALL_PERMISSIONS_BY_CATEGORY.flatMap(c => c.permissions.map(p => p.key));

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  admin: ALL_PERMISSIONS.filter(p => p !== 'access_control.manage_roles'), // Admin has almost all except super-admin restrictions
  manager: [
    'dashboard.view',
    'products.view', 'products.add', 'products.edit', 'products.delete', 'products.import', 'products.export',
    'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.delete', 'inventory.stock_adjustment', 'inventory.stock_transfer', 'inventory.view_cost_price',
    'sales.view', 'sales.create', 'sales.edit', 'sales.cancel', 'sales.print', 'sales.share', 'sales.apply_discount', 'sales.view_profit',
    'customers.view', 'customers.add', 'customers.edit',
    'suppliers.view', 'suppliers.add', 'suppliers.edit',
    'purchases.view', 'purchases.create', 'purchases.edit',
    'manufacturing.view', 'manufacturing.create_batch', 'manufacturing.edit_batch', 'manufacturing.view_cost',
    'expenses.view', 'expenses.add', 'expenses.edit',
    'reports.view_sales', 'reports.view_purchase', 'reports.view_inventory', 'reports.view_profit', 'reports.export',
    'employees.view',
    'settings.view',
    'ai.allow',
    'backup.create',
    'printer.print',
  ],
  sales_executive: [
    'dashboard.view',
    'products.view',
    'sales.view', 'sales.create', 'sales.edit', 'sales.print', 'sales.share', 'sales.apply_discount',
    'customers.view', 'customers.add', 'customers.edit',
    'reports.view_sales',
    'printer.print',
  ],
  cashier: [
    'dashboard.view',
    'products.view',
    'sales.view', 'sales.create', 'sales.print', 'sales.share',
    'customers.view', 'customers.add',
    'printer.print',
  ],
  store_keeper: [
    'dashboard.view',
    'products.view',
    'inventory.view', 'inventory.add', 'inventory.edit', 'inventory.stock_adjustment', 'inventory.stock_transfer',
    'suppliers.view',
    'purchases.view', 'purchases.create',
    'reports.view_inventory',
  ],
  production_manager: [
    'dashboard.view',
    'products.view',
    'inventory.view',
    'manufacturing.view', 'manufacturing.create_batch', 'manufacturing.edit_batch', 'manufacturing.view_cost',
    'reports.view_inventory',
  ],
  delivery_staff: [
    'sales.view', 'sales.print',
    'customers.view',
  ],
  accountant: [
    'dashboard.view',
    'sales.view', 'sales.view_profit',
    'purchases.view',
    'expenses.view', 'expenses.add', 'expenses.edit', 'expenses.delete',
    'customers.view', 'suppliers.view',
    'reports.view_sales', 'reports.view_purchase', 'reports.view_profit', 'reports.export',
  ],
  employee: [
    'dashboard.view',
    'products.view',
    'sales.view', 'sales.create', 'sales.print',
  ],
  custom: [],
};

export const DEFAULT_SYSTEM_ROLES: Role[] = [
  { id: 'super_admin', name: 'Super Admin', description: 'Full system ownership, user promotion, & role control', permissions: [...ALL_PERMISSIONS], isSystem: true },
  { id: 'admin', name: 'Admin', description: 'Operational administration & staff management', permissions: DEFAULT_ROLE_PERMISSIONS.admin, isSystem: true },
  { id: 'manager', name: 'Manager', description: 'Department manager with broad operational privileges', permissions: DEFAULT_ROLE_PERMISSIONS.manager, isSystem: true },
  { id: 'sales_executive', name: 'Sales Executive', description: 'Sales, billing, customer management, & discounts', permissions: DEFAULT_ROLE_PERMISSIONS.sales_executive, isSystem: true },
  { id: 'cashier', name: 'Cashier', description: 'POS counters, rapid sales billing, & printing', permissions: DEFAULT_ROLE_PERMISSIONS.cashier, isSystem: true },
  { id: 'store_keeper', name: 'Store Keeper', description: 'Stock, inventory batches, transfers, & receiving', permissions: DEFAULT_ROLE_PERMISSIONS.store_keeper, isSystem: true },
  { id: 'production_manager', name: 'Production Manager', description: 'Manufacturing batches, recipes, & raw materials', permissions: DEFAULT_ROLE_PERMISSIONS.production_manager, isSystem: true },
  { id: 'delivery_staff', name: 'Delivery Staff', description: 'Order viewing and dispatch confirmation', permissions: DEFAULT_ROLE_PERMISSIONS.delivery_staff, isSystem: true },
  { id: 'accountant', name: 'Accountant', description: 'Financial reports, expenses, profit analysis, & ledgers', permissions: DEFAULT_ROLE_PERMISSIONS.accountant, isSystem: true },
  { id: 'employee', name: 'Employee', description: 'Standard base staff permissions', permissions: DEFAULT_ROLE_PERMISSIONS.employee, isSystem: true },
];

// In-memory cache for fast permission checks
const permissionCache = new Map<string, Permission[]>();

export function getPermissionsForUser(user: User | null, customRoles: Role[] = []): Permission[] {
  if (!user) return [];
  if (user.role === 'super_admin') return ALL_PERMISSIONS;

  const cacheKey = `${user.id}_${user.role}_${user.customRoleId || ''}_${user.createdAt || ''}`;
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey)!;
  }

  let permissions: Permission[] = [];
  if (user.role === 'custom' && user.customRoleId) {
    const customRole = customRoles.find(r => r.id === user.customRoleId);
    permissions = customRole ? customRole.permissions : [];
  } else {
    permissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  }

  permissionCache.set(cacheKey, permissions);
  return permissions;
}

export function clearPermissionCache() {
  permissionCache.clear();
}

export function hasPermission(user: User | null, customRoles: Role[] = [], permission: Permission): boolean {
  if (!user) return false;
  if (!user.isActive || user.isLocked) return false;
  if (user.role === 'super_admin') return true;

  const userPermissions = getPermissionsForUser(user, customRoles);
  return userPermissions.includes(permission);
}

export function hasModuleAccess(user: User | null, customRoles: Role[] = [], modulePrefix: string): boolean {
  if (!user) return false;
  if (!user.isActive || user.isLocked) return false;
  if (user.role === 'super_admin') return true;

  const userPermissions = getPermissionsForUser(user, customRoles);
  return userPermissions.some(p => p.startsWith(`${modulePrefix}.`));
}

export function createAuditLog(
  user: User | null,
  action: string,
  category: AuditLogEntry['category'],
  details: string
): AuditLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    userId: user?.id || 'system',
    username: user?.username || 'System',
    userRole: user?.role || 'system',
    action,
    category,
    details,
    ipAddress: '127.0.0.1 (Local Session)',
    deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser Client',
  };
}
