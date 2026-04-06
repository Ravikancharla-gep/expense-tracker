export type ParsedImageDrop =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string };

/**
 * From a browser drop event: local image files first, then image URLs (e.g. dragged from a webpage).
 */
export function parseImageDropFromDataTransfer(dt: DataTransfer): ParsedImageDrop | null {
  if (dt.items?.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) return { kind: 'file', file: f };
      }
    }
  }
  if (dt.files?.length) {
    const f = dt.files[0];
    if (f?.type.startsWith('image/')) return { kind: 'file', file: f };
  }

  const tryUrl = (raw: string): string | null => {
    const line = raw
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('#'));
    if (!line) return null;
    const url = line.split(/\s+/)[0];
    if (url && /^https?:\/\//i.test(url)) return url;
    return null;
  };

  const uriList = dt.getData('text/uri-list');
  const fromUri = uriList ? tryUrl(uriList) : null;
  if (fromUri) return { kind: 'url', url: fromUri };

  const moz = dt.getData('text/x-moz-url');
  const fromMoz = moz ? tryUrl(moz) : null;
  if (fromMoz) return { kind: 'url', url: fromMoz };

  const plain = dt.getData('text/plain').trim();
  if (plain && /^https?:\/\//i.test(plain.split('\n')[0]?.trim() ?? '')) {
    return { kind: 'url', url: plain.split('\n')[0]!.trim() };
  }

  const html = dt.getData('text/html');
  if (html) {
    const srcMatch =
      html.match(/<img[^>]+src=["']([^"']+)["']/i) ??
      html.match(/\bsrc=["'](https?:\/\/[^"']+)["']/i);
    const candidate = srcMatch?.[1]?.trim();
    if (candidate && /^https?:\/\//i.test(candidate)) {
      return { kind: 'url', url: candidate };
    }
  }

  return null;
}

function resizeLoadedImageToDataUrl(
  img: HTMLImageElement,
  maxWidth: number,
  quality: number,
): string {
  let { width, height } = img;
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Load a remote image URL into a resized JPEG data URL. Uses fetch when CORS allows, otherwise
 * an Image with crossOrigin (may still fail if the host blocks cross-origin use).
 */
export async function urlToResizedDataUrl(
  url: string,
  maxWidth = 720,
  quality = 0.82,
): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
    if (res.ok) {
      const blob = await res.blob();
      const type = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      const file = new File([blob], 'image.jpg', { type });
      return fileToResizedDataUrl(file, maxWidth, quality);
    }
  } catch {
    /* try Image fallback */
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        resolve(resizeLoadedImageToDataUrl(img, maxWidth, quality));
      } catch {
        reject(
          new Error(
            'Could not copy that image (the site may block it). Try saving the image first, then upload.',
          ),
        );
      }
    };
    img.onerror = () =>
      reject(new Error('Could not load image from that link.'));
    img.src = url;
  });
}

/**
 * Load an image file, downscale if wide, export as JPEG data URL for localStorage-friendly size.
 */
export function fileToResizedDataUrl(file: File, maxWidth = 720, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Choose an image file'));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process image'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        reject(new Error('Could not encode image'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}
