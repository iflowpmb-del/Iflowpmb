import { WALLET_CONFIG } from '../state.js';
import { formatCurrency, formatDate, formatDateTime, escapeHTML } from './utils.js';
import { showModal } from './modales.js';

/**
 * Renderiza todas las sub-secciones de la pestaña de Operaciones.
 * @param {object} state El estado actual de la aplicación.
 */
export function renderOperationsSections(state) {
  renderExpensesSection(state);
  // =================================================================================
  // INICIO DE MODIFICACIÓN: Se llama a las dos funciones de renderizado de deudas
  // =================================================================================
  renderDebtsList(state);
  renderDebtsHistory(state);
  // =================================================================================
  // FIN DE MODIFICACIÓN
  // =================================================================================
  renderNotesSection(state);
  renderCollapsibleSections(state);
}

/**
 * Renderiza la lista de deudas con proveedores en la sub-pestaña "Deudas".
 * @param {object} state El estado actual de la aplicación.
 */
function renderDebtsList(state) {
  const container = document.getElementById('debts-list-consultas');
  const noMessage = document.getElementById('no-provider-debts-message');
  if (!container || !noMessage || !state.debts || !state.providerDebtPayments) return;

  // =================================================================================
  // INICIO DE MODIFICACIÓN: Filtra solo las deudas pendientes
  // =================================================================================
  const pendingDebts = state.debts.filter((debt) => debt.status !== 'saldada');
  // =================================================================================
  // FIN DE MODIFICACIÓN
  // =================================================================================

  noMessage.classList.toggle('hidden', pendingDebts.length > 0);
  if (pendingDebts.length === 0) {
    container.innerHTML = '';
    return;
  }

  const paymentsByDebtId = state.providerDebtPayments.reduce((acc, payment) => {
    if (!acc[payment.parentId]) {
      acc[payment.parentId] = [];
    }
    acc[payment.parentId].push(payment);
    return acc;
  }, {});

  container.innerHTML = pendingDebts
    .map((debt) => {
      const payments = paymentsByDebtId[debt.id] || [];
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

      return `
            <div class="debt-card-container card p-4">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-lg">${escapeHTML(debt.debtorName)}</p>
                        <p class="text-sm text-gray-500">${escapeHTML(debt.description)}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-2xl text-red-600">${formatCurrency(
                          debt.amount,
                          'USD'
                        )}</p>
                        <p class="text-xs text-gray-400">Pendiente</p>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t flex justify-between items-center">
                    <button class="toggle-payment-history text-sm text-blue-600 hover:underline" ${
                      payments.length === 0 ? 'disabled' : ''
                    }>
                        ${payments.length > 0 ? `Ver Historial (${payments.length})` : 'Sin Pagos'}
                        <i class="fas fa-chevron-down ml-1 text-xs"></i>
                    </button>
                    <div class="flex items-center gap-2">
                        <button class="edit-debt-btn text-gray-400 hover:text-blue-500 p-2" data-debt='${JSON.stringify(
                          debt
                        )}'><i class="fas fa-edit"></i></button>
                        <button class="delete-debt-btn text-gray-400 hover:text-red-500 p-2" data-id="${
                          debt.id
                        }"><i class="fas fa-trash"></i></button>
                        <button class="settle-our-debt-btn btn-primary py-1 px-3 text-sm" data-debt-id="${
                          debt.id
                        }">Pagar</button>
                    </div>
                </div>
                ${paymentHistoryHtml}
            </div>
        `;
    })
    .join('');
}

// =================================================================================
// INICIO DE MODIFICACIÓN: Nueva función para renderizar el historial de deudas
// =================================================================================
/**
 * Renderiza el historial de deudas saldadas con proveedores.
 * @param {object} state El estado actual de la aplicación.
 */
function renderDebtsHistory(state) {
  const container = document.getElementById('provider-debts-history-container');
  const noMessage = document.getElementById('no-provider-debts-history-message');
  if (!container || !noMessage || !state.debts) return;

  const settledDebts = state.debts.filter((debt) => debt.status === 'saldada');

  noMessage.classList.toggle('hidden', settledDebts.length > 0);
  if (settledDebts.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = settledDebts
    .sort((a, b) => (b.settledAt?.toMillis() || 0) - (a.settledAt?.toMillis() || 0))
    .map(
      (debt) => `
            <div class="card p-4 bg-gray-50 opacity-80">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-lg text-gray-700">${escapeHTML(
                          debt.debtorName
                        )}</p>
                        <p class="text-sm text-gray-500">${escapeHTML(debt.description)}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-semibold text-lg text-green-600">Saldada</p>
                        <p class="text-xs text-gray-400">
                            ${
                              debt.settledAt
                                ? formatDate(debt.settledAt.toDate())
                                : 'Fecha no disponible'
                            }
                        </p>
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

/**
 * Obtiene el estado de un gasto fijo (pagado, pendiente, vencido).
 * @param {object} expense El objeto del gasto fijo.
 * @returns {object} Un objeto con el texto, color y si es pagable.
 */
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

/**
 * Renderiza la sección de gestión de gastos (fijos y diarios).
 * @param {object} state El estado actual de la aplicación.
 */
function renderExpensesSection(state) {
  if (!state.fixedExpenses || !state.dailyExpenses) return;
  const { fixedExpenses, dailyExpenses, expensesSearchTerm, exchangeRate } = state;

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

          let amountDisplay = '';
          if (exp.currency === 'ARS') {
            const amountInUSD = exp.amount / exchangeRate;
            amountDisplay = `
                  <div>
                      <p class="font-semibold">${formatCurrency(exp.amount, 'ARS')}</p>
                      <p class="text-xs text-gray-500">~ ${formatCurrency(amountInUSD, 'USD')}</p>
                  </div>
              `;
          } else {
            amountDisplay = `<p class="font-semibold">${formatCurrency(exp.amount, 'USD')}</p>`;
          }

          return `
              <div class="bg-white p-3 rounded-lg flex justify-between items-center border shadow-sm">
                  <div>
                      <p class="font-semibold">${escapeHTML(exp.description)}</p>
                      <p class="text-xs ${status.color} mt-1">${status.text}</p>
                  </div>
                  <div class="flex items-center gap-2">
                      ${amountDisplay}
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

/**
 * Renderiza un item individual en el historial de pagos.
 * @param {object} expense El objeto del gasto pagado.
 * @returns {string} El HTML del item del historial.
 */
function renderPaymentHistoryItem(expense) {
  let walletHtml = '';
  if (expense.paidFrom) {
    const walletInfo = WALLET_CONFIG[expense.paidFrom] || {};
    const walletIcon = walletInfo.icon || 'fa-solid fa-question-circle';
    walletHtml = `<i class="${walletIcon} mr-2"></i>`;
  } else if (expense.paidFromBreakdown) {
    walletHtml = Object.keys(expense.paidFromBreakdown)
      .map((walletKey) => {
        const walletInfo = WALLET_CONFIG[walletKey] || {};
        const walletIcon = walletInfo.icon || 'fa-solid fa-question-circle';
        return `<i class="${walletIcon}" title="${walletInfo.name}"></i>`;
      })
      .join('<span class="mx-1">+</span>');
  }

  return `
        <div class="bg-white p-3 rounded-lg flex justify-between items-center border shadow-sm">
            <div>
                <p>${escapeHTML(expense.description)}</p>
                <div class="text-xs text-gray-500 flex items-center mt-1">
                    <span class="flex items-center gap-1.5 mr-2">${walletHtml}</span>
                    <span>${formatDate(expense.date)}</span>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <p class="font-semibold">${formatCurrency(expense.amountUSD, 'USD')}</p>
                <button class="delete-daily-expense-btn p-2 text-gray-400 hover:text-red-500" data-id="${
                  expense.id
                }"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

/**
 * Renderiza la sección del block de notas.
 * @param {object} state El estado actual de la aplicación.
 */
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

/**
 * Controla la visibilidad de las secciones colapsables.
 * @param {object} state El estado actual de la aplicación.
 */
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

// --- Modales Específicos de Operaciones ---

/**
 * Abre el modal para editar una deuda existente.
 * @param {object} debt El objeto de la deuda a editar.
 */
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

/**
 * Abre el modal para editar un gasto fijo existente.
 * @param {object} expense El objeto del gasto fijo a editar.
 */
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
                            <option value="USD" ${
                              !expense.currency || expense.currency === 'USD' ? 'selected' : ''
                            }>USD</option>
                            <option value="ARS" ${
                              expense.currency === 'ARS' ? 'selected' : ''
                            }>ARS</option>
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

/**
 * Abre el modal para crear o editar una nota.
 * @param {object|null} note El objeto de la nota a editar, o null para una nueva.
 */
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
