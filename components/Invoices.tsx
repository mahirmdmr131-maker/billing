import React, { useState, useEffect, useMemo } from 'react';
import { AppData, Sale, PaymentMethod } from '../types';
import { IconPrint, IconEdit, IconTrash, IconDuplicate } from './Icons';
import { printElement } from '../utils/printer';
import { saveOrDownloadFile } from '../utils/fileSaver';

interface InvoicesProps {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
  initialSale?: Sale | null;
  onResetInitialSale?: () => void;
  onDuplicate?: (sale: Sale) => void;
}

type PrintMode = 'A4' | 'Thermal80' | 'Thermal58' | 'Summary';
type StatusFilter = 'All' | 'Paid' | 'Pending';
type InvoiceSortKey = 'date' | 'amount' | 'customer' | 'invoice';
type SortDirection = 'asc' | 'desc';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.split('-').reverse().join('/');
};

const applyTemplate = (text: string, sale: Sale) => {
  if (!text) return '';
  return text
    .replace(/{{inv_number}}/g, sale.invoiceNumber)
    .replace(/{{cust_name}}/g, sale.customerName)
    .replace(/{{total_due}}/g, `₹${sale.totalAmount.toLocaleString()}`)
    .replace(/{{date}}/g, formatDate(sale.date));
};

const Invoices: React.FC<InvoicesProps> = ({ data, updateData, initialSale, onResetInitialSale, onDuplicate }) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);
  const [printMode, setPrintMode] = useState<PrintMode>('Thermal80');
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<InvoiceSortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    date: '',
    paymentMethod: 'Cash' as PaymentMethod
  });
  
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
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      sales = sales.filter(s => 
        s.customerName.toLowerCase().includes(searchLower) ||
        s.invoiceNumber.toLowerCase().includes(searchLower) ||
        (s.customerContact && s.customerContact.includes(searchTerm))
      );
    }

    return sales.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'amount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'customer':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'invoice':
          comparison = a.invoiceNumber.localeCompare(b.invoiceNumber);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data.sales, statusFilter, searchTerm, sortKey, sortDirection]);

  const toggleSort = (key: InvoiceSortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection(key === 'date' || key === 'amount' ? 'desc' : 'asc');
    }
  };

  const SortButton: React.FC<{ label: string; keyName: InvoiceSortKey }> = ({ label, keyName }) => (
    <button 
      onClick={() => toggleSort(keyName)}
      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-1 border shadow-sm ${
        sortKey === keyName 
          ? 'bg-indigo-600 text-white border-indigo-700' 
          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      <span>{label}</span>
      <span className={`transition-transform duration-200 ${sortKey === keyName && sortDirection === 'desc' ? 'rotate-180' : ''}`}>
        {sortKey === keyName ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg className="w-3 h-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
        )}
      </span>
    </button>
  );

  const volumeAnalysis = useMemo(() => {
    const totals: Record<string, number> = {};
    
    filteredSales.forEach(sale => {
        sale.items.forEach(item => {
            let unit = (item.unit || 'Units').toLowerCase().trim();
            // Normalize common variations
            if (unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') unit = 'kg';
            if (unit === 'gm' || unit === 'gms' || unit === 'gram' || unit === 'grams') unit = 'g';
            if (unit === 'ltr' || unit === 'liter' || unit === 'liters') unit = 'l';
            if (unit === 'ml' || unit === 'milli') unit = 'ml';
            if (unit === 'pcs' || unit === 'pieces' || unit === 'nos') unit = 'pcs';

            totals[unit] = (totals[unit] || 0) + Number(item.quantity || 0);
        });
    });
    
    return Object.entries(totals)
        .filter(([_, qty]) => qty > 0)
        .sort((a, b) => b[1] - a[1]);
  }, [filteredSales]);

  const handlePrint = () => {
    printElement('print-engine', selectedInvoice ? `Invoice ${selectedInvoice.invoiceNumber}` : 'Invoice');
  };

  const handleQuickEdit = (sale: Sale) => {
    setSelectedInvoice(sale);
    setEditFormData({
      date: sale.date,
      paymentMethod: sale.paymentMethod
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!selectedInvoice) return;
    updateData(prev => {
      const saleIndex = prev.sales.findIndex(s => s.id === selectedInvoice.id);
      if (saleIndex === -1) return prev;
      const oldSale = prev.sales[saleIndex];
      const newMethod = editFormData.paymentMethod;
      const oldMethod = oldSale.paymentMethod;
      let updatedCustomers = [...prev.customers];
      if (oldSale.customerId) {
        if (oldMethod === 'Pending' && newMethod !== 'Pending') {
          updatedCustomers = updatedCustomers.map(c => c.id === oldSale.customerId ? { ...c, pendingBalance: Math.max(0, c.pendingBalance - oldSale.totalAmount) } : c);
        } else if (oldMethod !== 'Pending' && newMethod === 'Pending') {
          updatedCustomers = updatedCustomers.map(c => c.id === oldSale.customerId ? { ...c, pendingBalance: c.pendingBalance + oldSale.totalAmount } : c);
        }
      }
      const updatedSales = [...prev.sales];
      updatedSales[saleIndex] = { ...oldSale, date: editFormData.date, paymentMethod: newMethod, originalPaymentMethod: oldSale.originalPaymentMethod || (oldMethod === 'Pending' ? 'Pending' : undefined), paidDate: (oldMethod === 'Pending' && newMethod !== 'Pending') ? new Date().toISOString().split('T')[0] : oldSale.paidDate };
      setSelectedInvoice(updatedSales[saleIndex]);
      return { ...prev, sales: updatedSales, customers: updatedCustomers };
    });
    setIsEditing(false);
    alert('Invoice updated successfully.');
  };

  const updatePaymentMethod = (saleId: string, newMethod: PaymentMethod) => {
    if (!isAdmin) return;
    updateData(prev => {
      const saleIndex = prev.sales.findIndex(s => s.id === saleId);
      if (saleIndex === -1) return prev;
      const oldSale = prev.sales[saleIndex];
      const oldMethod = oldSale.paymentMethod;
      if (oldMethod === newMethod) return prev;

      let updatedCustomers = [...prev.customers];
      if (oldSale.customerId) {
        if (oldMethod === 'Pending' && newMethod !== 'Pending') {
          updatedCustomers = updatedCustomers.map(c => c.id === oldSale.customerId ? { ...c, pendingBalance: Math.max(0, (c.pendingBalance || 0) - oldSale.totalAmount) } : c);
        } else if (oldMethod !== 'Pending' && newMethod === 'Pending') {
          updatedCustomers = updatedCustomers.map(c => c.id === oldSale.customerId ? { ...c, pendingBalance: (c.pendingBalance || 0) + oldSale.totalAmount } : c);
        }
      }
      const updatedSales = [...prev.sales];
      updatedSales[saleIndex] = { 
        ...oldSale, 
        paymentMethod: newMethod, 
        originalPaymentMethod: oldSale.originalPaymentMethod || (oldMethod === 'Pending' ? 'Pending' : undefined),
        paidDate: (oldMethod === 'Pending' && newMethod !== 'Pending') ? new Date().toISOString().split('T')[0] : oldSale.paidDate 
      };
      return { ...prev, sales: updatedSales, customers: updatedCustomers };
    });
  };

  const deleteInvoice = (saleId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Delete bill? Item will be moved to Recycle Bin.')) return;
    updateData(prev => {
      const saleToRemove = prev.sales.find(s => s.id === saleId);
      if (!saleToRemove) return prev;
      let updatedCustomers = [...prev.customers];
      if (saleToRemove.paymentMethod === 'Pending' && saleToRemove.customerId) {
        updatedCustomers = updatedCustomers.map(c => c.id === saleToRemove.customerId ? { ...c, pendingBalance: Math.max(0, (c.pendingBalance || 0) - saleToRemove.totalAmount) } : c);
      }
      return { ...prev, sales: prev.sales.filter(s => s.id !== saleId), recycleBin: { ...prev.recycleBin, sales: [...prev.recycleBin.sales, { ...saleToRemove, deletedAt: new Date().toISOString() }] }, customers: updatedCustomers };
    });
    if (selectedInvoice?.id === saleId) setSelectedInvoice(null);
  };

  if (selectedInvoice) {
    const isThermal = printMode === 'Thermal80' || printMode === 'Thermal58';
    const customer = selectedInvoice.customerId ? data.customers.find(c => c.id === selectedInvoice.customerId) : null;
    const currentTotalDues = customer?.pendingBalance || 0;
    const currentTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const paperWidth = printMode === 'Thermal58' ? '58mm' : printMode === 'Thermal80' ? '80mm' : '210mm';
    const template = data.templateSettings;
    const useTemplate = template.applyToPrinting;

    // PRINT SCALING LOGIC
    const scalingFactor = printMode === 'Thermal58' ? 0.75 : printMode === 'Thermal80' ? 0.9 : 1.0;
    const baseFontSize = useTemplate ? template.fontSize : 14;
    const effectiveFontSize = baseFontSize * scalingFactor;

    return (
      <div className="space-y-6">
        {/* Dynamic Page Hinting for Printers */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { 
              size: ${paperWidth} auto; 
              margin: 0 !important; 
            }
            #print-engine {
              width: ${paperWidth} !important;
              margin: 0 !important;
              padding: 0 !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
          }
        `}} />

        <div className="no-print flex flex-wrap items-center justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100">
          <button
            onClick={() => { setSelectedInvoice(null); onResetInitialSale?.(); setIsEditing(false); }}
            className="text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-xl transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span>Back to History</span>
          </button>
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && !isEditing && (
              <button onClick={() => handleQuickEdit(selectedInvoice)} className="bg-amber-50 text-amber-700 border border-amber-100 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center space-x-2 shadow-sm">
                <IconEdit className="w-4 h-4" /><span>Edit Info</span>
              </button>
            )}
            <select className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 outline-none" value={printMode} onChange={(e) => setPrintMode(e.target.value as PrintMode)}>
              <option value="A4">A4 Size</option><option value="Thermal80">80mm Thermal</option><option value="Thermal58">58mm Mobile</option>
            </select>
            <button onClick={handlePrint} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 flex items-center space-x-2"><IconPrint /><span>Print Bill</span></button>
          </div>
        </div>

        {isEditing && isAdmin && (
          <div className="no-print bg-indigo-50 border-2 border-indigo-200 p-8 rounded-3xl animate-in slide-in-from-top-4 duration-300">
             <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-6 flex items-center gap-2"><IconEdit className="w-5 h-5" /> Modify Record</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Billing Date</label><input type="date" className="w-full px-4 py-3 border border-indigo-200 rounded-xl outline-none font-bold" value={editFormData.date} onChange={e => setEditFormData({...editFormData, date: e.target.value})} /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Method</label><select className="w-full px-4 py-3 border border-indigo-200 rounded-xl outline-none font-bold" value={editFormData.paymentMethod} onChange={e => setEditFormData({...editFormData, paymentMethod: e.target.value as PaymentMethod})}><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Pending">Pending</option></select></div>
             </div>
             <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-indigo-200"><button onClick={() => setIsEditing(false)} className="px-8 py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest">Cancel</button><button onClick={saveEdit} className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase text-[10px] tracking-widest">Apply Changes</button></div>
          </div>
        )}

        <div className="flex-1 bg-slate-100 p-4 md:p-12 flex justify-center no-scrollbar print:static print:block print:p-0 print:bg-white print:overflow-visible">
          {/* CANVAS POWERED PRINT ENGINE */}
          <div id="print-engine" className="bg-white shadow-2xl transition-all duration-300 print:shadow-none print:m-0 print:static" style={{ 
            width: paperWidth, 
            minHeight: printMode === 'A4' ? '297mm' : 'auto', 
            fontSize: `${effectiveFontSize}px`, 
            lineHeight: useTemplate ? template.lineSpacing : 1.2, 
            fontFamily: isThermal ? 'monospace' : 'inherit', 
            color: 'black', 
            boxSizing: 'border-box',
            overflow: 'hidden',
            wordBreak: 'break-word'
          }}>
            <div className={`${(useTemplate && template.compactMode) ? 'p-1' : (isThermal ? 'p-2' : 'p-8')} border-black`} style={{ 
              borderWidth: useTemplate ? `${template.borderWeight}px` : '2px',
              borderColor: useTemplate ? template.brandColor : '#000',
              paddingLeft: (useTemplate && template.compactMode) ? '1mm' : (isThermal ? '2mm' : '8mm'), 
              paddingRight: (useTemplate && template.compactMode) ? '1mm' : (isThermal ? '2mm' : '8mm')
            }}>
              <div className="text-center mb-4">
                {((useTemplate ? template.showLogo : true) && data.business?.logo) && (
                  <img src={data.business.logo} alt="Logo" className="mx-auto mb-2 object-contain opacity-90 mix-blend-multiply" style={{ width: useTemplate ? `${template.logoSize * scalingFactor}px` : '60px' }} />
                )}
                <h1 className="font-black uppercase tracking-tighter" style={{ fontSize: '1.6em', color: useTemplate ? template.brandColor : '#000' }}>{data.business?.name}</h1>
                <p className="font-bold opacity-75 uppercase tracking-widest" style={{ fontSize: '0.65em' }}>{data.business?.tagline}</p>
                <div className="mt-1 font-medium" style={{ fontSize: '0.6em' }}><p>{data.business?.address}</p><p>Ph: {data.business?.phone}</p></div>
                <h2 className="mt-3 font-black uppercase tracking-[0.2em] py-1 text-white text-center" style={{ backgroundColor: useTemplate ? template.brandColor : '#000', fontSize: '0.75em' }}>Sale Invoice</h2>
              </div>

              <div className="flex justify-between mb-4 font-black uppercase" style={{ fontSize: '0.65em' }}>
                <div className="text-left flex-1">
                  <p className="opacity-40">Client</p>
                  <p className="text-base tracking-tight leading-tight">{selectedInvoice.customerName}</p>
                </div>
                <div className="text-right flex-1">
                  <p className="opacity-40">Ref</p>
                  <p>#{selectedInvoice.invoiceNumber.split('-')[1]}</p>
                  <p>{formatDate(selectedInvoice.date)}</p>
                  <p className="opacity-60">Time: {currentTime}</p>
                </div>
              </div>

              {(useTemplate && template.customFields && template.customFields.length > 0) && (
                 <div className="mb-4 grid grid-cols-2 gap-2" style={{ fontSize: '0.65em' }}>
                    {template.customFields.map(field => (
                       <div key={field.id} className="flex flex-col">
                          <span className="opacity-40 font-black uppercase">{field.label}</span>
                          <span className="font-bold">{applyTemplate(field.value, selectedInvoice)}</span>
                       </div>
                    ))}
                 </div>
              )}

              <table className="w-full mb-6 border-collapse table-auto">
                <thead className="uppercase" style={{ borderTop: `2px solid ${useTemplate ? template.brandColor : '#000'}`, borderBottom: `2px solid ${useTemplate ? template.brandColor : '#000'}`, fontSize: '0.6em' }}>
                  <tr>
                    <th className="py-1.5 text-left">Item</th>
                    <th className="py-1.5 text-center">Qty</th>
                    {(useTemplate ? template.showRatePerUnit : true) && <th className="py-1.5 text-right">Rate</th>}
                    <th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold" style={{ fontSize: '0.8em' }}>
                  {selectedInvoice.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-2 uppercase leading-tight pr-1">
                        {it.productName}
                        {(useTemplate && template.showSKU) && <div className="text-[0.6em] opacity-40">SKU: AM-{i+1}</div>}
                      </td>
                      <td className="py-2 text-center whitespace-nowrap">{it.quantity}{it.unit}</td>
                      {(useTemplate ? template.showRatePerUnit : true) && <td className="py-2 text-right whitespace-nowrap">₹{it.rate}</td>}
                      <td className="py-2 text-right whitespace-nowrap">₹{it.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col items-end pt-3" style={{ borderTop: `2px solid ${useTemplate ? template.brandColor : '#000'}` }}>
                  <div className="w-full md:w-2/3 space-y-1.5">
                    <div className="flex justify-between font-black uppercase" style={{ fontSize: '1.2em' }}><span className="opacity-50">Total Amount</span><span>₹{selectedInvoice.totalAmount.toLocaleString()}</span></div>
                    
                  </div>
                  <p className="uppercase font-black opacity-40 mt-4" style={{ fontSize: '0.45em' }}>Pay Mode: {selectedInvoice.paymentMethod} | {currentTime}</p>
              </div>

              {(useTemplate ? template.footerText : true) && (
                 <p className="mt-6 text-center font-bold italic opacity-60" style={{ fontSize: '0.6em' }}>
                   {applyTemplate(useTemplate ? (template.footerText || "Thank you for your business!") : "Thank you for your business!", selectedInvoice)}
                 </p>
              )}

              {(useTemplate ? template.includeSignatures : true) && (
                <div className="mt-12 mb-2 flex justify-between px-1">
                  <div className="text-center">
                    <div className="w-16 mx-auto mb-1" style={{ borderTop: `1px solid ${useTemplate ? template.brandColor : '#000'}` }}></div>
                    <p className="font-black uppercase opacity-60" style={{ fontSize: '0.4em' }}>Receiver</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 mx-auto mb-1" style={{ borderTop: `1px solid ${useTemplate ? template.brandColor : '#000'}` }}></div>
                    <p className="font-black uppercase opacity-60" style={{ fontSize: '0.4em' }}>Authorized</p>
                  </div>
                </div>
              )}

              <div className="mt-6 text-center border-t border-dotted border-gray-400 pt-3">
                <p className="font-black uppercase tracking-widest opacity-30" style={{ fontSize: '0.45em' }}>A M Food Processing QC Passed</p>
                {(useTemplate ? template.termsText : true) && (
                   <p className="mt-1 font-medium opacity-40 leading-tight" style={{ fontSize: '0.4em' }}>{applyTemplate(useTemplate ? (template.termsText || "") : "", selectedInvoice)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl border border-slate-100 gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight whitespace-nowrap">Invoice History</h3>
          <div className="relative w-full md:w-64">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search invoices..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            {(['All', 'Paid', 'Pending'] as StatusFilter[]).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
            ))}
          </div>
          {statusFilter === 'Pending' && (
            <div className="flex px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl items-center gap-2 shrink-0">
              <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Pending Total:</span>
              <span className="text-sm font-black text-rose-700">₹{filteredSales.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-xl border border-slate-100 overflow-x-auto mr-2">
             <span className="text-[9px] font-black text-slate-400 uppercase ml-2 mr-1 shrink-0">Sort:</span>
             <SortButton label="Date" keyName="date" />
             <SortButton label="Amount" keyName="amount" />
             <SortButton label="Customer" keyName="customer" />
             <SortButton label="Inv #" keyName="invoice" />
          </div>
          <button onClick={async () => {
            const rows = [[`Invoice Export (${statusFilter}) - A M Food Processing`],['Date', 'Invoice #', 'Customer', 'Status', 'Amount (₹)']];
            filteredSales.forEach(s => { rows.push([formatDate(s.date), s.invoiceNumber, s.customerName, s.paymentMethod, s.totalAmount.toString()]); });
            const csvString = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
            const filename = `AM_Invoices_${statusFilter}_${new Date().toISOString().split('T')[0]}.csv`;
            await saveOrDownloadFile(filename, csvString, 'text/csv');
          }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Excel Export</button>
          <button onClick={() => { setIsPrintingSummary(true); setTimeout(() => { printElement('invoices-summary-print', 'Invoices Summary'); setIsPrintingSummary(false); }, 500); }} className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Print Summary</button>
        </div>
      </div>

      {/* Volume Summary */}
      {volumeAnalysis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in fade-in duration-300">
          {volumeAnalysis.map(([unit, qty]) => (
            <div key={unit} className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
              <span className="text-lg font-black text-slate-800">{qty.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{unit} Sold</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Customer</th><th className="px-8 py-5">Status</th><th className="px-8 py-5 text-right">Amount</th><th className="px-8 py-5 text-center">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-5 text-xs font-bold text-slate-500">{formatDate(sale.date)}</td>
                <td className="px-8 py-5 text-sm font-black text-slate-800 uppercase">{sale.customerName}</td>
                <td className="px-8 py-5">
                  {isAdmin ? (
                    <select 
                      value={sale.paymentMethod} 
                      onChange={(e) => updatePaymentMethod(sale.id, e.target.value as PaymentMethod)}
                      className={`text-[9px] font-black uppercase px-2 py-1 rounded border outline-none cursor-pointer transition-all ${
                        sale.paymentMethod === 'Pending' 
                          ? 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                      }`}
                    >
                                            <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Pending">Pending</option>
                    </select>
                  ) : (
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${sale.paymentMethod === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{sale.paymentMethod}</span>
                  )}
                </td>
                <td className="px-8 py-5 text-right font-black text-slate-800 text-lg">₹{sale.totalAmount.toLocaleString()}</td>
                <td className="px-8 py-5 text-center flex justify-center space-x-2">
                  <button onClick={() => setSelectedInvoice(sale)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="View & Print"><IconPrint className="w-5 h-5" /></button>
                  <button onClick={() => onDuplicate?.(sale)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Duplicate Bill"><IconDuplicate className="w-5 h-5" /></button>
                  {isAdmin && (
                    <>
                      <button onClick={() => handleQuickEdit(sale)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-all" title="Edit Invoice"><IconEdit className="w-5 h-5" /></button>
                      <button onClick={() => deleteInvoice(sale.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all" title="Delete Bill"><IconTrash className="w-5 h-5" /></button>
                    </>
                  )}
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