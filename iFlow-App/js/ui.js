import { charts, WALLET_CONFIG, setState, appState } from './state.js';
import { setData } from './api.js';
import { Timestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// =================================================================================
// SECCIÓN 0: LÓGICA Y VISTAS DE SUSCRIPCIÓN (SIN CAMBIOS)
// =================================================================================

// =================================================================================
// SECCIÓN 1: RENDERIZADO PRINCIPAL
// =================================================================================

let exchangeRate;

async function getDolarBlueRate() {
  try {
    const response = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Number(data.venta);
  } catch (error) {
    console.error('Error al obtener la cotización del dólar blue:', error);
    return null;
  }
}

(async () => {
  const rate = await getDolarBlueRate();
  if (rate) {
    exchangeRate = rate;
    console.log('Tasa de cambio Dólar Blue obtenida:', rate);
    setState({ exchangeRate: rate });
  } else {
    const fallbackRate = 1000;
    exchangeRate = fallbackRate;
    console.warn(
      `No se pudo obtener la tasa de Dólar Blue. Usando valor por defecto: ${fallbackRate}`
    );
    setState({ exchangeRate: fallbackRate });
  }
})();

export function renderApp(state) {
  const { user, profile, isDataLoading } = state;
  if (!user || !profile) return;

  const mainContentWrapper = document.getElementById('main-content-wrapper');
  const loadingContainer = document.getElementById('loading-container');
  const header = document.querySelector('header');
  const nav = document.querySelector('.tabs-container');

  // FIX: Se cambió el selector para que coincida con el div contenedor.
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

  const existingBanner = document.getElementById('trial-banner-container');
  if (existingBanner) existingBanner.remove();

  renderAllSections(state);
  renderHeader(state);
}

function renderHeader(state) {
  const { user, profile } = state;

  const businessNameDisplay = document.getElementById('business-name-display');
  if (businessNameDisplay && profile) {
    businessNameDisplay.textContent = profile.businessName || 'Mi Negocio';
  }

  const userEmailDisplay = document.getElementById('user-email-display');
  if (userEmailDisplay && user) {
    userEmailDisplay.textContent = user.email;
  }

  const exchangeRateInput = document.getElementById('exchange-rate-input');
  if (exchangeRateInput && state.exchangeRate) {
    exchangeRateInput.value = state.exchangeRate;
    exchangeRateInput.readOnly = true;
  }
}

function renderAllSections(state) {
  const { isInitialRender, isDataLoading } = state;

  renderCapitalSection(state);
  renderSalesSection(state);
  renderSalesHistory(state);
  renderReservationsSection(state);
  // ADDED: Llamada a la función de renderizado de reservas
  renderSalespeopleSection(state);
  // ADDED: Llamada a la función de renderizado de vendedores
  renderInventorySections(state);
  renderClientsSection(state);
  renderOperationsSections(state);
  renderReportsSections(state);
  renderPublicProvidersSection(state);
  // FIX: Renombrada para claridad

  updateSaleBalance(state);

  if (isInitialRender && !isDataLoading) {
    setState({ isInitialRender: false });
    switchTab('capital');
  }
}

function renderInventorySections(state) {
  renderStockSection(state);
  renderAddStockForm(state);
  renderCategoryManagerSection(state);
  renderUserProvidersSection(state); // ADDED: Llamada a la función de renderizado de proveedores del usuario
}

function renderOperationsSections(state) {
  renderExpensesSection(state);
  renderDebtsList(state);
  renderNotesSection(state);
  renderCollapsibleSections(state);
}

function renderReportsSections(state) {
  renderDashboardSection(state);
  renderSalesAnalysis(state);
}

// =================================================================================
// SECCIÓN 2: ESTRUCTURA HTML INTERNA
// =================================================================================

function getAppSectionsHTML() {
  // FIX: Se reestructura el HTML para acomodar las nuevas secciones y corregir la jerarquía de pestañas.
  return `
    <div id="section-capital" class="main-section">
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
                    <div class="space-y-4 p-4">
                        <h3 class="text-xl font-semibold">4. Cierre y Resumen</h3>

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
                <div id="sales-list-container"></div>

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
                <div id="reservations-list-container" class="space-y-4 mt-6"></div>
                <div id="no-reservations-message" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-calendar-times fa-3x mb-4"></i><p>No hay reservas activas.</p></div>

            </div>
        </div>

        <div id="ventas-sub-vendedores" class="ventas-sub-section hidden">
            <div class="card p-6 md:p-8">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold">Gestión de Vendedores</h3>

                    <button id="add-salesperson-btn" class="btn-primary py-2 px-4 flex items-center"><i class="fas fa-user-plus mr-2"></i>Nuevo Vendedor</button>
                </div>
                <div class="relative mb-4">
                    <input type="text" id="salespeople-search-input" class="form-input w-full p-3 pl-10" placeholder="Buscar vendedor...">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>

                </div>
                <div id="salespeople-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6"></div>
                <div id="no-salespeople-message" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-users-slash fa-3x mb-4"></i><p>No hay vendedores registrados.</p></div>
            </div>

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
                <div id="user-providers-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6"></div>
                <div id="no-user-providers-message" class="text-center py-8 text-gray-500 hidden"><i class="fas fa-truck-loading fa-3x mb-4"></i><p>No has registrado proveedores.</p></div>
            </div>
        </div>

    </div>

    <div id="section-clientes" class="hidden main-section">
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
                        <div id="payment-history-list" class="space-y-3 max-h-[500px] overflow-y-auto"></div>
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
                    <div id="debts-list-consultas" class="space-y-3"></div>
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
                <div id="notes-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div class="card p-6 md:p-8"><h3 class="text-xl font-semibold mb-4">Crecimiento del Capital</h3><canvas id="capital-growth-chart"></canvas></div>

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

                    <h3 class="text-2xl font-bold text-gray-800">Centro de Análisis</h3>
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
                <div class="flex flex-col md:flex-row gap-4 mb-6">
                    <select id="analysis-selector" class="form-select w-full md:w-1/3">

                        <option value="sales">Análisis de Ventas</option>
                        <option value="stock">Análisis de Stock</option>
                        <option value="clients">Análisis de Clientes</option>
                    </select>

                </div>
                <div id="analysis-results-container" class="mt-6">
                    <p class="text-center text-gray-500">Selecciona una opción para ver el análisis detallado.</p>
                </div>
            </div>

        </div>
    </div>

    <div id="section-public-providers" class="hidden main-section">
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
// SECCIÓN 3: FUNCIONES DE RENDERIZADO DE COMPONENTES
// =================================================================================

function formatDateTime(timestamp) {
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

function renderNotesSection(state) {
  if (!state.notes) return;

  const container = document.getElementById('notes-list-container');
  const noNotesMessage = document.getElementById('no-notes-message');
  const searchInput = document.getElementById('notes-search-input');
  if (!container || !noNotesMessage || !searchInput) return;

  if (searchInput.value !== state.notesSearchTerm) {
    searchInput.value = state.notesSearchTerm;
  }

  const searchTerm = (state.notesSearchTerm || '').toLowerCase();
  const filteredNotes = state.notes.filter(
    (note) =>
      (note.title || '').toLowerCase().includes(searchTerm) ||
      (note.content || '').toLowerCase().includes(searchTerm)
  );

  noNotesMessage.classList.toggle('hidden', state.notes.length > 0);
  container.classList.toggle('hidden', filteredNotes.length === 0 && searchTerm);

  if (filteredNotes.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8 col-span-full">No se encontraron notas para "${escapeHTML(
        searchTerm
      )}".</p>`;
    } else {
      container.innerHTML = '';
    }
    return;
  }

  container.innerHTML = filteredNotes
    .map(
      (note) => `
        <div class="card p-5 flex flex-col justify-between bg-yellow-50 border-yellow-200">
            <div>
                <h4 class="font-bold text-lg text-gray-800 mb-2">${escapeHTML(note.title)}</h4>
                <p class="text-gray-700 text-sm whitespace-pre-wrap">${escapeHTML(note.content)}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-yellow-200 text-xs text-gray-500">

                <div class="flex justify-between items-center">
                    <div>
                        <p>Creado: ${formatDateTime(note.createdAt)}</p>
                        <p>Editado: ${formatDateTime(note.updatedAt)}</p>

                    </div>
                    <div class="flex gap-2">
                        <button class="edit-note-btn text-blue-600 hover:text-blue-800" data-note-id="${
                          note.id
                        }"><i class="fas fa-edit fa-lg"></i></button>

                        <button class="delete-note-btn text-red-600 hover:text-red-800" data-note-id="${
                          note.id
                        }"><i class="fas fa-trash fa-lg"></i></button>

                    </div>
                </div>
            </div>
        </div>
    `
    )
    .join('');
}

function renderCollapsibleSections(state) {
  if (!state.ui || !state.ui.collapsedSections) return;

  const { collapsedSections } = state.ui;
  for (const sectionName in collapsedSections) {
    const isCollapsed = collapsedSections[sectionName];
    const content = document.getElementById(`collapsible-content-${sectionName}`);
    const button = document.querySelector(`.toggle-section-btn[data-section="${sectionName}"]`);

    if (content && button) {
      content.classList.toggle('hidden', isCollapsed);
      const icon = button.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-chevron-up', !isCollapsed);
        icon.classList.toggle('fa-chevron-down', isCollapsed);
      }
    }
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return null;
  }
  const now = new Date();
  const date = timestamp.toDate();
  const seconds = Math.floor((now - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return `hace ${Math.floor(interval)} años`;
  interval = seconds / 2592000;
  if (interval > 1) return `hace ${Math.floor(interval)} meses`;
  interval = seconds / 86400;
  if (interval > 1) return `hace ${Math.floor(interval)} días`;
  interval = seconds / 3600;
  if (interval > 1) return `hace ${Math.floor(interval)} horas`;
  interval = seconds / 60;
  if (interval > 1) return `hace ${Math.floor(interval)} minutos`;
  return 'hace unos segundos';
}

function renderPublicProvidersSection(state) {
  // FIX: Renombrada de renderProvidersSection a renderPublicProvidersSection para evitar conflictos.
  // FIX: Actualizados los IDs de los elementos para que sean únicos.
  if (!state.providers) return;

  const container = document.getElementById('public-providers-list-container');
  const noProvidersMessage = document.getElementById('no-public-providers-message');
  const searchInput = document.getElementById('public-providers-search-input');

  if (!container || !noProvidersMessage || !searchInput) return;

  if (searchInput.value !== state.providersSearchTerm) {
    searchInput.value = state.providersSearchTerm;
  }

  const searchTerm = (state.providersSearchTerm || '').toLowerCase();
  const filteredProviders = state.providers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm) ||
      (p.tagline && p.tagline.toLowerCase().includes(searchTerm))
  );

  noProvidersMessage.classList.toggle('hidden', state.providers.length > 0);
  container.innerHTML = '';

  if (filteredProviders.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8 col-span-full">No se encontraron proveedores para "${escapeHTML(
        searchTerm
      )}".</p>`;
    }
    return;
  }

  filteredProviders.forEach((provider) => {
    const providerCard = document.createElement('div');
    providerCard.className = 'card flex flex-col';

    const whatsappLink = `https://wa.me/${provider.whatsapp.replace(/\D/g, '')}`;
    const instagramLink = `https://instagram.com/${provider.instagram.replace('@', '')}`;

    const verifiedBadge = provider.isVerified
      ? `<i class="fas fa-check-circle text-blue-500 ml-2" title="Proveedor Verificado"></i>`
      : '';

    const lastUpdated = formatTimeAgo(provider.lastUpdatedAt);

    const priceList = provider.priceList || [];
    let priceListHtml = '';

    if (priceList.length > 0) {
      const groupedByCategory = priceList.reduce((acc, item) => {
        const category = item.category || 'General';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(item);
        return acc;
      }, {});

      const sortedCategories = Object.keys(groupedByCategory).sort();

      priceListHtml = sortedCategories
        .map(
          (category) => `
                <div class="mb-4 price-list-category">
                    <h5 class="font-semibold text-md text-gray-700 bg-gray-100 p-2 rounded-t-md sticky top-0">${escapeHTML(
                      category
                    )}</h5>

                    <table class="min-w-full text-sm">
                        <tbody>
                            ${groupedByCategory[category]

                              .map(
                                (item) => `
                                <tr class="border-b price-list-item">
                                    <td class="p-2 item-name">${escapeHTML(item.name)}</td>

                                    <td class="p-2 text-right font-mono">${formatCurrency(
                                      item.price,
                                      'USD'
                                    )}</td>

                                </tr>

                            `
                              )
                              .join('')}
                        </tbody>

                    </table>
                </div>
            `
        )
        .join('');
    } else {
      priceListHtml = '<p class="text-center text-gray-400 py-4">No hay productos en la lista.</p>';
    }

    providerCard.innerHTML = `
            <div class="p-6">
                <div class="flex items-start mb-4">
                    <img src="${
                      provider.logoUrl || 'https://placehold.co/64x64/e2e8f0/64748b?text=Logo'
                    }" alt="Logo de ${escapeHTML(
      provider.name
    )}" class="w-16 h-16 rounded-full mr-4 border">

                    <div class="flex-1">
                        <div class="flex items-center">
                            <h3 class="text-2xl font-bold text-gray-800">${escapeHTML(
                              provider.name
                            )}</h3>

                            ${verifiedBadge}
                        </div>

                        <p class="text-gray-500">${escapeHTML(provider.tagline || '')}</p>
                    </div>
                </div>
                <div class="flex justify-center gap-4 my-4">
                    <a href="${whatsappLink}" target="_blank" class="btn-primary flex-1 text-center py-2 px-4 flex items-center justify-center gap-2"><i class="fab fa-whatsapp"></i> WhatsApp</a>

                    <a href="${instagramLink}" target="_blank" class="btn-secondary flex-1 text-center py-2 px-4 flex items-center justify-center gap-2">
                        <i class="fab fa-instagram"></i>
                        <span>@${escapeHTML(provider.instagram)}</span>

                    </a>
                </div>
            </div>
            <div class="flex-grow p-6 border-t bg-gray-50 rounded-b-xl">
                <div class="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4">
                    <div class="flex items-center">

                        <h4 class="font-semibold text-lg">Lista de Precios</h4>
                        ${
                          lastUpdated
                            ? `<span class="text-xs text-gray-400 ml-2" title="${provider.lastUpdatedAt
                                ?.toDate()
                                .toLocaleString()}">Actualizado ${lastUpdated}</span>`
                            : ''
                        }

                    </div>
                    <div class="relative w-full sm:w-auto">
                        <input type="text" class="form-input w-full sm:w-48 p-2 pl-8 text-sm provider-price-list-search" placeholder="Buscar en lista..." data-provider-id="${
                          provider.id
                        }">

                        <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    </div>

                </div>
                <div class="overflow-y-auto max-h-80 pr-2 price-list-container">
                    ${priceListHtml}
                </div>
            </div>
        `;
    container.appendChild(providerCard);
  });
}

function renderSalesHistory(state) {
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
        return sum + (s.total - itemsCost);
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

                        <p class="text-sm text-gray-600">Ganancia Día: <span class="font-semibold ${
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

function renderSaleCard(sale) {
  const profit = (sale.items || []).reduce((sum, i) => sum + (i.salePrice - (i.phoneCost || 0)), 0);

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

                </div>
                <div class="text-right flex-shrink-0 ml-4">
                    <p class="text-xl font-bold">${formatCurrency(sale.total, 'USD')}</p>

                    <p class="text-sm ${
                      profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }">Ganancia: ${formatCurrency(profit, 'USD')}</p>
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

function renderCapitalSection(state) {
  const { stock, capital, debts, exchangeRate } = state;
  if (!stock || !capital || !debts || !exchangeRate) return;

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

  const liquidCapitalEl = document.getElementById('capital-liquid');
  if (liquidCapitalEl) {
    liquidCapitalEl.textContent = formatCurrency(liquidCapitalUSD, 'USD');
  }

  const capitalTotalEl = document.getElementById('capital-total');
  if (capitalTotalEl) capitalTotalEl.textContent = formatCurrency(totalCapital, 'USD');

  const stockValueEl = document.getElementById('capital-stock-value');
  if (stockValueEl) stockValueEl.textContent = formatCurrency(stockValueUSD, 'USD');

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

  renderClientDebtsList(state);
  renderOurDebtsList(state);
}

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
      const settledAmount = payments.debtSettled || 0;
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
function renderDebtsList(state) {
  const debtsListEl = document.getElementById('debts-list-consultas');
  if (!debtsListEl || !state.debts) return;
  debtsListEl.innerHTML =
    state.debts.length === 0
      ? `<p class="text-gray-500 text-center py-4">No hay deudas registradas.</p>`
      : state.debts
          .map(
            (debt) =>
              `<div class="bg-white p-3 rounded-lg flex justify-between items-center border shadow-sm"><div><p class="font-semibold">${escapeHTML(
                debt.debtorName
              )}</p><p class="text-xs text-gray-500">${escapeHTML(
                debt.description
              )}</p></div><div class="flex items-center gap-4"><p class="font-bold text-red-500">${formatCurrency(
                debt.amount,
                'USD'
              )}</p><button class="edit-debt-btn text-gray-400 hover:text-blue-500" data-debt='${JSON.stringify(
                debt
              )}'><i class="fas fa-edit"></i></button><button class="delete-debt-btn text-gray-400 hover:text-red-500" data-id="${
                debt.id
              }"><i class="fas fa-trash"></i></button></div></div>`
          )
          .join('');
}
function getFixedExpenseStatus(expense) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const currentMonthID = `${currentYear}-${currentMonth}`;
  const paymentDay = expense.paymentDay || 1;
  if (expense.lastPaidMonth === currentMonthID) {
    return { text: 'Pagado este mes', color: 'text-green-500', isPayable: false };
  }
  const dueDate = new Date(currentYear, now.getMonth(), paymentDay);
  const timeDiff = dueDate.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  if (daysDiff >= 0) {
    return { text: `Faltan ${daysDiff} días`, color: 'text-yellow-600', isPayable: true };
  } else {
    return {
      text: `Vencido hace ${Math.abs(daysDiff)} días`,
      color: 'text-red-500',
      isPayable: true,
    };
  }
}
function renderExpensesSection(state) {
  if (!state.fixedExpenses || !state.dailyExpenses) return;
  const { fixedExpenses, dailyExpenses, expensesSearchTerm } = state;

  const searchInput = document.getElementById('expenses-search-input');
  if (searchInput && searchInput.value !== expensesSearchTerm) {
    searchInput.value = expensesSearchTerm;
  }
  const fixedList = document.getElementById('fixed-expenses-list-consultas');
  if (fixedList) {
    if (fixedExpenses.length > 0) {
      fixedList.innerHTML = fixedExpenses
        .map((exp) => {
          const status = getFixedExpenseStatus(exp);
          return `
                    <div class="bg-white p-3 rounded-lg flex justify-between items-center border shadow-sm">
                        <div>

                            <p class="font-semibold">${escapeHTML(exp.description)}</p>
                            <p class="text-sm font-bold">${formatCurrency(exp.amount, 'USD')}</p>
                            <p class="text-xs ${status.color} mt-1">${status.text}</p>

                        </div>
                        <div class="flex items-center gap-2">
                            ${
                              status.isPayable
                                ? `<button class="btn-primary px-3 py-1 text-sm pay-fixed-expense-btn" data-id="${exp.id}">Pagar</button>`
                                : ''
                            }

                            <button class="edit-fixed-expense-btn p-2 text-gray-400 hover:text-blue-500" data-expense='${JSON.stringify(
                              exp
                            )}'><i class="fas fa-edit"></i></button>

                            <button class="delete-fixed-expense-btn p-2 text-gray-400 hover:text-red-500" data-id="${
                              exp.id
                            }"><i class="fas fa-trash"></i></button>
                        </div>

                    </div>
                `;
        })
        .join('');
    } else {
      fixedList.innerHTML = `<p class="text-gray-500 text-center py-4">No has añadido gastos fijos.</p>`;
    }
  }
  const historyList = document.getElementById('payment-history-list');
  if (historyList) {
    const searchTerm = (expensesSearchTerm || '').toLowerCase();
    const filteredExpenses = dailyExpenses.filter(
      (exp) => !searchTerm || (exp.description || '').toLowerCase().includes(searchTerm)
    );
    if (filteredExpenses.length > 0) {
      const fixedPayments = filteredExpenses.filter((e) => e.isFixedPayment);
      const otherPayments = filteredExpenses.filter((e) => !e.isFixedPayment);
      let historyHTML = '';
      if (otherPayments.length > 0) {
        historyHTML += `<h4 class="text-md font-semibold text-gray-600 mt-4 mb-2">Gastos Diarios</h4>`;
        historyHTML += otherPayments.map((exp) => renderPaymentHistoryItem(exp)).join('');
      }
      if (fixedPayments.length > 0) {
        historyHTML += `<h4 class="text-md font-semibold text-gray-600 mt-4 mb-2">Pagos de Gastos Fijos</h4>`;
        historyHTML += fixedPayments.map((exp) => renderPaymentHistoryItem(exp)).join('');
      }
      historyList.innerHTML = historyHTML;
    } else {
      if (searchTerm) {
        historyList.innerHTML = `<p class="text-center text-gray-500 py-4">No se encontraron gastos para "${escapeHTML(
          expensesSearchTerm
        )}".</p>`;
      } else {
        historyList.innerHTML = `<p class="text-center text-gray-500 text-center py-4">No hay pagos registrados.</p>`;
      }
    }
  }
}
function renderPaymentHistoryItem(expense) {
  const walletInfo = WALLET_CONFIG[expense.paidFrom] || {};
  const walletIcon = walletInfo.icon || 'fa-solid fa-question-circle';
  return `
        <div class="bg-white p-3 rounded-lg flex justify-between items-center border shadow-sm">
            <div>
                <p>${escapeHTML(expense.description)}</p>
                <div class="text-xs text-gray-500 flex items-center mt-1">
                    <i class="${walletIcon} mr-2"></i>
                    <span>${formatDate(expense.date)}</span>

                </div>
            </div>
            <div class="flex items-center gap-4">
                <p class="font-semibold">${formatCurrency(expense.amount, 'USD')}</p>
                <button class="delete-daily-expense-btn p-2 text-gray-400 hover:text-red-500" data-id="${
                  expense.id
                }"><i class="fas fa-trash"></i></button>

            </div>
        </div>
    `;
}

export function renderAddStockForm(state) {
  const { categories } = state;
  const form = document.getElementById('stock-form-register');

  if (!form) return;
  const allCategories = categories || [];
  const selectedCategoryName =
    form.querySelector('#stock-category-reg')?.value || allCategories[0]?.name || '';
  const selectedCategory = allCategories.find((c) => c.name === selectedCategoryName);

  let formHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm">Categoría</label>
                <select id="stock-category-reg" class="form-select w-full" required>
                    ${allCategories
                      .map(
                        (cat) =>
                          `<option value="${escapeHTML(cat.name)}" ${
                            cat.name === selectedCategoryName ? 'selected' : ''
                          }>${escapeHTML(cat.name)}</option>`
                      )
                      .join('')}
                </select>
            </div>

            <div>
                <label class="block text-sm">Nombre Identificador</label>
                <input type="text" id="stock-model-reg" class="form-input w-full" placeholder="Ej: iPhone de Juan, MacBook Pro M3 Max" required>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label class="block text-sm">N/S</label><input type="text" id="stock-serial-reg" class="form-input w-full" required></div>

            <div><label class="block text-sm">Cantidad</label><input type="number" id="stock-quantity-reg" class="form-input w-full" value="1" min="1" required></div>
        </div>
        <div class="border-t my-4"></div>
        <div id="dynamic-attributes-container" class="space-y-4">
            ${
              selectedCategory?.attributes
                ?.map((attr) => generateAttributeInputHTML(attr))
                .join('') || ''
            }

        </div>
        <div class="border-t my-4"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label class="block text-sm">Costo (USD)</label><input type="number" id="stock-cost-reg" class="form-input w-full" required></div>
            <div><label class="block text-sm">P. Venta Sugerido (USD)</label><input type="number" id="stock-price-reg" class="form-input w-full"></div>

        </div>
        <div><label class="block text-sm">Detalles Adicionales</label><textarea id="stock-details-reg" class="form-textarea w-full"></textarea></div>
        <button type="submit" class="btn-primary py-2 px-6">Añadir a Stock</button>
    `;
  form.innerHTML = formHTML;
}

function generateAttributeInputHTML(attribute, value = '') {
  const { id, name, type, options, unit, required } = attribute;
  const inputId = `attr_${id}`;
  let inputHTML = '';

  const label = `<label for="${inputId}" class="block text-sm">${escapeHTML(name)} ${
    unit ? `(${unit})` : ''
  }</label>`;

  const requiredAttr = required ? 'required' : '';

  switch (type) {
    case 'text':
      inputHTML = `<input type="text" id="${inputId}" data-attr-name="${escapeHTML(
        name
      )}" class="form-input w-full" value="${escapeHTML(value)}" ${requiredAttr}>`;
      break;
    case 'number':
      inputHTML = `<input type="number" id="${inputId}" data-attr-name="${escapeHTML(
        name
      )}" class="form-input w-full" value="${escapeHTML(value)}" ${requiredAttr}>`;
      break;
    case 'select':
      const optionsHTML = options
        .map(
          (opt) =>
            `<option value="${escapeHTML(opt)}" ${opt === value ? 'selected' : ''}>${escapeHTML(
              opt
            )}</option>`
        )
        .join('');
      inputHTML = `<select id="${inputId}" data-attr-name="${escapeHTML(
        name
      )}" class="form-select w-full" ${requiredAttr}>${optionsHTML}</select>`;
      break;
    case 'checkbox':
      const checked = value ? 'checked' : '';
      inputHTML = `<div class="flex items-center h-full mt-2"><input type="checkbox" id="${inputId}" data-attr-name="${escapeHTML(
        name
      )}" class="form-checkbox h-5 w-5" ${checked}></div>`;
      return `<div class="flex items-center gap-x-3"><div>${label}</div>${inputHTML}</div>`;
  }

  return `<div>${label}${inputHTML}</div>`;
}

function renderStockSection(state) {
  if (!state.stock) return;
  const stockListContainer = document.getElementById('stock-list-container-consultas');
  const noStockMessage = document.getElementById('no-stock-message-consultas');
  const searchInput = document.getElementById('stock-search-input');
  if (!stockListContainer || !noStockMessage || !searchInput) return;

  if (searchInput.value !== state.stockSearchTerm) {
    searchInput.value = state.stockSearchTerm;
  }
  const searchTerm = (state.stockSearchTerm || '').toLowerCase();
  const filteredStock = state.stock.filter((item) => {
    return (
      (item.model || '').toLowerCase().includes(searchTerm) ||
      (item.serialNumber || '').toLowerCase().includes(searchTerm) ||
      (item.category || '').toLowerCase().includes(searchTerm)
    );
  });
  const groupedStock = filteredStock.reduce((acc, item) => {
    const category = item.category || 'Sin Categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedStock).sort();
  noStockMessage.classList.toggle('hidden', state.stock.length > 0);
  if (filteredStock.length === 0 && searchTerm) {
    stockListContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron productos para "${escapeHTML(
      state.stockSearchTerm
    )}".</p>`;

    return;
  }
  if (sortedCategories.length > 0) {
    stockListContainer.innerHTML = sortedCategories
      .map(
        (category) => `
            <div class="category-group">
                <h4 class="text-xl font-bold text-gray-700 mb-3 pb-2 border-b">${escapeHTML(
                  category
                )}</h4>
                <div class="overflow-x-auto">

                    <table class="min-w-full text-left">
                        <thead class="border-b border-gray-200">
                            <tr class="text-gray-500 text-sm">
                                <th class="p-2">Nombre Identificador</th>

                                <th class="p-2">N/S</th>
                                <th class="p-2 text-center">Qty.</th>
                                <th class="p-2">Atributos</th>

                                <th class="p-2 text-right">Costo</th>
                                <th class="p-2 text-right">P. Sugerido</th>
                                <th class="p-2"></th>

                            </tr>
                        </thead>
                        <tbody>

                            ${groupedStock[category]
                              .map((item) => {
                                const attributesPreview =
                                  item.attributes && Object.keys(item.attributes).length > 0
                                    ? Object.entries(item.attributes)

                                        .slice(0, 2)
                                        .map(
                                          ([key, value]) =>
                                            `<strong>${escapeHTML(key)}:</strong> ${escapeHTML(
                                              value
                                            )}`
                                        )
                                        .join(', ') +
                                      (Object.keys(item.attributes).length > 2 ? '...' : '')
                                    : 'Sin atributos';

                                const isReserved = item.status === 'reservado';
                                const rowClass = isReserved
                                  ? 'opacity-50 bg-gray-100'
                                  : 'hover:bg-gray-50';

                                const reservedTag = isReserved
                                  ? '<span class="ml-2 text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-1 rounded-full">Reservado</span>'
                                  : '';

                                return `
                                <tr class="border-b border-gray-200 ${rowClass}">
                                    <td class="p-2 font-semibold">${escapeHTML(
                                      item.model
                                    )} ${reservedTag}</td>

                                    <td class="p-2 font-mono text-sm">${escapeHTML(
                                      item.serialNumber
                                    )}</td>

                                    <td class="p-2 text-center font-bold text-lg">${
                                      item.quantity || 1
                                    }</td>

                                    <td class="p-2 text-xs max-w-xs truncate" title="${escapeHTML(
                                      Object.entries(item.attributes || {})
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join('\n')
                                    )}">${attributesPreview}</td>

                                    <td class="p-2 text-right font-medium">${formatCurrency(
                                      item.phoneCost,
                                      'USD'
                                    )}</td>

                                    <td class="p-2 text-right font-medium text-green-600">${formatCurrency(
                                      item.suggestedSalePrice || 0,
                                      'USD'
                                    )}</td>

                                    <td class="p-2 text-right">
                                        <button class="edit-stock-btn text-blue-500 hover:text-blue-400 mr-2" data-id="${
                                          item.id
                                        }"><i class="fas fa-edit"></i></button>

                                        <button class="delete-stock-btn text-red-500 hover:text-red-400" data-id="${
                                          item.id
                                        }"><i class="fas fa-trash-alt"></i></button>

                                    </td>
                                </tr>`;
                              })
                              .join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `
      )
      .join('');
  } else if (state.stock.length > 0) {
    stockListContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron productos que coincidan con la búsqueda.</p>`;
  } else {
    stockListContainer.innerHTML = '';
  }
}

function renderSalesSection(state) {
  if (!state.clients || !state.stock) return;
  const { clients, stock, sale } = state;
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
}
function renderClientsSection(state) {
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
function renderDashboardSection(state) {
  if (!state.sales || !state.dailyExpenses || !state.capitalHistory) return;
  const { sales, dailyExpenses, capitalHistory, ui } = state;
  const { dashboardPeriod, dashboardCustomStartDate, dashboardCustomEndDate } = ui.dashboard;

  const activeSales = sales.filter((s) => s.status !== 'reverted');
  const customControls = document.getElementById('dashboard-custom-date-range-controls');
  if (customControls) {
    customControls.classList.toggle('hidden', dashboardPeriod !== 'custom');
  }
  document
    .querySelectorAll('.filter-btn[data-hub="dashboard"]')
    .forEach((btn) =>
      btn.classList.toggle('filter-btn-active', btn.dataset.period === dashboardPeriod)
    );

  const now = new Date();
  let startDate, endDate;
  switch (dashboardPeriod) {
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
      startDate = dashboardCustomStartDate
        ? new Date(dashboardCustomStartDate + 'T00:00:00')
        : new Date(0);

      endDate = dashboardCustomEndDate
        ? new Date(dashboardCustomEndDate + 'T23:59:59')
        : new Date();

      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
  }

  const salesInPeriod = activeSales.filter((s) => {
    let saleDate;
    if (s.soldAt && s.soldAt.toDate) {
      saleDate = s.soldAt.toDate();
    } else if (s.saleDate) {
      saleDate = new Date(s.saleDate + 'T12:00:00Z');
    } else {
      return false;
    }
    return saleDate >= startDate && saleDate <= endDate;
  });
  const dailyExpensesInPeriod = dailyExpenses.filter((e) => {
    if (!e.date) return false;
    const expenseDate = new Date(e.date + 'T12:00:00Z');
    return expenseDate >= startDate && expenseDate <= endDate;
  });
  const totalSales = salesInPeriod.reduce((sum, s) => sum + (s.total || 0), 0);
  const grossProfit = salesInPeriod.reduce((sum, s) => {
    const itemsCost = (s.items || []).reduce((itemSum, i) => itemSum + (i.phoneCost || 0), 0);
    return sum + (s.total - itemsCost);
  }, 0);
  const dailyCosts = dailyExpensesInPeriod.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalExpenses = dailyCosts;
  const netProfit = grossProfit - totalExpenses;

  const summarySalesEl = document.getElementById('summary-sales');
  if (summarySalesEl) summarySalesEl.textContent = formatCurrency(totalSales, 'USD');

  const summaryGrossEl = document.getElementById('summary-gross-profit');
  if (summaryGrossEl) summaryGrossEl.textContent = formatCurrency(grossProfit, 'USD');

  const summaryExpensesEl = document.getElementById('summary-expenses');
  if (summaryExpensesEl) summaryExpensesEl.textContent = formatCurrency(totalExpenses, 'USD');

  const netProfitEl = document.getElementById('summary-net-profit');
  if (netProfitEl) {
    netProfitEl.textContent = formatCurrency(netProfit, 'USD');
    netProfitEl.className = `text-2xl font-bold ${
      netProfit >= 0 ? 'profit-positive' : 'profit-negative'
    }`;
  }

  renderPerformanceChart(salesInPeriod, dailyExpensesInPeriod, startDate, endDate);
  const executedFixedExpenses = dailyExpensesInPeriod
    .filter((e) => e.isFixedPayment)
    .reduce((sum, e) => sum + e.amount, 0);
  const pureDailyExpenses = dailyCosts - executedFixedExpenses;
  renderExpenseBreakdownChart(0, executedFixedExpenses, pureDailyExpenses);
  renderNetProfitCategoryChart(salesInPeriod);
  renderSalesMetricsChart(salesInPeriod);
  renderCapitalGrowthChart(capitalHistory, startDate, endDate);
}

// ADDED: Nueva función para renderizar la sección de proveedores del usuario
function renderUserProvidersSection(state) {
  if (!state.userProviders) return;
  const { userProviders, userProvidersSearchTerm } = state;
  const container = document.getElementById('user-providers-list-container');
  const noMessage = document.getElementById('no-user-providers-message');
  const searchInput = document.getElementById('user-providers-search-input');
  if (!container || !noMessage || !searchInput) return;

  if (searchInput.value !== userProvidersSearchTerm) {
    searchInput.value = userProvidersSearchTerm;
  }

  const searchTerm = (userProvidersSearchTerm || '').toLowerCase();
  const filteredProviders = userProviders.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(searchTerm) ||
      (p.contact || '').toLowerCase().includes(searchTerm)
  );
  noMessage.classList.toggle('hidden', userProviders.length > 0);
  container.innerHTML = '';

  if (filteredProviders.length === 0) {
    if (searchTerm) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8 col-span-full">No se encontraron proveedores para "${escapeHTML(
        searchTerm
      )}".</p>`;
    }
    return;
  }

  container.innerHTML = filteredProviders
    .map(
      (provider) => `
        <div class="card p-4 flex flex-col justify-between">
            <div>
                <p class="font-bold text-lg">${escapeHTML(provider.name)}</p>
                <p class="text-sm text-gray-500">${escapeHTML(
                  provider.contact || 'Sin contacto'
                )}</p>

                <p class="text-xs text-gray-400 mt-2">${escapeHTML(
                  provider.notes || 'Sin notas'
                )}</p>
            </div>
            <div class="flex items-center justify-end mt-4">

                <button class="edit-provider-btn text-gray-400 hover:text-blue-500" data-provider='${JSON.stringify(
                  provider
                )}'><i class="fas fa-edit"></i></button>
                <button class="delete-provider-btn ml-2 text-gray-400 hover:text-red-500" data-id="${
                  provider.id
                }" data-name="${escapeHTML(provider.name)}"><i class="fas fa-trash"></i></button>

            </div>
        </div>
    `
    )
    .join('');
}

function renderCategoryManagerSection(state) {
  const { categories, categoryManager } = state;
  if (!categories) return;

  const listContainer = document.getElementById('category-manager-list');
  if (!listContainer) return;

  listContainer.innerHTML = categories
    .map(
      (cat) => `
        <div class="category-manager-item p-3 rounded-lg flex justify-between items-center cursor-pointer border-2 ${
          categoryManager.selectedCategoryId === cat.id
            ? 'border-green-500 bg-green-50'
            : 'border-transparent hover:bg-gray-100'
        }" data-category-id="${cat.id}">
            <span class="font-semibold">${escapeHTML(cat.name)}</span>
        </div>

    `
    )
    .join('');
  const attributesContainer = document.getElementById('category-attributes-manager');
  const placeholder = document.getElementById('category-manager-placeholder');
  if (!attributesContainer || !placeholder) return;
  const selectedCategory = categories.find((c) => c.id === categoryManager.selectedCategoryId);

  if (selectedCategory) {
    attributesContainer.classList.remove('hidden');
    placeholder.classList.add('hidden');
    renderCategoryAttributes(selectedCategory);
  } else {
    attributesContainer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

function renderCategoryAttributes(category) {
  const container = document.getElementById('category-attributes-content');
  if (!container) return;
  const { categoryManager } = appState;
  const isEditingName = categoryManager.isEditingCategoryName;

  const nameDisplay = isEditingName
    ? `<input type="text" id="edit-category-name-input" class="text-2xl font-bold form-input" value="${escapeHTML(
        category.name
      )}">`
    : `<h3 class="text-2xl font-bold">${escapeHTML(category.name)}</h3>`;
  container.innerHTML = `
        <div class="flex justify-between items-start mb-6">
            <div class="flex items-center gap-3">
                ${nameDisplay}
                ${
                  isEditingName
                    ? `<button id="save-category-name-btn" class="text-green-600 hover:text-green-800"><i class="fas fa-check-circle fa-lg"></i></button>`
                    : `<button id="edit-category-name-btn" class="text-gray-400 hover:text-gray-600"><i class="fas fa-pencil-alt"></i></button>`
                }

            </div>
            <button id="delete-category-btn" class="btn-danger py-1 px-3 text-sm"><i class="fas fa-trash"></i> Eliminar Categoría</button>
        </div>

        <h4 class="font-semibold text-lg mb-3">Atributos de la Plantilla</h4>

        <div id="attribute-list" class="space-y-3 mb-6">
            ${
              category.attributes && category.attributes.length > 0
                ? category.attributes

                    .map(
                      (attr) => `
                <div class="bg-gray-50 p-3 rounded-lg flex justify-between items-center border">
                    <div>
                        <p class="font-medium">${escapeHTML(attr.name)}</p>

                        <p class="text-xs text-gray-500">Tipo: ${attr.type} ${
                        attr.options ? `(${(attr.options || []).join(', ')})` : ''
                      }</p>
                    </div>

                    <button class="delete-attribute-btn text-red-500 hover:text-red-700" data-attr-id="${
                      attr.id
                    }"><i class="fas fa-times"></i></button>
                </div>
            `
                    )
                    .join('')
                : '<p class="text-gray-400 text-center py-4">Esta categoría no tiene atributos personalizados.</p>'
            }
        </div>

        <div class="border-t pt-6">

            <h4 class="font-semibold text-lg mb-3">Añadir Nuevo Atributo</h4>
            <form id="add-attribute-form" class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label class="block text-sm">Nombre del Atributo</label>
                    <input type="text" id="new-attribute-name" class="form-input w-full" required>

                </div>
                <div>
                    <label class="block text-sm">Tipo de Campo</label>
                    <select id="new-attribute-type" class="form-select w-full">
                        <option value="text">Texto</option>

                        <option value="number">Número</option>
                        <option value="select">Lista Desplegable</option>
                        <option value="checkbox">Checkbox (Sí/No)</option>
                    </select>

                </div>
                <div id="new-attribute-options-container" class="hidden">
                    <label class="block text-sm">Opciones (separadas por coma)</label>
                    <input type="text" id="new-attribute-options" class="form-input w-full">
                </div>

                <div class="md:col-span-3">
                    <button type="submit" class="btn-primary py-2 px-6">Añadir Atributo</button>
                </div>
            </form>
        </div>
    `;
}
export function updateSaleBalance(state) {
  const { sale, exchangeRate } = state;
  const summaryEl = document.getElementById('sale-summary');
  if (!summaryEl || !exchangeRate) return;

  const subtotal = (sale.items || []).reduce((sum, item) => sum + (item.salePrice || 0), 0);
  const costTotal = (sale.items || []).reduce((sum, item) => sum + (item.phoneCost || 0), 0);

  const totalSalePrice = subtotal;
  const netProfit = totalSalePrice - costTotal;

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
        <div class="flex justify-between items-center text-sm"><span>Ganancia (Venta):</span> <span class="font-bold ${
          netProfit >= 0 ? 'text-green-600' : 'text-red-600'
        }">${formatCurrency(netProfit, 'USD')}</span></div>

    `;
}

// ADDED: Función para renderizar la sección de reservas
function renderReservationsSection(state) {
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
            res.depositAmount,
            'USD'
          )} (${res.depositPaymentMethod.toUpperCase()})</span>`
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

// ADDED: Nueva función para renderizar la sección de vendedores
function renderSalespeopleSection(state) {
  if (!state.salespeople) return;
  const { salespeople, salespeopleSearchTerm } = state;
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
        <div class="card p-4 flex flex-col justify-between">
            <div>
                <p class="font-bold text-lg">${escapeHTML(person.name)}</p>
                <p class="text-sm text-gray-500">${escapeHTML(person.contact || 'Sin contacto')}</p>
                <p class="text-xs text-green-600 mt-2">Comisión: ${person.commissionRate || 0}%</p>

            </div>
            <div class="flex items-center justify-end mt-4">
                <button class="edit-salesperson-btn text-gray-400 hover:text-blue-500" data-salesperson='${JSON.stringify(
                  person
                )}'><i class="fas fa-edit"></i></button>
                <button class="delete-salesperson-btn ml-2 text-gray-400 hover:text-red-500" data-id="${
                  person.id
                }" data-name="${escapeHTML(person.name)}"><i class="fas fa-trash"></i></button>

            </div>
        </div>
    `
    )
    .join('');
}

export function toggleTradeInDetails() {
  const tradeInCheckbox = document.getElementById('has-trade-in');
  const tradeInDetailsEl = document.getElementById('trade-in-details');
  if (!tradeInCheckbox || !tradeInDetailsEl) return;
  const show = tradeInCheckbox.checked;

  if (show && tradeInDetailsEl.innerHTML === '') {
    const allCategories = appState.categories || [];
    const categoryOptions =
      '<option value="">-- Seleccionar Categoría --</option>' +
      allCategories
        .map((cat) => `<option value="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</option>`)
        .join('');
    tradeInDetailsEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label class="text-sm">Nombre Identificador</label><input type="text" id="trade-in-model" class="form-input w-full p-2 mt-1"></div>
                <div><label class="text-sm">N/S</label><input type="text" id="trade-in-serial" class="form-input w-full p-2 mt-1"></div>
                <div><label class="text-sm">Valor de Toma (USD)</label><input type="number" id="trade-in-value" class="form-input w-full p-2 mt-1" value="0"></div>
                <div><label class="text-sm">Categoría</label><select id="trade-in-category" class="form-select w-full p-2 mt-1">${categoryOptions}</select></div>

                <div><label class="text-sm">P. Venta Sugerido (USD)</label><input type="number" id="trade-in-sug-price" class="form-input w-full p-2 mt-1"></div>

                <div><label class="text-sm">Detalles (Canje)</label><textarea id="trade-in-details-input" class="form-textarea w-full p-2 mt-1"></textarea></div>
            </div>
            <div id="trade-in-attributes-container" class="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                </div>
        `;
  }

  tradeInDetailsEl.classList.toggle('hidden', !show);
  ['trade-in-model', 'trade-in-serial', 'trade-in-value'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.required = show;
  });
  const tradeInValue = document.getElementById('trade-in-value');
  if (!show && tradeInValue) {
    tradeInValue.value = 0;
  }

  if (!show) {
    const attributesContainer = document.getElementById('trade-in-attributes-container');
    if (attributesContainer) attributesContainer.innerHTML = '';
    const categorySelect = document.getElementById('trade-in-category');
    if (categorySelect) categorySelect.value = '';
  }

  updateSaleBalance(appState);
}

export function renderTradeInAttributes() {
  const categorySelect = document.getElementById('trade-in-category');
  const attributesContainer = document.getElementById('trade-in-attributes-container');
  if (!categorySelect || !attributesContainer) return;
  const selectedCategoryName = categorySelect.value;
  const allCategories = appState.categories || [];
  const selectedCategory = allCategories.find((c) => c.name === selectedCategoryName);
  if (selectedCategory && selectedCategory.attributes) {
    attributesContainer.innerHTML = selectedCategory.attributes
      .map((attr) => generateAttributeInputHTML(attr))
      .join('');
  } else {
    attributesContainer.innerHTML = '';
  }
}
export function formatCurrency(number, currency = 'ARS') {
  const num = number || 0;

  if (currency === 'USDT')
    return `${num.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USDT`;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(num);
  } catch (e) {
    return `${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }
}
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString + 'T12:00:00Z');
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return str
    .toString()
    .replace(
      /[&<>"']/g,
      (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match])
    );
}

export function switchTab(activeKey) {
  document
    .querySelectorAll('.main-tab-btn')
    .forEach((btn) => btn.classList.toggle('tab-active', btn.dataset.section === activeKey));
  document
    .querySelectorAll('.main-section')
    .forEach((section) =>
      section.classList.toggle('hidden', !section.id.startsWith(`section-${activeKey}`))
    );
  // FIX: Se asegura que la sub-pestaña correcta se active al cambiar de pestaña principal.
  if (activeKey === 'ventas') switchSubTab('ventas', 'nueva');
  if (activeKey === 'inventario') switchSubTab('inventario', 'stock');
  if (activeKey === 'operaciones') switchSubTab('operaciones', 'gastos');
  if (activeKey === 'reportes') switchSubTab('reportes', 'dashboard');
}

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

export function openNoteModal(note = null) {
  const isEditing = note !== null;
  const title = isEditing ? 'Editar Nota' : 'Nueva Nota';

  const noteTitle = isEditing ? note.title : '';
  const noteContent = isEditing ? note.content : '';

  const noteId = isEditing ? note.id : '';
  const content = `
        <form id="note-form" class="space-y-4" data-id="${noteId}">
            <div>
                <label for="note-title" class="block text-sm font-medium text-gray-700">Título</label>
                <input type="text" id="note-title" class="form-input w-full mt-1" value="${escapeHTML(
                  noteTitle
                )}" required>

            </div>
            <div>
                <label for="note-content" class="block text-sm font-medium text-gray-700">Contenido</label>
                <textarea id="note-content" rows="8" class="form-textarea w-full mt-1">${escapeHTML(
                  noteContent
                )}</textarea>

            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="note-form" class="btn-primary px-4 py-2">Guardar Nota</button>
    `;
  showModal(content, title, footer);
}

export function openChangePasswordModal() {
  const content = `
        <form id="password-change-form" class="space-y-4">
            <div>
                <label for="current-password" class="block text-sm font-medium text-gray-700">Contraseña Actual</label>
                <input type="password" id="current-password" class="form-input w-full mt-1" required>
            </div>
            <div>

                <label for="new-password" class="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                <input type="password" id="new-password" class="form-input w-full mt-1" placeholder="Mínimo 6 caracteres" required>
            </div>
            <div>
                <label for="confirm-password" class="block text-sm font-medium text-gray-700">Confirmar Nueva Contraseña</label>
                <input type="password" id="confirm-password" class="form-input w-full mt-1" required>

            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="password-change-form" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, 'Cambiar Contraseña', footer);
}

export function openAdjustCapitalModal(state) {
  const content = `<form id="adjust-capital-form" class="space-y-4">${Object.entries(WALLET_CONFIG)
    .filter(([k, c]) => !c.type || k === 'clientDebt')
    .map(
      ([key, config]) =>
        `<div><label class="block text-sm">${
          config.name
        }</label><input type="number" step="any" id="adjust-${key}" class="form-input w-full" value="${
          state.capital[key] || 0
        }"></div>`
    )
    .join('')}</form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="adjust-capital-form" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, 'Ajustar Saldos', footer);
}

export function openAddClientModal() {
  const content = `<form id="client-form-modal" class="space-y-4"><div><label class="block text-sm">Nombre</label><input type="text" id="client-name-modal" class="form-input w-full" required></div><div><label class="block text-sm">Teléfono</label><input type="text" id="client-phone-modal" class="form-input w-full"></div><div><label class="block text-sm">Detalles</label><textarea id="client-details-modal" class="form-textarea w-full"></textarea></div></form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="client-form-modal" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, 'Añadir Nuevo Cliente', footer);
}

// ADDED: Función para abrir el modal de nueva reserva
export function openReservationModal(state) {
  const content = `
        <form id="reservation-form" class="space-y-6">
            <div class="space-y-2">
                <h4 class="font-semibold">1. Cliente</h4>

                <div class="relative">
                    <div id="reservation-selected-client-display" class="mb-2"></div>
                    <div id="reservation-client-search-container">
                         <input type="text" id="reservation-client-search-input" class="form-input w-full" placeholder="Buscar cliente...">
                         <div id="reservation-client-search-results" class="absolute z-20 w-full bg-white border rounded-md mt-1 hidden max-h-48 overflow-y-auto"></div>

                    </div>
                </div>
            </div>

            <div class="space-y-2">

                <h4 class="font-semibold">2. Producto a Reservar</h4>

                 <div class="relative">
                    <div id="reservation-selected-item-display" class="mb-2"></div>
                    <div id="reservation-stock-search-container">
                        <input type="text" id="reservation-stock-search-input" class="form-input w-full" placeholder="Buscar producto disponible...">
                        <div id="reservation-stock-search-results" class="absolute z-10 w-full bg-white border rounded-md mt-1 hidden max-h-48 overflow-y-auto"></div>

                    </div>
                </div>
            </div>

            <div class="space-y-3 pt-4 border-t">

                <h4 class="font-semibold">3. Seña</h4>

                <div class="flex items-center">
                    <input id="reservation-has-deposit" type="checkbox" class="h-4 w-4">
                    <label for="reservation-has-deposit" class="ml-3">Se recibió seña</label>
                </div>
                <div id="reservation-deposit-details" class="hidden space-y-3 pl-4 border-l-2 ml-2">

                     <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm">Monto Seña</label>
                            <div class="flex items-center gap-2">

                                <input type="number" id="reservation-deposit-amount" data-form-type="reservation-deposit" class="currency-input form-input w-full" value="0">
                                <select id="reservation-deposit-currency" data-form-type="reservation-deposit" class="currency-select form-select">
                                     <option value="USD">USD</option>

                                    <option value="ARS">ARS</option>
                                </select>
                            </div>

                            <p id="reservation-deposit-conversion" class="text-xs text-gray-500 h-4 mt-1"></p>
                        </div>
                        <div>

                            <label class="block text-sm">Método de Pago</label>
                            <select id="reservation-deposit-method" class="form-select w-full">
                                <option value="usd">Dólares (USD)</option>

                                <option value="ars">Efectivo (ARS)</option>
                                <option value="mp">Digital (ARS)</option>
                                <option value="usdt">USDT</option>

                            </select>
                        </div>
                    </div>
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
}

export function openAddStockModal(state) {
  const { categories } = state;
  const allCategories = categories || [];

  let content = `
        <form id="stock-form-modal" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm">Categoría</label>
                    <select id="stock-category-modal" class="form-select w-full" required>
                        <option value="">-- Seleccionar --</option>

                        ${allCategories
                          .map(
                            (cat) =>
                              `<option value="${escapeHTML(cat.name)}">${escapeHTML(
                                cat.name
                              )}</option>`
                          )
                          .join('')}

                    </select>
                </div>
                <div>

                    <label class="block text-sm">Nombre Identificador</label>
                    <input type="text" id="stock-model-modal" class="form-input w-full" required>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-sm">N/S</label><input type="text" id="stock-serial-modal" class="form-input w-full" required></div>

                <div><label class="block text-sm">Cantidad</label><input type="number" id="stock-quantity-modal" class="form-input w-full" value="1" min="1" required></div>
            </div>
            <div class="border-t my-4"></div>
            <div id="dynamic-attributes-container-modal" class="space-y-4">
                
            </div>
            <div class="border-t my-4"></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-sm">Costo (USD)</label><input type="number" id="stock-cost-modal" class="form-input w-full" required></div>
                <div><label class="block text-sm">P. Venta Sugerido (USD)</label><input type="number" id="stock-price-modal" class="form-input w-full"></div>

            </div>
            <div><label class="block text-sm">Detalles Adicionales</label><textarea id="stock-details-modal" class="form-textarea w-full"></textarea></div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="stock-form-modal" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, `Añadir Nuevo Producto`, footer);
}

export function openEditStockModal(item, state) {
  const { categories } = state;
  const allCategories = categories || [];
  const itemCategory = allCategories.find((c) => c.name === item.category);
  let content = `
        <form id="edit-stock-form" class="space-y-4" data-id="${item.id}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label>Categoría</label>
                    <select id="edit-stock-category" class="form-select w-full" required>
                        ${allCategories
                          .map(
                            (cat) =>
                              `<option value="${escapeHTML(cat.name)}" ${
                                item.category === cat.name ? 'selected' : ''
                              }>${escapeHTML(cat.name)}</option>`
                          )
                          .join('')}

                    </select>
                </div>
                <div>
                    <label>Nombre Identificador</label>
                    <input type="text" id="edit-stock-model" class="form-input w-full" value="${escapeHTML(
                      item.model
                    )}" required>

                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div><label>N/S</label><input type="text" id="edit-stock-serial" class="form-input w-full" value="${escapeHTML(
                  item.serialNumber
                )}" required></div>
                <div><label>Cantidad</label><input type="number" id="edit-stock-quantity" class="form-input w-full" value="${
                  item.quantity || 1
                }" min="0" required></div>

            </div>
            <div class="border-t my-4"></div>
            <div id="dynamic-attributes-container-modal" class="space-y-4">
                ${
                  itemCategory?.attributes
                    ?.map((attr) => generateAttributeInputHTML(attr, item.attributes?.[attr.name]))
                    .join('') || ''
                }

            </div>
            <div class="border-t my-4"></div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label>Costo (USD)</label><input type="number" id="edit-stock-cost" class="form-input w-full" value="${
                  item.phoneCost || 0
                }" required></div>

                <div><label>P. Venta (USD)</label><input type="number" id="edit-stock-price" class="form-input w-full" value="${
                  item.suggestedSalePrice || 0
                }"></div>

            </div>
            <div><label>Detalles</label><textarea id="edit-stock-details" class="form-textarea w-full">${escapeHTML(
              item.details || ''
            )}</textarea></div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>

        <button type="submit" form="edit-stock-form" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, `Editar ${item.model}`, footer);
}

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

export function openEditDebtModal(debt) {
  const content = `<form id="edit-debt-form" class="space-y-4" data-id="${
    debt.id
  }"><div><label class="block text-sm">Nombre</label><input type="text" id="edit-debtor-name" class="form-input w-full" value="${escapeHTML(
    debt.debtorName
  )}" required></div><div><label class="block text-sm">Descripción</label><input type="text" id="edit-debt-desc" class="form-input w-full" value="${escapeHTML(
    debt.description
  )}" required></div>

  <div>
        <label class="block text-sm">Monto</label>
        <div class="flex items-center gap-2">
            <input type="number" id="edit-debt-amount" data-form-type="debt-edit" class="currency-input form-input w-full" value="${
              debt.amount
            }" required>
            <select id="edit-debt-currency" data-form-type="debt-edit" class="currency-select form-select">
                 <option value="USD" selected>USD</option>

                <option value="ARS">ARS</option>
            </select>
        </div>
        <p id="debt-edit-conversion" class="text-xs text-gray-500 h-4 mt-1"></p>
    </div>
  </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-debt-form" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, `Editar Deuda`, footer);
}

export function openEditFixedExpenseModal(expense) {
  const content = `
        <form id="edit-fixed-expense-form" class="space-y-4" data-id="${expense.id}">
            <div><label class="block text-sm">Descripción</label><input type="text" id="edit-fixed-expense-description" class="form-input w-full p-2" value="${escapeHTML(
              expense.description
            )}" required></div>
            <div class="grid grid-cols-2 gap-4 items-start">
                <div>

                    <label class="block text-sm">Monto</label>
                    <div class="flex items-center gap-2">
                        <input type="number" id="edit-fixed-expense-amount" data-form-type="fixed-expense-edit" class="currency-input form-input w-full p-2" value="${
                          expense.amount
                        }" required>

                        <select id="edit-fixed-expense-currency" data-form-type="fixed-expense-edit" class="currency-select form-select p-2">
                            <option value="USD" selected>USD</option>
                            <option value="ARS">ARS</option>

                        </select>
                    </div>
                    <p id="fixed-expense-edit-conversion" class="text-xs text-gray-500 h-4 mt-1"></p>
                </div>

                <div><label class="block text-sm">Día de Pago (1-31)</label><input type="number" id="edit-fixed-expense-day" class="form-input w-full p-2" value="${
                  expense.paymentDay
                }" required min="1" max="31"></div>
            </div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-fixed-expense-form" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, `Editar Gasto Fijo`, footer);
}

// ADDED: Funciones para modales de Vendedores
export function openAddSalespersonModal() {
  const content = `
        <form id="salesperson-form-modal" class="space-y-4">
            <div><label class="block text-sm">Nombre</label><input type="text" id="salesperson-name-modal" class="form-input w-full" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="salesperson-contact-modal" class="form-input w-full"></div>
            <div><label class="block text-sm">Tasa de Comisión (%)</label><input type="number" id="salesperson-commission-modal" class="form-input w-full" value="0" required></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="salesperson-form-modal" class="btn-primary px-4 py-2">Guardar</button>
    `;
  showModal(content, 'Añadir Nuevo Vendedor', footer);
}

export function openEditSalespersonModal(salesperson) {
  const content = `
        <form id="edit-salesperson-form-modal" class="space-y-4" data-id="${salesperson.id}">
            <div><label class="block text-sm">Nombre</label><input type="text" id="edit-salesperson-name-modal" class="form-input w-full" value="${escapeHTML(
              salesperson.name
            )}" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="edit-salesperson-contact-modal" class="form-input w-full" value="${escapeHTML(
              salesperson.contact || ''
            )}"></div>

            <div><label class="block text-sm">Tasa de Comisión (%)</label><input type="number" id="edit-salesperson-commission-modal" class="form-input w-full" value="${
              salesperson.commissionRate || 0
            }" required></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-salesperson-form-modal" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, 'Editar Vendedor', footer);
}

// ADDED: Funciones para modales de Proveedores del Usuario
export function openAddProviderModal() {
  const content = `
        <form id="provider-form-modal" class="space-y-4">
            <div><label class="block text-sm">Nombre del Proveedor</label><input type="text" id="provider-name-modal" class="form-input w-full" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="provider-contact-modal" class="form-input w-full"></div>
            <div><label class="block text-sm">Notas</label><textarea id="provider-notes-modal" class="form-textarea w-full"></textarea></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="provider-form-modal" class="btn-primary px-4 py-2">Guardar Proveedor</button>
    `;
  showModal(content, 'Añadir Nuevo Proveedor', footer);
}

export function openEditProviderModal(provider) {
  const content = `
        <form id="edit-provider-form-modal" class="space-y-4" data-id="${provider.id}">
            <div><label class="block text-sm">Nombre del Proveedor</label><input type="text" id="edit-provider-name-modal" class="form-input w-full" value="${escapeHTML(
              provider.name
            )}" required></div>
            <div><label class="block text-sm">Contacto (Teléfono/Email)</label><input type="text" id="edit-provider-contact-modal" class="form-input w-full" value="${escapeHTML(
              provider.contact || ''
            )}"></div>

            <div><label class="block text-sm">Notas</label><textarea id="edit-provider-notes-modal" class="form-textarea w-full">${escapeHTML(
              provider.notes || ''
            )}</textarea></div>
        </form>`;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="edit-provider-form-modal" class="btn-primary px-4 py-2">Guardar Cambios</button>
    `;
  showModal(content, 'Editar Proveedor', footer);
}

export function openExecutePaymentModal(expense, state) {
  const { capital, exchangeRate } = state;
  const content = `
        <div class="text-center">
            <p class="mb-2">Pagar Gasto Fijo:</p>
            <h3 class="text-2xl font-bold mb-4">${escapeHTML(expense.description)}</h3>
            <p class="text-3xl font-bold mb-6">${formatCurrency(expense.amount, 'USD')}</p>
        </div>
        <div>
            <h4 class="font-semibold mb-3 text-center">1. Seleccionar Billetera de Origen</h4>

            <div id="payment-wallet-selector" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${Object.entries(WALLET_CONFIG)
                  .filter(([key, config]) => !config.type)
                  .map(([key, config]) => {
                    const balance = capital[key] || 0;

                    const expenseAmountInCurrency =
                      config.currency === 'ARS' ? expense.amount * exchangeRate : expense.amount;
                    const hasEnoughFunds = balance >= expenseAmountInCurrency;
                    return `

                        <button class="payment-wallet-option w-full p-3 rounded-lg border-2 border-gray-200 text-left transition-colors ${
                          hasEnoughFunds
                            ? 'hover:border-green-500'
                            : 'opacity-50 cursor-not-allowed'
                        }"

                            data-wallet-type="${key}"
                            data-expense-id="${expense.id}"
                            ${!hasEnoughFunds ? 'disabled' : ''}>

                            <div class="flex justify-between items-center">
                                <span class="font-semibold"><i class="${config.icon} mr-2"></i>${
                      config.name
                    }</span>

                                <span class="font-mono text-sm">${formatCurrency(
                                  balance,
                                  config.currency
                                )}</span>

                            </div>
                            ${
                              !hasEnoughFunds
                                ? '<p class="text-xs text-red-500 mt-1">Fondos insuficientes</p>'
                                : ''
                            }

                        </button>`;
                  })
                  .join('')}
            </div>
        </div>
        <div class="payment-confirmation-actions hidden mt-6 text-center border-t pt-4">
            <h4 class="font-semibold mb-3 text-center">2. Confirmar Pago</h4>

            <button id="confirm-payment-btn" class="btn-primary w-full py-3 text-lg">Confirmar Pago</button>
        </div>
    `;
  const footer = `<button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>`;
  showModal(content, 'Confirmar Pago', footer);
}

export function openExecuteDailyExpenseModal(expenseData, state) {
  const { capital, exchangeRate } = state;
  const content = `
        <div class="text-center">
            <p class="mb-2">Pagar Gasto Diario:</p>
            <h3 class="text-2xl font-bold mb-4">${escapeHTML(expenseData.description)}</h3>
            <p class="text-3xl font-bold mb-6">${formatCurrency(expenseData.amount, 'USD')}</p>
        </div>
        <div>
            <h4 class="font-semibold mb-3 text-center">1. Seleccionar Billetera de Origen</h4>

            <div id="daily-expense-wallet-selector" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${Object.entries(WALLET_CONFIG)
                  .filter(([key, config]) => !config.type)
                  .map(([key, config]) => {
                    const balance = capital[key] || 0;

                    let hasEnoughFunds = false;
                    if (config.currency === 'ARS') {
                      hasEnoughFunds = balance >= expenseData.amount * exchangeRate;
                    } else {
                      hasEnoughFunds = balance >= expenseData.amount;
                    }
                    return `
                        <button class="execute-daily-expense-wallet-btn w-full p-3 rounded-lg border text-left ${
                          hasEnoughFunds ? 'hover:bg-green-50' : 'opacity-50 cursor-not-allowed'
                        }"

                            data-wallet-type="${key}" ${!hasEnoughFunds ? 'disabled' : ''}>

                            <div class="flex justify-between items-center">
                                <span class="font-semibold"><i class="${config.icon} mr-2"></i>${
                      config.name
                    }</span>

                                <span class="font-mono text-sm">${formatCurrency(
                                  balance,
                                  config.currency
                                )}</span>

                            </div>
                            ${
                              !hasEnoughFunds
                                ? '<p class="text-xs text-red-500 mt-1">Fondos insuficientes</p>'
                                : ''
                            }

                        </button>`;
                  })
                  .join('')}
            </div>
        </div>
        <div class="payment-confirmation-actions hidden mt-6 text-center border-t pt-4">
            <h4 class="font-semibold mb-3 text-center">2. Confirmar Pago</h4>

            <button id="confirm-daily-expense-payment-btn" class="btn-primary w-full py-3 text-lg" data-expense-data='${JSON.stringify(
              expenseData
            )}'>Confirmar Pago</button>
        </div>
    `;
  const footer = `<div class="text-center mt-6"><button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button></div>`;
  showModal(content, 'Confirmar Pago de Gasto Diario', footer);
}

export function showSaleDetailModal(sale) {
  if (!sale) return;
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;
  const itemsCost = (sale.items || []).reduce((sum, item) => sum + (item.phoneCost || 0), 0);
  const netProfit = (sale.total || 0) - itemsCost;

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

                             <div class="flex justify-between text-xl font-extrabold border-t-2 border-green-300 pt-2 mt-2">
                                 <span>GANANCIA:</span>
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

export function showItemDetailsModal(item) {
  if (!item) return;

  const attributesHTML =
    item.attributes && Object.keys(item.attributes).length > 0
      ? Object.entries(item.attributes)

          .map(
            ([key, value]) =>
              `<div class="flex justify-between py-1"><span class="text-gray-600">${escapeHTML(
                key
              )}:</span><span class="font-semibold">${escapeHTML(value)}</span></div>`
          )
          .join('')
      : '<p class="text-gray-500">No hay atributos específicos para este producto.</p>';

  const content = `
        <div class="space-y-3">
            <div class="bg-gray-100 p-3 rounded-lg">
                <div class="flex justify-between text-lg"><span class="font-bold">${escapeHTML(
                  item.model
                )}</span><span class="text-gray-500">${escapeHTML(item.category)}</span></div>
                <div class="text-sm text-center text-gray-500 font-mono">${escapeHTML(
                  item.serialNumber
                )}</div>

            </div>
            <div class="border-t pt-3">
                <h4 class="font-semibold mb-2">Atributos</h4>
                <div class="text-sm space-y-1">${attributesHTML}</div>

            </div>
             <div class="border-t pt-3">
                <h4 class="font-semibold mb-2">Detalles Adicionales</h4>
                <p class="text-sm text-gray-600">${escapeHTML(
                  item.details || 'Sin detalles adicionales.'
                )}</p>

            </div>
        </div>
    `;
  showModal(content, 'Detalles del Producto');
}

export function openSettleClientDebtModal(saleId, balance, state) {
  const sale = state.sales.find((s) => s.id === saleId);
  if (!sale) return;

  const content = `
        <form id="settle-client-debt-form" class="space-y-4" data-sale-id="${saleId}">
            <p>Saldar deuda de <strong>${escapeHTML(sale.customerName)}</strong>.</p>
            <p class="text-2xl font-bold text-center text-yellow-600">${formatCurrency(
              balance,
              'USD'
            )}</p>
            <div>

                <label class="block text-sm">Monto a Pagar</label>
                <div class="flex items-center gap-2">
                    <input type="number" id="settle-debt-amount" data-form-type="settle-debt" class="currency-input form-input w-full" value="${balance}" required>
                    <select id="settle-debt-currency" data-form-type="settle-debt" class="currency-select form-select">
                        <option value="USD" selected>USD</option>

                        <option value="ARS">ARS</option>
                    </select>
                </div>
                <p id="settle-debt-conversion" class="text-xs text-gray-500 h-4 mt-1"></p>
            </div>

            <div>
                <label class="block text-sm">Ingresar a Billetera</label>
                <select id="settle-debt-wallet" class="form-select w-full">
                    <option value="usd">Dólares (USD)</option>
                    <option value="ars">Efectivo (ARS)</option>

                    <option value="mp">Digital (ARS)</option>
                    <option value="usdt">USDT</option>
                </select>
            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn-secondary close-modal-btn px-4 py-2">Cancelar</button>
        <button type="submit" form="settle-client-debt-form" class="btn-primary px-4 py-2">Registrar Pago</button>
    `;
  showModal(content, 'Registrar Pago de Deuda', footer);
}

function renderPerformanceChart(salesInPeriod, dailyExpensesInPeriod, startDate, endDate) {
  const ctxEl = document.getElementById('performance-chart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  if (charts.performance) charts.performance.destroy();
  const timeUnit = (endDate - startDate) / (1000 * 3600 * 24) > 35 ? 'month' : 'day';

  const getGroupKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    if (timeUnit === 'day') {
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return `${year}-${month}`;
  };
  const groupedData = {};
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const key = getGroupKey(currentDate);
    if (!groupedData[key]) {
      const labelFormat = {
        day: (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        month: (d) => d.toLocaleString('es-ES', { month: 'short', year: 'numeric' }),
      };
      groupedData[key] = {
        label: labelFormat[timeUnit](new Date(currentDate)),
        income: 0,
        expenses: 0,
        grossProfit: 0,
        date: new Date(currentDate),
      };
    }
    if (timeUnit === 'day') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }
  salesInPeriod.forEach((sale) => {
    let saleDate;
    if (sale.soldAt && sale.soldAt.toDate) saleDate = sale.soldAt.toDate();
    else if (sale.saleDate) saleDate = new Date(sale.saleDate + 'T12:00:00Z');
    else return;
    const key = getGroupKey(saleDate);
    if (groupedData[key]) {
      groupedData[key].income += sale.total || 0;
      const itemsCost = (sale.items || []).reduce((sum, i) => sum + (i.phoneCost || 0), 0);
      groupedData[key].grossProfit += (sale.total || 0) - itemsCost;
    }
  });
  dailyExpensesInPeriod.forEach((expense) => {
    const expenseDate = new Date(expense.date + 'T12:00:00Z');
    const key = getGroupKey(expenseDate);
    if (groupedData[key]) {
      groupedData[key].expenses += expense.amount || 0;
    }
  });
  const sortedGroups = Object.values(groupedData).sort((a, b) => a.date - b.date);
  charts.performance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedGroups.map((g) => g.label),
      datasets: [
        {
          label: 'Ingresos',
          data: sortedGroups.map((g) => g.income),
          backgroundColor: 'rgba(52, 199, 89, 0.7)',
          order: 1,
        },

        {
          label: 'Gastos',
          data: sortedGroups.map((g) => g.expenses),
          backgroundColor: 'rgba(255, 59, 48, 0.7)',
          order: 1,
        },
        {
          label: 'Ganancia Bruta',
          data: sortedGroups.map((g) => g.grossProfit),

          borderColor: '#00aaff',
          borderWidth: 2,
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 0,
        },
        {
          label: 'Ganancia Neta',
          data: sortedGroups.map((g) => g.grossProfit - g.expenses),

          borderColor: '#5856d6',
          borderWidth: 2,
          type: 'line',
          tension: 0.3,
          fill: false,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderExpenseBreakdownChart(saleCosts, executedFixed, daily) {
  const chartContainer = document.getElementById('expense-chart-container');
  if (!chartContainer) return;

  chartContainer.innerHTML = '<canvas id="expense-breakdown-chart"></canvas>';
  const ctxEl = document.getElementById('expense-breakdown-chart');
  if (!ctxEl) return;

  const totalExpenses = executedFixed + daily;
  if (totalExpenses === 0) {
    if (charts.expenseBreakdown) {
      charts.expenseBreakdown.destroy();
      charts.expenseBreakdown = null;
    }
    chartContainer.innerHTML =
      '<div class="flex items-center justify-center h-full text-gray-400">No hay datos de gastos para el período.</div>';
    const summaryContainer = document.getElementById('expense-breakdown-summary');
    if (summaryContainer) summaryContainer.innerHTML = '';
    return;
  }

  if (charts.expenseBreakdown) {
    charts.expenseBreakdown.destroy();
  }

  charts.expenseBreakdown = new Chart(ctxEl.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Pagos Fijos', 'Gastos Diarios'],
      datasets: [
        {
          data: [executedFixed, daily],
          backgroundColor: ['#ff3b30', '#ffcc00'],
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
      },
    },
  });
  const summaryContainer = document.getElementById('expense-breakdown-summary');
  if (summaryContainer) {
    summaryContainer.innerHTML = `
            <ul class="space-y-2 text-sm">
                <li class="flex justify-between items-center py-1">
                    <span><i class="fas fa-circle mr-2" style="color: #ff3b30;"></i>Pagos Fijos</span>
                    <span class="font-semibold">${formatCurrency(executedFixed, 'USD')}</span>
                </li>

                <li class="flex justify-between items-center py-1">
                    <span><i class="fas fa-circle mr-2" style="color: #ffcc00;"></i>Gastos Diarios</span>
                    <span class="font-semibold">${formatCurrency(daily, 'USD')}</span>
                </li>
            </ul>

        `;
  }
}

function renderNetProfitCategoryChart(salesInPeriod) {
  const ctxEl = document.getElementById('net-profit-category-chart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  const profitsByCat = {};
  salesInPeriod.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const category = item.category || 'Sin Categoría';
      if (!profitsByCat[category]) profitsByCat[category] = 0;
      const itemNetProfit = (item.salePrice || 0) - (item.phoneCost || 0);
      profitsByCat[category] += itemNetProfit;
    });
  });
  const labels = Object.keys(profitsByCat);
  const netProfitData = labels.map((label) => profitsByCat[label]);
  if (charts.netProfitCategory) charts.netProfitCategory.destroy();
  charts.netProfitCategory = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ganancia Neta',
          data: netProfitData,
          backgroundColor: 'rgba(0, 122, 255, 0.7)',
          borderColor: 'rgba(0, 122, 255, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { x: { beginAtZero: true } },
    },
  });
}
function renderSalesMetricsChart(salesInPeriod) {
  const ctxEl = document.getElementById('sales-metrics-chart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  const salesCount = salesInPeriod.length;
  let totalNetProfit = 0;
  const totalSalesValue = salesInPeriod.reduce((sum, s) => sum + (s.total || 0), 0);
  salesInPeriod.forEach((sale) => {
    const itemsCost = (sale.items || []).reduce((itemSum, i) => itemSum + (i.phoneCost || 0), 0);
    const saleNetProfit = (sale.total || 0) - itemsCost;
    totalNetProfit += saleNetProfit;
  });
  const avgSaleValue = salesCount > 0 ? totalSalesValue / salesCount : 0;
  const avgNetProfit = salesCount > 0 ? totalNetProfit / salesCount : 0;
  if (charts.salesMetrics) charts.salesMetrics.destroy();
  charts.salesMetrics = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Ventas Totales', 'Ganancia Neta Total', 'Venta Promedio', 'Ganancia Neta Promedio'],
      datasets: [
        {
          label: 'Métricas (USD)',
          data: [totalSalesValue, totalNetProfit, avgSaleValue, avgNetProfit],
          backgroundColor: [
            'rgba(0, 122, 255, 0.7)',

            'rgba(88, 86, 214, 0.7)',
            'rgba(0, 122, 255, 0.5)',
            'rgba(88, 86, 214, 0.5)',
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },

      scales: { x: { ticks: { font: { size: 10 } } } },
    },
  });
}

function renderCapitalGrowthChart(capitalHistory, startDate, endDate) {
  const ctxEl = document.getElementById('capital-growth-chart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');
  if (charts.capitalGrowth) {
    charts.capitalGrowth.destroy();
  }

  if (!capitalHistory || capitalHistory.length === 0) {
    return;
  }

  const filteredHistory = capitalHistory.filter((entry) => {
    if (!entry.timestamp || !entry.timestamp.toDate) return false;
    const entryDate = entry.timestamp.toDate();
    return entryDate >= startDate && entryDate <= endDate;
  });
  if (filteredHistory.length === 0) {
    return;
  }

  charts.capitalGrowth = new Chart(ctx, {
    type: 'line',
    data: {
      labels: filteredHistory.map((entry) =>
        entry.timestamp.toDate().toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      ),

      datasets: [
        {
          label: 'Capital Total (USD)',
          data: filteredHistory.map((entry) => entry.totalCapital),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              const entry = filteredHistory[context[0].dataIndex];
              return `${entry.timestamp.toDate().toLocaleString('es-AR')} - ${entry.reason}`;
            },
            label: function (context) {
              let label = context.dataset.label || '';

              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatCurrency(context.parsed.y, 'USD');
              }
              return label;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value, index, values) {
              return formatCurrency(value, 'USD');
            },
          },
        },
      },
    },
  });
}

export function renderSalesAnalysis(state) {
  const { sales, stock, clients, ui } = state;
  const { analysisPeriod, analysisCustomStartDate, analysisCustomEndDate } = ui.analysis;
  const container = document.getElementById('analysis-results-container');
  const selector = document.getElementById('analysis-selector');
  if (!container || !selector || !sales || !stock || !clients) return;

  document
    .querySelectorAll('.filter-btn[data-hub="analysis"]')
    .forEach((btn) =>
      btn.classList.toggle('filter-btn-active', btn.dataset.period === analysisPeriod)
    );
  const customControls = document.getElementById('analysis-custom-date-range-controls');
  if (customControls) customControls.classList.toggle('hidden', analysisPeriod !== 'custom');

  const now = new Date();
  let startDate, endDate;
  switch (analysisPeriod) {
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
      startDate = analysisCustomStartDate
        ? new Date(analysisCustomStartDate + 'T00:00:00')
        : new Date(0);

      endDate = analysisCustomEndDate ? new Date(analysisCustomEndDate + 'T23:59:59') : new Date();

      break;
    default:
      startDate = new Date(0);
      endDate = new Date();
  }

  const salesInPeriod = sales.filter((s) => {
    const saleDate = s.soldAt?.toDate() || new Date(s.saleDate + 'T12:00:00Z');
    return saleDate >= startDate && saleDate <= endDate;
  });
  const analysisType = selector.value;
  let contentHTML = '';

  switch (analysisType) {
    case 'sales':
      if (salesInPeriod.length === 0) {
        contentHTML =
          '<p class="text-center text-gray-500">No hay ventas en el período seleccionado.</p>';

        break;
      }
      const totalRevenue = salesInPeriod.reduce((sum, s) => sum + s.total, 0);
      const totalNetProfit = salesInPeriod.reduce((sum, s) => {
        const itemsCost = (s.items || []).reduce((cost, i) => cost + (i.phoneCost || 0), 0);
        return sum + (s.total - itemsCost);
      }, 0);
      const salesByCategory = salesInPeriod
        .flatMap((s) => s.items)
        .reduce((acc, item) => {
          const category = item.category || 'Sin Categoría';
          if (!acc[category]) {
            acc[category] = { count: 0, revenue: 0 };
          }
          acc[category].count++;
          acc[category].revenue += item.salePrice || 0;

          return acc;
        }, {});
      contentHTML = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="card p-4 text-center"><p class="text-sm text-gray-500">Ventas Totales</p><p class="text-2xl font-bold">${
                      salesInPeriod.length
                    }</p></div>
                    <div class="card p-4 text-center"><p class="text-sm text-gray-500">Facturación Total</p><p class="text-2xl font-bold">${formatCurrency(
                      totalRevenue,
                      'USD'
                    )}</p></div>

                    <div class="card p-4 text-center"><p class="text-sm text-gray-500">Ganancia Neta Total</p><p class="text-2xl font-bold text-green-600">${formatCurrency(
                      totalNetProfit,
                      'USD'
                    )}</p></div>

                </div>
                <h4 class="text-lg font-semibold mb-2">Ventas por Categoría</h4>

                <div class="overflow-x-auto"><table class="min-w-full text-sm">
                    <thead class="bg-gray-100"><tr>
                        <th class="p-2 text-left">Categoría</th><th class="p-2 text-center">Unidades</th><th class="p-2 text-right">Facturación</th>
                    </tr></thead>

                    <tbody>${Object.entries(salesByCategory)
                      .map(
                        ([cat, data]) => `
                        <tr class="border-b"><td class="p-2 font-semibold">${cat}</td><td class="p-2 text-center">${
                          data.count
                        }</td><td class="p-2 text-right">${formatCurrency(
                          data.revenue,
                          'USD'
                        )}</td></tr>

                    `
                      )
                      .join('')}</tbody>
                </table></div>

            `;
      break;

    case 'stock':
      const totalStockValue = stock.reduce((sum, item) => sum + (item.phoneCost || 0), 0);
      const stockByCategory = stock.reduce((acc, item) => {
        const category = item.category || 'Sin Categoría';
        if (!acc[category]) {
          acc[category] = { count: 0, value: 0 };
        }
        acc[category].count++;
        acc[category].value += item.phoneCost || 0;
        return acc;
      }, {});
      contentHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="card p-4 text-center"><p class="text-sm text-gray-500">Unidades en Stock</p><p class="text-2xl font-bold">${
                      stock.length
                    }</p></div>
                    <div class="card p-4 text-center"><p class="text-sm text-gray-500">Valor Total del Stock</p><p class="text-2xl font-bold text-blue-600">${formatCurrency(
                      totalStockValue,
                      'USD'
                    )}</p></div>

                </div>

                <h4 class="text-lg font-semibold mb-2">Stock por Categoría</h4>
                <div class="overflow-x-auto"><table class="min-w-full text-sm">
                    <thead class="bg-gray-100"><tr>
                        <th class="p-2 text-left">Categoría</th><th class="p-2 text-center">Unidades</th><th class="p-2 text-right">Valor (USD)</th>
                    </tr></thead>

                    <tbody>${Object.entries(stockByCategory)
                      .map(
                        ([cat, data]) => `
                        <tr class="border-b"><td class="p-2 font-semibold">${cat}</td><td class="p-2 text-center">${
                          data.count
                        }</td><td class="p-2 text-right">${formatCurrency(
                          data.value,
                          'USD'
                        )}</td></tr>

                    `
                      )
                      .join('')}</tbody>

                </table></div>
            `;
      break;

    case 'clients':
      if (salesInPeriod.length === 0) {
        contentHTML =
          '<p class="text-center text-gray-500">No hay datos de clientes para el período seleccionado.</p>';

        break;
      }
      const salesByClient = salesInPeriod.reduce((acc, sale) => {
        const id = sale.clientId;
        if (!acc[id]) {
          acc[id] = { name: sale.customerName, count: 0, totalProfit: 0 };
        }
        const itemsCost = (sale.items || []).reduce((cost, i) => cost + (i.phoneCost || 0), 0);
        acc[id].count++;
        acc[id].totalProfit += sale.total - itemsCost;

        return acc;
      }, {});
      const repeatClients = Object.values(salesByClient)
        .filter((c) => c.count > 1)
        .sort((a, b) => b.count - a.count);
      const topClients = Object.values(salesByClient)
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 10);
      contentHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="card p-4 text-center"><p class="text-sm text-gray-500">Clientes Únicos (Período)</p><p class="text-2xl font-bold">${
                      Object.keys(salesByClient).length
                    }</p></div>
                    <div class="card p-4 text-center"><p class="text-sm text-gray-500">Clientes Recurrentes (Período)</p><p class="text-2xl font-bold">${
                      repeatClients.length
                    }</p></div>

                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    <div>
                        <h4 class="text-lg font-semibold mb-2">Clientes con Más Compras (Período)</h4>
                        <div class="overflow-x-auto"><table class="min-w-full text-sm">
                            <thead class="bg-gray-100"><tr><th class="p-2 text-left">Nombre</th><th class="p-2 text-center">Compras</th></tr></thead>

                            <tbody>${
                              repeatClients.length > 0
                                ? repeatClients

                                    .map(
                                      (c) =>
                                        `<tr class="border-b"><td class="p-2">${escapeHTML(
                                          c.name
                                        )}</td><td class="p-2 text-center">${c.count}</td></tr>`
                                    )
                                    .join('')
                                : '<tr><td colspan="2" class="text-center p-4 text-gray-500">Ninguno</td></tr>'
                            }</tbody>
                        </table></div>
                    </div>
                    <div>

                        <h4 class="text-lg font-semibold mb-2">Top 10 Clientes por Ganancia (Período)</h4>
                        <div class="overflow-x-auto"><table class="min-w-full text-sm">
                            <thead class="bg-gray-100"><tr><th class="p-2 text-left">Nombre</th><th class="p-2 text-right">Ganancia Generada</th></tr></thead>

                            <tbody>${
                              topClients.length > 0
                                ? topClients

                                    .map(
                                      (c) =>
                                        `<tr class="border-b"><td class="p-2">${escapeHTML(
                                          c.name
                                        )}</td><td class="p-2 text-right font-semibold text-green-600">${formatCurrency(
                                          c.totalProfit,
                                          'USD'
                                        )}</td></tr>`
                                    )
                                    .join('')
                                : '<tr><td colspan="2" class="text-center p-4 text-gray-500">Sin datos</td></tr>'
                            }</tbody>
                        </table></div>
                    </div>

                </div>
            `;
      break;
  }

  container.innerHTML = contentHTML;
}
