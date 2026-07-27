import { Sale } from '../types';
import { saveOrDownloadFile } from './fileSaver';

/**
 * Enhanced Printer Utility for Web, Android WebView / Capacitor Apps & Mobile Browsers
 */

// Isolated iframe print helper that works across Android WebViews & standard browsers
export const printElement = (elementId: string | HTMLElement, title = 'Invoice') => {
  try {
    // Check if Android Native Print Spooler interface is available
    const androidBridge = (window as any).AndroidBridge;
    if (androidBridge && typeof androidBridge.printDocument === 'function') {
      androidBridge.printDocument(title);
      return;
    }

    let targetEl: HTMLElement | null = null;

    if (typeof elementId === 'string') {
      targetEl = document.getElementById(elementId);
    } else if (elementId instanceof HTMLElement) {
      targetEl = elementId;
    }

    if (!targetEl) {
      console.warn('Target print element not found, using window.print()');
      window.print();
      return;
    }

    // Create isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe-sandbox';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    const htmlContent = targetEl.outerHTML;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page { margin: 0; size: auto; }
          html, body {
            margin: 0;
            padding: 8px;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: monospace, system-ui, -apple-system, sans-serif;
            width: 100%;
            box-sizing: border-box;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          img { max-width: 100%; height: auto; }
        </style>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        <div style="width:100%; margin: 0 auto;">
          ${htmlContent}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              try {
                window.print();
              } catch (e) {
                console.error(e);
              }
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    doc.close();

    // Trigger iframe print
    setTimeout(() => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } else {
          window.print();
        }
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print', err);
        window.print();
      } finally {
        // Clean up iframe after printing
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 500);
  } catch (e) {
    console.error('Print utility error:', e);
    window.print();
  }
};

/**
 * Format Sale into raw text for Bluetooth thermal printers or sharing
 */
export const formatSaleAsText = (sale: Sale, template?: any): string => {
  const storeName = template?.businessName || 'A M FOOD PROCESSING';
  const header = `================================\n        ${storeName}\n================================\n`;
  const invInfo = `Inv #: ${sale.invoiceNumber}\nDate : ${sale.date}\nCust : ${sale.customerName}\nContact: ${sale.customerContact || 'N/A'}\n--------------------------------\n`;

  let itemsText = 'ITEM             QTY   RATE   TOTAL\n--------------------------------\n';
  sale.items.forEach(item => {
    const name = item.productName.padEnd(14).substring(0, 14);
    const qty = `${item.quantity}${item.unit || ''}`.padStart(5);
    const rate = `₹${item.rate}`.padStart(6);
    const total = `₹${item.total}`.padStart(7);
    itemsText += `${name} ${qty} ${rate} ${total}\n`;
  });

  const divider = '--------------------------------\n';
  const totalLine = `GRAND TOTAL:           ₹${sale.totalAmount.toLocaleString()}\nPay Mode: ${sale.paymentMethod}\n================================\n`;
  const footer = template?.footerText ? `${template.footerText}\n` : 'Thank you for your business!\n';

  return header + invInfo + itemsText + divider + totalLine + footer;
};

/**
 * Web Bluetooth ESC/POS Direct Thermal Printing
 * Supports 58mm / 80mm Bluetooth Thermal Printers on Android phones
 */
export const printViaBluetoothThermal = async (sale: Sale, template?: any): Promise<{ success: boolean; message: string }> => {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    return {
      success: false,
      message: 'Web Bluetooth is not supported on this browser/app. Please use Android Print Spooler or Share.'
    };
  }

  try {
    // Request Bluetooth device
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Common printer service UUID
        '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
    });

    if (!device.gatt) {
      return { success: false, message: 'Bluetooth GATT server not available on printer.' };
    }

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();

    if (services.length === 0) {
      return { success: false, message: 'No print services found on Bluetooth device.' };
    }

    // Find printable characteristic
    let writeCharacteristic: any = null;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic) {
      return { success: false, message: 'Could not find a writable print service on device.' };
    }

    // ESC/POS Command bytes
    const encoder = new TextEncoder();
    const initCmd = new Uint8Array([0x1B, 0x40]); // Initialize
    const centerCmd = new Uint8Array([0x1B, 0x61, 0x01]); // Align Center
    const leftCmd = new Uint8Array([0x1B, 0x61, 0x00]); // Align Left
    const boldOnCmd = new Uint8Array([0x1B, 0x45, 0x01]); // Bold On
    const boldOffCmd = new Uint8Array([0x1B, 0x45, 0x00]); // Bold Off
    const cutCmd = new Uint8Array([0x1D, 0x56, 0x41, 0x00]); // Paper Cut

    const textContent = formatSaleAsText(sale, template);
    const textBytes = encoder.encode(textContent + '\n\n\n');

    // Send payload in chunks
    const sendChunk = async (data: Uint8Array) => {
      const chunkSize = 128;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (writeCharacteristic.properties.writeWithoutResponse) {
          await writeCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await writeCharacteristic.writeValueWithResponse(chunk);
        }
        await new Promise(r => setTimeout(r, 50));
      }
    };

    await sendChunk(initCmd);
    await sendChunk(boldOnCmd);
    await sendChunk(textBytes);
    await sendChunk(boldOffCmd);
    await sendChunk(cutCmd);

    server.disconnect();
    return { success: true, message: 'Sent to Bluetooth Thermal Printer!' };
  } catch (err: any) {
    console.error('Bluetooth Print Error:', err);
    return { success: false, message: err.message || 'Bluetooth printing failed or cancelled.' };
  }
};

/**
 * Share or Save Invoice PDF/HTML/Text (opens Android native share options)
 */
export const shareOrSaveInvoice = async (sale: Sale, template?: any) => {
  const textContent = formatSaleAsText(sale, template);
  const element = document.getElementById('print-engine');
  const htmlContent = element ? element.outerHTML : `<pre>${textContent}</pre>`;

  const invoiceHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Invoice #${sale.invoiceNumber}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: monospace, sans-serif; padding: 20px; background: #fff; color: #000; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${htmlContent}
  <button onclick="window.print()" style="margin-top:20px; padding:10px 20px; background:#4f46e5; color:#fff; border:none; border-radius:8px; font-weight:bold;">Print Document</button>
</body>
</html>`;

  await saveOrDownloadFile(`Invoice_${sale.invoiceNumber}.html`, invoiceHtml, 'text/html');
};
