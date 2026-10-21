<p align="center"><img src="docs/images/logo.svg" width="96" alt="Kanban.md logo"></p>

<h1 align="center">Kanban.md</h1>

<p align="center"><strong>Un tableau Kanban qui vit dans de simples fichiers Markdown, partagé entre vous dans le navigateur et vos agents IA en ligne de commande.</strong></p>

<p align="center"><a href="https://ashikahmad.github.io/Kanban.md/app/">Ouvrir l'application</a> · <a href="https://ashikahmad.github.io/Kanban.md/">Site web</a> · <a href="./board/kanban.md">Tableau du projet</a> · <a href="./docs/getting-started.md">Documentation</a></p>

> **[English version](./README.md)** · Kanban.md est né d'un fork de [ioniks/MarkdownTaskManager](https://github.com/ioniks/MarkdownTaskManager) (MPL-2.0) ; voir [À propos de ce fork](docs/about-this-fork.md).
>
> *La documentation détaillée du dossier `docs/` est disponible en anglais uniquement.*

![Tableau Kanban.md](docs/images/app-overview.jpg)
*Le tableau avec les données d'exemple de `docs/demo`.*

Kanban.md transforme deux fichiers Markdown, `kanban.md` et `archive.md`, en un tableau interactif. L'application tient dans un seul fichier HTML qui s'exécute dans votre navigateur et lit et écrit directement dans votre dossier. Pas de serveur, pas de compte, pas de base de données : vos tâches restent dans des fichiers que vous pouvez lire, modifier, comparer et versionner.

## Ce que vous obtenez

- **Vos tâches, sous forme de fichiers.** Du Markdown pur, qui fonctionne dans n'importe quel éditeur et s'affiche correctement dans n'importe quel lecteur Markdown, y compris GitHub.
- **Compatible avec git.** Les modifications sont de petits correctifs ligne par ligne : déplacer une carte modifie une seule ligne, et les diffs restent lisibles.
- **Un vrai tableau.** Colonnes par glisser-déposer que vous définissez, sous-tâches avec barres de progression, priorités, étiquettes, catégories, assignations, échéances, recherche, filtres, archives, plusieurs projets, thèmes clair et sombre, et quatre langues d'interface.
- **Humains et IA en même temps.** Une CLI et un serveur MCP permettent aux agents de lire et de modifier le tableau en toute sécurité pendant que vous l'utilisez dans le navigateur. Les changements apparaissent des deux côtés en quelques secondes, et les modifications simultanées sont fusionnées, jamais écrasées.
- **Économe pour l'IA.** Un agent lit quelques centaines de jetons au lieu du tableau entier. La question « que contient cette colonne ? » sur un tableau de 100 tâches coûte environ 1 000 jetons au lieu d'environ 20 000.
- **Privé par construction.** Rien ne quitte votre machine. Pas de télémétrie, pas de CDN, fonctionne hors ligne.
- **Évolue en douceur.** Rappels de rangement, fichier de backlog séparé facultatif et ordre manuel des cartes facultatif gardent les gros tableaux rapides.
- **Partageable.** Copiez une tâche en texte brut ou en bloc Markdown qu'un autre tableau peut importer.

## Là où il brille

- Les développeurs qui veulent leurs tâches à côté de leur code, dans le même dépôt et les mêmes pull requests.
- Les petites équipes qui partagent un tableau via git.
- Tous ceux qui travaillent avec des assistants de code IA et veulent une trace claire de ce qui a été demandé et fait.
- Les personnes qui tiennent à posséder leurs données et à pouvoir les ouvrir dans un éditeur de texte.

## Ce pour quoi il n'est pas fait

- **Pas un service hébergé.** Pas de comptes, de permissions, de notifications ni de co-édition en direct. Les équipes partagent un tableau via git ou un dossier synchronisé.
- **Pas un serveur ni une API.** Les agents utilisent la CLI et le serveur MCP ; il n'y a pas d'API HTTP.
- **Pas pour tous les navigateurs.** Il faut un navigateur de bureau basé sur Chromium (Chrome, Edge, Opera, Brave). Firefox, Safari et iOS ne sont pas pris en charge.
- **Pas un outil de reporting.** Pas encore de graphiques ni de suivi du temps.

## Installation et premier lancement

1. Téléchargez [`kanbanmd.html`](kanbanmd.html).
2. Ouvrez-le dans Chrome, Edge, Opera ou Brave.
3. Choisissez un dossier. S'il est vide, l'application crée `kanban.md` et `archive.md` pour vous.

Envie de jeter un œil d'abord ? Choisissez le dossier [`docs/demo`](docs/demo) : un tableau d'exemple avec des tâches fictives.

D'autres options, dont garder l'application à un endroit partagé et l'utiliser sur plusieurs projets, sont décrites dans [Getting started](docs/getting-started.md) (en anglais).

## Utilisation avec des agents IA

```bash
npm run mcp:install      # une fois, dans ce dépôt
claude mcp add kanban -- node /chemin/vers/Kanban.md/mcp/server.js --dir /chemin/vers/votre/projet
```

Les mêmes opérations sont disponibles depuis le shell avec la CLI `kanbanmd` (`node cli/kanbanmd.js --dir . board --status in-progress`). Copiez [`AI_WORKFLOW.md`](AI_WORKFLOW.md) dans votre projet pour que votre assistant connaisse les règles, et consultez [Working with AI agents](docs/ai-agents.md) (en anglais) pour les outils, les modèles par assistant et la skill Claude Code.

## Documentation

La documentation détaillée est en anglais :

| | |
|---|---|
| [Getting started](docs/getting-started.md) | Prérequis, options d'installation, emplacement des fichiers, confidentialité |
| [Using the board](docs/using-the-board.md) | Tâches, filtres, archives, projets, fonctions facultatives |
| [Working with AI agents](docs/ai-agents.md) | Serveur MCP, CLI, configuration des assistants, coût en jetons |
| [File format](docs/file-format.md) | `kanban.md` et `archive.md`, configuration, migration |
| [Git and teams](docs/git-and-teams.md) | Partager un tableau, conflits, flux de travail |
| [Development](docs/development.md) | Build, tests, organisation du code, contribution |
| [About this fork](docs/about-this-fork.md) | D'où vient Kanban.md et en quoi il diffère de l'original |

## Et ensuite ?

Le travail du projet est suivi sur son propre tableau : [`board/kanban.md`](board/kanban.md) montre ce qui est fait, en cours, prévu, et les idées à l'étude. Les éléments marqués `#good-first-issue` et `#need-help` sont de bons points de départ si vous voulez contribuer. Les bugs et les demandes sont les bienvenus sous forme d'issues GitHub.

## Licence et crédits

Kanban.md est publié sous [Mozilla Public License 2.0](LICENSE). Il est né d'un fork de [ioniks/MarkdownTaskManager](https://github.com/ioniks/MarkdownTaskManager) et conserve sa licence et ses mentions de copyright. Merci à l'auteur original et à ses contributeurs, ainsi qu'au travail sur la File System Access API dans Chromium, sur laquelle repose l'application.
