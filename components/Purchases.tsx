import React, { useState } from 'react';
import { Purchase, PurchaseItem, AppData, Product, Supplier, PaymentMethod } from '../types';
import { IconTrash, IconEdit, IconPrint, IconTruck, IconAdd } from './Icons';

interface PurchasesProps {
  data: AppData;
  updateData: (newData: Partial<AppData>) => void;
}

export const Purchases: React.FC<PurchasesProps> = ({ data, updateData }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(0);

  const purchases = data.purchases || [];
  const suppliers = data.suppliers || [];
  const products = data.products || [];

  const handleAddItem = () => {
    if (!selectedProduct || qty <= 0 || rate < 0) return;
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const newItem: PurchaseItem = {
      id: 'pitem_' + Date.now(),
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unit: product.unit,
      rate: rate,
      total: qty * rate
    };

    setItems([...items, newItem]);
    setSelectedProduct('');
    setQty(1);
    setRate(0);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const handleSavePurchase = () => {
    if (items.length === 0 || !selectedSupplier || !invoiceNumber) return;

    const supplier = suppliers.find(s => s.id === selectedSupplier);
    if (!supplier) return;

    const newPurchase: Purchase = {
      id: 'purch_' + Date.now(),
      invoiceNumber,
      date: new Date().toISOString(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierContact: supplier.phone,
      items,
      totalAmount,
      paymentMethod,
      createdBy: data.currentUser?.username || 'Admin'
    };

    // Update inventory stock
    const updatedProducts = products.map(p => {
      const purchasedItem = items.find(i => i.productId === p.id);
      if (purchasedItem) {
        return { ...p, currentStock: (p.currentStock || 0) + purchasedItem.quantity };
      }
      return p;
    });

    // Update supplier balance if pending
    let updatedSuppliers = suppliers;
    if (paymentMethod === 'Pending') {
      updatedSuppliers = suppliers.map(s => 
        s.id === supplier.id ? { ...s, pendingBalance: (s.pendingBalance || 0) + totalAmount } : s
      );
    }

    updateData({ 
      purchases: [newPurchase, ...purchases],
      products: updatedProducts,
      suppliers: updatedSuppliers
    });

    setItems([]);
    setInvoiceNumber('');
    setSelectedSupplier('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Purchase Invoices</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manage Inward Stock & Payables</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
        >
          {showAddForm ? <span>Cancel Entry</span> : <><IconAdd className="w-5 h-5" /><span>New Purchase</span></>}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 animate-in slide-in-from-top-4 duration-300 space-y-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <IconTruck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Purchase Entry</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Log inward materials</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Invoice Number *</label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" placeholder="e.g. INV-1002" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Supplier *</label>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase text-sm">
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase text-sm">
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / Bank</option>
                <option value="Pending">Pending (Credit)</option>
              </select>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Add Item to Invoice</h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Product</label>
                <select value={selectedProduct} onChange={e => {
                  setSelectedProduct(e.target.value);
                  const p = products.find(prod => prod.id === e.target.value);
                  if (p) setRate(p.defaultRate);
                }} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase text-sm">
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantity</label>
                <input type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-sm" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Purchase Rate (₹)</label>
                <input type="number" min="0" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-600 text-sm" />
              </div>
              <div className="md:col-span-2">
                <button onClick={handleAddItem} className="w-full bg-slate-800 text-white px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-700 transition-colors shadow-md">
                  Add Item
                </button>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border border-slate-200 rounded-[24px] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Item</th>
                    <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Qty</th>
                    <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Rate</th>
                    <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Total</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-sm uppercase text-slate-700">{item.productName}</td>
                      <td className="p-4 font-bold text-sm">{item.quantity} {item.unit}</td>
                      <td className="p-4 font-bold text-sm">₹{item.rate}</td>
                      <td className="p-4 font-black text-indigo-600 text-right">₹{item.total.toLocaleString()}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-rose-50"><IconTrash className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={3} className="p-4 text-right font-black uppercase text-[10px] tracking-widest text-slate-500">Grand Total</td>
                    <td colSpan={2} className="p-4 text-2xl font-black text-indigo-600">₹{totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button 
              onClick={handleSavePurchase}
              disabled={items.length === 0 || !selectedSupplier || !invoiceNumber}
              className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 shadow-xl transition-all active:scale-95 flex items-center space-x-2"
            >
              <span>Save Purchase Entry</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-50 bg-slate-50/50">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recent Purchases</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-100">
              <tr>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Invoice #</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Supplier</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Amount</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {purchases.map(purchase => (
                <tr key={purchase.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 font-bold text-slate-500 text-sm">{new Date(purchase.date).toLocaleDateString()}</td>
                  <td className="p-4 font-black text-slate-700 text-sm">{purchase.invoiceNumber}</td>
                  <td className="p-4 font-bold uppercase text-sm">{purchase.supplierName}</td>
                  <td className="p-4 font-black text-slate-800 text-right">₹{purchase.totalAmount.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      purchase.paymentMethod === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {purchase.paymentMethod}
                    </span>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    No purchases recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};