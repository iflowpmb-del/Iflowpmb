// index.js (dentro de la carpeta /functions)

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const mercadopago = require('mercadopago');

// Inicializa Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Configura el SDK de Mercado Pago con tu Access Token
// ¡IMPORTANTE! Usa el comando que ejecutaste para guardar tu token de forma segura.
// firebase functions:config:set mercadopago.access_token="TU_ACCESS_TOKEN"
mercadopago.configure({
  access_token: functions.config().mercadopago.access_token,
});

/**
 * Crea un plan de suscripción y una preferencia de pago en Mercado Pago.
 * Se activa cuando se le llama desde la aplicación.
 */
exports.createMercadoPagoSubscription = functions.https.onCall(async (data, context) => {
  // Verifica que el usuario esté autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'El usuario debe estar autenticado para crear una suscripción.'
    );
  }

  const userId = context.auth.uid;
  const userEmail = context.auth.token.email || null;

  // Datos del plan de suscripción
  const planData = {
    reason: 'Suscripción mensual iFlow Pro',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 18900, // El precio que definiste
      currency_id: 'ARS',
    },
    back_url: 'https://ifloepmb-desarrollo.web.app/success', // URL a la que volverá el usuario
    payer_email: userEmail,
  };

  try {
    console.log('Creando suscripción en Mercado Pago para el usuario:', userId);
    const response = await mercadopago.preapproval.create(planData);
    const subscriptionLink = response.body.init_point;

    if (!subscriptionLink) {
      throw new Error('No se pudo obtener el init_point de Mercado Pago.');
    }

    console.log('Link de suscripción generado:', subscriptionLink);

    // Guardamos el ID de la suscripción en el perfil del usuario para futuras referencias
    await db.doc(`users/${userId}/profile/main`).set(
      {
        mp_preapproval_id: response.body.id,
      },
      { merge: true }
    );

    // Devolvemos el link a la aplicación cliente
    return { subscriptionUrl: subscriptionLink };
  } catch (error) {
    console.error('Error al crear la suscripción de Mercado Pago:', error);
    throw new functions.https.HttpsError('internal', 'No se pudo crear el link de suscripción.');
  }
});

/**
 * Webhook para recibir notificaciones de Mercado Pago.
 * Actualiza el estado de la suscripción del usuario en Firestore.
 */
exports.mercadoPagoWebhook = functions.https.onRequest(async (req, res) => {
  console.log('Webhook de Mercado Pago recibido.');
  const notification = req.body;

  // Solo nos interesan las notificaciones de suscripciones (preapproval)
  if (
    notification &&
    notification.type === 'preapproval' &&
    notification.data &&
    notification.data.id
  ) {
    const preapprovalId = notification.data.id;
    console.log('Procesando notificación para preapproval_id:', preapprovalId);

    try {
      // Buscamos al usuario que tiene este ID de suscripción
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('mp_preapproval_id', '==', preapprovalId).get();

      if (snapshot.empty) {
        console.warn('No se encontró ningún usuario para el preapproval_id:', preapprovalId);
        res.status(200).send('OK');
        return;
      }

      // Actualizamos el perfil del usuario encontrado
      snapshot.forEach(async (userDoc) => {
        const userId = userDoc.id;
        const profileRef = db.doc(`users/${userId}/profile/main`);

        // Consultamos el estado actual de la suscripción en Mercado Pago
        const mpResponse = await mercadopago.preapproval.findById(preapprovalId);
        const status = mpResponse.body.status;

        console.log(`Usuario ${userId} encontrado. Estado de la suscripción en MP: ${status}`);

        // Mapeamos el estado de MP a nuestro estado interno
        let newSubscriptionStatus = 'pending_payment'; // Por defecto
        if (status === 'authorized') {
          newSubscriptionStatus = 'active';
        } else if (status === 'paused' || status === 'cancelled') {
          newSubscriptionStatus = 'expired';
        }

        await profileRef.update({
          subscriptionStatus: newSubscriptionStatus,
          mp_status: status, // Guardamos el estado real de MP para referencia
        });

        console.log(`Perfil del usuario ${userId} actualizado a: ${newSubscriptionStatus}`);
      });
    } catch (error) {
      console.error('Error al procesar el webhook de Mercado Pago:', error);
      res.status(500).send('Error processing webhook');
      return;
    }
  }

  res.status(200).send('OK');
});
