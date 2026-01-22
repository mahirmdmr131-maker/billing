
import React, { useState, useMemo } from 'react';
import { AppData, Customer, Sale } from '../types';
import { IconAdd } from './Icons';

interface CustomersProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const Customers: React.FC<CustomersProps> = ({ data, updateData }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst: ''
  });

  const filteredCustomers = useMemo(() => {
    return data.customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );
  }, [data.customers, searchTerm]);

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
    
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    updateData(prev => ({
      ...prev,
      customers: prev.customers.map(c => 
        c.id === viewCustomer.id ? { ...c, pendingBalance: Math.max(0, c.pendingBalance - amount) } : c
      )
    }));
    
    setViewCustomer(prev => prev ? { ...prev, pendingBalance: Math.max(0, prev.pendingBalance - amount) } : null);
    setPaymentAmount('');
    alert('Payment recorded successfully!');
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

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '', gst: '' });
  };

  const deleteCustomer = (id: string) => {
    const customerToDelete = data.customers.find(c => c.id === id);
    if (!customerToDelete) return;

    if (confirm('Move this customer profile to Recycle Bin? Historic sales will be kept but unlinked.')) {
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

  const handlePrintPending = () => {
    window.print();
  };

  if (viewCustomer) {
    const customerSales = data.sales.filter(s => s.customerId === viewCustomer.id);
    const totalSpent = customerSales.reduce((sum, s) => sum + s.totalAmount, 0);

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="no-print flex items-center justify-between">
          <button onClick={() => setViewCustomer(null)} className="text-indigo-600 font-bold flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-xl">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span>Back to Customers</span>
          </button>
          <button 
            onClick={handlePrintPending}
            className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            <span>Print Pending Summary</span>
          </button>
        </div>
        
        <div className="print-area bg-white md:bg-transparent md:shadow-none shadow-sm rounded-3xl p-0">
          <div className="bg-indigo-900 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between gap-6 relative overflow-hidden print:bg-white print:text-black print:shadow-none print:border-b-2 print:border-black print:rounded-none">
            <div className="hidden print:block text-center w-full mb-6">
               {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-24 h-24 mx-auto mb-2 object-contain" />}
               <h1 className="text-xl font-black uppercase">{data.business?.name}</h1>
               <p className="text-[10px] opacity-70 italic">{data.business?.tagline}</p>
               <p className="text-[10px] font-bold mt-2">{data.business?.address} | Ph: {data.business?.phone}</p>
               <h2 className="text-lg font-black mt-4 border-y border-black py-1 uppercase tracking-widest">Account Statement</h2>
            </div>

            <div className="relative z-10 print:w-1/2 print:text-left">
              <p className="hidden print:block text-[8px] font-black uppercase opacity-50">Customer Details</p>
              <h2 className="text-3xl font-black mb-2 print:text-xl">{viewCustomer.name}</h2>
              <div className="flex flex-wrap gap-4 text-sm font-medium opacity-80 print:text-[10px] print:opacity-100">
                <span>📞 {viewCustomer.phone}</span>
                {viewCustomer.email && <span>✉️ {viewCustomer.email}</span>}
                {viewCustomer.gst && <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase print:border print:border-black print:text-black">GST: {viewCustomer.gst}</span>}
              </div>
              <p className="mt-4 text-xs opacity-60 max-w-md print:opacity-100 print:text-[8px]">{viewCustomer.address || 'No address provided'}</p>
            </div>
            
            <div className="text-right relative z-10 flex flex-col justify-center print:w-1/2">
              <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm print:bg-slate-50 print:border-black print:text-black">
                  <p className="text-[10px] uppercase font-black opacity-50 tracking-[0.2em] mb-1 print:opacity-100">Current Balance Due</p>
                  <p className={`text-5xl font-black print:text-3xl ${viewCustomer.pendingBalance > 0 ? 'text-red-400 print:text-black' : 'text-emerald-400 print:text-black'}`}>₹{viewCustomer.pendingBalance.toLocaleString()}</p>
                  <p className="hidden print:block text-[8px] font-bold mt-2">Statement Generated: {new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              <div className="lg:col-span-1 space-y-6 no-print">
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b pb-4">Record Payment</h4>
                      <form onSubmit={handleRecordPayment} className="space-y-4">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Amount Received (₹)</label>
                              <input 
                                  type="number" 
                                  required
                                  value={paymentAmount}
                                  onChange={e => setPaymentAmount(e.target.value)}
                                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-lg"
                                  placeholder="0.00"
                              />
                          </div>
                          <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-widest">
                              Settle Payment
                          </button>
                      </form>
                  </div>
              </div>

              <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none print:w-full print:block">
                  <div className="px-8 py-4 bg-slate-50 border-b flex justify-between items-center print:bg-white print:border-black">
                      <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest print:text-sm">Transaction Summary</h4>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm print:text-xs">
                      <thead className="bg-slate-50/50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black print:border-black">
                          <tr>
                          <th className="px-8 py-4">Date</th>
                          <th className="px-8 py-4">Invoice #</th>
                          <th className="px-8 py-4">Mode</th>
                          <th className="px-8 py-4 text-right">Amount</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 print:divide-black">
                          {customerSales.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                              <td className="px-8 py-4 font-medium text-slate-600 print:text-black">{new Date(s.date).toLocaleDateString()}</td>
                              <td className="px-8 py-4"><span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded print:bg-transparent print:text-black print:p-0 print:border-b">#{s.invoiceNumber.split('-')[1]}</span></td>
                              <td className="px-8 py-4">
                                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${
                                      s.paymentMethod === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                  } print:border-none print:bg-transparent print:text-black`}>
                                      {s.paymentMethod || 'Cash'}
                                  </span>
                              </td>
                              <td className="px-8 py-4 text-right font-black text-slate-800 print:text-black">₹{s.totalAmount.toLocaleString()}</td>
                          </tr>
                          ))}
                          {customerSales.length === 0 && (
                          <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium print:text-black">No recent history.</td></tr>
                          )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-900 text-white print:bg-white print:text-black print:border-t-2 print:border-black">
                          <td colSpan={3} className="px-8 py-4 font-black uppercase text-right tracking-widest">Final Outstanding</td>
                          <td className="px-8 py-4 text-right font-black text-lg">₹{viewCustomer.pendingBalance.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                      </table>
                  </div>
              </div>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%; 
              background: white !important;
            }
            .no-print { display: none !important; }
            @page { margin: 1cm; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
           <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           <input 
             type="text" 
             placeholder="Search by name or phone..." 
             className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95"
        >
          <IconAdd />
          <span>New Customer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => {
          return (
            <div key={customer.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl border border-indigo-100 shadow-inner">
                  {customer.name.charAt(0)}
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(customer)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => deleteCustomer(customer.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <h4 className="text-lg font-black text-slate-800 mb-1 truncate">{customer.name}</h4>
              <p className="text-sm text-slate-500 mb-6 font-bold flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1.01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                {customer.phone}
              </p>
              
              <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                <div>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-0.5">Due Balance</p>
                  <p className={`text-base font-black ${customer.pendingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{customer.pendingBalance?.toLocaleString() || 0}</p>
                </div>
                <button 
                  onClick={() => setViewCustomer(customer)} 
                  className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-full hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                >
                  Manage Dues
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Customers;
