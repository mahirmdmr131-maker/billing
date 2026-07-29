import React, { useState, useEffect } from 'react';
import { formatSaleAsText, printViaBluetoothThermal, printElement } from '../utils/printer';
import { Sale, TemplateSettings, BusinessInfo } from '../types';

interface PrinterSpoolerProps {
  templateSettings?: TemplateSettings;
  business?: BusinessInfo | null;
}

export const PrinterSpooler: React.FC<PrinterSpoolerProps> = ({ templateSettings, business }) => {
  const [defaultDriver, setDefaultDriver] = useState<'system' | 'bluetooth' | 'network' | 'serial'>(
    (localStorage.getItem('am_default_printer_driver') as any) || 'system'
  );
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'a4'>(
    (localStorage.getItem('am_printer_paper_size') as any) || '80mm'
  );
  const [previewMode, setPreviewMode] = useState<'customized' | 'raw'>('customized');
  
  const [systemPrinters, setSystemPrinters] = useState<any[]>([]);
  const [selectedSystemPrinter, setSelectedSystemPrinter] = useState<string>(
    localStorage.getItem('am_system_printer_name') || ''
  );
  const [ipAddress, setIpAddress] = useState<string>(localStorage.getItem('am_wifi_printer_ip') || '192.168.1.200');
  const [ipPort, setIpPort] = useState<string>(localStorage.getItem('am_wifi_printer_port') || '9100');
  const [baudRate, setBaudRate] = useState<string>(localStorage.getItem('am_serial_baud_rate') || '9600');
  
  const [autoCutPaper, setAutoCutPaper] = useState<boolean>(
    localStorage.getItem('am_printer_autocut') !== 'false'
  );
  const [openCashDrawer, setOpenCashDrawer] = useState<boolean>(
    localStorage.getItem('am_printer_cashdrawer') === 'true'
  );

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // Sample Sale for Live Spooler Preview
  const sampleSale: Sale = {
    id: 'sample_spool_1',
    invoiceNumber: 'INV-TEST-001',
    date: new Date().toISOString().split('T')[0],
    customerId: 'cust_sample',
    customerName: 'Demo Customer',
    customerContact: '9876543210',
    items: [
      { id: 'p1', productName: 'Premium Rice 25kg', rate: 1200, unit: 'bag', quantity: 2, total: 2400 },
      { id: 'p2', productName: 'Wheat Flour 10kg', rate: 450, unit: 'bag', quantity: 1, total: 450 }
    ],
    totalAmount: 2850,
    category: 'Sales',
    paymentMethod: 'Cash',
    createdBy: 'Administrator'
  };

  useEffect(() => {
    // Detect Electron environment
    const electron = (window as any).ElectronBridge;
    if (electron) {
      setIsElectron(true);
      electron.getPrinters().then((printers: any[]) => {
        if (printers && printers.length > 0) {
          setSystemPrinters(printers);
          if (!selectedSystemPrinter) {
            const defaultPrn = printers.find((p: any) => p.isDefault)?.name || printers[0]?.name;
            setSelectedSystemPrinter(defaultPrn);
            localStorage.setItem('am_system_printer_name', defaultPrn);
          }
        }
      }).catch((err: any) => console.warn('Could not list system printers:', err));
    }
  }, []);

  // Save Settings Handlers
  const handleSaveDriver = (driver: 'system' | 'bluetooth' | 'network' | 'serial') => {
    setDefaultDriver(driver);
    localStorage.setItem('am_default_printer_driver', driver);
    setStatusMsg({ type: 'success', text: `Default printer spooler set to ${driver.toUpperCase()}` });
  };

  const handlePaperSizeChange = (size: '58mm' | '80mm' | 'a4') => {
    setPaperSize(size);
    localStorage.setItem('am_printer_paper_size', size);
  };

  const handleNetworkSettingsSave = () => {
    localStorage.setItem('am_wifi_printer_ip', ipAddress);
    localStorage.setItem('am_wifi_printer_port', ipPort);
    setStatusMsg({ type: 'success', text: `WiFi Printer IP saved: ${ipAddress}:${ipPort}` });
  };

  const handleToggleAutoCut = (val: boolean) => {
    setAutoCutPaper(val);
    localStorage.setItem('am_printer_autocut', String(val));
  };

  const handleToggleCashDrawer = (val: boolean) => {
    setOpenCashDrawer(val);
    localStorage.setItem('am_printer_cashdrawer', String(val));
  };

  // Test Print Execution
  const handleTestPrint = async () => {
    setIsTesting(true);
    setStatusMsg({ type: 'info', text: `Sending test job to ${defaultDriver.toUpperCase()} spooler...` });

    try {
      const rawText = formatSaleAsText(sampleSale, templateSettings, business);

      if (defaultDriver === 'system') {
        const electron = (window as any).ElectronBridge;
        if (electron) {
          const res = await electron.printDocument({
            deviceName: selectedSystemPrinter,
            silent: false,
            htmlContent: `<pre style="font-family:monospace;font-size:12px;">${rawText}</pre>`
          });
          if (res.success) {
            setStatusMsg({ type: 'success', text: 'System Printer Test Job Completed!' });
          } else {
            setStatusMsg({ type: 'error', text: res.message || 'System print failed' });
          }
        } else {
          printElement('spooler-preview-engine', 'Sample Test Spool');
          setStatusMsg({ type: 'success', text: 'Customized Bill Spooler Dialog Triggered' });
        }
      } else if (defaultDriver === 'bluetooth') {
        const result = await printViaBluetoothThermal(sampleSale, templateSettings, business);
        setStatusMsg({ type: result.success ? 'success' : 'error', text: result.message });
      } else if (defaultDriver === 'network') {
        handleNetworkSettingsSave();
        const response = await fetch(`http://${ipAddress}:${ipPort}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: rawText,
          signal: AbortSignal.timeout(3000)
        }).catch(() => null);

        if (response && response.ok) {
          setStatusMsg({ type: 'success', text: `Test print sent to WiFi IP ${ipAddress}:${ipPort}` });
        } else {
          setStatusMsg({
            type: 'info',
            text: `Network spooler ready at ${ipAddress}:${ipPort}. Fallback triggering local spooler...`
          });
          printElement('spooler-preview-engine', 'Sample Test Spool');
        }
      } else if (defaultDriver === 'serial') {
        const nav = navigator as any;
        if (!nav.serial) {
          setStatusMsg({ type: 'error', text: 'Web Serial / USB printing is not supported in this browser environment.' });
        } else {
          const port = await nav.serial.requestPort();
          await port.open({ baudRate: parseInt(baudRate) || 9600 });
          const writer = port.writable.getWriter();
          const encoder = new TextEncoder();
          await writer.write(new Uint8Array([0x1B, 0x40])); // Init ESC/POS
          await writer.write(encoder.encode(rawText + '\n\n\n'));
          if (autoCutPaper) {
            await writer.write(new Uint8Array([0x1D, 0x56, 0x41, 0x00])); // Cut
          }
          writer.releaseLock();
          await port.close();
          setStatusMsg({ type: 'success', text: 'USB Serial Test Print Sent Successfully!' });
        }
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Printer test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const sampleRawText = formatSaleAsText(sampleSale, templateSettings, business);

  const brandColor = templateSettings?.applyToPrinting !== false ? (templateSettings?.brandColor || '#4f46e5') : '#000000';
  const fontSize = templateSettings?.fontSize || 12;
  const lineSpacing = templateSettings?.lineSpacing || 1.2;
  const borderWeight = templateSettings?.borderWeight ?? 2;
  const compact = !!templateSettings?.compactMode;
  const showLogo = templateSettings?.showLogo !== false;
  const showRatePerUnit = templateSettings?.showRatePerUnit !== false;

  const replaceCustomFieldTags = (val: string) => {
    if (!val) return '';
    return val
      .replace(/\{\{inv_number\}\}/g, sampleSale.invoiceNumber)
      .replace(/\{\{date\}\}/g, sampleSale.date)
      .replace(/\{\{customer_name\}\}/g, sampleSale.customerName)
      .replace(/\{\{total_amount\}\}/g, `₹${sampleSale.totalAmount.toLocaleString()}`)
      .replace(/\{\{payment_method\}\}/g, sampleSale.paymentMethod);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              Independent Printer Spooler
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Custom Bill Template Enabled
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct Background Print Spooling with Customized Bill Print Formatting (PC, POS, WiFi, Bluetooth & Serial)
            </p>
          </div>
        </div>

        <button
          onClick={handleTestPrint}
          disabled={isTesting}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 text-xs uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95"
        >
          <span>{isTesting ? 'Printing Test...' : '🖨️ Run Test Print Spool'}</span>
        </button>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        
        {/* Status Toast */}
        {statusMsg && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : statusMsg.type === 'error'
                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
            }`}
          >
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 ml-2">✕</button>
          </div>
        )}

        {/* 1. Default Driver Selector */}
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Select Active Default Printer Driver
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'system', name: '💻 System / PC Printer', desc: 'Standard Windows/Mac/Linux Spooler' },
              { id: 'network', name: '🌐 WiFi / Network IP', desc: 'Raw Socket Thermal (Port 9100)' },
              { id: 'bluetooth', name: '📶 Bluetooth Thermal', desc: 'Wireless Mobile Receipt POS' },
              { id: 'serial', name: '🔌 USB / Serial POS', desc: 'Direct WebUSB Thermal Printer' }
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => handleSaveDriver(d.id as any)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  defaultDriver === d.id
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-xs font-extrabold">{d.name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{d.desc}</p>
                </div>
                {defaultDriver === d.id && (
                  <span className="mt-3 inline-block px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full w-fit">
                    Active Driver
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Hardware Configuration Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card A: Paper & Print Options */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span>📄 Paper & Spooler Options</span>
            </h4>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Default Thermal Paper Size
              </label>
              <div className="flex gap-2">
                {[
                  { id: '80mm', label: '80mm (3" Standard)' },
                  { id: '58mm', label: '58mm (2" Mobile)' },
                  { id: 'a4', label: 'A4 Full Sheet' }
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handlePaperSizeChange(s.id as any)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                      paperSize === s.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Auto Cut Paper after Printing</span>
                <input
                  type="checkbox"
                  checked={autoCutPaper}
                  onChange={(e) => handleToggleAutoCut(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pulse Cash Drawer Kick-out (RJ11)</span>
                <input
                  type="checkbox"
                  checked={openCashDrawer}
                  onChange={(e) => handleToggleCashDrawer(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>

          {/* Card B: Specific Network & System Config */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span>⚙️ Driver-Specific Settings</span>
            </h4>

            {defaultDriver === 'system' && (
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  PC System Installed Printers
                </label>
                {systemPrinters.length > 0 ? (
                  <select
                    value={selectedSystemPrinter}
                    onChange={(e) => {
                      setSelectedSystemPrinter(e.target.value);
                      localStorage.setItem('am_system_printer_name', e.target.value);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium"
                  >
                    {systemPrinters.map((p, idx) => (
                      <option key={idx} value={p.name}>
                        {p.name} {p.isDefault ? '(System Default)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    {isElectron
                      ? 'No native system printers detected.'
                      : 'Browser System Spooler active. Direct print commands route to browser print dialog.'}
                  </p>
                )}
              </div>
            )}

            {defaultDriver === 'network' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Printer IP Address
                    </label>
                    <input
                      type="text"
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="192.168.1.200"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Port
                    </label>
                    <input
                      type="text"
                      value={ipPort}
                      onChange={(e) => setIpPort(e.target.value)}
                      placeholder="9100"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
                <button
                  onClick={handleNetworkSettingsSave}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Save IP Config
                </button>
              </div>
            )}

            {defaultDriver === 'bluetooth' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Bluetooth POS Thermal Driver scans Web Bluetooth for 58mm/80mm receipt printers automatically on print requests.
                </p>
              </div>
            )}

            {defaultDriver === 'serial' && (
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  USB Serial Baud Rate
                </label>
                <select
                  value={baudRate}
                  onChange={(e) => {
                    setBaudRate(e.target.value);
                    localStorage.setItem('am_serial_baud_rate', e.target.value);
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
                >
                  <option value="9600">9600 Baud (Standard Thermal)</option>
                  <option value="19200">19200 Baud</option>
                  <option value="38400">38400 Baud</option>
                  <option value="115200">115200 Baud (High Speed)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 3. Live Spooler Format Preview Section with Customized Template Support */}
        <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                Spooler Print Template Output Preview
              </h4>
              <p className="text-[11px] text-slate-400">
                This preview applies your Customized Bill Print Template settings automatically.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setPreviewMode('customized')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  previewMode === 'customized'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🎨 Customized Bill Layout
              </button>
              <button
                onClick={() => setPreviewMode('raw')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  previewMode === 'raw'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                📠 ESC/POS Thermal Stream
              </button>
            </div>
          </div>

          {/* Render Customized Bill Layout */}
          {previewMode === 'customized' ? (
            <div className="bg-slate-200 dark:bg-slate-950 p-4 sm:p-8 rounded-3xl flex justify-center overflow-hidden min-h-[400px]">
              <div
                id="spooler-preview-engine"
                className="bg-white shadow-xl transition-all duration-300 overflow-hidden text-black"
                style={{
                  width: paperSize === '58mm' ? '58mm' : paperSize === '80mm' ? '80mm' : '100%',
                  maxWidth: paperSize === 'a4' ? '210mm' : '80mm',
                  fontSize: `${fontSize}px`,
                  lineHeight: lineSpacing,
                  fontFamily: paperSize === 'a4' ? 'sans-serif' : 'monospace'
                }}
              >
                <div
                  className={`h-full ${compact ? 'p-3' : 'p-6'}`}
                  style={{
                    borderWidth: `${borderWeight}px`,
                    borderColor: brandColor
                  }}
                >
                  {/* Store Header */}
                  <div className="text-center mb-4">
                    {showLogo && business?.logo && (
                      <img
                        src={business.logo}
                        alt="Logo"
                        className="mx-auto mb-2 object-contain opacity-90 mix-blend-multiply"
                        style={{ width: `${templateSettings?.logoSize || 80}px` }}
                      />
                    )}
                    <h1 className="font-black uppercase tracking-tight" style={{ fontSize: '1.5em', color: brandColor }}>
                      {business?.name || 'A M FOOD PROCESSING'}
                    </h1>
                    {business?.tagline && (
                      <p className="font-bold opacity-75 uppercase text-[0.7em]">{business.tagline}</p>
                    )}
                    <div className="mt-1 font-medium text-[0.65em]">
                      {business?.address && <p>{business.address}</p>}
                      {business?.phone && <p>Ph: {business.phone}</p>}
                      {business?.gst && <p>GSTIN: {business.gst}</p>}
                    </div>
                    <div
                      className="mt-3 font-black uppercase tracking-widest py-1 text-white text-center text-[0.75em]"
                      style={{ backgroundColor: brandColor }}
                    >
                      TAX INVOICE
                    </div>
                  </div>

                  {/* Customer & Ref */}
                  <div className="flex justify-between mb-4 font-black uppercase text-[0.7em] border-b border-gray-200 pb-2">
                    <div>
                      <p className="opacity-50 text-[0.8em]">Billed To</p>
                      <p className="text-sm">{sampleSale.customerName}</p>
                      <p className="text-[0.85em] font-mono">{sampleSale.customerContact}</p>
                    </div>
                    <div className="text-right">
                      <p className="opacity-50 text-[0.8em]">Invoice Ref</p>
                      <p>#{sampleSale.invoiceNumber}</p>
                      <p className="font-normal">{sampleSale.date}</p>
                    </div>
                  </div>

                  {/* Custom Fields */}
                  {templateSettings?.customFields && templateSettings.customFields.length > 0 && (
                    <div className="mb-4 grid grid-cols-2 gap-2 text-[0.65em] bg-gray-50 p-2 rounded">
                      {templateSettings.customFields.map((field) => (
                        <div key={field.id} className="flex flex-col">
                          <span className="opacity-50 font-black uppercase">{field.label}</span>
                          <span className="font-bold">{replaceCustomFieldTags(field.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Items Table */}
                  <table className="w-full mb-4 border-collapse text-[0.75em]">
                    <thead>
                      <tr className="border-b-2" style={{ borderColor: brandColor }}>
                        <th className="py-1 text-left">Item</th>
                        <th className="py-1 text-center">Qty</th>
                        {showRatePerUnit && <th className="py-1 text-right">Rate</th>}
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold">
                      {sampleSale.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-1.5 text-left uppercase">
                            {templateSettings?.showSKU && <span className="text-[0.8em] text-gray-500 mr-1">[{it.id.slice(0, 4)}]</span>}
                            {it.productName}
                          </td>
                          <td className="py-1.5 text-center">{it.quantity} {it.unit}</td>
                          {showRatePerUnit && <td className="py-1.5 text-right">₹{it.rate}</td>}
                          <td className="py-1.5 text-right">₹{it.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Total Summary */}
                  <div className="border-t-2 pt-2 mb-4 space-y-1 text-[0.8em]" style={{ borderColor: brandColor }}>
                    <div className="flex justify-between font-black text-sm">
                      <span>GRAND TOTAL:</span>
                      <span style={{ color: brandColor }}>₹{sampleSale.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 font-medium text-[0.85em]">
                      <span>Payment Method:</span>
                      <span>{sampleSale.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 font-medium text-[0.85em]">
                      <span>Billed By:</span>
                      <span>{sampleSale.createdBy}</span>
                    </div>
                  </div>

                  {/* Signatures */}
                  {templateSettings?.includeSignatures !== false && (
                    <div className="flex justify-between items-end my-6 text-[0.6em] text-gray-400 uppercase pt-4 border-t border-dashed border-gray-300">
                      <div>
                        <div className="h-6 border-b border-gray-300 w-20 mb-1"></div>
                        <span>Customer Sign</span>
                      </div>
                      <div className="text-right">
                        <div className="h-6 border-b border-gray-300 w-20 mb-1 ml-auto"></div>
                        <span>Authorized Sign</span>
                      </div>
                    </div>
                  )}

                  {/* Footer & Terms */}
                  <div className="text-center pt-2 border-t border-gray-200 text-[0.65em] space-y-1">
                    {templateSettings?.termsText && (
                      <p className="font-semibold text-gray-500 italic">{templateSettings.termsText}</p>
                    )}
                    <p className="font-black uppercase tracking-wider" style={{ color: brandColor }}>
                      {templateSettings?.footerText || 'Thank you for your business!'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              id="spooler-preview-engine"
              className="bg-amber-50 dark:bg-slate-950 p-5 rounded-2xl border border-amber-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-emerald-400 whitespace-pre overflow-x-auto max-h-60 shadow-inner"
            >
              {sampleRawText}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
