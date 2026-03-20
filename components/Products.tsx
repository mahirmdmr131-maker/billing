
import React, { useState, useMemo } from 'react';
import { AppData, Product, PriceHistoryEntry } from '../types';
import { IconAdd, IconProducts } from './Icons';

interface ProductsProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  initialSearchTerm?: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    return new Date(dateStr).toLocaleDateString('en-GB');
  }
  return dateStr.split('-').reverse().join('/');
};

const Products: React.FC<ProductsProps> = ({ data, updateData, initialSearchTerm }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialSearchTerm) setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);
  
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    defaultRate: '',
    wholesaleRate: '',
    currentStock: '',
    minThreshold: '',
    rateDate: new Date().toISOString().split('T')[0]
  });

  const isAdmin = data.currentUser?.role === 'admin';
  const UNITS = ['kg', 'gram', 'no.', 'pkt', 'box', 'ltr', 'ml', 'bag', 'tin'];

  const filteredProducts = useMemo(() => {
    return data.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data.products, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRate = Number(formData.defaultRate) || 0;
    const newWholesale = Number(formData.wholesaleRate) || 0;
    const rateDate = formData.rateDate || new Date().toISOString().split('T')[0];

    updateData(prev => {
      let updatedProducts;
      if (editingProduct) {
        updatedProducts = prev.products.map(p => {
          if (p.id === editingProduct.id) {
            const history = [...(p.priceHistory || [])];
            if (p.defaultRate !== newRate) {
              history.unshift({ rate: newRate, date: rateDate });
            } else if (history.length > 0 && history[0].rate === newRate) {
              history[0] = { ...history[0], date: rateDate };
            } else if (history.length === 0) {
              history.unshift({ rate: newRate, date: rateDate });
            }
            return {
              ...p,
              name: formData.name,
              unit: formData.unit,
              defaultRate: newRate,
              wholesaleRate: newWholesale,
              currentStock: formData.currentStock === '' ? undefined : Number(formData.currentStock),
              minThreshold: formData.minThreshold === '' ? undefined : Number(formData.minThreshold),
              priceHistory: history
            };
          }
          return p;
        });
      } else {
        const newProduct: Product = {
          id: crypto.randomUUID(),
          name: formData.name,
          unit: formData.unit,
          defaultRate: newRate,
          wholesaleRate: newWholesale,
          currentStock: formData.currentStock === '' ? undefined : Number(formData.currentStock),
          minThreshold: formData.minThreshold === '' ? undefined : Number(formData.minThreshold),
          priceHistory: [{ rate: newRate, date: rateDate }]
        };
        updatedProducts = [newProduct, ...prev.products];
      }
      return { ...prev, products: updatedProducts };
    });
    closeForm();
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      unit: product.unit,
      defaultRate: product.defaultRate.toString(),
      wholesaleRate: product.wholesaleRate?.toString() || '',
      currentStock: product.currentStock?.toString() || '',
      minThreshold: product.minThreshold?.toString() || '',
      rateDate: new Date().toISOString().split('T')[0]
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({ name: '', unit: 'kg', defaultRate: '', wholesaleRate: '', currentStock: '', minThreshold: '', rateDate: new Date().toISOString().split('T')[0] });
  };

  const deleteProduct = (id: string) => {
    if (!isAdmin) {
      alert("Only admins can remove products from the catalog.");
      return;
    }
    const productToDelete = data.products.find(p => p.id === id);
    if (!productToDelete) return;

    if (window.confirm(`MOVE TO TRASH: Remove "${productToDelete.name}" from catalog?`)) {
      updateData(prev => ({
        ...prev,
        products: prev.products.filter(p => p.id !== id),
        recycleBin: {
            ...prev.recycleBin,
            products: [...prev.recycleBin.products, { ...productToDelete, deletedAt: new Date().toISOString() }]
        }
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
           <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           <input type="text" placeholder="Search product catalog..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95">
          <IconAdd /><span>Add Product</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => {
          const isLowStock = product.currentStock !== undefined && product.minThreshold !== undefined && product.currentStock <= product.minThreshold;
          
          return (
            <div key={product.id} className={`bg-white p-6 rounded-[32px] shadow-sm border transition-all group relative overflow-hidden ${isLowStock ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 hover:shadow-xl hover:border-indigo-200'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner transition-colors ${isLowStock ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 border-slate-100'}`}>
                  <IconProducts className="w-8 h-8" />
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setViewingHistoryId(viewingHistoryId === product.id ? null : product.id)} 
                    className={`p-2 rounded-xl transition-all ${viewingHistoryId === product.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                    title="View Price History"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  <button onClick={() => startEdit(product)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl" title="Edit Catalog Info">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteProduct(product.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl" title="Remove Product">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>

              <h4 className="text-xl font-black text-slate-800 mb-2 truncate uppercase tracking-tight">{product.name}</h4>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Retail</p>
                  <p className="font-black text-indigo-600 text-sm">₹{product.defaultRate}/{product.unit}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Wholesale</p>
                  <p className="font-black text-emerald-600 text-sm">₹{product.wholesaleRate || product.defaultRate}/{product.unit}</p>
                </div>
              </div>

              <div className="flex justify-between items-center px-2">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">In Stock</span>
                <span className={`text-[10px] font-black uppercase ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                  {product.currentStock !== undefined ? `${product.currentStock} ${product.unit}` : 'Untracked'}
                </span>
              </div>

              {viewingHistoryId === product.id && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Rate Timeline</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    <div className="flex justify-between items-center bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                        <span className="text-[10px] font-black text-indigo-600 uppercase">
                          Current {product.priceHistory?.[0]?.rate === product.defaultRate ? `(${formatDate(product.priceHistory?.[0]?.date)})` : ''}
                        </span>
                        <span className="text-[10px] font-black text-indigo-700">₹{product.defaultRate}</span>
                    </div>
                    {product.priceHistory?.filter((h, i) => !(i === 0 && h.rate === product.defaultRate)).map((h, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 opacity-70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(h.date)}</span>
                        <span className="text-[10px] font-black text-slate-600">₹{h.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden">
            <div className="bg-indigo-600 px-8 py-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">{editingProduct ? 'Edit Catalog' : 'New Product'}</h3>
                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mt-1">Enterprise Price Tiers</p>
              </div>
              <button onClick={closeForm} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product Name *</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" placeholder="e.g. PREMIUM BASMATI" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Retail Rate (₹)</label>
                      <input type="number" step="any" required placeholder="0.00" value={formData.defaultRate} onChange={e => setFormData({ ...formData, defaultRate: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-600 uppercase" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Wholesale Rate (₹)</label>
                      <input type="number" step="any" required placeholder="0.00" value={formData.wholesaleRate} onChange={e => setFormData({ ...formData, wholesaleRate: e.target.value })} className="w-full px-4 py-3 border border-emerald-100 bg-emerald-50/30 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-black text-emerald-600 uppercase" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Effective Date</label>
                      <input type="date" required value={formData.rateDate} onChange={e => setFormData({ ...formData, rateDate: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Selling Unit</label>
                      <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Initial Stock</label>
                      <input type="number" placeholder="Untracked" value={formData.currentStock} onChange={e => setFormData({ ...formData, currentStock: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alert Qty</label>
                      <input type="number" placeholder="Alert at..." value={formData.minThreshold} onChange={e => setFormData({ ...formData, minThreshold: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" />
                    </div>
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={closeForm} className="flex-1 px-6 py-4 border border-slate-200 text-slate-500 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-50">Discard</button>
                <button type="submit" className="flex-1 px-6 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase text-[10px] tracking-widest hover:bg-indigo-700">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
