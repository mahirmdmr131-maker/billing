
import React, { useState, useMemo } from 'react';
import { AppData, Sale, SaleItem, Customer, Product, PaymentMethod } from '../types';
import { IconAdd, IconPrint } from './Icons';

interface SalesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onNavigateToInvoices: () => void;
}

type SortKey = 'date' | 'customerName' | 'totalAmount';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'Active' | 'Mistakes';
type PriceTier = 'Retail' | 'Wholesale';
type PrintSize = 'A4' | 'Thermal80' | 'Thermal58';

const Sales: React.FC<SalesProps> = ({ data, updateData, onNavigateToInvoices }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [lastSavedSale, setLastSavedSale] = useState<Sale | null>(null);
  const [includePreviousBalance, setIncludePreviousBalance] = useState(false);
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState(0);
  const [isLargeLogo, setIsLargeLogo] = useState(false);
  const [printSize, setPrintSize] = useState<PrintSize>('A4');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('Active');
  
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    category: 'General',
    paymentMethod: 'Cash' as PaymentMethod,
    selectedUpiQrId: '',
    cashPaid: '',
    tier: 'Retail' as PriceTier,
    items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0, batchNumber: '', expiryDate: '', showAdvanced: false }] as (Partial<SaleItem> & { showAdvanced: boolean })[]
  });

  const isAdmin = data.currentUser?.role === 'admin';
  const UNITS = ['kg', 'gram', 'no.', 'pkt', 'box', 'ltr', 'ml', 'bag', 'tin'];

  const currentTotal = formData.items.reduce((sum, i) => 
    sum + calculateItemTotal(Number(i.quantity || 0), Number(i.rate || 0), i.unit || 'kg'), 0
  );

  const cashPaidVal = Number(formData.cashPaid) || 0;
  const balanceToReturn = Math.max(0, cashPaidVal - currentTotal);

  function calculateItemTotal(qty: number, rate: number, unit: string) {
    const q = Number(qty) || 0;
    const r = Number(rate) || 0;
    if (unit === 'gram' || unit === 'ml') {
      return (q / 1000) * r;
    }
    return q * r;
  }

  const resetForm = () => {
    setFormData({
      customerId: '',
      customerName: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      category: 'General',
      paymentMethod: 'Cash',
      selectedUpiQrId: '',
      cashPaid: '',
      tier: 'Retail',
      items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0, batchNumber: '', expiryDate: '', showAdvanced: false }]
    });
    setIncludePreviousBalance(false);
    setSelectedCustomerBalance(0);
  };

  const handleAddItem = () => setFormData(prev => ({ 
    ...prev, 
    items: [...prev.items, { productName: '', quantity: 1, unit: 'kg', rate: 0, batchNumber: '', expiryDate: '', showAdvanced: false }] 
  }));
  
  const handleRemoveItem = (index: number) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    if (field === 'productName' && typeof value === 'string' && value.includes('__PID:')) {
      const prodId = value.split('__PID:')[1];
      const prod = data.products.find(p => p.id === prodId);
      if (prod) {
        newItems[index] = { 
          ...newItems[index], 
          productName: prod.name, 
          unit: prod.unit,
          rate: formData.tier === 'Wholesale' ? (prod.wholesaleRate || prod.defaultRate) : prod.defaultRate
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const changeTier = (tier: PriceTier) => {
    const updatedItems = formData.items.map(item => {
      if (!item.productName) return item;
      const prod = data.products.find(p => p.name.toLowerCase() === item.productName?.toLowerCase());
      if (prod) {
        return {
          ...item,
          rate: tier === 'Wholesale' ? (prod.wholesaleRate || prod.defaultRate) : prod.defaultRate
        };
      }
      return item;
    });
    setFormData(prev => ({ ...prev, tier, items: updatedItems }));
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customer = data.customers.find(c => c.id === e.target.value);
    if (customer) {
      setFormData(prev => ({ ...prev, customerId: customer.id, customerName: customer.name }));
      setSelectedCustomerBalance(customer.pendingBalance || 0);
    } else {
      setFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
      setSelectedCustomerBalance(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalItems: SaleItem[] = formData.items.map(item => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const unit = item.unit || 'kg';
      const total = calculateItemTotal(qty, rate, unit);
      
      return {
        id: crypto.randomUUID(),
        productName: item.productName || 'General Item',
        quantity: qty,
        unit: unit,
        rate: rate,
        total: total,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate
      };
    });
    
    const currentSaleAmount = finalItems.reduce((sum, i) => sum + i.total, 0);
    let finalPaymentMethod = formData.paymentMethod;
    if (Number(formData.cashPaid) === 0 && finalPaymentMethod === 'Cash') {
      finalPaymentMethod = 'Pending';
    }

    const newSale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber: `INV-${String(data.sales.length + data.recycleBin.sales.length + 1).padStart(5, '0')}`,
      date: formData.date,
      dueDate: finalPaymentMethod === 'Pending' ? formData.dueDate : undefined,
      customerId: formData.customerId || undefined,
      customerName: formData.customerName || 'Walk-in Customer',
      items: finalItems,
      totalAmount: currentSaleAmount,
      category: formData.category,
      isMistake: false,
      createdBy: data.currentUser?.id || 'System',
      paymentMethod: finalPaymentMethod,
      selectedUpiQrId: formData.paymentMethod === 'UPI' ? formData.selectedUpiQrId : undefined,
      includePreviousBalance: includePreviousBalance
    };

    updateData(prev => {
      const newProductsList = [...prev.products];
      finalItems.forEach(item => {
        const productIndex = newProductsList.findIndex(p => p.name.toLowerCase() === item.productName.toLowerCase());
        if (productIndex !== -1) {
          if (newProductsList[productIndex].currentStock !== undefined) {
            newProductsList[productIndex] = {
              ...newProductsList[productIndex],
              currentStock: Math.max(0, (newProductsList[productIndex].currentStock || 0) - item.quantity)
            };
          }
        }
      });

      let updatedCustomers = [...prev.customers];
      if (finalPaymentMethod === 'Pending' && formData.customerId) {
        updatedCustomers = updatedCustomers.map(c => 
          c.id === formData.customerId ? { ...c, pendingBalance: (c.pendingBalance || 0) + currentSaleAmount } : c
        );
      }

      return {
        ...prev,
        sales: [newSale, ...prev.sales],
        products: newProductsList,
        customers: updatedCustomers
      };
    });

    setLastSavedSale(newSale);
    setShowAddForm(false);
  };

  const flagAsMistake = (saleId: string) => {
    if (!confirm('Flag this bill as a mistake? This will revert inventory and customer balance changes.')) return;

    updateData(prev => {
      const sale = prev.sales.find(s => s.id === saleId);
      if (!sale) return prev;

      const updatedProducts = prev.products.map(p => {
        const saleItem = sale.items.find(si => si.productName.toLowerCase() === p.name.toLowerCase());
        if (saleItem && p.currentStock !== undefined) {
          return { ...p, currentStock: p.currentStock + saleItem.quantity };
        }
        return p;
      });

      const updatedCustomers = prev.customers.map(c => {
        if (sale.customerId === c.id && sale.paymentMethod === 'Pending') {
          return { ...c, pendingBalance: Math.max(0, (c.pendingBalance || 0) - sale.totalAmount) };
        }
        return c;
      });

      const updatedSales = prev.sales.map(s => s.id === saleId ? { ...s, isMistake: true } : s);

      return {
        ...prev,
        sales: updatedSales,
        products: updatedProducts,
        customers: updatedCustomers
      };
    });
  };

  // Improved Sorting Logic
  const sortedSales = useMemo(() => {
    const filtered = data.sales.filter(s => viewMode === 'Active' ? !s.isMistake : s.isMistake);
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'date': 
          comparison = a.date.localeCompare(b.date); 
          break;
        case 'customerName': 
          comparison = a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }); 
          break;
        case 'totalAmount': 
          comparison = a.totalAmount - b.totalAmount; 
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data.sales, sortKey, sortDirection, viewMode]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleModalClose = () => {
    setLastSavedSale(null);
    resetForm();
    setShowAddForm(true); 
  };

  const handleModalPrint = () => {
    window.print();
  };

  const selectedQr = data.upiQrs?.find(q => q.id === formData.selectedUpiQrId);

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <svg className="w-3 h-3 ml-1 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    return sortDirection === 'asc' ? 
      <svg className="w-3 h-3 ml-1 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg> : 
      <svg className="w-3 h-3 ml-1 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>;
  };

  const SortButton = ({ label, field }: { label: string, field: SortKey }) => (
    <button 
      onClick={() => toggleSort(field)}
      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 border shadow-sm ${
        sortKey === field 
          ? 'bg-indigo-600 text-white border-indigo-700' 
          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      <span>{label}</span>
      <span className={`transition-transform duration-200 ${sortKey === field && sortDirection === 'desc' ? 'rotate-180' : ''}`}>
        {sortKey === field ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg className="w-3 h-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
        )}
      </span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Rapid Billing</h3>
        <div className="flex items-center space-x-2">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner mr-2">
             {(['Active', 'Mistakes'] as ViewMode[]).map(m => (
               <button 
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {m === 'Active' ? 'Live Queue' : 'Flagged Logs'}
               </button>
             ))}
          </div>
          <button onClick={() => { resetForm(); setShowAddForm(true); }} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95">
            <IconAdd /><span>Start New Bill</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-300">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 pb-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Profile</label>
                  <select className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium" value={formData.customerId} onChange={handleCustomerChange}>
                    <option value="">Walk-in Customer</option>
                    {data.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                  </select>
                  {!formData.customerId && (
                    <input type="text" className="w-full mt-3 px-4 py-3 border border-slate-200 rounded-xl outline-none font-medium" placeholder="Customer Name..." value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} />
                  )}
                </div>
                {formData.customerId && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-amber-600 uppercase">Existing Pending</p>
                      <p className="text-lg font-black text-amber-800">₹{selectedCustomerBalance.toLocaleString()}</p>
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={includePreviousBalance} onChange={e => setIncludePreviousBalance(e.target.checked)} />
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Show Dues</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Billing Date</label>
                  <input type="date" required className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Price Tier</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    {(['Retail', 'Wholesale'] as PriceTier[]).map(t => (
                      <button 
                        key={t}
                        type="button"
                        onClick={() => changeTier(t)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.tier === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Itemized Billing</h4>
                <button type="button" onClick={handleAddItem} className="text-indigo-600 font-bold text-xs hover:underline tracking-tight">+ New Line Item</button>
              </div>
              
              {formData.items.map((item, index) => {
                const rowTotal = calculateItemTotal(Number(item.quantity || 0), Number(item.rate || 0), item.unit || 'kg');

                return (
                  <div key={index} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative group transition-all hover:bg-white hover:shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Item Selection</label>
                        <select className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white mb-2" onChange={e => updateItem(index, 'productName', e.target.value)} value="">
                          <option value="">Catalog...</option>
                          {data.products.map(p => <option key={p.id} value={`__PID:${p.id}`}>{p.name}</option>)}
                        </select>
                        <input type="text" placeholder="Product name..." required className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium text-sm" value={item.productName} onChange={e => updateItem(index, 'productName', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</label>
                        <select className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium text-sm" value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)}>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Qty</label>
                        <input type="number" step="any" required className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium text-sm" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rate (₹)</label>
                        <input type="number" step="any" required className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium text-sm" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} />
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between gap-2">
                        <div className="text-right flex-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Subtotal</p>
                          <p className="font-black text-slate-800 text-sm whitespace-nowrap">₹{rowTotal.toLocaleString()}</p>
                        </div>
                        <button type="button" onClick={() => updateItem(index, 'showAdvanced', !item.showAdvanced)} className={`p-2 rounded-lg transition-all ${item.showAdvanced ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-400'}`} title="Safety Fields">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A3.323 3.323 0 0010.605 7.09a3.323 3.323 0 00-4.016 4.016 3.323 3.323 0 001.037 4.016 3.323 3.323 0 004.016 1.037 3.323 3.323 0 004.016-1.037 3.323 3.323 0 001.037-4.016z" /></svg>
                        </button>
                        <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-slate-300 hover:text-red-500">✕</button>
                      </div>
                    </div>
                    
                    {item.showAdvanced && (
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2 duration-300">
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch Number (Safety)</label>
                          <input type="text" placeholder="e.g. B-012" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold uppercase" value={item.batchNumber} onChange={e => updateItem(index, 'batchNumber', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiry Date</label>
                          <input type="date" className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold" value={item.expiryDate} onChange={e => updateItem(index, 'expiryDate', e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center py-4">
              <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-xl inline-block">
                <p className="text-[10px] uppercase font-black opacity-50 tracking-widest mb-1">Net Bill Amount</p>
                <p className="text-4xl font-black">₹{currentTotal.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tier: <span className="text-indigo-600">{formData.tier}</span></p>
                <p className="text-[10px] font-black text-slate-400 uppercase italic">* Standard taxes applicable *</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Pending'] as PaymentMethod[]).map(mode => (
                    <button key={mode} type="button" onClick={() => setFormData({ ...formData, paymentMethod: mode })} className={`py-3 rounded-xl text-xs font-bold transition-all border ${formData.paymentMethod === mode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>{mode}</button>
                  ))}
                </div>
                {formData.paymentMethod === 'UPI' && (
                  <select 
                    className="w-full mt-3 px-3 py-2 border border-slate-200 rounded-lg outline-none bg-emerald-50 text-xs font-bold"
                    value={formData.selectedUpiQrId}
                    onChange={e => setFormData({...formData, selectedUpiQrId: e.target.value})}
                  >
                    <option value="">Select QR Profile...</option>
                    {data.upiQrs?.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cash Received (₹)</label>
                 <input 
                  type="number" 
                  className="w-full px-4 py-3 border-2 border-indigo-100 rounded-xl outline-none bg-indigo-50/30 font-black text-indigo-600 placeholder-indigo-300 focus:border-indigo-500" 
                  placeholder="0.00" 
                  value={formData.cashPaid} 
                  onChange={e => setFormData({ ...formData, cashPaid: e.target.value })} 
                 />
                 {cashPaidVal > 0 && (
                   <p className="mt-2 text-[10px] font-black uppercase text-emerald-600 text-right">Return: ₹{balanceToReturn.toLocaleString()}</p>
                 )}
              </div>
            </div>

            {formData.paymentMethod === 'UPI' && selectedQr && (
              <div className="flex flex-col items-center p-6 bg-emerald-50 rounded-[40px] border border-emerald-100 animate-in fade-in zoom-in duration-500">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em] mb-4">Customer Scan Area: {selectedQr.name}</p>
                  <img src={selectedQr.imageData} alt="Scan to pay" className="w-48 h-48 object-contain bg-white p-4 rounded-3xl shadow-xl border-4 border-emerald-200" />
                  <p className="mt-4 text-sm font-black text-emerald-800">COLLECT: ₹{currentTotal.toLocaleString()}</p>
              </div>
            )}

            <div className="flex justify-end items-center pt-8 border-t border-slate-100 gap-4">
              <button type="button" onClick={() => { setShowAddForm(false); resetForm(); }} className="px-8 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors uppercase text-xs tracking-widest">Discard</button>
              <button type="submit" className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest">Generate Bill</button>
            </div>
          </form>
        </div>
      )}

      {/* Sales List Controls & Sort Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-2xl border border-slate-100 overflow-x-auto max-w-full">
           <span className="text-[9px] font-black text-slate-400 uppercase ml-2 mr-1 shrink-0">Sort:</span>
           <SortButton label="Date" field="date" />
           <SortButton label="Customer" field="customerName" />
           <SortButton label="Amount" field="totalAmount" />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">
          Showing {sortedSales.length} Entries
        </p>
      </div>

      <div className={`bg-white rounded-[40px] shadow-sm border overflow-hidden transition-all ${viewMode === 'Mistakes' ? 'border-rose-100 shadow-rose-50' : 'border-slate-100'}`}>
        <div className={`p-8 border-b flex justify-between items-center ${viewMode === 'Mistakes' ? 'bg-rose-50/30 border-rose-100' : 'border-slate-50'}`}>
           <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] ${viewMode === 'Mistakes' ? 'text-rose-400' : 'text-slate-400'}`}>
             {viewMode === 'Active' ? 'Session Sales Queue' : 'Mistaken Entry Logs'}
           </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className={`text-[10px] font-black uppercase tracking-[0.2em] ${viewMode === 'Mistakes' ? 'bg-rose-50/50 text-rose-300' : 'bg-slate-50 text-slate-400'}`}>
              <tr>
                <th className="px-8 py-5 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => toggleSort('date')}>
                  <div className="flex items-center"><span>Date</span><SortIcon field="date" /></div>
                </th>
                <th className="px-8 py-5 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => toggleSort('customerName')}>
                  <div className="flex items-center"><span>Customer</span><SortIcon field="customerName" /></div>
                </th>
                <th className="px-8 py-5">Items & Safety Detail</th>
                <th className="px-8 py-5 text-right cursor-pointer hover:opacity-70 transition-opacity" onClick={() => toggleSort('totalAmount')}>
                  <div className="flex items-center justify-end"><span>Amount</span><SortIcon field="totalAmount" /></div>
                </th>
                <th className="px-8 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSales.slice(0, 50).map((sale) => (
                <tr key={sale.id} className={`hover:bg-slate-50/50 transition-colors ${sale.isMistake ? 'opacity-70' : ''}`}>
                  <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(sale.date).toLocaleDateString()}</td>
                  <td className="px-8 py-5 text-sm font-black text-slate-800">
                    <p className="uppercase">{sale.customerName}</p>
                    <p className="text-[9px] text-slate-400 font-bold tracking-widest">{sale.invoiceNumber}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-wrap gap-1">
                      {sale.items.map((it, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-white border-slate-200 text-slate-500">
                          {it.productName}
                          {it.batchNumber && <span className="ml-1 text-indigo-500">[{it.batchNumber}]</span>}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`px-8 py-5 text-sm font-black text-right ${viewMode === 'Mistakes' ? 'text-rose-400 line-through' : 'text-indigo-600'}`}>
                    ₹{sale.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-center">
                    {viewMode === 'Active' && (isAdmin || sale.createdBy === data.currentUser?.id) && (
                      <button onClick={() => flagAsMistake(sale.id)} className="p-2 text-rose-300 hover:text-rose-600 bg-rose-50 rounded-xl transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {lastSavedSale && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden p-10 text-center animate-in zoom-in-95 duration-200 no-print">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-emerald-50">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Invoice Saved!</h3>
            <p className="text-slate-500 font-medium mb-6 text-xs">Invoice <b>{lastSavedSale.invoiceNumber}</b> processed.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Print Size</label>
                <select 
                  value={printSize} 
                  onChange={(e) => setPrintSize(e.target.value as PrintSize)}
                  className="w-full p-3 bg-slate-50 rounded-2xl outline-none font-bold text-sm border border-slate-100"
                >
                  <option value="A4">A4 Standard</option>
                  <option value="Thermal80">80mm Thermal</option>
                  <option value="Thermal58">58mm Mobile</option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center space-x-3 h-[46px]">
                  <input 
                    type="checkbox" 
                    id="modal-large-logo" 
                    checked={isLargeLogo} 
                    onChange={(e) => setIsLargeLogo(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="modal-large-logo" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Large Logo</label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={handleModalPrint}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-3 uppercase text-xs tracking-widest"
              >
                <IconPrint className="w-5 h-5" />
                <span>Print Invoice</span>
              </button>
              <button 
                onClick={handleModalClose}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                Next New Bill
              </button>
            </div>
          </div>
          
          <div className={`print-only hidden print:block bg-white text-black p-4 transition-all duration-300 mx-auto ${printSize === 'Thermal58' ? 'max-w-[240px] text-[10px]' : printSize === 'Thermal80' ? 'max-w-[320px] text-xs' : 'max-w-full text-sm'}`} style={{ fontFamily: printSize === 'A4' ? 'sans-serif' : 'monospace', width: '100%', minHeight: '100vh' }}>
             <div className="p-4 border-2 border-black">
                <div className="text-center mb-6 pb-4 border-b-2 border-black">
                  {data.business?.logo && (
                    <img src={data.business.logo} alt="Logo" className={`${isLargeLogo ? 'w-48' : 'w-24'} mx-auto mb-4 object-contain`} />
                  )}
                  <h1 className={`${printSize !== 'A4' ? 'text-lg' : 'text-2xl'} font-bold uppercase`}>{data.business?.name}</h1>
                  <p className="text-sm font-bold">{data.business?.tagline}</p>
                  <p className="text-xs">{data.business?.address}</p>
                  <p className="text-xs">Ph: {data.business?.phone}</p>
                  {data.business?.gst && <p className="text-xs font-bold">GSTIN: {data.business.gst}</p>}
                </div>
                <div className="flex justify-between mb-4 text-[10px] font-bold uppercase">
                  <div>Customer: {lastSavedSale.customerName}</div>
                  <div className="text-right">Inv: #{lastSavedSale.invoiceNumber.split('-')[1]}<br/>Date: {lastSavedSale.date}</div>
                </div>
                <table className="w-full text-[10px] text-left mb-6 border-collapse">
                  <thead className="border-y-2 border-black">
                    <tr>
                      <th className="py-2">Item Detail</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-center">Rate</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="border-b-2 border-black">
                    {lastSavedSale.items.map((it, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 font-bold uppercase">
                          {it.productName}
                          {(it.batchNumber || it.expiryDate) && (
                            <div className="text-[8px] font-medium opacity-70">
                              {it.batchNumber && `B: ${it.batchNumber}`} {it.expiryDate && `| E: ${it.expiryDate}`}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-center">{it.quantity}{it.unit}</td>
                        <td className="py-2 text-center">₹{it.rate}</td>
                        <td className="py-2 text-right font-bold">₹{it.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right space-y-1">
                   <p className="text-[10px] uppercase font-bold text-gray-600">Net Payable</p>
                   <p className={`${printSize !== 'A4' ? 'text-xl' : 'text-2xl'} font-black`}>₹{lastSavedSale.totalAmount.toLocaleString()}</p>
                   <p className="text-[10px] font-bold uppercase">Mode: {lastSavedSale.paymentMethod}</p>
                </div>
                <div className="mt-12 text-center text-[10px] font-bold italic border-t border-black pt-4">
                  * Food Quality Verified - A M Food Processing *
                </div>
             </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          .print-only, .print-only * { visibility: visible !important; }
          .print-only { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            box-shadow: none !important; 
            display: block !important;
          }
          @page { margin: 0; }
        }
      `}} />
    </div>
  );
};

export default Sales;
