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
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
  setState,
  addFirebaseListener,
  clearFirebaseListeners,
  appState,
  DEFAULT_CATEGORIES,
} from './state.js';

export function loadAllData(userId) {
  if (!userId) return;

  clearFirebaseListeners();
  setState({ isDataLoading: true, isInitialRender: true });

  const collectionsToLoad = {
    // MODIFICACIÓN: El estado por defecto ahora es 'active'
    profile: {
      type: 'doc',
      path: `users/${userId}/profile/main`,
      default: { businessName: 'Mi Negocio', subscriptionStatus: 'active' },
    },
    capital: {
      type: 'doc',
      path: `users/${userId}/capital/summary`,
      default: { ars: 0, usd: 0, usdt: 0, mp: 0, clientDebt: 0, debt: 0 },
    },
    stock: { type: 'collection', path: `users/${userId}/stock` },
    sales: {
      type: 'collection',
      path: `users/${userId}/sales`,
      sorter: (a, b) => (b.soldAt?.toMillis() || 0) - (a.soldAt?.toMillis() || 0),
    },
    clients: { type: 'collection', path: `users/${userId}/clients` },
    categories: { type: 'collection', path: `users/${userId}/categories` },
    debts: { type: 'collection', path: `users/${userId}/debts` },
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
      sorter: (a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0),
    },
  };

  let initialLoadsPending = Object.keys(collectionsToLoad).length;
  let initialLoadFlags = Object.keys(collectionsToLoad).reduce(
    (acc, key) => ({ ...acc, [key]: true }),
    {}
  );

  const onInitialLoad = (collectionName, error = null) => {
    if (error) {
      console.error(`[API Error] Falló la carga inicial de '${collectionName}':`, error);
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

  // Manejo del resto de las colecciones
  for (const [key, config] of Object.entries(collectionsToLoad)) {
    // *** INICIO DE CORRECCIÓN: Se manejan las categorías de forma especial primero ***
    if (key === 'categories') {
      const categoriesCollectionRef = collection(db, `users/${userId}/categories`);
      const categoriesUnsubscribe = onSnapshot(
        query(categoriesCollectionRef),
        async (snapshot) => {
          if (snapshot.empty && initialLoadFlags.categories) {
            console.log(
              `[API] La colección de categorías está vacía para el usuario ${userId}. Creando categorías por defecto.`
            );
            const batch = writeBatch(db);
            DEFAULT_CATEGORIES.forEach((category) => {
              const categoryRef = doc(db, `users/${userId}/categories`, category.id);
              const { id, ...categoryData } = category;
              batch.set(categoryRef, categoryData);
            });
            await batch.commit();
          } else {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setState({ categories: data });
          }
          onInitialLoad('categories');
        },
        (error) => {
          onInitialLoad('categories', error);
          setState({ categories: [] });
        }
      );
      addFirebaseListener(categoriesUnsubscribe);
      continue; // Se salta el resto del bucle para esta clave
    }
    // *** FIN DE CORRECCIÓN ***

    const queryRef =
      config.type === 'doc' ? doc(db, config.path) : query(collection(db, config.path));

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        let data;
        if (config.type === 'doc') {
          data = snapshot.exists() ? { ...config.default, ...snapshot.data() } : config.default;

          // MODIFICACIÓN: Se elimina toda la lógica de suscripción y período de prueba.
          // El chequeo de `subscriptionStatus` y `trialEndDate` ya no es necesario.
        } else {
          data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          if (config.sorter) data.sort(config.sorter);
        }
        setState({ [key]: data });
        onInitialLoad(key);
      },
      (error) => {
        onInitialLoad(key, error);
        if (config.type === 'collection') setState({ [key]: [] });
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
