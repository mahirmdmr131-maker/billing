
import React, { useState, useMemo } from 'react';
import { AppData, FutureOrder, SaleItem, Customer, Product, Sale } from '../types';
import { IconAdd, IconPrint } from './Icons';
import { printElement } from '../utils/printer';

interface FutureOrdersProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

type PrintSize = 'A4' | 'Thermal80' | 'Thermal58';
type SortKey = 'deliveryDate' | 'orderDate' | 'customerName';
type SortDirection = 'asc' | 'desc';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.split('T')[0].split('-').reverse().join('/');
};

const FutureOrders: React.FC<FutureOrdersProps> = ({ data, updateData }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<FutureOrder | null>(null);
  const [printSize, setPrintSize] = useState<PrintSize>('Thermal80');
  const [isLargeLogo, setIsLargeLogo] = useState(false);
  
  // Sorting State
  const [sortKey, setSortKey] = useState<SortKey>('deliveryDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: new Date().toISOString().split('T')[0],
    notificationTime: '',
    advancePaid: '0',
    items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }] as Partial<SaleItem>[]
  });

  const UNITS = ['kg', 'gram', 'no.', 'pkt', 'box', 'ltr', 'ml', 'bag', 'tin'];

  const calculateItemTotal = (qty: number, rate: number, unit: string) => {
    const q = Number(qty) || 0;
    const r = Number(rate) || 0;
    if (unit === 'gram' || unit === 'ml') return (q / 1000) * r;
    return q * r;
  };

  const currentTotal = formData.items.reduce((sum, i) => 
    sum + calculateItemTotal(Number(i.quantity || 0), Number(i.rate || 0), i.unit || 'kg'), 0
  );

  const resetForm = () => {
    setFormData({
      customerId: '',
      customerName: '',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date().toISOString().split('T')[0],
      notificationTime: '',
      advancePaid: '0',
      items: [{ productName: '', quantity: 1, unit: 'kg', rate: 0 }]
    });
    setShowForm(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalItems: SaleItem[] = formData.items.map(item => ({
      id: crypto.randomUUID(),
      productName: item.productName || 'Order Item',
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'kg',
      rate: Number(item.rate) || 0,
      total: calculateItemTotal(Number(item.quantity || 0), Number(item.rate || 0), item.unit || 'kg')
    }));

    const newOrder: FutureOrder = {
      id: crypto.randomUUID(),
      orderNumber: `ORD-${String(data.futureOrders.length + data.recycleBin.futureOrders.length + 1).padStart(5, '0')}`,
      customerName: formData.customerName || 'Customer',
      customerId: formData.customerId || undefined,
      orderDate: formData.orderDate,
      deliveryDate: formData.deliveryDate,
      notificationTime: formData.notificationTime || undefined,
      advancePaid: Number(formData.advancePaid) || 0,
      items: finalItems,
      totalAmount: finalItems.reduce((sum, i) => sum + i.total, 0),
      status: 'Pending',
      isNotified: false
    };

    updateData(prev => ({
      ...prev,
      futureOrders: [newOrder, ...prev.futureOrders]
    }));
    resetForm();
  };

  const deleteOrder = (id: string) => {
    if (!confirm('Cancel this order?')) return;
    updateData(prev => {
      const order = prev.futureOrders.find(o => o.id === id);
      if (!order) return prev;
      return {
        ...prev,
        futureOrders: prev.futureOrders.filter(o => o.id !== id),
        recycleBin: {
          ...prev.recycleBin,
          futureOrders: [...(prev.recycleBin.futureOrders || []), { ...order, deletedAt: new Date().toISOString() }]
        }
      };
    });
  };

  const convertToSale = (order: FutureOrder) => {
    if (!confirm('Convert this pre-order to a real sale/invoice? This will reduce stock.')) return;
    const newSale = {
      id: crypto.randomUUID(),
      invoiceNumber: `INV-FROM-ORD-${order.orderNumber.split('-')[1]}`,
      date: new Date().toISOString().split('T')[0],
      customerId: order.customerId,
      customerName: order.customerName,
      items: order.items,
      totalAmount: order.totalAmount,
      category: 'General',
      createdBy: data.currentUser?.id || 'System',
      paymentMethod: 'Pending' as const,
      isMistake: false
    };

    updateData(prev => {
      const updatedCustomers = prev.customers.map(c => 
        c.id === order.customerId ? { ...c, pendingBalance: (c.pendingBalance || 0) + order.totalAmount } : c
      );
      return {
        ...prev,
        sales: [newSale, ...prev.sales],
        futureOrders: prev.futureOrders.map(o => o.id === order.id ? { ...o, status: 'Delivered' as const } : o),
        customers: updatedCustomers
      };
    });
    alert('Order converted to Sale successfully.');
  };

  const markAllAsDelivered = () => {
    const pendingOrders = data.futureOrders.filter(o => o.status === 'Pending');
    if (pendingOrders.length === 0) {
      alert('No pending orders to process.');
      return;
    }

    if (!confirm(`Are you sure you want to mark all ${pendingOrders.length} pending orders as delivered? This will create sales invoices for all of them.`)) return;

    updateData(prev => {
      const newSales: Sale[] = pendingOrders.map(order => ({
        id: crypto.randomUUID(),
        invoiceNumber: `INV-FROM-ORD-${order.orderNumber.split('-')[1]}`,
        date: new Date().toISOString().split('T')[0],
        customerId: order.customerId,
        customerName: order.customerName,
        items: order.items,
        totalAmount: order.totalAmount,
        category: 'General',
        createdBy: prev.currentUser?.id || 'System',
        paymentMethod: 'Pending' as const,
        isMistake: false
      }));

      const updatedFutureOrders = prev.futureOrders.map(o => 
        o.status === 'Pending' ? { ...o, status: 'Delivered' as const } : o
      );

      let updatedCustomers = [...prev.customers];
      pendingOrders.forEach(order => {
        if (order.customerId) {
          updatedCustomers = updatedCustomers.map(c => 
            c.id === order.customerId ? { ...c, pendingBalance: (c.pendingBalance || 0) + order.totalAmount } : c
          );
        }
      });

      return {
        ...prev,
        sales: [...newSales, ...prev.sales],
        futureOrders: updatedFutureOrders,
        customers: updatedCustomers
      };
    });

    alert(`Batch processing complete: ${pendingOrders.length} orders marked as delivered.`);
  };

  const handlePrint = () => {
    printElement('future-orders-print-area', 'Future Orders Manifest');
  };

  const isThermal = printSize === 'Thermal80' || printSize === 'Thermal58';

  // Sorting Logic - Implemented per request
  const sortedOrders = useMemo(() => {
    return [...data.futureOrders].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'deliveryDate') {
        comparison = a.deliveryDate.localeCompare(b.deliveryDate);
      } else if (sortKey === 'orderDate') {
        comparison = a.orderDate.localeCompare(b.orderDate);
      } else if (sortKey === 'customerName') {
        comparison = a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data.futureOrders, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const SortButton: React.FC<{ label: string; keyName: SortKey }> = ({ label, keyName }) => (
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-6 rounded-3xl border border-slate-200 no-print">
        <div className="w-full lg:w-auto">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Future Orders & Quotes</h3>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1">Manage deliveries, advances and reminders</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-center lg:justify-end">
           <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-2xl border border-slate-100 overflow-x-auto max-w-full">
              <span className="text-[9px] font-black text-slate-400 uppercase ml-2 mr-1 shrink-0">Sort:</span>
              <SortButton label="Delivery" keyName="deliveryDate" />
              <SortButton label="Order Date" keyName="orderDate" />
              <SortButton label="Customer" keyName="customerName" />
           </div>
           
           <div className="flex gap-2">
             <button 
                onClick={markAllAsDelivered} 
                className="flex items-center space-x-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm transition-all active:scale-95 border border-emerald-100"
                title="Mark all pending as delivered"
              >
                <span>✓ All Delivered</span>
              </button>
              <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">
                <IconAdd /><span>New Quote</span>
              </button>
           </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-300 no-print">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 border-b border-slate-100 pb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer</label>
                <select className="w-full px-4 py-2 border rounded-xl outline-none" value={formData.customerId} onChange={e => {
                  const c = data.customers.find(cu => cu.id === e.target.value);
                  setFormData({...formData, customerId: e.target.value, customerName: c?.name || ''});
                }}>
                  <option value="">New/Guest Customer</option>
                  {data.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!formData.customerId && <input type="text" placeholder="Customer Name..." className="w-full mt-2 px-4 py-2 border rounded-xl outline-none" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />}
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery Date</label>
                <input type="date" required className="w-full px-4 py-2 border rounded-xl outline-none" value={formData.deliveryDate} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reminder Date/Time</label>
                <input type="datetime-local" className="w-full px-4 py-2 border rounded-xl outline-none" value={formData.notificationTime} onChange={e => setFormData({...formData, notificationTime: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Advance Paid (₹)</label>
                <input type="number" className="w-full px-4 py-2 border rounded-xl outline-none font-black text-indigo-600" value={formData.advancePaid} onChange={e => setFormData({...formData, advancePaid: e.target.value})} />
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Specification</h4>
                  <button type="button" onClick={handleAddItem} className="text-indigo-600 font-bold text-xs">+ Add Item</button>
               </div>
               {formData.items.map((item, index) => (
                 <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-2xl items-end border border-slate-100">
                    <div className="md:col-span-5">
                      <select className="w-full text-[10px] p-1 border rounded mb-2" onChange={e => updateItem(index, 'productName', e.target.value)} value="">
                        <option value="">Pick from Catalog...</option>
                        {data.products.map(p => <option key={p.id} value={`__PID:${p.id}`}>{p.name}</option>)}
                      </select>
                      <input type="text" placeholder="Item name..." required className="w-full px-4 py-2 border rounded-xl text-sm" value={item.productName} onChange={e => updateItem(index, 'productName', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                       <select className="w-full px-4 py-2 border rounded-xl text-sm" value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)}>
                         {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                       </select>
                    </div>
                    <div className="md:col-span-2">
                       <input type="number" step="any" placeholder="Qty" required className="w-full px-4 py-2 border rounded-xl text-sm" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                       <input type="number" step="any" placeholder="Rate" required className="w-full px-4 py-2 border rounded-xl text-sm" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} />
                    </div>
                    <div className="md:col-span-1 flex justify-center">
                       <button type="button" onClick={() => handleRemoveItem(index)} className="text-slate-300 hover:text-rose-500">✕</button>
                    </div>
                 </div>
               ))}
            </div>

            <div className="flex justify-between items-center pt-8 border-t">
               <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quoted Grand Total</p>
                  <p className="text-4xl font-black text-slate-800">₹{currentTotal.toLocaleString()}</p>
               </div>
               <div className="flex space-x-3">
                  <button type="button" onClick={resetForm} className="px-8 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest">Discard</button>
                  <button type="submit" className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-xl uppercase text-xs tracking-widest active:scale-95 transition-all">Save Pre-Order</button>
               </div>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Sorted Future Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
         {sortedOrders.map(order => (
           <div key={order.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 flex flex-col justify-between group hover:shadow-xl transition-all">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <div className="flex items-center space-x-2 mb-2">
                       <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase">#{order.orderNumber}</span>
                    </div>
                    <h4 className="text-2xl font-black text-slate-800 uppercase leading-none mb-1">{order.customerName}</h4>
                    <div className="flex flex-col space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery: <span className="text-indigo-600">{formatDate(order.deliveryDate)}</span></p>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Ordered: {formatDate(order.orderDate)}</p>
                    </div>
                 </div>
                 <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setSelectedOrder(order)} className="p-3 bg-slate-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><IconPrint /></button>
                    <button onClick={() => deleteOrder(order.id)} className="p-3 bg-slate-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all">✕</button>
                 </div>
              </div>

              <div className="space-y-3 mb-8">
                 {order.items.slice(0, 2).map((it, idx) => (
                   <div key={idx} className="flex justify-between text-xs font-medium text-slate-600">
                      <span>{it.quantity}{it.unit} x {it.productName}</span>
                      <span>₹{it.total.toLocaleString()}</span>
                   </div>
                 ))}
                 {order.items.length > 2 && <p className="text-[10px] text-slate-400 font-bold italic">+ {order.items.length - 2} more items</p>}
              </div>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Value</p>
                       <p className="text-lg font-black text-slate-800">₹{order.totalAmount.toLocaleString()}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Advance</p>
                       <p className="text-lg font-black text-indigo-600">₹{order.advancePaid.toLocaleString()}</p>
                    </div>
                 </div>
                 {order.status === 'Pending' && (
                   <button onClick={() => convertToSale(order)} className="px-6 py-2 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-xl shadow-lg active:scale-95 transition-all">Mark Delivered</button>
                 )}
              </div>
           </div>
         ))}
         {data.futureOrders.length === 0 && (
           <div className="lg:col-span-2 py-20 text-center bg-white rounded-[50px] border border-slate-100">
              <p className="text-slate-300 font-black uppercase text-sm tracking-[0.3em]">No future orders logged</p>
           </div>
         )}
      </div>

      {/* Quote Printing Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[50px] shadow-2xl overflow-hidden p-10 no-print">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-black uppercase tracking-tight">Quotation Printer</h3>
                 <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Paper Format</label>
                    <select value={printSize} onChange={e => setPrintSize(e.target.value as PrintSize)} className="w-full p-3 bg-slate-50 rounded-2xl outline-none font-bold text-sm">
                       <option value="A4">A4 Full Page</option>
                       <option value="Thermal80">80mm Thermal</option>
                       <option value="Thermal58">58mm Mobile</option>
                    </select>
                 </div>
                 <div className="flex items-end">
                    <button 
                      onClick={() => setIsLargeLogo(!isLargeLogo)}
                      className={`w-full p-3 rounded-2xl font-black text-[10px] uppercase transition-all ${isLargeLogo ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {isLargeLogo ? '✓ Large Logo' : 'Small Logo'}
                    </button>
                 </div>
              </div>

              <button onClick={handlePrint} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-2xl transition-all active:scale-95 flex items-center justify-center space-x-3 text-lg uppercase tracking-widest">
                 <IconPrint className="w-6 h-6" />
                 <span>Print Quotation</span>
              </button>
           </div>

           {/* PRINT ONLY CONTENT */}
           <div id="future-orders-print-area" className={`print-only hidden print:block bg-white text-black transition-all duration-300 ${printSize === 'Thermal58' ? 'max-w-[280px] p-2 text-[10px]' : printSize === 'Thermal80' ? 'max-w-[360px] p-4 text-xs' : 'max-w-full p-12 text-sm'} mx-auto`} style={{ fontFamily: isThermal ? 'monospace' : 'sans-serif' }}>
              <div className="border-2 border-black p-4">
                 <div className="text-center mb-6 pb-4 border-b-2 border-black">
                    {data.business?.logo && <img src={data.business.logo} alt="Logo" className={`${isLargeLogo ? 'w-48' : 'w-24'} mx-auto mb-4 object-contain`} />}
                    <h1 className={`${isThermal ? 'text-lg' : 'text-3xl'} font-black uppercase`}>{data.business?.name}</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest">{data.business?.tagline}</p>
                    <div className="mt-2 text-[10px] font-medium leading-tight">
                        <p>{data.business?.address}</p>
                        <p>Ph: {data.business?.phone}</p>
                        {data.business?.gst && <p className="font-bold">GSTIN: {data.business.gst}</p>}
                    </div>
                    <h2 className="mt-4 border-y border-black py-1 font-black uppercase text-sm">Official Quotation</h2>
                 </div>

                 <div className="flex justify-between mb-4 text-[10px] font-bold uppercase">
                    <div className="text-left">
                       <p className="opacity-50">Customer</p>
                       <p className="text-lg">{selectedOrder.customerName}</p>
                    </div>
                    <div className="text-right">
                       <p className="opacity-50">Quote #</p>
                       <p>{selectedOrder.orderNumber}</p>
                       <p>Exp. Delivery: {formatDate(selectedOrder.deliveryDate)}</p>
                    </div>
                 </div>

                 <table className="w-full mb-6 text-left border-collapse">
                    <thead className="border-y-2 border-black">
                       <tr className="uppercase font-black text-[10px]">
                          <th className="py-2">Product</th>
                          <th className="py-2 text-center">Qty</th>
                          <th className="py-2 text-right">Amt</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                       {selectedOrder.items.map((item, idx) => (
                          <tr key={idx} className="font-bold">
                             <td className="py-2 uppercase">{item.productName}</td>
                             <td className="py-2 text-center">{item.quantity}{item.unit}</td>
                             <td className="py-2 text-right">₹{item.total.toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>

                 <div className="ml-auto w-full md:w-1/2 space-y-1 pt-4">
                    <div className="flex justify-between font-bold">
                       <span className="uppercase opacity-50">Grand Total</span>
                       <span className="text-xl">₹{selectedOrder.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-indigo-600">
                       <span className="uppercase opacity-50">Advance Paid</span>
                       <span className="text-lg">₹{selectedOrder.advancePaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-black border-t-2 border-black pt-1">
                       <span className="uppercase">Net Balance</span>
                       <span className="text-xl">₹{(selectedOrder.totalAmount - selectedOrder.advancePaid).toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="mt-12 text-center border-t border-black pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest">Authorized Quote - A M Food Processing</p>
                    <p className="text-[8px] mt-2 italic font-medium opacity-60">* This quote is valid for 7 days from {new Date().toLocaleDateString('en-GB')} *</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          .print-only, .print-only * { visibility: visible !important; }
          .print-only { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; display: block !important; }
          @page { margin: 0; }
        }
      `}} />
    </div>
  );
};

export default FutureOrders;
