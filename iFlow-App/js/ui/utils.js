/**
 * Formatea un número como una moneda, manejando ARS, USD y USDT.
 * @param {number} number El número a formatear.
 * @param {string} currency El código de la moneda ('ARS', 'USD', 'USDT').
 * @returns {string} La cadena de texto formateada.
 */
export function formatCurrency(number, currency = 'ARS') {
  const num = number || 0;

  if (currency === 'USDT')
    return `${num.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USDT`;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(num);
  } catch (e) {
    // Fallback para entornos donde 'es-AR' podría no ser soportado
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
    }).format(num);
  }
}

/**
 * Formatea una cadena de fecha (YYYY-MM-DD) a un formato legible.
 * @param {string} dateString La fecha en formato 'YYYY-MM-DD'.
 * @returns {string} La fecha formateada (ej. "16 de agosto de 2025").
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  // Se añade 'T12:00:00Z' para evitar problemas de zona horaria
  const date = new Date(dateString + 'T12:00:00Z');
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Formatea un objeto Timestamp de Firebase a una cadena de fecha y hora legible.
 * @param {object} timestamp El objeto Timestamp de Firebase.
 * @returns {string} La fecha y hora formateada.
 */
export function formatDateTime(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return 'Fecha no disponible';
  }
  return timestamp.toDate().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Escapa caracteres HTML para prevenir inyecciones XSS.
 * @param {string} str La cadena de texto a escapar.
 * @returns {string} La cadena de texto segura.
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return str
    .toString()
    .replace(
      /[&<>"']/g,
      (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match])
    );
}
