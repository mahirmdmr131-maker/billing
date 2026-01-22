
import React, { useState } from 'react';
import { AppData, Sale } from '../types';
import { IconPrint } from './Icons';

interface InvoicesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

type PrintMode = 'A4' | 'Thermal80' | 'Thermal58';

const Invoices: React.FC<InvoicesProps> = ({ data, updateData }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>('A4');
  const [overrideShowPrevious, setOverrideShowPrevious] = useState<boolean | null>(null);
  const [isLargeLogo, setIsLargeLogo] = useState(false);
  
  // State for editing date
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>('');

  const isAdmin = data.currentUser?.role === 'admin';

  const handlePrint = () => {
    window.print();
  };

  const handlePrintBillOnly = () => {
    const originalOverride = overrideShowPrevious;
    setOverrideShowPrevious(false);
    // Short timeout to allow React to re-render the invoice without previous dues before opening print dialog
    setTimeout(() => {
      window.print();
      setOverrideShowPrevious(originalOverride);
    }, 100);
  };

  const toggleMistakeStatus = (saleId: string) => {
    updateData(prev => ({
      ...prev,
      sales: prev.sales.map(s => 
        s.id === saleId ? { ...s, isMistake: !s.isMistake } : s
      )
    }));
  };

  const handleSaveDate = (saleId: string) => {
    if (!tempDate) return;
    updateData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === saleId ? { ...s, date: tempDate } : s)
    }));
    setEditingDateId(null);
  };

  const deleteInvoice = (saleId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Move this bill to Recycle Bin? This will also revert any balance added to the customer and restore product stock.')) return;

    updateData(prev => {
      const saleToRemove = prev.sales.find(s => s.id === saleId);
      if (!saleToRemove) return prev;

      let updatedCustomers = [...prev.customers];
      // Revert balance if it was a pending sale
      if (saleToRemove.paymentMethod === 'Pending' && saleToRemove.customerId) {
        updatedCustomers = updatedCustomers.map(c => 
          c.id === saleToRemove.customerId 
            ? { ...c, pendingBalance: Math.max(0, (c.pendingBalance || 0) - saleToRemove.totalAmount) } 
            : c
        );
      }

      // Revert stock decrement
      const updatedProducts = [...prev.products];
      saleToRemove.items.forEach(item => {
        const productIndex = updatedProducts.findIndex(p => p.name.toLowerCase() === item.productName.toLowerCase());
        if (productIndex !== -1 && updatedProducts[productIndex].currentStock !== undefined) {
          updatedProducts[productIndex] = {
            ...updatedProducts[productIndex],
            currentStock: (updatedProducts[productIndex].currentStock || 0) + item.quantity
          };
        }
      });

      return {
        ...prev,
        sales: prev.sales.filter(s => s.id !== saleId),
        recycleBin: {
          ...prev.recycleBin,
          sales: [...prev.recycleBin.sales, { ...saleToRemove, deletedAt: new Date().toISOString() }]
        },
        customers: updatedCustomers,
        products: updatedProducts
      };
    });

    // Deselect if the current open invoice was just deleted
    if (selectedInvoice?.id === saleId) {
      setSelectedInvoice(null);
    }
  };

  const exportCompleteEntries = () => {
    if (!isAdmin) return;

    const headers = [
      'Invoice Number',
      'Date',
      'Customer Name',
      'Product Name',
      'Quantity',
      'Unit',
      'Rate (INR)',
      'Item Total (INR)',
      'Grand Total',
      'Status',
      'Created By'
    ];

    const rows = [headers];

    data.sales.forEach(sale => {
      const creator = data.users.find(u => u.id === sale.createdBy)?.username || 'System';
      const status = sale.isMistake ? 'MISTAKE' : 'SUCCESS';
      
      sale.items.forEach(item => {
        rows.push([
          sale.invoiceNumber,
          sale.date,
          `"${sale.customerName.replace(/"/g, '""')}"`,
          `"${item.productName.replace(/"/g, '""')}"`,
          item.quantity.toString(),
          item.unit,
          item.rate.toString(),
          item.total.toString(),
          sale.totalAmount.toString(),
          status,
          creator
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AM_Food_All_Entries_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showPrevious = overrideShowPrevious !== null ? overrideShowPrevious : !!selectedInvoice?.includePreviousBalance;

  if (selectedInvoice) {
    const isThermal = printMode === 'Thermal80' || printMode === 'Thermal58';
    const isThermal58 = printMode === 'Thermal58';

    const customer = data.customers.find(c => c.id === selectedInvoice.customerId);
    const hasCustomer = !!customer;
    const previousBalance = hasCustomer ? (customer.pendingBalance || 0) : 0;

    const getLogoClass = () => {
        if (isThermal58) {
            return isLargeLogo ? 'w-full max-w-[160px] h-auto px-1 mb-2' : 'w-24 h-24 mb-4';
        }
        if (printMode === 'Thermal80') {
            return isLargeLogo ? 'w-full max-w-[240px] h-auto mb-2' : 'w-48 h-48 mb-4';
        }
        // A4 Mode
        return isLargeLogo ? 'w-full max-w-[500px] h-auto mb-8' : 'w-72 h-72 mb-4';
    };
    
    return (
      <div className="space-y-6">
        <div className="no-print flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <button
            onClick={() => { setSelectedInvoice(null); setOverrideShowPrevious(null); }}
            className="text-slate-500 font-semibold hover:text-slate-800 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to List</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Print Options</label>
                <div className="flex gap-2">
                    {hasCustomer && (
                        <label className="flex items-center space-x-2 bg-white px-4 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={showPrevious} 
                                onChange={e => setOverrideShowPrevious(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
                            />
                            <span className="text-xs font-bold text-slate-700">Include Dues</span>
                        </label>
                    )}
                    <label className="flex items-center space-x-2 bg-white px-4 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={isLargeLogo} 
                            onChange={e => setIsLargeLogo(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
                        />
                        <span className="text-xs font-bold text-slate-700">Large Logo</span>
                    </label>
                </div>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Paper Size</label>
              <select
                className="px-4 py-2 border border-slate-300 rounded-lg outline-none text-sm font-bold bg-white"
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value as PrintMode)}
              >
                <option value="A4">Standard A4</option>
                <option value="Thermal80">Thermal (80mm)</option>
                <option value="Thermal58">Thermal (58mm)</option>
              </select>
            </div>
            <div className="flex items-center space-x-2 mt-4">
              <button
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center space-x-2 transition-all active:scale-95"
              >
                <IconPrint />
                <span>Print Invoice</span>
              </button>
              {hasCustomer && (
                <button
                  onClick={handlePrintBillOnly}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center space-x-2 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    <circle cx="12" cy="12" r="3" fill="white" stroke="none" />
                  </svg>
                  <span>Print Bill Only</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => deleteInvoice(selectedInvoice.id)}
                  className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-6 py-2 rounded-lg font-bold shadow-md flex items-center space-x-2 transition-all active:scale-95 border border-red-100"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Bill</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div 
          className={`mx-auto bg-white shadow-2xl transition-all duration-300 ${
            isThermal58 ? 'max-w-[210px] p-2' : 
            printMode === 'Thermal80' ? 'max-w-[300px] p-4' : 
            'max-w-[800px] aspect-[1/1.41] p-8 md:p-12'
          }`}
          style={isThermal ? { fontFamily: 'monospace' } : {}}
        >
          {selectedInvoice.isMistake && (
            <div className="bg-red-600 text-white text-center py-1 px-2 rounded mb-4 font-black uppercase tracking-widest text-[10px]">
              Mistaken / Cancelled
            </div>
          )}
          
          <div className={`flex flex-col items-center border-b border-slate-200 pb-4 mb-4 text-center ${isThermal ? 'border-dashed' : 'border-slate-100'}`}>
            {data.business?.logo && (
              <img 
                src={data.business.logo} 
                alt="Logo" 
                className={`${getLogoClass()} object-contain`} 
              />
            )}
            <h1 className={`${isThermal58 ? 'text-sm' : 'text-2xl'} font-black uppercase tracking-tight text-slate-800`}>
              {data.business?.name}
            </h1>
            <p className={`${isThermal58 ? 'text-[8px]' : 'text-sm'} font-medium text-slate-500 uppercase italic`}>
              {data.business?.tagline}
            </p>
            <div className={`${isThermal58 ? 'text-[8px]' : 'text-[11px]'} mt-2 text-slate-500 space-y-0.5 leading-tight`}>
              <p>{data.business?.address}</p>
              <p>Ph: {data.business?.phone}</p>
              {data.business?.gst && <p className="font-bold">GSTIN: {data.business.gst}</p>}
            </div>
          </div>

          <div className={`flex justify-between mb-4 ${isThermal58 ? 'text-[8px]' : 'text-xs'}`}>
            <div className="space-y-0.5">
              <p className="text-slate-400 font-bold uppercase text-[6px] tracking-widest">Bill To</p>
              <p className="font-bold text-slate-800 uppercase">{selectedInvoice.customerName}</p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-slate-400 font-bold uppercase text-[6px] tracking-widest">Bill Info</p>
              <p className="font-bold text-slate-800">#{selectedInvoice.invoiceNumber.split('-')[1]}</p>
              <p className="text-slate-600">{new Date(selectedInvoice.date).toLocaleDateString()}</p>
            </div>
          </div>

          <table className="w-full mb-4">
            <thead className={`border-y border-slate-200 ${isThermal ? 'border-dashed' : ''} bg-slate-50`}>
              <tr className={`${isThermal58 ? 'text-[8px]' : 'text-[10px]'} uppercase font-black`}>
                <th className="py-1 text-left text-slate-600">Item</th>
                <th className="py-1 text-center text-slate-600">Qty</th>
                <th className="py-1 text-right text-slate-600">Amt</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${isThermal ? 'divide-dashed' : ''} ${isThermal58 ? 'text-[8px]' : 'text-xs'}`}>
              {selectedInvoice.items.map((item, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-1 font-medium text-slate-800 break-words max-w-[80px]">{item.productName}</td>
                  <td className="py-1 text-center whitespace-nowrap">{item.quantity}{item.unit}</td>
                  <td className="py-1 text-right font-bold">₹{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={`ml-auto w-full space-y-1 pt-2 border-t-2 ${isThermal ? 'border-dashed border-slate-800' : 'border-slate-800 md:w-1/2'}`}>
             <div className={`flex justify-between ${isThermal58 ? 'text-[8px]' : 'text-xs'}`}>
                <span className="text-slate-500 font-bold">Subtotal (Current Bill)</span>
                <span className="font-bold text-slate-800">₹{selectedInvoice.totalAmount.toLocaleString()}</span>
             </div>
             
             {hasCustomer && showPrevious && (
               <>
                 <div className={`flex justify-between ${isThermal58 ? 'text-[8px]' : 'text-xs'} border-t border-slate-100 mt-1 pt-1`}>
                    <span className="text-slate-400 font-medium italic">Previous Pending</span>
                    <span className="text-slate-500">₹{previousBalance.toLocaleString()}</span>
                 </div>
                 <div className={`flex justify-between items-center ${isThermal ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white'} p-1.5 rounded mt-2`}>
                    <span className="font-bold uppercase tracking-widest text-[8px]">Total Outstanding</span>
                    <span className={`${isThermal58 ? 'text-xs' : 'text-lg'} font-black`}>₹{(selectedInvoice.totalAmount + previousBalance).toLocaleString()}</span>
                 </div>
               </>
             )}

             {(!hasCustomer || !showPrevious) && (
               <div className={`flex justify-between items-center ${isThermal ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white'} p-1.5 rounded mt-2`}>
                  <span className="font-bold uppercase tracking-widest text-[8px]">Grand Total</span>
                  <span className={`${isThermal58 ? 'text-xs' : 'text-lg'} font-black`}>₹{selectedInvoice.totalAmount.toLocaleString()}</span>
               </div>
             )}
          </div>

          <div className="mt-6 text-center space-y-1 pb-4">
            <p className={`${isThermal58 ? 'text-[6px]' : 'text-[9px]'} font-black text-slate-500 uppercase tracking-widest`}>
              Thanks! Visit Again
            </p>
            <p className="text-[6px] text-slate-300 italic leading-none">
              Generated by AM Food processing
            </p>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden; }
            .mx-auto.bg-white { 
              visibility: visible; 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 100%; 
              box-shadow: none !important; 
              padding: 0 !important; 
              margin: 0 !important; 
            }
            .mx-auto.bg-white * { visibility: visible; }
            @page { margin: 0; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Saved Invoices</h3>
        {isAdmin && (
          <button
            onClick={exportCompleteEntries}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold shadow-md flex items-center space-x-2 transition-all active:scale-95 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export All Entries (Admin)</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Inv #</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sales.length > 0 ? data.sales.map((sale) => (
                <tr key={sale.id} className={`transition-colors ${sale.isMistake ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4 text-sm font-mono font-black text-indigo-600">
                    {sale.invoiceNumber}
                    {sale.isMistake && <span className="block text-[8px] font-black uppercase text-red-500">MISTAKE</span>}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{sale.customerName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {editingDateId === sale.id ? (
                      <div className="flex items-center space-x-2">
                        <input 
                          type="date" 
                          className="px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500"
                          value={tempDate}
                          onChange={(e) => setTempDate(e.target.value)}
                        />
                        <button 
                          onClick={() => handleSaveDate(sale.id)}
                          className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button 
                          onClick={() => setEditingDateId(null)}
                          className="p-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center group/date">
                        <span>{new Date(sale.date).toLocaleDateString()}</span>
                        {isAdmin && (
                          <button 
                            onClick={() => { setEditingDateId(sale.id); setTempDate(sale.date); }}
                            className="ml-2 opacity-0 group-hover/date:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-opacity"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">₹{sale.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => setSelectedInvoice(sale)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center space-x-1"
                      >
                        <IconPrint className="w-4 h-4" />
                        <span className="text-xs font-bold">View</span>
                      </button>
                      <button
                        onClick={() => toggleMistakeStatus(sale.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all border ${sale.isMistake ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
                        title={sale.isMistake ? "Mark as valid bill" : "Mark as mistake"}
                      >
                        {sale.isMistake ? 'Unflag' : 'Mistake'}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => deleteInvoice(sale.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all group"
                          title="Move to Recycle Bin"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">No invoices generated yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
