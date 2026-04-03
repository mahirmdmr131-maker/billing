
import React, { useState, useMemo } from 'react';
import { AppData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { IconPrint } from './Icons';

interface ReportsProps {
  data: AppData;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.split('-').reverse().join('/');
};

const Reports: React.FC<ReportsProps> = ({ data }) => {
  const [reportRange, setReportRange] = useState('All Time');
  const [isPrinting, setIsPrinting] = useState(false);
  const [volumePeriod, setVolumePeriod] = useState<'monthly' | 'weekly'>('monthly');

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Calculate stats
  const totalSales = data.sales.filter(s => !s.isMistake).reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;
  const totalOutstanding = data.customers.reduce((sum, c) => sum + (c.pendingBalance || 0), 0);
  const profitAfterDues = profit - totalOutstanding;
  
  const inventoryValue = data.products.reduce((sum, p) => {
    const stock = p.currentStock || 0;
    return sum + (stock * p.defaultRate);
  }, 0);

  // Monthly breakdown
  const monthlyData: any[] = [];
  const monthMap = new Map();

  const getWeekString = (dateStr: string) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const pastDaysOfYear = (d.getTime() - firstDay.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
    return `${year}-W${weekNum.toString().padStart(2, '0')}`;
  };

  const weekMap = new Map();

  data.sales.filter(s => !s.isMistake).forEach(s => {
    const month = s.date.substring(0, 7); // YYYY-MM
    const week = getWeekString(s.date);
    
    if (!monthMap.has(month)) monthMap.set(month, { month, sales: 0, expenses: 0, volumeKg: 0 });
    if (!weekMap.has(week)) weekMap.set(week, { week, sales: 0, expenses: 0, volumeKg: 0 });
    
    monthMap.get(month).sales += s.totalAmount;
    weekMap.get(week).sales += s.totalAmount;

    let saleVolume = 0;
    s.items.forEach(item => {
      const unit = item.unit.toLowerCase();
      if (unit === 'kg' || unit === 'kgs') {
        saleVolume += item.quantity;
      } else if (unit === 'gram' || unit === 'g' || unit === 'grams') {
        saleVolume += item.quantity / 1000;
      }
    });
    
    monthMap.get(month).volumeKg += saleVolume;
    weekMap.get(week).volumeKg += saleVolume;
  });

  data.expenses.forEach(e => {
    const month = e.date.substring(0, 7);
    const week = getWeekString(e.date);
    
    if (!monthMap.has(month)) monthMap.set(month, { month, sales: 0, expenses: 0, volumeKg: 0 });
    if (!weekMap.has(week)) weekMap.set(week, { week, sales: 0, expenses: 0, volumeKg: 0 });
    
    monthMap.get(month).expenses += e.amount;
    weekMap.get(week).expenses += e.amount;
  });

  const sortedMonths = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  const sortedWeeks = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week));

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
      ['Profit After Dues', profitAfterDues],
      ['Total Outstanding Dues', totalOutstanding],
      ['Estimated Inventory Value', inventoryValue],
      [''],
      ['MONTHLY DATA'],
      ['Month', 'Sales', 'Expenses', 'Profit', 'Volume (Kg)']
    ];

    sortedMonths.forEach(m => {
      rows.push([m.month, m.sales, m.expenses, m.sales - m.expenses, m.volumeKg.toFixed(2)]);
    });

    rows.push(['']);
    rows.push(['WEEKLY DATA']);
    rows.push(['Week', 'Sales', 'Expenses', 'Profit', 'Volume (Kg)']);

    sortedWeeks.forEach(w => {
      rows.push([w.week, w.sales, w.expenses, w.sales - w.expenses, w.volumeKg.toFixed(2)]);
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
    // Short delay to ensure React renders the print-only div before dialog opens
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <div className="space-y-8">
      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 gap-4 no-print shadow-sm">
        <div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Business Intelligence</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time enterprise analytics</p>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 no-print">
        <div className="bg-white p-6 rounded-[40px] shadow-sm border border-slate-200">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Sales vs Expenses (Weekly)</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedWeeks}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
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
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Volume Sold (Kg)</h4>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setVolumePeriod('monthly')}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${volumePeriod === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setVolumePeriod('weekly')}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${volumePeriod === 'weekly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Weekly
              </button>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumePeriod === 'monthly' ? sortedMonths : sortedWeeks}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey={volumePeriod === 'monthly' ? "month" : "week"} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                <Bar dataKey="volumeKg" fill="#10b981" radius={[8, 8, 0, 0]} name="Volume (Kg)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* KPI Summary Banner */}
      <div className={`rounded-[50px] p-10 text-white shadow-2xl relative overflow-hidden no-print ${data.theme === 'dynamic' ? 'bg-dynamic-primary' : 'bg-indigo-900'}`}>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-[120px] -mr-[150px] -mt-[150px]"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h4 className="text-white/60 uppercase tracking-[0.4em] font-black text-[10px]">Net Enterprise Profit</h4>
            <p className="text-5xl font-black tracking-tight">₹{profit.toLocaleString()}</p>
            <p className="text-white/40 text-xs font-bold mt-1">Yield after all documented overheads</p>
          </div>
          <div className="space-y-2">
            <h4 className="text-white/60 uppercase tracking-[0.4em] font-black text-[10px]">Profit After Dues</h4>
            <p className="text-5xl font-black tracking-tight">₹{profitAfterDues.toLocaleString()}</p>
            <p className="text-white/40 text-xs font-bold mt-1">Net profit minus outstanding credits</p>
          </div>
          <div className="grid grid-cols-2 gap-10">
            <div>
              <p className="text-emerald-400 font-black text-3xl tracking-tight">₹{totalSales.toLocaleString()}</p>
              <p className="text-white/60 text-[10px] uppercase font-black tracking-widest mt-1">Gross Revenue</p>
            </div>
            <div>
              <p className="text-rose-400 font-black text-3xl tracking-tight">₹{totalExpenses.toLocaleString()}</p>
              <p className="text-white/60 text-[10px] uppercase font-black tracking-widest mt-1">Operational Cost</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Print Report View */}
      {isPrinting && (
        <div className="print-only hidden print:block bg-white text-black p-10" style={{ fontFamily: 'sans-serif' }}>
           <div className="text-center mb-10 border-b-2 border-black pb-8">
              {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-32 mx-auto mb-4 object-contain" />}
              <h1 className="text-4xl font-black uppercase tracking-tight">{data.business?.name}</h1>
              <h2 className="text-xl font-bold uppercase tracking-[0.2em] mt-2">Executive Performance Audit</h2>
              <p className="text-xs text-gray-500 mt-4 uppercase font-bold tracking-widest">Fiscal Summary Period: All Time (Generated {new Date().toLocaleDateString('en-GB')})</p>
           </div>

           {/* Core Financial Block */}
           <div className="grid grid-cols-4 gap-6 mb-12 border-2 border-black p-6 rounded-lg">
              <div className="text-center">
                 <p className="text-[10px] font-black text-gray-500 uppercase">Gross Billing</p>
                 <p className="text-2xl font-black">₹{totalSales.toLocaleString()}</p>
              </div>
              <div className="text-center border-l-2 border-black">
                 <p className="text-[10px] font-black text-gray-500 uppercase">Operational Expenses</p>
                 <p className="text-2xl font-black text-red-600">₹{totalExpenses.toLocaleString()}</p>
              </div>
              <div className="text-center border-l-2 border-black">
                 <p className="text-[10px] font-black text-gray-500 uppercase">Net Liquidity</p>
                 <p className="text-2xl font-black text-emerald-600">₹{profit.toLocaleString()}</p>
              </div>
              <div className="text-center border-l-2 border-black">
                 <p className="text-[10px] font-black text-gray-500 uppercase">Profit After Dues</p>
                 <p className="text-2xl font-black text-indigo-600">₹{profitAfterDues.toLocaleString()}</p>
              </div>
           </div>

           {/* Secondary Financial Block */}
           <div className="grid grid-cols-2 gap-6 mb-12">
              <div className="border-2 border-black p-4 rounded-lg bg-gray-50">
                 <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Credit Risk (Outstanding Dues)</p>
                 <p className="text-xl font-black">₹{totalOutstanding.toLocaleString()}</p>
                 <p className="text-[8px] font-bold mt-1 italic text-gray-400">* Amount collectible from active accounts</p>
              </div>
              <div className="border-2 border-black p-4 rounded-lg bg-gray-50">
                 <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Estimated Inventory Value</p>
                 <p className="text-xl font-black">₹{inventoryValue.toLocaleString()}</p>
                 <p className="text-[8px] font-bold mt-1 italic text-gray-400">* Calculated at default retail rates</p>
              </div>
           </div>

           {/* Table Section */}
           <div className="mb-12">
              <h3 className="text-sm font-black uppercase border-b-2 border-black pb-2 mb-4 tracking-widest">Monthly Growth Matrix</h3>
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-gray-100 border-b-2 border-black">
                       <th className="p-2 text-left text-[10px] uppercase font-black">Fiscal Month</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Inflow (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Outflow (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Margin (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Volume (Kg)</th>
                    </tr>
                 </thead>
                 <tbody>
                    {sortedMonths.length > 0 ? sortedMonths.map((m, i) => (
                       <tr key={i} className="border-b border-gray-300">
                          <td className="p-2 text-xs font-bold">{m.month}</td>
                          <td className="p-2 text-xs text-right">₹{m.sales.toLocaleString()}</td>
                          <td className="p-2 text-xs text-right">₹{m.expenses.toLocaleString()}</td>
                          <td className="p-2 text-xs text-right font-bold text-indigo-700">₹{(m.sales - m.expenses).toLocaleString()}</td>
                          <td className="p-2 text-xs text-right font-bold text-emerald-700">{m.volumeKg.toFixed(2)}</td>
                       </tr>
                    )) : (
                       <tr><td colSpan={5} className="p-10 text-center text-xs font-bold text-gray-400">NO FINANCIAL HISTORY RECORDED</td></tr>
                    )}
                 </tbody>
              </table>
           </div>

           <div className="mb-12">
              <h3 className="text-sm font-black uppercase border-b-2 border-black pb-2 mb-4 tracking-widest">Weekly Growth Matrix</h3>
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-gray-100 border-b-2 border-black">
                       <th className="p-2 text-left text-[10px] uppercase font-black">Fiscal Week</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Inflow (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Outflow (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Margin (₹)</th>
                       <th className="p-2 text-right text-[10px] uppercase font-black">Volume (Kg)</th>
                    </tr>
                 </thead>
                 <tbody>
                    {sortedWeeks.length > 0 ? sortedWeeks.map((w, i) => (
                       <tr key={i} className="border-b border-gray-300">
                          <td className="p-2 text-xs font-bold">{w.week}</td>
                          <td className="p-2 text-xs text-right">₹{w.sales.toLocaleString()}</td>
                          <td className="p-2 text-xs text-right">₹{w.expenses.toLocaleString()}</td>
                          <td className="p-2 text-xs text-right font-bold text-indigo-700">₹{(w.sales - w.expenses).toLocaleString()}</td>
                          <td className="p-2 text-xs text-right font-bold text-emerald-700">{w.volumeKg.toFixed(2)}</td>
                       </tr>
                    )) : (
                       <tr><td colSpan={5} className="p-10 text-center text-xs font-bold text-gray-400">NO FINANCIAL HISTORY RECORDED</td></tr>
                    )}
                 </tbody>
              </table>
           </div>

           {/* Categories Block */}
           <div className="mb-12">
              <h3 className="text-sm font-black uppercase border-b-2 border-black pb-2 mb-4 tracking-widest">Expense Portfolio Analysis</h3>
              <div className="grid grid-cols-2 gap-8 items-start">
                 <table className="w-full border-collapse">
                    <thead>
                       <tr className="bg-gray-100 border-b-2 border-black">
                          <th className="p-2 text-left text-[10px] uppercase font-black">Expense Tier</th>
                          <th className="p-2 text-right text-[10px] uppercase font-black">Consolidated</th>
                          <th className="p-2 text-right text-[10px] uppercase font-black">Share</th>
                       </tr>
                    </thead>
                    <tbody>
                       {expenseCategories.map((c, i) => (
                          <tr key={i} className="border-b border-gray-200">
                             <td className="p-2 text-xs font-bold uppercase">{c.name}</td>
                             <td className="p-2 text-xs text-right font-medium">₹{c.value.toLocaleString()}</td>
                             <td className="p-2 text-xs text-right font-black text-gray-500">{((c.value / totalExpenses) * 100).toFixed(1)}%</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl h-full flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 mb-2">Audit Status</p>
                    <p className="text-[10px] font-bold leading-relaxed text-gray-600">This report constitutes a preliminary financial overview based on internal records for <b>A M Food Processing</b>. Data integrity is contingent upon complete entry of all daily transactions.</p>
                 </div>
              </div>
           </div>

           {/* Signature Footer */}
           <div className="mt-24 pt-10 border-t border-black flex justify-between px-10">
              <div className="text-center">
                 <div className="w-48 border-b border-black mb-2"></div>
                 <p className="text-[9px] font-black uppercase tracking-widest">Internal Auditor / Accountant</p>
              </div>
              <div className="text-center">
                 <div className="w-48 border-b border-black mb-2"></div>
                 <p className="text-[9px] font-black uppercase tracking-widest">Authorized Signatory / MD</p>
              </div>
           </div>
        </div>
      )}

      {/* Print isolation style tag */}
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
            z-index: 9999 !important;
          }
          @page { 
            margin: 1cm; 
            size: auto;
          }
          /* Ensure charts are hidden during print if they don't look good */
          .recharts-responsive-container { display: none !important; }
        }
      `}} />
    </div>
  );
};

export default Reports;
