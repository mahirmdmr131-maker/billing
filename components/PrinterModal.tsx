import React, { useState, useEffect } from 'react';
import { Sale } from '../types';
import { formatSaleAsText, printViaBluetoothThermal, printElement } from '../utils/printer';

interface PrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale?: Sale | null;
  elementId?: string;
  title?: string;
  template?: any;
}

export const PrinterModal: React.FC<PrinterModalProps> = ({
  isOpen,
  onClose,
  sale,
  elementId = 'print-engine',
  title = 'Print Document',
  template
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'bluetooth' | 'network' | 'serial'>('system');
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'a4'>('80mm');
  const [systemPrinters, setSystemPrinters] = useState<any[]>([]);
  const [selectedSystemPrinter, setSelectedSystemPrinter] = useState<string>('');
  const [ipAddress, setIpAddress] = useState<string>(localStorage.getItem('am_wifi_printer_ip') || '192.168.1.200');
  const [ipPort, setIpPort] = useState<string>(localStorage.getItem('am_wifi_printer_port') || '9100');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect Electron environment
    const electron = (window as any).ElectronBridge;
    if (electron) {
      setIsElectron(true);
      electron.getPrinters().then((printers: any[]) => {
        if (printers && printers.length > 0) {
          setSystemPrinters(printers);
          const defaultPrn = printers.find(p => p.isDefault)?.name || printers[0]?.name;
          setSelectedSystemPrinter(defaultPrn);
        }
      }).catch((err: any) => console.warn('Could not list system printers:', err));
    }
  }, []);

  if (!isOpen) return null;

  const rawText = sale ? formatSaleAsText(sale, template) : '';

  // 1. System / Native Direct Print
  const handleSystemPrint = async () => {
    setIsPrinting(true);
    setStatusMsg({ type: 'info', text: 'Sending to system printer...' });

    try {
      const electron = (window as any).ElectronBridge;
      const android = (window as any).AndroidBridge;

      if (electron) {
        // Native Electron Print directly in PC app
        const printEngineEl = document.getElementById(elementId);
        const htmlContent = printEngineEl ? printEngineEl.outerHTML : `<pre style="font-family:monospace;">${rawText}</pre>`;
        const res = await electron.printDocument({
          deviceName: selectedSystemPrinter,
          silent: false,
          htmlContent
        });
        if (res.success) {
          setStatusMsg({ type: 'success', text: 'Printed successfully!' });
        } else {
          setStatusMsg({ type: 'error', text: res.message || 'Print job failed' });
        }
      } else if (android && typeof android.printDocument === 'function') {
        android.printDocument(title);
        setStatusMsg({ type: 'success', text: 'Sent to Android Print Spooler' });
      } else {
        // Direct browser print without external window
        printElement(elementId, title);
        setStatusMsg({ type: 'success', text: 'Print dialog opened' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Printing error' });
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Bluetooth Thermal Print
  const handleBluetoothPrint = async () => {
    if (!sale) {
      setStatusMsg({ type: 'error', text: 'No sale document selected for thermal printing' });
      return;
    }
    setIsPrinting(true);
    setStatusMsg({ type: 'info', text: 'Searching Bluetooth printers...' });

    const result = await printViaBluetoothThermal(sale, template);
    if (result.success) {
      setStatusMsg({ type: 'success', text: result.message });
    } else {
      setStatusMsg({ type: 'error', text: result.message });
    }
    setIsPrinting(false);
  };

  // 3. Network / WiFi IP Print
  const handleNetworkPrint = async () => {
    if (!ipAddress) {
      setStatusMsg({ type: 'error', text: 'Please enter printer IP address' });
      return;
    }

    localStorage.setItem('am_wifi_printer_ip', ipAddress);
    localStorage.setItem('am_wifi_printer_port', ipPort);

    setIsPrinting(true);
    setStatusMsg({ type: 'info', text: `Connecting to IP ${ipAddress}:${ipPort}...` });

    try {
      // Attempt direct HTTP ESC/POS post or socket endpoint
      const response = await fetch(`http://${ipAddress}:${ipPort}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: rawText,
        signal: AbortSignal.timeout(4000)
      }).catch(() => null);

      if (response && response.ok) {
        setStatusMsg({ type: 'success', text: `Sent payload to IP printer at ${ipAddress}!` });
      } else {
        // Fallback info for raw TCP
        setStatusMsg({
          type: 'info',
          text: `IP Printer configured (${ipAddress}:${ipPort}). If direct raw socket is required, triggering local spooler...`
        });
        handleSystemPrint();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `WiFi Print failed: ${err.message}` });
    } finally {
      setIsPrinting(false);
    }
  };

  // 4. Web Serial USB Print
  const handleSerialPrint = async () => {
    const nav = navigator as any;
    if (!nav.serial) {
      setStatusMsg({ type: 'error', text: 'Web Serial / USB printing is not supported on this browser/environment.' });
      return;
    }

    try {
      setIsPrinting(true);
      setStatusMsg({ type: 'info', text: 'Select USB / Serial Thermal Printer...' });

      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });

      const writer = port.writable.getWriter();
      const encoder = new TextEncoder();

      // ESC/POS init
      await writer.write(new Uint8Array([0x1B, 0x40]));
      // Print text
      await writer.write(encoder.encode(rawText + '\n\n\n'));
      // Cut paper
      await writer.write(new Uint8Array([0x1D, 0x56, 0x41, 0x00]));

      writer.releaseLock();
      await port.close();

      setStatusMsg({ type: 'success', text: 'Sent to USB / Serial Thermal Printer!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Serial USB printing failed' });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold">Independent Print Hub</h3>
              <p className="text-xs text-slate-400">Direct PC & Mobile Printing (No External Browser Needed)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'system'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>💻 System / PC Printer</span>
            {isElectron && <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.5 rounded font-black">Native EXE</span>}
          </button>
          <button
            onClick={() => setActiveTab('bluetooth')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'bluetooth'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>📶 Bluetooth POS</span>
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'network'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>🌐 WiFi / Network IP</span>
          </button>
          <button
            onClick={() => setActiveTab('serial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'serial'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>🔌 USB Serial POS</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between ${
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

          {/* TAB 1: System Printer */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select PC System Printer:
                </label>
                {systemPrinters.length > 0 ? (
                  <select
                    value={selectedSystemPrinter}
                    onChange={(e) => setSelectedSystemPrinter(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    {systemPrinters.map((p, idx) => (
                      <option key={idx} value={p.name}>
                        {p.name} {p.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {isElectron
                      ? 'No default printers detected or searching system...'
                      : 'Standard PC/System Printer spooler will open directly inside this app window.'}
                  </p>
                )}
              </div>

              <button
                onClick={handleSystemPrint}
                disabled={isPrinting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isPrinting ? 'Printing...' : '🖨️ Print Directly Now'}
              </button>
            </div>
          )}

          {/* TAB 2: Bluetooth Search & Print */}
          {activeTab === 'bluetooth' && (
            <div className="space-y-4 text-center py-2">
              <div className="p-5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18l-6-6 6-6 6 6-6 6zm0 0v6m0-18v6" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Bluetooth Thermal Search
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Direct Bluetooth search for 58mm / 80mm ESC/POS Thermal Receipt printers. No external apps required.
                </p>
              </div>

              <button
                onClick={handleBluetoothPrint}
                disabled={isPrinting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isPrinting ? 'Scanning Bluetooth...' : '🔍 Scan Bluetooth & Print'}
              </button>
            </div>
          )}

          {/* TAB 3: WiFi / Network IP */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Printer IP Address
                  </label>
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.1.200"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Port
                  </label>
                  <input
                    type="text"
                    value={ipPort}
                    onChange={(e) => setIpPort(e.target.value)}
                    placeholder="9100"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={handleNetworkPrint}
                disabled={isPrinting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isPrinting ? 'Connecting...' : '🌐 Send to WiFi IP Printer'}
              </button>
            </div>
          )}

          {/* TAB 4: USB Serial POS */}
          {activeTab === 'serial' && (
            <div className="space-y-4 text-center py-2">
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Direct USB / Serial POS Connection
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Connect directly to USB-connected receipt printers via Web Serial.
                </p>
              </div>

              <button
                onClick={handleSerialPrint}
                disabled={isPrinting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isPrinting ? 'Opening Port...' : '🔌 Search USB Printer & Print'}
              </button>
            </div>
          )}

          {/* Live Thermal Receipt Text Preview */}
          {sale && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Thermal Receipt Preview
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPaperSize('58mm')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      paperSize === '58mm' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    58mm (2")
                  </button>
                  <button
                    onClick={() => setPaperSize('80mm')}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      paperSize === '80mm' ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    80mm (3")
                  </button>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-slate-950 p-4 rounded-xl border border-amber-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-emerald-400 whitespace-pre overflow-x-auto max-h-48 shadow-inner">
                {rawText}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
