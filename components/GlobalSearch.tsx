import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, Sale, Customer, Product, Expense, NavigationTab } from '../types';
import { IconSearch, IconSales, IconCustomers, IconProducts, IconExpenses } from './Icons';

interface GlobalSearchProps {
  data: AppData;
  onNavigate: (tab: NavigationTab, data?: any) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ data, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    if (!query || query.length < 2) return null;
    const q = query.toLowerCase();

    const sales = data.sales.filter(s => 
      s.invoiceNumber.toLowerCase().includes(q) || 
      s.customerName.toLowerCase().includes(q) ||
      s.totalAmount.toString().includes(q)
    ).slice(0, 5);

    const customers = data.customers.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q)
    ).slice(0, 5);

    const products = data.products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.barcodeNumber && p.barcodeNumber.toLowerCase().includes(q))
    ).slice(0, 5);

    const expenses = data.expenses.filter(e => 
      e.description.toLowerCase().includes(q) || 
      e.category.toLowerCase().includes(q) ||
      e.amount.toString().includes(q)
    ).slice(0, 5);

    return { sales, customers, products, expenses };
  }, [data, query]);

  const hasResults = results && (results.sales.length > 0 || results.customers.length > 0 || results.products.length > 0 || results.expenses.length > 0);

  return (
    <div className="relative mx-4 flex-1 max-w-md hidden md:block" ref={containerRef}>
      <div className="relative group">
        <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
        <input 
          type="text" 
          placeholder="Search invoices, clients, items..." 
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent hover:bg-white hover:border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-sm font-medium outline-none transition-all"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button 
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {isOpen && results && hasResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[60vh] overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2">
          {results.sales.length > 0 && (
            <div className="p-2">
              <h4 className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-1">Sales & Invoices</h4>
              {results.sales.map(s => (
                <button key={s.id} onClick={() => { onNavigate(NavigationTab.Invoices, s); setIsOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 hover:bg-indigo-50 rounded-xl flex items-center justify-between group transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all"><IconSales className="w-4 h-4" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">{s.invoiceNumber}</p>
                      <p className="text-[10px] text-slate-500 group-hover:text-indigo-500/70">{s.customerName}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-800 group-hover:text-indigo-700">₹{s.totalAmount.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {results.customers.length > 0 && (
            <div className="p-2 border-t border-slate-50">
              <h4 className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-1">Customers</h4>
              {results.customers.map(c => (
                <button key={c.id} onClick={() => { onNavigate(NavigationTab.Customers, c); setIsOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-xl flex items-center justify-between group transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all"><IconCustomers className="w-4 h-4" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">{c.name}</p>
                      <p className="text-[10px] text-slate-500 group-hover:text-emerald-500/70">{c.phone}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.products.length > 0 && (
            <div className="p-2 border-t border-slate-50">
              <h4 className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-1">Products</h4>
              {results.products.map(p => (
                <button key={p.id} onClick={() => { onNavigate(NavigationTab.Products, p); setIsOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 hover:bg-amber-50 rounded-xl flex items-center justify-between group transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all"><IconProducts className="w-4 h-4" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 group-hover:text-amber-700">{p.name}</p>
                      <p className="text-[10px] text-slate-500 group-hover:text-amber-500/70">Rate: ₹{p.defaultRate}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-amber-600/70">{p.currentStock} {p.unit}</span>
                </button>
              ))}
            </div>
          )}

          {results.expenses.length > 0 && (
            <div className="p-2 border-t border-slate-50">
              <h4 className="px-3 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-1">Expenses</h4>
              {results.expenses.map(e => (
                <button key={e.id} onClick={() => { onNavigate(NavigationTab.Expenses, e); setIsOpen(false); setQuery(''); }} className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-xl flex items-center justify-between group transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all"><IconExpenses className="w-4 h-4" /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 group-hover:text-rose-700">{e.description}</p>
                      <p className="text-[10px] text-slate-500 group-hover:text-rose-500/70">{e.category}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-800 group-hover:text-rose-700">₹{e.amount.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {isOpen && query && !hasResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center z-50 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
             <IconSearch className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">No results found</p>
          <p className="text-xs text-slate-400 mt-1">We couldn't find anything matching "{query}"</p>
        </div>
      )}
    </div>
  );
};
