# DAKOUONE — Passage au plan Blaze & activation du Niveau 2 🛡️

Guide à suivre le jour où tu actives la vraie sécurité serveur + les photos/vocaux.
Projet Firebase : **dakouone-75a8e**

---

## Étape 1 — Activer Blaze (5 min)

1. Console Firebase → ton projet → en bas à gauche, bandeau **« Spark · Mettre à niveau »**
2. Choisis **Blaze** (pay as you go) → ajoute une carte bancaire
   - Tu ne paies que ce que tu consommes
   - Gros quota gratuit inclus (2M invocations de functions/mois)
   - Pour une app en test à Mayotte → tu resteras à **0 € ou quelques centimes**

### ⚠️ Garde-fou OBLIGATOIRE (à faire juste après)
1. https://console.cloud.google.com → ton projet `dakouone-75a8e`
2. Menu → **Facturation** → **Budgets et alertes** → **Créer un budget**
3. Montant : **5 €**, alerte par mail à 50 % / 90 % / 100 %
→ Tu seras prévenu bien avant toute dépense réelle.

---

## Étape 2 — Outils sur ton PC (une seule fois)

Dans le terminal (PowerShell / cmd) :

```bash
npm install -g firebase-tools
firebase login
```

`firebase login` ouvre ton navigateur → connecte-toi avec **massiala16@gmail.com**.

---

## Étape 3 — Initialiser les functions

Depuis ton dossier du projet :

```bash
cd C:\Users\chama\Desktop\DAKOUOINE
firebase init functions
```

Réponses aux questions :
- **Use an existing project** → `dakouone-75a8e`
- **Language** → JavaScript
- **ESLint** → No (plus simple pour démarrer)
- **Install dependencies now** → Yes

Ça crée un dossier `functions/`.

Ensuite, remplace tout le contenu de `functions/index.js` par celui de
**`cloud-functions.js`** (copier-coller intégral), puis :

```bash
cd functions
npm install firebase-admin firebase-functions
cd ..
```

---

## Étape 4 — Déployer les Cloud Functions

```bash
firebase deploy --only functions
```

⏱️ 1 à 2 minutes. À la fin, les 8 functions sont **en ligne et actives
automatiquement**. Elles se déclenchent seules — rien d'autre à faire.

Pour vérifier : console Firebase → **Functions** → tu dois voir la liste
(controleCadence, surAbus, surVote, surModeration, purgeExpires,
notifierProximite, surAvertissement, purgeConfidentiels).

---

## Étape 5 — Activer Storage (photos + vocaux)

Maintenant que Blaze est actif :

1. Console Firebase → **Storage** → **Commencer** → accepte l'emplacement
2. Onglet **Règles** → colle le contenu de `storage.rules` → **Publier**

→ Les **photos** et les **commentaires vocaux** fonctionnent immédiatement,
sans toucher au code (l'app les gère déjà, elle attendait juste Storage).

---

## Ce qui change une fois le Niveau 2 actif

| Avant (client) | Après (serveur, incontournable) |
|----------------|-------------------------------|
| Points 🪨 calculés dans le navigateur | Attribués par Cloud Function (infalsifiables) |
| Votes comptés côté client | Re-vérifiés (proximité serveur) + confirmation à 5 |
| Masquage abus local | Masquage serveur à 3 abus + pénalité auteur |
| Rate-limiting contournable | Rate-limiting réel (suppression auto) |
| Expiration visuelle | Purge serveur toutes les 10 min |
| Bannissement manuel | Bannissement automatique |
| Photos/vocaux bloqués | ✅ Fonctionnels |

→ DAKOUONE devient **réellement blindé**. C'est l'étape indispensable
avant d'ouvrir l'app au public mahorais.

---

## Rappels post-déploiement

- Re-vérifier que `dakouone.netlify.app` est toujours dans les **domaines
  autorisés** (Authentication → Settings).
- Créer ton **compte force de l'ordre** pour tester : dans Firestore, sur ton
  document `utilisateurs/{ton-uid}`, mets `role: "force_ordre"` à la main.
  Tu pourras alors vérifier/rejeter des signalements et voir les confidentiels.
- Les Cloud Functions se mettent à jour par un simple `firebase deploy --only functions`
  à chaque modification.

🌴
