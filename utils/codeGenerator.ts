import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { Product } from '../types';

export const mapBarcodeFormat = (type: string): string => {
  const normalized = (type || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.includes('EAN') || normalized === 'EAN13') return 'EAN13';
  if (normalized.includes('UPC')) return 'UPC';
  if (normalized.includes('CODE39')) return 'CODE39';
  if (normalized.includes('QR')) return 'CODE128';
  return 'CODE128';
};

export const sanitizeBarcodeNumber = (number: string, format: string): string => {
  const clean = number.trim();
  const jsFormat = mapBarcodeFormat(format);

  if (jsFormat === 'EAN13') {
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length >= 13) return digitsOnly.substring(0, 13);
    return digitsOnly.padStart(13, '8901234567890').substring(0, 13);
  }

  if (jsFormat === 'UPC') {
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length >= 12) return digitsOnly.substring(0, 12);
    return digitsOnly.padStart(12, '012345678905').substring(0, 12);
  }

  return clean || Math.floor(100000000000 + Math.random() * 900000000000).toString();
};

export const isBarcodeUnique = (
  barcodeNumber: string,
  products: Product[],
  currentProductId?: string
): boolean => {
  if (!barcodeNumber) return true;
  const normalized = barcodeNumber.trim().toLowerCase();
  return !products.some(
    p => p.id !== currentProductId && p.barcodeNumber && p.barcodeNumber.trim().toLowerCase() === normalized
  );
};

export const generateUniqueBarcodeNumber = (
  products: Product[],
  type: string = 'Code 128'
): string => {
  const jsFormat = mapBarcodeFormat(type);
  let candidate = '';
  let attempts = 0;

  do {
    attempts++;
    if (jsFormat === 'EAN13') {
      // 890 prefix for India/general retail + 9 random digits + valid
      candidate = `890${Math.floor(100000000 + Math.random() * 900000000)}`;
    } else if (jsFormat === 'UPC') {
      candidate = `0${Math.floor(10000000000 + Math.random() * 90000000000)}`;
    } else {
      candidate = `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    }
    candidate = sanitizeBarcodeNumber(candidate, type);
  } while (!isBarcodeUnique(candidate, products) && attempts < 100);

  return candidate;
};

export const generateBarcode = async (number: string, type: string): Promise<string> => {
  try {
    const canvas = document.createElement('canvas');
    const jsFormat = mapBarcodeFormat(type);
    const validNumber = sanitizeBarcodeNumber(number, type);

    JsBarcode(canvas, validNumber, {
      format: jsFormat as any,
      width: 2,
      height: 70,
      displayValue: true,
      fontSize: 12,
      margin: 8,
      background: '#ffffff',
      lineColor: '#000000'
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn("Error rendering barcode with format, falling back to CODE128:", err);
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, number || '000000000000', {
      format: 'CODE128',
      width: 2,
      height: 70,
      displayValue: true,
      fontSize: 12,
      margin: 8,
      background: '#ffffff',
      lineColor: '#000000'
    });
    return canvas.toDataURL('image/png');
  }
};

export const generateQRCode = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data || 'UNKNOWN', {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error("Error generating QR code:", err);
    return '';
  }
};

export const generateProductCodes = async (
  product: Partial<Product> & { id: string },
  allProducts: Product[] = []
): Promise<{
  barcodeNumber: string;
  barcodeType: string;
  barcodeData: string;
  qrCodeData: string;
  updatedAt: string;
}> => {
  const barcodeType = product.barcodeType || 'Code 128';
  let barcodeNumber = product.barcodeNumber ? product.barcodeNumber.trim() : '';

  if (!barcodeNumber || !isBarcodeUnique(barcodeNumber, allProducts, product.id)) {
    barcodeNumber = generateUniqueBarcodeNumber(allProducts, barcodeType);
  } else {
    barcodeNumber = sanitizeBarcodeNumber(barcodeNumber, barcodeType);
  }

  const barcodeData = await generateBarcode(barcodeNumber, barcodeType);
  
  // Rich QR Code payload with Product Info
  const qrPayload = JSON.stringify({
    id: product.id,
    sku: product.code || '',
    name: product.name || '',
    barcode: barcodeNumber,
    rate: product.defaultRate || 0
  });

  const qrCodeData = await generateQRCode(qrPayload);

  return {
    barcodeNumber,
    barcodeType,
    barcodeData,
    qrCodeData,
    updatedAt: new Date().toISOString()
  };
};

