
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

  const isAdmin = data.currentUser?.role === 'admin';

  const handlePrint = () => {
    window.print();
  };

  const toggleMistakeStatus = (saleId: string) => {
    updateData(prev => ({
      ...prev,
      sales: prev.sales.map(s => 
        s.id === saleId ? { ...s, isMistake: !s.isMistake } : s
      )
    }));
  };

  const exportCompleteEntries = () => {
    if (!isAdmin) return;

    // Header row for the flattened CSV
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
          `"${sale.customerName.replace(/"/g, '""')}"`, // Escape quotes for CSV
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

  if (selectedInvoice) {
    const isThermal = printMode === 'Thermal80' || printMode === 'Thermal58';
    const isThermal58 = printMode === 'Thermal58';
    
    return (
      <div className="space-y-6">
        <div className="no-print flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <button
            onClick={() => setSelectedInvoice(null)}
            className="text-slate-500 font-semibold hover:text-slate-800 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to List</span>
          </button>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1">Paper Size</label>
              <select
                className="px-4 py-2 border border-slate-300 rounded-lg outline-none text-sm font-bold"
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value as PrintMode)}
              >
                <option value="A4">Standard A4</option>
                <option value="Thermal80">Thermal (80mm)</option>
                <option value="Thermal58">Thermal (58mm)</option>
              </select>
            </div>
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center space-x-2 mt-4"
            >
              <IconPrint />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Invoice Paper Rendering */}
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
          
          {/* Header */}
          <div className={`flex flex-col items-center border-b border-slate-200 pb-4 mb-4 text-center ${isThermal ? 'border-dashed' : 'border-slate-100'}`}>
            {data.business?.logo && (
              <img 
                src={data.business.logo} 
                alt="Logo" 
                className={`${isThermal58 ? 'w-16 h-16' : 'w-48 h-48'} object-contain mb-2`} 
              />
            )}
            <h1 className={`${isThermal58 ? 'text-xs' : 'text-xl'} font-black uppercase tracking-tight text-slate-800`}>
              {data.business?.name}
            </h1>
            <p className={`${isThermal58 ? 'text-[7px]' : 'text-xs'} font-medium text-slate-500 uppercase italic`}>
              {data.business?.tagline}
            </p>
            <div className={`${isThermal58 ? 'text-[7px]' : 'text-[10px]'} mt-2 text-slate-500 space-y-0.5 leading-tight`}>
              <p>{data.business?.address}</p>
              <p>Ph: {data.business?.phone}</p>
              {data.business?.gst && <p className="font-bold">GSTIN: {data.business.gst}</p>}
            </div>
          </div>

          {/* Info */}
          <div className={`flex justify-between mb-4 ${isThermal58 ? 'text-[7px]' : 'text-xs'}`}>
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

          {/* Table */}
          <table className="w-full mb-4">
            <thead className={`border-y border-slate-200 ${isThermal ? 'border-dashed' : ''} bg-slate-50`}>
              <tr className={`${isThermal58 ? 'text-[7px]' : 'text-[10px]'} uppercase font-black`}>
                <th className="py-1 text-left text-slate-600">Item</th>
                <th className="py-1 text-center text-slate-600">Qty</th>
                <th className="py-1 text-right text-slate-600">Amt</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${isThermal ? 'divide-dashed' : ''} ${isThermal58 ? 'text-[7px]' : 'text-xs'}`}>
              {selectedInvoice.items.map((item, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-1 font-medium text-slate-800 break-words max-w-[80px]">{item.productName}</td>
                  <td className="py-1 text-center whitespace-nowrap">{item.quantity}{item.unit}</td>
                  <td className="py-1 text-right font-bold">₹{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className={`ml-auto w-full space-y-1 pt-2 border-t-2 ${isThermal ? 'border-dashed border-slate-800' : 'border-slate-800 md:w-1/2'}`}>
             <div className={`flex justify-between ${isThermal58 ? 'text-[7px]' : 'text-xs'}`}>
                <span className="text-slate-500 font-bold">Subtotal</span>
                <span className="font-bold text-slate-800">₹{selectedInvoice.totalAmount.toLocaleString()}</span>
             </div>
             <div className={`flex justify-between items-center ${isThermal ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white'} p-1.5 rounded mt-2`}>
                <span className="font-bold uppercase tracking-widest text-[8px]">Grand Total</span>
                <span className={`${isThermal58 ? 'text-xs' : 'text-lg'} font-black`}>₹{selectedInvoice.totalAmount.toLocaleString()}</span>
             </div>
          </div>

          {/* Footer */}
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
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(sale.date).toLocaleDateString()}</td>
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
                        {sale.isMistake ? 'Unflag Mistake' : 'Flag Mistake'}
                      </button>
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
