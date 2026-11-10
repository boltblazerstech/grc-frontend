// Helper to load bundled image assets as Base64 Data URLs and Uint8Arrays for PDF and DOCX generation
import headerLogoSrc from '../assets/invoice/scrapdms_header_logo.jpg';
import stampSrc from '../assets/invoice/scrapdms_stamp.png';
import signatureSrc from '../assets/invoice/scrapdms_signature.jpg';

/**
 * Loads an image src/url and returns its Base64 Data URL
 */
export async function loadImageAsDataUrl(src) {
  if (!src) return '';
  if (typeof src === 'string' && src.startsWith('data:')) return src;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch (e) {
          console.warn('Canvas export error for image:', e);
          resolve('');
        }
      };
      img.onerror = () => {
        console.warn('Failed to load image from src:', src);
        resolve('');
      };
      img.src = src;
    } catch (e) {
      console.warn('Error in loadImageAsDataUrl:', e);
      resolve('');
    }
  });
}

/**
 * Converts a data URL to a Uint8Array (required by docx ImageRun)
 */
export function dataUrlToUint8Array(dataUrl) {
  if (!dataUrl || !dataUrl.includes(',')) return null;
  try {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error('Failed to convert Data URL to Uint8Array:', e);
    return null;
  }
}

/**
 * Load all 3 invoice assets
 */
export async function loadInvoiceAssets() {
  const [headerLogo, stamp, signature] = await Promise.all([
    loadImageAsDataUrl(headerLogoSrc),
    loadImageAsDataUrl(stampSrc),
    loadImageAsDataUrl(signatureSrc)
  ]);

  return {
    headerLogoDataUrl: headerLogo,
    stampDataUrl: stamp,
    signatureDataUrl: signature,
    headerLogoBytes: dataUrlToUint8Array(headerLogo),
    stampBytes: dataUrlToUint8Array(stamp),
    signatureBytes: dataUrlToUint8Array(signature)
  };
}
