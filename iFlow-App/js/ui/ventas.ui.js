import { appState, setState, DEFAULT_CATEGORIES } from '../state.js';
import { formatCurrency, formatDate, formatDateTime, escapeHTML } from './utils.js';
import { showModal } from './modales.js';
// Se importa la función para generar campos de atributos desde el módulo de inventario
import { generateAttributeInputHTML } from './inventario.ui.js';

/**
 * Renderiza la sección de "Nueva Venta", actualizando los buscadores de clientes,
 * productos, la lista de items en el carrito y el selector de vendedores.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderSalesSection(state) {
  if (!state.clients || !state.stock || !state.salespeople) return;
  const { clients, stock, sale, salespeople } = state;

  // --- Renderizado del buscador de clientes ---
  const clientSearchInput = document.getElementById('client-search-input-sale');
  const clientSearchResults = document.getElementById('client-search-results');
  const selectedClientDisplay = document.getElementById('selected-client-display');
  if (!clientSearchInput || !clientSearchResults || !selectedClientDisplay) return;

  if (clientSearchInput.value !== sale.clientSearchTerm) {
    clientSearchInput.value = sale.clientSearchTerm;
  }
  if (sale.selectedClient) {
    selectedClientDisplay.innerHTML = `<div class="p-3 bg-green-100 border border-green-300 rounded-md flex justify-between items-center"><div><p class="font-bold">${escapeHTML(
      sale.selectedClient.name
    )}</p><p class="text-sm text-gray-600">${escapeHTML(
      sale.selectedClient.phone || 'Sin teléfono'
    )}</p></div><button type="button" id="remove-selected-client-btn" class="text-red-500 hover:text-red-700"><i class="fas fa-times-circle fa-lg"></i></button></div>`;
    clientSearchInput.parentElement.classList.add('hidden');
    clientSearchResults.classList.add('hidden');
  } else {
    selectedClientDisplay.innerHTML = '';
    clientSearchInput.parentElement.classList.remove('hidden');
    if (sale.clientSearchTerm && sale.clientSearchTerm.length > 0) {
      const filteredClients = clients.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(sale.clientSearchTerm.toLowerCase()) ||
          (c.phone && c.phone.includes(sale.clientSearchTerm))
      );
      clientSearchResults.innerHTML =
        filteredClients.length > 0
          ? filteredClients
              .map(
                (c) =>
                  `<div class="p-3 hover:bg-gray-100 cursor-pointer client-result-item" data-client='${JSON.stringify(
                    c
                  )}'>${escapeHTML(c.name)}</div>`
              )
              .join('')
          : `<div class="p-3 text-gray-500">No se encontraron clientes.</div>`;
      clientSearchResults.classList.remove('hidden');
    } else {
      clientSearchResults.classList.add('hidden');
    }
  }

  // --- Renderizado del buscador de productos en stock ---
  const stockSearchInput = document.getElementById('stock-search-input-sale');
  const stockSearchResults = document.getElementById('stock-search-results-sale');
  if (!stockSearchInput || !stockSearchResults) return;

  if (stockSearchInput.value !== sale.stockSearchTerm) {
    stockSearchInput.value = sale.stockSearchTerm;
  }
  if (sale.stockSearchTerm && sale.stockSearchTerm.length > 0) {
    const itemsInCartIds = (sale.items || []).map((i) => i.id);
    const filteredStock = stock.filter(
      (item) =>
        item.status !== 'reservado' &&
        (item.quantity || 0) > 0 &&
        !itemsInCartIds.includes(item.id) &&
        ((item.model || '').toLowerCase().includes(sale.stockSearchTerm.toLowerCase()) ||
          (item.serialNumber || '').toLowerCase().includes(sale.stockSearchTerm.toLowerCase()))
    );
    stockSearchResults.innerHTML =
      filteredStock.length > 0
        ? filteredStock
            .map(
              (item) => `
                <div class="p-3 hover:bg-gray-100 cursor-pointer stock-result-item" data-stock='${JSON.stringify(
                  item
                )}'>
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="font-bold">${escapeHTML(
                              item.model
                            )} <span class="font-normal text-gray-500">(${escapeHTML(
                item.category
              )})</span></p>
                            <p class="text-xs text-gray-500">${escapeHTML(item.serialNumber)}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm font-bold">Stock: ${item.quantity || 0}</p>
                            <p class="text-xs text-green-600">P. Sug: ${formatCurrency(
                              item.suggestedSalePrice,
                              'USD'
                            )}</p>
                        </div>
                    </div>
                </div>
            `
            )
            .join('')
        : `<div class="p-3 text-gray-500">No se encontraron productos en stock.</div>`;
    stockSearchResults.classList.remove('hidden');
  } else {
    stockSearchResults.classList.add('hidden');
  }

  // --- Renderizado de items en el carrito de venta ---
  const saleItemsList = document.getElementById('sale-items-list');
  if (!saleItemsList) return;
  if (sale.items && sale.items.length > 0) {
    saleItemsList.innerHTML = sale.items
      .map((item, index) => {
        const profit = (item.salePrice || 0) - (item.phoneCost || 0);
        return `
            <div class="p-3 bg-white border rounded-lg flex flex-col gap-2">
                <div class="flex items-center justify-between gap-4">
                    <div class="flex-grow flex items-center gap-2">
                        <button type="button" class="view-item-details-btn text-blue-500 hover:text-blue-700" data-item-index="${index}"><i class="fas fa-info-circle"></i></button>
                        <div>
                            <p class="font-semibold">${escapeHTML(item.model)}</p>
                            <p class="text-xs text-gray-500">${escapeHTML(item.serialNumber)}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-sm">Precio:</label>
                        <input type="number" value="${
                          item.salePrice || item.suggestedSalePrice || 0
                        }" class="form-input p-1 w-24 text-right sale-item-price" data-index="${index}">
                    </div>
                    <button type="button" class="remove-sale-item-btn text-red-500 hover:text-red-700" data-index="${index}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="flex justify-between items-center text-xs text-gray-600 border-t pt-2 mt-2">
                    <span>Costo: ${formatCurrency(item.phoneCost || 0, 'USD')}</span>
                    <span class="font-bold ${
                      profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }">Ganancia: ${formatCurrency(profit, 'USD')}</span>
                </div>
            </div>
            `;
      })
      .join('');
  } else {
    saleItemsList.innerHTML = `<p class="text-center text-gray-500 py-4">Añade productos a la venta buscándolos arriba.</p>`;
  }

  // --- Renderizado del selector de vendedores ---
  const salespersonSelector = document.getElementById('salesperson-selector');
  const commissionContainer = document.getElementById('commission-container');
  if (salespersonSelector && commissionContainer) {
    salespersonSelector.innerHTML = '<option value="">Ninguno</option>';
    salespeople.forEach((person) => {
      const option = document.createElement('option');
      option.value = person.id;
      option.textContent = person.name;
      if (sale.salespersonId === person.id) {
        option.selected = true;
      }
      salespersonSelector.appendChild(option);
    });

    commissionContainer.classList.toggle('hidden', !sale.salespersonId);
  }
}

/**
 * Renderiza el historial de ventas, agrupado por día.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderSalesHistory(state) {
  if (!state.sales) return;
  const container = document.getElementById('sales-list-container');
  const noSalesMessage = document.getElementById('no-sales-message');
  const searchInput = document.getElementById('sales-search-input');
  if (!container || !noSalesMessage || !searchInput) return;

  if (searchInput.value !== state.salesSearchTerm) {
    searchInput.value = state.salesSearchTerm;
  }

  const searchTerm = (state.salesSearchTerm || '').toLowerCase();
  const filteredSales = state.sales.filter((sale) => {
    if (!searchTerm) return true;
    const searchInClient = (sale.customerName || '').toLowerCase().includes(searchTerm);
    const searchInItems = (sale.items || []).some(
      (item) =>
        (item.model || '').toLowerCase().includes(searchTerm) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm))
    );
    return searchInClient || searchInItems;
  });

  noSalesMessage.classList.toggle('hidden', state.sales.length > 0);
  container.classList.toggle('hidden', filteredSales.length === 0 && searchTerm);

  if (filteredSales.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron ventas para "${escapeHTML(
        state.salesSearchTerm
      )}".</p>`;
    } else {
      container.innerHTML = '';
    }
    return;
  }

  const salesByDay = filteredSales.reduce((acc, sale) => {
    const date =
      sale.saleDate ||
      (sale.soldAt ? new Date(sale.soldAt.seconds * 1000).toISOString().split('T')[0] : 'nodate');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(sale);
    return acc;
  }, {});

  const sortedDays = Object.keys(salesByDay).sort((a, b) => new Date(b) - new Date(a));

  container.innerHTML = sortedDays
    .map((day) => {
      const salesOfTheDay = salesByDay[day];
      const dayTotal = salesOfTheDay.reduce((sum, s) => sum + s.total, 0);

      const dayProfit = salesOfTheDay.reduce((sum, s) => {
        const itemsCost = (s.items || []).reduce((itemSum, i) => itemSum + (i.phoneCost || 0), 0);
        const commission = s.commissionUSD || 0;
        return sum + (s.total - itemsCost - commission);
      }, 0);

      return `
            <div class="day-group mt-8">
                <div class="flex justify-between items-center bg-gray-100 p-3 rounded-t-lg border-b">
                    <h3 class="text-xl font-bold text-gray-700">${formatDate(day)}</h3>
                    <div class="text-right">
                        <p class="text-sm text-gray-600">Total Día: <span class="font-semibold">${formatCurrency(
                          dayTotal,
                          'USD'
                        )}</span></p>
                        <p class="text-sm text-gray-600">Ganancia Neta Día: <span class="font-semibold ${
                          dayProfit >= 0 ? 'text-green-600' : 'text-red-600'
                        }">${formatCurrency(dayProfit, 'USD')}</span></p>
                    </div>
                </div>
                <div class="space-y-4 p-4 bg-white rounded-b-lg shadow-sm">
                    ${salesOfTheDay.map((sale) => renderSaleCard(sale)).join('')}
                </div>
            </div>
        `;
    })
    .join('');
}

/**
 * Renderiza una tarjeta individual para una venta en el historial.
 * @param {object} sale El objeto de la venta.
 * @returns {string} El HTML de la tarjeta de venta.
 */
function renderSaleCard(sale) {
  const grossProfit = (sale.items || []).reduce(
    (sum, i) => sum + (i.salePrice - (i.phoneCost || 0)),
    0
  );
  const netProfit = grossProfit - (sale.commissionUSD || 0);

  let daysSinceSaleHtml = '';
  const saleDate =
    sale.soldAt?.toDate() || (sale.saleDate ? new Date(sale.saleDate + 'T12:00:00Z') : null);
  if (saleDate) {
    const today = new Date();
    const diffTime = Math.abs(today - saleDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    daysSinceSaleHtml = `<span class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full" title="Días desde la venta">${diffDays} día(s) (Garantía)</span>`;
  }

  return `
        <div class="sale-card border p-4 rounded-lg hover:shadow-md transition-shadow" data-sale-id="${
          sale.id
        }">
            <div class="flex justify-between items-start cursor-pointer" data-action="open-details">
                <div>
                    <p class="font-bold text-lg">${escapeHTML(sale.customerName)}</p>
                    <p class="text-sm text-gray-500">${(sale.items || [])
                      .map((i) => escapeHTML(i.model))
                      .join(', ')}</p>
                    ${
                      sale.salespersonName
                        ? `<p class="text-xs text-blue-600 mt-1"><i class="fas fa-user-tie mr-1"></i> ${escapeHTML(
                            sale.salespersonName
                          )}</p>`
                        : ''
                    }
                </div>
                <div class="text-right flex-shrink-0 ml-4">
                    <p class="text-xl font-bold">${formatCurrency(sale.total, 'USD')}</p>
                    <p class="text-sm ${
                      netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }">Ganancia Neta: ${formatCurrency(netProfit, 'USD')}</p>
                </div>
            </div>
            <div class="mt-3 pt-3 border-t flex justify-between items-center">
                ${daysSinceSaleHtml}
                <div class="flex gap-2">
                    <button class="delete-sale-btn btn-danger text-xs py-1 px-2 rounded" data-sale-id="${
                      sale.id
                    }">Anular</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Actualiza el resumen de la venta (subtotal, balance, ganancia) en tiempo real.
 * @param {object} state El estado actual de la aplicación.
 */
export function updateSaleBalance(state) {
  const { sale, exchangeRate } = state;
  const summaryEl = document.getElementById('sale-summary');
  if (!summaryEl || !exchangeRate) return;

  const subtotal = (sale.items || []).reduce((sum, item) => sum + (item.salePrice || 0), 0);
  const costTotal = (sale.items || []).reduce((sum, item) => sum + (item.phoneCost || 0), 0);

  const commissionInput = document.getElementById('commission-amount');
  const commission = commissionInput ? parseFloat(commissionInput.value) || 0 : 0;

  const totalSalePrice = subtotal;
  const netProfit = totalSalePrice - costTotal - commission;

  const tradeInCheckbox = document.getElementById('has-trade-in');
  const tradeInValueInput = document.getElementById('trade-in-value');
  const tradeInValueUSD =
    tradeInCheckbox && tradeInCheckbox.checked && tradeInValueInput
      ? parseFloat(tradeInValueInput.value) || 0
      : 0;

  let totalPaidViaMethods = 0;
  document.querySelectorAll('.payment-input').forEach((input) => {
    const value = parseFloat(input.value) || 0;
    const type = input.dataset.payment;
    if (type === 'ars' || type === 'mp') {
      totalPaidViaMethods += value / exchangeRate;
      const displayElement = document.getElementById(`${type}-usd-display`);
      if (displayElement) {
        if (value > 0) {
          displayElement.textContent = `~ ${formatCurrency(value / exchangeRate, 'USD')}`;
        } else {
          displayElement.textContent = '';
        }
      }
    } else {
      totalPaidViaMethods += value;
    }
  });

  const totalReceived = totalPaidViaMethods + tradeInValueUSD;
  const balance = totalSalePrice - totalReceived;

  const commissionHTML =
    commission > 0
      ? `<div class="flex justify-between items-center text-sm text-red-600"><span>Comisión Vendedor:</span> <span class="font-medium">-${formatCurrency(
          commission,
          'USD'
        )}</span></div>`
      : '';

  summaryEl.innerHTML = `
        <div class="flex justify-between items-center text-sm"><span>Subtotal:</span> <span class="font-medium">${formatCurrency(
          subtotal,
          'USD'
        )}</span></div>
        ${
          tradeInValueUSD > 0
            ? `<div class="flex justify-between items-center text-sm"><span>Canje (Crédito):</span> <span class="font-medium text-blue-600">-${formatCurrency(
                tradeInValueUSD,
                'USD'
              )}</span></div>`
            : ''
        }
        <div class="border-t my-2"></div>
        <div class="flex justify-between items-center font-bold text-lg"><span>Total a Pagar:</span> <span>${formatCurrency(
          totalSalePrice - tradeInValueUSD,
          'USD'
        )}</span></div>
        <div class="flex justify-between items-center text-sm"><span>Total Pagado (Métodos):</span> <span>${formatCurrency(
          totalPaidViaMethods,
          'USD'
        )}</span></div>
        <div class="flex justify-between items-center font-bold text-xl ${
          balance > -0.01 && balance < 0.01 ? 'text-green-600' : 'text-red-600'
        }">
            <span>Balance:</span> <span>${formatCurrency(balance, 'USD')}</span>
        </div>
        <div class="border-t my-2 pt-2"></div>
        <div class="flex justify-between items-center text-sm"><span>Ganancia Bruta (Venta):</span> <span class="font-bold">${formatCurrency(
          totalSalePrice - costTotal,
          'USD'
        )}</span></div>
        ${commissionHTML}
        <div class="flex justify-between items-center text-sm font-bold border-t pt-2 mt-2"><span>Ganancia NETA:</span> <span class="${
          netProfit >= 0 ? 'text-green-600' : 'text-red-600'
        }">${formatCurrency(netProfit, 'USD')}</span></div>
    `;
}

/**
 * Muestra u oculta los detalles del formulario de canje (trade-in).
 */
export function toggleTradeInDetails() {
  const tradeInCheckbox = document.getElementById('has-trade-in');
  const tradeInDetailsEl = document.getElementById('trade-in-details');
  if (!tradeInCheckbox || !tradeInDetailsEl) return;
  const show = tradeInCheckbox.checked;

  if (show) {
    // Siempre que se muestre, se reconstruye el formulario para asegurar que esté limpio.
    const allCategories = [...(appState.categories || []), ...DEFAULT_CATEGORIES];
    const categoryOptions =
      '<option value="">-- Seleccionar --</option>' +
      allCategories
        .map((cat) => `<option value="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</option>`)
        .join('');

    tradeInDetailsEl.innerHTML = `
            <h4 class="text-lg font-semibold text-gray-700 mb-2">Detalles del Equipo Recibido</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label class="text-sm">Categoría</label>
                    <select id="trade-in-category" class="form-select w-full p-2 mt-1">${categoryOptions}</select>
                </div>
                <div>
                    <label class="text-sm">N/S (Opcional)</label>
                    <input type="text" id="trade-in-serial" class="form-input w-full p-2 mt-1">
                </div>
                 <div>
                    <label class="text-sm">Valor de Toma (USD)</label>
                    <input type="number" id="trade-in-value" class="form-input w-full p-2 mt-1" value="0" required>
                </div>
                <div>
                    <label class="text-sm">P. Venta Sugerido (USD)</label>
                    <input type="number" id="trade-in-sug-price" class="form-input w-full p-2 mt-1">
                </div>
                 <div class="md:col-span-2">
                    <label class="text-sm">Detalles Adicionales</label>
                    <textarea id="trade-in-details-input" rows="1" class="form-textarea w-full p-2 mt-1"></textarea>
                </div>
            </div>
            <div id="trade-in-attributes-container" class="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <!-- Los atributos dinámicos se renderizarán aquí -->
            </div>
        `;
  }

  tradeInDetailsEl.classList.toggle('hidden', !show);

  if (!show) {
    const tradeInValue = document.getElementById('trade-in-value');
    if (tradeInValue) {
      tradeInValue.value = 0;
    }
    tradeInDetailsEl.innerHTML = ''; // Limpia el contenido al ocultar
  }

  updateSaleBalance(appState);
}

/**
 * Renderiza los campos de atributos dinámicos para el producto de canje.
 */
// =================================================================================
// INICIO DE LA MODIFICACIÓN: UNIFICACIÓN DE FORMULARIO DE CANJE
// Esta función ahora usa la misma lógica centralizada que los otros formularios.
// =================================================================================
export function renderTradeInAttributes() {
  const categorySelect = document.getElementById('trade-in-category');
  const attributesContainer = document.getElementById('trade-in-attributes-container');
  if (!categorySelect || !attributesContainer) return;

  // Recolecta los valores actuales del formulario para mantener el estado.
  const currentValues = {};
  const formElements = document.querySelectorAll(
    '#trade-in-details select, #trade-in-details input'
  );
  formElements.forEach((el) => {
    if (el.id) {
      currentValues[el.id] = el.value;
    }
  });

  const selectedCategoryName = categorySelect.value;
  if (!selectedCategoryName) {
    attributesContainer.innerHTML =
      '<p class="text-sm text-gray-400 col-span-full">Selecciona una categoría para ver sus atributos.</p>';
    return;
  }

  const allCategories = [...(appState.categories || []), ...DEFAULT_CATEGORIES];
  const selectedCategory = allCategories.find((c) => c.name === selectedCategoryName);

  if (selectedCategory && selectedCategory.attributes) {
    // Llama a la función centralizada `generateAttributeInputHTML` para construir los campos.
    attributesContainer.innerHTML = selectedCategory.attributes
      .map((attr) => generateAttributeInputHTML(attr, currentValues, 'tradein'))
      .join('');
  } else {
    attributesContainer.innerHTML = '';
  }
}
// =================================================================================
// FIN DE LA MODIFICACIÓN
// =================================================================================

/**
 * Renderiza la sección de gestión de reservas.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderReservationsSection(state) {
  if (!state.reservations) return;

  const container = document.getElementById('reservations-list-container');
  const noMessage = document.getElementById('no-reservations-message');
  const searchInput = document.getElementById('reservations-search-input');

  if (!container || !noMessage || !searchInput) return;

  if (searchInput.value !== state.reservationsSearchTerm) {
    searchInput.value = state.reservationsSearchTerm;
  }

  const searchTerm = (state.reservationsSearchTerm || '').toLowerCase();
  const filteredReservations = state.reservations.filter(
    (res) =>
      (res.customerName || '').toLowerCase().includes(searchTerm) ||
      (res.item?.model || '').toLowerCase().includes(searchTerm)
  );

  noMessage.classList.toggle('hidden', state.reservations.length > 0);
  container.classList.toggle('hidden', filteredReservations.length === 0 && searchTerm.length > 0);

  if (filteredReservations.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron reservas para "${escapeHTML(
        searchTerm
      )}".</p>`;
    } else {
      container.innerHTML = '';
    }
    return;
  }

  container.innerHTML = filteredReservations
    .map((res) => {
      const depositText = res.hasDeposit
        ? `<span class="font-semibold text-green-700">${formatCurrency(
            res.depositAmountUSD,
            'USD'
          )}</span>`
        : '<span class="text-gray-500">No</span>';

      return `
        <div class="bg-white p-4 rounded-lg border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="flex-grow">
                <p class="font-bold text-lg">${escapeHTML(
                  res.item?.model || 'Producto no encontrado'
                )}</p>
                <p class="text-sm text-gray-600">Para: <span class="font-semibold">${escapeHTML(
                  res.customerName
                )}</span></p>
                <p class="text-xs text-gray-500">Reservado el: ${formatDateTime(res.createdAt)}</p>
            </div>
            <div class="flex-shrink-0 text-left md:text-right">
                <p class="text-sm">Seña: ${depositText}</p>
            </div>
            <div class="flex-shrink-0 flex items-center gap-2 w-full md:w-auto">
                <button class="cancel-reservation-btn btn-danger py-2 px-3 text-sm flex-1 md:flex-none" data-id="${
                  res.id
                }"><i class="fas fa-times mr-1"></i> Cancelar</button>
                <button class="finalize-sale-from-reservation-btn btn-primary py-2 px-3 text-sm flex-1 md:flex-none" data-id="${
                  res.id
                }"><i class="fas fa-check mr-1"></i> Finalizar Venta</button>
            </div>
        </div>
        `;
    })
    .join('');
}

/**
 * Renderiza la sección de gestión de vendedores (lista o detalle).
 * @param {object} state El estado actual de la aplicación.
 */
export function renderSalespeopleSection(state) {
  if (!state.salespeople) return;

  const { salespeople, salespeopleSearchTerm, ui } = state;
  const listView = document.getElementById('salespeople-list-view');
  const detailView = document.getElementById('salesperson-detail-view');

  if (!listView || !detailView) return;

  if (ui.selectedSalespersonId) {
    listView.classList.add('hidden');
    detailView.classList.remove('hidden');
    renderSalespersonDetailView(state);
    return;
  }

  listView.classList.remove('hidden');
  detailView.classList.add('hidden');

  const container = document.getElementById('salespeople-list-container');
  const noMessage = document.getElementById('no-salespeople-message');
  const searchInput = document.getElementById('salespeople-search-input');
  if (!container || !noMessage || !searchInput) return;

  if (searchInput.value !== salespeopleSearchTerm) {
    searchInput.value = salespeopleSearchTerm;
  }

  const searchTerm = (salespeopleSearchTerm || '').toLowerCase();
  const filteredSalespeople = salespeople.filter((p) =>
    (p.name || '').toLowerCase().includes(searchTerm)
  );
  noMessage.classList.toggle('hidden', salespeople.length > 0);
  container.innerHTML = '';

  if (filteredSalespeople.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8 col-span-full">No se encontraron vendedores para "${escapeHTML(
        searchTerm
      )}".</p>`;
    }
    return;
  }

  container.innerHTML = filteredSalespeople
    .map(
      (person) => `
        <div class="card p-4 flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div class="flex-grow">
                <p class="font-bold text-lg">${escapeHTML(person.name)}</p>
                <p class="text-sm text-gray-500">${escapeHTML(person.contact || 'Sin contacto')}</p>
            </div>
            <div class="flex items-center justify-between mt-4">
                <button class="view-salesperson-details-btn btn-secondary text-xs py-1 px-3" data-id="${
                  person.id
                }">Ver Detalles</button>
                <div class="flex items-center">
                    <button class="edit-salesperson-btn text-gray-400 hover:text-blue-500" data-salesperson='${JSON.stringify(
                      person
                    )}'><i class="fas fa-edit"></i></button>
                    <button class="delete-salesperson-btn ml-2 text-gray-400 hover:text-red-500" data-id="${
                      person.id
                    }" data-name="${escapeHTML(person.name)}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `
    )
    .join('');
}

/**
 * Renderiza la vista de detalle para un vendedor específico.
 * @param {object} state El estado actual de la aplicación.
 */
function renderSalespersonDetailView(state) {
  const { salespeople, sales, ui } = state;
  const detailViewContainer = document.getElementById('salesperson-detail-view');
  if (!detailViewContainer) return;

  const selectedSalesperson = salespeople.find((p) => p.id === ui.selectedSalespersonId);
  if (!selectedSalesperson) {
    detailViewContainer.innerHTML = '';
    return;
  }

  const salespersonSales = sales.filter((s) => s.salespersonId === selectedSalesperson.id);
  const totalCommissions = salespersonSales.reduce((sum, s) => sum + (s.commissionUSD || 0), 0);
  const totalSalesValue = salespersonSales.reduce((sum, s) => sum + (s.total || 0), 0);

  const salesHistoryHtml =
    salespersonSales.length > 0
      ? `
        <div class="space-y-3 mt-4">
            ${salespersonSales
              .map((sale) => {
                const netProfit =
                  (sale.items || []).reduce(
                    (sum, i) => sum + (i.salePrice - (i.phoneCost || 0)),
                    0
                  ) - (sale.commissionUSD || 0);
                return `
                    <div class="bg-white p-3 rounded-lg border flex justify-between items-center">
                        <div>
                            <p class="font-semibold">${(sale.items || [])
                              .map((i) => i.model)
                              .join(', ')}</p>
                            <p class="text-xs text-gray-500">a ${escapeHTML(
                              sale.customerName
                            )} el ${formatDate(sale.saleDate)}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-semibold text-blue-600">${formatCurrency(
                              sale.commissionUSD,
                              'USD'
                            )}</p>
                            <p class="text-xs">Ganancia Neta: ${formatCurrency(
                              netProfit,
                              'USD'
                            )}</p>
                        </div>
                    </div>
                `;
              })
              .join('')}
        </div>
    `
      : `<p class="text-center text-gray-500 mt-6">Este vendedor aún no tiene ventas registradas.</p>`;

  detailViewContainer.innerHTML = `
        <div class="card p-6 md:p-8">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h3 class="text-3xl font-bold">${escapeHTML(selectedSalesperson.name)}</h3>
                    <p class="text-gray-500">${escapeHTML(
                      selectedSalesperson.contact || 'Sin contacto'
                    )}</p>
                </div>
                <button id="back-to-salespeople-list" class="btn-secondary py-2 px-4"><i class="fas fa-arrow-left mr-2"></i>Volver</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-6">
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Ventas Realizadas</p><p class="text-2xl font-bold">${
                  salespersonSales.length
                }</p></div>
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Volumen de Venta</p><p class="text-2xl font-bold">${formatCurrency(
                  totalSalesValue,
                  'USD'
                )}</p></div>
                <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Comisiones Totales</p><p class="text-2xl font-bold text-green-600">${formatCurrency(
                  totalCommissions,
                  'USD'
                )}</p></div>
            </div>

            <h4 class="text-xl font-semibold mt-8 border-b pb-2">Historial de Ventas</h4>
            ${salesHistoryHtml}
        </div>
    `;
}

// --- Modales Específicos de Ventas ---

/**
 * Abre el modal para crear una nueva reserva.
 * @param {object} state El estado actual de la aplicación.
 */
export function openReservationModal(state) {
  const { clients, stock, reservationForm } = state;

  let selectedClientHtml = '';
  if (reservationForm.selectedClient) {
    selectedClientHtml = `<div class="p-2 bg-green-100 border rounded-md flex justify-between items-center"><span>${escapeHTML(
      reservationForm.selectedClient.name
    )}</span><button type="button" id="remove-reservation-client-btn" class="text-red-500 text-lg">&times;</button></div>`;
  }

  // =================================================================================
  // INICIO DE LA MODIFICACIÓN: Mostrar detalles del producto seleccionado
  // =================================================================================
  let selectedItemHtml = '';
  if (reservationForm.selectedItem) {
    const item = reservationForm.selectedItem;
    selectedItemHtml = `
        <div class="p-3 bg-green-100 border border-green-300 rounded-lg">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-bold">${escapeHTML(item.model)}</p>
                    <p class="text-sm text-gray-600 font-mono">${escapeHTML(item.serialNumber)}</p>
                </div>
                <button type="button" id="remove-reservation-item-btn" class="text-red-500 hover:text-red-700 text-xl">&times;</button>
            </div>
            <div class="mt-2 pt-2 border-t border-green-200 grid grid-cols-2 gap-2 text-sm">
                <div>
                    <span class="text-gray-500">Costo:</span>
                    <p class="font-semibold">${formatCurrency(item.phoneCost, 'USD')}</p>
                </div>
                <div>
                    <span class="text-gray-500">P. Venta Sug.:</span>
                    <p class="font-semibold text-green-700">${formatCurrency(
                      item.suggestedSalePrice,
                      'USD'
                    )}</p>
                </div>
            </div>
        </div>`;
  }
  // =================================================================================
  // FIN DE LA MODIFICACIÓN
  // =================================================================================

  const content = `
        <form id="reservation-form" class="space-y-6">
            <div class="space-y-2">
                <h4 class="font-semibold">1. Cliente</h4>
                <div class="relative">
                    ${selectedClientHtml}
                    <div id="reservation-client-search-container" class="${
                      reservationForm.selectedClient ? 'hidden' : ''
                    }">
                         <input type="text" id="reservation-client-search-input" class="form-input w-full" placeholder="Buscar cliente..." value="${escapeHTML(
                           reservationForm.clientSearchTerm || ''
                         )}">
                         <div id="reservation-client-search-results" class="absolute z-20 w-full bg-white border rounded-md mt-1 hidden max-h-48 overflow-y-auto"></div>
                    </div>
                </div>
            </div>

            <div class="space-y-2">
                <h4 class="font-semibold">2. Producto a Reservar</h4>
                 <div class="relative">
                    ${selectedItemHtml}
                    <div id="reservation-stock-search-container" class="${
                      reservationForm.selectedItem ? 'hidden' : ''
                    }">
                        <input type="text" id="reservation-stock-search-input" class="form-input w-full" placeholder="Buscar producto disponible..." value="${escapeHTML(
                          reservationForm.stockSearchTerm || ''
                        )}">
                        <div id="reservation-stock-search-results" class="absolute z-10 w-full bg-white border rounded-md mt-1 hidden max-h-48 overflow-y-auto"></div>
                    </div>
                </div>
            </div>

            <div class="space-y-3 pt-4 border-t">
                <h4 class="font-semibold">3. Seña (Opcional)</h4>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div><label class="text-sm">Efectivo (ARS)</label><input type="number" data-payment="ars" class="payment-input-reservation form-input w-full p-2 mt-1" value="0"></div>
                    <div><label class="text-sm">Digital (ARS)</label><input type="number" data-payment="mp" class="payment-input-reservation form-input w-full p-2 mt-1" value="0"></div>
                    <div><label class="text-sm">Dólares (USD)</label><input type="number" data-payment="usd" class="payment-input-reservation form-input w-full p-2 mt-1" value="0"></div>
                    <div><label class="text-sm">USDT</label><input type="number" data-payment="usdt" class="payment-input-reservation form-input w-full p-2 mt-1" value="0"></div>
                </div>
            </div>

             <div class="space-y-2 pt-4 border-t">
                 <h4 class="font-semibold">4. Notas Adicionales</h4>
                 <textarea id="reservation-notes" rows="2" class="form-textarea w-full"></textarea>
            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="reservation-form" class="btn-primary px-4 py-2">Guardar Reserva</button>
    `;
  showModal(content, 'Crear Nueva Reserva', footer);

  if (reservationForm.clientSearchTerm) {
    const resultsContainer = document.getElementById('reservation-client-search-results');
    const filteredClients = clients.filter((c) =>
      c.name.toLowerCase().includes(reservationForm.clientSearchTerm.toLowerCase())
    );
    resultsContainer.innerHTML = filteredClients
      .map(
        (c) =>
          `<div class="p-2 hover:bg-gray-100 cursor-pointer reservation-client-result" data-client='${JSON.stringify(
            c
          )}'>${escapeHTML(c.name)}</div>`
      )
      .join('');
    resultsContainer.classList.remove('hidden');
  }

  // =================================================================================
  // INICIO DE LA MODIFICACIÓN: Mostrar detalles en los resultados de búsqueda
  // =================================================================================
  if (reservationForm.stockSearchTerm) {
    const resultsContainer = document.getElementById('reservation-stock-search-results');
    const filteredStock = stock.filter(
      (item) =>
        item.status !== 'reservado' &&
        item.model.toLowerCase().includes(reservationForm.stockSearchTerm.toLowerCase())
    );
    resultsContainer.innerHTML = filteredStock
      .map(
        (item) => `
        <div class="p-3 hover:bg-gray-100 cursor-pointer reservation-stock-result" data-stock='${JSON.stringify(
          item
        )}'>
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-semibold">${escapeHTML(item.model)}</p>
                    <p class="text-xs text-gray-500">${escapeHTML(item.serialNumber)}</p>
                </div>
                <p class="text-sm font-bold text-green-600">${formatCurrency(
                  item.suggestedSalePrice,
                  'USD'
                )}</p>
            </div>
        </div>
      `
      )
      .join('');
    resultsContainer.classList.remove('hidden');
  }
  // =================================================================================
  // FIN DE LA MODIFICACIÓN
  // =================================================================================
}

/**
 * Abre el modal para añadir un nuevo vendedor.
 */
export function openAddSalespersonModal() {
  const content = `
        <form id="salesperson-form-modal" class="space-y-4">
            <div><label class="block text-sm">Nombre</label><input type="text" id="salesperson-name-modal" class="form-input w-full" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="salesperson-contact-modal" class="form-input w-full"></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="salesperson-form-modal" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, 'Añadir Nuevo Vendedor', footer);
}

/**
 * Abre el modal para editar un vendedor existente.
 * @param {object} salesperson El objeto del vendedor a editar.
 */
export function openEditSalespersonModal(salesperson) {
  const content = `
        <form id="edit-salesperson-form-modal" class="space-y-4" data-id="${salesperson.id}">
            <div><label class="block text-sm">Nombre</label><input type="text" id="edit-salesperson-name-modal" class="form-input w-full" value="${escapeHTML(
              salesperson.name
            )}" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="edit-salesperson-contact-modal" class="form-input w-full" value="${escapeHTML(
              salesperson.contact || ''
            )}"></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-salesperson-form-modal" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, 'Editar Vendedor', footer);
}

/**
 * Muestra un modal con los detalles completos de una venta.
 * @param {object} sale El objeto de la venta.
 */
export function showSaleDetailModal(sale) {
  if (!sale) return;
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  const itemsCost = (sale.items || []).reduce((sum, item) => sum + (item.phoneCost || 0), 0);
  const grossProfit = (sale.total || 0) - itemsCost;
  const netProfit = grossProfit - (sale.commissionUSD || 0);

  let warrantyHtml = `<p class="font-semibold text-gray-500">No especificada</p>`;
  if (sale.saleDate && sale.warrantyDays) {
    const saleDate = new Date(sale.saleDate + 'T12:00:00Z');
    const expirationDate = new Date(
      new Date(saleDate).setDate(saleDate.getDate() + sale.warrantyDays)
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));

    warrantyHtml =
      diffDays >= 0
        ? `<p class="font-bold text-green-600">${diffDays} días restantes</p>`
        : `<p class="font-bold text-red-600">Vencida hace ${Math.abs(diffDays)} días</p>`;
  }

  const commissionHtml =
    sale.commissionUSD > 0
      ? `<div class="flex justify-between text-red-600"><span>Comisión Vendedor (${escapeHTML(
          sale.salespersonName
        )}):</span> <span>-${formatCurrency(sale.commissionUSD, 'USD')}</span></div>`
      : '';

  const modalHTML = `
        <div id="sale-detail-modal-backdrop" class="modal-backdrop">
            <div class="modal-content max-w-2xl max-h-[85vh] flex flex-col p-0">
                <header class="p-4 border-b sticky top-0 bg-white z-10 flex justify-between items-center">
                    <h3 class="text-xl font-bold text-gray-800">Detalle de Venta</h3>
                    <button class="close-modal-btn text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </header>
                <div class="p-6 space-y-5 overflow-y-auto bg-gray-50">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-white p-3 rounded-lg border">
                            <p class="text-sm text-gray-500">Cliente</p>
                            <p class="font-bold text-lg text-gray-900">${escapeHTML(
                              sale.customerName
                            )}</p>
                        </div>
                        <div class="bg-white p-3 rounded-lg border">
                            <p class="text-sm text-gray-500">Fecha de Venta</p>
                            <p class="font-semibold text-gray-900">${
                              sale.soldAt ? sale.soldAt.toDate().toLocaleString('es-AR') : 'N/A'
                            }</p>
                        </div>
                    </div>

                    <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg text-center">
                        <p class="text-sm text-blue-800 font-semibold">Garantía</p>
                        ${warrantyHtml}
                    </div>
                    
                    <div>
                        <h4 class="font-bold text-lg mb-2 text-gray-700">Productos Vendidos</h4>
                        <div class="space-y-2">
                            ${(sale.items || [])
                              .map((item, index) => {
                                const attributesHTML =
                                  item.attributes && Object.keys(item.attributes).length > 0
                                    ? Object.entries(item.attributes)
                                        .map(
                                          ([key, value]) =>
                                            `<div class="flex justify-between py-1"><span class="text-gray-600">${escapeHTML(
                                              key
                                            )}:</span><span class="font-semibold">${escapeHTML(
                                              String(value)
                                            )}</span></div>`
                                        )
                                        .join('')
                                    : '';
                                return `
                                <div class="bg-white border rounded-md overflow-hidden">
                                    <div class="sold-item-toggle flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50">
                                        <span class="font-medium text-gray-800">- ${
                                          item.model
                                        } <span class="text-gray-500 text-sm">(${
                                  item.serialNumber
                                })</span></span>
                                        <div class="flex items-center gap-4">
                                            <span class="font-mono font-semibold">${formatCurrency(
                                              item.salePrice,
                                              'USD'
                                            )}</span>
                                            <i class="fas fa-chevron-down text-gray-400 transition-transform"></i>
                                        </div>
                                    </div>
                                    <div class="sold-item-details hidden p-4 border-t bg-gray-50 text-sm space-y-2">
                                        ${
                                          attributesHTML
                                            ? `<div><h5 class="font-semibold mb-1">Atributos:</h5><div class="space-y-1">${attributesHTML}</div></div>`
                                            : ''
                                        }
                                        <div><h5 class="font-semibold">Detalles Adicionales:</h5><p class="text-gray-600">${escapeHTML(
                                          item.details || 'Sin detalles.'
                                        )}</p></div>
                                    </div>
                                </div>`;
                              })
                              .join('')}
                        </div>
                    </div>

                    <div>
                        <h4 class="font-bold text-lg mb-2 text-gray-700">Resumen Financiero</h4>
                        <div class="space-y-2 bg-white p-4 rounded-lg border">
                            <div class="flex justify-between"><span>Subtotal:</span> <span>${formatCurrency(
                              sale.subtotal,
                              'USD'
                            )}</span></div>
                            <div class="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span>TOTAL VENTA:</span> <span>${formatCurrency(
                              sale.total,
                              'USD'
                            )}</span></div>
                        </div>
                        <div class="space-y-2 bg-green-50 p-4 rounded-lg mt-3 border border-green-200">
                            <div class="flex justify-between"><span>Costo de Venta:</span> <span>-${formatCurrency(
                              itemsCost,
                              'USD'
                            )}</span></div>
                            ${commissionHtml}
                            <div class="flex justify-between text-xl font-extrabold border-t-2 border-green-300 pt-2 mt-2">
                                 <span>GANANCIA NETA:</span>
                                 <span class="${
                                   netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                                 }">${formatCurrency(netProfit, 'USD')}</span>
                             </div>
                        </div>
                    </div>

                    <div>
                        <h4 class="font-bold text-lg mb-2 text-gray-700">Detalles Adicionales</h4>
                        <div class="space-y-3 bg-white p-4 rounded-lg border">
                            <p><strong>Pagos (USD):</strong> ${Object.entries(
                              sale.paymentBreakdownUSD || {}
                            )
                              .map(
                                ([key, val]) =>
                                  `${key.replace('_in_usd', '').toUpperCase()}: ${formatCurrency(
                                    val,
                                    'USD'
                                  )}`
                              )
                              .join(' | ')}</p>
                            ${
                              sale.tradeInValueUSD
                                ? `<div class="bg-blue-100 p-2 rounded-md mt-2 border border-blue-200"><p><strong>Canje:</strong> ${escapeHTML(
                                    sale.tradeIn.model
                                  )} por ${formatCurrency(sale.tradeInValueUSD, 'USD')}</p></div>`
                                : ''
                            }
                            <p class="mt-2"><strong>Notas:</strong> ${escapeHTML(
                              sale.notes || 'Sin notas'
                            )}</p>
                        </div>
                    </div>
                </div>
                <footer class="p-3 border-t bg-gray-100 sticky bottom-0 flex justify-end">
                        <button class="btn-primary close-modal-btn px-6 py-2">Cerrar</button>
                </footer>
            </div>
        </div>
    `;
  modalContainer.innerHTML = modalHTML;

  const modalBackdrop = modalContainer.querySelector('#sale-detail-modal-backdrop');
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target.id === 'sale-detail-modal-backdrop' || e.target.closest('.close-modal-btn')) {
      modalContainer.innerHTML = '';
    }

    const itemToggle = e.target.closest('.sold-item-toggle');
    if (itemToggle) {
      const details = itemToggle.nextElementSibling;
      const icon = itemToggle.querySelector('.fa-chevron-down');
      details.classList.toggle('hidden');
      icon.classList.toggle('rotate-180');
    }
  });
}
