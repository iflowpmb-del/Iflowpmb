// C:\Users\jmarr\iFlow-App\functions\index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

// Configura tu access token de Mercado Pago como una variable de entorno.
// NO lo pongas aquí directamente.
const mpAccessToken = functions.config().mercadopago.access_token;

exports.getSubscriptionStatus = functions.https.onCall(async (data, context) => {
  // Asegúrate de que el usuario esté autenticado.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'La función debe ser llamada por un usuario autenticado.'
    );
  }

  const { preapprovalId } = data;

  if (!preapprovalId) {
    throw new functions.https.HttpsError('invalid-argument', "El 'preapprovalId' es obligatorio.");
  }

  try {
    const url = `https://api.mercadopago.com/v1/preapproval/${preapprovalId}`;

    // Realiza la solicitud a la API de Mercado Pago.
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
      },
    });

    const preapprovalData = response.data;
    const status = preapprovalData.status;

    // Retorna un objeto con el estado de la suscripción.
    // 'authorized' es el estado de éxito.
    return { status: status };
  } catch (error) {
    console.error('Error al obtener el estado de la suscripción:', error);
    // Retorna un error si la solicitud falla (ej. si el preapproval_id no existe).
    return { status: 'error', message: error.response?.data?.message || error.message };
  }
});
