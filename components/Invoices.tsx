
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Sale, PaymentMethod } from '../types';
import { IconPrint } from './Icons';

interface InvoicesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  initialSale?: Sale | null;
  onResetInitialSale?: () => void;
}

type PrintMode = 'A4' | 'Thermal80' | 'Thermal58' | 'Summary';
type StatusFilter = 'All' | 'Paid' | 'Pending';

const Invoices: React.FC<InvoicesProps> = ({ data, updateData, initialSale, onResetInitialSale }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>('A4');
  const [isLargeLogo, setIsLargeLogo] = useState(false);
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  
  const isAdmin = data.currentUser?.role === 'admin';

  useEffect(() => {
    if (initialSale) {
      setSelectedInvoice(initialSale);
    }
  }, [initialSale]);

  const filteredSales = useMemo(() => {
    let sales = (data.sales || []).filter(s => !s.isMistake);
    if (statusFilter === 'Paid') {
      sales = sales.filter(s => s.paymentMethod !== 'Pending');
    } else if (statusFilter === 'Pending') {
      sales = sales.filter(s => s.paymentMethod === 'Pending');
    }
    return sales.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.sales, statusFilter]);

  const handlePrint = () => {
    window.print();
  };

  const handlePrintSummary = () => {
    setIsPrintingSummary(true);
    setTimeout(() => {
      window.print();
      setIsPrintingSummary(false);
    }, 500);
  };

  const exportBulkCSV = () => {
    const rows = [
      [`Invoice Export (${statusFilter}) - A M Food Processing`],
      ['Date', 'Invoice #', 'Customer', 'Status', 'Amount (₹)']
    ];
    filteredSales.forEach(s => {
      rows.push([new Date(s.date).toLocaleDateString(), s.invoiceNumber, s.customerName, s.paymentMethod, s.totalAmount.toString()]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AM_Invoices_${statusFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const deleteInvoice = (saleId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Delete bill permanently?')) return;

    updateData(prev => {
      const saleToRemove = prev.sales.find(s => s.id === saleId);
      if (!saleToRemove) return prev;

      let updatedCustomers = [...prev.customers];
      if (saleToRemove.paymentMethod === 'Pending' && saleToRemove.customerId) {
        updatedCustomers = updatedCustomers.map(c => 
          c.id === saleToRemove.customerId 
            ? { ...c, pendingBalance: Math.max(0, (c.pendingBalance || 0) - saleToRemove.totalAmount) } 
            : c
        );
      }

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

    if (selectedInvoice?.id === saleId) {
      setSelectedInvoice(null);
    }
  };

  if (selectedInvoice) {
    const isThermal = printMode === 'Thermal80' || printMode === 'Thermal58';
    const isThermal58 = printMode === 'Thermal58';
    
    return (
      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100">
          <button
            onClick={() => { setSelectedInvoice(null); onResetInitialSale && onResetInitialSale(); }}
            className="text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-xl transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span>Back to History</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-4">
            <select className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 outline-none" value={printMode} onChange={(e) => setPrintMode(e.target.value as PrintMode)}>
              <option value="A4">A4 Desktop</option>
              <option value="Thermal80">80mm Thermal</option>
              <option value="Thermal58">58mm Mobile</option>
            </select>
            <button onClick={handlePrint} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 flex items-center space-x-2"><IconPrint /><span>Print Bill</span></button>
          </div>
        </div>

        <div className={`mx-auto bg-white shadow-2xl transition-all duration-300 print-only-area ${isThermal58 ? 'max-w-[240px] p-2 text-[10px]' : printMode === 'Thermal80' ? 'max-w-[320px] p-4 text-xs' : 'max-w-[800px] p-12 text-sm'}`} style={isThermal ? { fontFamily: 'monospace' } : {}}>
          <div className="border-2 border-black p-4">
            <div className="text-center border-b-2 border-black pb-4 mb-4">
                {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-24 mx-auto mb-2 object-contain" />}
                <h1 className={`${isThermal58 ? 'text-lg' : 'text-3xl'} font-black uppercase`}>{data.business?.name}</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest">{data.business?.tagline}</p>
                <div className="mt-2 text-[10px] font-medium">
                    <p>{data.business?.address}</p>
                    <p>Ph: {data.business?.phone}</p>
                </div>
            </div>

            <div className="flex justify-between mb-4 text-[10px] font-bold uppercase">
                <div className="text-left">
                    <p className="opacity-50">Customer</p>
                    <p className="text-lg">{selectedInvoice.customerName}</p>
                </div>
                <div className="text-right">
                    <p className="opacity-50">Invoice No</p>
                    <p>#{selectedInvoice.invoiceNumber.split('-')[1]}</p>
                    <p>{new Date(selectedInvoice.date).toLocaleDateString()}</p>
                </div>
            </div>

            <table className="w-full mb-6 text-left border-collapse">
                <thead className="border-y-2 border-black">
                    <tr className="uppercase font-black text-[10px]">
                        <th className="py-2">Item & Safety Detail</th>
                        <th className="py-2 text-center">Qty</th>
                        <th className="py-2 text-right">Amt</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                    {selectedInvoice.items.map((item, idx) => (
                        <tr key={idx} className="font-bold">
                            <td className="py-2 uppercase">
                              {item.productName}
                              {(item.batchNumber || item.expiryDate) && (
                                <div className="text-[8px] opacity-60">
                                  {item.batchNumber && `B:${item.batchNumber}`} {item.expiryDate && `| E:${item.expiryDate}`}
                                </div>
                              )}
                            </td>
                            <td className="py-2 text-center">{item.quantity}{item.unit}</td>
                            <td className="py-2 text-right">₹{item.total.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="ml-auto w-full md:w-1/2 space-y-1 pt-4 border-t-2 border-black">
                <div className="flex justify-between font-black">
                    <span>Grand Total</span>
                    <span className="text-xl">₹{selectedInvoice.totalAmount.toLocaleString()}</span>
                </div>
                <p className="text-[9px] uppercase font-black opacity-60 text-right">Payment Status: {selectedInvoice.paymentMethod}</p>
            </div>

            <div className="mt-12 text-center border-t border-black pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest">A M Food Processing - Quality Guaranteed</p>
            </div>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * { visibility: hidden !important; }
            .print-only-area, .print-only-area * { visibility: visible !important; }
            .print-only-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
            @page { margin: 0; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Invoice History</h3>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['All', 'Paid', 'Pending'] as StatusFilter[]).map(f => (
              <button 
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportBulkCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Excel Export</button>
          <button onClick={handlePrintSummary} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Print Summary</button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-5">Date</th>
              <th className="px-8 py-5">Customer</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Amount</th>
              <th className="px-8 py-5 text-center">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(sale.date).toLocaleDateString()}</td>
                <td className="px-8 py-5 text-sm font-black text-slate-800 uppercase">{sale.customerName}</td>
                <td className="px-8 py-5">
                   <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${sale.paymentMethod === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{sale.paymentMethod}</span>
                </td>
                <td className="px-8 py-5 text-right font-black text-slate-800">₹{sale.totalAmount.toLocaleString()}</td>
                <td className="px-8 py-5 text-center">
                  <button onClick={() => setSelectedInvoice(sale)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <IconPrint className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Invoices;
