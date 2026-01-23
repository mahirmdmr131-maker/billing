
import React, { useState, useEffect } from 'react';
import { AppData, Sale, PaymentMethod } from '../types';
import { IconPrint } from './Icons';

interface InvoicesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  initialSale?: Sale | null;
  onResetInitialSale?: () => void;
}

type PrintMode = 'A4' | 'Thermal80' | 'Thermal58' | 'Summary';

const Invoices: React.FC<InvoicesProps> = ({ data, updateData, initialSale, onResetInitialSale }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>('A4');
  const [overrideShowPrevious, setOverrideShowPrevious] = useState<boolean | null>(null);
  const [isLargeLogo, setIsLargeLogo] = useState(false);
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>('');

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [tempPaymentMethod, setTempPaymentMethod] = useState<PaymentMethod>('Cash');

  const isAdmin = data.currentUser?.role === 'admin';

  useEffect(() => {
    if (initialSale) {
      setSelectedInvoice(initialSale);
    }
  }, [initialSale]);

  const handlePrint = () => {
    window.print();
  };

  const handlePdfExport = () => {
    window.print();
  };

  const handlePrintSummary = () => {
    setIsPrintingSummary(true);
    setTimeout(() => {
      window.print();
      setIsPrintingSummary(false);
    }, 150);
  };

  const exportBulkCSV = () => {
    const rows = [
      ['Invoice History - A M Food Processing'],
      ['Date', 'Invoice #', 'Customer', 'Status', 'Amount (₹)']
    ];
    data.sales.forEach(s => {
      rows.push([new Date(s.date).toLocaleDateString(), s.invoiceNumber, s.customerName, s.paymentMethod, s.totalAmount.toString()]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AM_Food_Invoices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const deleteInvoice = (saleId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Delete bill permanently? Stock and customer balances will be adjusted.')) return;

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
    
    const getLogoClass = () => {
        if (isThermal58) return isLargeLogo ? 'w-full px-1 mb-2' : 'w-24 mb-2';
        if (printMode === 'Thermal80') return isLargeLogo ? 'w-full mb-2' : 'w-40 mb-2';
        return isLargeLogo ? 'w-64 mb-4' : 'w-32 mb-4';
    };
    
    return (
      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100">
          <button
            onClick={() => { setSelectedInvoice(null); setOverrideShowPrevious(null); onResetInitialSale && onResetInitialSale(); }}
            className="text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-xl transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span>Back to History</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2 px-4 py-2 border border-slate-200 rounded-xl bg-slate-50">
              <input 
                type="checkbox" 
                id="large-logo" 
                checked={isLargeLogo} 
                onChange={(e) => setIsLargeLogo(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="large-logo" className="text-xs font-black uppercase text-slate-600 cursor-pointer">Large Logo</label>
            </div>
            <select className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 outline-none" value={printMode} onChange={(e) => setPrintMode(e.target.value as PrintMode)}>
              <option value="A4">A4 Desktop</option>
              <option value="Thermal80">80mm Thermal</option>
              <option value="Thermal58">58mm Mobile</option>
            </select>
            <button onClick={handlePrint} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 flex items-center space-x-2"><IconPrint /><span>Print</span></button>
            <button onClick={handlePdfExport} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              <span>PDF</span>
            </button>
            {isAdmin && <button onClick={() => deleteInvoice(selectedInvoice.id)} className="bg-rose-50 text-rose-600 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">Delete</button>}
          </div>
        </div>

        <div className={`mx-auto bg-white shadow-2xl transition-all duration-300 print-only-area ${isThermal58 ? 'max-w-[240px] p-2 text-[10px]' : printMode === 'Thermal80' ? 'max-w-[320px] p-4 text-xs' : 'max-w-[800px] p-12 text-sm'}`} style={isThermal ? { fontFamily: 'monospace' } : {}}>
          <div className="border-2 border-black p-4">
            <div className="text-center border-b-2 border-black pb-4 mb-4">
                {data.business?.logo && <img src={data.business.logo} alt="Logo" className={`${getLogoClass()} mx-auto object-contain`} />}
                <h1 className={`${isThermal58 ? 'text-lg' : 'text-3xl'} font-black uppercase`}>{data.business?.name}</h1>
                <p className="text-[10px] font-bold uppercase tracking-widest">{data.business?.tagline}</p>
                <div className="mt-2 text-[10px] font-medium leading-tight">
                    <p>{data.business?.address}</p>
                    <p>Ph: {data.business?.phone}</p>
                    {data.business?.gst && <p className="font-bold">GSTIN: {data.business.gst}</p>}
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
                        <th className="py-2">Product</th>
                        <th className="py-2 text-center">Qty</th>
                        <th className="py-2 text-center">Rate/Unit</th>
                        <th className="py-2 text-right">Amt</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                    {selectedInvoice.items.map((item, idx) => (
                        <tr key={idx} className="font-bold">
                            <td className="py-2 uppercase">{item.productName}</td>
                            <td className="py-2 text-center">{item.quantity}{item.unit}</td>
                            <td className="py-2 text-center">₹{item.rate}/{item.unit === 'gram' || item.unit === 'kg' ? 'kg' : (item.unit === 'ml' || item.unit === 'ltr' ? 'ltr' : item.unit)}</td>
                            <td className="py-2 text-right">₹{item.total.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="ml-auto w-full md:w-1/2 space-y-1 pt-4">
                <div className="flex justify-between font-bold">
                    <span>Grand Total</span>
                    <span className="text-xl">₹{selectedInvoice.totalAmount.toLocaleString()}</span>
                </div>
                <p className="text-[9px] uppercase font-black opacity-60 text-right">Payment Mode: {selectedInvoice.paymentMethod}</p>
            </div>

            <div className="mt-12 text-center border-t border-black pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest">Thanks for Visiting!</p>
                <p className="text-[8px] italic opacity-50">A M Food processing Software Solutions</p>
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
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Invoice History</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={exportBulkCSV}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95"
          >
            <span>Excel Export</span>
          </button>
          <button 
            onClick={handlePrintSummary}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-black text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all active:scale-95"
          >
            <IconPrint className="w-3 h-3" />
            <span>PDF Export</span>
          </button>
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
            {data.sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(sale.date).toLocaleDateString()}</td>
                <td className="px-8 py-5 text-sm font-black text-slate-800 uppercase">{sale.customerName}</td>
                <td className="px-8 py-5">
                   <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${sale.paymentMethod === 'Pending' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{sale.paymentMethod}</span>
                </td>
                <td className="px-8 py-5 text-right font-black text-slate-800">₹{sale.totalAmount.toLocaleString()}</td>
                <td className="px-8 py-5 text-center">
                  <button onClick={() => setSelectedInvoice(sale)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <IconPrint className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {data.sales.length === 0 && (
              <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold uppercase text-xs">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Hidden Print Summary Layout */}
      {isPrintingSummary && (
        <div className="print-only hidden print:block bg-white text-black p-10" style={{ fontFamily: 'sans-serif' }}>
           <div className="text-center mb-10 border-b-2 border-black pb-8">
              {data.business?.logo && <img src={data.business.logo} alt="Logo" className="w-32 mx-auto mb-4 object-contain" />}
              <h1 className="text-4xl font-black uppercase">{data.business?.name}</h1>
              <h2 className="text-xl font-bold uppercase tracking-[0.2em] mt-2">Sales Summary Report</h2>
              <p className="text-xs text-gray-500 mt-4 uppercase font-bold tracking-widest">Complete history of all generated invoices</p>
              <p className="text-[10px] mt-1 italic">Generated on: {new Date().toLocaleString()}</p>
           </div>

           <table className="w-full border-collapse">
              <thead>
                 <tr className="bg-gray-100 border-y-2 border-black">
                    <th className="p-3 text-left text-[10px] uppercase font-black">Date</th>
                    <th className="p-3 text-left text-[10px] uppercase font-black">Invoice #</th>
                    <th className="p-3 text-left text-[10px] uppercase font-black">Customer</th>
                    <th className="p-3 text-left text-[10px] uppercase font-black">Status</th>
                    <th className="p-3 text-right text-[10px] uppercase font-black">Amount</th>
                 </tr>
              </thead>
              <tbody>
                 {data.sales.map((s, i) => (
                    <tr key={i} className="border-b border-gray-200">
                       <td className="p-3 text-xs">{new Date(s.date).toLocaleDateString()}</td>
                       <td className="p-3 text-xs font-mono font-bold">#{s.invoiceNumber.split('-')[1]}</td>
                       <td className="p-3 text-xs font-bold uppercase">{s.customerName}</td>
                       <td className="p-3 text-[10px] uppercase font-black">{s.paymentMethod}</td>
                       <td className="p-3 text-xs text-right font-black">₹{s.totalAmount.toLocaleString()}</td>
                    </tr>
                 ))}
              </tbody>
              <tfoot>
                 <tr className="bg-gray-50 font-black border-t-2 border-black">
                    <td colSpan={4} className="p-4 text-right uppercase text-sm">Grand Consolidated Revenue</td>
                    <td className="p-4 text-right text-lg">₹{data.sales.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}</td>
                 </tr>
              </tfoot>
           </table>

           <div className="mt-24 pt-10 border-t border-black flex justify-between px-10">
              <div className="text-center">
                 <div className="w-40 border-b border-black mb-2"></div>
                 <p className="text-[10px] font-black uppercase tracking-widest">Accountant / Cashier</p>
              </div>
              <div className="text-center">
                 <div className="w-40 border-b border-black mb-2"></div>
                 <p className="text-[10px] font-black uppercase tracking-widest">Authorized Signature</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
