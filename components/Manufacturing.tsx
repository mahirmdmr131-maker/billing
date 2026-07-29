import React, { useState } from 'react';
import { AppData, Recipe, ProductionRecord, RecipeItem, Product } from '../types';
import { IconAdd, IconEdit, IconTrash } from './Icons';

interface ManufacturingProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

export const Manufacturing: React.FC<ManufacturingProps> = ({ data, updateData }) => {
  const [activeTab, setActiveTab] = useState<'recipes' | 'production'>('recipes');
  
  // Recipe form state
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState<{name: string; outputProductId: string; outputQuantity: number; ingredients: RecipeItem[]}>({
    name: '',
    outputProductId: '',
    outputQuantity: 1,
    ingredients: []
  });
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [ingredientQty, setIngredientQty] = useState(1);

  // Production form state
  const [showProdForm, setShowProdForm] = useState(false);
  const [prodForm, setProdForm] = useState<{recipeId: string; date: string; quantityProduced: number; status: 'Planned' | 'In Progress' | 'Completed'; notes: string}>({
    recipeId: '',
    date: new Date().toISOString().split('T')[0],
    quantityProduced: 1,
    status: 'Completed',
    notes: ''
  });

  const products = data.products || [];
  const recipes = data.recipes || [];
  const production = data.productionRecords || [];

  const handleAddIngredient = () => {
    if(!selectedIngredient) return;
    const prod = products.find(p => p.id === selectedIngredient);
    if(!prod) return;
    
    setRecipeForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, {
        productId: prod.id,
        productName: prod.name,
        quantityRequired: ingredientQty,
        unit: prod.unit
      }]
    }));
    setSelectedIngredient('');
    setIngredientQty(1);
  };

  const handleSaveRecipe = () => {
    if(!recipeForm.name || !recipeForm.outputProductId || recipeForm.ingredients.length === 0) return;
    
    // calculate est cost
    let estCost = 0;
    recipeForm.ingredients.forEach(ing => {
      const p = products.find(prod => prod.id === ing.productId);
      if(p) estCost += (p.defaultRate * ing.quantityRequired);
    });

    const newRecipe: Recipe = {
      id: crypto.randomUUID(),
      name: recipeForm.name,
      outputProductId: recipeForm.outputProductId,
      outputQuantity: recipeForm.outputQuantity,
      ingredients: recipeForm.ingredients,
      estimatedCost: estCost
    };

    updateData(prev => ({
      ...prev,
      recipes: [...(prev.recipes || []), newRecipe]
    }));
    setShowRecipeForm(false);
    setRecipeForm({name: '', outputProductId: '', outputQuantity: 1, ingredients: []});
  };

  const handleSaveProduction = () => {
    if(!prodForm.recipeId || prodForm.quantityProduced <= 0) return;
    
    const recipe = recipes.find(r => r.id === prodForm.recipeId);
    if(!recipe) return;

    const multiplier = prodForm.quantityProduced / recipe.outputQuantity;
    const totalCost = (recipe.estimatedCost || 0) * multiplier;
    
    const newRecord: ProductionRecord = {
      id: crypto.randomUUID(),
      recipeId: recipe.id,
      date: prodForm.date,
      quantityProduced: prodForm.quantityProduced,
      costPerUnit: totalCost / prodForm.quantityProduced,
      status: prodForm.status,
      notes: prodForm.notes
    };

    // If completed, update inventory stock based on BOM
    let updatedProducts = [...products];
    if (prodForm.status === 'Completed') {
      // increase finished good
      const outIdx = updatedProducts.findIndex(p => p.id === recipe.outputProductId);
      if(outIdx >= 0) {
        updatedProducts[outIdx] = {
          ...updatedProducts[outIdx],
          currentStock: (updatedProducts[outIdx].currentStock || 0) + prodForm.quantityProduced
        };
      }
      
      // decrease raw materials
      recipe.ingredients.forEach(ing => {
        const requiredAmt = ing.quantityRequired * multiplier;
        const inIdx = updatedProducts.findIndex(p => p.id === ing.productId);
        if(inIdx >= 0) {
          updatedProducts[inIdx] = {
            ...updatedProducts[inIdx],
            currentStock: (updatedProducts[inIdx].currentStock || 0) - requiredAmt
          };
        }
      });
    }

    updateData(prev => ({
      ...prev,
      productionRecords: [...(prev.productionRecords || []), newRecord],
      products: updatedProducts
    }));

    setShowProdForm(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Manufacturing</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">BOM & Production Tracking</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['recipes', 'production'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab === 'recipes' ? 'Bill of Materials' : 'Production Logs'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'recipes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Recipe Directory</h3>
             <button onClick={() => setShowRecipeForm(!showRecipeForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-all">
               {showRecipeForm ? 'Cancel' : '+ New Recipe'}
             </button>
          </div>

          {showRecipeForm && (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-2">
              <h4 className="font-black text-slate-800 uppercase tracking-tight">Create Recipe (BOM)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recipe Name</label>
                  <input type="text" value={recipeForm.name} onChange={e => setRecipeForm({...recipeForm, name: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Standard Loaf" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Output Product</label>
                  <select value={recipeForm.outputProductId} onChange={e => setRecipeForm({...recipeForm, outputProductId: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Finished Good</option>
                    {products.filter(p => p.productType === 'FinishedGood' || !p.productType).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Output Quantity</label>
                  <input type="number" min="1" value={recipeForm.outputQuantity} onChange={e => setRecipeForm({...recipeForm, outputQuantity: Number(e.target.value)})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="border border-slate-200 p-6 rounded-2xl">
                <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4">Raw Materials / Ingredients</h5>
                <div className="flex gap-4 items-end mb-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ingredient</label>
                    <select value={selectedIngredient} onChange={e => setSelectedIngredient(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                      <option value="">Select Raw Material</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                    <input type="number" step="0.01" value={ingredientQty} onChange={e => setIngredientQty(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" />
                  </div>
                  <button onClick={handleAddIngredient} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-xs">Add</button>
                </div>

                <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-400">Material</th>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-400 text-center">Required Qty</th>
                        <th className="p-3 text-[10px] font-black uppercase text-slate-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recipeForm.ingredients.map((ing, idx) => (
                        <tr key={idx}>
                          <td className="p-3 text-sm font-bold text-slate-700">{ing.productName}</td>
                          <td className="p-3 text-sm font-bold text-slate-700 text-center">{ing.quantityRequired} {ing.unit}</td>
                          <td className="p-3 text-right">
                            <button onClick={() => setRecipeForm(p => ({...p, ingredients: p.ingredients.filter((_, i) => i !== idx)}))} className="text-rose-500 text-xs font-bold">Remove</button>
                          </td>
                        </tr>
                      ))}
                      {recipeForm.ingredients.length === 0 && (
                        <tr><td colSpan={3} className="p-4 text-center text-xs font-bold text-slate-400">No ingredients added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSaveRecipe} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md">
                  Save Recipe
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map(recipe => (
              <div key={recipe.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-black text-lg text-slate-800">{recipe.name}</h4>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase">BOM</span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 mb-4">Produces: <span className="text-slate-800">{recipe.outputQuantity} unit(s) of {products.find(p=>p.id===recipe.outputProductId)?.name}</span></p>
                  
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2 mb-2">Ingredients</p>
                    <ul className="space-y-1">
                      {recipe.ingredients.map((ing, i) => (
                        <li key={i} className="text-xs font-bold text-slate-600 flex justify-between">
                          <span>{ing.productName}</span>
                          <span>{ing.quantityRequired} {ing.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Est. Cost</span>
                  <span className="font-black text-indigo-600">₹{recipe.estimatedCost?.toLocaleString() || 0}</span>
                </div>
              </div>
            ))}
            {recipes.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 font-bold text-sm">
                No recipes defined. Create one to enable production tracking.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'production' && (
        <div className="space-y-6">
           <div className="flex justify-between items-center">
             <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Production Logs</h3>
             <button onClick={() => setShowProdForm(!showProdForm)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition-all">
               {showProdForm ? 'Cancel' : '+ New Production'}
             </button>
          </div>

          {showProdForm && (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 animate-in slide-in-from-top-2">
              <h4 className="font-black text-slate-800 uppercase tracking-tight">Record Production</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recipe / BOM</label>
                  <select value={prodForm.recipeId} onChange={e => setProdForm({...prodForm, recipeId: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm">
                    <option value="">Select Recipe</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                  <input type="date" value={prodForm.date} onChange={e => setProdForm({...prodForm, date: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Qty Produced</label>
                  <input type="number" min="1" value={prodForm.quantityProduced} onChange={e => setProdForm({...prodForm, quantityProduced: Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</label>
                  <select value={prodForm.status} onChange={e => setProdForm({...prodForm, status: e.target.value as any})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm">
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed (Deducts Stock)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                 <button onClick={handleSaveProduction} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md">
                   Save Record
                 </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Recipe</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Qty Produced</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {production.map(prod => {
                   const r = recipes.find(x => x.id === prod.recipeId);
                   return (
                     <tr key={prod.id} className="hover:bg-slate-50">
                       <td className="p-4 font-bold text-slate-600 text-sm">{new Date(prod.date).toLocaleDateString()}</td>
                       <td className="p-4 font-black text-slate-800 text-sm">{r?.name || 'Unknown Recipe'}</td>
                       <td className="p-4 font-bold text-indigo-600 text-sm">{prod.quantityProduced} Units</td>
                       <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${prod.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : prod.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {prod.status}
                          </span>
                       </td>
                     </tr>
                   )
                })}
                {production.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                      No production records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
