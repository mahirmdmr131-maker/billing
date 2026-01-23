
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

const Sales: React.FC<SalesProps> = ({ data, updateData, onNavigateToInvoices }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [lastSavedSale, setLastSavedSale] = useState<Sale | null>(null);
  const [includePreviousBalance, setIncludePreviousBalance] = useState(false);
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState(0);
  const [isLargeLogo, setIsLargeLogo] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    category: 'General',
    paymentMethod: 'Cash' as PaymentMethod,
    selectedUpiQrId: '',
    cashPaid: '',
    items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }] as Partial<SaleItem>[]
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
      items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }]
    });
    setIncludePreviousBalance(false);
    setSelectedCustomerBalance(0);
  };

  const handleAddItem = () => setFormData(prev => ({ ...prev, items: [...prev.items, { productName: '', quantity: 1, unit: 'kg', rate: 0 }] }));
  const handleRemoveItem = (index: number) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    if (field === 'productName' && typeof value === 'string' && value.includes('__PID:')) {
      const prodId = value.split('__PID:')[1];
      const prod = data.products.find(p => p.id === prodId);
      if (prod) {
        newItems[index] = { ...newItems[index], productName: prod.name, unit: prod.unit };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setFormData(prev => ({ ...prev, items: newItems }));
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
        total: total
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
        } else {
          newProductsList.push({
            id: crypto.randomUUID(),
            name: item.productName,
            defaultRate: 0,
            unit: item.unit
          });
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

  const sortedSales = useMemo(() => {
    return [...data.sales].sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'date': comparison = a.date.localeCompare(b.date); break;
        case 'customerName': comparison = a.customerName.localeCompare(b.customerName); break;
        case 'totalAmount': comparison = a.totalAmount - b.totalAmount; break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data.sales, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
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

  // Helper for sort icon
  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <svg className="w-3 h-3 ml-1 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    return sortDirection === 'asc' ? 
      <svg className="w-3 h-3 ml-1 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg> : 
      <svg className="w-3 h-3 ml-1 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Rapid Billing</h3>
        <button onClick={() => { resetForm(); setShowAddForm(true); }} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95">
          <IconAdd /><span>Start New Bill</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-300">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-100 pb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer Profile</label>
                <select className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium" value={formData.customerId} onChange={handleCustomerChange}>
                  <option value="">Walk-in Customer</option>
                  {data.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
                {!formData.customerId && (
                  <input type="text" className="w-full mt-3 px-4 py-3 border border-slate-200 rounded-xl outline-none font-medium" placeholder="Customer Name..." value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} />
                )}
                {formData.customerId && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
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
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Billing Date</label>
                <input type="date" required className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Itemized Billing</h4>
                <button type="button" onClick={handleAddItem} className="text-indigo-600 font-bold text-xs hover:underline tracking-tight">+ New Line Item</button>
              </div>
              
              {formData.items.map((item, index) => {
                const rowTotal = calculateItemTotal(Number(item.quantity || 0), Number(item.rate || 0), item.unit || 'kg');
                const rateLabelSuffix = (item.unit === 'gram' || item.unit === 'kg') ? 'kg' : (item.unit === 'ml' || item.unit === 'ltr' ? 'ltr' : (item.unit || 'unit'));

                return (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 items-end relative group transition-all hover:bg-white hover:shadow-md">
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
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rate (₹/{rateLabelSuffix})</label>
                      <input type="number" step="any" required className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium text-sm" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} />
                    </div>
                    <div className="md:col-span-1 flex flex-col items-end">
                      <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-slate-300 hover:text-red-500 mb-1">✕</button>
                      <div className="text-right font-black text-slate-800 text-sm whitespace-nowrap">₹{rowTotal.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Net Bill Amount - Moved below product entry */}
            <div className="flex justify-start py-4">
              <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-xl inline-block">
                <p className="text-[10px] uppercase font-black opacity-50 tracking-widest mb-1">Net Bill Amount</p>
                <p className="text-4xl font-black">₹{currentTotal.toLocaleString()}</p>
              </div>
            </div>

            {/* Payment Method & Cash Received - Moved below Net Total */}
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
                 {formData.cashPaid === '0' && (
                   <p className="mt-2 text-[10px] font-black uppercase text-rose-500 text-right">Consider as Pending Bill</p>
                 )}
              </div>
            </div>

            {formData.paymentMethod === 'UPI' && selectedQr && (
              <div className="flex flex-col items-center p-6 bg-emerald-50 rounded-[40px] border border-emerald-100 animate-in fade-in zoom-in duration-500">
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em] mb-4">Customer Scan Area: {selectedQr.name}</p>
                  <img src={selectedQr.imageData} alt="Scan to pay" className="w-48 h-48 object-contain bg-white p-4 rounded-3xl shadow-xl border-4 border-emerald-200" />
                  <p className="mt-4 text-sm font-black text-emerald-800">AMOUNT TO COLLECT: ₹{currentTotal.toLocaleString()}</p>
              </div>
            )}

            <div className="flex justify-end items-center pt-8 border-t border-slate-100 gap-4">
              <button type="button" onClick={() => { setShowAddForm(false); resetForm(); }} className="px-8 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors uppercase text-xs tracking-widest">Discard</button>
              <button type="submit" className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest">Generate Bill</button>
            </div>
          </form>
        </div>
      )}

      {/* Post-Save Confirmation Modal & Printed Content */}
      {lastSavedSale && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden p-12 text-center animate-in zoom-in-95 duration-200 no-print">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-emerald-50">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">Invoice Saved!</h3>
            <p className="text-slate-500 font-medium mb-8 text-sm">Invoice <b>{lastSavedSale.invoiceNumber}</b> processed. Total: ₹{lastSavedSale.totalAmount.toLocaleString()}</p>
            
            <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center space-x-3">
              <input 
                type="checkbox" 
                id="modal-large-logo" 
                checked={isLargeLogo} 
                onChange={(e) => setIsLargeLogo(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="modal-large-logo" className="text-xs font-black uppercase text-slate-600 cursor-pointer">Use Large Logo</label>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={handleModalPrint}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-2xl transition-all active:scale-95 flex items-center justify-center space-x-3"
              >
                <IconPrint className="w-6 h-6" />
                <span className="text-lg">Print Invoice</span>
              </button>
              <button 
                onClick={handleModalClose}
                className="w-full py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-3xl transition-all active:scale-95 text-lg"
              >
                Next New Bill
              </button>
              <button 
                onClick={() => { setLastSavedSale(null); resetForm(); setShowAddForm(false); onNavigateToInvoices(); }}
                className="w-full py-3 text-indigo-600 font-black text-xs uppercase tracking-[0.3em] hover:underline"
              >
                View History
              </button>
            </div>
          </div>

          {/* HIDDEN PRINT CONTENT - ONLY VISIBLE DURING window.print() */}
          <div className="print-only hidden print:block bg-white text-black p-4" style={{ fontFamily: 'monospace', width: '100%', minHeight: '100vh' }}>
             <div className="p-4 border-2 border-black">
                <div className="text-center mb-6 pb-4 border-b-2 border-black">
                  {data.business?.logo && (
                    <img 
                      src={data.business.logo} 
                      alt="Logo" 
                      className={`${isLargeLogo ? 'w-48' : 'w-24'} mx-auto mb-4 object-contain`} 
                    />
                  )}
                  <h1 className="text-2xl font-bold uppercase">{data.business?.name}</h1>
                  <p className="text-sm font-bold">{data.business?.tagline}</p>
                  <p className="text-xs">{data.business?.address}</p>
                  <p className="text-xs">Ph: {data.business?.phone}</p>
                  {data.business?.gst && <p className="text-xs font-bold">GSTIN: {data.business.gst}</p>}
                </div>
                <div className="flex justify-between mb-4 text-xs font-bold uppercase">
                  <div>Customer: {lastSavedSale.customerName}</div>
                  <div>Inv: {lastSavedSale.invoiceNumber} | Date: {lastSavedSale.date}</div>
                </div>
                <table className="w-full text-xs text-left mb-6 border-collapse">
                  <thead className="border-y-2 border-black">
                    <tr>
                      <th className="py-2">Item</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-center">Rate/Unit</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="border-b-2 border-black">
                    {lastSavedSale.items.map((it, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2 font-bold">{it.productName}</td>
                        <td className="py-2 text-center">{it.quantity}{it.unit}</td>
                        <td className="py-2 text-center">₹{it.rate}/{it.unit === 'gram' || it.unit === 'kg' ? 'kg' : (it.unit === 'ml' || it.unit === 'ltr' ? 'ltr' : it.unit)}</td>
                        <td className="py-2 text-right font-bold">₹{it.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right space-y-1">
                   <p className="text-sm uppercase font-bold text-gray-600">Net Payable</p>
                   <p className="text-2xl font-bold">₹{lastSavedSale.totalAmount.toLocaleString()}</p>
                   <p className="text-[10px] font-bold uppercase">Mode: {lastSavedSale.paymentMethod}</p>
                </div>
                <div className="mt-12 text-center text-xs font-bold italic border-t border-black pt-4">
                  Thank You for Choosing A M Food Processing!
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Styles for print mode to handle visibility cleanly */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-only, .print-only * { visibility: visible !important; }
          .print-only { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; width: 100% !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
           <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Session History</h4>
           <p className="text-[10px] font-black text-slate-400">Sort by clicking headers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <tr>
                <th 
                  className="px-8 py-5 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => toggleSort('date')}
                >
                  <div className="flex items-center">
                    <span>Date</span>
                    <SortIcon field="date" />
                  </div>
                </th>
                <th 
                  className="px-8 py-5 cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => toggleSort('customerName')}
                >
                  <div className="flex items-center">
                    <span>Customer</span>
                    <SortIcon field="customerName" />
                  </div>
                </th>
                <th className="px-8 py-5">Payment</th>
                <th 
                  className="px-8 py-5 text-right cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                  onClick={() => toggleSort('totalAmount')}
                >
                  <div className="flex items-center justify-end">
                    <span>Grand Total (₹)</span>
                    <SortIcon field="totalAmount" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSales.slice(0, 10).map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(sale.date).toLocaleDateString()}</td>
                  <td className="px-8 py-5 text-sm font-black text-slate-800">{sale.customerName}</td>
                  <td className="px-8 py-5"><span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-1 rounded">{sale.paymentMethod}</span></td>
                  <td className="px-8 py-5 text-sm font-black text-indigo-600 text-right">₹{sale.totalAmount.toLocaleString()}</td>
                </tr>
              ))}
              {sortedSales.length === 0 && (
                <tr><td colSpan={4} className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">No records this session</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sales;
