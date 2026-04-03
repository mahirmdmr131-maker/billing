import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Customer, Sale, NavigationTab, SaleItem, PaymentMethod, Settlement } from '../types';
import { IconAdd, IconPrint } from './Icons';

interface CustomersProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onNavigateToInvoices?: (sale: Sale) => void;
  initialCustomer?: Customer | null;
  onClearInitialCustomer?: () => void;
}

type SummaryPeriod = 'week' | 'month' | 'year';
type IndividualPrintMode = 'full' | 'sales_only' | 'pending_only' | 'summary' | 'settlements' | 'weekly' | 'date_range';
type PrintSize = 'A4' | 'Thermal80' | 'Thermal58';
type CustomerSortKey = 'name' | 'dues' | 'revenue' | 'date';
type SortDirection = 'asc' | 'desc';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    return new Date(dateStr).toLocaleDateString('en-GB');
  }
  return dateStr.split('-').reverse().join('/');
};

const summaryData = (sales: Sale[], period: SummaryPeriod) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);
  const currentYearStr = todayStr.substring(0, 4);
  
  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };
  const weekStartStr = getWeekStart();

  const validSales = sales.filter(s => !s.isMistake);
  let filtered: Sale[] = [];
  
  if (period === 'week') {
    filtered = validSales.filter(s => s.date >= weekStartStr);
  } else if (period === 'month') {
    filtered = validSales.filter(s => s.date.startsWith(currentMonthStr));
  } else {
    filtered = validSales.filter(s => s.date.startsWith(currentYearStr));
  }

  const total = filtered.reduce((sum, s) => sum + s.totalAmount, 0);
  return { total, count: filtered.length, items: filtered };
};

const Customers: React.FC<CustomersProps> = ({ data, updateData, onNavigateToInvoices, initialCustomer, onClearInitialCustomer }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  React.useEffect(() => {
    if (initialCustomer) {
      setViewCustomer(initialCustomer);
      if (onClearInitialCustomer) onClearInitialCustomer();
    }
  }, [initialCustomer, onClearInitialCustomer]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [settlementMethod, setSettlementMethod] = useState<PaymentMethod>('Cash');
  const [settlementHistoryDate, setSettlementHistoryDate] = useState('');
  
  // Sorting State
  const [sortKey, setSortKey] = useState<CustomerSortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Printing & Summary State
  const [showSummary, setShowSummary] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>('month');
  const [isPrintingGlobalSummary, setIsPrintingGlobalSummary] = useState(false);
  
  // Individual Print Config
  const [indivPrintMode, setIndivPrintMode] = useState<IndividualPrintMode>('full');
  const [indivIncludeDues, setIndivIncludeDues] = useState(true);
  const [printSize, setPrintSize] = useState<PrintSize>('A4');
  const [selectedSettlementDate, setSelectedSettlementDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: new Date().toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst: ''
  });

  const isAdmin = data.currentUser?.role === 'admin';

  const getCustomerRevenue = (customerId: string) => {
    return (data.sales || [])
      .filter((s: Sale) => s.customerId === customerId && !s.isMistake)
      .reduce((sum: number, s: Sale) => sum + s.totalAmount, 0);
  };

  const sortedAndFilteredCustomers = useMemo<Customer[]>(() => {
    const filteredList = (data.customers || []).filter((c: Customer) => {
      const searchLower = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(searchLower) || 
             c.phone.includes(searchTerm) ||
             (c.email && c.email.toLowerCase().includes(searchLower)) ||
             (c.address && c.address.toLowerCase().includes(searchLower)) ||
             (c.gst && c.gst.toLowerCase().includes(searchLower));
    });

    return [...filteredList].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'dues':
          comparison = (a.pendingBalance || 0) - (b.pendingBalance || 0);
          break;
        case 'revenue':
          comparison = getCustomerRevenue(a.id) - getCustomerRevenue(b.id);
          break;
        case 'date':
          comparison = (a.createdAt || '').localeCompare(b.createdAt || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data.customers, data.sales, searchTerm, sortKey, sortDirection]);

  const toggleSort = (key: CustomerSortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'name' || key === 'date' ? 'asc' : 'desc');
    }
  };

  const settlementGroups = useMemo((): Record<string, Sale[]> => {
    if (!viewCustomer) return {};
    const settledSales = (data.sales || []).filter(s => 
      s.customerId === viewCustomer.id && 
      !s.isMistake && 
      s.paidDate && 
      s.originalPaymentMethod === 'Pending'
    );
    
    const groups: Record<string, Sale[]> = {};
    settledSales.forEach(s => {
      const d = s.paidDate!;
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return groups;
  }, [data.sales, viewCustomer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const customerData = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      gst: formData.gst
    };

    if (editingCustomer) {
      updateData(prev => ({
        ...prev,
        customers: prev.customers.map(c => c.id === editingCustomer.id ? { ...c, ...customerData } : c)
      }));
    } else {
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        ...customerData,
        createdAt: new Date().toISOString(),
        pendingBalance: 0
      };
      updateData(prev => ({
        ...prev,
        customers: [newCustomer, ...prev.customers]
      }));
    }
    closeForm();
  };

  const handleUpdatePaymentMethod = (saleId: string, newMethod: PaymentMethod) => {
    updateData(prev => {
      const saleIndex = prev.sales.findIndex(s => s.id === saleId);
      if (saleIndex === -1) return prev;
      const oldSale = prev.sales[saleIndex];
      const oldMethod = oldSale.paymentMethod;
      if (oldMethod === newMethod) return prev;

      let updatedCustomers = [...prev.customers];
      if (oldSale.customerId) {
        if (oldMethod === 'Pending' && newMethod !== 'Pending') {
          updatedCustomers = updatedCustomers.map(c => c.id === oldSale.customerId ? { ...c, pendingBalance: Math.max(0, (c.pendingBalance || 0) - oldSale.totalAmount) } : c);
        } else if (oldMethod !== 'Pending' && newMethod === 'Pending') {
          updatedCustomers = updatedCustomers.map(c => c.id === oldSale.customerId ? { ...c, pendingBalance: (c.pendingBalance || 0) + oldSale.totalAmount } : c);
        }
      }
      const updatedSales = [...prev.sales];
      updatedSales[saleIndex] = { 
        ...oldSale, 
        paymentMethod: newMethod, 
        originalPaymentMethod: oldSale.originalPaymentMethod || (oldMethod === 'Pending' ? 'Pending' : undefined),
        paidDate: (oldMethod === 'Pending' && newMethod !== 'Pending') ? new Date().toISOString().split('T')[0] : oldSale.paidDate 
      };
      return { ...prev, sales: updatedSales, customers: updatedCustomers };
    });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewCustomer || !paymentAmount) return;
    
    const amountToClear = Number(paymentAmount);
    if (isNaN(amountToClear) || amountToClear <= 0) return;

    updateData(prev => {
      let remainingPayment = amountToClear;
      const updatedSales = [...prev.sales];
      
      const pendingSales = updatedSales
        .filter(s => s.customerId === viewCustomer.id && s.paymentMethod === 'Pending')
        .sort((a, b) => a.date.localeCompare(b.date)); // FIFO Orderly clearance

      for (let sale of pendingSales) {
        if (remainingPayment <= 0) break;
        if (remainingPayment >= sale.totalAmount) {
          remainingPayment -= sale.totalAmount;
          const saleIdx = updatedSales.findIndex(s => s.id === sale.id);
          if (saleIdx !== -1) {
            updatedSales[saleIdx] = { 
              ...updatedSales[saleIdx], 
              paymentMethod: settlementMethod, 
              originalPaymentMethod: 'Pending', // Mark as settled pending
              paidDate: paymentDate 
            };
          }
        } else {
          break;
        }
      }

      // Create Settlement Record
      const newSettlementRecord: Settlement = {
        id: crypto.randomUUID(),
        customerId: viewCustomer.id,
        customerName: viewCustomer.name,
        date: paymentDate,
        amount: amountToClear,
        status: 'Settled',
        paymentMethod: settlementMethod as PaymentMethod,
        notes: 'Direct Collection'
      };

      return {
        ...prev,
        sales: updatedSales,
        customers: prev.customers.map(c => 
          c.id === viewCustomer.id ? { ...c, pendingBalance: Math.max(0, c.pendingBalance - amountToClear) } : c
        ),
        settlements: [newSettlementRecord, ...(prev.settlements || [])]
      };
    });
    
    setViewCustomer(prev => prev ? { ...prev, pendingBalance: Math.max(0, prev.pendingBalance - amountToClear) } : null);
    setPaymentAmount('');
    alert('Payment settlement complete.');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '', gst: '' });
  };

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      gst: customer.gst || ''
    });
    setShowForm(true);
  };

  const deleteCustomer = (id: string) => {
    if (!confirm('Are you sure you want to move this customer to the recycle bin?')) return;
    updateData(prev => {
      const customer = prev.customers.find(c => c.id === id);
      if (!customer) return prev;
      return {
        ...prev,
        customers: prev.customers.filter(c => c.id !== id),
        recycleBin: {
          ...prev.recycleBin,
          customers: [...prev.recycleBin.customers, { ...customer, deletedAt: new Date().toISOString() }]
        }
      };
    });
  };

  useEffect(() => {
    if (viewCustomer) {
      const updatedCustomer = data.customers.find(c => c.id === viewCustomer.id);
      if (updatedCustomer) {
        setViewCustomer(updatedCustomer);
      }
    }
  }, [data.customers]);

  const customerSales = useMemo(() => {
    if (!viewCustomer) return [];
    let filtered = (data.sales || []).filter(s => s.customerId === viewCustomer.id && !s.isMistake);
    
    if (indivPrintMode === 'pending_only') {
      filtered = filtered.filter(s => s.paymentMethod === 'Pending');
    } else if (indivPrintMode === 'settlements' && selectedSettlementDate) {
      filtered = filtered.filter(s => s.paidDate === selectedSettlementDate && s.originalPaymentMethod === 'Pending');
    } else if (indivPrintMode === 'weekly') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      filtered = filtered.filter(s => s.date >= sevenDaysAgoStr);
    } else if (indivPrintMode === 'date_range') {
      if (dateRange.start && dateRange.end) {
        filtered = filtered.filter(s => s.date >= dateRange.start && s.date <= dateRange.end);
      }
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.sales, viewCustomer, indivPrintMode, selectedSettlementDate, dateRange]);

  const { openingBalance, ledgerEntries } = useMemo(() => {
    if (!viewCustomer || indivPrintMode !== 'date_range') return { openingBalance: 0, ledgerEntries: [] };

    const start = dateRange.start;
    const end = dateRange.end;
    const sales = (data.sales || []).filter(s => s.customerId === viewCustomer.id && !s.isMistake);

    // 1. Calculate Opening Balance (Dues before start date)
    const opening = sales.reduce((sum, s) => {
      if (s.date < start) {
        // If it was a credit sale (originally pending)
        if (s.originalPaymentMethod === 'Pending' || s.paymentMethod === 'Pending') {
           // It contributes to opening balance if it is STILL pending, 
           // OR if it was paid on or after the start date (meaning it was due at start date)
           if (s.paymentMethod === 'Pending' || (s.paidDate && s.paidDate >= start)) {
             return sum + s.totalAmount;
           }
        }
      }
      return sum;
    }, 0);

    // 2. Build Ledger Entries
    const entries: { date: string; type: 'INVOICE' | 'PAYMENT'; ref: string; debit: number; credit: number; original: Sale }[] = [];

    sales.forEach(s => {
      // A. Invoice Event (Bill generated)
      if (s.date >= start && s.date <= end) {
        entries.push({
          date: s.date,
          type: 'INVOICE',
          ref: s.invoiceNumber,
          debit: s.totalAmount,
          credit: 0,
          original: s
        });
      }

      // B. Payment Event (Payment received)
      if (s.paymentMethod !== 'Pending') {
        let paymentDate = s.date; // Default to immediate payment date
        let isPaymentEvent = true;

        // If it was a credit sale, use the actual paid date
        if (s.originalPaymentMethod === 'Pending') {
           if (s.paidDate) paymentDate = s.paidDate;
           else isPaymentEvent = false; // Should not happen for settled invoices, but safety check
        }

        // If payment happened within the range, record it
        if (isPaymentEvent && paymentDate >= start && paymentDate <= end) {
          entries.push({
            date: paymentDate,
            type: 'PAYMENT',
            ref: s.invoiceNumber,
            debit: 0,
            credit: s.totalAmount,
            original: s
          });
        }
      }
    });

    // Sort by date, then by type (Invoice before Payment if same day)
    entries.sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return a.type === 'INVOICE' ? -1 : 1;
    });

    // Calculate running balance
    let runningBalance = opening;
    const entriesWithBalance = entries.map(e => {
       if (e.type === 'INVOICE') runningBalance += e.debit;
       if (e.type === 'PAYMENT') runningBalance -= e.credit;
       return { ...e, balance: runningBalance };
    });

    return { openingBalance: opening, ledgerEntries: entriesWithBalance };
  }, [data.sales, data.settlements, viewCustomer, indivPrintMode, dateRange]);

  const handleQuickPrint = (customer: Customer, mode: IndividualPrintMode) => {
    setViewCustomer(customer);
    setIndivPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleSettlementPrint = (date: string) => {
    setSelectedSettlementDate(date);
    setIndivPrintMode('settlements');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleGlobalSummaryPrint = () => {
    setIsPrintingGlobalSummary(true);
    setTimeout(() => {
      window.print();
      setIsPrintingGlobalSummary(false);
    }, 500);
  };

  const globalCustomerSummary = useMemo<(Customer & { totalSalesRevenue: number })[]>(() => {
    return sortedAndFilteredCustomers.map(c => ({
      ...c,
      totalSalesRevenue: getCustomerRevenue(c.id)
    }));
  }, [sortedAndFilteredCustomers, data.sales]);

  const currentSummary = useMemo(() => summaryData(data.sales, summaryPeriod), [data.sales, summaryPeriod]);

  const SortButton: React.FC<{ label: string; keyName: CustomerSortKey }> = ({ label, keyName }) => (
    <button 
      onClick={() => toggleSort(keyName)}
      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 border shadow-sm ${
        sortKey === keyName 
          ? 'bg-indigo-600 text-white border-indigo-700' 
          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      <span>{label}</span>
      <span className={`transition-transform duration-200 ${sortKey === keyName && sortDirection === 'desc' ? 'rotate-180' : ''}`}>
        {sortKey === keyName ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg className="w-3 h-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
        )}
      </span>
    </button>
  );

  // Settlement Management State
  const [viewMode, setViewMode] = useState<'list' | 'settlements'>('list');
  const [settlementFilter, setSettlementFilter] = useState({ start: '', end: '' });
  const [settlementSearch, setSettlementSearch] = useState('');
  const [newSettlement, setNewSettlement] = useState({
    customerName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const filteredSettlements = useMemo(() => {
    let list = data.settlements || [];
    if (settlementSearch) {
      list = list.filter(s => s.customerName.toLowerCase().includes(settlementSearch.toLowerCase()));
    }
    if (settlementFilter.start) {
      list = list.filter(s => s.date >= settlementFilter.start);
    }
    if (settlementFilter.end) {
      list = list.filter(s => s.date <= settlementFilter.end);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.settlements, settlementSearch, settlementFilter]);

  const totalSettledAmount = useMemo(() => filteredSettlements.filter(s => s.status === 'Settled').reduce((sum, s) => sum + s.amount, 0), [filteredSettlements]);
  const totalUnsettledAmount = useMemo(() => filteredSettlements.filter(s => s.status === 'Unsettled').reduce((sum, s) => sum + s.amount, 0), [filteredSettlements]);

  const volumeAnalysis = useMemo(() => {
    if (!viewCustomer) return [];
    const sales = (data.sales || []).filter(s => s.customerId === viewCustomer.id && !s.isMistake);
    const totals: Record<string, number> = {};
    
    sales.forEach(sale => {
        sale.items.forEach(item => {
            let unit = (item.unit || 'Units').toLowerCase().trim();
            // Normalize common variations
            if (unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') unit = 'kg';
            if (unit === 'gm' || unit === 'gms' || unit === 'gram' || unit === 'grams') unit = 'g';
            if (unit === 'ltr' || unit === 'liter' || unit === 'liters') unit = 'l';
            if (unit === 'ml' || unit === 'milli') unit = 'ml';
            if (unit === 'pcs' || unit === 'pieces' || unit === 'nos') unit = 'pcs';

            totals[unit] = (totals[unit] || 0) + Number(item.quantity || 0);
        });
    });
    
    return Object.entries(totals)
        .filter(([_, qty]) => qty > 0)
        .sort((a, b) => b[1] - a[1]);
  }, [data.sales, viewCustomer]);

  const handleAddSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(newSettlement.amount);
    if (!amount || amount <= 0) return;

    const settlement: Settlement = {
      id: crypto.randomUUID(),
      customerId: 'manual',
      customerName: newSettlement.customerName,
      date: newSettlement.date,
      amount: amount,
      status: 'Unsettled' as 'Unsettled',
      notes: newSettlement.notes
    };

    // Try to link to existing customer
    const existingCustomer = data.customers.find(c => c.name.toLowerCase() === newSettlement.customerName.toLowerCase());
    if (existingCustomer) {
      settlement.customerId = existingCustomer.id;
    }

    updateData((prev: AppData): AppData => {
      const newSettlements: Settlement[] = [settlement, ...(prev.settlements || [])];
      return {
        ...prev,
        settlements: newSettlements
      };
    });

    setNewSettlement({ customerName: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '' });
    alert('Settlement record added.');
  };

  const markAsSettled = (settlement: any) => {
    if (!confirm(`Mark settlement of ₹${settlement.amount} as settled? This will reduce customer dues.`)) return;

    updateData(prev => {
      // 1. Update settlement status
      const updatedSettlements: Settlement[] = (prev.settlements || []).map(s => s.id === settlement.id ? { ...s, status: 'Settled' as const } : s);
      
      // 2. Update customer balance if linked
      let updatedCustomers = [...prev.customers];
      let updatedSales = [...prev.sales];

      if (settlement.customerId !== 'manual') {
        const customer = updatedCustomers.find(c => c.id === settlement.customerId);
        if (customer) {
           // Reduce pending balance
           updatedCustomers = updatedCustomers.map(c => c.id === customer.id ? { ...c, pendingBalance: Math.max(0, c.pendingBalance - settlement.amount) } : c);
           
           // Apply to pending invoices FIFO (reuse logic)
           let remainingPayment = settlement.amount;
           const pendingSales = updatedSales
             .filter(s => s.customerId === customer.id && s.paymentMethod === 'Pending')
             .sort((a, b) => a.date.localeCompare(b.date));

           for (let sale of pendingSales) {
             if (remainingPayment <= 0) break;
             if (remainingPayment >= sale.totalAmount) {
               remainingPayment -= sale.totalAmount;
               const saleIdx = updatedSales.findIndex(s => s.id === sale.id);
               if (saleIdx !== -1) {
                 updatedSales[saleIdx] = { 
                   ...updatedSales[saleIdx], 
                   paymentMethod: 'Cash Settled', // Assume Cash Settled for settlement
                   originalPaymentMethod: 'Pending', 
                   paidDate: settlement.date 
                 };
               }
             }
           }
        }
      }

      return {
        ...prev,
        settlements: updatedSettlements,
        customers: updatedCustomers,
        sales: updatedSales
      };
    });
  };

  const deleteSettlement = (settlement: Settlement) => {
    if (!confirm('Are you sure you want to delete this settlement record?')) return;
    updateData(prev => {
      let updatedCustomers = [...prev.customers];
      if (settlement.status === 'Settled' && settlement.customerId !== 'manual') {
        updatedCustomers = updatedCustomers.map(c => c.id === settlement.customerId ? { ...c, pendingBalance: c.pendingBalance + settlement.amount } : c);
      }
      return {
        ...prev,
        settlements: (prev.settlements || []).filter(s => s.id !== settlement.id),
        customers: updatedCustomers
      };
    });
  };

  if (viewMode === 'settlements') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Settlement Manager</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Settled:</span>
               <span className="text-sm font-black text-emerald-700">₹{totalSettledAmount.toLocaleString()}</span>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl">
               <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pending:</span>
               <span className="text-sm font-black text-amber-700">₹{totalUnsettledAmount.toLocaleString()}</span>
             </div>
             <input type="date" value={settlementFilter.start} onChange={e => setSettlementFilter({...settlementFilter, start: e.target.value})} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
             <span className="text-slate-400 font-bold text-xs">to</span>
             <input type="date" value={settlementFilter.end} onChange={e => setSettlementFilter({...settlementFilter, end: e.target.value})} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
             <div className="relative">
                <input type="text" placeholder="Search Customer..." value={settlementSearch} onChange={e => setSettlementSearch(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none w-48" />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Settlement Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-6">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Record New Settlement</h3>
               <form onSubmit={handleAddSettlement} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer Name</label>
                    <input type="text" required list="customer-names" value={newSettlement.customerName} onChange={e => setNewSettlement({...newSettlement, customerName: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-bold text-sm" placeholder="Enter name..." />
                    <datalist id="customer-names">
                      {data.customers.map(c => <option key={c.id} value={c.name} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                    <input type="date" required value={newSettlement.date} onChange={e => setNewSettlement({...newSettlement, date: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-bold text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount (₹)</label>
                    <input type="number" required value={newSettlement.amount} onChange={e => setNewSettlement({...newSettlement, amount: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-black text-lg text-indigo-600" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</label>
                    <textarea value={newSettlement.notes} onChange={e => setNewSettlement({...newSettlement, notes: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-medium text-sm h-20 resize-none" placeholder="Optional details..." />
                  </div>
                  <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">Save Record</button>
               </form>
            </div>
          </div>

          {/* Settlement List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <tr>
                     <th className="px-6 py-4">Date</th>
                     <th className="px-6 py-4">Customer</th>
                     <th className="px-6 py-4 text-right">Amount</th>
                     <th className="px-6 py-4 text-center">Status</th>
                     <th className="px-6 py-4 text-center">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {filteredSettlements.map((s: any) => (
                     <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 font-bold text-slate-500 text-xs">{formatDate(s.date)}</td>
                       <td className="px-6 py-4">
                         <p className="font-black text-slate-800 text-sm uppercase">{s.customerName}</p>
                         {s.notes && <p className="text-[10px] text-slate-400 italic truncate max-w-[150px]">{s.notes}</p>}
                       </td>
                       <td className="px-6 py-4 text-right font-black text-slate-800">₹{s.amount.toLocaleString()}</td>
                       <td className="px-6 py-4 text-center">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.status === 'Settled' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                           {s.status}
                         </span>
                       </td>
                       <td className="px-6 py-4 text-center">
                         {s.status === 'Unsettled' && (
                           <button onClick={() => markAsSettled(s)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors">
                             Mark Settled
                           </button>
                         )}
                       </td>
                     </tr>
                   ))}
                   {filteredSettlements.length === 0 && (
                     <tr><td colSpan={5} className="py-12 text-center text-slate-300 font-bold uppercase text-xs italic">No records found</td></tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewCustomer) {
    const isThermal = printSize === 'Thermal80' || printSize === 'Thermal58';
    const isThermal58 = printSize === 'Thermal58';

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <button onClick={() => { setViewCustomer(null); setIndivPrintMode('full'); setSelectedSettlementDate(null); }} className="text-indigo-600 font-bold flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span>Back to List</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(['full', 'pending_only', 'weekly', 'date_range', 'summary', 'settlements'] as IndividualPrintMode[]).map(m => (
                <button 
                  key={m}
                  onClick={() => setIndivPrintMode(m)} 
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${indivPrintMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >{m.replace('_', ' ')}</button>
              ))}
            </div>

            {indivPrintMode === 'date_range' && (
              <div className="flex items-center gap-2 p-1 rounded-xl border bg-slate-100 border-slate-200 animate-in fade-in duration-200">
                <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="px-3 py-1 text-[10px] font-bold rounded-lg border-slate-200 outline-none" />
                <span className="text-slate-400 text-xs font-bold">to</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="px-3 py-1 text-[10px] font-bold rounded-lg border-slate-200 outline-none" />
              </div>
            )}

            <select 
              value={printSize} 
              onChange={(e) => setPrintSize(e.target.value as PrintSize)}
              className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border bg-white border-slate-200 text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="A4">A4 Size</option>
              <option value="Thermal80">80mm Thermal</option>
              <option value="Thermal58">58mm Thermal</option>
            </select>

            <button 
              onClick={() => window.print()}
              className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition-all active:scale-95 shadow-lg"
            >
              <IconPrint />
              <span>Print View</span>
            </button>
          </div>
        </div>
        
        <div className={`print-area-wrapper transition-all duration-300 ${isThermal58 ? 'max-w-[280px]' : printSize === 'Thermal80' ? 'max-w-[360px]' : 'max-w-full'} mx-auto`}>
          <div className={`bg-white shadow-sm rounded-3xl p-0 overflow-hidden border border-slate-100 print:border-none print:shadow-none print:rounded-none`}>
            <div className={`bg-indigo-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between gap-6 relative overflow-hidden print:bg-white print:text-black print:shadow-none print:border-b-2 print:border-black print:rounded-none ${isThermal ? 'print:p-2' : ''}`}>
              <div className="hidden print:block text-center w-full mb-6">
                 {data.business?.logo && <img src={data.business.logo} alt="Logo" className={`${isThermal ? 'w-24' : 'w-32'} mx-auto mb-2 object-contain`} />}
                 <h1 className={`${isThermal ? 'text-lg' : 'text-2xl'} font-black uppercase`}>{data.business?.name}</h1>
                 <p className="text-[10px] opacity-70 italic">{data.business?.tagline}</p>
                 <p className="text-[10px] font-bold mt-2">{data.business?.address} | Ph: {data.business?.phone}</p>
                 <h2 className={`${isThermal ? 'text-sm' : 'text-lg'} font-black mt-4 border-y border-black py-1 uppercase tracking-widest`}>
                  {indivPrintMode === 'pending_only' ? 'Statement of Pending Dues' : 
                   indivPrintMode === 'settlements' ? `Settlement Report - ${formatDate(selectedSettlementDate || '')}` : 
                   indivPrintMode === 'summary' ? 'Account Overview' : 
                   indivPrintMode === 'weekly' ? 'Weekly Statement (Last 7 Days)' : 
                   indivPrintMode === 'date_range' ? `Statement for ${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}` : 'Client Ledger Report'}
                 </h2>
              </div>

              <div className="relative z-10 print:w-full print:text-left">
                <p className="hidden print:block text-[8px] font-black uppercase opacity-50">Customer Account</p>
                <h2 className={`${isThermal ? 'text-xl' : 'text-3xl'} font-black mb-2 uppercase`}>{viewCustomer.name}</h2>
                <div className="flex flex-wrap gap-4 text-sm font-medium opacity-80 print:text-[10px] print:opacity-100">
                  <span>📞 {viewCustomer.phone}</span>
                  {viewCustomer.gst && <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase print:border print:border-black print:text-black font-bold font-mono">GST: {viewCustomer.gst}</span>}
                </div>
              </div>
              
              {(indivIncludeDues || !window.matchMedia('print').matches) && (
                <div className={`text-right relative z-10 flex flex-col justify-center print:w-full print:text-center print:mt-4 ${!indivIncludeDues ? 'print:hidden' : ''}`}>
                  <div className="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm print:bg-slate-50 print:border-black print:text-black">
                      <p className="text-[10px] uppercase font-black opacity-50 tracking-[0.2em] mb-1 print:opacity-100">Current Outstanding</p>
                      <p className={`${isThermal ? 'text-3xl' : 'text-5xl'} font-black ${viewCustomer.pendingBalance > 0 ? 'text-red-400 print:text-black' : 'text-emerald-400 print:text-black'}`}>₹{viewCustomer.pendingBalance.toLocaleString()}</p>
                      <p className="hidden print:block text-[8px] font-bold mt-2">Print Date: {new Date().toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`grid grid-cols-1 ${isThermal ? '' : 'lg:grid-cols-3'} gap-8 mt-8 p-8 pt-0 print:p-2`}>
                <div className={`lg:col-span-1 space-y-6 no-print`}>
                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-sm">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-200 pb-4">Record Collection</h4>
                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Collection Date</label>
                                <input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-bold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Mode</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                    {(['Cash', 'Cash Settled', 'UPI'] as PaymentMethod[]).map(m => (
                                        <button 
                                            key={m}
                                            type="button"
                                            onClick={() => setSettlementMethod(m)}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${settlementMethod === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Collected Amount (₹)</label>
                                <input type="number" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-black text-lg" placeholder="0.00" />
                            </div>
                            <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">Process Orderly Settlement</button>
                        </form>
                    </div>

                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm overflow-hidden mb-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Volume Sold</h4>
                        <div className="grid grid-cols-2 gap-3">
                           {volumeAnalysis.map(([unit, qty]) => (
                             <div key={unit} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                                <span className="text-lg font-black text-slate-800">{qty.toLocaleString()}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{unit}</span>
                             </div>
                           ))}
                           {volumeAnalysis.length === 0 && <p className="col-span-2 text-center text-slate-300 text-[10px] font-bold italic py-4">No volume data</p>}
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement History</h4>
                           <input type="date" value={settlementHistoryDate} onChange={e => setSettlementHistoryDate(e.target.value)} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none" />
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                           {(Object.entries(settlementGroups) as [string, Sale[]][])
                             .filter(([date]) => !settlementHistoryDate || date === settlementHistoryDate)
                             .sort(([a], [b]) => b.localeCompare(a)).map(([date, sales]) => {
                             const total = sales.reduce((sum, s) => sum + s.totalAmount, 0);
                             return (
                               <div key={date} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                                  <div className="flex justify-between items-center mb-1">
                                     <p className="text-[10px] font-black text-slate-800 uppercase">{formatDate(date)}</p>
                                     <button onClick={() => handleSettlementPrint(date)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><IconPrint className="w-3 h-3"/></button>
                                  </div>
                                  <p className="text-sm font-black text-indigo-600">₹{total.toLocaleString()}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">{sales.length} Bills Cleared</p>
                               </div>
                             );
                           })}
                           {Object.keys(settlementGroups).length === 0 && <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">No settlements recorded</p>}
                           {Object.keys(settlementGroups).length > 0 && Object.keys(settlementGroups).filter(date => !settlementHistoryDate || date === settlementHistoryDate).length === 0 && <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">No settlements on this date</p>}
                        </div>
                    </div>
                </div>

                <div className={`${isThermal ? 'w-full' : 'lg:col-span-2'} bg-white rounded-3xl border border-slate-100 overflow-hidden print:border-none print:shadow-none print:w-full print:block`}>
                    {indivPrintMode !== 'summary' ? (
                      <>
                        <div className="px-8 py-4 bg-slate-50 border-b flex justify-between items-center print:bg-white print:border-black print:px-2">
                            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest print:text-[10px]">
                              {indivPrintMode === 'pending_only' ? 'Unpaid Invoice Registry' : 
                               indivPrintMode === 'settlements' ? `Bills Settled on ${formatDate(selectedSettlementDate || '')}` : 'Ledger Entries'}
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm print:text-[10px] border-collapse">
                            {indivPrintMode === 'date_range' ? (
                              <>
                                <thead className="bg-slate-50/50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black print:border-black">
                                  <tr>
                                    <th className="px-8 py-4 print:px-2">Date</th>
                                    <th className="px-8 py-4 print:px-2">Description</th>
                                    <th className="px-8 py-4 text-right print:px-2">Debit</th>
                                    <th className="px-8 py-4 text-right print:px-2">Credit</th>
                                    <th className="px-8 py-4 text-right print:px-2">Balance</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 print:divide-black">
                                  <tr className="bg-slate-50 print:bg-white font-bold">
                                    <td className="px-8 py-4 print:px-2 text-slate-500 print:text-black" colSpan={4}>OPENING BALANCE</td>
                                    <td className="px-8 py-4 text-right print:px-2 font-black">₹{openingBalance.toLocaleString()}</td>
                                  </tr>
                                  {ledgerEntries.map((e, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-8 py-4 font-bold text-slate-600 print:text-black print:px-2">{formatDate(e.date)}</td>
                                      <td className="px-8 py-4 font-black tracking-tighter print:text-black print:px-2">
                                        {e.type === 'INVOICE' ? (
                                          <span className="text-indigo-600 print:text-black">INV #{e.ref.split('-')[1]}</span>
                                        ) : (
                                          <span className="text-emerald-600 print:text-black">PAYMENT RECEIVED</span>
                                        )}
                                      </td>
                                      <td className="px-8 py-4 text-right font-black text-slate-800 print:text-black print:px-2">{e.debit > 0 ? `₹${e.debit.toLocaleString()}` : '-'}</td>
                                      <td className="px-8 py-4 text-right font-black text-slate-800 print:text-black print:px-2">{e.credit > 0 ? `₹${e.credit.toLocaleString()}` : '-'}</td>
                                      <td className="px-8 py-4 text-right font-black text-slate-800 print:text-black print:px-2">₹{e.balance.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                  {ledgerEntries.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest italic">No transactions in this period</td>
                                    </tr>
                                  )}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-900 text-white print:bg-white print:text-black print:border-t-2 print:border-black">
                                    <td colSpan={4} className="px-8 py-4 font-black uppercase text-right tracking-widest print:px-2 print:text-[12px]">Closing Balance</td>
                                    <td className="px-8 py-4 text-right font-black text-xl print:px-2 print:text-[14px]">
                                      ₹{(ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balance : openingBalance).toLocaleString()}
                                    </td>
                                  </tr>
                                </tfoot>
                              </>
                            ) : (
                              <>
                                <thead className="bg-slate-50/50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black print:border-black">
                                    <tr>
                                    <th className="px-8 py-4 print:px-2">Date</th>
                                    <th className="px-8 py-4 print:px-2">Invoice</th>
                                    {!isThermal && <th className="px-8 py-4 print:px-2">Status</th>}
                                    <th className="px-8 py-4 text-right print:px-2">Amount</th>
                                    <th className="px-8 py-4 text-center no-print">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 print:divide-black">
                                    {customerSales.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-8 py-4 font-bold text-slate-600 print:text-black print:px-2">
                                          {formatDate(s.date)}
                                        </td>
                                        <td className="px-8 py-4 font-black text-indigo-600 tracking-tighter print:text-black print:px-2">#{s.invoiceNumber.split('-')[1]}</td>
                                        {!isThermal && (
                                          <td className="px-8 py-4">
                                              <select
                                                  value={s.paymentMethod}
                                                  onChange={(e) => handleUpdatePaymentMethod(s.id, e.target.value as PaymentMethod)}
                                                  className={`text-[10px] font-black uppercase px-2 py-1 rounded border cursor-pointer ${
                                                      s.paymentMethod === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                  } print:border-none`}
                                              >
                                                  <option value="Cash">Cash</option>
                                                  <option value="UPI">UPI</option>
                                                  <option value="Pending">Pending</option>
                                              </select>
                                          </td>
                                        )}
                                        <td className="px-8 py-4 text-right font-black text-slate-800 print:text-black print:px-2">₹{s.totalAmount.toLocaleString()}</td>
                                        <td className="px-8 py-4 text-center no-print">
                                          <button onClick={() => onNavigateToInvoices && onNavigateToInvoices(s)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                            <IconPrint className="w-4 h-4" />
                                          </button>
                                        </td>
                                    </tr>
                                    ))}
                                    {customerSales.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest italic">No matching records</td>
                                      </tr>
                                    )}
                                </tbody>
                                {(indivIncludeDues || indivPrintMode === 'settlements') && (
                                  <tfoot>
                                    <tr className="bg-slate-900 text-white print:bg-white print:text-black print:border-t-2 print:border-black">
                                      <td colSpan={isThermal ? 2 : 3} className="px-8 py-4 font-black uppercase text-right tracking-widest print:px-2 print:text-[12px]">
                                        {indivPrintMode === 'settlements' ? 'Total Settlement Value' : 'Net Account Dues'}
                                      </td>
                                      <td className="px-8 py-4 text-right font-black text-xl print:px-2 print:text-[14px]">
                                        ₹{(indivPrintMode === 'settlements' ? customerSales.reduce((sum, s) => sum + s.totalAmount, 0) : viewCustomer.pendingBalance).toLocaleString()}
                                      </td>
                                      <td className="no-print"></td>
                                    </tr>
                                  </tfoot>
                                )}
                              </>
                            )}
                            </table>
                        </div>
                        <div className="hidden print:flex justify-between items-end mt-16 px-4">
                           <div className="text-center">
                              <div className="w-32 border-t-2 border-black mb-1"></div>
                              <p className="text-[8px] font-black uppercase">Client Sign</p>
                           </div>
                           <div className="text-center">
                              <div className="w-32 border-t-2 border-black mb-1"></div>
                              <p className="text-[8px] font-black uppercase">Authorized Cashier</p>
                           </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 print:p-4 space-y-6">
                        <div className="border-b-2 border-slate-100 pb-4">
                           <h4 className="font-black text-slate-800 uppercase text-lg tracking-widest">Client Business Summary</h4>
                           <p className="text-xs text-slate-400 font-bold uppercase mt-1">Snapshot of lifetime interaction</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Transactions</p>
                              <p className="text-2xl font-black text-slate-800">{customerSales.length}</p>
                           </div>
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Billing</p>
                              <p className="text-2xl font-black text-indigo-600">₹{customerSales.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}</p>
                           </div>
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unpaid Count</p>
                              <p className="text-2xl font-black text-rose-600">{customerSales.filter(s => s.paymentMethod === 'Pending').length}</p>
                           </div>
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Interaction</p>
                              <p className="text-lg font-black text-slate-800">{customerSales[0] ? formatDate(customerSales[0].date) : 'Never'}</p>
                           </div>
                           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 col-span-2">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Volume Breakdown</p>
                               <div className="flex flex-wrap gap-4">
                                  {volumeAnalysis.map(([unit, qty]) => (
                                    <div key={unit} className="flex items-baseline gap-1">
                                       <span className="text-xl font-black text-slate-800">{qty.toLocaleString()}</span>
                                       <span className="text-xs font-bold text-slate-500 uppercase">{unit}</span>
                                    </div>
                                  ))}
                                  {volumeAnalysis.length === 0 && <span className="text-sm font-bold text-slate-400 italic">No data available</span>}
                               </div>
                           </div>
                        </div>
                      </div>
                    )}
                </div>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            .print-area-wrapper, .print-area-wrapper * { visibility: visible !important; }
            .print-area-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
            @page { margin: 0; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm no-print">
         <div className="flex flex-col md:flex-row items-center gap-4 flex-1">
            <div className="relative w-full md:w-64">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" placeholder="Search records..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-2xl border border-slate-100 overflow-x-auto max-w-full">
               <span className="text-[9px] font-black text-slate-400 uppercase ml-2 mr-1 shrink-0">Sort:</span>
               <SortButton label="Name" keyName="name" />
               <SortButton label="Dues" keyName="dues" />
               <SortButton label="Revenue" keyName="revenue" />
               <SortButton label="Joined" keyName="date" />
            </div>
         </div>
         <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSummary(!showSummary)} 
              className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showSummary ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
               <span>Report View</span>
            </button>
            <button 
              onClick={handleGlobalSummaryPrint} 
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all"
            >
              Print List
            </button>
            <button 
              onClick={() => setViewMode('settlements')} 
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all"
            >
              Settlements
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">
              <IconAdd /><span>Enroll Client</span>
            </button>
         </div>
      </div>

      {/* Global Sales Insight Bar */}
      {showSummary && (
        <div className="bg-indigo-900 text-white p-8 rounded-[40px] shadow-2xl border border-indigo-800 animate-in slide-in-from-top-4 duration-300 relative overflow-hidden no-print">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-[100px] opacity-20 -mr-32 -mt-32"></div>
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                 <p className="text-indigo-300 font-black uppercase text-[10px] tracking-[0.4em] mb-2">Aggregate Revenue Report</p>
                 <div className="flex items-baseline space-x-4">
                    <h3 className="text-5xl font-black tracking-tighter">₹{currentSummary.total.toLocaleString()}</h3>
                    <span className="text-indigo-300 font-bold uppercase text-xs">{currentSummary.count} Transactions</span>
                 </div>
              </div>
              <div className="flex flex-col items-end gap-4">
                  <div className="flex bg-indigo-950/40 p-1.5 rounded-2xl border border-white/10">
                    {(['week', 'month', 'year'] as SummaryPeriod[]).map(p => (
                      <button 
                        key={p} 
                        onClick={() => setSummaryPeriod(p)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${summaryPeriod === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-300 hover:text-white'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Grid of Customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
        {sortedAndFilteredCustomers.map(customer => {
          const revenue = getCustomerRevenue(customer.id);
          return (
            <div key={customer.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all group relative">
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-2xl border border-indigo-100">{customer.name.charAt(0)}</div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleQuickPrint(customer, 'weekly')} className="p-2 text-indigo-500 hover:text-indigo-700 bg-indigo-50 rounded-xl" title="Print Weekly Statement">
                    <IconPrint className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleQuickPrint(customer, 'pending_only')} className="p-2 text-rose-500 hover:text-rose-700 bg-rose-50 rounded-xl" title="Print Dues Statement">
                    <IconPrint className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleQuickPrint(customer, 'full')} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-xl" title="Print Full Ledger">
                    <IconPrint className="w-5 h-5" />
                  </button>
                  <button onClick={() => startEdit(customer)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl" title="Edit Profile">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteCustomer(customer.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl" title="Remove Client">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-1 truncate uppercase tracking-tight">{customer.name}</h4>
              <p className="text-sm text-slate-500 mb-2 font-bold flex items-center gap-1">📞 {customer.phone}</p>
              
              <div className="flex justify-between items-center mb-6">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Volume: <span className="text-indigo-600 font-black">₹{revenue.toLocaleString()}</span></p>
                <p className="text-[8px] text-slate-300 font-bold uppercase">Since {formatDate(customer.createdAt)}</p>
              </div>
              
              <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-0.5">Dues Amount</p>
                  <p className={`text-xl font-black ${customer.pendingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{customer.pendingBalance?.toLocaleString() || 0}</p>
                </div>
                <button onClick={() => setViewCustomer(customer)} className="px-5 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-600 transition-all shadow-md">Open Ledger</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Summary Print View (Total Sales Summary) */}
      {isPrintingGlobalSummary && (
        <div className="print-only hidden print:block bg-white text-black p-10" style={{ fontFamily: 'sans-serif' }}>
           <div className="text-center mb-10 border-b-2 border-black pb-8">
              {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-32 mx-auto mb-4 object-contain" />}
              <h1 className="text-4xl font-black uppercase">{data.business?.name}</h1>
              <h2 className="text-xl font-bold uppercase tracking-[0.2em] mt-2">Customer Sales & Dues Summary</h2>
              <p className="text-[10px] mt-2 font-bold italic">Generated on: {new Date().toLocaleString('en-GB')}</p>
           </div>

           <table className="w-full border-collapse">
              <thead>
                  <tr className="bg-gray-100 border-y-2 border-black">
                      <th className="p-3 text-left text-[10px] uppercase font-black">Customer Name</th>
                      <th className="p-3 text-left text-[10px] uppercase font-black">Phone</th>
                      <th className="p-3 text-right text-[10px] uppercase font-black">Total Sales (Life)</th>
                      <th className="p-3 text-right text-[10px] uppercase font-black">Pending Dues</th>
                  </tr>
              </thead>
              <tbody>
                  {globalCustomerSummary.map((c, i) => (
                      <tr key={i} className="border-b border-gray-300">
                          <td className="p-3 text-xs font-bold uppercase">{c.name}</td>
                          <td className="p-3 text-xs">{c.phone}</td>
                          <td className="p-3 text-xs text-right font-black">₹{c.totalSalesRevenue.toLocaleString()}</td>
                          <td className="p-3 text-xs text-right font-black">₹{c.pendingBalance.toLocaleString()}</td>
                      </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-black font-black">
                   <td colSpan={2} className="p-3 text-right uppercase text-[10px]">Grand Consolidated Totals</td>
                   <td className="p-3 text-right text-sm">₹{globalCustomerSummary.reduce((sum, c) => sum + (c.totalSalesRevenue || 0), 0).toLocaleString()}</td>
                   <td className="p-3 text-right text-sm">₹{globalCustomerSummary.reduce((sum, c) => sum + (c.pendingBalance || 0), 0).toLocaleString()}</td>
                </tr>
              </tfoot>
           </table>

           <div className="mt-24 pt-10 border-t border-black flex justify-between px-10">
              <div className="text-center">
                 <div className="w-40 border-b border-black mb-2"></div>
                 <p className="text-[10px] font-black uppercase tracking-widest">Accounts Verification</p>
              </div>
              <div className="text-center">
                 <div className="w-40 border-b border-black mb-2"></div>
                 <p className="text-[10px] font-black uppercase tracking-widest">Authorized Signature</p>
              </div>
           </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 px-8 py-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">{editingCustomer ? 'Modify Profile' : 'New Customer'}</h3>
                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mt-1">Registry Entry</p>
              </div>
              <button onClick={closeForm} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name *</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" placeholder="e.g. ARUN FOODS" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone *</label>
                  <input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">GSTIN</label>
                  <input type="text" value={formData.gst} onChange={e => setFormData({ ...formData, gst: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase font-mono" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</label>
                  <textarea rows={2} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={closeForm} className="flex-1 px-6 py-4 border border-slate-200 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 px-6 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:bg-indigo-700">Save Identity</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;