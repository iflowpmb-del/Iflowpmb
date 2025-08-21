// =================================================================================
// ARCHIVO ORQUESTADOR DE UI
// =================================================================================

// --- Importaciones de Módulos de UI ---
import { renderCapitalSection } from './ui/capital.ui.js';
import { 
    renderSalesSection, 
    renderSalesHistory, 
    renderReservationsSection, 
    renderSalespeopleSection,
    updateSaleBalance
} from './ui/ventas.ui.js';
import { 
    renderInventorySections, 
    renderAddStockForm
} from './ui/inventario.ui.js';
import { 
    renderClientsSections
} from './ui/clientes.ui.js';
import { 
    renderOperationsSections
} from './ui/operaciones.ui.js';
import { 
    renderReportsSections,
    renderIntelligentAnalysisSection
} from './ui/reportes.ui.js';
import { 
    renderPublicProvidersSection, 
    renderUserProvidersSection
} from './ui/proveedores.ui.js';

// --- Importaciones de Estado y Configuración ---
import { setState, appState } from './state.js';
import { formatCurrency } from './ui/utils.js'; // Importamos formatCurrency para usarlo en el header.

// =================================================================================
// SECCIÓN 1: RENDERIZADO PRINCIPAL
// =================================================================================

/**
 * Muestra u oculta el overlay de carga global basado en el estado.
 * @param {object} state El estado actual de la aplicación.
 */
function renderGlobalLoading(state) {
    const { isGlobalLoading } = state;
    document.body.classList.toggle('is-loading', isGlobalLoading);
}

/**
 * Renderiza el shell principal de la aplicación y orquesta el renderizado de todas las secciones.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderApp(state) {
  renderGlobalLoading(state);

  const { user, profile, isDataLoading } = state;
  if (!user || !profile) return;

  const mainContentWrapper = document.getElementById('main-content-wrapper');
  const loadingContainer = document.getElementById('loading-container');
  const header = document.querySelector('header');
  const nav = document.querySelector('.tabs-container');

  if (isDataLoading) {
    if (loadingContainer) loadingContainer.classList.remove('hidden');
    if (mainContentWrapper) mainContentWrapper.classList.add('hidden');
    return;
  } else {
    if (loadingContainer) loadingContainer.classList.add('hidden');
    if (mainContentWrapper) mainContentWrapper.classList.remove('hidden');
  }

  if (!mainContentWrapper || !header || !nav) return;

  const userIdDisplay = document.getElementById('user-id-display');
  if (userIdDisplay) userIdDisplay.textContent = user.uid;

  header.style.display = 'flex';
  nav.style.display = 'block';

  const sectionsAreMissing = !document.getElementById('section-capital');
  if (sectionsAreMissing) {
    mainContentWrapper.innerHTML = getAppSectionsHTML();
  }

  renderAllSections(state);
  renderHeader(state);
}

/**
 * Renderiza el encabezado de la aplicación, incluyendo el nuevo widget del dólar.
 * @param {object} state El estado actual de la aplicación.
 */
function renderHeader(state) {
  const { user, profile, exchangeRate } = state;

  // Renderizado del nombre del negocio
  const businessNameDisplay = document.getElementById('business-name-display');
  if (businessNameDisplay && profile) {
    businessNameDisplay.textContent = profile.businessName || 'Mi Negocio';
  }

  // Renderizado del email del usuario
  const userEmailDisplay = document.getElementById('user-email-display');
  if (userEmailDisplay && user) {
    userEmailDisplay.textContent = user.email;
  }

  // --- Lógica para renderizar el widget del dólar ---
  const marketRateEl = document.getElementById('dolar-widget-market-rate');
  const marketBuyRateEl = document.getElementById('dolar-widget-market-buy-rate');
  const offsetInputEl = document.getElementById('dolar-widget-offset-input');
  const effectiveRateEl = document.getElementById('dolar-widget-effective-rate');
  const statusEl = document.getElementById('dolar-widget-status');

  if (marketRateEl && offsetInputEl && effectiveRateEl && statusEl && profile) {
    // Mostrar la tasa de mercado (Venta)
    marketRateEl.textContent = profile.marketRate ? formatCurrency(profile.marketRate, 'ARS') : '$ --';
    
    // Mostrar la tasa de mercado (Compra)
    marketBuyRateEl.textContent = profile.marketBuyRate ? formatCurrency(profile.marketBuyRate, 'ARS') : '$ --';

    // Rellenar el input de ajuste con el valor guardado del usuario
    if (offsetInputEl.value !== (profile.dolarOffset || 0).toString()) {
        offsetInputEl.value = profile.dolarOffset || 0;
    }

    // Mostrar la tasa final que usará la aplicación
    effectiveRateEl.textContent = formatCurrency(exchangeRate || 0, 'ARS');

    // Actualizar el estado visual del widget
    if (profile.marketRate) {
        statusEl.innerHTML = `
            <i class="fas fa-circle text-green-500"></i>
            <span>Actualizado</span>
        `;
    } else {
         statusEl.innerHTML = `
            <i class="fas fa-circle text-red-500"></i>
            <span>Error API</span>
        `;
    }
  }
}


/**
 * Llama a las funciones de renderizado para cada sección de la aplicación.
 * @param {object} state El estado actual de la aplicación.
 */
function renderAllSections(state) {
  const { isInitialRender, isDataLoading, ui } = state;

  // Llama a las funciones importadas de los módulos especializados
  renderCapitalSection(state);
  renderSalesSection(state);
  renderSalesHistory(state);
  renderReservationsSection(state);
  renderSalespeopleSection(state);
  renderInventorySections(state);
  renderClientsSections(state);
  renderOperationsSections(state);
  renderReportsSections(state); 
  renderIntelligentAnalysisSection(state);
  renderPublicProvidersSection(state);
  renderUserProvidersSection(state);

  updateSaleBalance(state);

  if (isInitialRender && !isDataLoading) {
    setState({ isInitialRender: false });
    switchTab('capital');
  }

  if (ui.activeOperacionesDebtsTab) {
    switchDebtView('operaciones-deudas', ui.activeOperacionesDebtsTab);
  }
  if (ui.activeClientesDebtsTab) {
    switchDebtView('clientes-deudas', ui.activeClientesDebtsTab);
  }
}

// =================================================================================
// SECCIÓN 2: ESTRUCTURA HTML INTERNA
// =================================================================================

/**
 * Devuelve el HTML base para todas las secciones de la aplicación.
 * @returns {string} El HTML de las secciones.
 */
function getAppSectionsHTML() {
  return `
    <div id="section-capital" class="main-section">
        <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="capital" data-sub-tab="principal">Principal</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="capital" data-sub-tab="historial">Historial</button>
        </div>
        <div id="capital-sub-principal" class="capital-sub-section">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="card p-6"><p class="text-lg text-gray-500">Capital Total</p><h3 id="capital-total" class="text-4xl font-bold"></h3></div>
                <div class="card p-6"><p class="text-lg text-gray-500">Capital Líquido</p><h3 id="capital-liquid" class="text-4xl font-bold text-teal-600"></h3></div>
                <div class="card p-6"><p class="text-lg text-gray-500">Valor en Stock</p><h3 id="capital-stock-value" class="text-4xl font-bold text-blue-600"></h3></div>
            </div>
            <div class="card p-6 md:p-8 mb-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold">Fondos y Deudas</h3>
                    <button id="adjust-capital-btn" class="btn-secondary py-2 px-4 flex items-center"><i class="fas fa-edit mr-2"></i>Ajustar</button>
                </div>
                <div id="wallets-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"></div>
                <div class="border-t my-6"></div>
                <div id="debts-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-6"></div>
                <div class="border-t my-6"></div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h4 class="text-xl font-semibold mb-4">Detalle Deudas de Clientes</h4>
                        <div id="client-debts-list" class="space-y-3 mt-4"></div>
                    </div>
                    <div>
                        <h4 class="text-xl font-semibold mb-4">Detalle Deudas a Proveedores</h4>
                        <div id="our-debts-list" class="space-y-3 mt-4"></div>
                    </div>
                </div>
            </div>
        </div>
        <div id="capital-sub-historial" class="capital-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h3 class="text-2xl font-bold text-gray-800">Historial de Capital</h3>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="capital" data-period="today">Hoy</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="capital" data-period="week">Semana</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="capital" data-period="month">Mes</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="capital" data-period="year">Año</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="capital" data-period="custom"><i class="fas fa-calendar-alt"></i></button>
                    </div>
                </div>
                <div id="capital-custom-date-range-controls" class="hidden flex flex-col md:flex-row gap-4 items-end mb-6 bg-gray-50 p-4 rounded-lg">
                    <div><label for="capital-custom-start-date" class="block text-sm">Desde</label><input type="date" id="capital-custom-start-date" class="form-input"></div>
                    <div><label for="capital-custom-end-date" class="block text-sm">Hasta</label><input type="date" id="capital-custom-end-date" class="form-input"></div>
                    <button id="capital-apply-custom-filter-btn" class="btn-primary py-2 px-4">Aplicar</button>
                </div>
                
                <div class="mb-8">
                    <h3 class="text-xl font-semibold mb-4">Evolución del Capital</h3>
                    <div class="bg-white p-4 rounded-lg border shadow-inner">
                        <canvas id="capital-evolution-chart"></canvas>
                    </div>
                </div>

                <div>
                    <h3 class="text-xl font-semibold mb-6">Detalle de Movimientos</h3>
                    <div id="capital-history-list-container" data-list-key="capitalHistory"></div>
                    <div id="no-capital-history-message" class="text-center py-16 text-gray-500 hidden">
                        <i class="fas fa-history fa-3x mb-4"></i>
                        <p>Aún no hay movimientos registrados para el período seleccionado.</p>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <div id="section-ventas" class="hidden main-section">
        <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="ventas" data-sub-tab="nueva">Nueva Venta</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="ventas" data-sub-tab="historial">Historial</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="ventas" data-sub-tab="reservas">Reservas</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="ventas" data-sub-tab="vendedores">Vendedores</button>
        </div>
        <div id="ventas-sub-nueva" class="ventas-sub-section hidden">
            <div class="card p-6 md:p-8">
                <form id="sale-form" class="space-y-6">
                    <div class="space-y-4 p-4 border-b">
                        <h3 class="text-xl font-semibold">1. Cliente</h3>
                        <div class="relative">
                            <label class="block text-sm">Buscar Cliente</label>
                            <div class="flex items-center">
                                <input type="text" id="client-search-input-sale" class="form-input w-full p-3" placeholder="Escribe para buscar...">
                                <button type="button" id="add-client-from-sale-btn" class="ml-2 btn-secondary p-3"><i class="fas fa-plus"></i></button>
                            </div>
                            <div id="client-search-results" class="absolute z-20 w-full bg-white border rounded-md mt-1 hidden max-h-60 overflow-y-auto"></div>
                            <div id="selected-client-display" class="mt-2"></div>
                        </div>
                    </div>
                    <div class="space-y-4 p-4 border-b">
                        <h3 class="text-xl font-semibold">2. Productos</h3>
                        <div class="relative">
                            <label class="block text-sm">Buscar Producto en Stock</label>
                            <div class="flex items-center">
                                <input type="text" id="stock-search-input-sale" class="form-input w-full p-3" placeholder="Escribe nombre o N/S para buscar...">
                            </div>
                            <div id="stock-search-results-sale" class="absolute z-10 w-full bg-white border rounded-md mt-1 hidden max-h-60 overflow-y-auto"></div>
                        </div>
                        <div id="sale-items-list" class="mt-4 space-y-2"></div>
                    </div>
                    <div class="space-y-4 p-4 border-b">
                        <h3 class="text-xl font-semibold">3. Pago</h3>
                        <div class="flex items-center"><input id="has-trade-in" type="checkbox" class="h-4 w-4"><label for="has-trade-in" class="ml-3">Recibir equipo en parte de pago</label></div>
                        <div id="trade-in-details" class="hidden my-4 space-y-4 border-l-4 pl-4 py-2"></div>
                        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <div><label class="text-sm">Efectivo (ARS)</label><input type="number" data-payment="ars" class="payment-input form-input w-full p-2 mt-1" value="0"><p id="ars-usd-display" class="text-xs text-gray-500 h-4 mt-1"></p></div>
                            <div><label class="text-sm">Digital (ARS)</label><input type="number" data-payment="mp" class="payment-input form-input w-full p-2 mt-1" value="0"><p id="mp-usd-display" class="text-xs text-gray-500 h-4 mt-1"></p></div>
                            <div><label class="text-sm">Dólares (USD)</label><input type="number" data-payment="usd" class="payment-input form-input w-full p-2 mt-1" value="0"></div>
                            <div><label class="text-sm">USDT</label><input type="number" data-payment="usdt" class="payment-input form-input w-full p-2 mt-1" value="0"></div>
                            <div><label class="text-sm">Deuda Cliente (USD)</label><input type="number" data-payment="clientDebt" class="payment-input form-input w-full p-2 mt-1" value="0"></div>
                        </div>
                    </div>
                    <div class="space-y-4 p-4 border-b">
                        <h3 class="text-xl font-semibold">4. Vendedor y Comisión</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label for="salesperson-selector" class="block text-sm">Asignar Vendedor (Opcional)</label>
                                <select id="salesperson-selector" class="form-select w-full p-3 mt-1">
                                    <option value="">Ninguno</option>
                                </select>
                            </div>
                            <div id="commission-container" class="hidden">
                                <label for="commission-amount" class="block text-sm">Comisión Vendedor (USD)</label>
                                <input type="number" id="commission-amount" class="form-input w-full p-3 mt-1" value="0">
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4 p-4">
                        <h3 class="text-xl font-semibold">5. Cierre y Resumen</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label class="block text-sm">Fecha de Venta</label><input type="date" id="sale-date" class="form-input w-full p-3" required></div>
                            <div><label class="block text-sm">Garantía (días)</label><input type="number" id="warranty-days" class="form-input w-full p-3" value="30" required></div>
                        </div>
                        <div><label class="block text-sm">Notas</label><textarea id="notes" rows="2" class="form-textarea w-full p-3"></textarea></div>
                        <div id="sale-summary" class="mt-4 p-4 rounded-lg bg-gray-100 space-y-2"></div>
                    </div>
                    <div><button type="submit" class="w-full btn-primary py-3 text-lg">Finalizar Venta</button></div>
                </form>
            </div>
        </div>
        <div id="ventas-sub-historial" class="ventas-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="relative mb-6">
                    <input type="text" id="sales-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar por cliente, nombre, N/S...">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                </div>
                <div id="sales-list-container" data-list-key="sales"></div>
                <div id="no-sales-message" class="text-center py-16 text-gray-500 hidden"><i class="fas fa-folder-open fa-3x mb-4"></i><p>Aún no has registrado ventas.</p></div>
            </div>
        </div>
        <div id="ventas-sub-reservas" class="ventas-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold">Gestión de Reservas</h3>
                    <button id="add-reservation-btn" class="btn-primary py-2 px-4 flex items-center"><i class="fas fa-calendar-plus mr-2"></i>Nueva Reserva</button>
                </div>
                <div class="relative mb-4">
                    <input type="text" id="reservations-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar por cliente o producto...">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                </div>
                <div id="reservations-list-container" class="space-y-4 mt-6" data-list-key="reservations"></div>
                <div id="no-reservations-message" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-calendar-times fa-3x mb-4"></i><p>No hay reservas activas.</p></div>
            </div>
        </div>
        <div id="ventas-sub-vendedores" class="ventas-sub-section hidden">
            <div id="salespeople-list-view">
                <div class="card p-6 md:p-8">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-semibold">Gestión de Vendedores</h3>
                        <button id="add-salesperson-btn" class="btn-primary py-2 px-4 flex items-center"><i class="fas fa-user-plus mr-2"></i>Nuevo Vendedor</button>
                    </div>
                    <div class="relative mb-4">
                        <input type="text" id="salespeople-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar vendedor...">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    </div>
                    <div id="salespeople-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6" data-list-key="salespeople"></div>
                    <div id="no-salespeople-message" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-users-slash fa-3x mb-4"></i><p>No hay vendedores registrados.</p></div>
                </div>
            </div>
            <div id="salesperson-detail-view" class="hidden"></div>
        </div>
    </div>

    <div id="section-inventario" class="hidden main-section">
        <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="inventario" data-sub-tab="stock">Stock</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="inventario" data-sub-tab="registrar">Registrar Producto</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="inventario" data-sub-tab="categorias">Categorías</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="inventario" data-sub-tab="proveedores">Mis Proveedores</button>
        </div>
        <div id="inventario-sub-stock" class="inventario-sub-section hidden">
            <div class="card p-6 md:p-8">
                <h3 class="text-2xl font-semibold mb-6">Inventario Actual</h3>
                <div class="relative mb-6">
                    <input type="text" id="stock-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar por nombre, N/S, categoría...">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                </div>
                <div id="stock-list-container-consultas" class="space-y-8"></div>
                <div id="no-stock-message-consultas" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-box-open fa-3x mb-4"></i><p>No hay productos en stock.</p></div>
            </div>
        </div>
        <div id="inventario-sub-registrar" class="inventario-sub-section hidden">
             <div class="card p-6 md:p-8">
                <div id="product-search-container" class="mb-8 p-6 bg-gray-50 border rounded-lg">
                    <h3 class="text-xl font-semibold text-gray-800 mb-2">Buscador Rápido</h3>
                    <p class="text-sm text-gray-500 mb-4">Escribí acá para encontrar un producto y autocompletar el formulario.</p>
                    <div class="relative">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="product-search-reg" class="form-input w-full pl-10 p-3" placeholder="Ej: iPhone 15, AirTag, etc...">
                        <div id="product-search-results-reg" class="absolute z-20 w-full bg-white border rounded-md mt-1 max-h-60 overflow-y-auto hidden"></div>
                    </div>
                </div>
                <h3 class="text-2xl font-semibold mb-6">Registrar Nuevo Producto en Stock</h3>
                <form id="stock-form-register" class="space-y-4 bg-gray-50 p-6 rounded-lg border"></form>
            </div>
        </div>
        <div id="inventario-sub-categorias" class="inventario-sub-section hidden">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div class="lg:col-span-1 card p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold">Categorías</h3>
                        <button id="add-new-category-btn" class="btn-secondary py-1 px-3 text-sm"><i class="fas fa-plus"></i> Añadir</button>
                    </div>
                    <div id="category-manager-list" class="space-y-2"></div>
                </div>
                <div id="category-attributes-manager" class="lg:col-span-2 card p-6 hidden">
                    <div id="category-attributes-content"></div>
                </div>
                 <div id="category-manager-placeholder" class="lg:col-span-2 flex items-center justify-center text-center text-gray-400 bg-gray-50 rounded-lg h-64">
                    <div>
                        <i class="fas fa-arrow-left fa-2x mb-4"></i>
                        <p>Selecciona una categoría para ver o editar sus atributos.</p>
                    </div>
                </div>
            </div>
        </div>
        <div id="inventario-sub-proveedores" class="inventario-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold">Mis Proveedores</h3>
                    <button id="add-provider-btn" class="btn-primary py-2 px-4 flex items-center"><i class="fas fa-truck mr-2"></i>Nuevo Proveedor</button>
                </div>
                <div class="relative mb-4">
                    <input type="text" id="user-providers-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar proveedor...">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                </div>
                <div id="user-providers-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6" data-list-key="userProviders"></div>
                <div id="no-user-providers-message" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-truck-loading fa-3x mb-4"></i><p>No has registrado proveedores.</p></div>
            </div>
        </div>
    </div>

    <div id="section-clientes" class="hidden main-section">
        <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="clientes" data-sub-tab="lista">Lista de Clientes</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="clientes" data-sub-tab="deudas">Deudas de Clientes</button>
        </div>
        <div id="clientes-sub-lista" class="clientes-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold">Gestión de Clientes</h3>
                    <button id="toggle-client-form-btn" class="btn-primary py-2 px-4 flex items-center"><i class="fas fa-user-plus mr-2"></i>Nuevo Cliente</button>
                </div>
                <div id="add-client-form-container" class="hidden mb-8">
                    <form id="client-form-register" class="space-y-4 bg-gray-50 p-6 rounded-lg border">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label class="block text-sm">Nombre Completo</label><input type="text" id="client-name-reg" class="form-input w-full" required></div>
                            <div><label class="block text-sm">Teléfono</label><input type="text" id="client-phone-reg" class="form-input w-full"></div>
                        </div>
                        <div><label class="block text-sm">Detalles</label><textarea id="client-details-reg" class="form-textarea w-full"></textarea></div>
                        <button type="submit" class="btn-primary py-2 px-6">Añadir Cliente</button>
                    </form>
                </div>
                <div class="relative"><input type="text" id="client-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar cliente..."><i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i></div>
                <div id="clients-list-consultas" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6"></div>
                <div id="no-clients-message-consultas" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-users-slash fa-3x mb-4"></i><p>No hay clientes registrados.</p></div>
            </div>
        </div>
        <div id="clientes-sub-deudas" class="clientes-sub-section hidden">
            <div class="card p-6 md:p-8">
                <h3 class="text-2xl font-semibold mb-6">Control de Deudas de Clientes</h3>
                <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
                    <button class="debt-view-btn btn-secondary py-2 px-4" data-hub="clientes-deudas" data-view="pendientes">Pendientes</button>
                    <button class="debt-view-btn btn-secondary py-2 px-4" data-hub="clientes-deudas" data-view="historial">Historial</button>
                </div>
                <div id="client-debts-pendientes-view">
                    <div id="client-debts-section-container" class="space-y-4" data-list-key="clientDebts"></div>
                    <div id="no-client-debts-message" class="text-center py-16 text-gray-500 hidden">
                        <i class="fas fa-check-circle fa-3x mb-4 text-green-500"></i>
                        <p>¡Excelente! No hay deudas de clientes pendientes.</p>
                    </div>
                </div>
                <div id="client-debts-historial-view" class="hidden">
                    <div id="client-debts-history-container" class="space-y-4"></div>
                    <div id="no-client-debts-history-message" class="text-center py-16 text-gray-500 hidden">
                        <i class="fas fa-history fa-3x mb-4"></i>
                        <p>No hay un historial de deudas de clientes todavía.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="section-operaciones" class="hidden main-section">
        <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="operaciones" data-sub-tab="gastos">Gastos</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="operaciones" data-sub-tab="deudas">Deudas</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="operaciones" data-sub-tab="notas">Notas</button>
        </div>
        <div id="operaciones-sub-gastos" class="operaciones-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold">Gestión de Gastos</h3>
                    <button class="toggle-section-btn text-gray-400 hover:text-gray-600 p-2" data-section="gastos"><i class="fas fa-chevron-up"></i></button>
                </div>
                <div id="collapsible-content-gastos" class="space-y-8">
                    <div class="p-6 border rounded-lg">
                        <h3 class="text-xl font-semibold text-gray-800 mb-4">Añadir Gastos</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <form id="fixed-expense-form-register" class="space-y-3 p-4 border rounded-lg">
                                <p class="font-medium">Gasto Fijo Mensual</p>
                                <div><label for="fixed-expense-description-reg" class="block text-sm">Descripción</label><input type="text" id="fixed-expense-description-reg" class="form-input w-full p-2 mt-1" required></div>
                                <div>
                                    <label class="block text-sm">Monto</label>
                                    <div class="flex items-center gap-2">
                                        <input type="number" id="fixed-expense-amount-reg" data-form-type="fixed-expense-reg" class="currency-input form-input w-full p-2" required>
                                        <select id="fixed-expense-currency-reg" data-form-type="fixed-expense-reg" class="currency-select form-select p-2">
                                            <option value="USD">USD</option>
                                            <option value="ARS">ARS</option>
                                        </select>
                                    </div>
                                    <p id="fixed-expense-reg-conversion" class="text-xs text-gray-500 h-4 mt-1"></p>
                                </div>
                                <div><label for="fixed-expense-day-reg" class="block text-sm">Día de Pago (1-31)</label><input type="number" id="fixed-expense-day-reg" class="form-input w-full p-2 mt-1" required min="1" max="31"></div>
                                <button type="submit" class="w-full btn-primary py-2">Añadir Gasto Fijo</button>
                            </form>
                            <form id="daily-expense-form-register" class="space-y-3 p-4 border rounded-lg">
                                <p class="font-medium">Gasto Diario/Variable</p>
                                <div><label for="daily-expense-description-reg" class="block text-sm">Descripción</label><input type="text" id="daily-expense-description-reg" class="form-input w-full p-2 mt-1" required></div>
                                <div>
                                    <label class="block text-sm">Monto</label>
                                    <div class="flex items-center gap-2">
                                        <input type="number" id="daily-expense-amount-reg" data-form-type="daily-expense-reg" class="currency-input form-input w-full p-2" required>
                                        <select id="daily-expense-currency-reg" data-form-type="daily-expense-reg" class="currency-select form-select p-2">
                                            <option value="USD">USD</option>
                                            <option value="ARS">ARS</option>
                                        </select>
                                    </div>
                                    <p id="daily-expense-reg-conversion" class="text-xs text-gray-500 h-4 mt-1"></p>
                                </div>
                                <div><label for="daily-expense-date-reg" class="block text-sm">Fecha</label><input type="date" id="daily-expense-date-reg" class="form-input w-full p-2 mt-1" required></div>
                                <button type="submit" class="w-full btn-primary py-2">Añadir y Pagar Gasto</button>
                            </form>
                        </div>
                    </div>
                    <div class="p-6 border rounded-lg">
                        <h3 class="text-xl font-semibold text-gray-800 mb-4">Gastos Fijos Pendientes</h3>
                        <div id="fixed-expenses-list-consultas" class="space-y-3"></div>
                    </div>
                    <div class="p-6 border rounded-lg">
                        <h3 class="text-xl font-semibold text-gray-800 mb-4">Historial de Pagos</h3>
                        <div class="relative mb-4">
                            <input type="text" id="expenses-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar por descripción...">
                            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        </div>
                        <div id="payment-history-list" class="space-y-3 max-h-[500px] overflow-y-auto" data-list-key="dailyExpenses"></div>
                    </div>
                </div>
            </div>
        </div>
        <div id="operaciones-sub-deudas" class="operaciones-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold">Gestión de Deudas (Proveedores)</h3>
                    <button class="toggle-section-btn text-gray-400 hover:text-gray-600 p-2" data-section="deudas"><i class="fas fa-chevron-up"></i></button>
                </div>
                <div id="collapsible-content-deudas">
                    <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
                        <button class="debt-view-btn btn-secondary py-2 px-4" data-hub="operaciones-deudas" data-view="pendientes">Pendientes</button>
                        <button class="debt-view-btn btn-secondary py-2 px-4" data-hub="operaciones-deudas" data-view="historial">Historial</button>
                    </div>
                    <div id="provider-debts-pendientes-view">
                        <button id="toggle-debt-form-btn" class="btn-primary py-2 px-4 flex items-center mb-6"><i class="fas fa-plus mr-2"></i>Nueva Deuda</button>
                        <div id="add-debt-form-container" class="hidden mb-8">
                            <form id="debt-form" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-start bg-gray-50 p-6 rounded-lg border">
                                <div>
                                    <label for="debtor-name" class="block text-sm font-medium text-gray-700">Nombre del Acreedor</label>
                                    <input type="text" id="debtor-name" class="mt-1 form-input w-full p-2" required>
                                </div>
                                <div>
                                    <label for="debt-desc" class="block text-sm font-medium text-gray-700">Descripción</label>
                                    <input type="text" id="debt-desc" class="mt-1 form-input w-full p-2" required>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Monto</label>
                                    <div class="flex items-center gap-2">
                                        <input type="number" id="debt-amount" data-form-type="debt-create" class="currency-input mt-1 form-input w-full p-2" required>
                                        <select id="debt-currency" data-form-type="debt-create" class="currency-select mt-1 form-select p-2">
                                            <option value="USD">USD</option>
                                            <option value="ARS">ARS</option>
                                        </select>
                                    </div>
                                    <p id="debt-create-conversion" class="text-xs text-gray-500 h-4 mt-1"></p>
                                </div>
                                <div class="sm:col-span-2 md:col-span-3">
                                    <button type="submit" class="btn-primary w-full py-2">Añadir Deuda</button>
                                </div>
                            </form>
                        </div>
                        <div id="debts-list-consultas" class="space-y-4" data-list-key="providerDebts"></div>
                         <div id="no-provider-debts-message" class="text-center py-16 text-gray-500 hidden">
                            <i class="fas fa-file-invoice-dollar fa-3x mb-4"></i>
                            <p>No tienes deudas con proveedores registradas.</p>
                        </div>
                    </div>
                    <div id="provider-debts-historial-view" class="hidden">
                        <div id="provider-debts-history-container" class="space-y-4"></div>
                        <div id="no-provider-debts-history-message" class="text-center py-16 text-gray-500 hidden">
                            <i class="fas fa-history fa-3x mb-4"></i>
                            <p>No hay un historial de deudas con proveedores todavía.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id="operaciones-sub-notas" class="operaciones-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <h3 class="text-2xl font-semibold">Block de Notas</h3>
                    <div class="w-full md:w-auto flex-grow md:flex-grow-0 relative">
                         <input type="text" id="notes-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar por título o contenido...">
                         <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    </div>
                    <button id="add-note-btn" class="btn-primary py-2 px-4 flex items-center flex-shrink-0"><i class="fas fa-plus mr-2"></i>Nueva Nota</button>
                </div>
                <div id="notes-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-list-key="notes">
                </div>
                <div id="no-notes-message" class="text-center py-16 text-gray-500 hidden">
                    <i class="fas fa-sticky-note fa-3x mb-4"></i>
                    <p>Aún no has creado ninguna nota.</p>
                </div>
            </div>
        </div>
    </div>

    <div id="section-reportes" class="hidden main-section">
        <div class="mb-6 flex justify-center gap-2 md:gap-4 flex-wrap">
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="reportes" data-sub-tab="dashboard">Dashboard</button>
            <button class="sub-tab-btn btn-secondary py-2 px-4" data-hub="reportes" data-sub-tab="analisis">Análisis</button>
        </div>
        <div id="reportes-sub-dashboard" class="reportes-sub-section hidden">
            <div class="space-y-8">
                <div class="card p-6 md:p-8">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h3 class="text-2xl font-bold text-gray-800">Resumen Financiero</h3>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="dashboard" data-period="today">Hoy</button>
                            <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="dashboard" data-period="week">Semana</button>
                            <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="dashboard" data-period="month">Mes</button>
                            <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="dashboard" data-period="year">Año</button>
                            <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="dashboard" data-period="custom"><i class="fas fa-calendar-alt"></i></button>
                        </div>
                    </div>
                    <div id="dashboard-custom-date-range-controls" class="hidden flex flex-col md:flex-row gap-4 items-end mb-6 bg-gray-50 p-4 rounded-lg">
                        <div><label for="dashboard-custom-start-date" class="block text-sm">Desde</label><input type="date" id="dashboard-custom-start-date" class="form-input"></div>
                        <div><label for="dashboard-custom-end-date" class="block text-sm">Hasta</label><input type="date" id="dashboard-custom-end-date" class="form-input"></div>
                        <button id="dashboard-apply-custom-filter-btn" class="btn-primary py-2 px-4">Aplicar</button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                        <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Ventas</p><p id="summary-sales" class="text-2xl font-bold"></p></div>
                        <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Ganancia Bruta</p><p id="summary-gross-profit" class="text-2xl font-bold"></p></div>
                        <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Gastos</p><p id="summary-expenses" class="text-2xl font-bold"></p></div>
                        <div class="bg-gray-50 p-4 rounded-lg"><p class="text-sm text-gray-500">Ganancia Neta</p><p id="summary-net-profit" class="text-2xl font-bold"></p></div>
                    </div>
                </div>
                <div class="card p-6 md:p-8"><h3 class="text-xl font-semibold mb-4">Rendimiento (Ingresos vs Gastos)</h3><canvas id="performance-chart"></canvas></div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="card p-6 md:p-8"><h3 class="text-xl font-semibold mb-4">Desglose de Gastos</h3><div id="expense-chart-container" class="h-64"><canvas id="expense-breakdown-chart"></canvas></div><div id="expense-breakdown-summary" class="mt-4"></div></div>
                    <div class="card p-6 md:p-8"><h3 class="text-xl font-semibold mb-4">Ganancia Neta por Categoría</h3><canvas id="net-profit-category-chart"></canvas></div>
                </div>
                <div class="card p-6 md:p-8"><h3 class="text-xl font-semibold mb-4">Métricas de Venta</h3><canvas id="sales-metrics-chart"></canvas></div>
            </div>
        </div>
        
        <div id="reportes-sub-analisis" class="reportes-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h3 class="text-2xl font-bold text-gray-800">Análisis Inteligente</h3>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="analysis" data-period="today">Hoy</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="analysis" data-period="week">Semana</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="analysis" data-period="month">Mes</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="analysis" data-period="year">Año</button>
                        <button class="filter-btn btn-secondary py-1 px-3 text-sm" data-hub="analysis" data-period="custom"><i class="fas fa-calendar-alt"></i></button>
                    </div>
                </div>
                <div id="analysis-custom-date-range-controls" class="hidden flex flex-col md:flex-row gap-4 items-end mb-6 bg-gray-50 p-4 rounded-lg">
                    <div><label for="analysis-custom-start-date" class="block text-sm">Desde</label><input type="date" id="analysis-custom-start-date" class="form-input"></div>
                    <div><label for="analysis-custom-end-date" class="block text-sm">Hasta</label><input type="date" id="analysis-custom-end-date" class="form-input"></div>
                    <button id="analysis-apply-custom-filter-btn" class="btn-primary py-2 px-4">Aplicar</button>
                </div>
                
                <div id="intelligent-analysis-form" class="space-y-4 bg-gray-50 p-4 rounded-lg border">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label for="analysis-area-selector" class="block text-sm font-medium text-gray-700">1. Área de Análisis</label>
                            <select id="analysis-area-selector" class="form-select w-full mt-1"></select>
                        </div>
                        <div>
                            <label for="analysis-groupby-selector" class="block text-sm font-medium text-gray-700">2. Agrupar por</label>
                            <select id="analysis-groupby-selector" class="form-select w-full mt-1"></select>
                        </div>
                        <div>
                            <label for="analysis-metric-selector" class="block text-sm font-medium text-gray-700">3. Ver Métrica</label>
                            <select id="analysis-metric-selector" class="form-select w-full mt-1"></select>
                        </div>
                    </div>
                    <div id="analysis-specific-filters-container" class="pt-4 border-t">
                        <!-- Filtros adicionales aparecerán aquí -->
                    </div>
                </div>

                <div id="analysis-results-container" class="mt-6">
                    <!-- Los resultados del análisis se mostrarán aquí -->
                </div>
            </div>
        </div>
    </div>

    <div id="section-providers" class="hidden main-section">
        <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h2 class="text-3xl font-bold text-gray-800">Proveedores Recomendados</h2>
                <p class="text-gray-500">Listas de precios y contacto directo de proveedores verificados.</p>
            </div>
            <div class="relative w-full md:w-auto">
                <input type="text" id="public-providers-search-input" class="form-input w-full md:w-72 p-3 pl-10" placeholder="Buscar proveedor...">
                <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>
        </div>
        <div id="public-providers-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        </div>
        <div id="no-public-providers-message" class="text-center py-16 text-gray-500 hidden">
            <i class="fas fa-store-slash fa-3x mb-4"></i>
            <p>Aún no hay proveedores disponibles.</p>
        </div>
    </div>
    `;
}

// =================================================================================
// SECCIÓN 3: FUNCIONES DE NAVEGACIÓN
// =================================================================================

/**
 * Cambia la pestaña principal visible.
 * @param {string} activeKey La clave de la sección a activar.
 */
export function switchTab(activeKey) {
  document
    .querySelectorAll('.main-tab-btn')
    .forEach((btn) => btn.classList.toggle('tab-active', btn.dataset.section === activeKey));
  document
    .querySelectorAll('.main-section')
    .forEach((section) =>
      section.classList.toggle('hidden', !section.id.startsWith(`section-${activeKey}`))
    );
  // Activa la sub-pestaña por defecto para cada sección principal
  if (activeKey === 'capital') switchSubTab('capital', 'principal');
  if (activeKey === 'ventas') switchSubTab('ventas', 'nueva');
  if (activeKey === 'inventario') switchSubTab('inventario', 'stock');
  if (activeKey === 'operaciones') switchSubTab('operaciones', 'gastos');
  if (activeKey === 'reportes') switchSubTab('reportes', 'dashboard');
  if (activeKey === 'clientes') switchSubTab('clientes', 'lista');
}

/**
 * Cambia la sub-pestaña visible dentro de una sección principal.
 * @param {string} hubKey La clave de la sección principal.
 * @param {string} activeKey La clave de la sub-sección a activar.
 */
export function switchSubTab(hubKey, activeKey) {
  document
    .querySelectorAll(`[data-hub="${hubKey}"]`)
    .forEach((btn) => btn.classList.toggle('sub-tab-btn-active', btn.dataset.subTab === activeKey));
  document
    .querySelectorAll(`.${hubKey}-sub-section`)
    .forEach((section) =>
      section.classList.toggle('hidden', section.id !== `${hubKey}-sub-${activeKey}`)
    );
}

/**
 * Cambia la vista entre 'pendientes' e 'historial' dentro de una sección de deudas.
 * @param {string} hubKey La clave del hub de deudas ('clientes-deudas' u 'operaciones-deudas').
 * @param {string} activeView La vista a activar ('pendientes' o 'historial').
 */
export function switchDebtView(hubKey, activeView) {
    // Actualiza el estilo de los botones
    document.querySelectorAll(`.debt-view-btn[data-hub="${hubKey}"]`).forEach(btn => {
        btn.classList.toggle('sub-tab-btn-active', btn.dataset.view === activeView);
    });

    // Muestra u oculta los contenedores de contenido
    if (hubKey === 'clientes-deudas') {
        document.getElementById('client-debts-pendientes-view')?.classList.toggle('hidden', activeView !== 'pendientes');
        document.getElementById('client-debts-historial-view')?.classList.toggle('hidden', activeView !== 'historial');
    } else if (hubKey === 'operaciones-deudas') {
        document.getElementById('provider-debts-pendientes-view')?.classList.toggle('hidden', activeView !== 'pendientes');
        document.getElementById('provider-debts-historial-view')?.classList.toggle('hidden', activeView !== 'historial');
    }
}
