import React, { useState } from 'react';
import { AppData, Expense } from '../types';
import { IconAdd, IconPrint } from './Icons';
import { printElement } from '../utils/printer';
import { saveOrDownloadFile } from '../utils/fileSaver';

interface ExpensesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.split('-').reverse().join('/');
};

const Expenses: React.FC<ExpensesProps> = ({ data, updateData }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [printTarget, setPrintTarget] = useState<'single' | 'all' | null>(null);
  const [activePrintExpense, setActivePrintExpense] = useState<Expense | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    category: 'Materials',
    description: '',
    amount: '',
    paidAmount: '',
    paymentMethod: 'Cash'
  });

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      category: 'Materials',
      description: '',
      amount: '',
      paidAmount: '',
      paymentMethod: 'Cash'
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      dueDate: expense.dueDate || expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      paidAmount: expense.paidAmount?.toString() || '',
      paymentMethod: expense.paymentMethod || 'Cash'
    });
    setShowForm(true);
  };

  const handlePrintSingle = (expense: Expense) => {
    setPrintTarget('single');
    setActivePrintExpense(expense);
    setTimeout(() => {
      printElement('expense-print-area', `Expense Voucher - ${expense.category}`);
      setPrintTarget(null);
      setActivePrintExpense(null);
    }, 150);
  };

  const handlePrintAll = () => {
    setPrintTarget('all');
    setTimeout(() => {
      printElement('expense-print-area', 'Expense Ledger');
      setPrintTarget(null);
    }, 150);
  };

  const exportToCSV = async () => {
    const rows = [
      ['Expense Report - A M Food Processing'],
      ['Export Date', new Date().toLocaleString()],
      [''],
      ['Date', 'Category', 'Description', 'Total Amount', 'Paid', 'Balance', 'Method']
    ];

    data.expenses.forEach(e => {
      rows.push([
        formatDate(e.date), 
        e.category, 
        e.description, 
        e.amount.toString(),
        (e.paidAmount || 0).toString(),
        (e.balance || 0).toString(),
        e.paymentMethod || 'Cash'
      ]);
    });

    const csvString = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const filename = `AM_Food_Expenses_${new Date().toISOString().split('T')[0]}.csv`;
    await saveOrDownloadFile(filename, csvString, 'text/csv');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(formData.amount) || 0;
    const paid = Number(formData.paidAmount) || 0;
    
    const expenseData = {
      date: formData.date,
      dueDate: formData.dueDate,
      category: formData.category,
      description: formData.description,
      amount: total,
      paidAmount: paid,
      balance: Math.max(0, total - paid),
      paymentMethod: formData.paymentMethod
    };

    if (editingExpense) {
      updateData(prev => ({
        ...prev,
        expenses: prev.expenses.map(e => e.id === editingExpense.id ? { ...e, ...expenseData } : e)
      }));
    } else {
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        ...expenseData
      };
      updateData(prev => ({
        ...prev,
        expenses: [newExpense, ...prev.expenses]
      }));
    }

    resetForm();
  };

  const deleteExpense = (id: string) => {
    if (!confirm('Move this expense to Recycle Bin?')) return;
    updateData(prev => {
        const expense = prev.expenses.find(e => e.id === id);
        if (!expense) return prev;
        return {
            ...prev,
            expenses: prev.expenses.filter(e => e.id !== id),
            recycleBin: {
                ...prev.recycleBin,
                expenses: [...prev.recycleBin.expenses, { ...expense, deletedAt: new Date().toISOString() }]
            }
        };
    });
  };

  const totalExpenseAmount = data.expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 gap-4">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Expense Registry</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95"
          >
            <span>Excel Export</span>
          </button>
          <button
            onClick={handlePrintAll}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95"
          >
            <IconPrint className="w-3 h-3" />
            <span>PDF Export</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95"
          >
            <IconAdd className="w-3 h-3" />
            <span>Record Entry</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-300 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600"></div>
          <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingExpense ? 'Update Record' : 'New Expense Profile'}</h4>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Operational Outflow Tracking</p>
            </div>
            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Entry Date</label>
                    <input type="date" required className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none bg-slate-50 font-bold focus:ring-2 focus:ring-red-500 transition-all" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Due Date (Optional)</label>
                    <input type="date" className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none bg-slate-50 font-bold focus:ring-2 focus:ring-red-500 transition-all" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Operational Category</label>
                  <div className="flex flex-wrap gap-2">
                    {['Materials', 'Rent', 'Labor', 'Electricity', 'Packaging', 'Transportation', 'Misc'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat })}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          formData.category === cat 
                            ? 'bg-red-600 text-white border-red-700 shadow-lg shadow-red-200 scale-105' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-600'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    required 
                    placeholder="Describe the transaction (e.g., Raw material purchase from vendor X)..." 
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none bg-slate-50 font-bold focus:ring-2 focus:ring-red-500 transition-all min-h-[100px] resize-none" 
                    value={formData.description} 
                    onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  />
                </div>
              </div>

              <div className="space-y-6 bg-slate-50/50 p-6 rounded-[32px] border border-slate-100">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit'].map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: method })}
                        className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                          formData.paymentMethod === method 
                            ? 'bg-slate-900 text-white border-black shadow-lg' 
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Bill Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">₹</span>
                      <input type="number" required placeholder="0.00" className="w-full pl-10 pr-4 py-4 border border-slate-200 rounded-2xl outline-none bg-white font-black text-2xl text-slate-800 focus:ring-2 focus:ring-red-500 transition-all" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Paid Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-400 text-lg">₹</span>
                      <input type="number" placeholder="0.00" className="w-full pl-10 pr-4 py-4 border-2 border-emerald-100 rounded-2xl outline-none bg-emerald-50/30 font-black text-2xl text-emerald-700 focus:ring-2 focus:ring-emerald-500 transition-all" value={formData.paidAmount} onChange={e => setFormData({ ...formData, paidAmount: e.target.value })} />
                    </div>
                    {formData.amount && formData.paidAmount && Number(formData.amount) > Number(formData.paidAmount) && (
                      <p className="mt-2 text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Remaining Balance: ₹{(Number(formData.amount) - Number(formData.paidAmount)).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <button type="button" onClick={resetForm} className="px-8 py-4 text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] hover:text-slate-800 transition-colors">Discard Changes</button>
              <button type="submit" className="px-12 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-100 transition-all active:scale-95 uppercase text-[10px] tracking-[0.2em]">
                {editingExpense ? 'Update Registry' : 'Commit Transaction'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Category</th>
                <th className="px-8 py-5">Description</th>
                <th className="px-8 py-5">Method</th>
                <th className="px-8 py-5 text-right">Amount (₹)</th>
                <th className="px-8 py-5 text-right">Balance</th>
                <th className="px-8 py-5 text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.expenses.length > 0 ? data.expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-5 text-xs font-bold text-slate-500">{formatDate(expense.date)}</td>
                  <td className="px-8 py-5 text-sm">
                    <span className="px-2 py-1 bg-red-50 rounded-md text-[9px] font-black text-red-600 uppercase tracking-tighter border border-red-100">{expense.category}</span>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-700">{expense.description}</td>
                  <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">{expense.paymentMethod || 'Cash'}</td>
                  <td className="px-8 py-5 text-sm font-black text-red-600 text-right">₹{expense.amount.toLocaleString()}</td>
                  <td className={`px-8 py-5 text-xs font-black text-right ${expense.balance && expense.balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {expense.balance && expense.balance > 0 ? `Due: ₹${expense.balance.toLocaleString()}` : 'Cleared'}
                  </td>
                  <td className="px-8 py-5 text-center no-print">
                     <div className="flex justify-center space-x-1">
                        <button onClick={() => handleEdit(expense)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl transition-all" title="Edit"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                        <button onClick={() => deleteExpense(expense.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl transition-all" title="Delete"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        <button onClick={() => handlePrintSingle(expense)} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-xl transition-all" title="Print"><IconPrint className="w-4 h-4" /></button>
                     </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-8 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">No records in registry</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Print Layouts */}
      {printTarget === 'single' && activePrintExpense && (
        <div id="expense-print-area" className="print-only hidden print:block bg-white text-black p-12" style={{ fontFamily: 'monospace' }}>
           <div className="border-2 border-black p-8">
              <div className="text-center mb-8 border-b-2 border-black pb-4">
                 {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-24 mx-auto mb-4 object-contain" />}
                 <h1 className="text-3xl font-black uppercase">{data.business?.name}</h1>
                 <p className="text-[10px] font-bold uppercase tracking-widest">{data.business?.tagline}</p>
                 <p className="text-xs mt-2">EXPENSE DEBIT VOUCHER</p>
              </div>
              <div className="flex justify-between mb-8 text-sm">
                 <div><strong>Category:</strong> {activePrintExpense.category}</div>
                 <div><strong>Date:</strong> {formatDate(activePrintExpense.date)}</div>
              </div>
              <div className="mb-12">
                 <p className="text-xs uppercase text-slate-500 font-black mb-1">Transaction Details</p>
                 <p className="text-lg font-bold">{activePrintExpense.description}</p>
                 <p className="text-xs mt-1">Paid via: {activePrintExpense.paymentMethod || 'Cash'}</p>
              </div>
              <div className="text-right border-t-2 border-black pt-4">
                 <p className="text-xs font-black uppercase">Total Amount</p>
                 <p className="text-4xl font-black">₹{activePrintExpense.amount.toLocaleString()}</p>
                 {activePrintExpense.balance && activePrintExpense.balance > 0 && (
                     <p className="text-xs font-bold mt-1">Outstanding Balance: ₹{activePrintExpense.balance.toLocaleString()}</p>
                 )}
              </div>
              <div className="mt-24 flex justify-between px-4">
                 <div className="border-t border-black w-32 pt-2 text-[10px] text-center font-bold">MANAGER SIGN</div>
                 <div className="border-t border-black w-32 pt-2 text-[10px] text-center font-bold">RECEIVER SIGN</div>
              </div>
           </div>
        </div>
      )}

      {printTarget === 'all' && (
        <div id="expense-print-area" className="print-only hidden print:block bg-white text-black p-10" style={{ fontFamily: 'sans-serif' }}>
           <div className="text-center mb-10 border-b-2 border-black pb-6">
              {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-24 mx-auto mb-4 object-contain" />}
              <h1 className="text-3xl font-black uppercase">{data.business?.name}</h1>
              <h2 className="text-lg font-bold uppercase tracking-widest">Complete Expense Ledger</h2>
              <p className="text-xs mt-2">Generated on: {new Date().toLocaleString('en-GB')}</p>
           </div>
           <table className="w-full border-collapse">
              <thead>
                 <tr className="bg-slate-100 border-y-2 border-black">
                    <th className="p-2 text-left text-xs uppercase font-black">Date</th>
                    <th className="p-2 text-left text-xs uppercase font-black">Category</th>
                    <th className="p-2 text-left text-xs uppercase font-black">Description</th>
                    <th className="p-2 text-right text-xs uppercase font-black">Amount</th>
                 </tr>
              </thead>
              <tbody>
                 {data.expenses.map((e, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                       <td className="p-2 text-xs">{formatDate(e.date)}</td>
                       <td className="p-2 text-xs font-bold uppercase">{e.category}</td>
                       <td className="p-2 text-xs">{e.description}</td>
                       <td className="p-2 text-xs text-right font-bold">₹{e.amount.toLocaleString()}</td>
                    </tr>
                 ))}
              </tbody>
              <tfoot>
                 <tr className="bg-slate-100 font-black border-t-2 border-black">
                    <td colSpan={3} className="p-3 text-right uppercase text-sm">Consolidated Total Outflow</td>
                    <td className="p-3 text-right text-lg">₹{totalExpenseAmount.toLocaleString()}</td>
                 </tr>
              </tfoot>
           </table>
           <div className="mt-20 text-center text-[10px] font-bold text-gray-500 italic">
              * This is a computer generated report from A M Food Processing Management Suite *
           </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;