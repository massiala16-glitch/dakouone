# DAKOUONE — Déploiement pour tester sur ton téléphone 🌴

Ton fichier `dakouone.html` est déjà branché sur ton projet `dakouone-75a8e`.
Voici les étapes restantes, dans l'ordre.

---

## ✅ Étape 1 — Activer les services (console Firebase)

Déjà en cours de ton côté :

- **Authentication** → activer **Téléphone** + ajouter le numéro de test
  `+262639000000` / code `123456`
- **Firestore Database** → créer, mode production, région europe-west,
  garder le nom **(default)**
- **Storage** → Commencer

---

## ✅ Étape 2 — Coller les règles de sécurité

**Firestore** : console → Firestore Database → onglet **« Règles »**
→ efface tout → colle le contenu de `firestore.rules` → **Publier**

**Storage** : console → Storage → onglet **« Règles »**
→ efface tout → colle le contenu de `storage.rules` → **Publier**

Sans ça : soit l'app est bloquée (rien ne s'enregistre), soit grande ouverte.

---

## ✅ Étape 3 — Mettre en ligne (obligatoire pour le GPS)

⚠️ Le contrôle de proximité (GPS) et les notifications **exigent le HTTPS**.
Ouvrir le fichier en double-clic (`file://`) ne suffira donc pas pour tout tester.
Mais la mise en ligne est gratuite et prend 3 minutes :

### Option simple : Netlify Drop (comme CleanAuto)
1. Va sur **https://app.netlify.com/drop**
2. Glisse-dépose le fichier `dakouone.html` (ou tout le dossier `dakouone-app`)
3. Netlify te donne une URL du type `https://xxxxx.netlify.app`
4. Si tu as glissé le fichier seul, l'URL sera `.../dakouone.html` ;
   si tu veux l'avoir à la racine, renomme-le `index.html` avant de glisser

### Étape 3 bis — Autoriser ton domaine Netlify dans Firebase
**Important sinon le SMS / reCAPTCHA sera refusé :**
console → Authentication → **Settings** → **Domaines autorisés**
→ **Ajouter un domaine** → colle ton domaine Netlify (ex. `xxxxx.netlify.app`,
sans `https://`)

---

## ✅ Étape 4 — Tester sur ton téléphone

1. Ouvre l'URL Netlify dans le navigateur de ton téléphone
2. La carte de Mayotte doit s'afficher (vide au début, c'est normal)
3. Touche **Signaler** → la fenêtre de connexion s'ouvre
4. Connecte-toi avec le **numéro de test** `639000000` (indicatif +262)
   → code `123456` (aucun vrai SMS envoyé)
5. Autorise la **géolocalisation** quand le navigateur le demande
6. Crée un signalement → il apparaît sur la carte
7. Rouvre l'URL sur un 2e appareil (ou l'ordi) → le signalement apparaît
   **en temps réel** 🎉

### Vérifier que les données arrivent bien
Console Firebase → Firestore Database → onglet **Données** : tu dois voir
apparaître les collections `signalements` et `utilisateurs`.

---

## 📋 Ce qui marche déjà à ce stade

- Carte temps réel, signalement, photos, votes, contrôle de proximité
- Inscription téléphone, profil, pseudo, points 🪨 (côté client)
- Premium et notifications (simulés visuellement)

## ⏳ Ce qui demandera les Cloud Functions (plus tard, plan Blaze)

- Comptage fiable des votes + passage automatique en « confirmé » à 5
- Attribution/retrait des points 🪨 côté serveur (anti-triche)
- Purge automatique des signalements expirés
- Notifications push réelles (FCM) aux abonnés premium
- Paiement Stripe réel pour le premium et la vérification d'identité

Pour l'instant, **pas besoin du plan Blaze** : le plan gratuit Spark suffit
pour tester toute l'interface et le temps réel. On activera Blaze + Functions
quand tu voudras passer aux vraies notifications et au paiement.

🌴
