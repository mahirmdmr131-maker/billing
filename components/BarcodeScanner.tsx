import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onResult, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onResult(decodedText);
      },
      (err) => {
        console.warn("Scan error:", err);
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-slate-100 flex justify-between items-center border-b">
          <h3 className="font-bold">Scan Barcode / QR</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div id="reader" className="w-full" style={{ minHeight: '300px' }}></div>
      </div>
    </div>
  );
};
