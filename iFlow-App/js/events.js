import {
  openAdjustCapitalModal,
  openConfirmModal,
  openEditStockModal,
  showClientHistoryModal,
  switchTab,
  switchSubTab,
  toggleTradeInDetails,
  showModal,
  openAddClientModal,
  showSaleDetailModal,
  formatCurrency,
  openEditClientModal,
  openEditDebtModal,
  openEditFixedExpenseModal,
  openExecutePaymentModal,
  updateSaleBalance,
  openExecuteDailyExpenseModal,
  openAddStockModal,
  openChangePasswordModal,
  openNoteModal,
  showItemDetailsModal,
  renderAddStockForm,
  renderSalesAnalysis,
  renderTradeInAttributes,
} from './ui.js';
import { appState, setState, WALLET_CONFIG } from './state.js';
import { addData, deleteFromDb, updateData, setData, runBatch } from './api.js';
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
import { auth } from './firebase-config.js';
import { handleLogin, handleRegistration } from './auth.js';

// =================================================================================
// FUNCIONES DE LÓGICA (HELPERS)
// =================================================================================

/**
 * Calcula el capital total y lo guarda en la colección de historial.
 * @param {string} reason - La razón del cambio de capital (ej. "Venta", "Gasto").
 */
async function logCapitalState(reason) {
  try {
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
  } catch (error) {
    console.error('Error al registrar el estado del capital:', error);
  }
}

/**
 * Activa o desactiva el estado de carga de un botón para mejorar la UX.
 */
function setButtonLoading(button, isLoading, loadingText = 'Guardando...') {
  if (!button) return;
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

/**
 * Muestra un modal de confirmación para borrado manual y, si se confirma, elimina el documento.
 */
function handleManualDelete(collectionName, docId, entityName) {
  const message = `Esta acción eliminará ${entityName} de la lista. Recuerda que debes revertir o ajustar manualmente cualquier cambio de capital asociado. ¿Deseas continuar?`;
  openConfirmModal(message, () => deleteFromDb(collectionName, docId));
}

/**
 * Maneja el pago de un gasto fijo abriendo el modal de selección de billetera.
 */
function handlePayFixedExpense(expenseId) {
  const expense = appState.fixedExpenses.find((exp) => exp.id === expenseId);
  if (expense) {
    openExecutePaymentModal(expense, appState);
  } else {
    showModal('No se pudo encontrar el gasto fijo seleccionado.', 'Error');
  }
}

/**
 * Maneja el saldado de una deuda con un proveedor (eliminación manual).
 */
function handleSettleProviderDebt(debtId) {
  const message =
    'Esta acción eliminará la deuda de la lista. Recuerda ajustar manually el saldo de tus billeteras para reflejar el pago. ¿Deseas continuar?';
  openConfirmModal(message, async () => {
    await deleteFromDb('debts', debtId);
    await logCapitalState(`Deuda a proveedor saldada`);
  });
}

/**
 * Maneja el saldado de la deuda de un cliente.
 */
function handleSettleClientDebt(saleId, balance) {
  const message = `Vas a saldar una deuda de ${formatCurrency(
    balance,
    'USD'
  )}. La deuda total se reducirá automáticamente. Recuerda agregar este ingreso manualmente a la billetera correspondiente (ej. Dólares, Efectivo). ¿Continuar?`;

  openConfirmModal(message, async () => {
    try {
      await runBatch(async (batch, db, userId) => {
        const sale = appState.sales.find((s) => s.id === saleId);
        if (!sale) throw new Error('Error: No se encontró la venta asociada a la deuda.');
        const saleRef = doc(db, `users/${userId}/sales`, saleId);
        const payments = sale.paymentBreakdownUSD || {};
        const alreadySettled = payments.debtSettled || 0;
        payments.debtSettled = alreadySettled + balance;
        batch.update(saleRef, { paymentBreakdownUSD: payments });

        const capitalRef = doc(db, `users/${userId}/capital`, 'summary');
        const currentTotalDebt = appState.capital.clientDebt || 0;
        const newTotalDebt = currentTotalDebt - balance;
        batch.update(capitalRef, { clientDebt: newTotalDebt < 0 ? 0 : newTotalDebt });
      });
      await logCapitalState(
        `Cobro deuda de ${appState.sales.find((s) => s.id === saleId)?.customerName || 'cliente'}`
      );
      showModal('Deuda saldada y total de la billetera actualizado. La lista se refrescará.');
    } catch (error) {
      console.error('Error al saldar la deuda del cliente:', error);
      showModal(`Ocurrió un error al procesar la operación: ${error.message}`);
    }
  });
}

/**
 * Lee los valores del formulario de ajuste de capital y los guarda en la base de datos.
 */
async function handleAdjustCapital(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setButtonLoading(button, true);
  try {
    const capitalData = {};
    const inputs = form.querySelectorAll('input[type="number"]');
    inputs.forEach((input) => {
      const key = input.id.replace('adjust-', '');
      capitalData[key] = parseFloat(input.value) || 0;
    });
    await setData('capital', 'summary', capitalData);
    await logCapitalState('Ajuste manual de capital');
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
    showModal('Saldos de capital actualizados con éxito.');
  } catch (error) {
    console.error('Error al ajustar el capital:', error);
    showModal(`Ocurrió un error al guardar los saldos: ${error.message}`);
  } finally {
    setButtonLoading(button, false);
  }
}

/**
 * Maneja la selección de una billetera en el modal de pago.
 */
function handleWalletSelection(selectedButton) {
  const walletSelector = selectedButton.closest(
    '#payment-wallet-selector, #daily-expense-wallet-selector'
  );
  if (!walletSelector) return;

  walletSelector.querySelectorAll('button').forEach((btn) => {
    btn.classList.remove('border-green-500', 'bg-green-50');
    btn.classList.add('border-gray-200');
  });

  selectedButton.classList.add('border-green-500', 'bg-green-50');
  selectedButton.classList.remove('border-gray-200');

  const confirmationContainer = selectedButton
    .closest('.modal-content')
    .querySelector('.payment-confirmation-actions');
  const confirmBtn = confirmationContainer?.querySelector('button');

  if (confirmationContainer && confirmBtn) {
    confirmBtn.dataset.walletType = selectedButton.dataset.walletType;
    confirmationContainer.classList.remove('hidden');
  }
}

/**
 * Ejecuta el pago final después de la confirmación.
 */
async function handleFinalPaymentConfirmation(confirmButton) {
  const { walletType, expenseId } = confirmButton.dataset;
  const expense = appState.fixedExpenses.find((exp) => exp.id === expenseId);

  if (!expense || !walletType) {
    return showModal('Error: No se pudo obtener la información del pago.', 'Error');
  }

  setButtonLoading(confirmButton, true, 'Procesando...');
  try {
    await runBatch(async (batch, db, userId) => {
      const capital = appState.capital;
      const exchangeRate = appState.exchangeRate;
      const walletConfig = WALLET_CONFIG[walletType];
      const expenseAmountInCurrency =
        walletConfig.currency === 'ARS' ? expense.amount * exchangeRate : expense.amount;

      const capitalRef = doc(db, `users/${userId}/capital`, 'summary');
      const newWalletValue = (capital[walletType] || 0) - expenseAmountInCurrency;
      batch.update(capitalRef, { [walletType]: newWalletValue });

      const dailyExpenseRef = doc(collection(db, `users/${userId}/daily_expenses`));
      const paymentRecord = {
        amount: expense.amount,
        date: new Date().toISOString().split('T')[0],
        description: `Pago de gasto fijo: ${expense.description}`,
        isFixedPayment: true,
        paidFrom: walletType,
        createdAt: serverTimestamp(),
      };
      batch.set(dailyExpenseRef, paymentRecord);

      const fixedExpenseRef = doc(db, `users/${userId}/fixed_expenses`, expenseId);
      const currentMonthID = `${new Date().getFullYear()}-${String(
        new Date().getMonth() + 1
      ).padStart(2, '0')}`;
      batch.update(fixedExpenseRef, { lastPaidMonth: currentMonthID });
    });

    await logCapitalState(`Pago de gasto: ${expense.description}`);

    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
    showModal('Pago realizado con éxito.', 'Éxito');
  } catch (error) {
    console.error('Error al ejecutar el pago:', error);
    showModal(`No se pudo procesar el pago: ${error.message}`, 'Error');
  } finally {
    setButtonLoading(confirmButton, false);
  }
}

/**
 * Inicia el flujo de suscripción mostrando un modal de advertencia.
 */
function handleStartSubscriptionFlow() {
  // MODIFICACIÓN: Esta función ya no es necesaria, pero la dejamos vacía para no romper llamadas.
}

/**
 * Maneja la anulación de una venta.
 */
async function handleAnnulSale(saleId) {
  const sale = appState.sales.find((s) => s.id === saleId);
  if (!sale) {
    return showModal('No se pudo encontrar la venta para anular.', 'Error');
  }

  const message = `¿Estás seguro de que quieres anular esta venta? <br><br>
        - La <strong>cantidad de cada producto vendido</strong> será devuelta al stock. <br><br>
        <strong>Importante:</strong> Esta acción <strong>NO</strong> ajustará tus billeteras automáticamente. Deberás restar los ingresos de esta venta manualmente. <br><br>
        El producto recibido como canje (si hubo) <strong>NO</strong> se eliminará del stock. <br><br>
        Esta acción no se puede deshacer.`;

  openConfirmModal(message, async () => {
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
        'Venta anulada con éxito. Los productos han sido devueltos al stock. Recuerda ajustar el capital manually.',
        'Éxito'
      );
    } catch (error) {
      console.error('Error al anular la venta:', error);
      showModal(`Ocurrió un error al anular la venta: ${error.message}`, 'Error');
    }
  });
}

/**
 * Maneja el pago de un gasto diario/variable.
 */
async function handleExecuteDailyExpense(button) {
  const { walletType, expenseData } = button.dataset;
  const expense = JSON.parse(expenseData);

  if (!expense || !walletType) {
    return showModal('Error: No se pudo obtener la información del gasto.', 'Error');
  }

  setButtonLoading(button, true, 'Procesando...');

  try {
    await runBatch(async (batch, db, userId) => {
      const capital = appState.capital;
      const exchangeRate = appState.exchangeRate;
      const walletConfig = WALLET_CONFIG[walletType];
      const expenseAmountInCurrency =
        walletConfig.currency === 'ARS' ? expense.amount * exchangeRate : expense.amount;

      const capitalRef = doc(db, `users/${userId}/capital`, 'summary');
      const newWalletValue = (capital[walletType] || 0) - expenseAmountInCurrency;
      batch.update(capitalRef, { [walletType]: newWalletValue });

      const dailyExpenseRef = doc(collection(db, `users/${userId}/daily_expenses`));
      const paymentRecord = {
        ...expense,
        isFixedPayment: false,
        paidFrom: walletType,
        createdAt: serverTimestamp(),
      };
      batch.set(dailyExpenseRef, paymentRecord);
    });

    await logCapitalState(`Gasto: ${expense.description}`);

    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
    showModal('Gasto pagado y registrado con éxito.', 'Éxito');
  } catch (error) {
    console.error('Error al ejecutar el pago del gasto diario:', error);
    showModal(`No se pudo procesar el pago: ${error.message}`, 'Error');
  } finally {
    setButtonLoading(button, false);
  }
}

// =================================================================================
// MANEJADORES DE LÓGICA DE NEGOCIO
// =================================================================================

/**
 * Lee los datos del formulario de stock (dinámico) y los guarda en la BD.
 * @param {HTMLFormElement} form - El formulario de donde leer los datos.
 * @param {string} [docId] - Opcional. Si se provee, actualiza el documento en lugar de crear uno nuevo.
 */
async function saveStockItem(form, docId = null) {
  const isEditing = !!docId;
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, isEditing ? 'Actualizando...' : 'Añadiendo...');

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

    const stockItemData = {
      category: form.querySelector(
        '[id$="-category-reg"], [id$="-category-modal"], [id$="-stock-category"]'
      ).value,
      model: form
        .querySelector('[id$="-model-reg"], [id$="-model-modal"], [id$="-stock-model"]')
        .value.trim(),
      serialNumber: form
        .querySelector('[id$="-serial-reg"], [id$="-serial-modal"], [id$="-stock-serial"]')
        .value.trim()
        .toUpperCase(),
      phoneCost:
        parseFloat(
          form.querySelector('[id$="-cost-reg"], [id$="-cost-modal"], [id$="-stock-cost"]').value
        ) || 0,
      suggestedSalePrice:
        parseFloat(
          form.querySelector('[id$="-price-reg"], [id$="-price-modal"], [id$="-stock-price"]').value
        ) || 0,
      quantity:
        parseInt(
          form.querySelector(
            '[id$="-quantity-reg"], [id$="-quantity-modal"], [id$="-stock-quantity"]'
          ).value,
          10
        ) || 1,
      details:
        form
          .querySelector('[id$="-details-reg"], [id$="-details-modal"], [id$="-stock-details"]')
          ?.value.trim() || '',
      attributes: attributes,
    };

    if (isEditing) {
      if (!docId) {
        throw new Error('No se proporcionó un ID de documento para la actualización.');
      }
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
      setState({ addStockForm: { isFormVisible: false } });
    }
  } catch (error) {
    console.error('Error al guardar en stock:', error);
    showModal(`Error al guardar el producto: ${error.message}`);
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleAddClient(form) {
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Añadiendo...');
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
    setButtonLoading(button, false);
  }
}

async function handleAddFixedExpense(form) {
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Añadiendo...');
  try {
    const newExpense = {
      description: form.querySelector('#fixed-expense-description-reg').value.trim(),
      amount: parseFloat(form.querySelector('#fixed-expense-amount-reg').value) || 0,
      paymentDay: parseInt(form.querySelector('#fixed-expense-day-reg').value, 10),
      createdAt: serverTimestamp(),
    };
    await addData('fixed_expenses', newExpense);
    showModal('Gasto fijo añadido con éxito.');
    form.reset();
  } finally {
    setButtonLoading(button, false);
  }
}

function handleAddDailyExpense(form) {
  const expenseData = {
    description: form.querySelector('#daily-expense-description-reg').value.trim(),
    amount: parseFloat(form.querySelector('#daily-expense-amount-reg').value) || 0,
    date: form.querySelector('#daily-expense-date-reg').value,
  };
  if (!expenseData.date) {
    return showModal('Por favor, selecciona una fecha para el gasto.');
  }
  openExecuteDailyExpenseModal(expenseData, appState);
  form.reset();
}

async function handleAddDebt(form) {
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Añadiendo...');
  try {
    const newDebt = {
      debtorName: form.querySelector('#debtor-name').value.trim(),
      description: form.querySelector('#debt-desc').value.trim(),
      amount: parseFloat(form.querySelector('#debt-amount').value) || 0,
      createdAt: serverTimestamp(),
    };
    await addData('debts', newDebt);
    await logCapitalState(`Nueva deuda a ${newDebt.debtorName}`);
    showModal('Deuda a proveedor añadida con éxito.');
    form.reset();
    document.getElementById('add-debt-form-container').classList.add('hidden');
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleModalClient(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setButtonLoading(button, true);
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
    setButtonLoading(button, false);
  }
}

async function handleModalStock(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setButtonLoading(button, true);
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
    setButtonLoading(button, false);
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
  setButtonLoading(button, true);
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
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
    showModal('Tu contraseña ha sido actualizada con éxito.', 'Éxito');
  } catch (error) {
    let friendlyMessage = 'Ocurrió un error. Inténtalo de nuevo.';
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      friendlyMessage = 'La contraseña actual es incorrecta.';
    }
    showModal(friendlyMessage, 'Error de Autenticación');
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleSaveSale() {
  const form = document.getElementById('sale-form');
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Finalizando...');
  try {
    const { sale, exchangeRate, stock } = appState;
    if (!sale.selectedClient || !sale.items || sale.items.length === 0) {
      showModal('Debes seleccionar un cliente y al menos un producto.');
      return;
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
      showModal('El balance debe ser cero para finalizar la venta. Ajusta los montos de pago.');
      return;
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
      };

      sale.items.forEach((item) => {
        const stockItemRef = doc(db, `users/${userId}/stock`, item.id);
        const originalStockItem = stock.find((s) => s.id === item.id);
        const currentQuantity = originalStockItem ? originalStockItem.quantity || 1 : 1;

        if (currentQuantity > 1) {
          batch.update(stockItemRef, { quantity: currentQuantity - 1 });
        } else {
          batch.delete(stockItemRef);
        }
      });

      if (document.getElementById('has-trade-in').checked && tradeInValue > 0) {
        const tradeInAttributes = {};
        const tradeInContainer = document.getElementById('trade-in-details');
        if (tradeInContainer) {
          tradeInContainer.querySelectorAll('[id^="attr_"]').forEach((input) => {
            const attrName = input.dataset.attrName;
            let value;
            if (input.type === 'checkbox') {
              value = input.checked;
            } else {
              value = input.value.trim();
            }
            if (value !== '' && value !== null) {
              tradeInAttributes[attrName] = value;
            }
          });
        }
        const tradeInItem = {
          model: document.getElementById('trade-in-model').value.trim(),
          serialNumber: document.getElementById('trade-in-serial').value.trim().toUpperCase(),
          phoneCost: tradeInValue,
          details: document.getElementById('trade-in-details-input').value.trim(),
          category: document.getElementById('trade-in-category').value,
          suggestedSalePrice: parseFloat(document.getElementById('trade-in-sug-price').value) || 0,
          quantity: 1,
          attributes: tradeInAttributes,
          createdAt: serverTimestamp(),
        };
        saleData.tradeIn = { ...tradeInItem };
        saleData.tradeInValueUSD = tradeInValue;
        batch.set(doc(collection(db, `users/${userId}/stock`)), tradeInItem);
      }
      batch.set(doc(collection(db, `users/${userId}/sales`)), saleData);
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
      },
    });

    showModal('¡Venta registrada con éxito!');
  } catch (error) {
    console.error('Error detallado al procesar venta:', error);
    showModal(`Error al procesar la venta: ${error.message}`);
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleEditClient(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setButtonLoading(button, true);
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
    setButtonLoading(button, false);
  }
}

async function handleEditDebt(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setButtonLoading(button, true);
  try {
    const debtId = form.dataset.id;
    const updatedData = {
      debtorName: form.querySelector('#edit-debtor-name').value.trim(),
      description: form.querySelector('#edit-debt-desc').value.trim(),
      amount: parseFloat(form.querySelector('#edit-debt-amount').value) || 0,
    };
    await updateData('debts', debtId, updatedData);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Deuda actualizada con éxito.');
  } catch (error) {
    showModal(`Error al actualizar la deuda: ${error.message}`);
  } finally {
    setButtonLoading(button, false);
  }
}

async function handleEditFixedExpense(form) {
  const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
  setButtonLoading(button, true);
  try {
    const expenseId = form.dataset.id;
    const updatedData = {
      description: form.querySelector('#edit-fixed-expense-description').value.trim(),
      amount: parseFloat(form.querySelector('#edit-fixed-expense-amount').value) || 0,
      paymentDay: parseInt(form.querySelector('#edit-fixed-expense-day').value, 10),
    };
    await updateData('fixed_expenses', expenseId, updatedData);
    document.getElementById('modal-container').innerHTML = '';
    showModal('Gasto fijo actualizado con éxito.');
  } catch (error) {
    showModal(`Error al actualizar el gasto: ${error.message}`);
  } finally {
    setButtonLoading(button, false);
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
          setButtonLoading(button, true, 'Ingresando...');
          try {
            if (form.id === 'login-form') await handleLogin(email, password);
            else await handleRegistration(email, password);
          } catch (err) {
            // El error ya se muestra en el modal, solo nos aseguramos de detener el spinner.
          } finally {
            setButtonLoading(button, false);
          }
          break;
        }
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
        case 'adjust-capital-form':
          await handleAdjustCapital(form);
          break;
        case 'note-form': {
          const button = document.querySelector(`button[type="submit"][form="${form.id}"]`);
          setButtonLoading(button, true);
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
            setButtonLoading(button, false);
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
      }
    } catch (err) {
      console.error(`Error en el manejador de submit para el form #${form.id}:`, err);
    }
  });

  document.body.addEventListener('click', async (e) => {
    const target = e.target;
    const element = target.closest(
      'button, a, div[data-client], div[data-stock], div[data-category-id], i#edit-business-name-icon'
    );

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
      return;
    }

    if (element.id === 'user-menu-button') {
      document.getElementById('user-menu-dropdown')?.classList.toggle('hidden');
      return;
    }

    const { dataset } = element;

    const actionMap = {
      // MODIFICACIÓN: Se elimina la lógica de suscripción.
      // 'logout-from-trial-screen': () => signOut(auth),
      'change-password-btn': () => openChangePasswordModal(),
      'logout-button': () => signOut(auth),
      'manage-subscription-btn': () => {
        // MODIFICACIÓN: Se cambia el mensaje para no mencionar Gumroad.
        showModal(
          `Actualmente, la gestión de la cuenta se realiza directamente a través de la aplicación.`,
          'Gestionar Cuenta'
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
      // MODIFICACIÓN: Se elimina toda la lógica de botones de suscripción.
      // 'start-trial-btn': () => handleStartSubscriptionFlow(),
      // 'subscribe-now-btn': () => handleStartSubscriptionFlow(),
      // 'cancel-validation-btn': () => setData('profile', 'main', { subscriptionStatus: 'pending_trial_setup' }, true),
      // 'logout-from-subscription-modal': () => {
      //     document.getElementById('modal-container').innerHTML = '';
      //     signOut(auth);
      // },
      // 'confirm-gumroad-redirect': async (button) => {
      //     const user = appState.user;
      //     if (!user) return;

      //     const gumroadLink = `https://pacomatic.gumroad.com/l/scnaca?user_id=${user.uid}&email=${user.email}`;
      //     const paymentWindow = window.open(gumroadLink, '_blank');
      //     if (!paymentWindow) {
      //         showModal("Tu navegador ha bloqueado la ventana de pago. Por favor, deshabilita el bloqueador de pop-ups para este sitio e inténtalo de nuevo.");
      //         return;
      //     }

      //     document.getElementById('modal-container').innerHTML = '';
      //     setButtonLoading(button, true, "Redirigiendo...");
      //     await setData('profile', 'main', { subscriptionStatus: 'pending_payment_validation' }, true);
      //     setButtonLoading(button, false);
      // },
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
      'analysis-apply-custom-filter-btn': () => {
        const startDate = document.getElementById('analysis-custom-start-date').value;
        const endDate = document.getElementById('analysis-custom-end-date').value;
        setState({
          ui: { analysis: { analysisCustomStartDate: startDate, analysisCustomEndDate: endDate } },
        });
      },
      'confirm-payment-btn': () => handleFinalPaymentConfirmation(element),
      'confirm-daily-expense-payment-btn': () => handleExecuteDailyExpense(element),
      'add-note-btn': () => openNoteModal(),
      'add-new-category-btn': async () => {
        const name = prompt('Nombre de la nueva categoría:');
        if (name && name.trim()) {
          const newId = name.trim().toLowerCase().replace(/\s+/g, '-');
          const newCategoryData = { name: name.trim(), attributes: [] };
          await setData('categories', newId, newCategoryData);
        }
      },
      'edit-category-name-btn': () =>
        setState({ categoryManager: { isEditingCategoryName: true } }),
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
    };

    if (actionMap[element.id]) {
      e.preventDefault();
      return actionMap[element.id](element);
    }

    const classActionMap = {
      'filter-btn': () => {
        const { hub, period } = dataset;
        if (hub === 'dashboard') {
          setState({ ui: { dashboard: { dashboardPeriod: period } } });
        } else if (hub === 'analysis') {
          setState({ ui: { analysis: { analysisPeriod: period } } });
        }
      },
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
          await deleteFromDb('stock', dataset.id);
          await logCapitalState(`Stock eliminado: ${itemName}`);
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
      'payment-wallet-option': () => handleWalletSelection(element),
      'execute-daily-expense-wallet-btn': () => handleWalletSelection(element),
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
    if (!target.id && !target.classList.contains('provider-price-list-search')) return;

    // <<<--- NUEVO: Lógica para el buscador de la lista de precios del proveedor ---
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
      'sales-search-input': () => setState({ salesSearchTerm: target.value }),
      'providers-search-input': () => setState({ providersSearchTerm: target.value }),
      'expenses-search-input': () => setState({ expensesSearchTerm: target.value }),
      'notes-search-input': () => setState({ notesSearchTerm: target.value }),
      'sales-analysis-search': () => renderSalesAnalysis(appState),
    };
    if (actionMap[target.id]) actionMap[target.id]();
  });

  document.body.addEventListener('change', (e) => {
    const target = e.target;

    if (target.id === 'analysis-selector') {
      renderSalesAnalysis(appState);
      return;
    }

    if (target.id === 'stock-category-reg') {
      renderAddStockForm(appState);
    }

    if (target.id === 'stock-category-modal' || target.id === 'edit-stock-category') {
      const allCategories = appState.categories || [];
      const selectedCategory = allCategories.find((c) => c.name === target.value);
      const container = document.getElementById('dynamic-attributes-container-modal');
      if (container) {
        container.innerHTML =
          selectedCategory?.attributes?.map((attr) => generateAttributeInputHTML(attr)).join('') ||
          '';
      }
    }

    if (target.id === 'trade-in-category') {
      renderTradeInAttributes();
    }

    if (target.id === 'new-attribute-type') {
      const optionsContainer = document.getElementById('new-attribute-options-container');
      if (optionsContainer) {
        optionsContainer.classList.toggle('hidden', target.value !== 'select');
      }
    }

    if (
      target.matches(
        '.payment-input, #trade-in-value, #sale-discount-input, .sale-item-price, #sale-costs-input'
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

  document.body.addEventListener('focusout', (e) => {
    if (e.target.id === 'business-name-input') {
      handleSaveBusinessName();
    }
    if (e.target.id === 'exchange-rate-input') {
      handleSaveExchangeRate();
    }
    if (e.target.id === 'edit-category-name-input') {
      // Logic to save on blur, could be added later if needed
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
  });
}
