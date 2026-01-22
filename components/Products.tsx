
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

  const UNITS = ['kg', 'gram', 'no.', 'pkt', 'box', 'ltr', 'ml'];

  const filteredProducts = useMemo(() => {
    return data.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [data.products, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      name: formData.name,
      unit: formData.unit,
      defaultRate: 0,
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
    if (confirm('Delete this product from your inventory list?')) {
      updateData(prev => ({
        ...prev,
        products: prev.products.filter(p => p.id !== id)
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
           <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           <input 
             type="text" 
             placeholder="Search products..." 
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
          <span>Add Product</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{editingProduct ? 'Update Product' : 'Register Product'}</h4>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Item Name *</label>
                <input
                  type="text" required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Mixed Fruit Pickle"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Default Billing Unit *</label>
                <select
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Stock</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={formData.currentStock}
                    onChange={e => setFormData({ ...formData, currentStock: e.target.value })}
                    placeholder="e.g. 100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Low Stock Alert at</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={formData.minThreshold}
                    onChange={e => setFormData({ ...formData, minThreshold: e.target.value })}
                    placeholder="e.g. 10"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-4 pt-6 border-t border-slate-100">
              <button type="button" onClick={closeForm} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
              <button type="submit" className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">
                {editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => {
          const isLowStock = product.currentStock !== undefined && product.minThreshold !== undefined && product.currentStock <= product.minThreshold;
          return (
            <div key={product.id} className={`bg-white p-6 rounded-3xl shadow-sm border transition-all group relative overflow-hidden ${isLowStock ? 'border-red-200 bg-red-50/10' : 'border-slate-200 hover:shadow-xl'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner transition-colors ${isLowStock ? 'bg-red-50 border-red-100 text-red-500' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 border-slate-100'}`}>
                  <IconProducts className="w-7 h-7" />
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(product)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => deleteProduct(product.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <h4 className="text-xl font-black text-slate-800 mb-2 truncate">{product.name}</h4>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Base Unit</span>
                  <span className="font-black text-slate-700">{product.unit}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Stock Level</span>
                  <span className={`font-black ${isLowStock ? 'text-red-600' : 'text-slate-700'}`}>
                    {product.currentStock !== undefined ? `${product.currentStock} ${product.unit}` : 'Not Tracked'}
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                {isLowStock ? (
                  <div className="px-3 py-1 bg-red-100 rounded-lg text-[10px] font-black text-red-600 uppercase tracking-widest animate-pulse">
                    Low Stock Alert
                  </div>
                ) : (
                  <div className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    In Catalog
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">No products in catalog.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
