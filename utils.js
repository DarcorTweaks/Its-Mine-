export function sanitize(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

export function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => {
      t.classList.remove('show');
    }, duration);
  }
}

export function formatUSD(amount) {
  return `$${amount.toFixed(2)}`;
}

export function formatBS(amount) {
  return `Bs. ${amount.toLocaleString('es-VE', {minimumFractionDigits: 2})}`;
}

export function safeConfirm(message, requiredText = null) {
  if (requiredText) {
    const input = prompt(message + `\nEscribe '${requiredText}' para confirmar:`);
    return input === requiredText;
  }
  return confirm(message);
}

export function exportToCSV(data, filename) {
  if (!data || !data.length) {
    showToast("No hay datos para exportar");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      let val = row[header] !== null && row[header] !== undefined ? row[header] : '';
      if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      val = val.toString().replace(/"/g, '""');
      return `"${val}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createElement(tag, classes = '', textContent = '') {
  const el = document.createElement(tag);
  if (classes) {
    classes.split(' ').forEach(cls => {
      if (cls.trim()) el.classList.add(cls.trim());
    });
  }
  if (textContent) {
    el.textContent = textContent;
  }
  return el;
}

// Comprime una foto en el navegador y la devuelve como base64 (data URL),
// para poder guardarla directo en Firestore sin necesitar Firebase Storage.
// Firestore permite hasta 1MB por documento, así que apuntamos a bastante menos.
export function compressImageFile(file, options = {}) {
  const maxWidth = options.maxWidth || 900;
  const maxBase64Bytes = options.maxBase64Bytes || 650000;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.75;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      let attempts = 0;

      while (dataUrl.length > maxBase64Bytes && attempts < 8) {
        if (quality > 0.35) {
          quality -= 0.15;
        } else {
          width = Math.round(width * 0.8);
          height = Math.round(height * 0.8);
          canvas.width = width;
          canvas.height = height;
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        attempts++;
      }

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen'));
    };

    img.src = objectUrl;
  });
}
