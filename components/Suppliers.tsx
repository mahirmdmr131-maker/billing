import React, { useState } from 'react';
import { Supplier, AppData } from '../types';
import { IconTrash, IconEdit, IconPhone, IconMail, IconUser } from './Icons';

interface SuppliersProps {
  data: AppData;
  updateData: (newData: Partial<AppData>) => void;
}

export const Suppliers: React.FC<SuppliersProps> = ({ data, updateData }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst: '',
    pendingBalance: 0
  });

  const suppliers = data.suppliers || [];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    if (editingSupplier) {
      const updated = suppliers.map(s => 
        s.id === editingSupplier.id ? { ...s, ...formData } as Supplier : s
      );
      updateData({ suppliers: updated });
    } else {
      const newSupplier: Supplier = {
        id: 'supp_' + Date.now().toString(),
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        gst: formData.gst,
        pendingBalance: Number(formData.pendingBalance) || 0,
        createdAt: new Date().toISOString()
      };
      updateData({ suppliers: [newSupplier, ...suppliers] });
    }

    setFormData({ name: '', phone: '', email: '', address: '', gst: '', pendingBalance: 0 });
    setShowAddForm(false);
    setEditingSupplier(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      updateData({ suppliers: suppliers.filter(s => s.id !== id) });
    }
  };

  const startEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData(supplier);
    setShowAddForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Suppliers</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your suppliers and their balances</p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(null);
            setFormData({ name: '', phone: '', email: '', address: '', gst: '', pendingBalance: 0 });
            setShowAddForm(!showAddForm);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          {showAddForm ? 'Cancel' : '+ Add Supplier'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold mb-4">{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
              <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GSTIN</label>
              <input type="text" value={formData.gst || ''} onChange={e => setFormData({...formData, gst: e.target.value})} className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
              <textarea value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" rows={2}></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Balance</label>
              <input type="number" value={formData.pendingBalance} onChange={e => setFormData({...formData, pendingBalance: Number(e.target.value)})} className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700">
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(supplier => (
          <div key={supplier.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{supplier.name}</h3>
                <span className={`px-2 py-1 rounded text-xs font-bold ${supplier.pendingBalance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  ₹{supplier.pendingBalance.toLocaleString()}
                </span>
              </div>
              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2"><IconPhone /> {supplier.phone}</p>
                {supplier.email && <p className="flex items-center gap-2"><IconMail /> {supplier.email}</p>}
                {supplier.gst && <p className="text-xs mt-2"><span className="font-semibold">GST:</span> {supplier.gst}</p>}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button onClick={() => startEdit(supplier)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50">
                <IconEdit />
              </button>
              <button onClick={() => handleDelete(supplier.id)} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg dark:bg-rose-900/30 dark:hover:bg-rose-900/50">
                <IconTrash />
              </button>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && !showAddForm && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No suppliers found. Click "Add Supplier" to create one.
          </div>
        )}
      </div>
    </div>
  );
};