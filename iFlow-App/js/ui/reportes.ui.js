import { charts, appState } from '../state.js';
import { formatCurrency, escapeHTML } from './utils.js';

/**
 * Renderiza las sub-secciones de la pestaña de Reportes.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderReportsSections(state) {
  renderDashboardSection(state);
  renderSalesAnalysis(state);
}

/**
 * Renderiza el Dashboard principal con sus métricas y gráficos.
 * @param {object} state El estado actual de la aplicación.
 */
function renderDashboardSection(state) {
  if (!state.sales || !state.dailyExpenses) return;
  const { sales, dailyExpenses, ui } = state;
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
      // Asegurarse de que la fecha se interprete en UTC para evitar problemas de zona horaria
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
  const dailyCosts = dailyExpensesInPeriod.reduce((sum, e) => sum + (e.amountUSD || 0), 0);
  const totalExpenses = dailyCosts;

  const totalCommissions = salesInPeriod.reduce((sum, s) => sum + (s.commissionUSD || 0), 0);
  const netProfit = grossProfit - totalExpenses - totalCommissions;

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

  // --- Renderizado de Gráficos ---
  renderPerformanceChart(salesInPeriod, dailyExpensesInPeriod, startDate, endDate);
  const executedFixedExpenses = dailyExpensesInPeriod
    .filter((e) => e.isFixedPayment)
    .reduce((sum, e) => sum + e.amountUSD, 0);
  const pureDailyExpenses = dailyCosts - executedFixedExpenses;
  renderExpenseBreakdownChart(0, executedFixedExpenses, pureDailyExpenses);
  renderNetProfitCategoryChart(salesInPeriod);
  renderSalesMetricsChart(salesInPeriod);
}

/**
 * Renderiza la sección de Análisis con sus filtros y resultados.
 * @param {object} state El estado actual de la aplicación.
 */
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

// --- Funciones de Gráficos ---

/**
 * Renderiza el gráfico de rendimiento (Ingresos vs Gastos).
 * @param {Array} salesInPeriod Ventas en el período seleccionado.
 * @param {Array} dailyExpensesInPeriod Gastos en el período seleccionado.
 * @param {Date} startDate Fecha de inicio del período.
 * @param {Date} endDate Fecha de fin del período.
 */
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
      groupedData[key].expenses += expense.amountUSD || 0;
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

/**
 * Renderiza el gráfico de desglose de gastos.
 * @param {number} saleCosts Costo total de ventas.
 * @param {number} executedFixed Gastos fijos pagados.
 * @param {number} daily Gastos diarios.
 */
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

/**
 * Renderiza el gráfico de ganancia neta por categoría.
 * @param {Array} salesInPeriod Ventas en el período seleccionado.
 */
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

/**
 * Renderiza el gráfico de métricas de venta.
 * @param {Array} salesInPeriod Ventas en el período seleccionado.
 */
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
