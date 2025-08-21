import { charts, appState } from '../state.js';
import { formatCurrency, escapeHTML } from './utils.js';

// ===============================================================
// INICIO DE MODIFICACIÓN: Se añade la configuración del nuevo módulo
// ===============================================================

// Configuración central para el módulo de Análisis Inteligente
const ANALYSIS_CONFIG = {
    ventas: {
        label: 'Ventas',
        groups: {
            category: 'Categoría',
            product: 'Producto Específico',
            salesperson: 'Vendedor'
        },
        metrics: {
            revenue: 'Total Facturado (USD)',
            units: 'Unidades Vendidas',
            grossProfit: 'Ganancia Bruta (USD)'
        }
    },
    rentabilidad: {
        label: 'Rentabilidad',
        groups: {
            category: 'Categoría',
            product: 'Producto Específico',
            salesperson: 'Vendedor'
        },
        metrics: {
            netProfit: 'Ganancia Neta (USD)',
            margin: 'Margen de Ganancia (%)'
        }
    },
    inventario: {
        label: 'Inventario',
        groups: {
            category: 'Categoría',
            provider: 'Proveedor',
            grade: 'Grado del Producto'
        },
        metrics: {
            costValue: 'Valor de Costo Total (USD)',
            units: 'Cantidad de Unidades',
            age: 'Antigüedad Promedio (días)'
        }
    },
    clientes: {
        label: 'Clientes',
        groups: { // Para clientes, "agrupar por" funciona como un "ranking por"
            top_revenue: 'Mayor Volumen de Compra (USD)',
            top_purchases: 'Mayor Cantidad de Compras',
            top_profit: 'Mayor Ganancia Generada (USD)'
        },
        metrics: { // Las métricas son implícitas en el ranking, pero definimos una para la tabla
            value: 'Valor'
        }
    },
    gastos: {
        label: 'Gastos',
        groups: {
            type: 'Tipo de Gasto'
        },
        metrics: {
            totalSpent: 'Monto Total Gastado (USD)'
        }
    }
};

/**
 * Renderiza la sección de Análisis Inteligente, poblando los selectores y mostrando los resultados.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderIntelligentAnalysisSection(state) {
    const { sales, stock, clients, salespeople, dailyExpenses, categories, ui } = state;
    if (!sales || !stock || !clients || !ui.analysis) return;

    const areaSelector = document.getElementById('analysis-area-selector');
    const groupbySelector = document.getElementById('analysis-groupby-selector');
    const metricSelector = document.getElementById('analysis-metric-selector');
    const resultsContainer = document.getElementById('analysis-results-container');

    if (!areaSelector || !groupbySelector || !metricSelector || !resultsContainer) return;

    // ===============================================================
    // INICIO DE LA CORRECCIÓN
    // Se añade la lógica para actualizar el estado visual de los botones de filtro.
    // Esto hace que el botón seleccionado se vea de un color diferente.
    // ===============================================================
    const { analysisPeriod } = ui.analysis;
    document
        .querySelectorAll('.filter-btn[data-hub="analysis"]')
        .forEach((btn) =>
            btn.classList.toggle('filter-btn-active', btn.dataset.period === analysisPeriod)
        );
    
    const customControls = document.getElementById('analysis-custom-date-range-controls');
    if (customControls) {
        customControls.classList.toggle('hidden', analysisPeriod !== 'custom');
    }
    // ===============================================================
    // FIN DE LA CORRECCIÓN
    // ===============================================================

    const {
        analysisArea = 'ventas',
        analysisGroupby,
        analysisMetric
    } = ui.analysis;

    // 1. Poblar el selector de Área
    if (areaSelector.options.length <= 1) {
        areaSelector.innerHTML = Object.entries(ANALYSIS_CONFIG)
            .map(([key, config]) => `<option value="${key}" ${analysisArea === key ? 'selected' : ''}>${config.label}</option>`)
            .join('');
    }

    // 2. Poblar los selectores de Agrupación y Métrica dinámicamente
    const currentConfig = ANALYSIS_CONFIG[analysisArea];
    const selectedGroupby = analysisGroupby || Object.keys(currentConfig.groups)[0];
    const selectedMetric = analysisMetric || Object.keys(currentConfig.metrics)[0];

    groupbySelector.innerHTML = Object.entries(currentConfig.groups)
        .map(([key, label]) => `<option value="${key}" ${selectedGroupby === key ? 'selected' : ''}>${label}</option>`)
        .join('');

    metricSelector.innerHTML = Object.entries(currentConfig.metrics)
        .map(([key, label]) => `<option value="${key}" ${selectedMetric === key ? 'selected' : ''}>${label}</option>`)
        .join('');

    // 3. Filtrar los datos por el rango de fechas seleccionado
    const { analysisCustomStartDate, analysisCustomEndDate } = ui.analysis;
    const now = new Date();
    let startDate, endDate;
    // (La lógica de filtrado de fechas es la misma que en el dashboard)
    switch (analysisPeriod) {
        case 'today':
            startDate = new Date(); startDate.setHours(0, 0, 0, 0);
            endDate = new Date(); endDate.setHours(23, 59, 59, 999);
            break;
        case 'week':
            const day = now.getDay();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + (day === 0 ? -6 : 1));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(); endDate.setHours(23, 59, 59, 999);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(); endDate.setHours(23, 59, 59, 999);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            startDate = analysisCustomStartDate ? new Date(analysisCustomStartDate + 'T00:00:00') : new Date(0);
            endDate = analysisCustomEndDate ? new Date(analysisCustomEndDate + 'T23:59:59') : new Date();
            break;
        default:
            startDate = new Date(0);
            endDate = new Date();
    }

    const salesInPeriod = sales.filter(s => {
        const saleDate = s.soldAt?.toDate() || new Date(s.saleDate + 'T12:00:00Z');
        return saleDate >= startDate && saleDate <= endDate;
    });

    // 4. Calcular los resultados
    let results = [];
    let headers = ['Grupo', 'Métrica'];

    // Lógica principal de cálculo
    try {
        switch (analysisArea) {
            case 'ventas':
            case 'rentabilidad':
                const data = {};
                salesInPeriod.forEach(sale => {
                    (sale.items || []).forEach(item => {
                        let key;
                        switch (selectedGroupby) {
                            case 'category': key = item.category || 'Sin Categoría'; break;
                            case 'product': key = item.model || 'Producto Desconocido'; break;
                            case 'salesperson': key = sale.salespersonName || 'Sin Vendedor'; break;
                        }
                        if (!data[key]) data[key] = { revenue: 0, units: 0, cost: 0, commission: 0 };
                        data[key].revenue += item.salePrice || 0;
                        data[key].units++;
                        data[key].cost += item.phoneCost || 0;
                        // La comisión se prorratea entre los items de la venta
                        data[key].commission += (sale.commissionUSD || 0) / (sale.items.length || 1);
                    });
                });
                
                results = Object.entries(data).map(([key, values]) => {
                    const grossProfit = values.revenue - values.cost;
                    const netProfit = grossProfit - values.commission;
                    let metricValue;
                    switch (selectedMetric) {
                        case 'revenue': metricValue = values.revenue; break;
                        case 'units': metricValue = values.units; break;
                        case 'grossProfit': metricValue = grossProfit; break;
                        case 'netProfit': metricValue = netProfit; break;
                        case 'margin': metricValue = values.cost > 0 ? (netProfit / values.cost) * 100 : 0; break;
                    }
                    return { group: key, value: metricValue };
                });
                break;

            case 'inventario':
                const invData = {};
                stock.forEach(item => {
                    let key;
                    switch (selectedGroupby) {
                        case 'category': key = item.category || 'Sin Categoría'; break;
                        case 'provider': key = item.providerName || 'No Asignado'; break;
                        case 'grade': key = item.attributes?.Grado || 'Sin Grado'; break;
                    }
                    if (!invData[key]) invData[key] = { costValue: 0, units: 0, totalAge: 0, countForAge: 0 };
                    const quantity = item.quantity || 1;
                    invData[key].costValue += (item.phoneCost || 0) * quantity;
                    invData[key].units += quantity;
                    if (item.createdAt?.toDate) {
                        const age = (new Date() - item.createdAt.toDate()) / (1000 * 3600 * 24);
                        invData[key].totalAge += age * quantity;
                        invData[key].countForAge += quantity;
                    }
                });

                results = Object.entries(invData).map(([key, values]) => {
                    let metricValue;
                    switch (selectedMetric) {
                        case 'costValue': metricValue = values.costValue; break;
                        case 'units': metricValue = values.units; break;
                        case 'age': metricValue = values.countForAge > 0 ? values.totalAge / values.countForAge : 0; break;
                    }
                    return { group: key, value: metricValue };
                });
                break;
            
            case 'clientes':
                const clientData = {};
                salesInPeriod.forEach(sale => {
                    const id = sale.clientId;
                    if (!clientData[id]) clientData[id] = { name: sale.customerName, purchases: 0, revenue: 0, profit: 0 };
                    clientData[id].purchases++;
                    clientData[id].revenue += sale.total || 0;
                    const saleProfit = (sale.items || []).reduce((sum, i) => sum + ((i.salePrice || 0) - (i.phoneCost || 0)), 0) - (sale.commissionUSD || 0);
                    clientData[id].profit += saleProfit;
                });

                results = Object.values(clientData).map(c => {
                    let metricValue;
                    switch (selectedGroupby) {
                        case 'top_revenue': metricValue = c.revenue; break;
                        case 'top_purchases': metricValue = c.purchases; break;
                        case 'top_profit': metricValue = c.profit; break;
                    }
                    return { group: c.name, value: metricValue };
                });
                headers = ['Cliente', currentConfig.groups[selectedGroupby]];
                break;

            case 'gastos':
                const expenseData = { 'Gastos Fijos': 0, 'Gastos Diarios/Variables': 0 };
                const expensesInPeriod = dailyExpenses.filter(e => {
                    const expenseDate = new Date(e.date + 'T12:00:00Z');
                    return expenseDate >= startDate && expenseDate <= endDate;
                });
                expensesInPeriod.forEach(expense => {
                    if (expense.isFixedPayment) {
                        expenseData['Gastos Fijos'] += expense.amountUSD || 0;
                    } else {
                        expenseData['Gastos Diarios/Variables'] += expense.amountUSD || 0;
                    }
                });
                results = Object.entries(expenseData).map(([key, value]) => ({ group: key, value }));
                break;
        }
    } catch (error) {
        console.error("Error al calcular el análisis:", error);
        resultsContainer.innerHTML = `<p class="text-center text-red-500">Ocurrió un error al generar el análisis.</p>`;
        return;
    }

    // 5. Renderizar los resultados
    results.sort((a, b) => b.value - a.value);

    if (results.length === 0) {
        resultsContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No hay datos suficientes para mostrar en el período seleccionado.</p>`;
        return;
    }

    const formatValue = (value, metric) => {
        if (metric === 'units' || metric === 'top_purchases') return value.toFixed(0);
        if (metric === 'margin') return `${value.toFixed(2)}%`;
        if (metric === 'age') return `${value.toFixed(0)} días`;
        return formatCurrency(value, 'USD');
    };

    resultsContainer.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-3 text-left font-semibold">${headers[0]}</th>
                        <th class="p-3 text-right font-semibold">${currentConfig.metrics[selectedMetric] || headers[1]}</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(r => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-3">${escapeHTML(r.group)}</td>
                            <td class="p-3 text-right font-semibold">${formatValue(r.value, selectedMetric)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}


// ===============================================================
// FIN DE MODIFICACIÓN
// ===============================================================


/**
 * Renderiza las sub-secciones de la pestaña de Reportes.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderReportsSections(state) {
  renderDashboardSection(state);
  // La llamada a renderIntelligentAnalysisSection se hace desde el orquestador principal (ui.js)
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
  
  const totalCommissions = salesInPeriod.reduce((sum, s) => sum + (s.commissionUSD || 0), 0);
  const totalExpenses = dailyCosts + totalCommissions; // Ahora las comisiones son parte de los gastos totales
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

  // --- Renderizado de Gráficos ---
  renderPerformanceChart(salesInPeriod, dailyExpensesInPeriod, startDate, endDate);
  const executedFixedExpenses = dailyExpensesInPeriod
    .filter((e) => e.isFixedPayment)
    .reduce((sum, e) => sum + e.amountUSD, 0);
  
  const pureDailyExpenses = dailyCosts - executedFixedExpenses;
  
  renderExpenseBreakdownChart(totalCommissions, executedFixedExpenses, pureDailyExpenses);
  renderNetProfitCategoryChart(salesInPeriod);
  renderSalesMetricsChart(salesInPeriod);
}

// --- Funciones de Gráficos (SIN CAMBIOS) ---

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
        commissions: 0, // Añadido para acumular comisiones
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
      groupedData[key].commissions += sale.commissionUSD || 0;
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
          data: sortedGroups.map((g) => g.grossProfit - g.expenses - g.commissions),
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
 * @param {number} commissions Comisiones totales de vendedores.
 * @param {number} executedFixed Gastos fijos pagados.
 * @param {number} daily Gastos diarios.
 */
function renderExpenseBreakdownChart(commissions, executedFixed, daily) {
  const chartContainer = document.getElementById('expense-chart-container');
  if (!chartContainer) return;

  chartContainer.innerHTML = '<canvas id="expense-breakdown-chart"></canvas>';
  const ctxEl = document.getElementById('expense-breakdown-chart');
  if (!ctxEl) return;

  const totalExpenses = commissions + executedFixed + daily;
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
      labels: ['Comisiones', 'Pagos Fijos', 'Gastos Diarios'],
      datasets: [
        {
          data: [commissions, executedFixed, daily],
          backgroundColor: ['#5856d6', '#ff3b30', '#ffcc00'], // Color añadido para comisiones
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
                    <span><i class="fas fa-circle mr-2" style="color: #5856d6;"></i>Comisiones</span>
                    <span class="font-semibold">${formatCurrency(commissions, 'USD')}</span>
                </li>
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
