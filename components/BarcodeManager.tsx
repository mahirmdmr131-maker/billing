import React, { useState, useMemo, useRef } from 'react';
import { AppData, Product } from '../types';
import {
  generateProductCodes,
  generateBarcode,
  generateQRCode,
  isBarcodeUnique,
  generateUniqueBarcodeNumber
} from '../utils/codeGenerator';
import jsPDF from 'jspdf';

interface BarcodeManagerProps {
  data: AppData;
  updateData: (updater: ((prev: AppData) => AppData) | Partial<AppData>) => void;
}

type SheetLayoutType = 'A4_24' | 'A4_40' | 'A4_65' | 'SINGLE' | 'CUSTOM';

interface PrintConfig {
  layout: SheetLayoutType;
  cols: number;
  rows: number;
  showName: boolean;
  showBarcode: boolean;
  showQR: boolean;
  showSKU: boolean;
  showPrice: boolean;
  showBatch: boolean;
  batchNumber: string;
  showCompany: boolean;
  customWidthMm: number;
  customHeightMm: number;
}

export const BarcodeManager: React.FC<BarcodeManagerProps> = ({ data, updateData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [labelQuantities, setLabelQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'MANAGEMENT' | 'PRINT_STUDIO'>('MANAGEMENT');

  // Manual editing state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editBarcodeNum, setEditBarcodeNum] = useState('');
  const [editBarcodeType, setEditBarcodeType] = useState('Code 128');
  const [editError, setEditError] = useState<string | null>(null);

  // Print Settings
  const [config, setConfig] = useState<PrintConfig>({
    layout: 'A4_24',
    cols: 3,
    rows: 8,
    showName: true,
    showBarcode: true,
    showQR: true,
    showSKU: true,
    showPrice: true,
    showBatch: false,
    batchNumber: 'BATCH-001',
    showCompany: true,
    customWidthMm: 63.5,
    customHeightMm: 33.9,
  });

  const printRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return data.products;
    return data.products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.barcodeNumber && p.barcodeNumber.toLowerCase().includes(q))
    );
  }, [data.products, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(filteredProducts.map(p => p.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const updateQuantity = (id: string, qty: number) => {
    setLabelQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));
  };

  const setQtyFromStock = () => {
    const newQtys: Record<string, number> = {};
    data.products.forEach(p => {
      newQtys[p.id] = Math.max(1, p.currentStock || 1);
    });
    setLabelQuantities(newQtys);
  };

  const handleBulkGenerate = async (missingOnly: boolean) => {
    const targets = selectedIds.length > 0
      ? data.products.filter(p => selectedIds.includes(p.id))
      : data.products;

    if (targets.length === 0) {
      alert("No products selected.");
      return;
    }

    const updated = await Promise.all(
      data.products.map(async p => {
        const isTarget = targets.some(t => t.id === p.id);
        if (!isTarget) return p;

        if (missingOnly && p.barcodeData && p.qrCodeData && p.barcodeNumber) {
          return p;
        }

        const codes = await generateProductCodes(p, data.products);
        return { ...p, ...codes };
      })
    );

    updateData(prev => ({ ...prev, products: updated }));
    alert(`Successfully generated barcodes & QR codes for ${targets.length} product(s).`);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditBarcodeNum(p.barcodeNumber || '');
    setEditBarcodeType(p.barcodeType || 'Code 128');
    setEditError(null);
  };

  const saveManualBarcode = async () => {
    if (!editingProduct) return;
    const cleanNum = editBarcodeNum.trim();

    if (cleanNum && !isBarcodeUnique(cleanNum, data.products, editingProduct.id)) {
      setEditError("This barcode number is already assigned to another product!");
      return;
    }

    const updatedProductForCode = {
      ...editingProduct,
      barcodeNumber: cleanNum,
      barcodeType: editBarcodeType,
    };

    const codes = await generateProductCodes(updatedProductForCode, data.products);

    updateData(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === editingProduct.id ? { ...p, ...codes } : p
      ),
    }));

    setEditingProduct(null);
  };

  const handleAutoGenerateSingle = async () => {
    if (!editingProduct) return;
    const uniqueNum = generateUniqueBarcodeNumber(data.products, editBarcodeType);
    setEditBarcodeNum(uniqueNum);
    setEditError(null);
  };

  // Layout helper parameters
  const layoutDetails = useMemo(() => {
    switch (config.layout) {
      case 'A4_24':
        return { cols: 3, rows: 8, perPage: 24, labelWidthMm: 63.5, labelHeightMm: 33.9 };
      case 'A4_40':
        return { cols: 4, rows: 10, perPage: 40, labelWidthMm: 48.5, labelHeightMm: 25.4 };
      case 'A4_65':
        return { cols: 5, rows: 13, perPage: 65, labelWidthMm: 38.0, labelHeightMm: 21.2 };
      case 'SINGLE':
        return { cols: 1, rows: 1, perPage: 1, labelWidthMm: 50.0, labelHeightMm: 25.0 };
      case 'CUSTOM':
      default:
        return {
          cols: config.cols,
          rows: config.rows,
          perPage: config.cols * config.rows,
          labelWidthMm: config.customWidthMm,
          labelHeightMm: config.customHeightMm
        };
    }
  }, [config]);

  // Flatten selected products into array of label items based on print quantities
  const labelItemsToPrint = useMemo(() => {
    const items: Product[] = [];
    const productsToPrint = selectedIds.length > 0
      ? data.products.filter(p => selectedIds.includes(p.id))
      : data.products;

    productsToPrint.forEach(p => {
      const count = labelQuantities[p.id] || 1;
      for (let i = 0; i < count; i++) {
        items.push(p);
      }
    });
    return items;
  }, [data.products, selectedIds, labelQuantities]);

  const handleExportPDF = async () => {
    if (labelItemsToPrint.length === 0) {
      alert("No labels selected for printing.");
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: config.layout === 'SINGLE' ? [50, 25] : 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const { cols, rows, perPage, labelWidthMm, labelHeightMm } = layoutDetails;

    const marginX = (pageWidth - cols * labelWidthMm) / 2;
    const marginY = (pageHeight - rows * labelHeightMm) / 2;

    let itemIndex = 0;

    while (itemIndex < labelItemsToPrint.length) {
      if (itemIndex > 0) doc.addPage();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (itemIndex >= labelItemsToPrint.length) break;

          const p = labelItemsToPrint[itemIndex];
          const x = marginX + c * labelWidthMm;
          const y = marginY + r * labelHeightMm;

          // Label outer box
          doc.setDrawColor(220, 220, 220);
          doc.rect(x, y, labelWidthMm, labelHeightMm);

          let currentY = y + 3;

          // Company Name
          if (config.showCompany && data.business?.name) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 100, 100);
            doc.text(data.business.name.toUpperCase(), x + labelWidthMm / 2, currentY, { align: 'center' });
            currentY += 3;
          }

          // Product Name
          if (config.showName) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(20, 20, 20);
            const truncatedName = p.name.length > 22 ? p.name.substring(0, 22) + '...' : p.name;
            doc.text(truncatedName, x + labelWidthMm / 2, currentY, { align: 'center' });
            currentY += 3.5;
          }

          // Price & SKU
          if (config.showPrice || config.showSKU) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(70, 70, 70);
            const priceText = config.showPrice ? `Rate: Rs.${p.defaultRate}` : '';
            const skuText = config.showSKU ? `SKU: ${p.code || p.id.substring(0, 6)}` : '';
            const line = [skuText, priceText].filter(Boolean).join(' | ');
            doc.text(line, x + labelWidthMm / 2, currentY, { align: 'center' });
            currentY += 3.5;
          }

          // Barcode Image / QR Code Image
          const imgWidth = labelWidthMm - 8;
          const imgHeight = Math.min(12, labelHeightMm - (currentY - y) - 4);

          if (config.showBarcode && p.barcodeData && imgHeight > 4) {
            try {
              doc.addImage(p.barcodeData, 'PNG', x + 4, currentY, imgWidth, imgHeight);
            } catch (e) {
              console.warn("Could not add barcode image to PDF", e);
            }
          } else if (config.showQR && p.qrCodeData && imgHeight > 4) {
            try {
              const qrDim = Math.min(imgHeight, 14);
              doc.addImage(p.qrCodeData, 'PNG', x + (labelWidthMm - qrDim) / 2, currentY, qrDim, qrDim);
            } catch (e) {
              console.warn("Could not add QR image to PDF", e);
            }
          }

          itemIndex++;
        }
      }
    }

    doc.save(`barcodes_labels_${Date.now()}.pdf`);
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h3m-3 0H9m-3 0h3m-3 0h3m-6 6h6m-6 6h6" />
            </svg>
            Barcode & QR Code Management
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Generate, validate, customize, and print barcode/QR labels for A4 sheets and thermal printers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('MANAGEMENT')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all ${
              activeTab === 'MANAGEMENT'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Catalog & Codes
          </button>
          <button
            onClick={() => setActiveTab('PRINT_STUDIO')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all ${
              activeTab === 'PRINT_STUDIO'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Label Print Studio ({labelItemsToPrint.length})
          </button>
        </div>
      </div>

      {activeTab === 'MANAGEMENT' ? (
        <div className="space-y-6 no-print">
          {/* Action Toolbar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Search products or barcodes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                onClick={selectAll}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Select All ({filteredProducts.length})
              </button>
              {selectedIds.length > 0 && (
                <button
                  onClick={deselectAll}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-xl text-xs"
                >
                  Clear Selection
                </button>
              )}
              <button
                onClick={() => handleBulkGenerate(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm"
              >
                Generate Missing Codes
              </button>
              <button
                onClick={() => handleBulkGenerate(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm"
              >
                Regenerate Selected
              </button>
            </div>
          </div>

          {/* Product Codes Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                        onChange={selectedIds.length === filteredProducts.length ? deselectAll : selectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="p-4">Product Info</th>
                    <th className="p-4">Barcode Number</th>
                    <th className="p-4">Format</th>
                    <th className="p-4 text-center">Barcode Preview</th>
                    <th className="p-4 text-center">QR Code</th>
                    <th className="p-4 text-center">Print Qty</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProducts.map(product => {
                    const isSelected = selectedIds.includes(product.id);
                    return (
                      <tr key={product.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(product.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">SKU: {product.code || product.id.substring(0, 6)} | Rate: ₹{product.defaultRate}</p>
                        </td>
                        <td className="p-4">
                          <span className="font-mono bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-bold text-xs">
                            {product.barcodeNumber || 'Not Generated'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-slate-600 font-bold uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded">
                            {product.barcodeType || 'Code 128'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {product.barcodeData ? (
                            <img src={product.barcodeData} alt="Barcode" className="h-10 mx-auto object-contain" />
                          ) : (
                            <span className="text-rose-500 font-bold text-[10px]">Missing Barcode</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {product.qrCodeData ? (
                            <img src={product.qrCodeData} alt="QR" className="w-10 h-10 mx-auto object-contain" />
                          ) : (
                            <span className="text-rose-500 font-bold text-[10px]">Missing QR</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number"
                            min="1"
                            value={labelQuantities[product.id] || 1}
                            onChange={e => updateQuantity(product.id, parseInt(e.target.value) || 1)}
                            className="w-16 p-1.5 border border-slate-200 rounded-lg text-center font-bold text-xs"
                          />
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px]"
                          >
                            Edit Code
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* PRINT STUDIO TAB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 no-print">
            <h3 className="font-black text-slate-800 text-lg border-b border-slate-100 pb-3">Label Settings</h3>

            {/* Layout Preset */}
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Sheet Layout Preset
              </label>
              <select
                value={config.layout}
                onChange={e => setConfig({ ...config, layout: e.target.value as SheetLayoutType })}
                className="w-full p-3 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none"
              >
                <option value="A4_24">A4 Sheet - 24 Labels (3 x 8 Grid)</option>
                <option value="A4_40">A4 Sheet - 40 Labels (4 x 10 Grid)</option>
                <option value="A4_65">A4 Sheet - 65 Labels (5 x 13 Grid)</option>
                <option value="SINGLE">Single Sticker / Thermal Label (50mm x 25mm)</option>
                <option value="CUSTOM">Custom Grid Layout</option>
              </select>
            </div>

            {config.layout === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Columns</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.cols}
                    onChange={e => setConfig({ ...config, cols: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border rounded-xl font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Rows</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.rows}
                    onChange={e => setConfig({ ...config, rows: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 border rounded-xl font-bold text-xs"
                  />
                </div>
              </div>
            )}

            {/* Content Toggles */}
            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                Include on Label
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={config.showName}
                    onChange={e => setConfig({ ...config, showName: e.target.checked })}
                    className="rounded"
                  />
                  Product Name
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={config.showBarcode}
                    onChange={e => setConfig({ ...config, showBarcode: e.target.checked })}
                    className="rounded"
                  />
                  Barcode Image
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={config.showQR}
                    onChange={e => setConfig({ ...config, showQR: e.target.checked })}
                    className="rounded"
                  />
                  QR Code Image
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={config.showSKU}
                    onChange={e => setConfig({ ...config, showSKU: e.target.checked })}
                    className="rounded"
                  />
                  SKU / Code
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={config.showPrice}
                    onChange={e => setConfig({ ...config, showPrice: e.target.checked })}
                    className="rounded"
                  />
                  Retail Price
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    checked={config.showCompany}
                    onChange={e => setConfig({ ...config, showCompany: e.target.checked })}
                    className="rounded"
                  />
                  Company Name
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={setQtyFromStock}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs"
              >
                Set Qty = Stock
              </button>
              <button
                onClick={handleExportPDF}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md"
              >
                Export PDF
              </button>
            </div>

            <button
              onClick={handleBrowserPrint}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg"
            >
              Print Labels Now
            </button>
          </div>

          {/* Live Printable Preview Canvas */}
          <div className="lg:col-span-2 bg-slate-200 p-6 rounded-3xl border border-slate-300 min-h-[600px] flex flex-col items-center overflow-auto">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 no-print">
              Live Sheet Print Preview ({labelItemsToPrint.length} Labels total)
            </h4>

            <div
              ref={printRef}
              className="bg-white shadow-2xl p-4 rounded border border-slate-300 transition-all"
              style={{
                width: config.layout === 'SINGLE' ? '280px' : '210mm',
                minHeight: config.layout === 'SINGLE' ? '140px' : '297mm',
              }}
            >
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${layoutDetails.cols}, minmax(0, 1fr))`,
                }}
              >
                {labelItemsToPrint.slice(0, layoutDetails.perPage).map((p, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-300 border-dashed rounded p-2 flex flex-col items-center justify-between text-center bg-white overflow-hidden"
                    style={{ minHeight: `${layoutDetails.labelHeightMm * 2.8}px` }}
                  >
                    {config.showCompany && data.business?.name && (
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                        {data.business.name}
                      </p>
                    )}

                    {config.showName && (
                      <p className="font-bold text-[10px] text-slate-900 leading-tight truncate max-w-full">
                        {p.name}
                      </p>
                    )}

                    {(config.showPrice || config.showSKU) && (
                      <p className="text-[9px] font-bold text-slate-600">
                        {config.showSKU && <span>SKU: {p.code || p.id.substring(0, 5)} </span>}
                        {config.showPrice && <span className="text-indigo-600 font-black">₹{p.defaultRate}</span>}
                      </p>
                    )}

                    {config.showBarcode && p.barcodeData && (
                      <img src={p.barcodeData} alt="Barcode" className="max-h-10 object-contain my-1" />
                    )}

                    {config.showQR && p.qrCodeData && (
                      <img src={p.qrCodeData} alt="QR Code" className="w-10 h-10 object-contain my-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Barcode Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-800 mb-1">Edit Product Barcode</h3>
            <p className="text-xs text-slate-500 font-medium mb-4">{editingProduct.name}</p>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Format
                </label>
                <select
                  value={editBarcodeType}
                  onChange={e => setEditBarcodeType(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs"
                >
                  <option value="Code 128">Code 128</option>
                  <option value="EAN-13">EAN-13 (13 Digits)</option>
                  <option value="UPC">UPC-A (12 Digits)</option>
                  <option value="QR Code">QR Code Only</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Barcode Number
                  </label>
                  <button
                    onClick={handleAutoGenerateSingle}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  value={editBarcodeNum}
                  onChange={e => {
                    setEditBarcodeNum(e.target.value);
                    setEditError(null);
                  }}
                  placeholder="Enter custom barcode..."
                  className="w-full p-3 border border-slate-200 rounded-xl font-mono text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={saveManualBarcode}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-md"
              >
                Save & Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeManager;
