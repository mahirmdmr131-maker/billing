import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppData, Sale, SaleItem, PaymentMethod, Customer, Product } from '../types';
import { IconAdd, IconPrint } from './Icons';
import { printElement, printViaBluetoothThermal, shareOrSaveInvoice } from '../utils/printer';
import { PrinterModal } from './PrinterModal';

interface SalesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onNavigateToInvoices: () => void;
  preSelectedCustomerId?: string | null;
  onClearPreSelect?: () => void;
  initialSaleToDuplicate?: Sale | null;
  onClearDuplicate?: () => void;
}

type PrintSize = 'A4' | 'Thermal80' | 'Thermal58';
type PriceTier = 'Retail' | 'Wholesale';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.split('-').reverse().join('/');
};

const applyTemplate = (text: string, sale: Sale) => {
  if (!text) return '';
  return text
    .replace(/{{inv_number}}/g, sale.invoiceNumber)
    .replace(/{{cust_name}}/g, sale.customerName)
    .replace(/{{total_due}}/g, `₹${sale.totalAmount.toLocaleString()}`)
    .replace(/{{date}}/g, formatDate(sale.date));
};

const Sales: React.FC<SalesProps> = ({ data, updateData, onNavigateToInvoices, preSelectedCustomerId, onClearPreSelect, initialSaleToDuplicate, onClearDuplicate }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [lastSavedSale, setLastSavedSale] = useState<Sale | null>(null);
  const [printSize, setPrintSize] = useState<PrintSize>('Thermal80');
  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  
  const customerInputRef = useRef<HTMLInputElement>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [isCustomerForced, setIsCustomerForced] = useState(false);
  const [customerLazyLimit, setCustomerLazyLimit] = useState(50);

  const [activeProductIdx, setActiveProductIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [isProductForced, setIsProductForced] = useState(false);
  const [productLazyLimit, setProductLazyLimit] = useState(50);

  const [historyDateRange, setHistoryDateRange] = useState({ start: '', end: '' });
  const [historyStatus, setHistoryStatus] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [historySortKey, setHistorySortKey] = useState<'date' | 'invoiceNumber' | 'customerName' | 'totalAmount'>('date');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('desc');

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerContact: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentMethod: 'Cash' as PaymentMethod,
    cashPaid: '',
    tier: 'Retail' as PriceTier,
    items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }] as Partial<SaleItem>[]
  });

  useEffect(() => {
    if (preSelectedCustomerId) {
      const customer = data.customers.find(c => c.id === preSelectedCustomerId);
      if (customer) {
        setFormData(prev => ({ ...prev, customerId: customer.id, customerName: customer.name, customerContact: customer.phone }));
        setCustomerSearch(customer.name);
        setShowAddForm(true);
        onClearPreSelect?.();
      }
    }
  }, [preSelectedCustomerId, data.customers, onClearPreSelect]);

  useEffect(() => {
    if (initialSaleToDuplicate) {
      setFormData({
        customerId: initialSaleToDuplicate.customerId || '',
        customerName: initialSaleToDuplicate.customerName,
        customerContact: initialSaleToDuplicate.customerContact || '',
        date: new Date().toISOString().split('T')[0],
        dueDate: initialSaleToDuplicate.dueDate || '',
        paymentMethod: 'Cash',
        cashPaid: '',
        tier: 'Retail',
        items: initialSaleToDuplicate.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate
        }))
      });
      setCustomerSearch(initialSaleToDuplicate.customerName);
      setShowAddForm(true);
      onClearDuplicate?.();
    }
  }, [initialSaleToDuplicate, onClearDuplicate]);

  const filteredCustomers = useMemo(() => {
    const list = [...data.customers].sort((a, b) => a.name.localeCompare(b.name));
    if (isCustomerForced) return list.slice(0, customerLazyLimit);
    if (!customerSearch) return list.slice(0, 5); 
    return list.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone.includes(customerSearch)).slice(0, customerLazyLimit);
  }, [data.customers, customerSearch, isCustomerForced, customerLazyLimit]);

  const filteredProducts = useMemo(() => {
    const list = [...data.products].sort((a, b) => a.name.localeCompare(b.name));
    if (isProductForced) return list.slice(0, productLazyLimit);
    if (!productSearch) return list.slice(0, 5);
    return list.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase()))).slice(0, productLazyLimit);
  }, [data.products, productSearch, isProductForced, productLazyLimit]);

  const filteredHistory = useMemo(() => {
    let list = data.sales.filter(s => !s.isMistake);
    
    if (historyStatus === 'Paid') {
      list = list.filter(s => s.paymentMethod !== 'Pending');
    } else if (historyStatus === 'Pending') {
      list = list.filter(s => s.paymentMethod === 'Pending');
    }

    if (historyDateRange.start) {
      list = list.filter(s => s.date >= historyDateRange.start);
    }
    if (historyDateRange.end) {
      list = list.filter(s => s.date <= historyDateRange.end);
    }

    return list.sort((a, b) => {
      let comparison = 0;
      switch (historySortKey) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'invoiceNumber':
          comparison = a.invoiceNumber.localeCompare(b.invoiceNumber);
          break;
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
      }
      return historySortDir === 'asc' ? comparison : -comparison;
    });
  }, [data.sales, historyStatus, historyDateRange, historySortKey, historySortDir]);

  const toggleHistorySort = (key: 'date' | 'invoiceNumber' | 'customerName' | 'totalAmount') => {
    if (historySortKey === key) {
      setHistorySortDir(historySortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setHistorySortKey(key);
      setHistorySortDir(key === 'date' || key === 'totalAmount' ? 'desc' : 'asc');
    }
  };

  const UNITS = ['kg', 'gram', 'no.', 'pkt', 'box', 'ltr', 'ml', 'bag', 'tin'];

  const calculateItemTotal = (qty: number, rate: number, unit: string) => {
    const q = Number(qty) || 0;
    const r = Number(rate) || 0;
    if (unit === 'gram' || unit === 'ml') return (q / 1000) * r;
    return q * r;
  };

  const currentTotal = formData.items.reduce((sum, i) => sum + calculateItemTotal(Number(i.quantity || 0), Number(i.rate || 0), i.unit || 'kg'), 0);

  const resetForm = () => {
    setFormData({ customerId: '', customerName: '', customerContact: '', date: new Date().toISOString().split('T')[0], dueDate: '', paymentMethod: 'Cash', cashPaid: '', tier: 'Retail', items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }] });
    setCustomerSearch('');
    setCustomerLazyLimit(50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalItems: SaleItem[] = formData.items.map(item => ({
      id: crypto.randomUUID(),
      productName: item.productName || 'Item',
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'kg',
      rate: Number(item.rate) || 0,
      total: calculateItemTotal(Number(item.quantity), Number(item.rate), item.unit || 'kg')
    }));

    const isPending = formData.paymentMethod === 'Pending' || (Number(formData.cashPaid) === 0 && formData.paymentMethod === 'Cash' && formData.cashPaid !== '');

    const newSale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber: `INV-${String(data.sales.length + 1).padStart(5, '0')}`,
      date: formData.date,
      dueDate: isPending ? formData.dueDate : undefined,
      customerId: formData.customerId || undefined,
      customerName: formData.customerName || customerSearch || 'Walk-in',
      customerContact: formData.customerContact,
      items: finalItems,
      totalAmount: finalItems.reduce((sum, i) => sum + i.total, 0),
      category: 'General',
      isMistake: false,
      createdBy: data.currentUser?.id || 'System',
      paymentMethod: isPending ? 'Pending' : formData.paymentMethod,
      isPaid: !isPending
    };

    updateData(prev => ({
      ...prev,
      sales: [newSale, ...prev.sales],
      customers: prev.customers.map(c => (c.id === newSale.customerId && newSale.paymentMethod === 'Pending') ? { ...c, pendingBalance: c.pendingBalance + newSale.totalAmount } : c)
    }));

    setLastSavedSale(newSale);
    setShowAddForm(false);
  };

  const selectCustomer = (c: Customer) => {
    setFormData(prev => ({ ...prev, customerId: c.id, customerName: c.name, customerContact: c.phone }));
    setCustomerSearch(c.name);
    setShowCustomerList(false);
    setIsCustomerForced(false);
  };

  const selectProduct = (p: Product, index: number) => {
    const newItems = [...formData.items];
    const rate = formData.tier === 'Wholesale' ? (p.wholesaleRate || p.defaultRate) : p.defaultRate;
    newItems[index] = { ...newItems[index], productName: p.name, unit: p.unit, rate };
    setFormData(prev => ({ ...prev, items: newItems }));
    setActiveProductIdx(null);
    setIsProductForced(false);
    setProductSearch('');
  };

  const handleLazyScroll = (e: React.UIEvent<HTMLDivElement>, type: 'customer' | 'product') => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (type === 'customer') setCustomerLazyLimit(prev => prev + 50);
      else setProductLazyLimit(prev => prev + 50);
    }
  };

  const isThermal = printSize === 'Thermal80' || printSize === 'Thermal58';
  const customerForDues = lastSavedSale?.customerId ? data.customers.find(c => c.id === lastSavedSale.customerId) : null;
  const currentTotalDues = customerForDues?.pendingBalance || 0;
  const currentTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const paperWidth = printSize === 'Thermal58' ? '58mm' : printSize === 'Thermal80' ? '80mm' : '210mm';
  const template = data.templateSettings;

  // PRINT SCALING LOGIC
  const scalingFactor = printSize === 'Thermal58' ? 0.75 : printSize === 'Thermal80' ? 0.9 : 1.0;
  const baseFontSize = template.applyToPrinting ? template.fontSize : 12;
  const effectiveFontSize = baseFontSize * scalingFactor;

  return (
    <div className="space-y-4">
      {/* Dynamic Page Hinting for Printers */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            size: ${paperWidth} auto; 
            margin: 0 !important; 
          }
          #print-engine {
            width: ${paperWidth} !important;
            margin: 0 !important;
            padding: 0 !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
        }
      `}} />

      <div className="no-print flex justify-between items-center bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Enterprise Billing</h3>
        <button onClick={() => { resetForm(); setShowAddForm(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center space-x-2">
          <IconAdd className="w-4 h-4" /><span>New Invoice</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-[32px] shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-300 no-print flex flex-col max-h-[85vh]">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 border-b border-slate-100 bg-slate-50/30 rounded-t-[32px]">
              <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</label>
                <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                  <input ref={customerInputRef} type="text" className="flex-1 px-3 py-2 outline-none font-bold uppercase text-sm" placeholder="Search or Walk-in..." value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setShowCustomerList(true); setIsCustomerForced(false); }} onFocus={() => setShowCustomerList(true)} />
                  <button type="button" onClick={() => { setShowCustomerList(!showCustomerList); setIsCustomerForced(!isCustomerForced); }} className="px-2 border-l border-slate-200 bg-slate-50 text-slate-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                </div>
                {showCustomerList && (
                  <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto" onScroll={e => handleLazyScroll(e, 'customer')}>
                     {filteredCustomers.map(c => (
                       <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-4 py-2 hover:bg-indigo-50 border-b border-slate-50 flex justify-between items-center">
                          <div><p className="font-black text-slate-800 text-xs uppercase">{c.name}</p><p className="text-[9px] text-slate-400 font-bold">{c.phone}</p></div>
                          <span className="text-[9px] font-black text-indigo-600">₹{c.pendingBalance.toLocaleString()}</span>
                       </button>
                     ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Number</label>
                <input type="tel" className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-bold text-sm" placeholder="Mobile..." value={formData.customerContact} onChange={e => setFormData({ ...formData, customerContact: e.target.value })} />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Date</label>
                <input type="date" required className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none font-bold text-sm" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>

              {formData.paymentMethod === 'Pending' && (
                <div className="animate-in fade-in slide-in-from-left-2">
                  <label className="block text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Due Date</label>
                  <input type="date" className="w-full px-3 py-2 border border-rose-200 bg-rose-50 rounded-xl outline-none font-bold text-sm text-rose-700" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
              )}

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pricing Tier</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {['Retail', 'Wholesale'].map(t => (
                    <button key={t} type="button" onClick={() => setFormData({...formData, tier: t as PriceTier})} className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${formData.tier === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment Mode</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {['Cash', 'UPI', 'Pending'].map(m => (
                    <button key={m} type="button" onClick={() => setFormData({...formData, paymentMethod: m as PaymentMethod})} className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${formData.paymentMethod === m ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{m}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-40 space-y-2 no-scrollbar relative">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 mb-1 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <div className="col-span-5">Product Description</div>
                <div className="col-span-2">Unit</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2 text-right">Rate</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 bg-white p-2 md:p-3 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors shadow-sm items-center relative group">
                  <div className="col-span-1 md:col-span-5 relative">
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-slate-50 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
                      <input type="text" placeholder="Type item..." required className="flex-1 px-3 py-1.5 outline-none font-bold text-xs uppercase bg-transparent" value={activeProductIdx === index ? productSearch : item.productName} onChange={e => { setProductSearch(e.target.value); setActiveProductIdx(index); setIsProductForced(false); }} onFocus={() => { setProductSearch(item.productName || ''); setActiveProductIdx(index); }} />
                      <button type="button" onClick={() => { setActiveProductIdx(activeProductIdx === index ? null : index); setIsProductForced(true); }} className="px-2 text-slate-300"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg></button>
                    </div>
                    {activeProductIdx === index && (
                      <div className="absolute z-[110] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto" onScroll={e => handleLazyScroll(e, 'product')}>
                        {filteredProducts.map(p => (
                          <button key={p.id} type="button" onClick={() => selectProduct(p, index)} className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b border-slate-50 flex justify-between items-center">
                            <span className="font-black text-slate-800 uppercase text-[10px]">{p.name}</span>
                            <span className="text-[9px] font-black text-indigo-600">₹{formData.tier === 'Wholesale' ? (p.wholesaleRate || p.defaultRate) : p.defaultRate}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 md:contents gap-2 col-span-1 md:col-span-3">
                    <div className="col-span-1 md:col-span-2">
                       <select className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-bold bg-slate-50 text-[10px] uppercase" value={item.unit} onChange={e => { const it = [...formData.items]; it[index].unit = e.target.value; setFormData({...formData, items: it}); }}>
                         {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                       </select>
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <input type="number" step="any" required className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-bold bg-slate-50 text-xs" value={item.quantity} onChange={e => { const it = [...formData.items]; it[index].quantity = Number(e.target.value); setFormData({...formData, items: it}); }} />
                    </div>
                    <div className="col-span-1 md:col-span-2 md:text-right">
                      <input type="number" step="any" required className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-bold bg-slate-50 text-xs md:text-right" value={item.rate} onChange={e => { const it = [...formData.items]; it[index].rate = Number(e.target.value); setFormData({...formData, items: it}); }} />
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-2 flex items-center justify-end">
                    <div className="text-right">
                       <p className="font-black text-indigo-600 text-sm">₹{calculateItemTotal(Number(item.quantity), Number(item.rate), item.unit || 'kg').toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={() => setFormData({...formData, items: formData.items.filter((_, i) => i !== index)})} className="ml-3 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setFormData({...formData, items: [...formData.items, {productName: '', quantity: 1, unit: 'kg', rate: 0}]})} className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:border-indigo-200 hover:text-indigo-600 transition-all">+ Add Another Item</button>
            </div>

            <div className="sticky bottom-0 bg-slate-900 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4 rounded-b-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-[100]">
               <div className="flex items-center space-x-6">
                  <div>
                    <p className="text-[8px] uppercase font-black opacity-50 tracking-widest">Grand Total</p>
                    <p className="text-3xl font-black tracking-tight">₹{currentTotal.toLocaleString()}</p>
                  </div>
                  <div className="hidden md:block h-10 w-px bg-white/10"></div>
                  <div className="hidden md:block">
                    <p className="text-[8px] uppercase font-black opacity-50 tracking-widest">Active Items</p>
                    <p className="text-lg font-black">{formData.items.length}</p>
                  </div>
               </div>
               <div className="flex gap-3 w-full md:w-auto">
                  <button type="button" onClick={() => { setShowAddForm(false); resetForm(); }} className="flex-1 md:flex-none px-6 py-3 text-white/50 font-bold uppercase text-[10px] tracking-widest hover:text-white">Discard</button>
                  <button type="submit" className="flex-1 md:flex-none px-10 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-xl shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest">Generate Bill</button>
               </div>
            </div>
          </form>
        </div>
      )}

      {lastSavedSale && (
        <div className="fixed inset-0 z-[150] flex flex-col md:flex-row bg-slate-950/95 backdrop-blur-2xl animate-in fade-in duration-300 overflow-y-auto md:overflow-hidden touch-scroll print:static print:bg-white print:backdrop-blur-none">
          <div className="no-print w-full md:w-80 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-4 sm:p-6 md:p-8 flex flex-col shrink-0 md:overflow-y-auto max-h-none md:max-h-full">
            <div className="mb-6 md:mb-8 border-b border-slate-800 pb-4 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-emerald-500/5">
                <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-white font-black uppercase text-base md:text-lg tracking-widest">SALE SAVED</h3>
              <p className="text-slate-500 text-[10px] uppercase font-bold mt-1 tracking-widest">{lastSavedSale.invoiceNumber}</p>
            </div>
            <div className="space-y-6">
              <section>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">Paper Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['A4', 'Thermal80', 'Thermal58'] as PrintSize[]).map(size => (
                    <button key={size} onClick={() => setPrintSize(size)} className={`py-3 rounded-xl text-[9px] font-black uppercase border transition-all ${printSize === size ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>{size}</button>
                  ))}
                </div>
              </section>
              <section className="space-y-3">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Print Options</label>
                 {btStatus && (
                   <div className="p-3 bg-indigo-950 border border-indigo-700/50 rounded-xl text-[10px] text-indigo-300 font-bold">
                     {btStatus}
                   </div>
                 )}
              </section>
            </div>
            <div className="mt-6 md:mt-auto pt-6 md:pt-8 border-t border-slate-800 space-y-3">
              <button onClick={() => setShowPrinterModal(true)} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-2 text-xs uppercase tracking-widest ring-2 ring-indigo-400/50">
                <IconPrint className="w-5 h-5" />
                <span>🖨️ Universal Print Hub (BT / WiFi / USB / PC)</span>
              </button>

              <button onClick={() => {
                printElement('print-engine', `Invoice ${lastSavedSale.invoiceNumber}`);
              }} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-3 text-xs uppercase tracking-widest">
                <span>Quick Print Spooler</span>
              </button>

              <button onClick={async () => {
                setBtStatus('Connecting to Bluetooth Thermal Printer...');
                const res = await printViaBluetoothThermal(lastSavedSale, template);
                setBtStatus(res.message);
                setTimeout(() => setBtStatus(null), 5000);
              }} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 text-[10px] uppercase tracking-widest">
                <span>📱 Bluetooth Thermal Print</span>
              </button>

              <button onClick={() => {
                shareOrSaveInvoice(lastSavedSale, template);
              }} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-2 text-[10px] uppercase tracking-widest">
                <span>📄 Share / Save Invoice</span>
              </button>

              <button onClick={() => { setLastSavedSale(null); resetForm(); setShowAddForm(true); }} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center space-x-2">
                <IconAdd className="w-4 h-4" />
                <span>Start Next Bill</span>
              </button>
              <button onClick={() => { setLastSavedSale(null); resetForm(); }} className="w-full py-3 text-slate-500 hover:text-rose-500 font-black text-[10px] uppercase tracking-widest">Close View</button>
            </div>
          </div>
          
          <div className="flex-1 bg-slate-950 overflow-y-auto p-4 md:p-12 flex justify-center items-start min-h-[400px] md:min-h-0 touch-scroll print:static print:block print:p-0 print:bg-white print:overflow-visible">
            {/* CANVAS POWERED PRINT ENGINE */}
            <div id="print-engine" className="bg-white shadow-2xl transition-all duration-300 print:shadow-none print:m-0 print:static" style={{ 
              width: paperWidth, 
              minHeight: printSize === 'A4' ? '297mm' : 'auto', 
              fontSize: `${effectiveFontSize}px`, 
              lineHeight: template.applyToPrinting ? template.lineSpacing : 1.2, 
              fontFamily: isThermal ? 'monospace' : 'inherit', 
              color: 'black', 
              boxSizing: 'border-box',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}>
              <div className={`${(template.applyToPrinting && template.compactMode) ? 'p-1' : (isThermal ? 'p-2' : 'p-8')} border-black`} style={{ 
              borderWidth: template.applyToPrinting ? `${template.borderWeight}px` : '2px',
              borderColor: template.applyToPrinting ? template.brandColor : '#000',
              paddingLeft: (template.applyToPrinting && template.compactMode) ? '1mm' : (isThermal ? '2mm' : '8mm'), 
              paddingRight: (template.applyToPrinting && template.compactMode) ? '1mm' : (isThermal ? '2mm' : '8mm')
            }}>
              <div className="text-center mb-4">
                {((template.applyToPrinting ? template.showLogo : true) && data.business?.logo) && (
                  <img src={data.business.logo} alt="Logo" className="mx-auto mb-2 object-contain opacity-90 mix-blend-multiply" style={{ width: template.applyToPrinting ? `${template.logoSize * scalingFactor}px` : '60px' }} />
                )}
                <h1 className="font-black uppercase tracking-tighter" style={{ fontSize: '1.6em', color: template.applyToPrinting ? template.brandColor : '#000' }}>{data.business?.name}</h1>
                <p className="font-bold opacity-75 uppercase tracking-widest" style={{ fontSize: '0.65em' }}>{data.business?.tagline}</p>
                <div className="mt-1 font-medium" style={{ fontSize: '0.6em' }}><p>{data.business?.address}</p><p>Ph: {data.business?.phone}</p></div>
                <h2 className="mt-3 font-black uppercase tracking-[0.2em] py-1 text-white text-center" style={{ backgroundColor: template.applyToPrinting ? template.brandColor : '#000', fontSize: '0.75em' }}>Sale Invoice</h2>
              </div>

              <div className="flex justify-between mb-4 font-black uppercase" style={{ fontSize: '0.65em' }}>
                <div className="text-left flex-1">
                  <p className="opacity-40">Client</p>
                  <p className="text-base tracking-tight leading-tight">{lastSavedSale.customerName}</p>
                </div>
                <div className="text-right flex-1">
                  <p className="opacity-40">Ref</p>
                  <p>#{lastSavedSale.invoiceNumber.split('-')[1]}</p>
                  <p>{formatDate(lastSavedSale.date)}</p>
                </div>
              </div>

              {(template.applyToPrinting && template.customFields && template.customFields.length > 0) && (
                 <div className="mb-4 grid grid-cols-2 gap-2" style={{ fontSize: '0.65em' }}>
                    {template.customFields.map(field => (
                       <div key={field.id} className="flex flex-col">
                          <span className="opacity-40 font-black uppercase">{field.label}</span>
                          <span className="font-bold">{applyTemplate(field.value, lastSavedSale)}</span>
                       </div>
                    ))}
                 </div>
              )}

              <table className="w-full mb-6 border-collapse table-auto">
                <thead className="uppercase" style={{ borderTop: `2px solid ${template.applyToPrinting ? template.brandColor : '#000'}`, borderBottom: `2px solid ${template.applyToPrinting ? template.brandColor : '#000'}`, fontSize: '0.6em' }}>
                  <tr>
                    <th className="py-1.5 text-left">Item</th>
                    <th className="py-1.5 text-center">Qty</th>
                    {(template.applyToPrinting ? template.showRatePerUnit : true) && <th className="py-1.5 text-right">Rate</th>}
                    <th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold" style={{ fontSize: '0.8em' }}>
                  {lastSavedSale.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2 uppercase leading-tight pr-1">
                        {it.productName}
                        {(template.applyToPrinting && template.showSKU) && <div className="text-[0.6em] opacity-40">SKU: AM-{i+1}</div>}
                      </td>
                      <td className="py-2 text-center whitespace-nowrap">{it.quantity}{it.unit}</td>
                      {(template.applyToPrinting ? template.showRatePerUnit : true) && <td className="py-2 text-right whitespace-nowrap">₹{it.rate}</td>}
                      <td className="py-2 text-right whitespace-nowrap">₹{it.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col items-end pt-3" style={{ borderTop: `2px solid ${template.applyToPrinting ? template.brandColor : '#000'}` }}>
                  <div className="w-full md:w-2/3 space-y-1.5">
                    <div className="flex justify-between font-black uppercase" style={{ fontSize: '1.2em' }}><span className="opacity-50">Total Amount</span><span>₹{lastSavedSale.totalAmount.toLocaleString()}</span></div>
                  </div>
                  <p className="uppercase font-black opacity-40 mt-4" style={{ fontSize: '0.45em' }}>Pay Mode: {lastSavedSale.paymentMethod} | {currentTime}</p>
              </div>

              {(template.applyToPrinting ? template.footerText : true) && (
                 <p className="mt-6 text-center font-bold italic opacity-60" style={{ fontSize: '0.6em' }}>
                   {applyTemplate(template.footerText || "Thank you for your business!", lastSavedSale)}
                 </p>
              )}

              {(template.applyToPrinting ? template.includeSignatures : true) && (
                <div className="mt-12 mb-2 flex justify-between px-1">
                  <div className="text-center">
                    <div className="w-16 mx-auto mb-1" style={{ borderTop: `1px solid ${template.applyToPrinting ? template.brandColor : '#000'}` }}></div>
                    <p className="font-black uppercase opacity-60" style={{ fontSize: '0.4em' }}>Receiver</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 mx-auto mb-1" style={{ borderTop: `1px solid ${template.applyToPrinting ? template.brandColor : '#000'}` }}></div>
                    <p className="font-black uppercase opacity-60" style={{ fontSize: '0.4em' }}>Authorized</p>
                  </div>
                </div>
              )}

              <div className="mt-6 text-center border-t border-dotted border-gray-400 pt-3">
                <p className="font-black uppercase tracking-widest opacity-30" style={{ fontSize: '0.45em' }}>A M Food Processing QC Passed</p>
                {(template.applyToPrinting && template.termsText) && (
                   <p className="mt-1 font-medium opacity-40 leading-tight" style={{ fontSize: '0.4em' }}>{applyTemplate(template.termsText, lastSavedSale)}</p>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden no-print">
          <div className="px-6 py-4 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex flex-wrap items-center gap-4">
               <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Recent Sales Flow</h4>
               <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                 {(['All', 'Paid', 'Pending'] as const).map(f => (
                   <button key={f} onClick={() => setHistoryStatus(f)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${historyStatus === f ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
                 ))}
               </div>
               {historyStatus === 'Pending' && (
                 <div className="flex px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg items-center gap-2">
                   <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest">Pending Total:</span>
                   <span className="text-xs font-black text-rose-700">₹{filteredHistory.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}</span>
                 </div>
               )}
             </div>
             <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <input type="date" value={historyDateRange.start} onChange={e => setHistoryDateRange({...historyDateRange, start: e.target.value})} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none" />
                  <span className="text-slate-400 text-[10px] font-bold">to</span>
                  <input type="date" value={historyDateRange.end} onChange={e => setHistoryDateRange({...historyDateRange, end: e.target.value})} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none" />
                </div>
                <button onClick={onNavigateToInvoices} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline ml-auto">Full Audit →</button>
             </div>
          </div>
          <div className="px-6 py-2 bg-slate-50 border-b flex items-center gap-2 overflow-x-auto">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Sort By:</span>
             {[
               { key: 'date', label: 'Date' },
               { key: 'invoiceNumber', label: 'Invoice #' },
               { key: 'customerName', label: 'Customer' },
               { key: 'totalAmount', label: 'Amount' }
             ].map(sort => (
               <button 
                 key={sort.key} 
                 onClick={() => toggleHistorySort(sort.key as any)}
                 className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center space-x-1 border ${
                   historySortKey === sort.key 
                     ? 'bg-indigo-600 text-white border-indigo-700' 
                     : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                 }`}
               >
                 <span>{sort.label}</span>
                 <span className={`transition-transform duration-200 ${historySortKey === sort.key && historySortDir === 'desc' ? 'rotate-180' : ''}`}>
                   {historySortKey === sort.key ? (
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                   ) : (
                     <svg className="w-3 h-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                   )}
                 </span>
               </button>
             ))}
          </div>
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.slice(0, 20).map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 group transition-colors">
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatDate(sale.date)}</td>
                  <td className="px-6 py-4 text-xs font-black text-slate-400">{sale.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm font-black text-slate-800 uppercase tracking-tight">{sale.customerName}</td>
                  <td className="px-6 py-4 text-right font-black text-indigo-600">₹{sale.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center flex justify-end gap-2">
                     <button onClick={() => { 
                       setFormData({
                         customerId: sale.customerId || '',
                         customerName: sale.customerName,
                         customerContact: sale.customerContact || '',
                         date: new Date().toISOString().split('T')[0],
                         dueDate: sale.dueDate || '',
                         paymentMethod: 'Cash',
                         cashPaid: '',
                         tier: 'Retail',
                         items: sale.items.map(item => ({
                           productName: item.productName,
                           quantity: item.quantity,
                           unit: item.unit,
                           rate: item.rate
                         }))
                       });
                       setCustomerSearch(sale.customerName);
                       setShowAddForm(true);
                     }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Duplicate Bill">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                     </button>
                     <button onClick={() => { setLastSavedSale(sale); setPrintSize('Thermal80'); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Print Bill"><IconPrint className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No sales found</td>
                </tr>
              )}
            </tbody>
          </table>
      </div>
      
      {/* Universal Printer Modal */}
      <PrinterModal
        isOpen={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
        sale={lastSavedSale}
        elementId="print-engine"
        title={lastSavedSale ? `Invoice ${lastSavedSale.invoiceNumber}` : 'Print Document'}
        template={template}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
};

export default Sales;