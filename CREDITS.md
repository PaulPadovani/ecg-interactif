# Sources et crédits

## Coronarographies (module « Infarctus »)

La coronarographie simulée part de deux vraies images publiées sur Wikimedia Commons.

| Vue | Fichier source | Auteur | Licence |
|---|---|---|---|
| Coronaire gauche | [CAG+PTCA 67Yrs Male (50).jpg](https://commons.wikimedia.org/wiki/File:CAG%2BPTCA_67Yrs_Male_(50).jpg) | Suyash Dwivedi | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Coronaire droite | [HWI PTCA.jpg](https://commons.wikimedia.org/wiki/File:HWI_PTCA.jpg) (moitié droite, après angioplastie) | JHeuser (Wikipédia en allemand) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

**Modifications** (script `tools/build_coro.py`) : recadrage, passage en niveaux de gris, extraction de l'arbre coronaire, reconstruction du fond sans les vaisseaux, calcul du temps d'arrivée du produit de contraste le long de l'arbre, et des territoires situés en aval de chaque site d'occlusion. L'injection et les occlusions affichées sont **simulées** à partir de ces données ; elles ne correspondent pas à l'état réel des patients photographiés. Les sites d'occlusion et l'identification des branches ont été placés par lecture visuelle et sont à valider par un cardiologue interventionnel.

Les images dérivées (`js/coro-data.js`) sont diffusées sous CC BY-SA 4.0.

## Tracés ECG (dossier `img/`)

Les tracés et figures proviennent du cours « ECG de l'enfant » (diapositives et Keynote) et du quiz de fin de stage USIC 2022. Plusieurs portent la marque d'une source tierce, citée dans l'outil quand elle est connue :

| Image(s) | Marque visible sur l'image |
|---|---|
| `inv_v1v2`, `inv_v1v2_r`, `normal_enfant`, `normal_adulte`, `sinus_coro_r`, `vvi_fa`, `trin_r` | P. Taboulet / e-cardiogram |
| `trin`, `trin_r`, `fig_repol` | « ECG de A à Z » |
| `inv_bdbg`, `sinus_coro_r` | © Cardiology Technologies |
| `idm_inf` | logo ALiEM |
| `fig_evol` | A. Maltret (figure du cours) |

Ces images restent la propriété de leurs auteurs. Avant toute diffusion publique, vérifier que leur usage pédagogique en ligne est autorisé.

**Données de patients.** Les tracés réels ont été désidentifiés : nom manuscrit, numéro de patient, étiquette à code-barres, identifiant d'examen, dates et heures d'examen et nom d'établissement ont été masqués sur 12 images (15 novembre 2026). Les originaux sont conservés hors du dépôt.

## Normes et contenu médical

Normes pédiatriques et textes de la méthode : cours « ECG de l'enfant » (Dupuis C. et al., d'après Davignon A. et al. pour la fréquence cardiaque ; tables du cours pour PR, QRS et QT). Références pédagogiques citées sur la page d'accueil de l'outil.
