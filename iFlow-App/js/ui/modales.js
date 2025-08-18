import { appState } from '../state.js';
import { getSubcollectionData } from '../api.js';
import { formatCurrency, formatDateTime } from './utils.js';

/**
 * Muestra un modal genérico en la pantalla con el contenido proporcionado.
 * @param {string} content El contenido HTML del cuerpo del modal.
 * @param {string} [title='Notificación'] El título del modal.
 * @param {string|null} [footerContent=null] El contenido HTML para el pie de página del modal. Si es nulo, se muestra un botón "Cerrar".
 */
export function showModal(content, title = 'Notificación', footerContent = null) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const footerHtml = footerContent
    ? `<div class="modal-footer flex justify-end gap-4">${footerContent}</div>`
    : `<div class="modal-footer"><button class="btn-primary close-modal-btn px-4 py-2">Cerrar</button></div>`;

  modalContainer.innerHTML = `
        <div id="app-modal" class="modal-backdrop">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-modal-btn text-2xl">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${footerHtml}
            </div>
        </div>`;

  modalContainer.querySelector('#app-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'app-modal' || e.target.closest('.close-modal-btn')) {
      modalContainer.innerHTML = '';
    }
  });
}

/**
 * Abre un modal de confirmación con un mensaje y una acción a ejecutar.
 * @param {string} message El mensaje a mostrar en el cuerpo del modal.
 * @param {Function} onConfirm La función a ejecutar si el usuario hace clic en "Confirmar".
 */
export function openConfirmModal(message, onConfirm) {
  const content = `<p>${message}</p>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button id="confirm-ok" class="btn-danger px-4 py-2">Confirmar</button>
    `;
  showModal(content, 'Confirmación Requerida', footer);

  const confirmButton = document.getElementById('confirm-ok');
  if (confirmButton) {
    confirmButton.addEventListener('click', () => {
      const modalContainer = document.getElementById('modal-container');
      if (modalContainer) {
        modalContainer.innerHTML = '';
      }
      if (onConfirm && typeof onConfirm === 'function') {
        onConfirm();
      }
    });
  }
}

// --- FUNCIÓN RESTAURADA Y MEJORADA ---
/**
 * Abre un modal genérico para procesar pagos desde diferentes billeteras.
 * @param {object} options Opciones de configuración para el modal de pago.
 */
export async function openPaymentModal(options) {
  const {
    paymentType,
    targetId,
    totalAmount,
    entityName,
    allowPartial,
    expenseData,
    paymentHistoryCollection,
  } = options;

  const { capital, exchangeRate } = appState;

  let paymentHistoryHtml = '';
  if (paymentHistoryCollection) {
    const payments = await getSubcollectionData(paymentHistoryCollection);
    if (payments.length > 0) {
      paymentHistoryHtml = `
            <div class="mt-4 pt-4 border-t">
                <h4 class="font-semibold text-sm mb-2">Historial de Pagos Anteriores</h4>
                <div class="space-y-2 max-h-32 overflow-y-auto text-xs">
                    ${payments
                      .map(
                        (p) => `
                        <div class="bg-gray-100 p-2 rounded-md flex justify-between">
                            <span>${formatDateTime(p.createdAt)}</span>
                            <span class="font-medium">${formatCurrency(p.amountUSD, 'USD')}</span>
                        </div>`
                      )
                      .join('')}
                </div>
            </div>
        `;
    }
  }

  const content = `
        <form id="payment-form-modal" class="space-y-4" 
              data-payment-type="${paymentType}" 
              data-target-id="${targetId || ''}" 
              data-total-amount="${totalAmount}"
              ${expenseData ? `data-expense-data='${JSON.stringify(expenseData)}'` : ''}>
            
            <p class="text-center">Total a pagar para <strong class="text-green-600">${entityName}</strong>:</p>
            <p class="text-center text-3xl font-bold">${formatCurrency(totalAmount, 'USD')}</p>
            
            <div class="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                    <label class="block text-sm">Efectivo (ARS)</label>
                    <input type="number" data-wallet="ars" class="payment-input-modal form-input w-full" placeholder="0" max="${
                      capital.ars || 0
                    }">
                </div>
                 <div>
                    <label class="block text-sm">Digital (ARS)</label>
                    <input type="number" data-wallet="mp" class="payment-input-modal form-input w-full" placeholder="0" max="${
                      capital.mp || 0
                    }">
                </div>
                 <div>
                    <label class="block text-sm">Dólares (USD)</label>
                    <input type="number" data-wallet="usd" class="payment-input-modal form-input w-full" placeholder="0" max="${
                      capital.usd || 0
                    }">
                </div>
                 <div>
                    <label class="block text-sm">USDT</label>
                    <input type="number" data-wallet="usdt" class="payment-input-modal form-input w-full" placeholder="0" max="${
                      capital.usdt || 0
                    }">
                </div>
            </div>
            <div class="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
                <div class="flex justify-between">
                    <span>Total Ingresado:</span>
                    <span id="payment-summary-paid" class="font-bold">US$ 0,00</span>
                </div>
                <div class="flex justify-between mt-1">
                    <span>Balance:</span>
                    <span id="payment-summary-balance" class="font-bold text-red-600">${formatCurrency(
                      totalAmount,
                      'USD'
                    )}</span>
                </div>
            </div>
            ${paymentHistoryHtml}
        </form>
    `;

  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="payment-form-modal" class="btn-primary px-4 py-2">Confirmar Pago</button>
    `;

  showModal(content, 'Registrar Pago', footer);
}
