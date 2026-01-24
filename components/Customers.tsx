
import React, { useState, useMemo } from 'react';
import { AppData, Customer, Sale, NavigationTab } from '../types';
import { IconAdd, IconPrint } from './Icons';

interface CustomersProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  onNavigateToInvoices?: (sale: Sale) => void;
}

type SummaryPeriod = 'week' | 'month' | 'year';
type IndividualPrintMode = 'full' | 'sales_only' | 'pending_only' | 'summary';
type PrintSize = 'A4' | 'Thermal80' | 'Thermal58';
type CustomerSortKey = 'name' | 'dues' | 'revenue' | 'date';
type SortDirection = 'asc' | 'desc';

const Customers: React.FC<CustomersProps> = ({ data, updateData, onNavigateToInvoices }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
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

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst: ''
  });

  const isAdmin = data.currentUser?.role === 'admin';

  // Revenue calculation helper used for sorting and global stats
  const getCustomerRevenue = (customerId: string) => {
    return (data.sales || [])
      .filter(s => s.customerId === customerId && !s.isMistake)
      .reduce((sum, s) => sum + s.totalAmount, 0);
  };

  const sortedAndFilteredCustomers = useMemo(() => {
    // 1. Filter
    const filtered = (data.customers || []).filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );

    // 2. Sort
    return [...filtered].sort((a, b) => {
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

  const summaryData = useMemo(() => {
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

    const validSales = (data.sales || []).filter(s => !s.isMistake);
    let filtered;
    
    if (summaryPeriod === 'week') {
      filtered = validSales.filter(s => s.date >= weekStartStr);
    } else if (summaryPeriod === 'month') {
      filtered = validSales.filter(s => s.date.startsWith(currentMonthStr));
    } else {
      filtered = validSales.filter(s => s.date.startsWith(currentYearStr));
    }

    const total = filtered.reduce((sum, s) => sum + s.totalAmount, 0);
    return { total, count: filtered.length, items: filtered };
  }, [data.sales, summaryPeriod]);

  const globalCustomerSummary = useMemo(() => {
    return (data.customers || []).map(c => {
      const totalSales = getCustomerRevenue(c.id);
      return {
        ...c,
        totalSalesRevenue: totalSales
      };
    }).sort((a, b) => b.totalSalesRevenue - a.totalSalesRevenue);
  }, [data.customers, data.sales]);

  const customerSales = useMemo(() => {
    if (!viewCustomer) return [];
    let filtered = (data.sales || []).filter(s => s.customerId === viewCustomer.id && !s.isMistake);
    if (indivPrintMode === 'pending_only') {
      filtered = filtered.filter(s => s.paymentMethod === 'Pending');
    }
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.sales, viewCustomer, indivPrintMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateData(prev => ({
        ...prev,
        customers: prev.customers.map(c => c.id === editingCustomer.id ? { ...c, ...formData } : c),
        sales: prev.sales.map(s => s.customerId === editingCustomer.id ? { ...s, customerName: formData.name } : s)
      }));
    } else {
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        ...formData,
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
        .sort((a, b) => a.date.localeCompare(b.date));

      for (let sale of pendingSales) {
        if (remainingPayment <= 0) break;
        if (remainingPayment >= sale.totalAmount) {
          remainingPayment -= sale.totalAmount;
          const saleIdx = updatedSales.findIndex(s => s.id === sale.id);
          if (saleIdx !== -1) {
            updatedSales[saleIdx] = { 
              ...updatedSales[saleIdx], 
              paymentMethod: 'Cash', 
              paidDate: paymentDate 
            };
          }
        } else {
          break;
        }
      }

      return {
        ...prev,
        sales: updatedSales,
        customers: prev.customers.map(c => 
          c.id === viewCustomer.id ? { ...c, pendingBalance: Math.max(0, c.pendingBalance - amountToClear) } : c
        )
      };
    });
    
    setViewCustomer(prev => prev ? { ...prev, pendingBalance: Math.max(0, prev.pendingBalance - amountToClear) } : null);
    setPaymentAmount('');
    alert('Payment settlement complete.');
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

  const handleQuickPrint = (customer: Customer, mode: IndividualPrintMode = 'full', size: PrintSize = 'A4') => {
    setIndivPrintMode(mode);
    setPrintSize(size);
    setIndivIncludeDues(true);
    setViewCustomer(customer);
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

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '', gst: '' });
  };

  const deleteCustomer = (id: string) => {
    if (!isAdmin) {
      alert("Only admins can delete customers.");
      return;
    }
    const customerToDelete = data.customers.find(c => c.id === id);
    if (!customerToDelete) return;

    if (window.confirm(`MOVE TO TRASH: Are you sure you want to delete "${customerToDelete.name}"?`)) {
      updateData(prev => ({
        ...prev,
        customers: prev.customers.filter(c => c.id !== id),
        recycleBin: {
          ...prev.recycleBin,
          customers: [...prev.recycleBin.customers, { ...customerToDelete, deletedAt: new Date().toISOString() }]
        },
        sales: prev.sales.map(s => s.customerId === id ? { ...s, customerId: undefined } : s)
      }));
    }
  };

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

  if (viewCustomer) {
    const isThermal = printSize === 'Thermal80' || printSize === 'Thermal58';
    const isThermal58 = printSize === 'Thermal58';

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <button onClick={() => setViewCustomer(null)} className="text-indigo-600 font-bold flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span>Back to List</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(['full', 'sales_only', 'pending_only', 'summary'] as IndividualPrintMode[]).map(m => (
                <button 
                  key={m}
                  onClick={() => setIndivPrintMode(m)} 
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${indivPrintMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >{m.replace('_', ' ')}</button>
              ))}
            </div>

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
              onClick={() => setIndivIncludeDues(!indivIncludeDues)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all ${indivIncludeDues ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
            >
              {indivIncludeDues ? '✓ With Net Dues' : 'Hide Net Dues'}
            </button>

            <button 
              onClick={() => window.print()}
              className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition-all active:scale-95 shadow-lg"
            >
              <IconPrint />
              <span>Print</span>
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
                  {indivPrintMode === 'sales_only' ? 'Sales Registry' : 
                   indivPrintMode === 'pending_only' ? 'Pending Dues' : 
                   indivPrintMode === 'summary' ? 'Account Summary' : 'Account Statement'}
                 </h2>
              </div>

              <div className="relative z-10 print:w-full print:text-left">
                <p className="hidden print:block text-[8px] font-black uppercase opacity-50">Customer Details</p>
                <h2 className={`${isThermal ? 'text-xl' : 'text-3xl'} font-black mb-2 uppercase`}>{viewCustomer.name}</h2>
                <div className="flex flex-wrap gap-4 text-sm font-medium opacity-80 print:text-[10px] print:opacity-100">
                  <span>📞 {viewCustomer.phone}</span>
                  {viewCustomer.gst && <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase print:border print:border-black print:text-black font-bold">GST: {viewCustomer.gst}</span>}
                </div>
              </div>
              
              {(indivIncludeDues || !window.matchMedia('print').matches) && (
                <div className={`text-right relative z-10 flex flex-col justify-center print:w-full print:text-center print:mt-4 ${!indivIncludeDues ? 'print:hidden' : ''}`}>
                  <div className="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm print:bg-slate-50 print:border-black print:text-black">
                      <p className="text-[10px] uppercase font-black opacity-50 tracking-[0.2em] mb-1 print:opacity-100">Net Outstanding</p>
                      <p className={`${isThermal ? 'text-3xl' : 'text-5xl'} font-black ${viewCustomer.pendingBalance > 0 ? 'text-red-400 print:text-black' : 'text-emerald-400 print:text-black'}`}>₹{viewCustomer.pendingBalance.toLocaleString()}</p>
                      <p className="hidden print:block text-[8px] font-bold mt-2">Statement Date: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`grid grid-cols-1 ${isThermal ? '' : 'lg:grid-cols-3'} gap-8 mt-8 p-8 pt-0 print:p-2`}>
                <div className={`lg:col-span-1 space-y-6 no-print`}>
                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-sm">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-200 pb-4">Quick Collection</h4>
                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Collection Date</label>
                                <input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-bold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Collected Amount (₹)</label>
                                <input type="number" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none font-black text-lg" placeholder="0.00" />
                            </div>
                            <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">Update Balance</button>
                        </form>
                    </div>
                </div>

                <div className={`${isThermal ? 'w-full' : 'lg:col-span-2'} bg-white rounded-3xl border border-slate-100 overflow-hidden print:border-none print:shadow-none print:w-full print:block`}>
                    {indivPrintMode !== 'summary' ? (
                      <>
                        <div className="px-8 py-4 bg-slate-50 border-b flex justify-between items-center print:bg-white print:border-black print:px-2">
                            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest print:text-[10px]">
                              {indivPrintMode === 'sales_only' ? 'Transaction History' : 
                               indivPrintMode === 'pending_only' ? 'Unpaid Items' : 'Ledger Entries'}
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm print:text-[10px] border-collapse">
                            <thead className="bg-slate-50/50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black print:border-black">
                                <tr>
                                <th className="px-8 py-4 print:px-2">Date</th>
                                <th className="px-8 py-4 print:px-2">Invoice</th>
                                {!isThermal && <th className="px-8 py-4 print:px-2">Mode</th>}
                                <th className="px-8 py-4 text-right print:px-2">Amount</th>
                                <th className="px-8 py-4 text-center no-print">View</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 print:divide-black">
                                {customerSales.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-4 font-bold text-slate-600 print:text-black print:px-2">
                                      {new Date(s.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-4 font-black text-indigo-600 tracking-tighter print:text-black print:px-2">#{s.invoiceNumber.split('-')[1]}</td>
                                    {!isThermal && (
                                      <td className="px-8 py-4">
                                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${
                                              s.paymentMethod === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                          } print:border-none`}>
                                              {s.paymentMethod}
                                          </span>
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
                            {indivIncludeDues && (
                              <tfoot>
                                <tr className="bg-slate-900 text-white print:bg-white print:text-black print:border-t-2 print:border-black">
                                  <td colSpan={isThermal ? 2 : 3} className="px-8 py-4 font-black uppercase text-right tracking-widest print:px-2 print:text-[12px]">Net Balanced Due</td>
                                  <td className="px-8 py-4 text-right font-black text-xl print:px-2 print:text-[14px]">₹{viewCustomer.pendingBalance.toLocaleString()}</td>
                                  <td className="no-print"></td>
                                </tr>
                              </tfoot>
                            )}
                            </table>
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
                              <p className="text-lg font-black text-slate-800">{customerSales[0] ? new Date(customerSales[0].date).toLocaleDateString() : 'Never'}</p>
                           </div>
                        </div>
                        <div className="pt-8 border-t border-slate-100 print:pt-4">
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">Verified by A M Food Processing Suite</p>
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
            <button onClick={() => setShowForm(true)} className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">
              <IconAdd /><span>Enroll Client</span>
            </button>
         </div>
      </div>

      {/* Global Sales Insight Bar */}
      {showSummary && (
        <div className="bg-indigo-900 text-white p-8 rounded-[40px] shadow-2xl border border-indigo-800 animate-in slide-in-from-top-4 duration-300 relative overflow-hidden no-print">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20 -mr-32 -mt-32"></div>
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                 <p className="text-indigo-300 font-black uppercase text-[10px] tracking-[0.4em] mb-2">Aggregate Revenue Report</p>
                 <div className="flex items-baseline space-x-4">
                    <h3 className="text-5xl font-black tracking-tighter">₹{summaryData.total.toLocaleString()}</h3>
                    <span className="text-indigo-300 font-bold uppercase text-xs">{summaryData.count} Transactions</span>
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
                <p className="text-[8px] text-slate-300 font-bold uppercase">Since {new Date(customer.createdAt).toLocaleDateString()}</p>
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
              <p className="text-[10px] mt-2 font-bold italic">Generated on: {new Date().toLocaleString()}</p>
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
                   <td className="p-3 text-right text-sm">₹{globalCustomerSummary.reduce((sum, c) => sum + c.totalSalesRevenue, 0).toLocaleString()}</td>
                   <td className="p-3 text-right text-sm">₹{globalCustomerSummary.reduce((sum, c) => sum + c.pendingBalance, 0).toLocaleString()}</td>
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
                  <input type="text" value={formData.gst} onChange={e => setFormData({ ...formData, gst: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" />
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
