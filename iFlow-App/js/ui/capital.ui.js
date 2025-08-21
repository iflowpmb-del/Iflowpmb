import { WALLET_CONFIG, setState, appState, charts } from '../state.js';
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
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + (day === 0 ? -6 : 1));
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
      startDate = capitalCustomStartDate ? new Date(capitalCustomStartDate + 'T00:00:00') : new Date(0);
      endDate = capitalCustomEndDate ? new Date(capitalCustomEndDate + 'T23:59:59') : new Date();
      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
  }

  const filteredHistory = capitalHistory.filter(entry => {
      if (!entry.timestamp || !entry.timestamp.toDate) return false;
      const entryDate = entry.timestamp.toDate();
      return entryDate >= startDate && entryDate <= endDate;
  });


  // --- Cálculos de Capital ---
  const stockValueUSD = stock.reduce(
    (sum, item) => sum + (item.phoneCost || 0) * (item.quantity || 1),
    0
  );
  // =================================================================================
  // INICIO DE MODIFICACIÓN: Se filtran las deudas para no incluir las saldadas en el total
  // =================================================================================
  const pendingDebts = debts.filter(debt => debt.status !== 'saldada');
  const totalDebtUSD = pendingDebts.reduce((sum, debt) => sum + (debt.amount || 0), 0);
  // =================================================================================
  // FIN DE MODIFICACIÓN
  // =================================================================================
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
  renderOurDebtsList(state, pendingDebts); // Se pasa la lista ya filtrada
  
  // --- Renderizado de Historial y Gráfico ---
  renderCapitalHistoryList(state, filteredHistory);
  renderCapitalEvolutionChart(filteredHistory);
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

    const page = state.ui?.pages?.capitalHistory || 1;
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
                        ${visibleHistory.map(entry => `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="p-3 whitespace-nowrap">${formatDateTime(entry.timestamp)}</td>
                                <td class="p-3">${escapeHTML(entry.reason)}</td>
                                <td class="p-3 text-right font-semibold">${formatCurrency(entry.totalCapital, 'USD')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${
              filteredHistory.length > totalItemsToShow
                ? `<div class="mt-6 text-center">
                     <button class="load-more-btn btn-secondary py-2 px-6" data-list-key="capitalHistory">Mostrar más</button>
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
 * @param {Array} pendingDebts La lista de deudas pendientes ya filtrada.
 */
function renderOurDebtsList(state, pendingDebts) {
  const ourDebtsListEl = document.getElementById('our-debts-list');
  if (!ourDebtsListEl || !pendingDebts) return;

  // =================================================================================
  // INICIO DE MODIFICACIÓN: Se utiliza la lista pre-filtrada `pendingDebts`
  // =================================================================================
  ourDebtsListEl.innerHTML =
    pendingDebts.length === 0
      ? `<p class="text-gray-500 text-center py-4">No hay deudas a proveedores.</p>`
      : pendingDebts
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
  // =================================================================================
  // FIN DE MODIFICACIÓN
  // =================================================================================
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
                            <input type="number" step="any" id="adjust-${key}" class="form-input w-full" value="${state.capital[key] || 0}">
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

// ===============================================================
// INICIO DE MODIFICACIÓN: Nueva función para renderizar el gráfico
// ===============================================================
/**
 * Renderiza el gráfico de evolución del capital.
 * @param {Array} filteredHistory El historial de capital ya filtrado por fecha.
 */
function renderCapitalEvolutionChart(filteredHistory) {
    const canvasEl = document.getElementById('capital-evolution-chart');
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');

    // Destruir el gráfico anterior si existe para evitar conflictos
    if (charts.capitalEvolution) {
        charts.capitalEvolution.destroy();
    }

    // Si no hay datos, no mostrar el gráfico
    if (filteredHistory.length === 0) {
        return;
    }

    // El historial viene del más nuevo al más viejo, lo invertimos para el gráfico
    const chronologicalHistory = [...filteredHistory].reverse();

    const labels = chronologicalHistory.map(entry => entry.timestamp.toDate());
    const dataPoints = chronologicalHistory.map(entry => entry.totalCapital);

    charts.capitalEvolution = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Capital Total (USD)',
                data: dataPoints,
                borderColor: '#16a34a', // Verde iFlow
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                fill: true,
                tension: 0.3, // Curva suave
                pointBackgroundColor: '#16a34a',
                pointRadius: dataPoints.length < 50 ? 4 : 2, // Puntos más grandes si hay pocos datos
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'dd/MM/yyyy HH:mm',
                        displayFormats: {
                            day: 'dd MMM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Fecha'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Capital Total (USD)'
                    },
                    ticks: {
                        // Formatear ticks del eje Y como moneda
                        callback: function(value, index, values) {
                            return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                notation: 'compact'
                            }).format(value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        // Personalizar el tooltip para mostrar la fecha completa y el valor exacto
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y, 'USD');
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}
// ===============================================================
// FIN DE MODIFICACIÓN
// ===============================================================
