import React, { useState } from 'react';
import { AppData, Product, InventoryBatch } from '../types';
import { IconEdit } from './Icons';

interface InventoryProps {
  data: AppData;
  updateData: (newData: Partial<AppData>) => void;
}

export const Inventory: React.FC<InventoryProps> = ({ data, updateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'RawMaterial' | 'FinishedGood' | 'LowStock'>('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('Stock Check');

  const products = data.products || [];

  const handleAdjustment = () => {
    if (!selectedProduct || adjustmentQty === 0) return;

    const newStock = (selectedProduct.currentStock || 0) + adjustmentQty;
    const updatedProducts = products.map(p => 
      p.id === selectedProduct.id ? { ...p, currentStock: newStock } : p
    );

    updateData({ products: updatedProducts });
    setSelectedProduct({ ...selectedProduct, currentStock: newStock });
    setAdjustmentQty(0);
    alert('Stock adjusted successfully!');
  };

  const filteredProducts = products.filter(p => {
    if (filterType === 'LowStock') {
      return (p.currentStock || 0) <= (p.minThreshold || 5);
    }
    if (filterType !== 'All' && p.productType !== filterType) {
      return false;
    }
    if (searchTerm) {
      return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return true;
  });

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Inventory Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track stock levels, adjustments, and batches</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <input 
          type="text"
          placeholder="Search products, SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white"
        />
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white"
        >
          <option value="All">All Items</option>
          <option value="RawMaterial">Raw Materials</option>
          <option value="FinishedGood">Finished Goods</option>
          <option value="LowStock">Low Stock Alerts</option>
        </select>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {/* Left Side: Product List */}
        <div className="w-full lg:w-2/3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-bold text-sm text-slate-600 dark:text-slate-300">Product</th>
                  <th className="p-4 font-bold text-sm text-slate-600 dark:text-slate-300">Type</th>
                  <th className="p-4 font-bold text-sm text-slate-600 dark:text-slate-300 text-right">Stock</th>
                  <th className="p-4 font-bold text-sm text-slate-600 dark:text-slate-300 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const stock = p.currentStock || 0;
                  const min = p.minThreshold || 5;
                  const isLow = stock <= min;

                  return (
                    <tr key={p.id} className="border-b last:border-0 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-white">{p.name}</div>
                        {p.code && <div className="text-xs font-mono text-slate-500">SKU: {p.code}</div>}
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                          {p.productType === 'RawMaterial' ? 'Raw Material' : 'Finished Good'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`font-bold text-lg ${isLow ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>
                          {stock}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">{p.unit}</span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => setSelectedProduct(p)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                            selectedProduct?.id === p.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300'
                          }`}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-slate-500">
                      No products found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Product Details & Adjustment */}
        <div className="w-full lg:w-1/3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
          {selectedProduct ? (
            <div className="space-y-6">
              <div className="border-b dark:border-slate-700 pb-4">
                <h3 className="text-xl font-bold">{selectedProduct.name}</h3>
                <p className="text-sm text-slate-500 font-mono mt-1">SKU: {selectedProduct.code || 'N/A'}</p>
                <div className="mt-4 flex gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl flex-1 text-center">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Current Stock</p>
                    <p className="text-2xl font-black mt-1 text-indigo-600">{selectedProduct.currentStock || 0} <span className="text-sm text-slate-500">{selectedProduct.unit}</span></p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl flex-1 text-center">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Min Threshold</p>
                    <p className="text-xl font-bold mt-1 text-slate-700 dark:text-slate-300">{selectedProduct.minThreshold || 5}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-4">Stock Adjustment</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Adjustment Quantity (Use +/-)</label>
                    <input 
                      type="number" 
                      value={adjustmentQty}
                      onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                      className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                      placeholder="e.g. 5 or -2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reason</label>
                    <select 
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      className="w-full p-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                    >
                      <option value="Stock Check">Physical Stock Check</option>
                      <option value="Damaged">Damaged / Wastage</option>
                      <option value="Return">Customer Return</option>
                      <option value="Internal Use">Internal Consumption</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleAdjustment}
                    disabled={adjustmentQty === 0}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Apply Adjustment
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    New Stock will be: {(selectedProduct.currentStock || 0) + adjustmentQty} {selectedProduct.unit}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <div className="text-4xl mb-4">📦</div>
              <p className="text-center font-medium">Select a product from the list to manage its inventory.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};