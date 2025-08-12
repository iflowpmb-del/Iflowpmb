import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// ¡IMPORTANTE!
// Estas credenciales deben ser las de tu proyecto en la consola de Firebase.
const firebaseConfig = {
  apiKey: 'AIzaSyBgwTgqaseQEFVLnpHdURN7XnVCTC1DAYc',
  authDomain: 'iflowapp-94b0b.firebaseapp.com',
  projectId: 'iflowapp-94b0b',
  storageBucket: 'iflowapp-94b0b.firebasestorage.app',
  messagingSenderId: '408374534171',
  appId: '1:408374534171:web:0b4050515574c6f40c98be',
  measurementId: 'G-TK91KK97M2',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
