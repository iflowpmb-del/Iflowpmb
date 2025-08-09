import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ¡IMPORTANTE!
// Estas credenciales deben ser las de tu proyecto en la consola de Firebase.
const firebaseConfig = {
          apiKey: "AIzaSyCqj3myx8ATRhHokLGvPsYTVXKblL6XVtk",
    authDomain: "iflow-b0d16.firebaseapp.com",
    projectId: "iflow-b0d16",
    storageBucket: "iflow-b0d16.appspot.com",
    messagingSenderId: "353326889902",
    appId: "1:353326889902:web:df3b426bd733aef74ae63f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);



