
import React, { useState } from 'react';
import { AppData } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface ReportsProps {
  data: AppData;
}

const Reports: React.FC<ReportsProps> = ({ data }) => {
  const [reportRange, setReportRange] = useState('All Time');

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Calculate stats
  const totalSales = data.sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;

  // Monthly breakdown
  const monthlyData: any[] = [];
  const monthMap = new Map();

  data.sales.forEach(s => {
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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-slate-800">Financial Reports</h3>
        <button
          onClick={exportToCSV}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow-md flex items-center space-x-2 transition-all active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Export Excel (CSV)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Sales vs Expenses Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="text-lg font-bold text-slate-700 mb-6">Sales vs Expenses (Monthly)</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedMonths}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} name="Sales" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="text-lg font-bold text-slate-700 mb-6">Expense Distribution</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {expenseCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-indigo-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h4 className="text-indigo-200 uppercase tracking-widest font-bold text-xs mb-2">Lifetime Financial Snapshot</h4>
            <p className="text-3xl font-black">₹{profit.toLocaleString()}</p>
            <p className="text-indigo-300 text-sm mt-1">Total Net Profit after all overheads</p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:gap-12">
            <div>
              <p className="text-emerald-400 font-bold text-xl">₹{totalSales.toLocaleString()}</p>
              <p className="text-indigo-200 text-xs uppercase font-bold">Total Inflow</p>
            </div>
            <div>
              <p className="text-red-400 font-bold text-xl">₹{totalExpenses.toLocaleString()}</p>
              <p className="text-indigo-200 text-xs uppercase font-bold">Total Outflow</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
