
import React, { useState } from 'react';
import { AppData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { IconPrint } from './Icons';

interface ReportsProps {
  data: AppData;
}

const Reports: React.FC<ReportsProps> = ({ data }) => {
  const [reportRange, setReportRange] = useState('All Time');
  const [isPrinting, setIsPrinting] = useState(false);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Calculate stats
  const totalSales = data.sales.filter(s => !s.isMistake).reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;

  // Monthly breakdown
  const monthlyData: any[] = [];
  const monthMap = new Map();

  data.sales.filter(s => !s.isMistake).forEach(s => {
    const month = s.date.substring(0, 7); // YYYY-MM
    if (!monthMap.has(month)) monthMap.set(month, { month, sales: 0, expenses: 0 });
    monthMap.get(month).sales += s.totalAmount;
  });

  data.expenses.forEach(e => {
    const month = e.date.substring(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, { month, sales: 0, expenses: 0 });
    monthMap.get(month).expenses += e.amount;
  });

  const sortedMonths = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // Expense Categories
  const expenseCategories: any[] = [];
  const expCatMap = new Map();
  data.expenses.forEach(e => {
    expCatMap.set(e.category, (expCatMap.get(e.category) || 0) + e.amount);
  });
  expCatMap.forEach((value, name) => expenseCategories.push({ name, value }));

  const exportToCSV = () => {
    const rows = [
      ['Report: A M Food Processing Financials'],
      ['Export Date', new Date().toLocaleString()],
      [''],
      ['SUMMARY'],
      ['Total Sales', totalSales],
      ['Total Expenses', totalExpenses],
      ['Net Profit', profit],
      [''],
      ['MONTHLY DATA'],
      ['Month', 'Sales', 'Expenses', 'Profit']
    ];

    sortedMonths.forEach(m => {
      rows.push([m.month, m.sales, m.expenses, m.sales - m.expenses]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AM_Food_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handlePrintReport = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 gap-4">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Business Intelligence</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md flex items-center space-x-2 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Excel Export</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md flex items-center space-x-2 transition-all active:scale-95"
          >
            <IconPrint className="w-4 h-4" />
            <span>PDF Export</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 no-print">
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-200">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Sales vs Expenses (Monthly)</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedMonths}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                <Bar dataKey="sales" fill="#6366f1" radius={[8, 8, 0, 0]} name="Sales" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[8, 8, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-200">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Expense Distribution</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {expenseCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="outline-none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-indigo-900 rounded-[50px] p-10 text-white shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500 rounded-full blur-[120px] opacity-20 -mr-[150px] -mt-[150px]"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h4 className="text-indigo-300 uppercase tracking-[0.4em] font-black text-[10px]">Net Enterprise Profit</h4>
            <p className="text-5xl font-black tracking-tight">₹{profit.toLocaleString()}</p>
            <p className="text-indigo-400 text-xs font-bold mt-1">Total operational yield after overheads</p>
          </div>
          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="text-emerald-400 font-black text-3xl tracking-tight">₹{totalSales.toLocaleString()}</p>
              <p className="text-indigo-300 text-[10px] uppercase font-black tracking-widest mt-1">Gross Revenue</p>
            </div>
            <div>
              <p className="text-rose-400 font-black text-3xl tracking-tight">₹{totalExpenses.toLocaleString()}</p>
              <p className="text-indigo-300 text-[10px] uppercase font-black tracking-widest mt-1">Operational Cost</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Print Report View */}
      {isPrinting && (
        <div className="print-only hidden print:block bg-white text-black p-10" style={{ fontFamily: 'sans-serif' }}>
           <div className="text-center mb-10 border-b-2 border-black pb-8">
              {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-32 mx-auto mb-4 object-contain" />}
              <h1 className="text-4xl font-black uppercase">{data.business?.name}</h1>
              <h2 className="text-xl font-bold uppercase tracking-[0.2em] mt-2">Executive Financial Statement</h2>
              <p className="text-xs text-gray-500 mt-4 uppercase font-bold tracking-widest">Consolidated All-Time Performance Report</p>
           </div>

           <div className="grid grid-cols-3 gap-6 mb-12 border-2 border-black p-6 rounded-lg">
              <div className="text-center">
                 <p className="text-[10px] font-black text-gray-500 uppercase">Gross Revenue</p>
                 <p className="text-2xl font-black">₹{totalSales.toLocaleString()}</p>
              </div>
              <div className="text-center border-x-2 border-black">
                 <p className="text-[10px] font-black text-gray-500 uppercase">Total Expenses</p>
                 <p className="text-2xl font-black text-red-600">₹{totalExpenses.toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[10px] font-black text-gray-500 uppercase">Net Profit</p>
                 <p className="text-2xl font-black text-emerald-600">₹{profit.toLocaleString()}</p>
              </div>
           </div>

           <div className="mb-12">
              <h3 className="text-sm font-black uppercase border-b-2 border-black pb-2 mb-4">Monthly Financial Breakdown</h3>
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-gray-100 border-b-2 border-black">
                       <th className="p-2 text-left text-[10px] uppercase font-black">Fiscal Month</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Sales (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Expenses (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Profit (₹)</th>
                    </tr>
                 </thead>
                 <tbody>
                    {sortedMonths.map((m, i) => (
                       <tr key={i} className="border-b border-gray-300">
                          <td className="p-2 text-xs font-bold">{m.month}</td>
                          <td className="p-2 text-xs text-right">₹{m.sales.toLocaleString()}</td>
                          <td className="p-2 text-xs text-right">₹{m.expenses.toLocaleString()}</td>
                          <td className="p-2 text-xs text-right font-bold text-indigo-700">₹{(m.sales - m.expenses).toLocaleString()}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           <div>
              <h3 className="text-sm font-black uppercase border-b-2 border-black pb-2 mb-4">Expense Portfolio Distribution</h3>
              <div className="grid grid-cols-2 gap-8 items-start">
                 <table className="w-full border-collapse">
                    <thead>
                       <tr className="bg-gray-100 border-b-2 border-black">
                          <th className="p-2 text-left text-[10px] uppercase font-black">Category</th>
                          <th className="p-2 text-right text-[10px] uppercase font-black">Amount Spent</th>
                          <th className="p-2 text-right text-[10px] uppercase font-black">Share (%)</th>
                       </tr>
                    </thead>
                    <tbody>
                       {expenseCategories.map((c, i) => (
                          <tr key={i} className="border-b border-gray-200">
                             <td className="p-2 text-xs font-bold">{c.name}</td>
                             <td className="p-2 text-xs text-right">₹{c.value.toLocaleString()}</td>
                             <td className="p-2 text-xs text-right font-medium text-gray-500">{((c.value / totalExpenses) * 100).toFixed(1)}%</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl h-full flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Internal Verification</p>
                    <p className="text-xs font-bold text-center leading-relaxed">Financial data audited for period ending {new Date().toLocaleDateString()}</p>
                 </div>
              </div>
           </div>

           <div className="mt-24 pt-10 border-t border-black flex justify-between px-10">
              <div className="text-center">
                 <div className="w-40 border-b border-black mb-2"></div>
                 <p className="text-[10px] font-black uppercase tracking-widest">Accountant / Auditor</p>
              </div>
              <div className="text-center">
                 <div className="w-40 border-b border-black mb-2"></div>
                 <p className="text-[10px] font-black uppercase tracking-widest">Proprietor / MD</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
