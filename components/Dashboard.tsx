
import React, { useState } from 'react';
import { AppData, DashboardWidget, DashboardWidgetType } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  data: AppData;
  updateData?: (updater: (prev: AppData) => AppData) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, updateData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const isAdmin = data.currentUser?.role === 'admin';

  // Calculations
  const totalSales = data.sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;
  const totalCustomers = data.customers.length;
  const totalDues = data.customers.reduce((sum, c) => sum + (c.pendingBalance || 0), 0);

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const daySales = data.sales.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.totalAmount, 0);
    const dayExpenses = data.expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + e.amount, 0);
    return { name: d.toLocaleDateString(undefined, { weekday: 'short' }), sales: daySales, expenses: dayExpenses };
  });

  /**
   * Fix: Added isMistake: false to expense items to ensure union type consistency 
   * for act.isMistake access in the render loop.
   */
  const recentActivities = [
    ...data.sales.map(s => ({ type: 'sale' as const, date: s.date, label: `Sale: ${s.customerName}`, amount: s.totalAmount, id: s.id, isMistake: s.isMistake, createdBy: s.createdBy })),
    ...data.expenses.map(e => ({ type: 'expense' as const, date: e.date, label: e.description, amount: e.amount, id: e.id, isMistake: false }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  // Widget Actions
  const removeWidget = (id: string) => {
    if (!updateData) return;
    updateData(prev => ({
      ...prev,
      dashboardWidgets: prev.dashboardWidgets.filter(w => w.id !== id)
    }));
  };

  const addWidget = (type: DashboardWidgetType) => {
    if (!updateData) return;
    const titles: Record<DashboardWidgetType, string> = {
      kpi_sales: 'Total Sales',
      kpi_expenses: 'Total Expenses',
      kpi_profit: 'Net Profit',
      kpi_customers: 'Total Customers',
      kpi_dues: 'Outstanding Dues',
      chart_performance: 'Weekly Performance',
      list_activity: 'Recent Activity'
    };
    const widths: Record<DashboardWidgetType, 'full' | 'half' | 'third' | 'two-thirds'> = {
      kpi_sales: 'third',
      kpi_expenses: 'third',
      kpi_profit: 'third',
      kpi_customers: 'third',
      kpi_dues: 'third',
      chart_performance: 'two-thirds',
      list_activity: 'third'
    };
    const colors: Record<string, string> = {
      kpi_sales: 'indigo',
      kpi_expenses: 'red',
      kpi_profit: 'emerald',
      kpi_customers: 'cyan',
      kpi_dues: 'amber'
    };

    const newWidget: DashboardWidget = {
      id: crypto.randomUUID(),
      type,
      title: titles[type],
      width: widths[type],
      color: colors[type]
    };

    updateData(prev => ({
      ...prev,
      dashboardWidgets: [...prev.dashboardWidgets, newWidget]
    }));
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    if (!updateData) return;
    updateData(prev => {
      const index = prev.dashboardWidgets.findIndex(w => w.id === id);
      if (index === -1) return prev;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.dashboardWidgets.length) return prev;
      
      const newWidgets = [...prev.dashboardWidgets];
      const [moved] = newWidgets.splice(index, 1);
      newWidgets.splice(nextIndex, 0, moved);
      return { ...prev, dashboardWidgets: newWidgets };
    });
  };

  // Render Helpers
  const renderWidget = (widget: DashboardWidget) => {
    const widthClass = {
      'full': 'col-span-1 md:col-span-3',
      'half': 'col-span-1 md:col-span-1.5', // Approximate
      'third': 'col-span-1',
      'two-thirds': 'col-span-1 md:col-span-2'
    }[widget.width];

    const content = (() => {
      switch (widget.type) {
        case 'kpi_sales': return <KpiCard title={widget.title} value={totalSales} color={widget.color || 'indigo'} />;
        case 'kpi_expenses': return <KpiCard title={widget.title} value={totalExpenses} color={widget.color || 'red'} />;
        case 'kpi_profit': return <KpiCard title={widget.title} value={profit} color={profit >= 0 ? "emerald" : "orange"} />;
        case 'kpi_customers': return <KpiCard title={widget.title} value={totalCustomers} color={widget.color || 'cyan'} isCurrency={false} />;
        case 'kpi_dues': return <KpiCard title={widget.title} value={totalDues} color={widget.color || 'amber'} />;
        case 'chart_performance': return (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-full">
            <h3 className="text-lg font-bold text-slate-800 mb-6">{widget.title}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                  <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                  <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
        case 'list_activity': return (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-full">
            <h3 className="text-lg font-bold text-slate-800 mb-6">{widget.title}</h3>
            <div className="space-y-3">
              {recentActivities.map((act) => (
                <div key={act.id + act.type} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${act.isMistake ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${act.type === 'sale' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {act.type === 'sale' ? 'S' : 'E'}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${act.isMistake ? 'text-red-700' : 'text-slate-800'}`}>{act.label}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(act.date).toLocaleDateString()} • by {data.users.find(u => u.id === (act as any).createdBy)?.username || 'System'}
                      </p>
                    </div>
                  </div>
                  {isAdmin && <div className={`font-bold text-sm ${act.type === 'sale' ? 'text-emerald-600' : 'text-red-600'}`}>₹{act.amount.toLocaleString()}</div>}
                </div>
              ))}
            </div>
          </div>
        );
        default: return null;
      }
    })();

    return (
      <div key={widget.id} className={`${widthClass} relative group`}>
        {isEditing && (
          <div className="absolute -top-2 -right-2 z-10 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => moveWidget(widget.id, 'up')} className="bg-white text-slate-500 hover:text-indigo-600 p-1.5 rounded-full shadow-lg border border-slate-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            </button>
            <button onClick={() => moveWidget(widget.id, 'down')} className="bg-white text-slate-500 hover:text-indigo-600 p-1.5 rounded-full shadow-lg border border-slate-200">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button onClick={() => removeWidget(widget.id)} className="bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        {content}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex-1">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-1">Welcome Back, {data.currentUser?.username}</h2>
          <p className="text-slate-500 font-medium">Monitoring A M Food Processing Performance.</p>
        </div>
        {isAdmin && updateData && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95 flex items-center space-x-2 ${isEditing ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isEditing ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />}
            </svg>
            <span>{isEditing ? 'Done Editing' : 'Customize Dashboard'}</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 animate-in fade-in duration-300">
          <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4">Add Widget to Dashboard</h4>
          <div className="flex flex-wrap gap-3">
            {[
              { type: 'kpi_sales', label: '+ Sales KPI' },
              { type: 'kpi_expenses', label: '+ Expenses KPI' },
              { type: 'kpi_profit', label: '+ Profit KPI' },
              { type: 'kpi_customers', label: '+ Customers KPI' },
              { type: 'kpi_dues', label: '+ Dues KPI' },
              { type: 'chart_performance', label: '+ Weekly Chart' },
              { type: 'list_activity', label: '+ Activity List' }
            ].map(item => (
              <button 
                key={item.type} 
                onClick={() => addWidget(item.type as DashboardWidgetType)}
                className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data.dashboardWidgets.map(renderWidget)}
      </div>

      {data.dashboardWidgets.length === 0 && (
        <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-bold">Your dashboard is empty. Click "Customize Dashboard" to add widgets.</p>
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{ title: string; value: number; color: string; isCurrency?: boolean }> = ({ title, value, color, isCurrency = true }) => {
  const colorClasses: any = { 
    indigo: "bg-indigo-600", 
    red: "bg-red-500", 
    emerald: "bg-emerald-500", 
    orange: "bg-orange-500",
    cyan: "bg-cyan-500",
    amber: "bg-amber-500"
  };
  return (
    <div className={`${colorClasses[color] || 'bg-slate-600'} p-6 rounded-3xl text-white shadow-lg border-b-4 border-black/10 h-full flex flex-col justify-center`}>
      <h4 className="text-[10px] font-black opacity-60 mb-1 uppercase tracking-widest">{title}</h4>
      <p className="text-3xl font-black">{isCurrency ? '₹' : ''}{value.toLocaleString()}</p>
    </div>
  );
};

export default Dashboard;
