import { WALLET_CONFIG, setState, appState } from '../state.js';
import { formatCurrency, formatDateTime, escapeHTML } from './utils.js';
import { showModal } from './modales.js';

// --- CONSTANTE PARA PAGINACIÓN ---
const ITEMS_PER_PAGE = 15;

/**
 * Renderiza la sección completa de Capital, incluyendo los totales,
 * las billeteras, las deudas y el historial filtrado por fecha.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderCapitalSection(state) {
  const { stock, capital, debts, exchangeRate, capitalHistory, ui } = state;
  if (!stock || !capital || !debts || !exchangeRate || !capitalHistory || !ui.capital) return;

  // --- LÓGICA DE FILTRADO DE FECHA ---
  const { capitalPeriod, capitalCustomStartDate, capitalCustomEndDate } = ui.capital;

  document
    .querySelectorAll('.filter-btn[data-hub="capital"]')
    .forEach((btn) =>
      btn.classList.toggle('filter-btn-active', btn.dataset.period === capitalPeriod)
    );

  const customControls = document.getElementById('capital-custom-date-range-controls');
  if (customControls) {
    customControls.classList.toggle('hidden', capitalPeriod !== 'custom');
  }

  const now = new Date();
  let startDate, endDate;
  switch (capitalPeriod) {
    case 'today':
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      const day = now.getDay();
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - day + (day === 0 ? -6 : 1)
      );
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      startDate = capitalCustomStartDate
        ? new Date(capitalCustomStartDate + 'T00:00:00')
        : new Date(0);
      endDate = capitalCustomEndDate ? new Date(capitalCustomEndDate + 'T23:59:59') : new Date();
      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
  }

  const filteredHistory = capitalHistory.filter((entry) => {
    if (!entry.timestamp || !entry.timestamp.toDate) return false;
    const entryDate = entry.timestamp.toDate();
    return entryDate >= startDate && entryDate <= endDate;
  });

  // --- Cálculos de Capital ---
  const stockValueUSD = stock.reduce(
    (sum, item) => sum + (item.phoneCost || 0) * (item.quantity || 1),
    0
  );
  const totalDebtUSD = debts.reduce((sum, debt) => sum + (debt.amount || 0), 0);
  const arsWalletsUSD = ((capital.ars || 0) + (capital.mp || 0)) / exchangeRate;
  const usdWallets = (capital.usd || 0) + (capital.usdt || 0);
  const totalCapital =
    arsWalletsUSD + usdWallets + stockValueUSD + (capital.clientDebt || 0) - totalDebtUSD;
  const liquidCapitalUSD = arsWalletsUSD + usdWallets;

  // --- Renderizado de Totales ---
  const liquidCapitalEl = document.getElementById('capital-liquid');
  if (liquidCapitalEl) {
    liquidCapitalEl.textContent = formatCurrency(liquidCapitalUSD, 'USD');
  }
  const capitalTotalEl = document.getElementById('capital-total');
  if (capitalTotalEl) capitalTotalEl.textContent = formatCurrency(totalCapital, 'USD');
  const stockValueEl = document.getElementById('capital-stock-value');
  if (stockValueEl) stockValueEl.textContent = formatCurrency(stockValueUSD, 'USD');

  // --- Renderizado de Billeteras ---
  const walletsGridEl = document.getElementById('wallets-grid');
  if (walletsGridEl)
    walletsGridEl.innerHTML = Object.entries(WALLET_CONFIG)
      .filter(([k, c]) => !c.type)
      .map(
        ([key, config]) =>
          `<div class="bg-gray-50 p-4 rounded-lg border"><p class="text-sm text-gray-500 flex items-center"><i class="${
            config.icon
          } mr-2"></i>${config.name}</p><p class="text-2xl font-semibold mt-1">${formatCurrency(
            capital[key] || 0,
            config.currency
          )} <span class="text-lg text-gray-500">${
            config.currency === 'ARS'
              ? `(${formatCurrency((capital[key] || 0) / exchangeRate, 'USD')})`
              : ''
          }</span></p></div>`
      )
      .join('');

  // --- Renderizado de Activos y Pasivos ---
  const debtData = { clientDebt: capital.clientDebt, debt: totalDebtUSD };
  const debtsGridEl = document.getElementById('debts-grid');
  if (debtsGridEl)
    debtsGridEl.innerHTML = Object.entries(WALLET_CONFIG)
      .filter(([k, c]) => c.type)
      .map(
        ([key, config]) =>
          `<div class="bg-gray-50 p-4 rounded-lg border"><p class="text-sm text-gray-500 flex items-center"><i class="${
            config.icon
          } mr-2"></i>${config.name}</p><p class="text-2xl font-semibold mt-1 ${
            config.type === 'asset' ? 'asset' : 'liability'
          }">${formatCurrency(debtData[key] || 0, config.currency)}</p></div>`
      )
      .join('');

  // --- Renderizado de Listas Detalladas ---
  renderClientDebtsList(state);
  renderOurDebtsList(state);

  // --- Renderizado de Historial ---
  renderCapitalHistoryList(state, filteredHistory);
}

/**
 * Renderiza la lista del historial de movimientos de capital con paginación.
 * @param {object} state El estado actual de la aplicación.
 * @param {Array} filteredHistory El historial ya filtrado por fecha.
 */
function renderCapitalHistoryList(state, filteredHistory) {
  const container = document.getElementById('capital-history-list-container');
  const noHistoryMessage = document.getElementById('no-capital-history-message');

  if (!container || !noHistoryMessage) return;

  const page = state.ui?.capitalHistoryPage || 1;
  const totalItemsToShow = page * ITEMS_PER_PAGE;

  noHistoryMessage.classList.toggle('hidden', filteredHistory.length > 0);
  container.classList.toggle('hidden', filteredHistory.length === 0);

  if (filteredHistory.length > 0) {
    const visibleHistory = filteredHistory.slice(0, totalItemsToShow);

    container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="p-3 text-left">Fecha y Hora</th>
                            <th class="p-3 text-left">Motivo / Descripción</th>
                            <th class="p-3 text-right">Capital Total Resultante</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visibleHistory
                          .map(
                            (entry) => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-3 whitespace-nowrap">${formatDateTime(
                                  entry.timestamp
                                )}</td>
                                <td class="p-3">${escapeHTML(entry.reason)}</td>
                                <td class="p-3 text-right font-semibold">${formatCurrency(
                                  entry.totalCapital,
                                  'USD'
                                )}</td>
                            </tr>
                        `
                          )
                          .join('')}
                    </tbody>
                </table>
            </div>
            ${
              filteredHistory.length > totalItemsToShow
                ? `<div class="mt-6 text-center">
                     <button id="load-more-history" class="btn-secondary py-2 px-6">Mostrar más</button>
                   </div>`
                : ''
            }
        `;
  } else {
    container.innerHTML = '';
  }
}

/**
 * Renderiza la lista detallada de deudas de clientes.
 * @param {object} state El estado actual de la aplicación.
 */
function renderClientDebtsList(state) {
  if (!state.sales) return;
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

      const balanceUSD = sale.total - totalPaidExcludingDebt;
      const settledAmount = sale.debtSettled || 0;
      const outstandingBalance = balanceUSD - settledAmount;
      return { ...sale, balanceUSD: outstandingBalance };
    })
    .filter((sale) => sale.balanceUSD > 0.01);

  const clientDebtsListEl = document.getElementById('client-debts-list');
  if (!clientDebtsListEl) return;
  clientDebtsListEl.innerHTML =
    clientDebts.length === 0
      ? `<p class="text-gray-500 text-center py-4">No hay deudas de clientes.</p>`
      : clientDebts
          .map(
            (debt) => `
            <div class="bg-gray-50 p-3 rounded-lg flex justify-between items-center border">
                <div>
                    <p class="font-semibold">${escapeHTML(debt.customerName)}</p>
                    <p class="text-xs text-gray-500">${(debt.items || [])
                      .map((i) => i.model)
                      .join(', ')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <p class="font-bold text-yellow-500">${formatCurrency(
                      debt.balanceUSD,
                      'USD'
                    )}</p>
                    <button class="settle-client-debt-btn btn-primary text-xs py-1 px-2" data-sale-id="${
                      debt.id
                    }" data-balance="${debt.balanceUSD}">Saldar</button>
                </div>
            </div>`
          )
          .join('');
}

/**
 * Renderiza la lista detallada de deudas a proveedores.
 * @param {object} state El estado actual de la aplicación.
 */
function renderOurDebtsList(state) {
  const ourDebtsListEl = document.getElementById('our-debts-list');
  if (!ourDebtsListEl || !state.debts) return;
  ourDebtsListEl.innerHTML =
    state.debts.length === 0
      ? `<p class="text-gray-500 text-center py-4">No hay deudas a proveedores.</p>`
      : state.debts
          .map(
            (debt) => `
            <div class="bg-gray-50 p-3 rounded-lg flex justify-between items-center border">
                <div>
                    <p class="font-semibold">${escapeHTML(debt.debtorName)}</p>
                    <p class="text-xs text-gray-500">${escapeHTML(debt.description)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <p class="font-bold text-red-500">${formatCurrency(debt.amount, 'USD')}</p>
                    <button class="settle-our-debt-btn btn-primary text-xs py-1 px-2" data-debt-id="${
                      debt.id
                    }">Saldar</button>
                </div>
            </div>`
          )
          .join('');
}

/**
 * Abre el modal para ajustar los saldos de capital.
 * @param {object} state El estado actual de la aplicación.
 */
export function openAdjustCapitalModal(state) {
  const content = `
        <form id="adjust-capital-form" class="space-y-4">
            ${Object.entries(WALLET_CONFIG)
              .filter(([k, c]) => !c.type || k === 'clientDebt')
              .map(
                ([key, config]) =>
                  `<div>
                            <label class="block text-sm">${config.name}</label>
                            <input type="number" step="any" id="adjust-${key}" class="form-input w-full" value="${
                    state.capital[key] || 0
                  }">
                        </div>`
              )
              .join('')}
            <div>
                <label class="block text-sm font-medium text-gray-700">Motivo del Ajuste</label>
                <textarea id="adjust-capital-reason" class="form-textarea w-full mt-1" rows="3" placeholder="Ej: Corrección de caja, inversión inicial..." required></textarea>
            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="adjust-capital-form" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, 'Ajustar Saldos', footer);
}
