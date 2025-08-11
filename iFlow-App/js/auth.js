import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  getFunctions,
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';
import {
  doc,
  getDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { auth, db } from './firebase-config.js';
import { setState, resetState, clearFirebaseListeners } from './state.js';
import { loadAllData } from './api.js';

function showAuthError(message) {
  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) {
    alert(message);
    return;
  }
  modalContainer.innerHTML = `<div id="app-modal" class="modal-backdrop"><div class="modal-content"><div class="modal-header"><h3>Error de Autenticación</h3><button class="close-modal-btn text-2xl">&times;</button></div><div class="modal-body"><p>${message}</p></div><div class="modal-footer"><button class="btn-primary close-modal-btn px-4 py-2">Cerrar</button></div></div></div>`;

  const modal = modalContainer.querySelector('#app-modal');
  modal?.addEventListener('click', (e) => {
    if (e.target.id === 'app-modal' || e.target.closest('.close-modal-btn')) {
      modalContainer.innerHTML = '';
    }
  });
}

async function checkSubscription(userId) {
  try {
    const profileRef = doc(db, `users/${userId}/profile/main`);
    const profileDoc = await getDoc(profileRef);

    if (profileDoc.exists) {
      const profileData = profileDoc.data();
      if (profileData.subscriptionStatus === 'active') {
        return true;
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const preapprovalId = urlParams.get('preapproval_id');

    if (preapprovalId) {
      console.log('ID de Pre-aprobación capturado:', preapprovalId);
      console.log('Verificando estado de suscripción con tu servidor Node.js...');

      // ⚠️ Líneas clave: Comunicación con tu servidor Node.js local
      const response = await fetch(`http://localhost:3000/check-subscription/${preapprovalId}`);
      const data = await response.json();

      // Muestra el resultado de la consulta en la consola
      console.log('Información de la suscripción:', data);

      if (data.status === 'authorized') {
        console.log('¡Suscripción activa!');

        const batch = writeBatch(db);
        batch.update(profileRef, {
          subscriptionStatus: 'active',
          mp_preapprovalId: preapprovalId,
        });
        await batch.commit();

        history.replaceState({}, document.title, window.location.pathname);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error al verificar el estado de la suscripción:', error);
    return false;
  }
}

function showSubscriptionPrompt(userId) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
        <div id="subscription-modal" class="modal-backdrop">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Acceso Restringido</h3>
                </div>
                <div class="modal-body">
                    <p>¡Hola! Para acceder a la aplicación, necesitas una suscripción activa.</p>
                    <p>Haz clic en "Pagar" para suscribirte o en "Cerrar Sesión".</p>
                </div>
                <div class="modal-footer flex gap-2 justify-end">
                    <button id="logout-btn" class="btn-secondary px-4 py-2">Cerrar Sesión</button>
                    <button id="pay-btn" class="btn-primary px-4 py-2">Pagar Suscripción</button>
                </div>
            </div>
        </div>
    `;

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    signOut(auth);
    modalContainer.innerHTML = '';
  });

  document.getElementById('pay-btn')?.addEventListener('click', () => {
    const subscriptionUrl =
      'http://localhost:3000/check-subscription/7685da0fece444b88083185c7cd69d53';
    window.location.href = subscriptionUrl;
  });
}

export async function handleRegistration(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = userCredential;

    const batch = writeBatch(db);
    const userRef = doc(db, `users/${user.uid}`);
    batch.set(userRef, {
      email: email,
    });

    const profileRef = doc(db, `users/${user.uid}/profile/main`);
    batch.set(profileRef, {
      businessName: 'Mi Negocio',
      exchangeRate: 1000,
      email: email,
      subscriptionStatus: 'none',
    });

    const capitalRef = doc(db, `users/${user.uid}/capital`, 'summary');
    batch.set(capitalRef, {
      ars: 0,
      usd: 0,
      usdt: 0,
      mp: 0,
      clientDebt: 0,
      debt: 0,
    });

    await batch.commit();
  } catch (error) {
    let friendlyMessage = 'Ocurrió un error durante el registro.';
    if (error.code === 'auth/email-already-in-use') {
      friendlyMessage = 'Este correo ya está en uso.';
    } else if (error.code === 'auth/weak-password') {
      friendlyMessage = 'La contraseña es demasiado débil.';
    }
    showAuthError(friendlyMessage);
    throw error;
  }
}

export async function handleLogin(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    let friendlyMessage = 'El correo o la contraseña son incorrectos.';
    if (error.code === 'auth/invalid-email') {
      friendlyMessage = 'El formato del correo electrónico no es válido.';
    } else if (
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/wrong-password' ||
      error.code === 'auth/invalid-credential'
    ) {
      friendlyMessage = 'El correo o la contraseña son incorrectos.';
    }
    showAuthError(friendlyMessage);
    throw error;
  }
}

export function initializeAuth() {
  const authContainer = document.getElementById('auth-container');
  const appContainer = document.getElementById('app-container');
  const initialLoadingContainer = document.getElementById('initial-loading-container');

  onAuthStateChanged(auth, async (user) => {
    initialLoadingContainer?.classList.add('hidden');

    if (user) {
      const hasActiveSubscription = await checkSubscription(user.uid);
      if (hasActiveSubscription) {
        authContainer?.classList.add('hidden');
        appContainer?.classList.remove('hidden');
        setState({
          user: {
            uid: user.uid,
            email: user.email,
          },
          isDataLoading: true,
        });
        loadAllData(user.uid);
      } else {
        authContainer?.classList.add('hidden');
        appContainer?.classList.remove('hidden');
        showSubscriptionPrompt(user.uid);
      }
    } else {
      authContainer?.classList.remove('hidden');
      appContainer?.classList.add('hidden');
      clearFirebaseListeners();
      resetState();
      document.getElementById('modal-container').innerHTML = '';
    }
  });
}
