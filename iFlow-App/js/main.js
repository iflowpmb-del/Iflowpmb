import { initializeAuth } from './auth.js';
import { subscribe } from './state.js';
import { renderApp } from './ui.js';
import { setupEventListeners } from './events.js';

// Bandera para controlar si el shell de la app se ha creado en el DOM
let appIsInitialized = false;

subscribe((newState) => {
    const appContainer = document.getElementById('app-container');
    
    // Si hay un usuario y el shell no se ha creado...
    if (newState.user && !appIsInitialized) {
        console.log('[MAIN] Usuario detectado, creando el shell de la aplicación...');
        const template = document.getElementById('all-app-content-template');

        if (appContainer && template) {
            appContainer.innerHTML = ''; // Limpiamos por si acaso
            const clone = template.content.cloneNode(true);
            appContainer.appendChild(clone);
            console.log('[MAIN] Shell de la aplicación clonado y añadido al DOM.');
            appIsInitialized = true; // Marcamos como creada
        } else {
            console.error('[MAIN-ERROR] No se encontró #app-container o #all-app-content-template en index.html.');
            return;
        }
    }
    // Si no hay usuario y el shell sí existe...
    else if (!newState.user && appIsInitialized) {
        console.log('[MAIN] Usuario cerró sesión. Limpiando el DOM y reseteando bandera.');
        if (appContainer) {
            appContainer.innerHTML = ''; // Borramos todo el contenido de la app
        }
        appIsInitialized = false; // Marcamos como destruida
    }

    // Si el shell de la app existe, la renderizamos con el estado actual.
    if (appIsInitialized) {
        renderApp(newState);
    }
});

// Punto de entrada de toda la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Los event listeners se configuran UNA SOLA VEZ al inicio.
    setupEventListeners();
    console.log('[MAIN] Event listeners configurados globalmente.');

    // Se inicializa la autenticación.
    initializeAuth();
});
