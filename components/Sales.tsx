
import React, { useState, useEffect } from 'react';
import { AppData, Sale, SaleItem, Customer, Product, PaymentMethod } from '../types';
import { IconAdd } from './Icons';

interface SalesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onNavigateToInvoices: () => void;
}

const Sales: React.FC<SalesProps> = ({ data, updateData, onNavigateToInvoices }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [includePreviousBalance, setIncludePreviousBalance] = useState(false);
  const [selectedCustomerBalance, setSelectedCustomerBalance] = useState(0);
  
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    category: 'General',
    paymentMethod: 'Cash' as PaymentMethod,
    items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }] as Partial<SaleItem>[]
  });

  const isAdmin = data.currentUser?.role === 'admin';
  const UNITS = ['kg', 'gram', 'no.', 'pkt', 'box', 'ltr', 'ml'];

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

  const handleDuplicate = (sale: Sale) => {
    const customer = data.customers.find(c => c.id === sale.customerId);
    setFormData({
      customerId: sale.customerId || '',
      customerName: sale.customerName,
      date: new Date().toISOString().split('T')[0],
      dueDate: sale.dueDate || new Date().toISOString().split('T')[0],
      category: sale.category,
      paymentMethod: sale.paymentMethod,
      items: sale.items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate
      }))
    });
    setSelectedCustomerBalance(customer?.pendingBalance || 0);
    setIncludePreviousBalance(!!sale.includePreviousBalance);
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeSale = (saleId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Delete this sale record permanently? This will also revert any balance added to the customer if it was a pending bill.')) return;

    updateData(prev => {
      const saleToRemove = prev.sales.find(s => s.id === saleId);
      if (!saleToRemove) return prev;

      let updatedCustomers = [...prev.customers];
      if (saleToRemove.paymentMethod === 'Pending' && saleToRemove.customerId) {
        updatedCustomers = updatedCustomers.map(c => 
          c.id === saleToRemove.customerId 
            ? { ...c, pendingBalance: Math.max(0, (c.pendingBalance || 0) - saleToRemove.totalAmount) } 
            : c
        );
      }

      // Revert stock decrement
      const updatedProducts = [...prev.products];
      saleToRemove.items.forEach(item => {
        const productIndex = updatedProducts.findIndex(p => p.name.toLowerCase() === item.productName.toLowerCase());
        if (productIndex !== -1 && updatedProducts[productIndex].currentStock !== undefined) {
          updatedProducts[productIndex] = {
            ...updatedProducts[productIndex],
            currentStock: (updatedProducts[productIndex].currentStock || 0) + item.quantity
          };
        }
      });

      return {
        ...prev,
        sales: prev.sales.filter(s => s.id !== saleId),
        customers: updatedCustomers,
        products: updatedProducts
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalItems: SaleItem[] = formData.items.map(item => ({
      id: crypto.randomUUID(),
      productName: item.productName || 'General Item',
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'kg',
      rate: Number(item.rate) || 0,
      total: (Number(item.quantity) || 0) * (Number(item.rate) || 0)
    }));
    
    const currentSaleAmount = finalItems.reduce((sum, i) => sum + i.total, 0);

    const newSale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber: `INV-${String(data.sales.length + 1).padStart(5, '0')}`,
      date: formData.date,
      dueDate: formData.paymentMethod === 'Pending' ? formData.dueDate : undefined,
      customerId: formData.customerId || undefined,
      customerName: formData.customerName || 'Walk-in Customer',
      items: finalItems,
      totalAmount: currentSaleAmount,
      category: formData.category,
      isMistake: false,
      createdBy: data.currentUser?.id || 'System',
      paymentMethod: formData.paymentMethod,
      includePreviousBalance: includePreviousBalance
    };

    updateData(prev => {
      // 1. Update Catalog & Stock
      const newProductsList = [...prev.products];
      finalItems.forEach(item => {
        const productIndex = newProductsList.findIndex(p => p.name.toLowerCase() === item.productName.toLowerCase());
        if (productIndex !== -1) {
          // If product exists and has stock tracking, decrement it
          if (newProductsList[productIndex].currentStock !== undefined) {
            newProductsList[productIndex] = {
              ...newProductsList[productIndex],
              currentStock: Math.max(0, (newProductsList[productIndex].currentStock || 0) - item.quantity)
            };
          }
        } else {
          // Add new product if it doesn't exist
          newProductsList.push({
            id: crypto.randomUUID(),
            name: item.productName,
            defaultRate: 0,
            unit: item.unit
          });
        }
      });

      let updatedCustomers = [...prev.customers];
      if (formData.paymentMethod === 'Pending' && formData.customerId) {
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

    setShowAddForm(false);
    onNavigateToInvoices();
  };

  const currentTotal = formData.items.reduce((sum, i) => sum + (Number(i.quantity || 0) * Number(i.rate || 0)), 0);
  const grandTotalWithPrevious = includePreviousBalance ? currentTotal + selectedCustomerBalance : currentTotal;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Sales Records</h3>
        <button onClick={() => setShowAddForm(true)} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95">
          <IconAdd /><span>New Billing</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-300">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Customer</label>
                <select className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium" value={formData.customerId} onChange={handleCustomerChange}>
                  <option value="">Walk-in Customer</option>
                  {data.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
                {!formData.customerId && (
                  <input type="text" className="w-full mt-3 px-4 py-3 border border-slate-200 rounded-xl outline-none font-medium" placeholder="Or type Customer Name..." value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} />
                )}
                {formData.customerId && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-amber-600 uppercase">Existing Pending</p>
                      <p className="text-lg font-black text-amber-800">₹{selectedCustomerBalance.toLocaleString()}</p>
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-indigo-600 rounded" 
                        checked={includePreviousBalance}
                        onChange={e => setIncludePreviousBalance(e.target.checked)}
                      />
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Show/Include Previous on Bill</span>
                    </label>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Billing Date</label>
                <input type="date" required className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>
              {formData.paymentMethod === 'Pending' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Expected Due Date</label>
                  <input type="date" className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none bg-slate-50 font-medium" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Pending'] as PaymentMethod[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentMethod: mode })}
                      className={`py-3 rounded-xl text-xs font-bold transition-all border ${formData.paymentMethod === mode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Itemized Billing</h4>
                <button type="button" onClick={handleAddItem} className="text-indigo-600 font-bold text-xs hover:underline">+ Add Row</button>
              </div>
              
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 items-end relative group">
                  <div className="md:col-span-5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Item Selection / Name</label>
                    <div className="space-y-2">
                      <select className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white" onChange={e => updateItem(index, 'productName', e.target.value)} value="">
                        <option value="">Choose from Catalog...</option>
                        {data.products.map(p => <option key={p.id} value={`__PID:${p.id}`}>{p.name}</option>)}
                      </select>
                      <input type="text" placeholder="Or type product name..." required className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium" value={item.productName} onChange={e => updateItem(index, 'productName', e.target.value)} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantity</label>
                    <input type="number" required className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</label>
                    <select className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium" value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rate (₹)</label>
                    <input type="number" required className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white font-medium" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} />
                  </div>
                  <div className="md:col-span-1 flex flex-col items-end">
                    <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-slate-300 hover:text-red-500 mb-1">✕</button>
                    <div className="text-right font-black text-slate-800 text-sm">₹{(Number(item.quantity || 0) * Number(item.rate || 0)).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-100 gap-6">
              <div className="flex space-x-4">
                <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-xl">
                  <p className="text-[10px] uppercase font-black opacity-50 tracking-widest mb-1">Current Bill</p>
                  <p className="text-3xl font-black">₹{currentTotal.toLocaleString()}</p>
                </div>
                {includePreviousBalance && (
                  <div className="bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-xl">
                    <p className="text-[10px] uppercase font-black opacity-50 tracking-widest mb-1">Total Outstanding</p>
                    <p className="text-3xl font-black">₹{grandTotalWithPrevious.toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <button type="button" onClick={() => { setShowAddForm(false); setFormData({ customerId: '', customerName: '', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0], category: 'General', paymentMethod: 'Cash', items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }] }); }} className="px-8 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">Discard</button>
                <button 
                  type="submit" 
                  disabled={formData.paymentMethod === 'Pending' && !formData.customerId}
                  className="px-12 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-allowed text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95"
                >
                  Save & Print Invoice
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-5">Date / Invoice</th>
                <th className="px-8 py-5">Customer Profile</th>
                <th className="px-8 py-5">Payment / Due</th>
                <th className="px-8 py-5 text-right">Amount (₹)</th>
                <th className="px-8 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sales.length > 0 ? data.sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <p className="text-xs font-bold text-slate-400 mb-1">{new Date(sale.date).toLocaleDateString()}</p>
                    <p className="font-black text-indigo-600 text-sm tracking-tight">{sale.invoiceNumber}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-800 text-sm">{sale.customerName}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Creator: {data.users.find(u => u.id === sale.createdBy)?.username || 'System'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${
                      sale.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      sale.paymentMethod === 'UPI' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-orange-50 text-orange-600 border-orange-100'
                    }`}>
                      {sale.paymentMethod || 'Cash'}
                    </span>
                    {sale.dueDate && sale.paymentMethod === 'Pending' && (
                      <p className="text-[10px] font-bold text-red-500 mt-1">Due: {new Date(sale.dueDate).toLocaleDateString()}</p>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-slate-800 text-right">₹{sale.totalAmount.toLocaleString()}</td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex items-center justify-center space-x-2">
                       <button 
                        onClick={() => handleDuplicate(sale)}
                        className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-indigo-100"
                        title="Create a new sale based on this one"
                      >
                        Duplicate
                      </button>
                      <span className={`text-[10px] font-black uppercase px-3 py-2 rounded-xl border ${sale.isMistake ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        {sale.isMistake ? 'Mistaken' : 'Success'}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => removeSale(sale.id)}
                          className="bg-red-50 text-red-400 hover:bg-red-600 hover:text-white p-2 rounded-xl transition-all active:scale-90 border border-red-100 group"
                          title="Remove Bill Permanently"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium italic">Start processing sales to see them here.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sales;
