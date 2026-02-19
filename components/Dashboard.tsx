import React, { useState, useMemo } from 'react';
import { AppData, DashboardWidget, DashboardWidgetType } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  data: AppData;
  updateData?: (updater: (prev: AppData) => AppData) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.split('-').reverse().join('/');
};

const Dashboard: React.FC<DashboardProps> = ({ data, updateData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const isAdmin = data.currentUser?.role === 'admin';

  // Aesthetic Greeting
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Temporal Logic
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const totalSales = useMemo(() => data.sales.filter(s => !s.isMistake).reduce((sum, s) => sum + s.totalAmount, 0), [data.sales]);
  const todaySales = useMemo(() => data.sales.filter(s => !s.isMistake && s.date === todayStr).reduce((sum, s) => sum + s.totalAmount, 0), [data.sales, todayStr]);
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;
  const totalCustomers = data.customers.length;
  const totalDues = data.customers.reduce((sum, c) => sum + (c.pendingBalance || 0), 0);

  const lowStockProducts = data.products.filter(p => 
    p.currentStock !== undefined && p.minThreshold !== undefined && p.currentStock <= p.minThreshold
  );

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const daySales = data.sales.filter(s => !s.isMistake && s.date === dateStr).reduce((sum, s) => sum + s.totalAmount, 0);
    const dayExpenses = data.expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + e.amount, 0);
    return { name: d.toLocaleDateString(undefined, { weekday: 'short' }), sales: daySales, expenses: dayExpenses };
  });

  const recentActivities = [
    ...data.sales.map(s => ({ type: 'sale' as const, date: s.date, label: `Sale: ${s.customerName}`, amount: s.totalAmount, id: s.id, isMistake: s.isMistake })),
    ...data.expenses.map(e => ({ type: 'expense' as const, date: e.date, label: e.description, amount: e.amount, id: e.id, isMistake: false }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const removeWidget = (id: string) => {
    if (!updateData) return;
    updateData(prev => ({ ...prev, dashboardWidgets: prev.dashboardWidgets.filter(w => w.id !== id) }));
  };

  const addWidget = (type: DashboardWidgetType) => {
    if (!updateData) return;
    const titles: Record<DashboardWidgetType, string> = {
      kpi_sales: 'Lifetime Revenue', kpi_sales_today: "Today's Collection", kpi_sales_week: 'Weekly Turnover', kpi_sales_month: 'Monthly Revenue',
      kpi_expenses: 'Expense Tracker', kpi_profit: 'Profit Margin', kpi_customers: 'Customer Base', kpi_dues: 'Outstanding Dues', 
      chart_performance: 'Growth Analytics', list_activity: 'Recent Log', list_low_stock: 'Critical Stock'
    };
    const widths: Record<DashboardWidgetType, 'full' | 'half' | 'third' | 'two-thirds'> = {
      kpi_sales: 'third', kpi_sales_today: 'third', kpi_sales_week: 'third', kpi_sales_month: 'third',
      kpi_expenses: 'third', kpi_profit: 'third', kpi_customers: 'third', kpi_dues: 'third', 
      chart_performance: 'two-thirds', list_activity: 'third', list_low_stock: 'third'
    };
    const colors: Record<string, string> = { kpi_sales: 'indigo', kpi_expenses: 'rose', kpi_profit: 'emerald', kpi_customers: 'sky', kpi_dues: 'amber' };

    updateData(prev => ({
      ...prev,
      dashboardWidgets: [...prev.dashboardWidgets, { id: crypto.randomUUID(), type, title: titles[type], width: widths[type], color: colors[type] || 'indigo' }]
    }));
  };

  const renderWidget = (widget: DashboardWidget) => {
    const widthClass = { 'full': 'col-span-1 md:col-span-3', 'half': 'col-span-1 md:col-span-1.5', 'third': 'col-span-1', 'two-thirds': 'col-span-1 md:col-span-2' }[widget.width];

    const content = (() => {
      switch (widget.type) {
        case 'kpi_sales': return <KpiCard title={widget.title} value={totalSales} color="indigo" gradient="from-indigo-600 to-indigo-800" icon="💰" />;
        case 'kpi_sales_today': return <KpiCard title={widget.title} value={todaySales} color="emerald" gradient="from-emerald-600 to-teal-700" icon="☀️" />;
        case 'kpi_expenses': return <KpiCard title={widget.title} value={totalExpenses} color="rose" gradient="from-rose-500 to-rose-700" icon="📉" />;
        case 'kpi_profit': return <KpiCard title={widget.title} value={profit} color="emerald" gradient="from-emerald-500 to-emerald-700" icon="📈" />;
        case 'kpi_customers': return <KpiCard title={widget.title} value={totalCustomers} color="sky" isCurrency={false} gradient="from-sky-500 to-sky-700" icon="👥" />;
        case 'kpi_dues': return <KpiCard title={widget.title} value={totalDues} color="amber" gradient="from-amber-500 to-amber-700" icon="⏳" />;
        case 'chart_performance': return (
          <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 h-full relative overflow-hidden group">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
               {widget.title}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                  <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={5} fillOpacity={1} fill="url(#gSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
        case 'list_activity': return (
          <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 h-full">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8">{widget.title}</h3>
            <div className="space-y-4">
              {recentActivities.map((act) => (
                <div key={act.id + act.type} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${act.isMistake ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-transparent hover:border-indigo-100'}`}>
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${act.type === 'sale' ? 'bg-indigo-600 text-white' : 'bg-rose-500 text-white'}`}>
                      {act.type === 'sale' ? 'S' : 'E'}
                    </div>
                    <div>
                      <p className="font-black text-sm text-slate-800 truncate max-w-[120px]">{act.label}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{formatDate(act.date)}</p>
                    </div>
                  </div>
                  <div className={`font-black text-sm ${act.type === 'sale' ? 'text-indigo-600' : 'text-rose-600'}`}>₹{act.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        );
        case 'list_low_stock': return (
          <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 h-full">
            <h3 className="text-sm font-black text-rose-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
               ⚠️ {widget.title}
            </h3>
            <div className="space-y-4">
              {lowStockProducts.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-100">
                  <span className="font-black text-xs text-slate-800 uppercase">{p.name}</span>
                  <span className="font-black text-xs text-rose-600">{p.currentStock || 0} {p.unit}</span>
                </div>
              ))}
              {lowStockProducts.length === 0 && <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Inventory Secure</p>}
            </div>
          </div>
        );
        default: return null;
      }
    })();

    return (
      <div key={widget.id} className={`${widthClass} relative group animate-in fade-in zoom-in duration-500`}>
        {isEditing && isAdmin && (
          <button onClick={() => removeWidget(widget.id)} className="absolute -top-3 -right-3 z-10 bg-rose-500 text-white p-2 rounded-full shadow-2xl hover:scale-110 transition-transform">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
        {content}
      </div>
    );
  };

  return (
    <div className="space-y-12">
      {/* Visual Header */}
      <div className="relative overflow-hidden bg-indigo-900 rounded-[50px] p-12 text-white shadow-[0_30px_60px_rgba(49,46,129,0.4)] flex flex-col items-start gap-8">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-400 rounded-full blur-[150px] opacity-20 -mr-[250px] -mt-[250px]"></div>
        
        <div className="relative z-10 w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-indigo-300 font-black uppercase text-[10px] tracking-[0.5em] mb-1">{greeting}, {data.currentUser?.username}</p>
            <h1 className="text-5xl font-black tracking-tight leading-none">Control <span className="text-indigo-400">Center.</span></h1>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setIsEditing(!isEditing)} 
              className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-2xl hover:scale-105 active:scale-95 ${isEditing ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-900'}`}
            >
              {isEditing ? '✓ Finish Setup' : '🎨 Personalize UI'}
            </button>
          )}
        </div>
      </div>

      {isEditing && isAdmin && (
        <div className="bg-white p-12 rounded-[50px] border border-slate-100 shadow-2xl animate-in slide-in-from-top-12 duration-500">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-10 text-center">Intelligent Insights Library</h4>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { type: 'kpi_sales_today', label: "Today's Sale" },
              { type: 'kpi_sales', label: 'Total Sale' },
              { type: 'kpi_expenses', label: 'Expenses' },
              { type: 'kpi_profit', label: 'Net Profit' },
              { type: 'kpi_customers', label: 'Customers' },
              { type: 'kpi_dues', label: 'Outstanding' },
              { type: 'chart_performance', label: 'Growth Graph' },
              { type: 'list_activity', label: 'Recent Logs' },
              { type: 'list_low_stock', label: 'Inventory Alerts' }
            ].map(widget => (
              <button 
                key={widget.type} 
                onClick={() => addWidget(widget.type as DashboardWidgetType)} 
                className="px-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all hover:bg-white shadow-sm"
              >
                + {widget.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-10">
        {data.dashboardWidgets.map(renderWidget)}
      </div>

      {/* Aesthetic Footer Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
         {[
           { label: 'Today Turnover', val: '₹' + todaySales.toLocaleString(), color: 'text-indigo-500' },
           { label: 'Due Ratio', val: totalSales > 0 ? ((totalDues/totalSales)*100).toFixed(1) + '%' : '0%', color: 'text-amber-500' }
         ].map((stat, i) => (
           <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-lg transition-shadow">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-4">{stat.label}</p>
              <div className={`text-4xl font-black ${stat.color}`}>{stat.val}</div>
           </div>
         ))}
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ title: string; value: number; color: string; gradient: string; icon: string; isCurrency?: boolean }> = ({ title, value, gradient, icon, isCurrency = true }) => {
  return (
    <div className={`bg-gradient-to-br ${gradient} p-10 rounded-[40px] text-white shadow-[0_20px_40px_rgba(0,0,0,0.15)] h-full flex flex-col justify-between group hover:translate-y-[-10px] transition-all duration-500 cursor-default relative overflow-hidden`}>
      <div className="absolute top-[-20px] right-[-20px] text-8xl opacity-10 group-hover:rotate-12 transition-transform">{icon}</div>
      <h4 className="text-[11px] font-black opacity-60 uppercase tracking-[0.4em] relative z-10">{title}</h4>
      <div className="mt-12 relative z-10">
        <p className="text-5xl font-black tracking-tight">{isCurrency ? '₹' : ''}{value.toLocaleString()}</p>
        <div className="h-1.5 w-12 bg-white/30 rounded-full mt-6 group-hover:w-full transition-all duration-700"></div>
      </div>
    </div>
  );
};

export default Dashboard;