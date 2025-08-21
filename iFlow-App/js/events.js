// =================================================================================
// ARCHIVO DE MANEJO DE EVENTOS
// =================================================================================

// --- IMPORTACIONES DIRECTAS DESDE LOS MÓDulos DE ORIGEN ---
import { switchTab, switchSubTab, switchDebtView } from './ui.js';
import { showModal, openConfirmModal, openPaymentModal } from './ui/modales.js';
import { formatCurrency } from './ui/utils.js';
import { openAdjustCapitalModal } from './ui/capital.ui.js';
import {
  updateSaleBalance,
  toggleTradeInDetails,
  renderTradeInAttributes,
  showSaleDetailModal,
  openReservationModal,
  openAddSalespersonModal,
  openEditSalespersonModal,
} from './ui/ventas.ui.js';
import {
  renderAddStockForm,
  openEditStockModal,
  showItemDetailsModal,
  openEditAttributeModal,
  openEditProductOptionsModal,
} from './ui/inventario.ui.js';
import {
  openAddClientModal,
  openEditClientModal,
  showClientHistoryModal,
} from './ui/clientes.ui.js';
import {
  openEditDebtModal,
  openEditFixedExpenseModal,
  openNoteModal,
} from './ui/operaciones.ui.js';
import { renderIntelligentAnalysisSection } from './ui/reportes.ui.js';
import { openAddProviderModal, openEditProviderModal } from './ui/proveedores.ui.js';
import { appState, setState, WALLET_CONFIG, DEFAULT_CATEGORIES } from './state.js';
import { addData, deleteFromDb, updateData, setData, runBatch } from './api.js';
import { handleLogin, handleRegistration, openChangePasswordModal } from './auth.js';
import {
  serverTimestamp,
  doc,
  collection,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { auth, db } from './firebase-config.js';

// Variable para el temporizador del ajuste del dólar (debounce)
let dolarOffsetTimer;

// =================================================================================
// FUNCIONES DE LÓGICA (HELPERS)
// =================================================================================

async function logCapitalState(reason) {
  try {
    setTimeout(async () => {
      const { stock, capital, debts, exchangeRate } = appState;
      if (!stock || !capital || !debts) {
        console.warn('No se pudo registrar el historial de capital: datos incompletos.');
        return;
      }

      const stockValueUSD = stock.reduce(
        (sum, item) => sum + (item.phoneCost || 0) * (item.quantity || 1),
        0
      );
      const totalDebtUSD = debts.reduce((sum, debt) => sum + (debt.amount || 0), 0);
      const arsWalletsUSD = ((capital.ars || 0) + (capital.mp || 0)) / exchangeRate;
      const usdWallets = (capital.usd || 0) + (capital.usdt || 0);
      const totalCapital =
        arsWalletsUSD + usdWallets + stockValueUSD + (capital.clientDebt || 0) - totalDebtUSD;
      const historyEntry = {
        totalCapital: totalCapital,
        reason: reason,
        timestamp: serverTimestamp(),
      };
      await addData('capital_history', historyEntry);
    }, 100);
  } catch (error) {
    console.error('Error al registrar el estado del capital:', error);
  }
}

/**
 * Gestiona el estado de carga global de la aplicación.
 * @param {boolean} isLoading - True para mostrar el overlay, false para ocultarlo.
 * @param {HTMLElement|null} button - El botón que inició la acción (opcional).
 * @param {string} loadingText - El texto a mostrar en el botón mientras carga (opcional).
 */
function setGlobalLoading(isLoading, button = null, loadingText = 'Guardando...') {
  setState({ isGlobalLoading: isLoading });

  if (button) {
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<i class="fas fa-spinner spinner mr-2"></i> ${loadingText}`;
    } else {
      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
      }
      button.disabled = false;
    }
  }
}

function handleManualDelete(collectionName, docId, entityName) {
  const message = `Esta acción eliminará ${entityName} de la lista. Recuerda que debes revertir o ajustar manualmente cualquier cambio de capital asociado. ¿Deseas continuar?`;
  openConfirmModal(message, async () => {
    setGlobalLoading(true);
    try {
        await deleteFromDb(collectionName, docId);
        showModal(`${entityName} eliminado con éxito.`);
    } catch (error) {
        showModal(`Error al eliminar: ${error.message}`, 'Error');
    } finally {
        setGlobalLoading(false);
    }
  });
}

async function handleProcessPayment(form) {
  const button = form.querySelector('button[type="submit"]');
  setGlobalLoading(true, button, 'Procesando...');
  try {
    const { paymentType, targetId, totalAmount, expenseData: expenseDataJSON } = form.dataset;
    const totalAmountDue = parseFloat(totalAmount);
    const { capital, exchangeRate, user, dailyExpenses, fixedExpenses } = appState;

    const paymentInputs = form.querySelectorAll('.payment-input-modal');
    const paymentBreakdownOriginal = {};
    let totalPaidInUSD = 0;

    paymentInputs.forEach((input) => {
      const value = parseFloat(input.value) || 0;
      if (value > 0) {
        const walletType = input.dataset.wallet;
        paymentBreakdownOriginal[walletType] = value;
        const isArs = walletType === 'ars' || walletType === 'mp';
        totalPaidInUSD += isArs ? value / exchangeRate : value;
      }
    });
    if (totalPaidInUSD <= 0) {
      throw new Error('Debes ingresar un monto a pagar.');
    }

    if (totalPaidInUSD > totalAmountDue + 0.01) {
      throw new Error('El monto pagado no puede ser mayor que el total adeudado.');
    }

    await runBatch(async (batch, db, userId) => {
      const capitalRef = doc(db, `users/${userId}/capital`, 'summary');
      const capitalUpdates = {};

      const basePaymentRecord = {
        userId: user.uid,
        amountUSD: totalPaidInUSD,
        breakdown: paymentBreakdownOriginal,
        createdAt: serverTimestamp(),
        exchangeRateAtPayment: exchangeRate,
      };

      switch (paymentType) {
        case 'settleClientDebt': {
          const saleRef = doc(db, `users/${userId}/sales`, targetId);
          const sale = appState.sales.find((s) => s.id === targetId);
          const currentSettled = sale.debtSettled || 0;
          const newSettledAmount = currentSettled + totalPaidInUSD;

          batch.update(saleRef, { debtSettled: newSettledAmount });

          const paymentRecordRef = doc(collection(db, `users/${userId}/sales/${targetId}/payments`));
          batch.set(paymentRecordRef, basePaymentRecord);

          for (const walletType in paymentBreakdownOriginal) {
            const paymentValue = paymentBreakdownOriginal[walletType];
            capitalUpdates[walletType] = (capital[walletType] || 0) + paymentValue;
          }
          // ===============================================================
          // INICIO DE LA CORRECCIÓN
          // Se añade la lógica para restar el monto pagado del total de deudas de clientes.
          // ===============================================================
          capitalUpdates.clientDebt = (capital.clientDebt || 0) - totalPaidInUSD;
          // ===============================================================
          // FIN DE LA CORRECCIÓN
          // ===============================================================
          batch.update(capitalRef, capitalUpdates);
          break;
        }

        case 'settleProviderDebt': {
          const debtRef = doc(db, `users/${userId}/debts`, targetId);
          const debt = appState.debts.find((d) => d.id === debtId);
          const newAmount = debt.amount - totalPaidInUSD;
          if (newAmount < 0.01) {
            batch.update(debtRef, { 
                amount: 0, 
                status: 'saldada', 
                settledAt: serverTimestamp() 
            });
          } else {
            batch.update(debtRef, { amount: newAmount });
          }

          const paymentRecordRef = doc(collection(db, `users/${userId}/debts/${targetId}/payments`));
          batch.set(paymentRecordRef, basePaymentRecord);
          for (const walletType in paymentBreakdownOriginal) {
            const paymentValue = paymentBreakdownOriginal[walletType];
            capitalUpdates[walletType] = (capital[walletType] || 0) - paymentValue;
          }
          batch.update(capitalRef, capitalUpdates);
          break;
        }

        case 'payFixedExpense': {
          const expense = fixedExpenses.find((exp) => exp.id === targetId);
          if (!expense) throw new Error('Gasto fijo no encontrado.');
          
          const currentMonthID = `${new Date().getFullYear()}-${String(
            new Date().getMonth() + 1
          ).padStart(2, '0')}`;

          // 1. Registrar el pago como un gasto diario para el historial general
          const dailyExpenseRef = doc(collection(db, `users/${userId}/daily_expenses`));
          batch.set(dailyExpenseRef, {
            amountUSD: totalPaidInUSD,
            date: new Date().toISOString().split('T')[0],
            description: `Pago de gasto fijo: ${expense.description}`,
            isFixedPayment: true,
            paidFromBreakdown: paymentBreakdownOriginal,
            createdAt: serverTimestamp(),
            exchangeRateAtPayment: exchangeRate,
            originalAmount: expense.amount,
            originalCurrency: expense.currency,
            fixedExpenseParentId: targetId, // Vínculo con el gasto fijo padre
          });

          // 2. Actualizar las billeteras
          for (const walletType in paymentBreakdownOriginal) {
            const paymentValue = paymentBreakdownOriginal[walletType];
            capitalUpdates[walletType] = (capital[walletType] || 0) - paymentValue;
          }
          batch.update(capitalRef, capitalUpdates);
          
          // 3. Verificar si el gasto del mes ya se completó con este pago
          const expenseTotalInUSD = expense.currency === 'ARS' ? expense.amount / exchangeRate : expense.amount;
          
          const paymentsThisMonth = dailyExpenses.filter(p => 
              p.fixedExpenseParentId === targetId && 
              p.date.startsWith(currentMonthID)
          );
          const totalPaidBeforeThis = paymentsThisMonth.reduce((sum, p) => sum + p.amountUSD, 0);
          const newTotalPaid = totalPaidBeforeThis + totalPaidInUSD;

          if (newTotalPaid >= expenseTotalInUSD - 0.01) {
              const fixedExpenseRef = doc(db, `users/${userId}/fixed_expenses`, targetId);
              batch.update(fixedExpenseRef, { lastPaidMonth: currentMonthID });
          }
          break;
        }

        case 'payDailyExpense': {
          const expenseData = JSON.parse(expenseDataJSON);
          if (Math.abs(totalPaidInUSD - expenseData.amountUSD) > 0.01) {
            throw new Error('El monto pagado para el gasto diario debe ser exacto.');
          }

          const dailyExpenseRef = doc(collection(db, `users/${userId}/daily_expenses`));
          batch.set(dailyExpenseRef, {
            ...expenseData,
            isFixedPayment: false,
            paidFromBreakdown: paymentBreakdownOriginal,
            createdAt: serverTimestamp(),
            exchangeRateAtPayment: exchangeRate,
            originalAmount: expenseData.originalAmount,
            originalCurrency: expenseData.originalCurrency,
          });
          for (const walletType in paymentBreakdownOriginal) {
            const paymentValue = paymentBreakdownOriginal[walletType];
            capitalUpdates[walletType] = (capital[walletType] || 0) - paymentValue;
          }
          batch.update(capitalRef, capitalUpdates);
          break;
        }
      }
    });

    await logCapitalState(`Procesado pago de tipo: ${paymentType}`);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Pago registrado con éxito.');
  } catch (error) {
    console.error('Error al procesar el pago:', error);
    showModal(`No se pudo procesar el pago: ${error.message}`, 'Error');
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handlePayFixedExpense(expenseId) {
    const { fixedExpenses, dailyExpenses, exchangeRate, user } = appState;
    const expense = fixedExpenses.find((exp) => exp.id === expenseId);
    if (!expense) {
        return showModal('No se pudo encontrar el gasto fijo seleccionado.', 'Error');
    }

    const amountInUSD = expense.currency === 'ARS' ? expense.amount / exchangeRate : expense.amount;
    const currentMonthID = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    
    // Filtrar los pagos ya realizados para este gasto en el mes actual
    const paymentsThisMonth = dailyExpenses.filter(p => 
        p.fixedExpenseParentId === expenseId && 
        p.date.startsWith(currentMonthID)
    );

    const totalPaidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amountUSD, 0);
    const remainingAmount = amountInUSD - totalPaidThisMonth;

    if (remainingAmount < 0.01) {
        return showModal('Este gasto ya ha sido cubierto para el mes actual.', 'Información');
    }

    openPaymentModal({
        paymentType: 'payFixedExpense',
        targetId: expense.id,
        totalAmount: remainingAmount,
        entityName: `Gasto Fijo: ${expense.description}`,
        allowPartial: true, // Permitir pagos parciales
    });
}


function handleSettleProviderDebt(debtId) {
  const debt = appState.debts.find((d) => d.id === debtId);
  if (debt) {
    openPaymentModal({
      paymentType: 'settleProviderDebt',
      targetId: debt.id,
      totalAmount: debt.amount,
      entityName: `Deuda a ${debt.debtorName}`,
      allowPartial: true,
      paymentHistoryCollection: `users/${appState.user.uid}/debts/${debtId}/payments`,
    });
  } else {
    showModal('No se pudo encontrar la deuda seleccionada.', 'Error');
  }
}

function handleSettleClientDebt(saleId, balance) {
  const sale = appState.sales.find((s) => s.id === saleId);
  if (sale) {
    openPaymentModal({
      paymentType: 'settleClientDebt',
      targetId: sale.id,
      totalAmount: balance,
      entityName: `Deuda de ${sale.customerName}`,
      allowPartial: true,
      paymentHistoryCollection: `users/${appState.user.uid}/sales/${saleId}/payments`,
    });
  } else {
    showModal('No se pudo encontrar la venta asociada a la deuda.', 'Error');
  }
}

function handleAddDailyExpense(form) {
  const amount = parseFloat(form.querySelector('#daily-expense-amount-reg').value) || 0;
  const currency = form.querySelector('#daily-expense-currency-reg').value;
  const amountInUSD = currency === 'ARS' ? amount / appState.exchangeRate : amount;
  const expenseData = {
    description: form.querySelector('#daily-expense-description-reg').value.trim(),
    amountUSD: amountInUSD,
    date: form.querySelector('#daily-expense-date-reg').value,
    originalAmount: amount,
    originalCurrency: currency,
  };
  if (!expenseData.date) {
    return showModal('Por favor, selecciona una fecha para el gasto.');
  }

  openPaymentModal({
    paymentType: 'payDailyExpense',
    targetId: null,
    totalAmount: expenseData.amountUSD,
    entityName: `Gasto: ${expenseData.description}`,
    allowPartial: false,
    expenseData: expenseData,
  });
  form.reset();
}

async function handleAdjustCapital(form, reason) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setGlobalLoading(true, button);
  try {
    const capitalData = {};
    const inputs = form.querySelectorAll('input[type="number"]');
    inputs.forEach((input) => {
      const key = input.id.replace('adjust-', '');
      capitalData[key] = parseFloat(input.value) || 0;
    });
    await setData('capital', 'summary', capitalData);
    await logCapitalState(`Ajuste Manual: ${reason}`);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Saldos de capital actualizados con éxito.');
  } catch (error) {
    console.error('Error al ajustar el capital:', error);
    showModal(`Ocurrió un error al guardar los saldos: ${error.message}`);
  } finally {
    setGlobalLoading(false, button);
  }
}

function handleStartSubscriptionFlow() {
  const user = appState.user;
  if (!user) return;
  const content = `
<p class="mb-4">Serás redirigido para configurar tu pago.</p>
<p class="mb-6">Por favor, asegúrate de usar el mismo email con el que te registraste:</p>
<p class="mb-6 font-bold text-center bg-gray-100 p-2 rounded">${user.email}</p>
<p class="text-sm text-gray-500">Si este no es el correo correcto, puedes volver al inicio para ingresar con otra cuenta.</p>
`;
  const footer = `
<button type="button" id="logout-from-subscription-modal" class="btn-secondary px-4 py-2">Volver al Inicio</button>
<button id="confirm-gumroad-redirect" class="btn-primary px-4 py-2">Entendido, ir al Checkout</button>
`;
  showModal(content, 'Atención', footer);
}

async function handleAnnulSale(saleId) {
  const sale = appState.sales.find((s) => s.id === saleId);
  if (!sale) {
    return showModal('No se pudo encontrar la venta para anular.', 'Error');
  }

  const message = `¿Estás seguro de que quieres anular esta venta?<br><br>
        - La <strong>cantidad de cada producto vendido</strong> será devuelta al stock.<br><br>
        <strong>Importante:</strong> Esta acción <strong>NO</strong> ajustará tus billeteras automáticamente. Deberás restar los ingresos de esta venta manualmente. <br><br>
        El producto recibido como canje (si hubo) <strong>NO</strong> se eliminará del stock.<br><br>
        Esta acción no se puede deshacer.`;
  openConfirmModal(message, async () => {
    setGlobalLoading(true);
    try {
      await runBatch((batch, db, userId) => {
        if (sale.items && sale.items.length > 0) {
          sale.items.forEach((item) => {
            const stockItemRef = doc(db, `users/${userId}/stock`, item.id);
            const originalStockItem = appState.stock.find((s) => s.id === item.id);

            if (originalStockItem) {
              const newQuantity = (originalStockItem.quantity || 0) + 1;
              batch.update(stockItemRef, { quantity: newQuantity });
            } else {
              const { salePrice, ...stockItemData } = item;
              stockItemData.createdAt = serverTimestamp();
              stockItemData.quantity = 1;
              batch.set(stockItemRef, stockItemData);
            }
          });
        }

        const saleRef = doc(db, `users/${userId}/sales`, saleId);
        batch.delete(saleRef);
      });
      await logCapitalState(`Venta anulada a ${sale.customerName}`);
      showModal(
        'Venta anulada con éxito. Los productos han sido devueltos al stock. Recuerda ajustar el capital manualmente.',
        'Éxito'
      );
    } catch (error) {
      console.error('Error al anular la venta:', error);
      showModal(`Ocurrió un error al anular la venta: ${error.message}`, 'Error');
    } finally {
        setGlobalLoading(false);
    }
  });
}

async function handleFinalizeSaleFromReservation(reservationId) {
  const { reservations, clients } = appState;
  const reservation = reservations.find((r) => r.id === reservationId);

  if (!reservation) {
    showModal('No se pudo encontrar la reserva.', 'Error');
    return;
  }

  const saleClient = clients.find((c) => c.id === reservation.clientId);
  const saleItem = { ...reservation.item };

  if (!saleClient || !saleItem) {
    showModal('No se pudo encontrar el cliente o el producto de la reserva.', 'Error');
    return;
  }

  let notes = reservation.notes || '';
  if (reservation.hasDeposit && reservation.depositAmountUSD > 0) {
    const depositNote = `\n\n--- Reserva Previa ---\nSeña recibida: ${formatCurrency(
      reservation.depositAmountUSD,
      'USD'
    )}. Este monto NO se descuenta automáticamente, ajústelo en los métodos de pago.`;
    notes += depositNote;
  }

  setState({
    sale: {
      clientSearchTerm: '',
      stockSearchTerm: '',
      selectedClient: saleClient,
      items: [{ ...saleItem, salePrice: saleItem.suggestedSalePrice || 0 }],
      discount: 0,
      saleCosts: 0,
      salespersonId: null,
      commissionUSD: 0,
      notes: notes.trim(),
      reservationId: reservationId,
    },
  });

  document.getElementById('modal-container').innerHTML = '';

  switchTab('ventas');
  switchSubTab('ventas', 'nueva');
}

function getStockItemDataFromForm(formElement, formSuffix) {
  const attributes = {};
  const modelParts = [];

  formElement.querySelectorAll(`[id^="attr_"][id$="_${formSuffix}"]`).forEach((input) => {
    const attrName = input.dataset.attrName;
    if (attrName) {
      let value = input.type === 'checkbox' ? input.checked : input.value.trim();
      if (value !== '' && value !== null && value !== false) {
        attributes[attrName] = value;
        if (['Producto', 'Configuración', 'Especificación', 'Almacenamiento', 'RAM', 'Tipo'].includes(attrName)) {
          modelParts.push(value);
        }
      }
    }
  });

  const modelName = modelParts.length > 0 ? modelParts.join(' ') : 'Producto Personalizado';

  const stockItemData = {
    category: formElement.querySelector(`#stock-category-${formSuffix}, #edit-stock-category, #trade-in-category`).value,
    model: modelName,
    serialNumber: (formElement.querySelector(`#stock-serial-${formSuffix}, #edit-stock-serial, #trade-in-serial`)?.value || '').trim().toUpperCase(),
    phoneCost: parseFloat(formElement.querySelector(`#stock-cost-${formSuffix}, #edit-stock-cost, #trade-in-value`)?.value) || 0,
    suggestedSalePrice: parseFloat(formElement.querySelector(`#stock-price-${formSuffix}, #edit-stock-price, #trade-in-sug-price`)?.value) || 0,
    quantity: parseInt(formElement.querySelector(`#stock-quantity-${formSuffix}, #edit-stock-quantity`)?.value, 10) || 1,
    details: formElement.querySelector(`#stock-details-${formSuffix}, #edit-stock-details, #trade-in-details-input`)?.value.trim() || '',
    attributes: attributes,
    providerId: formElement.querySelector(`#stock-provider-${formSuffix}, #edit-stock-provider`)?.value || 'no-asignar',
  };

  if (stockItemData.providerId !== 'no-asignar' && stockItemData.providerId !== 'parte-de-pago') {
    const provider = appState.userProviders.find((p) => p.id === stockItemData.providerId);
    stockItemData.providerName = provider ? provider.name : '';
  } else {
    stockItemData.providerName = stockItemData.providerId === 'parte-de-pago' ? 'Parte de pago/Otro' : '';
  }

  return stockItemData;
}

async function saveStockItem(form, docId = null) {
  const isEditing = !!docId;
  const button = form.querySelector('button[type="submit"]');
  setGlobalLoading(true, button, isEditing ? 'Actualizando...' : 'Añadiendo...');

  try {
    const formSuffix = isEditing ? 'edit' : 'reg';
    const stockItemData = getStockItemDataFromForm(form, formSuffix);

    if (isEditing) {
      if (!docId) throw new Error('No se proporcionó un ID de documento para la actualización.');
      await updateData('stock', docId, stockItemData);
      await logCapitalState(`Edición de stock: ${stockItemData.model}`);
      document.getElementById('modal-container').innerHTML = '';
      showModal('Producto actualizado con éxito.');
    } else {
      stockItemData.createdAt = serverTimestamp();
      await addData('stock', stockItemData);
      await logCapitalState(`Nuevo stock: ${stockItemData.model}`);
      showModal('Producto añadido al stock con éxito.');
      form.reset();
      renderAddStockForm(appState);
    }
  } catch (error) {
    console.error('Error al guardar en stock:', error);
    showModal(`Error al guardar el producto: ${error.message}`);
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleAddClient(form) {
  const button = form.querySelector('button[type="submit"]');
  setGlobalLoading(true, button, 'Añadiendo...');
  try {
    const newClient = {
      name: form.querySelector('#client-name-reg').value.trim(),
      phone: form.querySelector('#client-phone-reg').value.trim(),
      details: form.querySelector('#client-details-reg').value.trim(),
      createdAt: serverTimestamp(),
    };
    await addData('clients', newClient);
    showModal('Cliente añadido con éxito.');
    form.reset();
    document.getElementById('add-client-form-container').classList.add('hidden');
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleAddFixedExpense(form) {
  const button = form.querySelector('button[type="submit"]');
  setGlobalLoading(true, button, 'Añadiendo...');
  try {
    const amount = parseFloat(form.querySelector('#fixed-expense-amount-reg').value) || 0;
    const currency = form.querySelector('#fixed-expense-currency-reg').value;

    const newExpense = {
      description: form.querySelector('#fixed-expense-description-reg').value.trim(),
      amount: amount,
      currency: currency,
      paymentDay: parseInt(form.querySelector('#fixed-expense-day-reg').value, 10),
      createdAt: serverTimestamp(),
    };
    await addData('fixed_expenses', newExpense);
    showModal('Gasto fijo añadido con éxito.');
    form.reset();
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleAddDebt(form) {
  const button = form.querySelector('button[type="submit"]');
  setGlobalLoading(true, button, 'Añadiendo...');
  try {
    const amount = parseFloat(form.querySelector('#debt-amount').value) || 0;
    const currency = form.querySelector('#debt-currency').value;
    const amountInUSD = currency === 'ARS' ? amount / appState.exchangeRate : amount;
    const newDebt = {
      debtorName: form.querySelector('#debtor-name').value.trim(),
      description: form.querySelector('#debt-desc').value.trim(),
      amount: amountInUSD,
      createdAt: serverTimestamp(),
      status: 'pendiente',
    };
    await addData('debts', newDebt);
    await logCapitalState(`Nueva deuda a ${newDebt.debtorName}`);
    showModal('Deuda a proveedor añadida con éxito.');
    form.reset();
    document.getElementById('add-debt-form-container').classList.add('hidden');
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleModalClient(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setGlobalLoading(true, button);
  try {
    const newClient = {
      name: form.querySelector('#client-name-modal').value.trim(),
      phone: form.querySelector('#client-phone-modal').value.trim(),
      details: form.querySelector('#client-details-modal').value.trim(),
      createdAt: serverTimestamp(),
    };
    const docRef = await addData('clients', newClient);
    setState({ sale: { selectedClient: { id: docRef.id, ...newClient }, clientSearchTerm: '' } });
    document.getElementById('modal-container').innerHTML = '';
    showModal('Cliente creado y seleccionado para la venta.');
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleModalStock(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setGlobalLoading(true, button);
  try {
    const attributes = {};
    form.querySelectorAll('[id^="attr_"]').forEach((input) => {
      const attrName = input.dataset.attrName;
      let value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else {
        value = input.value.trim();
      }
      if (value !== '' && value !== null) {
        attributes[attrName] = value;
      }
    });
    const newStockItemData = {
      category: form.querySelector('#stock-category-modal').value,
      model: form.querySelector('#stock-model-modal').value.trim(),
      serialNumber: form.querySelector('#stock-serial-modal').value.trim().toUpperCase(),
      phoneCost: parseFloat(form.querySelector('#stock-cost-modal').value) || 0,
      suggestedSalePrice: parseFloat(form.querySelector('#stock-price-modal').value) || 0,
      quantity: parseInt(form.querySelector('#stock-quantity-modal').value, 10) || 1,
      details: form.querySelector('#stock-details-modal').value.trim(),
      attributes: attributes,
      createdAt: serverTimestamp(),
    };
    const docRef = await addData('stock', newStockItemData);
    await logCapitalState(`Nuevo stock (desde venta): ${newStockItemData.model}`);
    const currentItems = appState.sale.items || [];
    const { createdAt, ...rest } = newStockItemData;
    const newItemForSale = {
      id: docRef.id,
      ...rest,
      salePrice: newStockItemData.suggestedSalePrice || 0,
    };

    setState({
      sale: {
        items: [...currentItems, newItemForSale],
        stockSearchTerm: '',
      },
    });
    document.getElementById('modal-container').innerHTML = '';
    showModal('Producto añadido al stock y a la venta actual.');
  } catch (error) {
    console.error('Error al añadir stock desde modal:', error);
    showModal(`Error: ${error.message}`);
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleSaveBusinessName() {
  const display = document.getElementById('business-name-display');
  const input = document.getElementById('business-name-input');

  if (display && input) {
    const newName = input.value.trim();
    if (newName) {
      await setData('profile', 'main', { businessName: newName }, true);
      display.textContent = newName;
    }
    input.classList.add('hidden');
    display.classList.remove('hidden');
  }
}

async function handleSaveExchangeRate() {
  const input = document.getElementById('exchange-rate-input');
  if (input) {
    const newRate = parseFloat(input.value);
    if (newRate && newRate > 0) {
      await setData('profile', 'main', { exchangeRate: newRate }, true);
      setState({ exchangeRate: newRate });
    }
  }
}

async function handleChangePassword(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setGlobalLoading(true, button);
  try {
    const currentPassword = form.querySelector('#current-password').value;
    const newPassword = form.querySelector('#new-password').value;
    const confirmPassword = form.querySelector('#confirm-password').value;
    if (newPassword.length < 6) {
      showModal('La nueva contraseña debe tener al menos 6 caracteres.', 'Error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showModal('Las nuevas contraseñas no coinciden.', 'Error');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      showModal('No se ha podido identificar al usuario.', 'Error');
      return;
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Tu contraseña ha sido actualizada con éxito.', 'Éxito');
  } catch (error) {
    let friendlyMessage = 'Ocurrió un error. Inténtalo de nuevo.';
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      friendlyMessage = 'La contraseña actual es incorrecta.';
    }
    showModal(friendlyMessage, 'Error de Autenticación');
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleSaveSale() {
  const form = document.getElementById('sale-form');
  const button = form.querySelector('button[type="submit"]');
  setGlobalLoading(true, button, 'Finalizando...');
  try {
    const { sale, exchangeRate, stock, salespeople } = appState;
    const { reservationId } = sale;

    if (!sale.selectedClient || !sale.items || sale.items.length === 0) {
      throw new Error('Debes seleccionar un cliente y al menos un producto.');
    }
    const totalSalePrice =
      (sale.items || []).reduce((sum, item) => sum + (item.salePrice || 0), 0) -
      (sale.discount || 0);
    let totalPaid = 0;
    document.querySelectorAll('.payment-input').forEach((input) => {
      const value = parseFloat(input.value) || 0;
      totalPaid +=
        input.dataset.payment === 'ars' || input.dataset.payment === 'mp'
          ? value / exchangeRate
          : value;
    });
    const tradeInValue = parseFloat(document.getElementById('trade-in-value')?.value) || 0;
    totalPaid += tradeInValue;

    if (Math.abs(totalSalePrice - totalPaid) > 0.01) {
      throw new Error('El balance debe ser cero para finalizar la venta. Ajusta los montos de pago.');
    }

    const salespersonId = document.getElementById('salesperson-selector').value;
    const commissionUSD = parseFloat(document.getElementById('commission-amount').value) || 0;
    let salespersonName = null;
    if (salespersonId) {
      const salesperson = salespeople.find((p) => p.id === salespersonId);
      if (salesperson) {
        salespersonName = salesperson.name;
      }
    }

    await runBatch(async (batch, db, userId) => {
      const paymentBreakdownOriginal = {};
      const paymentBreakdownUSD = {};
      let clientDebtAmount = 0;
      document.querySelectorAll('.payment-input').forEach((input) => {
        const value = parseFloat(input.value) || 0;
        if (value > 0) {
          const type = input.dataset.payment;
          paymentBreakdownOriginal[type] = value;
          const isArs = type === 'ars' || type === 'mp';
          const valueInUSD = isArs ? value / exchangeRate : value;
          paymentBreakdownUSD[isArs ? type + '_in_usd' : type] = valueInUSD;
          if (type === 'clientDebt') clientDebtAmount = valueInUSD;
        }
      });
      const saleData = {
        clientId: sale.selectedClient.id,
        customerName: sale.selectedClient.name,
        items: sale.items,
        subtotal: sale.items.reduce((sum, item) => sum + (item.salePrice || 0), 0),
        discount: sale.discount,
        total: totalSalePrice,
        paymentBreakdownUSD,
        paymentBreakdownOriginal,
        saleDate: document.getElementById('sale-date').value,
        warrantyDays: parseInt(document.getElementById('warranty-days').value, 10) || 0,
        notes: document.getElementById('notes').value.trim(),
        saleCosts: sale.saleCosts || 0,
        soldAt: serverTimestamp(),
        tradeInValueUSD: 0,
        tradeIn: null,
        salespersonId: salespersonId || null,
        salespersonName: salespersonName,
        commissionUSD: commissionUSD,
        exchangeRateAtSale: exchangeRate,
      };
      
      sale.items.forEach((item) => {
        const stockItemRef = doc(db, `users/${userId}/stock`, item.id);
        const originalStockItem = stock.find((s) => s.id === item.id);
        const currentQuantity = originalStockItem ? originalStockItem.quantity || 1 : 1;

        if (currentQuantity > 1) {
          batch.update(stockItemRef, { 
            quantity: currentQuantity - 1,
            status: 'disponible'
          });
        } else {
          batch.delete(stockItemRef);
        }
      });

      if (document.getElementById('has-trade-in').checked && tradeInValue > 0) {
        const tradeInContainer = document.getElementById('trade-in-details');
        if (tradeInContainer) {
            const tradeInItem = getStockItemDataFromForm(tradeInContainer, 'tradein');
            tradeInItem.createdAt = serverTimestamp();
            tradeInItem.providerId = 'parte-de-pago';
            tradeInItem.providerName = 'Parte de pago/Otro';

            saleData.tradeIn = { ...tradeInItem };
            saleData.tradeInValueUSD = tradeInItem.phoneCost;
            batch.set(doc(collection(db, `users/${userId}/stock`)), tradeInItem);
        }
      }

      batch.set(doc(collection(db, `users/${userId}/sales`)), saleData);

      if (reservationId) {
        const reservationRef = doc(db, `users/${userId}/reservations`, reservationId);
        batch.delete(reservationRef);
      }

      const capitalUpdates = {};
      Object.entries(paymentBreakdownOriginal).forEach(([key, value]) => {
        if (key !== 'clientDebt') {
          capitalUpdates[key] = (appState.capital[key] || 0) + value;
        }
      });
      if (clientDebtAmount > 0)
        capitalUpdates.clientDebt = (appState.capital.clientDebt || 0) + clientDebtAmount;
      batch.set(doc(db, `users/${userId}/capital`, 'summary'), capitalUpdates, { merge: true });
    });
    await logCapitalState(`Venta a ${sale.selectedClient.name}`);

    form.reset();
    const tradeInCheckbox = document.getElementById('has-trade-in');
    if (tradeInCheckbox) {
      tradeInCheckbox.checked = false;
    }
    toggleTradeInDetails();
    setState({
      sale: {
        clientSearchTerm: '',
        stockSearchTerm: '',
        selectedClient: null,
        items: [],
        discount: 0,
        saleCosts: 0,
        salespersonId: null,
        commissionUSD: 0,
        reservationId: null,
      },
    });
    showModal('¡Venta registrada con éxito!');
  } catch (error) {
    console.error('Error detallado al procesar venta:', error);
    showModal(`Error al procesar la venta: ${error.message}`);
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleEditClient(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setGlobalLoading(true, button);
  try {
    const clientId = form.dataset.id;
    const updatedData = {
      name: form.querySelector('#edit-client-name').value.trim(),
      phone: form.querySelector('#edit-client-phone').value.trim(),
      details: form.querySelector('#edit-client-details').value.trim(),
    };
    await updateData('clients', clientId, updatedData);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Cliente actualizado con éxito.');
  } catch (error) {
    showModal(`Error al actualizar el cliente: ${error.message}`);
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleEditDebt(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setGlobalLoading(true, button);
  try {
    const debtId = form.dataset.id;
    const amount = parseFloat(form.querySelector('#edit-debt-amount').value) || 0;
    const currency = form.querySelector('#edit-debt-currency').value;
    const amountInUSD = currency === 'ARS' ? amount / appState.exchangeRate : amount;
    const updatedData = {
      debtorName: form.querySelector('#edit-debtor-name').value.trim(),
      description: form.querySelector('#edit-debt-desc').value.trim(),
      amount: amountInUSD,
    };
    await updateData('debts', debtId, updatedData);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Deuda actualizada con éxito.');
  } catch (error) {
    showModal(`Error al actualizar la deuda: ${error.message}`);
  } finally {
    setGlobalLoading(false, button);
  }
}

async function handleEditFixedExpense(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setGlobalLoading(true, button);
  try {
    const expenseId = form.dataset.id;
    const amount = parseFloat(form.querySelector('#edit-fixed-expense-amount').value) || 0;
    const currency = form.querySelector('#edit-fixed-expense-currency').value;

    const updatedData = {
      description: form.querySelector('#edit-fixed-expense-description').value.trim(),
      amount: amount,
      currency: currency,
      paymentDay: parseInt(form.querySelector('#edit-fixed-expense-day').value, 10),
    };
    await updateData('fixed_expenses', expenseId, updatedData);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Gasto fijo actualizado con éxito.');
  } catch (error) {
    showModal(`Error al actualizar el gasto: ${error.message}`);
  } finally {
    setGlobalLoading(false, button);
  }
}

// =================================================================================
// EVENT LISTENERS PRINCIPAL
// =================================================================================

export function setupEventListeners() {
  document.body.addEventListener('submit', async (e) => {
    const form = e.target;
    if (
      form.closest('.modal-content') ||
      [
        'login-form',
        'register-form',
        'sale-form',
        'stock-form-register',
        'client-form-register',
        'fixed-expense-form-register',
        'daily-expense-form-register',
        'debt-form',
        'add-attribute-form',
        'payment-form-modal',
        'edit-attribute-form',
        'reservation-form',
        'edit-product-options-form',
        'add-dependent-attribute-form',
      ].includes(form.id)
    ) {
      e.preventDefault();
    } else {
      return;
    }

    try {
      switch (form.id) {
        case 'login-form':
        case 'register-form': {
          const email = form.querySelector('input[type="email"]').value;
          const password = form.querySelector('input[type="password"]').value;
          const button = form.querySelector('button[type="submit"]');
          setGlobalLoading(true, button, 'Ingresando...');
          try {
            if (form.id === 'login-form') await handleLogin(email, password);
            else await handleRegistration(email, password);
          } catch (err) {
            // El error ya se muestra en un modal, no es necesario hacer nada aquí.
          } finally {
            setGlobalLoading(false, button);
          }
          break;
        }
        case 'payment-form-modal':
          await handleProcessPayment(form);
          break;
        case 'sale-form':
          await handleSaveSale();
          break;
        case 'password-change-form':
          await handleChangePassword(form);
          break;
        case 'stock-form-register':
          await saveStockItem(form);
          break;
        case 'client-form-register':
          await handleAddClient(form);
          break;
        case 'fixed-expense-form-register':
          await handleAddFixedExpense(form);
          break;
        case 'daily-expense-form-register':
          handleAddDailyExpense(form);
          break;
        case 'debt-form':
          await handleAddDebt(form);
          break;
        case 'client-form-modal':
          await handleModalClient(form);
          break;
        case 'stock-form-modal':
          await handleModalStock(form);
          break;
        case 'adjust-capital-form': {
          const reasonInput = form.querySelector('#adjust-capital-reason');
          const reason = reasonInput.value.trim();
          if (!reason) {
            showModal('Debes especificar un motivo para el ajuste de capital.', 'Error');
            reasonInput.focus();
            return;
          }
          await handleAdjustCapital(form, reason);
          break;
        }
        case 'note-form': {
          const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
          setGlobalLoading(true, button);
          try {
            const noteData = {
              title: form.querySelector('#note-title').value.trim(),
              content: form.querySelector('#note-content').value.trim(),
              updatedAt: serverTimestamp(),
            };
            const noteId = form.dataset.id;
            if (noteId) {
              await updateData('notes', noteId, noteData);
            } else {
              noteData.createdAt = serverTimestamp();
              await addData('notes', noteData);
            }
            document.getElementById('modal-container').innerHTML = '';
            showModal('Nota guardada con éxito.');
          } catch (err) {
            showModal(`Error al guardar la nota: ${err.message}`);
          } finally {
            setGlobalLoading(false, button);
          }
          break;
        }
        case 'edit-stock-form':
          await saveStockItem(form, form.dataset.id);
          break;
        case 'edit-client-form':
          await handleEditClient(form);
          break;
        case 'edit-debt-form':
          await handleEditDebt(form);
          break;
        case 'edit-fixed-expense-form':
          await handleEditFixedExpense(form);
          break;
        case 'add-attribute-form': {
          const { selectedCategoryId } = appState.categoryManager;
          const category = appState.categories.find((c) => c.id === selectedCategoryId);
          if (!category) return;

          const name = form.querySelector('#new-attribute-name').value.trim();
          const type = form.querySelector('#new-attribute-type').value;
          const options = form
            .querySelector('#new-attribute-options')
            .value.split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const newAttribute = { id: `attr-${Date.now()}`, name, type };
          if (type === 'select' && options.length > 0) {
            newAttribute.options = options;
          }

          const updatedAttributes = [...(category.attributes || []), newAttribute];
          await updateData('categories', category.id, { attributes: updatedAttributes });
          form.reset();
          break;
        }
        case 'edit-attribute-form': {
          const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
          setGlobalLoading(true, button);
          try {
            const { categoryId, attrId } = form.dataset;
            const category = appState.categories.find((c) => c.id === categoryId);
            if (!category) throw new Error('Categoría no encontrada');
            const updatedAttributes = category.attributes.map((attr) => {
              if (attr.id === attrId) {
                const newName = form.querySelector('#edit-attribute-name').value.trim();
                const newType = form.querySelector('#edit-attribute-type').value;
                const newOptions = form
                  .querySelector('#edit-attribute-options')
                  .value.split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);

                const updatedAttr = { ...attr, name: newName, type: newType };
                if (newType === 'select') {
                  updatedAttr.options = newOptions;
                } else {
                  delete updatedAttr.options;
                }
                return updatedAttr;
              }
              return attr;
            });
            await updateData('categories', categoryId, { attributes: updatedAttributes });
            document.getElementById('modal-container').innerHTML = '';
            showModal('Atributo actualizado con éxito.');
          } catch (err) {
            showModal(`Error al actualizar el atributo: ${err.message}`);
          } finally {
            setGlobalLoading(false, button);
          }
          break;
        }
        case 'salesperson-form-modal': {
          const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
          setGlobalLoading(true, button);
          try {
            const salespersonData = {
              name: form.querySelector('#salesperson-name-modal').value.trim(),
              contact: form.querySelector('#salesperson-contact-modal').value.trim(),
              createdAt: serverTimestamp(),
            };
            await addData('salespeople', salespersonData);
            document.getElementById('modal-container').innerHTML = '';
            showModal('Vendedor añadido con éxito.');
          } catch (err) {
            showModal(`Error al guardar el vendedor: ${err.message}`);
          } finally {
            setGlobalLoading(false, button);
          }
          break;
        }
        case 'edit-salesperson-form-modal': {
          const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
          setGlobalLoading(true, button);
          try {
            const salespersonId = form.dataset.id;
            const updatedData = {
              name: form.querySelector('#edit-salesperson-name-modal').value.trim(),
              contact: form.querySelector('#edit-salesperson-contact-modal').value.trim(),
            };
            await updateData('salespeople', salespersonId, updatedData);
            document.getElementById('modal-container').innerHTML = '';
            showModal('Vendedor actualizado con éxito.');
          } catch (err) {
            showModal(`Error al actualizar el vendedor: ${err.message}`);
          } finally {
            setGlobalLoading(false, button);
          }
          break;
        }
        case 'provider-form-modal': {
          const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
          setGlobalLoading(true, button);
          try {
            const providerData = {
              name: form.querySelector('#provider-name-modal').value.trim(),
              contact: form.querySelector('#provider-contact-modal').value.trim(),
              notes: form.querySelector('#provider-notes-modal').value.trim(),
              createdAt: serverTimestamp(),
            };
            await addData('userProviders', providerData);
            document.getElementById('modal-container').innerHTML = '';
            showModal('Proveedor añadido con éxito.');
          } catch (err) {
            showModal(`Error al guardar el proveedor: ${err.message}`);
          } finally {
            setGlobalLoading(false, button);
          }
          break;
        }
        case 'edit-provider-form-modal': {
          const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
          setGlobalLoading(true, button);
          try {
            const providerId = form.dataset.id;
            const updatedData = {
              name: form.querySelector('#edit-provider-name-modal').value.trim(),
              contact: form.querySelector('#edit-provider-contact-modal').value.trim(),
              notes: form.querySelector('#edit-provider-notes-modal').value.trim(),
            };
            await updateData('userProviders', providerId, updatedData);
            document.getElementById('modal-container').innerHTML = '';
            showModal('Proveedor actualizado con éxito.');
          } catch (err) {
            showModal(`Error al actualizar el proveedor: ${err.message}`);
          } finally {
            setGlobalLoading(false, button);
          }
          break;
        }
        case 'reservation-form': {
            const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
            setGlobalLoading(true, button, 'Guardando...');
            try {
                const { reservationForm, exchangeRate, capital } = appState;
                if (!reservationForm.selectedClient || !reservationForm.selectedItem) {
                    throw new Error('Debes seleccionar un cliente y un producto.');
                }

                const paymentInputs = form.querySelectorAll('.payment-input-reservation');
                const paymentBreakdownOriginal = {};
                let totalDepositUSD = 0;

                paymentInputs.forEach(input => {
                    const value = parseFloat(input.value) || 0;
                    if (value > 0) {
                        const walletType = input.dataset.payment;
                        paymentBreakdownOriginal[walletType] = value;
                        const isArs = walletType === 'ars' || walletType === 'mp';
                        totalDepositUSD += isArs ? value / exchangeRate : value;
                    }
                });

                const hasDeposit = totalDepositUSD > 0;

                const reservationData = {
                    clientId: reservationForm.selectedClient.id,
                    customerName: reservationForm.selectedClient.name,
                    itemId: reservationForm.selectedItem.id,
                    item: reservationForm.selectedItem,
                    hasDeposit,
                    depositAmountUSD: totalDepositUSD,
                    depositPaymentBreakdown: paymentBreakdownOriginal,
                    notes: form.querySelector('#reservation-notes').value.trim(),
                    createdAt: serverTimestamp(),
                    status: 'active',
                };

                await runBatch(async (batch, db, userId) => {
                    const reservationRef = doc(collection(db, `users/${userId}/reservations`));
                    batch.set(reservationRef, reservationData);

                    const stockItemRef = doc(db, `users/${userId}/stock`, reservationForm.selectedItem.id);
                    batch.update(stockItemRef, { status: 'reservado' });

                    if (hasDeposit) {
                        const capitalRef = doc(db, `users/${userId}/capital`, 'summary');
                        const capitalUpdates = {};
                        for (const walletType in paymentBreakdownOriginal) {
                            const paymentValue = paymentBreakdownOriginal[walletType];
                            capitalUpdates[walletType] = (capital[walletType] || 0) + paymentValue;
                        }
                        batch.update(capitalRef, capitalUpdates);
                    }
                });

                await logCapitalState(`Reserva creada para ${reservationForm.selectedClient.name}`);
                document.getElementById('modal-container').innerHTML = '';
                showModal('Reserva creada con éxito.');

            } catch (error) {
                showModal(`Error al guardar la reserva: ${error.message}`, 'Error');
            } finally {
                setGlobalLoading(false, button);
            }
            break;
        }
        case 'edit-product-options-form': {
            const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
            setGlobalLoading(true, button);
            try {
                const { categoryId, productAttributeId, productName } = form.dataset;
                const category = appState.categories.find(c => c.id === categoryId);
                if (!category) throw new Error('Categoría no encontrada.');

                const updatedAttributes = JSON.parse(JSON.stringify(category.attributes));

                form.querySelectorAll('.dependent-attribute-editor').forEach(editor => {
                    const dependentAttrId = editor.dataset.attrId;
                    const newOptions = Array.from(editor.querySelectorAll('.attribute-option-item'))
                                            .map(item => item.dataset.optionValue)
                                            .filter(Boolean);

                    const attributeToUpdate = updatedAttributes.find(attr => attr.id === dependentAttrId);
                    if (attributeToUpdate && typeof attributeToUpdate.options === 'object') {
                        attributeToUpdate.options[productName] = newOptions;
                    }
                });

                await updateData('categories', categoryId, { attributes: updatedAttributes });
                document.getElementById('modal-container').innerHTML = '';
                showModal(`Opciones para "${productName}" actualizadas con éxito.`);
            } catch (err) {
                showModal(`Error al guardar las opciones: ${err.message}`);
            } finally {
                setGlobalLoading(false, button);
            }
            break;
        }
        case 'add-dependent-attribute-form': {
            const { categoryId, productAttributeId, productName } = form.dataset;
            const category = appState.categories.find(c => c.id === categoryId);
            if (!category) return;

            const name = form.querySelector('#new-dependent-attr-name').value.trim();
            if (!name) {
                showModal('El nombre del atributo no puede estar vacío.', 'Error');
                return;
            }

            const newAttribute = {
                id: `attr-${Date.now()}`,
                name: name,
                type: 'select',
                dependsOn: productAttributeId,
                options: { [productName]: [] }
            };

            const updatedAttributes = [...category.attributes, newAttribute];
            await updateData('categories', categoryId, { attributes: updatedAttributes });
            openEditProductOptionsModal(categoryId, productName);
            break;
        }
      }
    } catch (err) {
      console.error(`Error en el manejador de submit para el form #${form.id}:`, err);
    }
  });

  document.body.addEventListener('click', async (e) => {
    const target = e.target;

    const loadMoreButton = target.closest('.load-more-btn');
    if (loadMoreButton) {
        const listKey = loadMoreButton.dataset.listKey;
        if (listKey && appState.ui.pages[listKey]) {
            const currentPage = appState.ui.pages[listKey];
            setState({
                ui: {
                    pages: {
                        ...appState.ui.pages,
                        [listKey]: currentPage + 1,
                    },
                },
            });
        }
        return;
    }

    if (target.closest('.delete-attribute-option-btn')) {
        const button = target.closest('.delete-attribute-option-btn');
        const { categoryId, productName, attrId, optionValue } = button.dataset;
        const category = appState.categories.find(c => c.id === categoryId);
        if (!category) return;

        const updatedAttributes = JSON.parse(JSON.stringify(category.attributes));
        const attributeToUpdate = updatedAttributes.find(attr => attr.id === attrId);

        if (attributeToUpdate && typeof attributeToUpdate.options === 'object' && attributeToUpdate.options[productName]) {
            attributeToUpdate.options[productName] = attributeToUpdate.options[productName].filter(opt => opt !== optionValue);
            await updateData('categories', categoryId, { attributes: updatedAttributes });
            openEditProductOptionsModal(categoryId, productName);
        }
        return;
    }

    if (target.closest('.delete-dependent-attribute-btn')) {
        const button = target.closest('.delete-dependent-attribute-btn');
        const { categoryId, productName, attrIdToDelete } = button.dataset;
        const category = appState.categories.find(c => c.id === categoryId);
        if (!category) return;

        openConfirmModal(`¿Seguro que quieres eliminar este atributo y todas sus opciones para este producto?`, async () => {
            const updatedAttributes = category.attributes.filter(attr => attr.id !== attrIdToDelete);
            await updateData('categories', categoryId, { attributes: updatedAttributes });
            openEditProductOptionsModal(categoryId, productName);
        });
        return;
    }
    
    if (target.closest('.add-attribute-option-btn')) {
        const button = target.closest('.add-attribute-option-btn');
        const { categoryId, productName, attrId } = button.dataset;
        const input = button.previousElementSibling;
        const newOptionValue = input.value.trim();

        if (newOptionValue) {
            const category = appState.categories.find(c => c.id === categoryId);
            if (!category) return;

            const updatedAttributes = JSON.parse(JSON.stringify(category.attributes));
            const attributeToUpdate = updatedAttributes.find(attr => attr.id === attrId);

            if (attributeToUpdate && typeof attributeToUpdate.options === 'object') {
                if (!attributeToUpdate.options[productName]) {
                    attributeToUpdate.options[productName] = [];
                }
                if (!attributeToUpdate.options[productName].includes(newOptionValue)) {
                    attributeToUpdate.options[productName].push(newOptionValue);
                    await updateData('categories', categoryId, { attributes: updatedAttributes });
                    openEditProductOptionsModal(categoryId, productName);
                } else {
                    input.value = '';
                }
            }
        }
        return;
    }

    const element = target.closest(
      'button, a, div[data-client], div[data-stock], div[data-category-id], i#edit-business-name-icon, .product-search-result'
    );

    if (element && element.classList.contains('product-search-result')) {
      const category = element.dataset.category;
      const product = element.dataset.product;

      const allCategories = [...(appState.categories || []), ...DEFAULT_CATEGORIES];
      const selectedCategoryObj = allCategories.find((c) => c.name === category);

      const productAttribute = selectedCategoryObj?.attributes.find(
        (attr) => attr.id === 'model' || attr.id === 'product'
      );

      const autofillData = {
        category: category,
      };

      if (productAttribute) {
        autofillData[productAttribute.id] = product;
      }

      setState({
        addStockForm: {
          productSearchTerm: '',
          autofillData: autofillData,
        },
      });

      const searchResults = document.getElementById('product-search-results-reg');
      if (searchResults) searchResults.classList.add('hidden');

      return;
    }

    if (target.closest('.toggle-payment-history')) {
      const historyContainer = target
        .closest('.debt-card-container')
        .querySelector('.payment-history-details');
      const icon = target.closest('.toggle-payment-history').querySelector('i');
      if (historyContainer) {
        historyContainer.classList.toggle('hidden');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
      }
      return;
    }

    if (target.closest('[data-action="open-details"]')) {
      const saleId = target.closest('.sale-card')?.dataset.saleId;
      const sale = appState.sales?.find((s) => s.id === saleId);
      if (sale) showSaleDetailModal(sale);
      return;
    }
    if (target.closest('.client-result-item')) {
      setState({
        sale: {
          selectedClient: JSON.parse(target.closest('.client-result-item').dataset.client),
          clientSearchTerm: '',
        },
      });
      return;
    }
    if (target.closest('.stock-result-item')) {
      const currentItems = appState.sale.items || [];
      const newItem = JSON.parse(target.closest('.stock-result-item').dataset.stock);
      setState({
        sale: {
          items: [...currentItems, { ...newItem, salePrice: newItem.suggestedSalePrice || 0 }],
          stockSearchTerm: '',
        },
      });
      return;
    }

    if (target.closest('.reservation-client-result')) {
      const client = JSON.parse(target.closest('.reservation-client-result').dataset.client);
      setState({
        reservationForm: { ...appState.reservationForm, selectedClient: client, clientSearchTerm: '' },
      });
      openReservationModal(appState);
      return;
    }
    if (target.closest('.reservation-stock-result')) {
      const item = JSON.parse(target.closest('.reservation-stock-result').dataset.stock);
      setState({
        reservationForm: { ...appState.reservationForm, selectedItem: item, stockSearchTerm: '' },
      });
      openReservationModal(appState);
      return;
    }
    if (target.id === 'remove-reservation-client-btn') {
      setState({ reservationForm: { ...appState.reservationForm, selectedClient: null } });
      openReservationModal(appState);
      return;
    }
    if (target.id === 'remove-reservation-item-btn') {
      setState({ reservationForm: { ...appState.reservationForm, selectedItem: null } });
      openReservationModal(appState);
      return;
    }

    if (!element) {
      if (!target.closest('#user-menu-button') && !target.closest('#user-menu-dropdown')) {
        document.getElementById('user-menu-dropdown')?.classList.add('hidden');
      }
      if (
        !target.closest('#client-search-input-sale') &&
        !target.closest('#client-search-results')
      ) {
        document.getElementById('client-search-results')?.classList.add('hidden');
      }
      if (
        !target.closest('#stock-search-input-sale') &&
        !target.closest('#stock-search-results-sale')
      ) {
        document.getElementById('stock-search-results-sale')?.classList.add('hidden');
      }
      if (
        !target.closest('#product-search-reg') &&
        !target.closest('#product-search-results-reg')
      ) {
        const searchResults = document.getElementById('product-search-results-reg');
        if (searchResults) searchResults.classList.add('hidden');
      }
      if (
        !target.closest('#reservation-client-search-input') &&
        !target.closest('#reservation-client-search-results')
      ) {
        const results = document.getElementById('reservation-client-search-results');
        if (results) results.classList.add('hidden');
      }
      if (
        !target.closest('#reservation-stock-search-input') &&
        !target.closest('#reservation-stock-search-results')
      ) {
        const results = document.getElementById('reservation-stock-search-results');
        if (results) results.classList.add('hidden');
      }
      return;
    }

    if (element.id === 'user-menu-button') {
      document.getElementById('user-menu-dropdown')?.classList.toggle('hidden');
      return;
    }

    const { dataset } = element;
    const actionMap = {
      'show-register': () => {
        document.getElementById('login-form')?.classList.add('hidden');
        document.getElementById('register-form')?.classList.remove('hidden');
        document.getElementById('show-register')?.classList.add('hidden');
        document.getElementById('show-login')?.classList.remove('hidden');
      },
      'show-login': () => {
        document.getElementById('login-form')?.classList.remove('hidden');
        document.getElementById('register-form')?.classList.add('hidden');
        document.getElementById('show-register')?.classList.remove('hidden');
        document.getElementById('show-login')?.classList.add('hidden');
      },
      'logout-from-trial-screen': () => signOut(auth),
      'change-password-btn': () => openChangePasswordModal(),
      'logout-button': () => signOut(auth),
      'manage-subscription-btn': () => {
        showModal(
          `Para gestionar tu suscripción (cambiar método de pago, cancelar, etc.), por favor sigue estos pasos:<br><br>
          1. Ingresa a tu cuenta de <b>Mercado Pago</b>.<br>
          2. Ve a la sección "<b>Suscripciones</b>".<br>
          3. Busca la suscripción de <b>iFlow</b> y selecciona "<b>Cancelar suscripción</b>".`,
          'Gestionar Suscripción'
        );
      },
      'edit-business-name-icon': () => {
        const display = document.getElementById('business-name-display');
        const input = document.getElementById('business-name-input');
        if (display && input) {
          display.classList.add('hidden');
          input.classList.remove('hidden');
          input.value = display.textContent.trim();
          input.focus();
        }
      },
      'start-trial-btn': () => handleStartSubscriptionFlow(),
      'subscribe-now-btn': () => handleStartSubscriptionFlow(),
      'cancel-validation-btn': () =>
        setData('profile', 'main', { subscriptionStatus: 'pending_trial_setup' }, true),
      'logout-from-subscription-modal': () => {
        document.getElementById('modal-container').innerHTML = '';
        signOut(auth);
      },
      'confirm-gumroad-redirect': async (button) => {
        const user = appState.user;
        if (!user) return;

        const gumroadLink = `https://pacomatic.gumroad.com/l/scnaca?user_id=${user.uid}&email=${user.email}`;
        const paymentWindow = window.open(gumroadLink, '_blank');
        if (!paymentWindow) {
          showModal(
            'Tu navegador ha bloqueado la ventana de pago. Por favor, deshabilita el bloqueador de pop-ups para este sitio e inténtalo de nuevo.'
          );
          return;
        }

        document.getElementById('modal-container').innerHTML = '';
        setGlobalLoading(true, button, 'Redirigiendo...');
        await setData('profile', 'main', { subscriptionStatus: 'pending_payment_validation' }, true);
        setGlobalLoading(false, button);
      },
      'toggle-sale-form-btn': () =>
        document.getElementById('add-sale-form-container')?.classList.toggle('hidden'),
      'toggle-stock-form-btn': () =>
        setState({ addStockForm: { isFormVisible: !appState.addStockForm.isFormVisible } }),
      'toggle-client-form-btn': () =>
        document.getElementById('add-client-form-container')?.classList.toggle('hidden'),
      'toggle-debt-form-btn': () =>
        document.getElementById('add-debt-form-container')?.classList.toggle('hidden'),
      'adjust-capital-btn': () => openAdjustCapitalModal(appState),
      'add-client-from-sale-btn': () => openAddClientModal(),
      'remove-selected-client-btn': () =>
        setState({ sale: { selectedClient: null, clientSearchTerm: '' } }),
      'dashboard-apply-custom-filter-btn': () => {
        const startDate = document.getElementById('dashboard-custom-start-date').value;
        const endDate = document.getElementById('dashboard-custom-end-date').value;
        setState({
          ui: {
            dashboard: { dashboardCustomStartDate: startDate, dashboardCustomEndDate: endDate },
          },
        });
      },
      'capital-apply-custom-filter-btn': () => {
        const startDate = document.getElementById('capital-custom-start-date').value;
        const endDate = document.getElementById('capital-custom-end-date').value;
        setState({
          ui: {
            capital: { capitalCustomStartDate: startDate, capitalCustomEndDate: endDate },
          },
        });
      },
      'analysis-apply-custom-filter-btn': () => {
        const startDate = document.getElementById('analysis-custom-start-date').value;
        const endDate = document.getElementById('analysis-custom-end-date').value;
        setState({
          ui: { analysis: { analysisCustomStartDate: startDate, analysisCustomEndDate: endDate } },
        });
      },
      'add-note-btn': () => openNoteModal(),
      'add-new-category-btn': async () => {
        const name = prompt('Nombre de la nueva categoría:');
        if (name && name.trim()) {
          const newId = name.trim().toLowerCase().replace(/\s+/g, '-');
          const mainProductAttrName = prompt('¿Cómo se llama el atributo principal de esta categoría? (Ej: Producto, Modelo, Título)');
          if (!mainProductAttrName || !mainProductAttrName.trim()) {
              showModal('Se requiere un nombre para el atributo principal.', 'Error');
              return;
          }
          const newCategoryData = {
            name: name.trim(),
            attributes: [
              {
                id: `attr-product-${Date.now()}`,
                name: mainProductAttrName.trim(),
                type: 'select',
                options: [],
                required: true,
              },
            ],
          };
          await setData('categories', newId, newCategoryData);
        }
      },
      'edit-category-name-btn': () => setState({ categoryManager: { isEditingCategoryName: true } }),
      'save-category-name-btn': async () => {
        const { selectedCategoryId } = appState.categoryManager;
        const newName = document.getElementById('edit-category-name-input')?.value.trim();
        if (newName && selectedCategoryId) {
          await updateData('categories', selectedCategoryId, { name: newName });
          setState({ categoryManager: { isEditingCategoryName: false } });
        }
      },
      'delete-category-btn': () => {
        const { selectedCategoryId } = appState.categoryManager;
        const category = appState.categories.find((c) => c.id === selectedCategoryId);
        if (!category) return;

        const isCategoryInUse = appState.stock.some((item) => item.category === category.name);
        if (isCategoryInUse) {
          return showModal(
            `No se puede eliminar la categoría "${category.name}" porque está siendo utilizada por productos en el stock.`
          );
        }

        openConfirmModal(
          `¿Seguro que quieres eliminar la categoría "${category.name}"?`,
          async () => {
            await deleteFromDb('categories', selectedCategoryId);
            setState({ categoryManager: { selectedCategoryId: null } });
          }
        );
      },
      'add-reservation-btn': () => {
        setState({
          reservationForm: {
            clientSearchTerm: '',
            stockSearchTerm: '',
            selectedClient: null,
            selectedItem: null,
          },
        });
        openReservationModal(appState);
      },
      'add-salesperson-btn': () => openAddSalespersonModal(),
      'add-provider-btn': () => openAddProviderModal(),
      'back-to-salespeople-list': () => setState({ ui: { ...appState.ui, selectedSalespersonId: null } }),
      'add-new-product-to-category-btn': async () => {
        const { selectedCategoryId } = appState.categoryManager;
        const category = appState.categories.find(c => c.id === selectedCategoryId);
        if (!category) return;

        const newProductName = prompt(`Añadir nuevo producto a la categoría "${category.name}":`);
        if (newProductName && newProductName.trim()) {
            const productAttribute = category.attributes.find(attr => attr.id.startsWith('attr-product-') || attr.name === 'Producto');
            if (productAttribute && Array.isArray(productAttribute.options)) {
                const updatedOptions = [newProductName.trim(), ...productAttribute.options];
                const updatedAttributes = category.attributes.map(attr =>
                    attr.id === productAttribute.id ? { ...attr, options: updatedOptions } : attr
                );
                await updateData('categories', category.id, { attributes: updatedAttributes });
            }
        }
      },
    };
    if (element.id && actionMap[element.id]) {
      e.preventDefault();
      return actionMap[element.id](element);
    }

    const classActionMap = {
      'debt-view-btn': () => {
          const { hub, view } = dataset;
          if (hub === 'operaciones-deudas') {
              setState({ ui: { ...appState.ui, activeOperacionesDebtsTab: view } });
          } else if (hub === 'clientes-deudas') {
              setState({ ui: { ...appState.ui, activeClientesDebtsTab: view } });
          }
      },
      'edit-product-options-btn': () => {
          const { productName } = dataset;
          const { selectedCategoryId } = appState.categoryManager;
          openEditProductOptionsModal(selectedCategoryId, productName);
      },
      'delete-product-from-category-btn': async () => {
        const { productName } = dataset;
        const { selectedCategoryId } = appState.categoryManager;
        const category = appState.categories.find(c => c.id === selectedCategoryId);
        if (!category) return;

        openConfirmModal(`¿Seguro que quieres eliminar el producto "${productName}" de la lista? Esto no afectará a los items ya registrados en stock.`, async () => {
            const productAttribute = category.attributes.find(attr => attr.id.startsWith('attr-product-') || attr.name === 'Producto');
            if (productAttribute && Array.isArray(productAttribute.options)) {
                const updatedOptions = productAttribute.options.filter(opt => opt !== productName);
                const updatedAttributes = category.attributes.map(attr => {
                    if (attr.id === productAttribute.id) {
                        return { ...attr, options: updatedOptions };
                    }
                    if (attr.dependsOn === productAttribute.id && typeof attr.options === 'object') {
                        const newDependentOptions = { ...attr.options };
                        delete newDependentOptions[productName];
                        return { ...attr, options: newDependentOptions };
                    }
                    return attr;
                });
                await updateData('categories', category.id, { attributes: updatedAttributes });
            }
        });
      },
      // ===============================================================
      // INICIO DE MODIFICACIÓN: Se corrige el manejador de los filtros de fecha
      // ===============================================================
      'filter-btn': () => {
        const { hub, period } = dataset;
        if (hub === 'dashboard') {
            setState({ ui: { ...appState.ui, dashboard: { ...appState.ui.dashboard, dashboardPeriod: period } } });
        } else if (hub === 'analysis') {
            setState({ ui: { ...appState.ui, analysis: { ...appState.ui.analysis, analysisPeriod: period } } });
        } else if (hub === 'capital') {
            setState({ ui: { ...appState.ui, capital: { ...appState.ui.capital, capitalPeriod: period } } });
        }
      },
      // ===============================================================
      // FIN DE MODIFICACIÓN
      // ===============================================================
      'category-manager-item': () => {
        if (dataset.categoryId) {
          setState({
            categoryManager: {
              selectedCategoryId: dataset.categoryId,
              isEditingCategoryName: false,
            },
          });
        }
      },
      'delete-attribute-btn': async () => {
        const { selectedCategoryId } = appState.categoryManager;
        const category = appState.categories.find((c) => c.id === selectedCategoryId);
        if (!category) return;

        const updatedAttributes = category.attributes.filter((attr) => attr.id !== dataset.attrId);
        await updateData('categories', category.id, { attributes: updatedAttributes });
      },
      'edit-attribute-btn': () => {
        const { attrId } = dataset;
        const { selectedCategoryId } = appState.categoryManager;
        const category = appState.categories.find((c) => c.id === selectedCategoryId);
        if (category) {
          const attribute = category.attributes.find((a) => a.id === attrId);
          if (attribute) {
            openEditAttributeModal(category.id, attribute);
          }
        }
      },
      'toggle-section-btn': () => {
        const section = dataset.section;
        if (section && appState.ui.collapsedSections.hasOwnProperty(section)) {
          const currentSections = appState.ui.collapsedSections;
          setState({
            ui: {
              collapsedSections: {
                ...currentSections,
                [section]: !currentSections[section],
              },
            },
          });
        }
      },
      'remove-sale-item-btn': () => {
        const newItems = appState.sale.items.filter(
          (_, index) => index !== parseInt(dataset.index, 10)
        );
        setState({ sale: { items: newItems } });
      },
      'main-tab-btn': () => switchTab(dataset.section),
      'sub-tab-btn': () => switchSubTab(dataset.hub, dataset.subTab),
      'delete-sale-btn': () => handleAnnulSale(dataset.saleId),
      'delete-stock-btn': () => {
        const stockItem = appState.stock.find((s) => s.id === dataset.id);
        const itemName = stockItem ? stockItem.model : 'este item';
        openConfirmModal('¿Seguro que quieres eliminar este item del stock?', async () => {
          setGlobalLoading(true);
          try {
              await deleteFromDb('stock', dataset.id);
              await logCapitalState(`Stock eliminado: ${itemName}`);
          } finally {
              setGlobalLoading(false);
          }
        });
      },
      'edit-stock-btn': () => {
        const itemId = dataset.id;
        if (!itemId) {
          showModal('Error: No se pudo identificar el producto para editar.');
          return;
        }
        const item = appState.stock.find((s) => s.id === itemId);
        if (item) {
          openEditStockModal(item, appState);
        } else {
          showModal('Error: No se pudo encontrar el producto para editar.');
        }
      },
      'delete-client-btn': () => {
        if (appState.sales?.some((s) => s.clientId === dataset.id)) {
          return showModal(
            `No se puede eliminar a <strong>${dataset.name}</strong> porque tiene ventas asociadas.`
          );
        }
        openConfirmModal(`¿Seguro que quieres eliminar a ${dataset.name}?`, () =>
          deleteFromDb('clients', dataset.id)
        );
      },
      'edit-client-btn': () => openEditClientModal(JSON.parse(dataset.client)),
      'view-client-history-btn': () => showClientHistoryModal(dataset.clientId, appState),
      'delete-debt-btn': () => handleManualDelete('debts', dataset.id, 'la deuda'),
      'edit-debt-btn': () => openEditDebtModal(JSON.parse(dataset.debt)),
      'delete-fixed-expense-btn': () =>
        handleManualDelete('fixed_expenses', dataset.id, 'el gasto fijo'),
      'edit-fixed-expense-btn': () => openEditFixedExpenseModal(JSON.parse(dataset.expense)),
      'pay-fixed-expense-btn': () => handlePayFixedExpense(dataset.id),
      'delete-daily-expense-btn': () =>
        handleManualDelete('daily_expenses', dataset.id, 'el gasto'),
      'settle-our-debt-btn': () => handleSettleProviderDebt(dataset.debtId),
      'settle-client-debt-btn': () =>
        handleSettleClientDebt(dataset.saleId, parseFloat(dataset.balance)),
      'edit-note-btn': () => {
        const note = appState.notes.find((n) => n.id === dataset.noteId);
        if (note) openNoteModal(note);
      },
      'delete-note-btn': () => {
        openConfirmModal(
          '¿Estás seguro de que quieres eliminar esta nota? Esta acción no se puede deshacer.',
          () => deleteFromDb('notes', dataset.noteId)
        );
      },
      'view-item-details-btn': () => {
        const itemIndex = parseInt(dataset.itemIndex, 10);
        const item = appState.sale.items[itemIndex];
        if (item) showItemDetailsModal(item);
      },
      'edit-salesperson-btn': () => openEditSalespersonModal(JSON.parse(dataset.salesperson)),
      'delete-salesperson-btn': () => {
        openConfirmModal(`¿Seguro que quieres eliminar a ${dataset.name}?`, () =>
          deleteFromDb('salespeople', dataset.id)
        );
      },
      'edit-provider-btn': () => openEditProviderModal(JSON.parse(dataset.provider)),
      'delete-provider-btn': () => {
        openConfirmModal(`¿Seguro que quieres eliminar a ${dataset.name}?`, () =>
          deleteFromDb('userProviders', dataset.id)
        );
      },
      'cancel-reservation-btn': () => {
        const reservationId = dataset.id;
        const { reservations, capital } = appState;
        const reservation = reservations.find((r) => r.id === reservationId);
        if (!reservation) return;

        let message = '¿Seguro que quieres cancelar esta reserva? El producto volverá al stock.';
        if (reservation.hasDeposit && reservation.depositAmountUSD > 0) {
          message += `<br><br><strong>Atención:</strong> Se detectó una seña de ${formatCurrency(
            reservation.depositAmountUSD,
            'USD'
          )}. Esta acción <strong>devolverá el monto de la seña</strong> a tus billeteras.`;
        }

        openConfirmModal(message, async () => {
          setGlobalLoading(true);
          try {
            await runBatch(async (batch, db, userId) => {
              const reservationRef = doc(db, `users/${userId}/reservations`, reservationId);
              batch.delete(reservationRef);

              const stockItemRef = doc(db, `users/${userId}/stock`, reservation.itemId);
              batch.update(stockItemRef, { status: 'disponible' });

              if (reservation.hasDeposit && reservation.depositPaymentBreakdown) {
                const capitalRef = doc(db, `users/${userId}/capital`, 'summary');
                const capitalUpdates = {};
                for (const walletType in reservation.depositPaymentBreakdown) {
                  const paymentValue = reservation.depositPaymentBreakdown[walletType];
                  capitalUpdates[walletType] = (capital[walletType] || 0) - paymentValue;
                }
                batch.update(capitalRef, capitalUpdates);
              }
            });
            await logCapitalState(`Reserva cancelada para ${reservation.customerName}`);
            showModal('Reserva cancelada con éxito.', 'Éxito');
          } catch (error) {
            console.error('Error al cancelar la reserva:', error);
            showModal(`Ocurrió un error al cancelar la reserva: ${error.message}`, 'Error');
          } finally {
            setGlobalLoading(false);
          }
        });
      },
      'finalize-sale-from-reservation-btn': () => {
        handleFinalizeSaleFromReservation(dataset.id);
      },
      'view-salesperson-details-btn': () => {
        setState({ ui: { ...appState.ui, selectedSalespersonId: dataset.id } });
      },
    };
    for (const className in classActionMap) {
      if (element.classList.contains(className)) {
        e.preventDefault();
        return classActionMap[className]();
      }
    }
  });

  document.body.addEventListener('input', (e) => {
    const target = e.target;

    if (target.id === 'dolar-widget-offset-input') {
      const newOffset = parseFloat(target.value) || 0;
      const marketRate = appState.profile?.marketRate || 0;
      const newEffectiveRate = marketRate + newOffset;

      setState({
        exchangeRate: newEffectiveRate,
        profile: {
          ...appState.profile,
          dolarOffset: newOffset,
        },
      });

      clearTimeout(dolarOffsetTimer);
      dolarOffsetTimer = setTimeout(() => {
        console.log(`Guardando nuevo ajuste de dólar en Firebase: ${newOffset}`);
        setData('profile', 'main', { dolarOffset: newOffset }, true);
        logCapitalState(`Ajuste manual de dólar: ${newOffset >= 0 ? '+' : ''}${newOffset}`);
      }, 1000);
      return;
    }

    if (target.id === 'product-search-reg') {
      setState({ addStockForm: { productSearchTerm: target.value } });
      renderAddStockForm(appState);
    }

    if (target.id === 'reservation-client-search-input') {
      setState({
        reservationForm: { ...appState.reservationForm, clientSearchTerm: target.value },
      });
      openReservationModal(appState);
    }
    if (target.id === 'reservation-stock-search-input') {
      setState({
        reservationForm: { ...appState.reservationForm, stockSearchTerm: target.value },
      });
      openReservationModal(appState);
    }

    if (target.classList.contains('payment-input-modal')) {
      const form = target.closest('form');
      if (!form) return;
      const totalAmountDue = parseFloat(form.dataset.totalAmount) || 0;
      const exchangeRate = appState.exchangeRate;

      let totalPaidInUSD = 0;
      form.querySelectorAll('.payment-input-modal').forEach((input) => {
        const value = parseFloat(input.value) || 0;
        const walletType = input.dataset.wallet;
        const isArs = walletType === 'ars' || walletType === 'mp';
        totalPaidInUSD += isArs ? value / exchangeRate : value;
      });

      const balance = totalAmountDue - totalPaidInUSD;

      const totalPaidEl = form.querySelector('#payment-summary-paid');
      const balanceEl = form.querySelector('#payment-summary-balance');

      if (totalPaidEl) totalPaidEl.textContent = formatCurrency(totalPaidInUSD, 'USD');
      if (balanceEl) {
        balanceEl.textContent = formatCurrency(balance, 'USD');
        balanceEl.classList.toggle('text-red-600', balance > 0.01);
        balanceEl.classList.toggle('text-green-600', balance < -0.01);
        balanceEl.classList.toggle('text-gray-500', Math.abs(balance) <= 0.01);
      }
      return;
    }

    if (target.classList.contains('currency-input')) {
      const formType = target.dataset.formType;
      const amountInput = document.querySelector(`.currency-input[data-form-type="${formType}"]`);
      const currencySelect = document.querySelector(
        `.currency-select[data-form-type="${formType}"]`
      );
      const conversionEl = document.getElementById(`${formType}-conversion`);

      if (!amountInput || !currencySelect || !conversionEl) return;

      const amount = parseFloat(amountInput.value) || 0;
      const currency = currencySelect.value;
      const { exchangeRate } = appState;
      if (currency === 'ARS' && amount > 0) {
        conversionEl.textContent = `~ ${formatCurrency(amount / exchangeRate, 'USD')}`;
      } else {
        conversionEl.textContent = '';
      }
      return;
    }

    if (!target.id && !target.classList.contains('provider-price-list-search')) return;

    if (target.classList.contains('provider-price-list-search')) {
      const searchTerm = target.value.toLowerCase();
      const providerCard = target.closest('.card');
      if (!providerCard) return;

      const priceListContainer = providerCard.querySelector('.price-list-container');
      if (!priceListContainer) return;

      const categories = priceListContainer.querySelectorAll('.price-list-category');
      categories.forEach((category) => {
        const items = category.querySelectorAll('.price-list-item');
        let categoryHasVisibleItems = false;

        items.forEach((item) => {
          const itemNameElement = item.querySelector('.item-name');
          if (itemNameElement) {
            const itemName = itemNameElement.textContent.toLowerCase();
            const isVisible = itemName.includes(searchTerm);
            item.style.display = isVisible ? '' : 'none';
            if (isVisible) {
              categoryHasVisibleItems = true;
            }
          }
        });

        category.style.display = categoryHasVisibleItems ? '' : 'none';
      });
      return;
    }

    const actionMap = {
      'client-search-input-sale': () =>
        setState({ sale: { clientSearchTerm: target.value, selectedClient: null } }),
      'stock-search-input-sale': () => setState({ sale: { stockSearchTerm: target.value } }),
      'stock-search-input': () => setState({ stockSearchTerm: target.value }),
      'client-search-input': () => setState({ clientSearchTerm: target.value }),
      'sales-search-input': () => setState({ salesSearchTerm: target.value, ui: { pages: { ...appState.ui.pages, sales: 1 } } }),
      'expenses-search-input': () => setState({ expensesSearchTerm: target.value, ui: { pages: { ...appState.ui.pages, dailyExpenses: 1 } } }),
      'notes-search-input': () => setState({ notesSearchTerm: target.value, ui: { pages: { ...appState.ui.pages, notes: 1 } } }),
      'public-providers-search-input': () => setState({ providersSearchTerm: target.value }),
      'user-providers-search-input': () => setState({ userProvidersSearchTerm: target.value, ui: { pages: { ...appState.ui.pages, userProviders: 1 } } }),
      'salespeople-search-input': () => setState({ salespeopleSearchTerm: target.value, ui: { pages: { ...appState.ui.pages, salespeople: 1 } } }),
      'reservations-search-input': () => setState({ reservationsSearchTerm: target.value, ui: { pages: { ...appState.ui.pages, reservations: 1 } } }),
    };
    if (actionMap[target.id]) actionMap[target.id]();
  });

  document.body.addEventListener('change', (e) => {
    const target = e.target;

    if (target.id === 'analysis-area-selector') {
        const newArea = target.value;
        setState({ 
            ui: { 
                analysis: { 
                    ...appState.ui.analysis, 
                    analysisArea: newArea,
                    analysisGroupby: null, 
                    analysisMetric: null, 
                } 
            } 
        });
        return;
    }

    if (target.id === 'analysis-groupby-selector') {
        setState({ ui: { analysis: { ...appState.ui.analysis, analysisGroupby: target.value } } });
        return;
    }

    if (target.id === 'analysis-metric-selector') {
        setState({ ui: { analysis: { ...appState.ui.analysis, analysisMetric: target.value } } });
        return;
    }

    if (target.id === 'salesperson-selector') {
      const salespersonId = target.value;
      setState({ sale: { ...appState.sale, salespersonId: salespersonId || null } });
      updateSaleBalance(appState);
      return;
    }

    if (target.closest('#trade-in-details')) {
        renderTradeInAttributes();
        return;
    }

    if (target.id === 'reservation-has-deposit') {
      const detailsEl = document.getElementById('reservation-deposit-details');
      if (detailsEl) {
        detailsEl.classList.toggle('hidden', !target.checked);
      }
    }

    if (target.closest('#stock-form-register')) {
      renderAddStockForm(appState);
    }

    if (target.closest('#edit-stock-form')) {
      const form = target.closest('#edit-stock-form');
      const item = appState.stock.find((s) => s.id === form.dataset.id);

      if (item) {
        const currentValues = {};
        form.querySelectorAll('select, input, textarea').forEach((el) => {
          if (el.id) currentValues[el.id] = el.value;
        });
        openEditStockModal(item, appState, currentValues);
      }
    }

    if (target.classList.contains('currency-select')) {
      const formType = target.dataset.formType;
      const amountInput = document.querySelector(`.currency-input[data-form-type="${formType}"]`);
      const currencySelect = document.querySelector(
        `.currency-select[data-form-type="${formType}"]`
      );
      const conversionEl = document.getElementById(`${formType}-conversion`);

      if (!amountInput || !currencySelect || !conversionEl) return;

      const amount = parseFloat(amountInput.value) || 0;
      const currency = currencySelect.value;
      const { exchangeRate } = appState;
      if (currency === 'ARS' && amount > 0) {
        conversionEl.textContent = `~ ${formatCurrency(amount / exchangeRate, 'USD')}`;
      } else {
        conversionEl.textContent = '';
      }
      return;
    }
    
    if (target.id === 'stock-category-modal' || target.id === 'edit-stock-category') {
      const allCategories = [...(appState.categories || []), ...DEFAULT_CATEGORIES];
      const selectedCategory = allCategories.find((c) => c.name === target.value);
      const container = document.getElementById('dynamic-attributes-container-modal');
      if (container) {
        container.innerHTML =
          selectedCategory?.attributes?.map((attr) => generateAttributeInputHTML(attr)).join('') ||
          '';
      }
    }

    if (target.id === 'new-attribute-type' || target.id === 'edit-attribute-type') {
      const form = target.closest('form');
      const optionsContainer = form.querySelector('[id$="-attribute-options-container"]');
      if (optionsContainer) {
        optionsContainer.classList.toggle('hidden', target.value !== 'select');
      }
    }

    if (
      target.matches(
        '.payment-input, #trade-in-value, #sale-discount-input, .sale-item-price, #sale-costs-input, #commission-amount'
      )
    ) {
      if (target.id === 'sale-discount-input')
        setState({ sale: { discount: parseFloat(target.value) || 0 } });
      if (target.id === 'sale-costs-input')
        setState({ sale: { saleCosts: parseFloat(target.value) || 0 } });
      if (target.matches('.sale-item-price')) {
        const index = parseInt(target.dataset.index, 10);
        const newPrice = parseFloat(target.value) || 0;
        const newItems = [...appState.sale.items];
        if (newItems[index]) newItems[index].salePrice = newPrice;
        setState({ sale: { items: newItems } });
      }
      updateSaleBalance(appState);
    } else if (target.id === 'has-trade-in') {
      toggleTradeInDetails();
    }
  });

  document.body.addEventListener('keydown', (e) => {
    if (e.target.id === 'business-name-input' && e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
    if (e.target.id === 'edit-category-name-input' && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('save-category-name-btn')?.click();
    }
    if (e.target.matches('.add-option-input') && e.key === 'Enter') {
        e.preventDefault();
        const button = e.target.nextElementSibling;
        if (button) button.click();
    }
  });
}
