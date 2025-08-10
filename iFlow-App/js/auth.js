import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { doc, writeBatch } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { auth, db } from './firebase-config.js';
import { setState, resetState, clearFirebaseListeners } from './state.js';
import { loadAllData } from './api.js';

// Muestra un modal de error
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

/**
 * Maneja el registro de un nuevo usuario.
 * Crea el perfil inicial del usuario con el estado de suscripción correcto para iniciar el flujo de prueba.
 * @param {string} email - El correo electrónico del usuario.
 * @param {string} password - La contraseña del usuario.
 */
export async function handleRegistration(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = userCredential;

    console.log(`[AUTH] Creando perfil para nuevo usuario: ${user.uid}`);

    const batch = writeBatch(db);

    // Documento principal del usuario
    const userRef = doc(db, `users/${user.uid}`);
    batch.set(userRef, { email: email });

    // Documento de perfil con estado de suscripción inicial
    const profileRef = doc(db, `users/${user.uid}/profile/main`);
    // MODIFICACIÓN: El estado de suscripción ahora es 'active' por defecto para nuevos usuarios.
    batch.set(profileRef, {
      businessName: 'Mi Negocio',
      exchangeRate: 1000,
      email: email,
      subscriptionStatus: 'active',
    });

    // Documento de capital inicial
    const capitalRef = doc(db, `users/${user.uid}/capital`, 'summary');
    batch.set(capitalRef, { ars: 0, usd: 0, usdt: 0, mp: 0, clientDebt: 0, debt: 0 });

    await batch.commit();
    console.log('[AUTH] Perfil base creado correctamente con estado "active".');
  } catch (error) {
    let friendlyMessage = 'Ocurrió un error durante el registro.';
    if (error.code === 'auth/email-already-in-use') {
      friendlyMessage =
        'Este correo electrónico ya está en uso. Por favor, inicia sesión o utiliza otro correo.';
    } else if (error.code === 'auth/weak-password') {
      friendlyMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
    }
    console.error('Error en handleRegistration:', error);
    showAuthError(friendlyMessage);
    throw error; // Vuelve a lanzar el error para que el llamador pueda manejarlo (ej. detener un spinner)
  }
}

/**
 * Maneja el inicio de sesión de un usuario existente.
 * @param {string} email - El correo electrónico del usuario.
 * @param {string} password - La contraseña del usuario.
 */
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
      friendlyMessage = 'El correo o la contraseña son incorrectos. Por favor, verifica tus datos.';
    }
    console.error('Error en handleLogin:', error);
    showAuthError(friendlyMessage);
    throw error; // Vuelve a lanzar el error
  }
}

/**
 * Inicializa la autenticación y los listeners de la interfaz de usuario para el login/registro.
 */
export function initializeAuth() {
  const authContainer = document.getElementById('auth-container');
  const appContainer = document.getElementById('app-container');
  const initialLoadingContainer = document.getElementById('initial-loading-container');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegisterBtn = document.getElementById('show-register');
  const showLoginBtn = document.getElementById('show-login');

  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', () => {
      if (loginForm && registerForm) {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', () => {
      if (loginForm && registerForm) {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    initialLoadingContainer?.classList.add('hidden');

    if (user) {
      authContainer?.classList.add('hidden');
      appContainer?.classList.remove('hidden');
      setState({ user: { uid: user.uid, email: user.email }, isDataLoading: true });
      loadAllData(user.uid);
    } else {
      authContainer?.classList.remove('hidden');
      appContainer?.classList.add('hidden');
      clearFirebaseListeners();
      resetState();
    }
  });
}
