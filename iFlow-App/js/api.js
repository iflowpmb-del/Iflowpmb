import { db } from './firebase-config.js';
import {
  collection,
  onSnapshot,
  query,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  getDocs,
  collectionGroup,
  where,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
  setState,
  addFirebaseListener,
  clearFirebaseListeners,
  appState,
  DEFAULT_CATEGORIES,
} from './state.js';

// --- SE MUEVE LOGCAPITALSTATE AQUÍ PARA EVITAR DEPENDENCIAS CIRCULARES ---
async function logCapitalState(reason) {
  try {
    // Se necesita un pequeño retraso para asegurar que el estado se haya actualizado antes de leerlo.
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
    }, 100); // 100ms de retraso
  } catch (error) {
    console.error('Error al registrar el estado del capital:', error);
  }
}

async function fetchAndSetDolarData() {
  let marketSellRate = null;
  let marketBuyRate = null;

  try {
    const response = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();

    const sellPrice = data.venta;
    const buyPrice = data.compra;

    if (sellPrice && typeof sellPrice === 'number' && sellPrice > 0) {
      marketSellRate = sellPrice;
    }
    if (buyPrice && typeof buyPrice === 'number' && buyPrice > 0) {
      marketBuyRate = buyPrice;
    }
  } catch (error) {
    console.error(
      'Error al obtener la cotización del dólar. Se usará el último valor guardado.',
      error
    );
  }

  const userProfile = appState.profile;
  const lastKnownMarketRate = marketSellRate || userProfile?.marketRate || 1000;
  const lastKnownMarketBuyRate = marketBuyRate || userProfile?.marketBuyRate || 1000;
  const userOffset = userProfile?.dolarOffset || 0;
  const effectiveRate = lastKnownMarketRate + userOffset;

  if (marketSellRate && userProfile?.marketRate && marketSellRate !== userProfile.marketRate) {
    logCapitalState(`Actualización de Dólar API: ${marketSellRate}`);
  }

  setState({
    exchangeRate: effectiveRate,
    profile: {
      ...userProfile,
      marketRate: lastKnownMarketRate,
      marketBuyRate: lastKnownMarketBuyRate,
      dolarOffset: userOffset,
    },
  });

  if ((marketSellRate !== null || marketBuyRate !== null) && appState.user?.uid) {
    const dataToUpdate = {};
    if (marketSellRate !== null) dataToUpdate.marketRate = marketSellRate;
    if (marketBuyRate !== null) dataToUpdate.marketBuyRate = marketBuyRate;
    setData('profile', 'main', dataToUpdate, true);
  }
}

export function loadAllData(userId) {
  if (!userId) return;

  clearFirebaseListeners();
  setState({ isDataLoading: true, isInitialRender: true });

  const collectionsToLoad = {
    profile: {
      type: 'doc',
      path: `users/${userId}/profile/main`,
      default: {
        businessName: 'Mi Negocio',
        subscriptionStatus: 'none',
        dolarOffset: 0,
        marketRate: 1000,
        marketBuyRate: 1000,
      },
      default: {
        businessName: 'Mi Negocio',
        subscriptionStatus: 'none',
        dolarOffset: 0,
        marketRate: 1000,
        marketBuyRate: 1000,
      },
    },
    capital: {
      type: 'doc',
      path: `users/${userId}/capital/summary`,
      default: { ars: 0, usd: 0, usdt: 0, mp: 0, clientDebt: 0, debt: 0 },
    },
    stock: { type: 'collection', path: `users/${userId}/stock` },
    // sales y debts se manejarán de forma especial más abajo
    clients: { type: 'collection', path: `users/${userId}/clients` },
    categories: { type: 'collection', path: `users/${userId}/categories` },
    fixedExpenses: { type: 'collection', path: `users/${userId}/fixed_expenses` },
    dailyExpenses: {
      type: 'collection',
      path: `users/${userId}/daily_expenses`,
      sorter: (a, b) => new Date(b.date) - new Date(a.date),
    },
    providers: { type: 'collection', path: 'providers' },
    notes: {
      type: 'collection',
      path: `users/${userId}/notes`,
      sorter: (a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0),
    },
    capitalHistory: {
      type: 'collection',
      path: `users/${userId}/capital_history`,
      sorter: (a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0),
    },
    reservations: {
      type: 'collection',
      path: `users/${userId}/reservations`,
      sorter: (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0),
    },
    salespeople: { type: 'collection', path: `users/${userId}/salespeople` },
    userProviders: { type: 'collection', path: `users/${userId}/userProviders` },
  };

  let initialLoadsPending = Object.keys(collectionsToLoad).length + 2; // +2 for sales and debts
  let initialLoadFlags = {
    ...Object.keys(collectionsToLoad).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    sales: true,
    debts: true,
  };

  let profileLoaded = false;

  const onInitialLoad = async (collectionName, error = null) => {
    if (error) {
      console.error(`[API Error] Falló la carga inicial de '${collectionName}':`, error);
    }

    if (collectionName === 'profile') {
      profileLoaded = true;
      await fetchAndSetDolarData();
    }

    if (initialLoadFlags[collectionName]) {
      initialLoadFlags[collectionName] = false;
      initialLoadsPending--;
    }

    if (initialLoadsPending === 0) {
      console.log('[API] Todas las cargas iniciales completadas. Desbloqueando UI.');
      setTimeout(() => setState({ isDataLoading: false }), 100);
    }
  };

  // --- INICIO DE LA MODIFICACIÓN: Carga robusta de pagos ---
  // Se abandona collectionGroup y se cargan los pagos iterando sobre cada venta y deuda.
  // Esto es más lento pero no requiere configuración de índices en Firebase.

  // 1. Cargar Ventas y luego sus sub-colecciones de pagos
  const salesQuery = query(collection(db, `users/${userId}/sales`));
  let allClientPayments = {}; // Usamos un objeto para evitar duplicados y manejar actualizaciones
  const salesUnsubscribe = onSnapshot(
    salesQuery,
    (salesSnapshot) => {
      const salesData = salesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      salesData.sort((a, b) => (b.soldAt?.toMillis() || 0) - (a.soldAt?.toMillis() || 0));
      setState({ sales: salesData });

      if (salesSnapshot.docs.length === 0) {
        setState({ clientDebtPayments: [] });
      }

      salesSnapshot.docs.forEach((saleDoc) => {
        const paymentsQuery = query(collection(db, saleDoc.ref.path, 'payments'));
        const paymentsUnsubscribe = onSnapshot(paymentsQuery, (paymentsSnapshot) => {
          allClientPayments[saleDoc.id] = paymentsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            parentId: saleDoc.id,
          }));
          const flattenedPayments = Object.values(allClientPayments).flat();
          setState({ clientDebtPayments: flattenedPayments });
        });
        addFirebaseListener(paymentsUnsubscribe);
      });
      onInitialLoad('sales');
    },
    (error) => {
      onInitialLoad('sales', error);
      setState({ sales: [], clientDebtPayments: [] });
    }
  );

  addFirebaseListener(salesUnsubscribe);

  // 2. Cargar Deudas y luego sus sub-colecciones de pagos
  const debtsQuery = query(collection(db, `users/${userId}/debts`));
  let allProviderPayments = {};
  const debtsUnsubscribe = onSnapshot(
    debtsQuery,
    (debtsSnapshot) => {
      const debtsData = debtsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setState({ debts: debtsData });

      if (debtsSnapshot.docs.length === 0) {
        setState({ providerDebtPayments: [] });
      }

      debtsSnapshot.docs.forEach((debtDoc) => {
        const paymentsQuery = query(collection(db, debtDoc.ref.path, 'payments'));
        const paymentsUnsubscribe = onSnapshot(paymentsQuery, (paymentsSnapshot) => {
          allProviderPayments[debtDoc.id] = paymentsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            parentId: debtDoc.id,
          }));
          const flattenedPayments = Object.values(allProviderPayments).flat();
          setState({ providerDebtPayments: flattenedPayments });
        });
        addFirebaseListener(paymentsUnsubscribe);
      });
      onInitialLoad('debts');
    },
    (error) => {
      onInitialLoad('debts', error);
      setState({ debts: [], providerDebtPayments: [] });
    }
  );

  addFirebaseListener(debtsUnsubscribe);
  // --- FIN DE LA MODIFICACIÓN ---

  // Cargar el resto de las colecciones
  for (const [key, config] of Object.entries(collectionsToLoad)) {
    if (key === 'categories') {
      const categoriesCollectionRef = collection(db, `users/${userId}/categories`);
      const categoriesUnsubscribe = onSnapshot(
        query(categoriesCollectionRef),
        async (snapshot) => {
          if (snapshot.empty && initialLoadFlags.categories) {
            const batch = writeBatch(db);
            DEFAULT_CATEGORIES.forEach((category) => {
              const categoryRef = doc(db, `users/${userId}/categories`, category.id);
              const { id, ...categoryData } = category;
              batch.set(categoryRef, categoryData);
            });
            await batch.commit();
          } else {
            let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

            // =================================================================================
            // INICIO DE LA MODIFICACIÓN: Lógica de migración para la categoría "Otro"
            // =================================================================================
            const oldCategoryIndex = data.findIndex((cat) => cat.id === 'other');
            if (oldCategoryIndex > -1) {
              console.log("Migrando categoría 'other' a 'universal'...");
              const newUniversalCategory = DEFAULT_CATEGORIES.find((cat) => cat.id === 'universal');

              if (newUniversalCategory) {
                const batch = writeBatch(db);

                // Borrar el documento viejo
                const oldDocRef = doc(db, `users/${userId}/categories`, 'other');
                batch.delete(oldDocRef);

                // Crear el documento nuevo
                const newDocRef = doc(db, `users/${userId}/categories`, 'universal');
                const { id, ...categoryData } = newUniversalCategory;
                batch.set(newDocRef, categoryData);

                await batch.commit();
                console.log('Migración completada en la base de datos.');

                // No es necesario actualizar `data` aquí, porque el onSnapshot se
                // disparará de nuevo automáticamente con los datos actualizados de Firestore.
              }
            } else {
              setState({ categories: data });
            }
            // =================================================================================
            // FIN DE LA MODIFICACIÓN
            // =================================================================================
          }
          onInitialLoad('categories');
        },
        (error) => {
          onInitialLoad('categories', error);
          setState({ categories: [] });
        }
      );
      addFirebaseListener(categoriesUnsubscribe);
      continue;
    }

    let queryRef =
      config.type === 'doc' ? doc(db, config.path) : query(collection(db, config.path));

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        let data;
        if (config.type === 'doc') {
          data = snapshot.exists() ? { ...config.default, ...snapshot.data() } : config.default;
        } else {
          data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          if (config.sorter) data.sort(config.sorter);
        }
        setState({ [key]: data });
        onInitialLoad(key);
      },
      (error) => {
        onInitialLoad(key, error);
        if (config.type !== 'doc') setState({ [key]: [] });
      }
    );
    addFirebaseListener(unsubscribe);
  }
}

function getUserId() {
  const userId = appState.user?.uid;
  if (!userId) throw new Error('Usuario no autenticado. No se puede realizar la operación.');
  return userId;
}

export async function getSubcollectionData(path) {
  const querySnapshot = await getDocs(collection(db, path));
  const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  return data;
}

export async function addData(collectionName, data) {
  const userId = getUserId();
  const path = `users/${userId}/${collectionName}`;
  return await addDoc(collection(db, path), data);
}

export async function deleteFromDb(collectionName, docId) {
  const userId = getUserId();
  const path = `users/${userId}/${collectionName}/${docId}`;
  await deleteDoc(doc(db, path));
}

export async function updateData(collectionName, docId, data) {
  const userId = getUserId();
  const docRef = doc(db, `users/${userId}/${collectionName}`, docId);
  await updateDoc(docRef, data);
}

export async function setData(collectionName, docId, data, merge = false) {
  const userId = getUserId();
  await setDoc(doc(db, `users/${userId}/${collectionName}`, docId), data, { merge });
}

export async function runBatch(writeOperations) {
  const userId = getUserId();
  const batch = writeBatch(db);
  await writeOperations(batch, db, userId);
  await batch.commit();
}
