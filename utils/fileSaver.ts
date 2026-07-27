/**
 * File Saver Utility for Web, Android WebView / Capacitor Apps & Desktop
 * Provides fail-proof file saving, sharing, and downloading across all platforms.
 */

export const saveOrDownloadFile = async (filename: string, content: string, mimeType: string = 'text/plain') => {
  try {
    // 1. Android Native Bridge Share
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.shareText === 'function') {
      bridge.shareText(`Save ${filename}`, content);
      return;
    }

    // 2. Navigator Share API (Mobile Browsers & Android)
    if (navigator.share) {
      try {
        const file = new File([content], filename, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: `AM Food Processing - ${filename}`
          });
          return;
        }
      } catch (e) {
        console.log('Navigator file share skipped, using data link');
      }
    }

    // 3. Data URI method (Works in Android WebViews where blob: URLs might be blocked)
    const encodedContent = encodeURIComponent(content);
    const dataUri = `data:${mimeType};charset=utf-8,${encodedContent}`;
    
    const link = document.createElement('a');
    link.href = dataUri;
    link.setAttribute('download', filename);
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 1000);
  } catch (err) {
    console.warn('Data URI download failed, attempting blob fallback:', err);
    // 4. Blob URL Fallback
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (blobErr) {
      console.error('File saving failed:', blobErr);
      alert(`Could not automatically save file. Please copy or share content manually.`);
    }
  }
};
