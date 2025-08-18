import { formatCurrency, formatDate, formatDateTime, escapeHTML } from './utils.js';
import { showModal } from './modales.js';

/**
 * Renderiza las dos sub-secciones de la pestaña de Clientes.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderClientsSections(state) {
  renderClientsListSection(state);
  // =================================================================================
  // INICIO DE MODIFICACIÓN: Se llama a las dos funciones de renderizado de deudas
  // =================================================================================
  renderClientDebtsSection(state);
  renderClientDebtsHistory(state);
  // =================================================================================
  // FIN DE MODIFICACIÓN
  // =================================================================================
}

/**
 * Renderiza la lista de clientes en la sub-pestaña "Lista de Clientes".
 * @param {object} state El estado actual de la aplicación.
 */
function renderClientsListSection(state) {
  if (!state.clients) return;

  const searchTerm = state.clientSearchTerm || '';
  let filteredClients = state.clients;
  if (searchTerm) {
    filteredClients = state.clients.filter(
      (client) =>
        (client.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.phone && client.phone.includes(searchTerm))
    );
  }
  const clientsList = document.getElementById('clients-list-consultas');
  const noClientsMessage = document.getElementById('no-clients-message-consultas');
  if (!clientsList || !noClientsMessage) return;

  noClientsMessage.classList.toggle('hidden', state.clients.length > 0);
  if (filteredClients.length > 0) {
    clientsList.innerHTML = filteredClients
      .map(
        (client) =>
          `<div class="card p-4 rounded-lg flex flex-col justify-between hover:border-green-500 transition-colors"><div><p class="font-bold text-lg">${escapeHTML(
            client.name
          )}</p><p class="text-sm text-gray-500">${escapeHTML(
            client.phone || 'Sin teléfono'
          )}</p><p class="text-xs text-gray-400 mt-2">${escapeHTML(
            client.details || 'Sin detalles'
          )}</p></div><div class="flex items-center justify-between mt-4"><button class="view-client-history-btn btn-secondary text-xs py-1 px-2" data-client-id="${
            client.id
          }">Ver Historial</button><div class="flex items-center"><button class="edit-client-btn" data-client='${JSON.stringify(
            client
          )}'><i class="fas fa-edit text-gray-400 hover:text-blue-500"></i></button><button class="delete-client-btn ml-2" data-id="${
            client.id
          }" data-name="${escapeHTML(
            client.name
          )}"><i class="fas fa-trash text-gray-400 hover:text-red-500"></i></button></div></div></div>`
      )
      .join('');
  } else {
    clientsList.innerHTML = '';
    if (noClientsMessage) noClientsMessage.classList.remove('hidden');
  }
}

/**
 * Renderiza la lista de deudas de clientes en la sub-pestaña "Deudas de Clientes".
 * @param {object} state El estado actual de la aplicación.
 */
function renderClientDebtsSection(state) {
  const container = document.getElementById('client-debts-section-container');
  const noMessage = document.getElementById('no-client-debts-message');
  if (!container || !noMessage || !state.sales || !state.clientDebtPayments) return;

  const clientDebts = state.sales
    .map((sale) => {
      const payments = sale.paymentBreakdownUSD || {};
      let totalPaidExcludingDebt = 0;
      for (const method in payments) {
        if (method !== 'clientDebt' && method !== 'debtSettled') {
          totalPaidExcludingDebt += payments[method];
        }
      }
      totalPaidExcludingDebt += sale.tradeInValueUSD || 0;
      const debtAmount = sale.total - totalPaidExcludingDebt;
      const settledAmount = sale.debtSettled || 0;
      const outstandingBalance = debtAmount - settledAmount;
      return { ...sale, debtAmount, outstandingBalance };
    })
    .filter((sale) => sale.outstandingBalance > 0.01);

  noMessage.classList.toggle('hidden', clientDebts.length > 0);
  if (clientDebts.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Ahora que api.js carga todos los pagos, podemos agruparlos aquí de forma segura.
  const paymentsBySaleId = state.clientDebtPayments.reduce((acc, payment) => {
    const parentId = payment.parentId;
    if (!acc[parentId]) {
      acc[parentId] = [];
    }
    acc[parentId].push(payment);
    return acc;
  }, {});

  container.innerHTML = clientDebts
    .map((debt) => {
      const payments = paymentsBySaleId[debt.id] || [];
      const paymentHistoryHtml =
        payments.length > 0
          ? `
            <div class="payment-history-details hidden mt-3 pt-3 border-t">
                <h5 class="text-sm font-semibold mb-2 text-gray-600">Historial de Pagos</h5>
                <div class="space-y-2">
                    ${payments
                      .map(
                        (p) => `
                        <div class="bg-gray-100 p-2 rounded-md text-xs">
                            <div class="flex justify-between">
                                <span class="font-medium">${formatCurrency(
                                  p.amountUSD,
                                  'USD'
                                )}</span>
                                <span class="text-gray-500">${formatDateTime(p.createdAt)}</span>
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `
          : '';

      const buttonText =
        payments.length > 0 ? `Ver Pagos (${payments.length})` : '0 Pagos Registrados';

      return `
            <div class="debt-card-container card p-4">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-lg">${escapeHTML(debt.customerName)}</p>
                        <p class="text-sm text-gray-500">Origen: Venta de ${(debt.items || [])
                          .map((i) => i.model)
                          .join(', ')}</p>
                        <p class="text-xs text-gray-400">Fecha Venta: ${formatDate(
                          debt.saleDate
                        )}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-2xl text-yellow-600">${formatCurrency(
                          debt.outstandingBalance,
                          'USD'
                        )}</p>
                        <p class="text-xs text-gray-400">Deuda Original: ${formatCurrency(
                          debt.debtAmount,
                          'USD'
                        )}</p>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t flex justify-between items-center">
                    <button class="toggle-payment-history text-sm text-blue-600 hover:underline">
                        ${buttonText}
                        <i class="fas fa-chevron-down ml-1 text-xs"></i>
                    </button>
                    <button class="settle-client-debt-btn btn-primary py-1 px-3 text-sm" data-sale-id="${
                      debt.id
                    }" data-balance="${debt.outstandingBalance}">Cobrar</button>
                </div>
                ${paymentHistoryHtml}
            </div>
        `;
    })
    .join('');
}

// =================================================================================
// INICIO DE MODIFICACIÓN: Nueva función para renderizar el historial de deudas de clientes
// =================================================================================
/**
 * Renderiza el historial de deudas de clientes que ya han sido saldadas.
 * @param {object} state El estado actual de la aplicación.
 */
function renderClientDebtsHistory(state) {
  const container = document.getElementById('client-debts-history-container');
  const noMessage = document.getElementById('no-client-debts-history-message');
  if (!container || !noMessage || !state.sales) return;

  const settledClientDebts = state.sales
    .map((sale) => {
      const payments = sale.paymentBreakdownUSD || {};
      let totalPaidExcludingDebt = 0;
      for (const method in payments) {
        if (method !== 'clientDebt' && method !== 'debtSettled') {
          totalPaidExcludingDebt += payments[method];
        }
      }
      totalPaidExcludingDebt += sale.tradeInValueUSD || 0;
      const debtAmount = sale.total - totalPaidExcludingDebt;
      const settledAmount = sale.debtSettled || 0;
      const outstandingBalance = debtAmount - settledAmount;

      // Una deuda se considera saldada si tuvo un monto de deuda y ahora su balance es cero (o casi cero)
      if (debtAmount > 0.01 && outstandingBalance < 0.01) {
        return { ...sale, debtAmount };
      }
      return null;
    })
    .filter(Boolean); // Filtra los nulos

  noMessage.classList.toggle('hidden', settledClientDebts.length > 0);
  if (settledClientDebts.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = settledClientDebts
    .sort((a, b) => (b.soldAt?.toMillis() || 0) - (a.soldAt?.toMillis() || 0)) // Ordenar por fecha de venta
    .map(
      (debt) => `
            <div class="card p-4 bg-gray-50 opacity-80">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-lg text-gray-700">${escapeHTML(
                          debt.customerName
                        )}</p>
                        <p class="text-sm text-gray-500">Deuda original de ${formatCurrency(
                          debt.debtAmount,
                          'USD'
                        )}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-semibold text-lg text-green-600">Saldada</p>
                        <p class="text-xs text-gray-400">Venta del ${formatDate(debt.saleDate)}</p>
                    </div>
                </div>
            </div>
        `
    )
    .join('');
}
// =================================================================================
// FIN DE MODIFICACIÓN
// =================================================================================

// --- Modales Específicos de Clientes ---

/**
 * Abre el modal para añadir un nuevo cliente.
 */
export function openAddClientModal() {
  const content = `<form id="client-form-modal" class="space-y-4"><div><label class="block text-sm">Nombre</label><input type="text" id="client-name-modal" class="form-input w-full" required></div><div><label class="block text-sm">Teléfono</label><input type="text" id="client-phone-modal" class="form-input w-full"></div><div><label class="block text-sm">Detalles</label><textarea id="client-details-modal" class="form-textarea w-full"></textarea></div></form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="client-form-modal" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, 'Añadir Nuevo Cliente', footer);
}

/**
 * Abre el modal para editar un cliente existente.
 * @param {object} client El objeto del cliente a editar.
 */
export function openEditClientModal(client) {
  const content = `<form id="edit-client-form" class="space-y-4" data-id="${
    client.id
  }"><div><label class="block text-sm">Nombre</label><input type="text" id="edit-client-name" class="form-input w-full" value="${escapeHTML(
    client.name
  )}" required></div><div><label class="block text-sm">Teléfono</label><input type="text" id="edit-client-phone" class="form-input w-full" value="${escapeHTML(
    client.phone || ''
  )}"></div><div><label class="block text-sm">Detalles</label><textarea id="edit-client-details" class="form-textarea w-full">${escapeHTML(
    client.details || ''
  )}</textarea></div></form>`;

  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-client-form" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, `Editar Cliente`, footer);
}

/**
 * Muestra un modal con el historial de compras de un cliente.
 * @param {string} clientId El ID del cliente.
 * @param {object} state El estado actual de la aplicación.
 */
export function showClientHistoryModal(clientId, state) {
  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return;

  const clientSales = state.sales.filter((s) => s.clientId === clientId);
  const salesHtml =
    clientSales.length > 0
      ? clientSales
          .map((sale) => {
            const profitUSD = (sale.items || []).reduce(
              (sum, item) => sum + (item.salePrice - item.phoneCost),
              0
            );
            return `<div class="bg-gray-100 p-3 rounded-md border"><p class="font-semibold">${(
              sale.items || []
            )
              .map((i) => i.model)
              .join(', ')} - ${formatDate(
              sale.saleDate
            )}</p><p class="text-sm">Venta: ${formatCurrency(
              sale.total,
              'USD'
            )} | Ganancia: ${formatCurrency(profitUSD, 'USD')}</p></div>`;
          })
          .join('')
      : '<p class="text-gray-500">Este cliente no tiene compras registradas.</p>';

  const content = `<div class="space-y-4 text-left"><p><strong>Teléfono:</strong> ${escapeHTML(
    client.phone || 'N/A'
  )}</p><p><strong>Detalles:</strong> ${escapeHTML(
    client.details || 'N/A'
  )}</p><hr><h4 class="font-semibold text-lg">Historial de Compras</h4><div class="space-y-2 max-h-64 overflow-y-auto">${salesHtml}</div></div>`;
  const footer = `<div class="text-center mt-6"><button class="btn-primary close-modal-btn px-4 py-2">Cerrar</button></div>`;
  showModal(content, `Historial de ${client.name}`, footer);
}
