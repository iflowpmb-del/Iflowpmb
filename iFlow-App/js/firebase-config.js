import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// ¡IMPORTANTE!
// Estas credenciales deben ser las de tu proyecto en la consola de Firebase.
const firebaseConfig = {
  apiKey: 'AIzaSyDkvzx0qjJUW-mrsECP6RWEjTPzeyiRDU0',
  authDomain: 'ifloepmb-desarrollo.firebaseapp.com',
  projectId: 'ifloepmb-desarrollo',
  storageBucket: 'ifloepmb-desarrollo.firebasestorage.app',
  messagingSenderId: '785718569438',
  appId: '1:785718569438:web:e00df90c0cd29df4d6d54f',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
