# DAKOUONE — Sécurité : état & plan 🛡️

## Ce qui est protégé MAINTENANT (sans Blaze)

### Solide ✅
- **Règles Firestore** : un citoyen ne peut pas s'attribuer le badge gendarmerie,
  se créditer des points, voter/signaler 2 fois, ni lire les signalements
  confidentiels. Bannissement via le champ `banni`.
- **Auth téléphone** : chaque compte est lié à un vrai numéro.
- **Identité vérifiée** requise pour les signalements confidentiels.
- **Protection SMS par région** activée (anti SMS-pumping).

### Dissuasif (côté client — confort, pas sécurité absolue) ⚠️
- Bouton "Signaler un abus" (1 par appareil) + masquage local à 3 abus.
- Rate-limiting client : 20s mini entre 2 signalements, max 15/heure.
- Limite 10 médias / 3h, contrôle de proximité 1 km, expiration 3h.

> ⚠️ Ces contrôles client peuvent être contournés par un utilisateur technique
> (console navigateur, cache vidé). Ils suffisent pour une phase de test entre
> proches, **pas pour un lancement public**.

---

## Le VRAI 100% sécurisé : les Cloud Functions (plan Blaze)

Le fichier `cloud-functions.js` contient tout le code serveur, **incontournable**
car il s'exécute hors de portée du navigateur. Il couvre :

| # | Function | Rôle |
|---|----------|------|
| 1 | `controleCadence` | Rate-limiting RÉEL : supprime tout signalement au-delà de 15/h ou trop rapproché |
| 2 | `surAbus` | Compte les abus, masque automatiquement à 3, pénalise l'auteur |
| 3 | `surVote` | Re-vérifie la proximité serveur, confirme à 5, attribue les points 🪨 |
| 4 | `surModeration` | Badge gendarmerie (+1 🪨) / rejet (-5 🪨) |
| 5 | `purgeExpires` | Supprime les signalements de +3h (toutes les 10 min) |
| 6 | `notifierProximite` | Notifications push premium + niveau 3 pour tous |
| 7 | `surAvertissement` | Bannissement automatique (5 avertissements ou fiabilité ≤ -10) |
| 8 | `purgeConfidentiels` | Purge les signalements confidentiels après 7 jours |

### Déploiement (quand Blaze est actif)

```bash
firebase init functions      # Node 20, JavaScript
# coller cloud-functions.js dans functions/index.js
cd functions
npm install firebase-admin firebase-functions
cd ..
firebase deploy --only functions
```

### Coût attendu
Plan Blaze = "pay as you go". Pour une app en phase de test/lancement à Mayotte,
les Cloud Functions restent quasi gratuites (gros quota offert : 2M invocations/mois).
**Mets un budget d'alerte** : console Google Cloud → Facturation → Budgets et
alertes → ex. alerte à 5 €. Tu seras prévenu bien avant toute dépense réelle.

---

## Ordre de priorité recommandé avant lancement public

1. ✅ **Tests actuels** entre proches — niveau de sécu OK
2. ⏳ **Activer Blaze + déployer les Cloud Functions** → verrouille tout côté serveur
3. ⏳ **Dashboard gendarmerie** → réception des confidentiels + modération + badge
4. ⏳ **Politique de confidentialité (RGPD)** → obligatoire : tu stockes nom, prénom,
   date de naissance, numéro, positions, photos, vocaux. Idéalement minimiser
   (année de naissance plutôt que date exacte, positions approximatives non historisées).
5. ⏳ **CGU** (conditions d'utilisation) + âge minimum affiché

---

## Limite honnête à garder en tête

Aucune app de signalement géolocalisé n'est infalsifiable à 100% : le GPS d'un
téléphone peut être truqué (vrai aussi pour Waze). La défense n'est pas technique
seule, elle est **sociale** : compte vérifié + seuil de 5 personnes différentes +
identité requise pour le confidentiel + bannissement. Le coût de la triche devient
énorme pour un bénéfice nul. C'est le bon équilibre.

🌴
