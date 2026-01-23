
import React, { useState, useMemo } from 'react';
import { AppData, Product } from '../types';
import { IconAdd, IconProducts } from './Icons';

interface ProductsProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const Products: React.FC<ProductsProps> = ({ data, updateData }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    currentStock: '',
    minThreshold: ''
  });

  const isAdmin = data.currentUser?.role === 'admin';
  const UNITS = ['kg', 'gram', 'no.', 'pkt', 'box', 'ltr', 'ml'];

  const filteredProducts = useMemo(() => {
    return data.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data.products, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      name: formData.name,
      unit: formData.unit,
      defaultRate: editingProduct ? editingProduct.defaultRate : 0,
      currentStock: formData.currentStock === '' ? undefined : Number(formData.currentStock),
      minThreshold: formData.minThreshold === '' ? undefined : Number(formData.minThreshold)
    };

    if (editingProduct) {
      updateData(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === editingProduct.id ? { ...p, ...productData } : p)
      }));
    } else {
      const newProduct: Product = {
        id: crypto.randomUUID(),
        ...productData
      };
      updateData(prev => ({
        ...prev,
        products: [newProduct, ...prev.products]
      }));
    }
    closeForm();
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      unit: product.unit,
      currentStock: product.currentStock?.toString() || '',
      minThreshold: product.minThreshold?.toString() || ''
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({ name: '', unit: 'kg', currentStock: '', minThreshold: '' });
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
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-black uppercase tracking-widest">Base Unit</span>
                  <span className="font-black text-slate-800 uppercase">{product.unit}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-black uppercase tracking-widest">Current Stock</span>
                  <span className={`font-black uppercase ${isLowStock ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
                    {product.currentStock !== undefined ? `${product.currentStock} ${product.unit}` : 'Untracked'}
                  </span>
                </div>
              </div>
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
                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mt-1">Inventory Management</p>
              </div>
              <button onClick={closeForm} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product Name *</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" placeholder="e.g. PREMIUM BASMATI" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Selling Unit</label>
                      <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alert Threshold</label>
                      <input type="number" placeholder="Low stock at..." value={formData.minThreshold} onChange={e => setFormData({ ...formData, minThreshold: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" />
                    </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Initial Stock Level</label>
                  <input type="number" placeholder="Leave empty for untracked" value={formData.currentStock} onChange={e => setFormData({ ...formData, currentStock: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold uppercase" />
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
