// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require("firebase-functions");
// The Firebase Admin SDK to access Firestore.
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

/**
 * Escucha las notificaciones de Gumroad para activar suscripciones.
 * AHORA BUSCA AL USUARIO POR EMAIL, que es un método más fiable.
 */
exports.gumroadWebhookListener = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      functions.logger.warn("Petición recibida con método no permitido:", req.method);
      return res.status(405).send("Method Not Allowed");
    }

    try {
      functions.logger.info("Webhook de Gumroad recibido:", { body: req.body });

      // --- INICIO DE LA MODIFICACIÓN ---
      // Extraemos el email del comprador, que Gumroad siempre envía.
      const email = req.body.email;

      if (!email) {
        functions.logger.error("Error: El webhook de Gumroad no contenía 'email'.", { body: req.body });
        return res.status(400).send("Bad Request: Missing email in webhook payload.");
      }
      
      functions.logger.info(`Webhook recibido para el email: ${email}`);

      const db = admin.firestore();
      
      // Buscamos en la colección 'users' el documento que coincida con ese email.
      const usersRef = db.collection("users");
      const snapshot = await usersRef.where("email", "==", email).limit(1).get();

      if (snapshot.empty) {
        functions.logger.error(`Error: No se encontró ningún usuario con el email: ${email}`);
        return res.status(404).send("User not found for the provided email.");
      }

      // Obtenemos el ID del usuario encontrado.
      const userDoc = snapshot.docs[0];
      const userId = userDoc.id;
      
      functions.logger.info(`Usuario encontrado con ID: ${userId}. Procediendo a activar la prueba.`);
      // --- FIN DE LA MODIFICACIÓN ---

      const profileRef = db.collection("users").doc(userId).collection("profile").doc("main");

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7);

      const profileUpdate = {
        subscriptionStatus: "trial",
        trialEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
        lastWebhookTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      };

      await profileRef.update(profileUpdate);

      functions.logger.info(`¡Éxito! Perfil del usuario ${userId} actualizado a 'trial'.`);

      res.status(200).send("Webhook processed successfully.");

    } catch (error) {
      functions.logger.error("Error catastrófico al procesar el webhook de Gumroad:", error);
      res.status(500).send("Internal Server Error.");
    }
  });
});
