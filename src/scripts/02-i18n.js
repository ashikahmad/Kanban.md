        // ===== TRANSLATION SYSTEM =====
        let currentLanguage = 'en'; // Default language

        const translations = {
            en: {
                // Page title
                'page.title': 'Kanban.md',

                // Header
                'header.title': 'Kanban.md',
                'header.renameProject': 'Rename project',
                'header.deleteProject': 'Remove project from list',
                'header.folder': 'Folder',
                'header.openUrl': 'Open from a web address…',
                'prompt.boardUrl': 'Address of a board (its kanban.md file or folder, or a GitHub link):',
                'welcome.openUrl': 'Or open a board from a web address',
                'header.home': 'Kanban.md website',
                'header.newTask': 'Task',
                'header.archives': 'Archives',
                'header.columns': 'Columns',
                'menu.language': 'Language',
                'menu.theme': 'Theme',
                'menu.themeAuto': 'Auto',
                'menu.themeLight': 'Light',
                'menu.themeDark': 'Dark',
                'filters.title': 'Filters',

                // Filters
                'filters.tags': 'Tags:',
                'filters.category': 'Category:',
                'filters.user': 'User:',
                'filters.priority': 'Priority:',
                'filters.select': 'Select...',
                'filters.add': '+',
                'filters.clearAll': 'Clear all',
                'filters.search': 'Search in tasks...',
                'filters.searchClear': '',

                // Welcome screen
                'welcome.title': 'Welcome!',
                'welcome.description': 'Select the folder containing your Markdown files (kanban.md and archive.md)',
                'welcome.start': 'Get Started',
                'welcome.howItWorks': 'How does it work?',
                'welcome.step1': 'Click "Get Started" above',
                'welcome.step2': 'Select the folder containing your Markdown files',
                'welcome.step3': 'The app automatically loads kanban.md',
                'welcome.step4': 'Manage your tasks visually with Kanban',
                'welcome.step5': 'Changes are saved to Markdown files',
                'welcome.browserWarning': 'Supported browsers: Chrome 86+, Edge 86+, Opera 72+',

                // Task detail modal
                'taskDetail.title': 'Task Details',
                'taskDetail.close': 'Close',
                'taskDetail.delete': 'Delete',
                'taskDetail.archive': 'Archive',
                'taskDetail.edit': 'Edit',

                // Task form modal
                'taskForm.newTask': 'New Task',
                'taskForm.editTask': 'Edit Task',
                'taskForm.titleLabel': 'Title *',
                'taskForm.columnLabel': 'Column *',
                'taskForm.priorityLabel': 'Priority',
                'taskForm.priorityNone': 'None',
                'taskForm.priorityCritical': 'Critical',
                'taskForm.priorityHigh': 'High',
                'taskForm.priorityMedium': 'Medium',
                'taskForm.priorityLow': 'Low',
                'taskForm.categoryLabel': 'Category',
                'taskForm.categoryPlaceholder': 'Frontend, Backend...',
                'taskForm.assignedLabel': 'Assigned to',
                'taskForm.assignedPlaceholder': '@alice',
                'taskForm.createdLabel': 'Created',
                'taskForm.startedLabel': 'Started',
                'taskForm.dueLabel': 'Due',
                'taskForm.completedLabel': 'Completed',
                'taskForm.tagsLabel': 'Tags',
                'taskForm.tagsPlaceholder': '#bug #feature',
                'taskForm.tagsHelp': 'Separate with spaces',
                'taskForm.descriptionLabel': 'Description',
                'taskForm.subtasksLabel': 'Subtasks',
                'taskForm.subtaskPlaceholder': 'Add a subtask...',
                'taskForm.subtaskAdd': '+ Add',
                'taskForm.notesLabel': 'Notes',
                'taskForm.notesPlaceholder': 'Technical notes, results, decisions, etc...',
                'taskForm.notesHelp': 'Markdown supported: **bold**, *italic*, `code`, lists, links, **Subsections**:',
                'taskForm.cancel': 'Cancel',
                'taskForm.create': 'Create',
                'taskForm.save': 'Save',

                // Columns modal
                'columns.title': 'Manage Columns',
                'columns.add': '+ Add Column',

                // Archives modal
                'archives.title': 'Archives',
                'archives.search': 'Search in archives...',
                'archives.empty': 'No archived tasks',

                // Project selector
                'projects.select': 'Select a project...',

                // Task metadata in detail modal
                'meta.priority': 'Priority',
                'meta.status': 'Status',
                'meta.category': 'Category',
                'meta.assigned': 'Assigned to',
                'meta.created': 'Creation date',
                'meta.started': 'Start date',
                'meta.due': 'Due date',
                'meta.completed': 'Completion date',
                'meta.tags': 'Tags',
                'meta.description': 'Description',
                'meta.subtasks': 'Subtasks ({completed}/{total})',
                'meta.notes': 'Notes',

                // Empty states
                'empty.noTasks': 'No tasks',

                // Buttons and actions
                'action.restore': 'Restore',
                'action.delete': '',
                'action.edit': '',
                'action.moveUp': 'Move up',
                'action.moveDown': 'Move down',

                // Tooltips
                'tooltip.filterByCategory': 'Filter by this category',
                'tooltip.filterByUser': 'Filter by this user',
                'tooltip.filterByTag': 'Filter by this tag',
                'tooltip.filterByPriority': 'Filter by this priority',
                'tooltip.doubleClickEdit': 'Double-click to edit',
                'tooltip.delete': 'Delete',
                'tooltip.overdue': 'Overdue',
                'tooltip.dueSoon': 'Due soon',

                // Notifications
                'notif.folderLoaded': 'Folder loaded successfully!',
                'notif.folderError': 'Error loading folder',
                'notif.initializingFolder': 'Initializing folder...',
                'notif.filesInitialized': 'Files initialized successfully! (kanban.md and archive.md)',
                'notif.filesError': 'Error creating files',
                'notif.projectLoaded': 'Project "{name}" loaded',
                'notif.permissionDenied': 'Permission denied for this project',
                'notif.projectError': 'Error switching project',
                'notif.projectRenamed': 'Project renamed successfully',
                'notif.projectDeleted': 'Project removed from list',
                'notif.renameError': 'Error renaming',
                'notif.projectRestored': 'Project restored automatically',
                'notif.taskMoved': 'Task moved!',
                'notif.reloaded': 'Board updated from disk',
                'share.button': 'Share',
                'share.title': 'Share task',
                'share.text': 'Plain text',
                'share.markdown': 'Markdown',
                'share.includeNotes': 'Include notes',
                'share.includeAssignees': 'Include assignees',
                'share.copy': 'Copy',
                'share.share': 'Share…',
                'share.copied': 'Copied to the clipboard',
                'share.copyFailed': 'Could not copy: select the text and copy it yourself',
                'share.hint': 'Only what you see above is shared, and nothing leaves your browser until you send it. Markdown is the board file format, so another board can import it.',
                'web.readOnly': 'Read-only',
                'web.openFolder': 'Open a local folder',
                'web.openFolderHint': 'Pick a folder on this device to edit a board of your own. This board stays read-only.',
                'web.confirmTitle': 'Open a board from another site?',
                'web.confirmText': 'The board will be downloaded from {host} and shown read-only. Nothing is saved, and nothing is sent to that site except the request for the files.',
                'web.confirmOpen': 'Open board',
                'web.cancel': 'Cancel',
                'web.errorTitle': 'Could not open this board',
                'web.error.invalid': 'The board address must be a web address (http or https).',
                'web.error.notFound': 'There is no kanban.md at this address.',
                'web.error.network': 'The board could not be downloaded. You may be offline, or the site does not let other pages read its files. Raw GitHub links and GitHub Pages work.',
                'web.error.http': 'The site answered with an error ({status}).',
                'web.error.tooLarge': 'The file is too large to open (over 5 MB).',
                'web.error.notBoard': 'This file is not a Kanban.md board.',
                'hk.menu': 'Housekeeping',
                'hk.backlog_large': '{count} tasks in the backlog (limit {max})',
                'hk.splitBtn': 'Move backlog to its own file',
                'backlog.title': 'Backlog',
                'backlog.search': 'Search backlog...',
                'backlog.empty': 'Nothing in the backlog',
                'backlog.open': 'Open backlog',
                'backlog.stub': 'Kept in {file}',
                'backlog.moveTo': 'Move to {name}',
                'backlog.archive': 'Archive',
                'backlog.old': 'old',
                'backlog.menuOn': 'Backlog file: on',
                'backlog.menuOff': 'Backlog file: off',
                'backlog.openMenu': 'Open backlog',
                'backlog.confirmOn': 'Move the {count} task(s) in "{column}" into backlog.md?\n\nThey stay one click away in the Backlog panel, and kanban.md gets smaller.',
                'backlog.confirmOff': 'Bring the {count} backlog task(s) back into kanban.md?',
                'backlog.askColumn': 'Which column is the backlog? ({ids})',
                'backlog.onDone': 'The backlog is now in its own file',
                'backlog.offDone': 'The backlog is back in kanban.md',
                'hk.archive_done': '{count} done task(s) finished {days}+ days ago',
                'hk.stale_backlog': '{count} backlog task(s) older than {days} days (outlined)',
                'hk.board_large': '{count} tasks on the board (limit {max})',
                'hk.archiveBtn': 'Archive done ({count})',
                'hk.snooze': 'Snooze 7 days',
                'hk.dismiss': 'Dismiss',
                'hk.confirmArchive': 'Archive {count} finished task(s)?\n\nThey move to archive.md in one step and can be restored from Archives.',
                'hk.archived': '{count} task(s) archived',
                'hk.staleCard': 'Old backlog task: review, archive or delete it',
                'hk.settingsPrompt': 'Housekeeping policy. Example: done=done after=30d | backlog=backlog after=90d | max=200\n"off" turns the reminders off, "reset" restores the defaults.',
                'hk.saved': 'Housekeeping settings saved',
                'menu.manualOrderOn': 'Manual order: on',
                'menu.manualOrderOff': 'Manual order: off',
                'menu.resetOrderById': 'Reset order by task id',
                'confirm.rememberOrder': 'Remember the order of your cards?\n\nOK: store a number on each task so this order is kept exactly (one-time change to every task, then each move changes two lines).\nCancel: just move the card in the file.',
                'confirm.orderOff': 'Turn manual order off?\n\nThe Order line is removed from every task and cards follow their position in the file.',
                'confirm.resetOrder': 'Reset the order of all cards to task id order?',
                'notif.orderOn': 'Manual order is on',
                'notif.orderOff': 'Manual order is off',
                'notif.orderReset': 'Order reset to task id',
                'notif.saveFailed': 'Could not save the change',
                'notif.mergeFailed': 'The board changed on disk and your change could not be merged ({reason}). The latest version was loaded.',
                'notif.taskRemovedElsewhere': 'Task {id} was removed outside this window.',
                'confirm.taskChangedElsewhere': 'Task {id} was changed outside this window.\n\nOK: load the new values into the form.\nCancel: keep what you typed (it will replace the other change).',
                'notif.taskEdited': 'Task {id} updated!',
                'notif.taskCreated': 'Task {id} created!',
                'notif.taskArchived': 'Task archived!',
                'notif.taskDeleted': 'Task permanently deleted',
                'notif.taskRestored': 'Task restored to its original column!',

                // Prompts and confirmations
                'prompt.projectName': 'Project name (leave empty to use "{name}"):',
                'prompt.renameProject': 'New project name:',
                'prompt.columnName': 'Column name:',
                'prompt.columnId': 'Column ID (e.g., todo, done):',
                'prompt.editSubtask': 'Edit subtask:',
                'confirm.deleteColumn': 'Delete this column?',
                'confirm.deleteSubtask': 'Delete this subtask?',
                'confirm.deleteProject': 'Remove project "{name}" from the recent list?\n\nThis only removes it from the dropdown - your files will not be deleted.',
                'confirm.archiveTask': 'Archive task "{title}"?',
                'confirm.deleteTask': '⚠️ WARNING: Permanently delete task "{title}"?\n\nThis action cannot be undone.',
                'confirm.deleteTaskFromArchive': '⚠️ WARNING: Permanently delete task "{title}"?\n\nThis action cannot be undone.\n\nIf you want to keep it in history, use "Archive" instead.',

                // Alerts
                'alert.browserNotSupported': 'Your browser does not support the File System Access API.\n\nPlease use Chrome 86+, Edge 86+ or Opera 72+.',

                // Subtasks in detail modal
                'subtask.newPlaceholder': 'New subtask...',

                // Markdown generation
                'markdown.archiveTitle': '# Task Archive',
                'markdown.archiveDesc': '> Archived tasks',
                'markdown.archiveSection': '## ✅ Archives',
                'markdown.configSection': '## ⚙️ Configuration',
                'markdown.configColumns': '**Columns**:',
                'markdown.configCategories': '**Categories**:',
                'markdown.configUsers': '**Users**:',
                'markdown.configPriorities': '**Priorities**:',
                'markdown.configTags': '**Tags**:',

                // Language selector
                'language.label': 'Language:',
                'language.en': 'English',
                'language.fr': 'Français',
                'language.de': 'Deutsch',
                'language.zh_cn': '简体中文'
            },
            fr: {
                // Page title
                'page.title': 'Kanban.md',

                // Header
                'header.title': 'Kanban.md',
                'header.renameProject': 'Renommer le projet',
                'header.deleteProject': 'Retirer le projet de la liste',
                'header.folder': 'Dossier',
                'header.openUrl': 'Ouvrir depuis une adresse web…',
                'prompt.boardUrl': 'Adresse d\'un tableau (son fichier kanban.md ou son dossier, ou un lien GitHub) :',
                'welcome.openUrl': 'Ou ouvrir un tableau depuis une adresse web',
                'header.home': 'Site de Kanban.md',
                'header.newTask': 'Tâche',
                'header.archives': 'Archives',
                'header.columns': 'Colonnes',
                'menu.language': 'Langue',
                'menu.theme': 'Thème',
                'menu.themeAuto': 'Auto',
                'menu.themeLight': 'Clair',
                'menu.themeDark': 'Sombre',
                'filters.title': 'Filtres',

                // Filters
                'filters.tags': 'Tags:',
                'filters.category': 'Catégorie:',
                'filters.user': 'Utilisateur:',
                'filters.priority': 'Priorité:',
                'filters.select': 'Sélectionner...',
                'filters.add': '+',
                'filters.clearAll': 'Tout effacer',
                'filters.search': 'Rechercher dans les tâches...',
                'filters.searchClear': '',

                // Welcome screen
                'welcome.title': 'Bienvenue !',
                'welcome.description': 'Sélectionnez le dossier contenant vos fichiers Markdown (kanban.md et archive.md)',
                'welcome.start': 'Commencer',
                'welcome.howItWorks': 'Comment ça marche ?',
                'welcome.step1': 'Cliquez sur "Commencer" ci-dessus',
                'welcome.step2': 'Sélectionnez le dossier contenant vos fichiers Markdown',
                'welcome.step3': 'L\'application charge automatiquement kanban.md',
                'welcome.step4': 'Gérez vos tâches visuellement avec le Kanban',
                'welcome.step5': 'Les modifications sont sauvegardées dans les fichiers Markdown',
                'welcome.browserWarning': 'Navigateurs supportés : Chrome 86+, Edge 86+, Opera 72+',

                // Task detail modal
                'taskDetail.title': 'Détails de la tâche',
                'taskDetail.close': 'Fermer',
                'taskDetail.delete': 'Supprimer',
                'taskDetail.archive': 'Archiver',
                'taskDetail.edit': 'Modifier',

                // Task form modal
                'taskForm.newTask': 'Nouvelle tâche',
                'taskForm.editTask': 'Modifier la tâche',
                'taskForm.titleLabel': 'Titre *',
                'taskForm.columnLabel': 'Colonne *',
                'taskForm.priorityLabel': 'Priorité',
                'taskForm.priorityNone': 'Aucune',
                'taskForm.priorityCritical': 'Critique',
                'taskForm.priorityHigh': 'Haute',
                'taskForm.priorityMedium': 'Moyenne',
                'taskForm.priorityLow': 'Basse',
                'taskForm.categoryLabel': 'Catégorie',
                'taskForm.categoryPlaceholder': 'Frontend, Backend...',
                'taskForm.assignedLabel': 'Assigné à',
                'taskForm.assignedPlaceholder': '@alice',
                'taskForm.createdLabel': 'Créé',
                'taskForm.startedLabel': 'Commencé',
                'taskForm.dueLabel': 'Échéance',
                'taskForm.completedLabel': 'Terminé',
                'taskForm.tagsLabel': 'Tags',
                'taskForm.tagsPlaceholder': '#bug #feature',
                'taskForm.tagsHelp': 'Séparez avec des espaces',
                'taskForm.descriptionLabel': 'Description',
                'taskForm.subtasksLabel': 'Sous-tâches',
                'taskForm.subtaskPlaceholder': 'Ajouter une sous-tâche...',
                'taskForm.subtaskAdd': '+ Ajouter',
                'taskForm.notesLabel': 'Notes',
                'taskForm.notesPlaceholder': 'Notes techniques, résultats, décisions, etc...',
                'taskForm.notesHelp': 'Markdown supporté : **gras**, *italique*, `code`, listes, liens, **Sous-sections**:',
                'taskForm.cancel': 'Annuler',
                'taskForm.create': 'Créer',
                'taskForm.save': 'Enregistrer',

                // Columns modal
                'columns.title': 'Gérer les colonnes',
                'columns.add': '+ Ajouter une colonne',

                // Archives modal
                'archives.title': 'Archives',
                'archives.search': 'Rechercher dans les archives...',
                'archives.empty': 'Aucune tâche archivée',

                // Project selector
                'projects.select': 'Sélectionner un projet...',

                // Task metadata in detail modal
                'meta.priority': 'Priorité',
                'meta.status': 'Statut',
                'meta.category': 'Catégorie',
                'meta.assigned': 'Assigné à',
                'meta.created': 'Date de création',
                'meta.started': 'Date de début',
                'meta.due': 'Date d\'échéance',
                'meta.completed': 'Date de fin',
                'meta.tags': 'Tags',
                'meta.description': 'Description',
                'meta.subtasks': 'Sous-tâches ({completed}/{total})',
                'meta.notes': 'Notes',

                // Empty states
                'empty.noTasks': 'Aucune tâche',

                // Buttons and actions
                'action.restore': 'Restaurer',
                'action.delete': '',
                'action.edit': '',
                'action.moveUp': 'Déplacer vers le haut',
                'action.moveDown': 'Déplacer vers le bas',

                // Tooltips
                'tooltip.filterByCategory': 'Filtrer par cette catégorie',
                'tooltip.filterByUser': 'Filtrer par cet utilisateur',
                'tooltip.filterByTag': 'Filtrer par ce tag',
                'tooltip.filterByPriority': 'Filtrer par cette priorité',
                'tooltip.doubleClickEdit': 'Double-cliquez pour éditer',
                'tooltip.delete': 'Supprimer',
                'tooltip.overdue': 'En retard',
                'tooltip.dueSoon': 'Bientôt dû',

                // Notifications
                'notif.folderLoaded': 'Dossier chargé avec succès !',
                'notif.folderError': 'Erreur lors de la sélection du dossier',
                'notif.initializingFolder': 'Initialisation du dossier...',
                'notif.filesInitialized': 'Fichiers initialisés avec succès ! (kanban.md et archive.md)',
                'notif.filesError': 'Erreur lors de la création des fichiers',
                'notif.projectLoaded': 'Projet "{name}" chargé',
                'notif.permissionDenied': 'Permission refusée pour ce projet',
                'notif.projectError': 'Erreur lors du changement de projet',
                'notif.projectRenamed': 'Projet renommé avec succès',
                'notif.projectDeleted': 'Projet retiré de la liste',
                'notif.renameError': 'Erreur lors du renommage',
                'notif.projectRestored': 'Projet restauré automatiquement',
                'notif.taskMoved': 'Tâche déplacée !',
                'notif.reloaded': 'Tableau mis à jour depuis le disque',
                'share.button': 'Partager',
                'share.title': 'Partager la tâche',
                'share.text': 'Texte brut',
                'share.markdown': 'Markdown',
                'share.includeNotes': 'Inclure les notes',
                'share.includeAssignees': 'Inclure les assignés',
                'share.copy': 'Copier',
                'share.share': 'Partager…',
                'share.copied': 'Copié dans le presse-papiers',
                'share.copyFailed': 'Copie impossible : sélectionnez le texte et copiez-le vous-même',
                'share.hint': 'Seul ce que vous voyez ci-dessus est partagé, et rien ne quitte votre navigateur avant que vous l\'envoyiez. Le Markdown est le format de fichier du tableau : un autre tableau peut l\'importer.',
                'web.readOnly': 'Lecture seule',
                'web.openFolder': 'Ouvrir un dossier local',
                'web.openFolderHint': 'Choisissez un dossier sur cet appareil pour modifier votre propre tableau. Ce tableau reste en lecture seule.',
                'web.confirmTitle': 'Ouvrir un tableau d\'un autre site ?',
                'web.confirmText': 'Le tableau sera téléchargé depuis {host} et affiché en lecture seule. Rien n\'est enregistré, et rien n\'est envoyé à ce site à part la demande des fichiers.',
                'web.confirmOpen': 'Ouvrir le tableau',
                'web.cancel': 'Annuler',
                'web.errorTitle': 'Impossible d\'ouvrir ce tableau',
                'web.error.invalid': 'L\'adresse du tableau doit être une adresse web (http ou https).',
                'web.error.notFound': 'Il n\'y a pas de kanban.md à cette adresse.',
                'web.error.network': 'Le tableau n\'a pas pu être téléchargé. Vous êtes peut-être hors ligne, ou le site ne laisse pas d\'autres pages lire ses fichiers. Les liens GitHub « raw » et GitHub Pages fonctionnent.',
                'web.error.http': 'Le site a répondu par une erreur ({status}).',
                'web.error.tooLarge': 'Le fichier est trop volumineux pour être ouvert (plus de 5 Mo).',
                'web.error.notBoard': 'Ce fichier n\'est pas un tableau Kanban.md.',
                'hk.menu': 'Ménage',
                'hk.backlog_large': '{count} tâches dans le backlog (limite {max})',
                'hk.splitBtn': 'Déplacer le backlog dans son propre fichier',
                'backlog.title': 'Backlog',
                'backlog.search': 'Rechercher dans le backlog...',
                'backlog.empty': 'Le backlog est vide',
                'backlog.open': 'Ouvrir le backlog',
                'backlog.stub': 'Stocké dans {file}',
                'backlog.moveTo': 'Déplacer vers {name}',
                'backlog.archive': 'Archiver',
                'backlog.old': 'ancienne',
                'backlog.menuOn': 'Fichier backlog : activé',
                'backlog.menuOff': 'Fichier backlog : désactivé',
                'backlog.openMenu': 'Ouvrir le backlog',
                'backlog.confirmOn': 'Déplacer les {count} tâche(s) de « {column} » dans backlog.md ?\n\nElles restent à un clic dans le panneau Backlog, et kanban.md devient plus léger.',
                'backlog.confirmOff': 'Remettre les {count} tâche(s) du backlog dans kanban.md ?',
                'backlog.askColumn': 'Quelle colonne est le backlog ? ({ids})',
                'backlog.onDone': 'Le backlog est maintenant dans son propre fichier',
                'backlog.offDone': 'Le backlog est de retour dans kanban.md',
                'hk.archive_done': '{count} tâche(s) terminée(s) depuis plus de {days} jours',
                'hk.stale_backlog': '{count} tâche(s) du backlog de plus de {days} jours (contour pointillé)',
                'hk.board_large': '{count} tâches sur le tableau (limite {max})',
                'hk.archiveBtn': 'Archiver les terminées ({count})',
                'hk.snooze': 'Reporter 7 jours',
                'hk.dismiss': 'Ignorer',
                'hk.confirmArchive': 'Archiver {count} tâche(s) terminée(s) ?\n\nElles passent dans archive.md en une seule étape et peuvent être restaurées depuis les Archives.',
                'hk.archived': '{count} tâche(s) archivée(s)',
                'hk.staleCard': 'Ancienne tâche du backlog : à revoir, archiver ou supprimer',
                'hk.settingsPrompt': 'Règles de ménage. Exemple : done=done after=30d | backlog=backlog after=90d | max=200\n« off » désactive les rappels, « reset » rétablit les valeurs par défaut.',
                'hk.saved': 'Réglages enregistrés',
                'menu.manualOrderOn': 'Ordre manuel : activé',
                'menu.manualOrderOff': 'Ordre manuel : désactivé',
                'menu.resetOrderById': 'Réinitialiser l\'ordre par identifiant',
                'confirm.rememberOrder': 'Mémoriser l\'ordre de vos cartes ?\n\nOK : un numéro est stocké sur chaque tâche pour conserver cet ordre (changement unique, puis chaque déplacement modifie deux lignes).\nAnnuler : déplacer simplement la carte dans le fichier.',
                'confirm.orderOff': 'Désactiver l\'ordre manuel ?\n\nLa ligne Order est retirée de chaque tâche et les cartes suivent leur position dans le fichier.',
                'confirm.resetOrder': 'Réinitialiser l\'ordre de toutes les cartes selon l\'identifiant ?',
                'notif.orderOn': 'Ordre manuel activé',
                'notif.orderOff': 'Ordre manuel désactivé',
                'notif.orderReset': 'Ordre réinitialisé par identifiant',
                'notif.saveFailed': 'Impossible d\'enregistrer la modification',
                'notif.mergeFailed': 'Le tableau a changé sur le disque et votre modification n\'a pas pu être fusionnée ({reason}). La dernière version a été chargée.',
                'notif.taskRemovedElsewhere': 'La tâche {id} a été supprimée en dehors de cette fenêtre.',
                'confirm.taskChangedElsewhere': 'La tâche {id} a été modifiée en dehors de cette fenêtre.\n\nOK : charger les nouvelles valeurs dans le formulaire.\nAnnuler : garder votre saisie (elle remplacera l\'autre modification).',
                'notif.taskEdited': 'Tâche {id} modifiée !',
                'notif.taskCreated': 'Tâche {id} créée !',
                'notif.taskArchived': 'Tâche archivée !',
                'notif.taskDeleted': 'Tâche supprimée définitivement',
                'notif.taskRestored': 'Tâche restaurée dans sa colonne d\'origine !',

                // Prompts and confirmations
                'prompt.projectName': 'Nom du projet (laisser vide pour utiliser "{name}") :',
                'prompt.renameProject': 'Nouveau nom du projet :',
                'prompt.columnName': 'Nom de la colonne:',
                'prompt.columnId': 'ID de la colonne (ex: todo, done):',
                'prompt.editSubtask': 'Modifier la sous-tâche:',
                'confirm.deleteColumn': 'Supprimer cette colonne ?',
                'confirm.deleteSubtask': 'Supprimer cette sous-tâche ?',
                'confirm.deleteProject': 'Retirer le projet "{name}" de la liste récente ?\n\nCeci retire seulement le projet du menu déroulant - vos fichiers ne seront pas supprimés.',
                'confirm.archiveTask': 'Archiver la tâche "{title}" ?',
                'confirm.deleteTask': '⚠️ ATTENTION : Supprimer définitivement la tâche "{title}" ?\n\nCette action est irréversible.',
                'confirm.deleteTaskFromArchive': '⚠️ ATTENTION : Supprimer définitivement la tâche "{title}" ?\n\nCette action est irréversible.\n\nSi vous voulez la conserver dans l\'historique, utilisez plutôt "Archiver".',

                // Alerts
                'alert.browserNotSupported': 'Votre navigateur ne supporte pas la File System Access API.\n\nVeuillez utiliser Chrome 86+, Edge 86+ ou Opera 72+.',

                // Subtasks in detail modal
                'subtask.newPlaceholder': 'Nouvelle sous-tâche...',

                // Markdown generation
                'markdown.archiveTitle': '# Archive des Tâches',
                'markdown.archiveDesc': '> Tâches archivées',
                'markdown.archiveSection': '## ✅ Archives',
                'markdown.configSection': '## ⚙️ Configuration',
                'markdown.configColumns': '**Colonnes**:',
                'markdown.configCategories': '**Catégories**:',
                'markdown.configUsers': '**Utilisateurs**:',
                'markdown.configPriorities': '**Priorités**:',
                'markdown.configTags': '**Tags**:',

                // Language selector
                'language.label': 'Langue :',
                'language.en': 'English',
                'language.fr': 'Français',
                'language.de': 'Deutsch',
                'language.zh_cn': '简体中文'
            },
            de: {
                // Page title
                'page.title': 'Kanban.md',

                // Header
                'header.title': 'Kanban.md',
                'header.renameProject': 'Projekt umbenennen',
                'header.deleteProject': 'Projekt aus Liste entfernen',
                'header.folder': 'Ordner',
                'header.openUrl': 'Von Webadresse öffnen…',
                'prompt.boardUrl': 'Adresse eines Boards (seine kanban.md-Datei oder sein Ordner, oder ein GitHub-Link):',
                'welcome.openUrl': 'Oder ein Board von einer Webadresse öffnen',
                'header.home': 'Kanban.md-Website',
                'header.newTask': 'Aufgabe',
                'header.archives': 'Archiv',
                'header.columns': 'Spalten',
                'menu.language': 'Sprache',
                'menu.theme': 'Design',
                'menu.themeAuto': 'Automatisch',
                'menu.themeLight': 'Hell',
                'menu.themeDark': 'Dunkel',
                'filters.title': 'Filter',

                // Filters
                'filters.tags': 'Tags:',
                'filters.category': 'Kategorie:',
                'filters.user': 'Benutzer:',
                'filters.priority': 'Priorität:',
                'filters.select': 'Auswählen...',
                'filters.add': '+',
                'filters.clearAll': 'Alles löschen',
                'filters.search': 'In Aufgaben suchen...',
                'filters.searchClear': '',

                // Welcome screen
                'welcome.title': 'Willkommen!',
                'welcome.description': 'Wählen Sie den Ordner aus, der die Markdown-Dateien beinhaltet (kanban.md and archive.md)',
                'welcome.start': 'Loslegen',
                'welcome.howItWorks': 'Wie funktioniert es?',
                'welcome.step1': 'Klicken Sie oben auf "Loslegen"',
                'welcome.step2': 'Wählen Sie den Ordner aus, der die Markdown-Dateien beinhaltet',
                'welcome.step3': 'Die App lädt automatisch kanban.md',
                'welcome.step4': 'Verwalten Sie Ihre Aufgaben grafisch mit Kanban',
                'welcome.step5': 'Änderungen werden als Markdown-Datei gespeichert',
                'welcome.browserWarning': 'Unterstützte Browser: Chrome 86+, Edge 86+, Opera 72+',

                // Task detail modal
                'taskDetail.title': 'Aufgabendetails',
                'taskDetail.close': 'Schließen',
                'taskDetail.delete': 'Löschen',
                'taskDetail.archive': 'Archivieren',
                'taskDetail.edit': 'Bearbeiten',

                // Task form modal
                'taskForm.newTask': 'Neue Aufgabe',
                'taskForm.editTask': 'Aufgabe bearbeiten',
                'taskForm.titleLabel': 'Titel *',
                'taskForm.columnLabel': 'Spalte *',
                'taskForm.priorityLabel': 'Priorität',
                'taskForm.priorityNone': 'Ohne',
                'taskForm.priorityCritical': 'Kritisch',
                'taskForm.priorityHigh': 'Hoch',
                'taskForm.priorityMedium': 'Mittel',
                'taskForm.priorityLow': 'Niedrig',
                'taskForm.categoryLabel': 'Kategorie',
                'taskForm.categoryPlaceholder': 'Frontend, Backend...',
                'taskForm.assignedLabel': 'Zugewiesen an',
                'taskForm.assignedPlaceholder': '@alice',
                'taskForm.createdLabel': 'Erstellt',
                'taskForm.startedLabel': 'Begonnen',
                'taskForm.dueLabel': 'Fällig',
                'taskForm.completedLabel': 'Abgeschlossen',
                'taskForm.tagsLabel': 'Tags',
                'taskForm.tagsPlaceholder': '#bug #feature',
                'taskForm.tagsHelp': 'Mit Leerzeichen trennen',
                'taskForm.descriptionLabel': 'Beschreibung',
                'taskForm.subtasksLabel': 'Unteraufgaben',
                'taskForm.subtaskPlaceholder': 'Unteraufgabe hinzufügen...',
                'taskForm.subtaskAdd': '+ Hinzufügen',
                'taskForm.notesLabel': 'Anmerkungen',
                'taskForm.notesPlaceholder': 'Technische Anmerkungen, Ergebnisse, Entscheidungen, etc...',
                'taskForm.notesHelp': 'Markdown-Unterstützung: **fett**, *kursiv*, `code`, Listen, Links, **Abschnitte**:',
                'taskForm.cancel': 'Abbrechen',
                'taskForm.create': 'Erstellen',
                'taskForm.save': 'Speichern',

                // Columns modal
                'columns.title': 'Spalten bearbeiten',
                'columns.add': '+ Spalte hinzufügen',

                // Archives modal
                'archives.title': 'Archiv',
                'archives.search': 'Suche im Archiv...',
                'archives.empty': 'Keine archivierten Aufgaben',

                // Project selector
                'projects.select': 'Wählen Sie ein Projekt...',

                // Task metadata in detail modal
                'meta.priority': 'Priorität',
                'meta.status': 'Status',
                'meta.category': 'Kategorie',
                'meta.assigned': 'Zugewiesen an',
                'meta.created': 'Erstellungsdatum',
                'meta.started': 'Startdatum',
                'meta.due': 'Fälligkeitsdatum',
                'meta.completed': 'Erledigungsdatum',
                'meta.tags': 'Tags',
                'meta.description': 'Beschreibung',
                'meta.subtasks': 'Unteraufgaben ({completed}/{total})',
                'meta.notes': 'Anmerkungen',

                // Empty states
                'empty.noTasks': 'Keine Aufgaben',

                // Buttons and actions
                'action.restore': 'Wiederherstellen',
                'action.delete': '',
                'action.edit': '',
                'action.moveUp': 'Nach oben',
                'action.moveDown': 'Nach unten',

                // Tooltips
                'tooltip.filterByCategory': 'Nach dieser Kategorie filtern',
                'tooltip.filterByUser': 'Nach diesem Benutzer filtern',
                'tooltip.filterByTag': 'Nach diesem Tag filtern',
                'tooltip.filterByPriority': 'Nach dieser Priorität filtern',
                'tooltip.doubleClickEdit': 'Doppelklick zum Bearbeiten',
                'tooltip.delete': 'Löschen',
                'tooltip.overdue': 'Überfällig',
                'tooltip.dueSoon': 'Bald fällig',

                // Notifications
                'notif.folderLoaded': 'Ordner erfolgreich geladen!',
                'notif.folderError': 'Problem beim Laden des Ordners',
                'notif.initializingFolder': 'Ordner wird initialisiert...',
                'notif.filesInitialized': 'Dateien erfolgreich initialisiert! (kanban.md and archive.md)',
                'notif.filesError': 'Problem beim Erstellen der Dateien',
                'notif.projectLoaded': 'Projekt "{name}" geladen',
                'notif.permissionDenied': 'Zugriff verweigert für dieses Projekt',
                'notif.projectError': 'Problem beim Wechseln des Projekts',
                'notif.projectRenamed': 'Projekt erfolgreich umbenannt',
                'notif.projectDeleted': 'Projekt aus Liste gelöscht',
                'notif.renameError': 'Problem beim Umbenennen',
                'notif.projectRestored': 'Projekt erfolgreich wiederhergestellt',
                'notif.taskMoved': 'Aufgabe verschoben!',
                'notif.taskEdited': 'Aufgabe {id} aktualisiert!',
                'notif.taskCreated': 'Aufgabe {id} erstellt!',
                'notif.taskArchived': 'Aufgabe archiviert!',
                'notif.taskDeleted': 'Aufgabe endgültig gelöscht',
                'notif.taskRestored': 'Aufgabe in ursprünglicher Spalte zurückgesetzt!',

                // Prompts and confirmations
                'prompt.projectName': 'Projektname (leer lassen, um "{name}" zu verwenden):',
                'prompt.renameProject': 'Neuer Projektname:',
                'prompt.columnName': 'Spaltenname:',
                'prompt.columnId': 'Spalten-ID (z.B., todo, done):',
                'prompt.editSubtask': 'Unteraufgabe bearbeiten:',
                'confirm.deleteColumn': 'Diese Spalte löschen?',
                'confirm.deleteSubtask': 'Diese Unteraufgabe löschen?',
                'confirm.deleteProject': 'Projekt "{name}" aus Liste löschen?\n\nDas Projekt wird nur aus der Liste gelöscht. Die Dateien bleiben bestehen.',
                'confirm.archiveTask': 'Aufgabe "{title}" archivieren?',
                'confirm.deleteTask': '⚠️ WARNUNG: Aufgabe "{title}" endgültig löschen?\n\nDies kann nicht rückgängig gemacht werden.',
                'confirm.deleteTaskFromArchive': '⚠️ WARNUNG: Aufgabe "{title}" endgültig löschen?\n\nDies kann nicht rückgängig gemacht werden.\n\nWenn die Aufgabe in der Historie vorgehalten werden soll, klicken Sie stattdessen auf "Archivieren".',

                // Alerts
                'alert.browserNotSupported': 'Ihr Browser unterstützt die File System Access API nicht.\n\Bitte Chrome 86+, Edge 86+ oder Opera 72+ nutzen.',

                // Subtasks in detail modal
                'subtask.newPlaceholder': 'Neue Unteraufgabe...',

                // Markdown generation
                'markdown.archiveTitle': '# Aufgaben-Archiv',
                'markdown.archiveDesc': '> Archivierte Aufgaben',
                'markdown.archiveSection': '## ✅ Archiv',
                'markdown.configSection': '## ⚙️ Konfiguration',
                'markdown.configColumns': '**Spalten**:',
                'markdown.configCategories': '**Kategorien**:',
                'markdown.configUsers': '**Benutzer**:',
                'markdown.configPriorities': '**Prioritäten**:',
                'markdown.configTags': '**Tags**:',

                // Language selector
                'language.label': 'Sprache:',
                'language.en': 'English',
                'language.fr': 'Français',
                'language.de': 'Deutsch'
            },
            zh_cn: {
                // Page title
                'page.title': 'Kanban.md',

                // Header
                'header.title': 'Kanban.md',
                'header.renameProject': '重命名项目',
                'header.deleteProject': '从列表中移除项目',
                'header.folder': '文件夹',
                'header.openUrl': '从网址打开…',
                'prompt.boardUrl': '看板地址（其 kanban.md 文件或文件夹，或 GitHub 链接）：',
                'welcome.openUrl': '或从网址打开看板',
                'header.home': 'Kanban.md 网站',
                'header.newTask': '任务',
                'header.archives': '归档',
                'header.columns': '列设置',
                'menu.language': '语言',
                'menu.theme': '主题',
                'menu.themeAuto': '自动',
                'menu.themeLight': '浅色',
                'menu.themeDark': '深色',
                'filters.title': '筛选',

                // Filters
                'filters.tags': '标签:',
                'filters.category': '类别:',
                'filters.user': '用户:',
                'filters.priority': '优先级:',
                'filters.select': '选择...',
                'filters.add': '+',
                'filters.clearAll': '清空全部',
                'filters.search': '在任务中搜索...',
                'filters.searchClear': '',

                // Welcome screen
                'welcome.title': '欢迎!',
                'welcome.description': '选择包含您 Markdown 文件的文件夹 (kanban.md 和 archive.md)',
                'welcome.start': '开始使用',
                'welcome.howItWorks': '工作原理?',
                'welcome.step1': '点击上方的"开始使用"',
                'welcome.step2': '选择包含您 Markdown 文件的文件夹',
                'welcome.step3': '应用将自动加载 kanban.md',
                'welcome.step4': '通过看板可视化地管理任务',
                'welcome.step5': '更改将保存到 Markdown 文件中',
                'welcome.browserWarning': '支持的浏览器: Chrome 86+, Edge 86+, Opera 72+',

                // Task detail modal
                'taskDetail.title': '任务详情',
                'taskDetail.close': '关闭',
                'taskDetail.delete': '删除',
                'taskDetail.archive': '归档',
                'taskDetail.edit': '编辑',

                // Task form modal
                'taskForm.newTask': '新建任务',
                'taskForm.editTask': '编辑任务',
                'taskForm.titleLabel': '标题 *',
                'taskForm.columnLabel': '列 *',
                'taskForm.priorityLabel': '优先级',
                'taskForm.priorityNone': '无',
                'taskForm.priorityCritical': '紧急',
                'taskForm.priorityHigh': '高',
                'taskForm.priorityMedium': '中',
                'taskForm.priorityLow': '低',
                'taskForm.categoryLabel': '类别',
                'taskForm.categoryPlaceholder': '前端、后端...',
                'taskForm.assignedLabel': '分配给',
                'taskForm.assignedPlaceholder': '@用户名',
                'taskForm.createdLabel': '创建于',
                'taskForm.startedLabel': '开始于',
                'taskForm.dueLabel': '截止于',
                'taskForm.completedLabel': '完成于',
                'taskForm.tagsLabel': '标签',
                'taskForm.tagsPlaceholder': '#bug #feature',
                'taskForm.tagsHelp': '用空格分隔',
                'taskForm.descriptionLabel': '描述',
                'taskForm.subtasksLabel': '子任务',
                'taskForm.subtaskPlaceholder': '添加子任务...',
                'taskForm.subtaskAdd': '+ 添加',
                'taskForm.notesLabel': '备注',
                'taskForm.notesPlaceholder': '技术备注、结果、决策等...',
                'taskForm.notesHelp': 'Markdown 支持: **粗体**, *斜体*, `代码`, 列表, 链接, **子节标题**:',
                'taskForm.cancel': '取消',
                'taskForm.create': '创建',
                'taskForm.save': '保存',

                // Columns modal
                'columns.title': '管理列',
                'columns.add': '+ 添加列',

                // Archives modal
                'archives.title': '归档',
                'archives.search': '在归档中搜索...',
                'archives.empty': '无已归档任务',

                // Project selector
                'projects.select': '选择一个项目...',

                // Task metadata in detail modal
                'meta.priority': '优先级',
                'meta.status': '状态',
                'meta.category': '类别',
                'meta.assigned': '分配给',
                'meta.created': '创建日期',
                'meta.started': '开始日期',
                'meta.due': '截止日期',
                'meta.completed': '完成日期',
                'meta.tags': '标签',
                'meta.description': '描述',
                'meta.subtasks': '子任务 ({completed}/{total})',
                'meta.notes': '备注',

                // Empty states
                'empty.noTasks': '暂无任务',

                // Buttons and actions
                'action.restore': '恢复',
                'action.delete': '',
                'action.edit': '',
                'action.moveUp': '上移',
                'action.moveDown': '下移',

                // Tooltips
                'tooltip.filterByCategory': '按此类别筛选',
                'tooltip.filterByUser': '按此用户筛选',
                'tooltip.filterByTag': '按此标签筛选',
                'tooltip.filterByPriority': '按此优先级筛选',
                'tooltip.doubleClickEdit': '双击编辑',
                'tooltip.delete': '删除',
                'tooltip.overdue': '已逾期',
                'tooltip.dueSoon': '即将到期',

                // Notifications
                'notif.folderLoaded': '文件夹加载成功!',
                'notif.folderError': '加载文件夹时出错',
                'notif.initializingFolder': '正在初始化文件夹...',
                'notif.filesInitialized': '文件初始化成功! (kanban.md 和 archive.md)',
                'notif.filesError': '创建文件时出错',
                'notif.projectLoaded': '项目 "{name}" 已加载',
                'notif.permissionDenied': '无此项目的访问权限',
                'notif.projectError': '切换项目时出错',
                'notif.projectRenamed': '项目重命名成功',
                'notif.projectDeleted': '项目已从列表中移除',
                'notif.renameError': '重命名时出错',
                'notif.projectRestored': '项目已自动恢复',
                'notif.taskMoved': '任务已移动!',
                'notif.taskEdited': '任务 {id} 已更新!',
                'notif.taskCreated': '任务 {id} 已创建!',
                'notif.taskArchived': '任务已归档!',
                'notif.taskDeleted': '任务已永久删除',
                'notif.taskRestored': '任务已恢复至原列!',

                // Prompts and confirmations
                'prompt.projectName': '项目名称 (留空则使用 "{name}"):',
                'prompt.renameProject': '新项目名称:',
                'prompt.columnName': '列名称:',
                'prompt.columnId': '列 ID (例如: todo, done):',
                'prompt.editSubtask': '编辑子任务:',
                'confirm.deleteColumn': '删除此列?',
                'confirm.deleteSubtask': '删除此子任务?',
                'confirm.deleteProject': '从近期列表中移除项目 "{name}" ?\n\n此操作仅会将其从下拉列表中移除, 您的文件不会被删除.',
                'confirm.archiveTask': '归档任务 "{title}"?',
                'confirm.deleteTask': '⚠️ 警告: 永久删除任务 "{title}"?\n\n此操作无法撤销.',
                'confirm.deleteTaskFromArchive': '⚠️ 警告: 永久删除任务 "{title}"?\n\n此操作无法撤销.\n\n若希望保留历史记录, 请改用“归档”功能.',

                // Alerts
                'alert.browserNotSupported': '您的浏览器不支持文件系统访问 API.\n\n请使用 Chrome 86+、 Edge 86+ 或 Opera 72+.',

                // Subtasks in detail modal
                'subtask.newPlaceholder': '新的子任务...',

                // Markdown generation
                'markdown.archiveTitle': '# 任务归档',
                'markdown.archiveDesc': '> 已归档的任务',
                'markdown.archiveSection': '## ✅ 归档',
                'markdown.configSection': '## ⚙️ 配置',
                'markdown.configColumns': '**列**:',
                'markdown.configCategories': '**类别**:',
                'markdown.configUsers': '**用户**:',
                'markdown.configPriorities': '**优先级**:',
                'markdown.configTags': '**标签**:',

                // Language selector
                'language.label': '语言:',
                'language.en': 'English',
                'language.fr': 'Français',
                'language.zh_cn': '简体中文'
            }
        };

        const priorityIconClasses = {
          // Color circles
          '🟢': 'Green',
          '🟡': 'Yellow',
          '🟠': 'Orange',
          '🔴': 'Red',
          '🔵': 'Blue',
          '🟣': 'Purple',
          '⚪': 'White',
          '⚫': 'Black',
          // Hearts
          '❤️': 'Red',
          '🧡': 'Orange',
          '💛': 'Yellow',
          '💚': 'Green',
          '💙': 'Blue',
          '💜': 'Purple',
          '🤍': 'White',
          '🖤': 'Black',
          // Squares
          '🟥': 'Red',
          '🟧': 'Orange',
          '🟨': 'Yellow',
          '🟩': 'Green',
          '🟦': 'Blue',
          '🟪': 'Purple',
          // Diamonds
          '🔶': 'Orange',
          '🔷': 'Blue',
          '🔸': 'Orange',
          '🔹': 'Blue',
          // Stars
          '⭐': 'Yellow',
          '🌟': 'Yellow',
          // Flags
          '🚩': 'Red',
          '🏴': 'Black',
          '🏳️': 'White',
          // Alert symbols
          '⚠️': 'Yellow',
          '🔥': 'Orange',
          '💥': 'Red',
          '⚡': 'Yellow',
          // Arrows
          '⬆️': 'Red',
          '➡️': 'Blue',
          '⬇️': 'Green',
          // Exclamation/Question
          '❗': 'Red',
          '❓': 'Blue',
          '❕': 'Red',
          '❔': 'Blue',
        }

        // Translation function
        function t(key, params = {}) {
            let text = translations[currentLanguage]?.[key] || translations['en'][key] || key;

            // Replace parameters in text
            Object.keys(params).forEach(param => {
                text = text.replace(`{${param}}`, params[param]);
            });

            return text;
        }

        // Clean function
        function clean(text) {
            // Remove any non-alphanumeric characters (emojis, symbols, etc.)
            return text.replace(/[^\w\s]+/, '').trim();
        }

        // Get first emoji from text
        function getFirstEmoji(text) {
            const matches = text.match(/[^\w\s]+/);
            if (!matches) {
                return '';
            }

            // Take matched emojis, expand to array, take first element
            // This method is required to handle double byte characters
            return [...matches[0]][0] || '';
        }

        // Translate priority default values
        function displayPriority(priority) {
            if (!priority || currentLanguage === 'en') return priority;

            const emoji = getFirstEmoji(priority);
            const text = clean(priority);

            // Map default English priorities to translation keys
            const keyMap = {
                'Critical': 'taskForm.priorityCritical',
                'High': 'taskForm.priorityHigh',
                'Medium': 'taskForm.priorityMedium',
                'Low': 'taskForm.priorityLow'
            };

            // If it's a default priority, translate it
            if (keyMap[text]) {
                const translatedText = t(keyMap[text]);
                return emoji + (emoji ? ' ' : '') + translatedText;
            }

            // Custom priority - return as-is
            return priority;
        }

        // Priorities are shown as a colored dot plus their name; the emoji in the board config only picks the dot's color
        function priorityConfigEntry(priority) {
            return (config.priorities || []).find(p => clean(p) === clean(priority || ''));
        }

        function priorityClass(priority) {
            const emoji = getFirstEmoji(priorityConfigEntry(priority) || priority || '');
            return priorityIconClasses[emoji] || 'Default';
        }

        function priorityLabel(priority) {
            return displayPriority(clean(priority || ''));
        }

        // Shape per rank so priority never relies on color alone. Rank = position in the board's
        // priority list (first = most urgent); color still comes from the config emoji.
        const PRIO_SHAPES = {
            'up2': '<path d="M4 7.5l4-4 4 4M4 12.5l4-4 4 4"/>',
            'up': '<path d="M4 10l4-4 4 4"/>',
            'eq': '<path d="M4 6.5h8M4 10.5h8"/>',
            'down': '<path d="M4 6l4 4 4-4"/>',
            'down2': '<path d="M4 3.5l4 4 4-4M4 8.5l4 4 4-4"/>',
            'none': '<circle cx="8" cy="8" r="2.5"/>'
        };
        const PRIO_LADDERS = {
            1: ['eq'], 2: ['up', 'down'], 3: ['up', 'eq', 'down'], 4: ['up2', 'up', 'eq', 'down'],
            5: ['up2', 'up', 'eq', 'down', 'down2']
        };

        function prioShape(priority) {
            const list = (config.priorities || []).map(clean);
            const i = list.indexOf(clean(priority || ''));
            if (i < 0) return 'none';
            const n = list.length;
            const ladder = PRIO_LADDERS[n] || PRIO_LADDERS[5];
            return ladder[PRIO_LADDERS[n] ? i : Math.round(i * 4 / (n - 1))];
        }

        // Colored symbol, as HTML. Extra attributes (data-filter, title…) go on the wrapper span.
        function priorityIcon(priority, attrs = '') {
            return `<span class="prio ${priorityClass(priority)}" ${attrs}><svg viewBox="0 0 16 16" aria-hidden="true">${PRIO_SHAPES[prioShape(priority)]}</svg></span>`;
        }

        // Symbol + name, as HTML
        function priorityHtml(priority) {
            return `<span class="prio-label">${priorityIcon(priority, 'aria-hidden="true"')}${escapeHtml(priorityLabel(priority))}</span>`;
        }

        // Update all static text elements in the UI
        function updateStaticTexts() {
            // Update page title
            document.title = t('page.title');

            // Update header
            document.getElementById('headerTitle').textContent = t('header.title');
            document.getElementById('renameProjectBtn').title = t('header.renameProject');
            document.querySelector('#renameProjectBtn .mi-label').textContent = t('header.renameProject');
            document.getElementById('deleteProjectBtn').title = t('header.deleteProject');
            document.querySelector('#deleteProjectBtn .mi-label').textContent = t('header.deleteProject');
            document.querySelector('#selectFolderBtn .mi-label').textContent = t('header.folder');
            document.querySelector('#openUrlBtn .mi-label').textContent = t('header.openUrl');
            document.querySelector('#homeLink .mi-label').textContent = t('header.home');
            document.getElementById('newTaskBtn').textContent = t('header.newTask');
            document.querySelector('#archiveBtn .mi-label').textContent = t('header.archives');
            document.querySelector('#manageColsBtn .mi-label').textContent = t('header.columns');
            document.getElementById('languageLabel').textContent = t('menu.language');
            document.getElementById('filterToggleLabel').textContent = t('filters.title');
            if (typeof updateThemeUi === 'function') updateThemeUi();

            // Update language selector to match current language
            if (!ddRoot('languageSelector')._ddOptions) {
                ddSetOptions('languageSelector', [
                    { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' },
                    { value: 'de', label: 'Deutsch' }, { value: 'zh_cn', label: '简体中文' }
                ]);
            }
            ddSetValue('languageSelector', currentLanguage, true);

            // Update welcome screen
            renderWelcomeScreen();
            applySourceUi(); // the read-only banner

            // Update modals
            renderTaskDetailModal();
            updateTaskFormLabels();
            renderColumnsModal();
            renderArchivesModal();

            // Update filters
            updateFilterLabels();
        }

        // Render welcome screen with translations
        function renderWelcomeScreen() {
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (welcomeScreen) {
                welcomeScreen.innerHTML = `
            ${webNoticeHtml()}
            <h2>${t('welcome.title')}</h2>
            <p>${t('welcome.description')}</p>
            <button onclick="document.getElementById('selectFolderBtn').click()" class="btn btn-primary" style="height: 40px; padding: 0 var(--s-5);">
                ${t('welcome.start')}
            </button>
            <p class="welcome-alt"><button type="button" class="btn btn-ghost" onclick="openBoardFromUrl()">${t('welcome.openUrl')}</button></p>
            <div class="welcome-card">
                <h3>${t('welcome.howItWorks')}</h3>
                <ol>
                    <li>${t('welcome.step1')}</li>
                    <li>${t('welcome.step2')}</li>
                    <li>${t('welcome.step3')}</li>
                    <li>${t('welcome.step4')}</li>
                    <li>${t('welcome.step5')}</li>
                </ol>
                <p class="note">${t('welcome.browserWarning')}</p>
            </div>
                `;
            }
        }

        // Render task detail modal structure with translations
        function renderTaskDetailModal() {
            const modalTitle = document.getElementById('modalTitle');
            if (modalTitle) {
                modalTitle.textContent = t('taskDetail.title');
            }

            // Update buttons in task detail modal
            const taskModal = document.getElementById('taskModal');
            if (taskModal) {
                const actions = taskModal.querySelector('.actions');
                if (actions && readOnly()) actions.innerHTML = '';
                else if (actions) {
                    actions.innerHTML = `
                        <div class="push">
                            <button class="btn btn-danger" onclick="deleteCurrentTask()">${t('taskDetail.delete')}</button>
                            <button class="btn btn-secondary" onclick="archiveCurrentTask()">${t('taskDetail.archive')}</button>
                        </div>
                        <button class="btn btn-primary" id="editTaskBtn" onclick="editCurrentTask()">${t('taskDetail.edit')}</button>
                    `;
                }
            }
        }

        // Update task form labels and placeholders
        function updateTaskFormLabels() {
            const formLabels = {
                'taskTitle': { prev: 'label', text: t('taskForm.titleLabel') },
                'taskStatus': { prev: 'label', text: t('taskForm.columnLabel') },
                'taskPriority': { prev: 'label', text: t('taskForm.priorityLabel') },
                'taskCategory': { prev: 'label', text: t('taskForm.categoryLabel'), placeholder: t('taskForm.categoryPlaceholder') },
                'taskAssignee': { prev: 'label', text: t('taskForm.assignedLabel'), placeholder: t('taskForm.assignedPlaceholder') },
                'taskCreated': { prev: 'label', text: t('taskForm.createdLabel') },
                'taskStarted': { prev: 'label', text: t('taskForm.startedLabel') },
                'taskDue': { prev: 'label', text: t('taskForm.dueLabel') },
                'taskCompleted': { prev: 'label', text: t('taskForm.completedLabel') },
                'taskTags': { prev: 'label', text: t('taskForm.tagsLabel'), placeholder: t('taskForm.tagsPlaceholder') },
                'taskDescription': { prev: 'label', text: t('taskForm.descriptionLabel') },
                'taskNotes': { prev: 'label', text: t('taskForm.notesLabel'), placeholder: t('taskForm.notesPlaceholder') },
                'formSubtaskInput': { placeholder: t('taskForm.subtaskPlaceholder') }
            };

            // Update all labels and placeholders
            Object.keys(formLabels).forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;

                const config = formLabels[id];

                // Update label
                if (config.prev === 'label') {
                    const label = el.previousElementSibling;
                    if (label && label.tagName === 'LABEL') {
                        label.textContent = config.text;
                    } else {
                        // Try to find label by for attribute
                        const labelEl = document.querySelector(`label[for="${id}"]`);
                        if (labelEl) labelEl.textContent = config.text;
                    }
                }

                // Update placeholder
                if (config.placeholder) {
                    el.placeholder = config.placeholder;
                }
            });

            // Update form help texts
            const tagsHelp = document.querySelector('label[for="taskTags"] + input + small');
            if (tagsHelp) tagsHelp.textContent = t('taskForm.tagsHelp');

            const notesHelp = document.querySelector('#taskNotes + small');
            if (notesHelp) notesHelp.textContent = t('taskForm.notesHelp');

            // Update subtasks label
            const subtasksLabel = document.querySelector('#formSubtasksList').previousElementSibling;
            if (subtasksLabel) subtasksLabel.textContent = t('taskForm.subtasksLabel');

            // Update subtask add button
            const subtaskBtn = document.querySelector('#formSubtaskInput + button');
            if (subtaskBtn) subtaskBtn.textContent = t('taskForm.subtaskAdd');

            // Update cancel button
            const cancelBtn = document.querySelector('#newTaskForm .actions button[type="button"]');
            if (cancelBtn) cancelBtn.textContent = t('taskForm.cancel');
        }

        // Update filter bar labels
        function updateFilterLabels() {
            const filterBar = document.getElementById('filterBar');
            if (!filterBar) return;

            // Update global search placeholder
            const searchInput = document.getElementById('globalSearchInput');
            if (searchInput) searchInput.placeholder = t('filters.search');

            // Update filter labels
            const names = { tag: t('filters.tags'), category: t('filters.category'), user: t('filters.user'), priority: t('filters.priority') };
            filterBar.querySelectorAll('.fdrop').forEach(d => {
                d.querySelector('.flabel').textContent = names[d.dataset.type].replace(/\s*[:\uFF1A]\s*$/, '');
            });

            // Update clear button
            renderFilters();  // the Clear all button lives in the chips row
        }

        // Render columns modal structure with translations
        function renderColumnsModal() {
            const modalTitle = document.getElementById('columnsModalTitle');
            if (modalTitle) modalTitle.textContent = t('columns.title');

            const addBtn = document.getElementById('addColumnBtn');
            if (addBtn) addBtn.textContent = t('columns.add');
        }

        // Render archives modal structure with translations
        function renderArchivesModal() {
            const modalTitle = document.getElementById('archiveModalTitle');
            if (modalTitle) modalTitle.textContent = t('archives.title');

            const searchInput = document.getElementById('archiveSearch');
            if (searchInput) searchInput.placeholder = t('archives.search');
            const backlogSearch = document.getElementById('backlogSearch');
            if (backlogSearch) backlogSearch.placeholder = t('backlog.search');
        }

        // Set language and save to localStorage
        function setLanguage(lang) {
            if (!translations[lang]) {
                console.warn(`Language "${lang}" not available, falling back to English`);
                lang = 'en';
            }

            currentLanguage = lang;
            localStorage.setItem('preferredLanguage', lang);

            // Update static text elements
            updateStaticTexts();

            // Update filter dropdowns (including priorities)
            updateAutocomplete();

            // Re-render the interface
            renderKanban();
            updateProjectSelector();
            renderArchivesModal();

            console.log(`Language changed to: ${lang}`);
        }

        // Initialize language based on saved preference or browser language
        function initLanguage() {
            // Check for saved preference first
            const savedLang = localStorage.getItem('preferredLanguage');
            if (savedLang) {
                currentLanguage = savedLang;
                return;
            }

            // Detect browser language
            const browserLang = navigator.language || navigator.userLanguage;
            const langCode = browserLang.toLowerCase().split('-')[0]; // e.g., "en-US" -> "en"

            // Check if we support this language, otherwise fallback to English
            if (translations[langCode]) {
                currentLanguage = langCode;
            } else {
                currentLanguage = 'en'; // Default fallback
            }

            // Save the detected/default language
            localStorage.setItem('preferredLanguage', currentLanguage);

            console.log(`Language initialized to: ${currentLanguage}`);
        }

        // Initialize language on page load
        initLanguage();
        // Update static texts after DOM loads
        document.addEventListener('DOMContentLoaded', updateStaticTexts);

        // Check if File System Access API is supported
        // (Not for a board from the web: viewing it needs no folder access.)
        if (!('showDirectoryPicker' in window) && !new URLSearchParams(location.search).has('board')) {
            alert(t('alert.browserNotSupported'));
        }

        // IndexedDB for persisting directory handles (multiple projects)
        const DB_NAME = 'TaskManagerDB';
        const DB_VERSION = 2; // Increment version for schema change
        const STORE_NAME = 'settings';
        const PROJECTS_KEY = 'recentProjects';
        const MAX_RECENT_PROJECTS = 10;
