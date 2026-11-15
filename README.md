# ECG interactif

Cours interactif de lecture de l'ECG, utilisable en projection ou seul.

**En ligne : <https://paulpadovani.github.io/ecg-interactif/>**

Dr Paul Padovani, cardiologie pédiatrique et congénitale, CHU de Nantes.

## Modules

| Module | Contenu |
|---|---|
| **Accueil** | **Nommer le QRS** : règles de nomenclature, atelier où l'on construit un complexe, quiz à révéler. |
| **Méthode** | Lecture systématique en 10 étapes (VIP, rythme, fréquence, axe, P, PR, QRS, ST, T, QT) avec les normes selon l'âge. |
| **Électrodes** | Simulateur 12 dérivations : on déplace les électrodes sur le thorax, l'ECG est recalculé (inversions, dextrocardie, mode défi). |
| **Arythmies** | 11 rythmes animés. Le front d'activation parcourt un schéma du cœur, synchronisé avec DII et le diagramme en échelle. Test à l'adénosine, lecture au ralenti, mode défi. |
| **Infarctus** | On choisit l'artère occluse (IVA proximale ou moyenne, circonflexe, coronaire droite) et on fait avancer le temps : ondes T suraiguës, onde de Pardee, miroir, onde Q, T négative. Coronarographie simulée à partir de vraies images. Péricardite en comparaison. |
| **Métabolique** | Kaliémie, calcémie, température : le complexe se déforme en continu (T pointues, P qui s'efface, QRS large, aspect sinusoïdal ; onde U ; ST long ou court ; onde J d'Osborn). |
| **Cas cliniques** | Tracés réels, lecture guidée puis question, correction et points clés. |

Raccourcis en cours : `F` plein écran, `←` `→` étape ou élément suivant, `Espace` révéler, `1`–`4` répondre, `D` défi dans les modules animés.

## Utiliser en local

Aucune installation : c'est un site statique (HTML, CSS, JavaScript).

```bash
python3 -m http.server 8000
```

puis ouvrir <http://localhost:8000>.

## Organisation des fichiers

```
index.html            page principale : accueil, méthode, simulateur d'électrodes, cas cliniques
css/modules.css       styles des modules ajoutés
js/kit.js             outils communs (signal, animation, listes à révéler)
js/qrs.js             Nommer le QRS (page d'accueil)
js/arythmies.js       atlas des arythmies
js/repol.js           infarctus et coronarographie
js/coro-data.js       données de coronarographie (fichier généré)
js/metabo.js          troubles métaboliques
tools/build_coro.py   préparation des coronarographies à partir des images sources
img/                  tracés ECG des cas et figures du cours
```

Pour régénérer `js/coro-data.js` (Python 3 avec numpy, scipy, opencv, scikit-image, Pillow) :

```bash
python3 tools/build_coro.py
```

## Modèles et limites

- **Tracés simulés.** Les ECG des modules Électrodes, Infarctus, Arythmies et Métabolique sont des modèles pédagogiques, pas des enregistrements. Le 12 dérivations repose sur un dipôle cardiaque unique dans un thorax homogène ; amplitudes, durées et chronologie sont indicatives.
- **Infarctus.** Le sus-décalage est modélisé par un vecteur de lésion dirigé vers le territoire ischémié. La séquence (T suraiguë, Pardee, Q, T négative) est schématique ; la reperfusion la modifie.
- **Métabolique.** Les seuils affichés sont des repères d'enseignement. La relation entre la valeur biologique et l'ECG varie beaucoup d'un patient à l'autre ; un ECG normal n'élimine pas une hyperkaliémie.
- **Coronarographie.** Images réelles, injection et occlusions simulées par traitement d'image (voir [CREDITS.md](CREDITS.md)).

## Sources, crédits, données de patients

Voir [CREDITS.md](CREDITS.md). Les tracés réels ont été désidentifiés avant publication.

## Licence

Code : [PolyForm Noncommercial 1.0.0](LICENSE), usage non commercial. Les images (tracés ECG, coronarographies) relèvent de leurs propres conditions : voir [NOTICE](NOTICE) et [CREDITS.md](CREDITS.md).
