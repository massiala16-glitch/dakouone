/* ============================================================
   DAKOUONE — Cloud Functions (à déployer quand le plan Blaze est actif)
   ------------------------------------------------------------
   C'est ICI qu'est la VRAIE sécurité : tout ce qui suit s'exécute
   côté serveur, hors de portée d'un utilisateur qui bidouille
   le navigateur. Les contrôles côté client (dans index.html) ne
   sont que de la dissuasion + du confort.

   Installation :
     firebase init functions        (Node 20, JavaScript)
     -> coller ce fichier dans functions/index.js
     npm install firebase-admin firebase-functions
     firebase deploy --only functions
   ============================================================ */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();   // base (default)

const DUREE_VIE_MS = 3 * 60 * 60 * 1000;   // 3h
const RAYON_PROXIMITE_M = 1000;            // 1 km
const RAYON_NOTIF_M = 3000;                // 3 km (premium)
const SEUIL_CONFIRMATION = 5;
const SEUIL_ABUS = 3;                       // masquage auto à 3 abus
const MAX_PUB_PAR_HEURE = 15;              // rate-limiting serveur
const DELAI_MIN_MS = 20000;                // 20s entre 2 signalements

/* ============================================================
   CONFIG EMAIL DE MODÉRATION (Brevo)
   ------------------------------------------------------------
   - BREVO_API_KEY : à créer sur brevo.com → SMTP & API → clé API
     Pour la sécurité, on la lit depuis l'environnement (secret).
   - EXPEDITEUR : doit être un email vérifié dans ton compte Brevo.
   - MODERATEURS : la liste des mails qui reçoivent les alertes.
     Ajoute/retire des modos ici puis redéploie les functions.
   ============================================================ */
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const EXPEDITEUR = { email: "massiala16@gmail.com", name: "DAKOUONE Modération" };
const MODERATEURS = [
  "massiala16@gmail.com"
  // , "modo2@exemple.com"   ← ajoute tes modos ici au fil du temps
];

async function envoyerMailModeration(sujet, contenuHtml) {
  if (!BREVO_API_KEY) { console.warn("BREVO_API_KEY manquante, mail non envoyé"); return; }
  try {
    const rep = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        sender: EXPEDITEUR,
        to: MODERATEURS.map((e) => ({ email: e })),
        subject: sujet,
        htmlContent: contenuHtml
      })
    });
    if (!rep.ok) console.error("Brevo erreur:", rep.status, await rep.text());
  } catch (e) { console.error("Envoi mail échoué:", e); }
}

function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*rad) * Math.cos(lat2*rad) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ============================================================
   1. RATE-LIMITING SERVEUR (incontournable)
   À la création d'un signalement, on vérifie la cadence réelle
   de l'auteur. Si dépassée → le signalement est supprimé.
   ============================================================ */
exports.controleCadence = onDocumentCreated("signalements/{sid}", async (event) => {
  const s = event.data.data();
  const ref = event.data.ref;
  const uid = s.creePar;
  if (!uid) return;

  const ilYaUneHeure = Timestamp.fromMillis(Date.now() - 3600000);
  const recents = await db.collection("signalements")
    .where("creePar", "==", uid)
    .where("creeLe", ">", ilYaUneHeure)
    .get();

  // Trop de signalements dans l'heure → on supprime le dernier et on avertit
  if (recents.size > MAX_PUB_PAR_HEURE) {
    await ref.delete();
    await db.collection("utilisateurs").doc(uid)
      .set({ avertissements: FieldValue.increment(1) }, { merge: true });
    return;
  }

  // Délai minimum entre deux signalements
  let tropRapide = false;
  recents.forEach((d) => {
    if (d.id === event.params.sid) return;
    const t = d.data().creeLe?.toMillis?.() || 0;
    if (s.creeLe?.toMillis && s.creeLe.toMillis() - t < DELAI_MIN_MS && t < s.creeLe.toMillis()) {
      tropRapide = true;
    }
  });
  if (tropRapide) { await ref.delete(); }
});

/* ============================================================
   2. MODÉRATION — masquage auto à 3 abus
   ============================================================ */
exports.surAbus = onDocumentCreated(
  { document: "signalements/{sid}/abus/{uid}", secrets: ["BREVO_API_KEY"] },
  async (event) => {
  const ref = db.collection("signalements").doc(event.params.sid);
  await ref.update({ nbAbus: FieldValue.increment(1) });

  const snap = await ref.get();
  const d = snap.data();

  // --- Récupère les noms de l'auteur du contenu et de la personne qui signale ---
  const signaleurUid = event.params.uid;
  let auteurNom = "Inconnu", signaleurNom = "Inconnu";
  try {
    if (d.creePar) {
      const a = (await db.collection("utilisateurs").doc(d.creePar).get()).data() || {};
      auteurNom = `${a.prenom || ""} ${a.nom || ""}`.trim() || a.pseudo || d.creePar;
    }
    const sgn = (await db.collection("utilisateurs").doc(signaleurUid).get()).data() || {};
    signaleurNom = `${sgn.prenom || ""} ${sgn.nom || ""}`.trim() || sgn.pseudo || signaleurUid;
  } catch (e) { console.error(e); }

  // --- Envoi du mail aux modérateurs ---
  const pos = d.position ? `${d.position.latitude.toFixed(4)}, ${d.position.longitude.toFixed(4)}` : "—";
  const sujet = `🚩 DAKOUONE — Abus signalé (${d.nbAbus || 1} au total)`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0d2030">
      <h2 style="color:#ff5340">Signalement d'abus</h2>
      <p>Un contenu vient d'être signalé comme abusif sur DAKOUONE.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 10px;color:#5a6b78">Type de signalement</td><td style="padding:4px 10px"><b>${d.type || "—"}</b></td></tr>
        <tr><td style="padding:4px 10px;color:#5a6b78">Commentaire</td><td style="padding:4px 10px">${(d.commentaire || "—").replace(/</g, "&lt;")}</td></tr>
        <tr><td style="padding:4px 10px;color:#5a6b78">Position</td><td style="padding:4px 10px">${pos}</td></tr>
        <tr><td style="padding:4px 10px;color:#5a6b78">Auteur du contenu</td><td style="padding:4px 10px"><b>${auteurNom}</b></td></tr>
        <tr><td style="padding:4px 10px;color:#5a6b78">Signalé par</td><td style="padding:4px 10px"><b>${signaleurNom}</b></td></tr>
        <tr><td style="padding:4px 10px;color:#5a6b78">Nombre d'abus</td><td style="padding:4px 10px"><b>${d.nbAbus || 1}</b> / ${SEUIL_ABUS} (masquage auto)</td></tr>
      </table>
      <p style="font-size:12px;color:#5a6b78;margin-top:16px">DAKOUONE — Modération automatique</p>
    </div>`;
  await envoyerMailModeration(sujet, html);

  // --- Masquage auto à 3 abus + avertissement à l'auteur ---
  if ((d.nbAbus || 0) >= SEUIL_ABUS && d.verifiePar == null && d.statut !== "masque") {
    await ref.update({ statut: "masque", masqueLe: FieldValue.serverTimestamp() });
    if (d.creePar) {
      await db.collection("utilisateurs").doc(d.creePar).set({
        fiabilite: FieldValue.increment(-2),
        avertissements: FieldValue.increment(1),
        avertissementActif: {
          message: "Un de tes signalements a été masqué après plusieurs signalements d'abus. " +
                   "Après analyse des modérateurs, ton compte pourra être bloqué à vie en cas de récidive. " +
                   "Ne publie que des signalements réels et vérifiables.",
          date: FieldValue.serverTimestamp(),
          lu: false
        }
      }, { merge: true });
    }
  }
});

/* ============================================================
   3. VOTES + proximité serveur + confirmation à 5 + points 🪨
   ============================================================ */
exports.surVote = onDocumentCreated("signalements/{sid}/votes/{uid}", async (event) => {
  const vote = event.data.data();
  const ref = db.collection("signalements").doc(event.params.sid);
  const s = (await ref.get()).data();
  if (!s) return;

  // Re-vérification serveur de la proximité (le client n'est pas une preuve)
  if (!vote.position ||
      distanceM(vote.position.latitude, vote.position.longitude,
                s.position.latitude, s.position.longitude) > RAYON_PROXIMITE_M) {
    await event.data.ref.delete();   // vote hors zone supprimé
    return;
  }

  const champ = vote.sens === "confirme" ? "confirmations" : "infirmations";
  const maj = { [champ]: FieldValue.increment(1) };
  if (vote.sens === "confirme") {
    maj.expireLe = Timestamp.fromMillis(s.expireLe.toMillis() + 30 * 60 * 1000);
  }
  await ref.update(maj);

  const apres = (await ref.get()).data();

  // 5 validations → confirmé + 🪨 +1 pour l'auteur
  if (apres.statut === "actif" && apres.confirmations >= SEUIL_CONFIRMATION) {
    await ref.update({ statut: "confirme" });
    await db.collection("utilisateurs").doc(apres.creePar)
      .update({ points: FieldValue.increment(1), fiabilite: FieldValue.increment(1) });
  }
  // Levée communautaire
  if (apres.infirmations - apres.confirmations >= 3 && apres.verifiePar == null) {
    await ref.update({ statut: "leve" });
  }
});

/* ============================================================
   4. MODÉRATION forces de l'ordre — badge & rejet
   ============================================================ */
exports.surModeration = onDocumentUpdated("signalements/{sid}", async (event) => {
  const avant = event.data.before.data();
  const apres = event.data.after.data();

  if (!avant.verifiePar && apres.verifiePar && avant.statut !== "confirme") {
    await db.collection("utilisateurs").doc(apres.creePar)
      .update({ points: FieldValue.increment(1), fiabilite: FieldValue.increment(1) });
  }
  if (avant.statut !== "rejete" && apres.statut === "rejete") {
    await db.collection("utilisateurs").doc(apres.creePar)
      .update({ points: FieldValue.increment(-5), fiabilite: FieldValue.increment(-2) });
  }
});

/* ============================================================
   5. PURGE des signalements expirés (toutes les 10 min)
   ============================================================ */
exports.purgeExpires = onSchedule("every 10 minutes", async () => {
  const maintenant = Timestamp.now();
  const expires = await db.collection("signalements")
    .where("statut", "in", ["actif", "confirme", "verifie"])
    .where("expireLe", "<", maintenant)
    .get();
  const batch = db.batch();
  expires.forEach((doc) => batch.update(doc.ref, { statut: "expire" }));
  await batch.commit();
});

/* ============================================================
   6. NOTIFICATIONS de proximité (premium + niveau 3 pour tous)
   ============================================================ */
exports.notifierProximite = onDocumentCreated("signalements/{sid}", async (event) => {
  const s = event.data.data();

  let q = db.collection("utilisateurs").where("notifActives", "==", true);
  if (s.niveau < 3) q = q.where("premium", "==", true);
  const cibles = await q.get();

  const tokens = [];
  cibles.forEach((u) => {
    const d = u.data();
    if (!d.positionApprox || u.id === s.creePar) return;
    const dist = distanceM(d.positionApprox.latitude, d.positionApprox.longitude,
                           s.position.latitude, s.position.longitude);
    if (dist <= RAYON_NOTIF_M) tokens.push(...(d.fcmTokens || []));
  });

  if (tokens.length) {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: s.niveau === 3 ? "⚠️ Danger à proximité" : "Signalement près de vous",
        body: `${s.type} signalé à proximité`
      }
    });
  }
});

/* ============================================================
   7. BANNISSEMENT automatique
   Au-delà d'un seuil d'avertissements / fiabilité très négative,
   l'utilisateur est banni (banni:true → bloqué par les règles).
   ============================================================ */
exports.surAvertissement = onDocumentUpdated("utilisateurs/{uid}", async (event) => {
  const apres = event.data.after.data();
  const avant = event.data.before.data();
  if (apres.banni) return; // déjà banni

  const tropDAvertissements = (apres.avertissements || 0) >= 5;
  const fiabiliteEffondree = (apres.fiabilite || 0) <= -10;

  if ((tropDAvertissements || fiabiliteEffondree) &&
      !(avant.avertissements === apres.avertissements && avant.fiabilite === apres.fiabilite)) {
    await event.data.after.ref.update({ banni: true, banniLe: FieldValue.serverTimestamp() });
  }
});

/* ============================================================
   8. CONFIDENTIELS — purge après traitement (optionnel)
   On garde les signalements confidentiels 7 jours puis on purge.
   ============================================================ */
exports.purgeConfidentiels = onSchedule("every 24 hours", async () => {
  const limite = Timestamp.fromMillis(Date.now() - 7 * 24 * 3600 * 1000);
  const vieux = await db.collection("confidentiels")
    .where("creeLe", "<", limite)
    .get();
  const batch = db.batch();
  vieux.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
});
