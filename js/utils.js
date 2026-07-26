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
