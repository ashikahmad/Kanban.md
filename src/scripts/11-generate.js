        // kanban.md text for the current state (serializer lives in core/board.js).
        function generateMarkdown() {
            // Keep the live config normalized (de-duplicated lists, defaults), as saving always did.
            Object.assign(config, normalizeConfig(config));
            return generateBoard({ config, tasks });
        }

        // Localized heading lines of archive.md.
        function archiveStrings() {
            return { title: t('markdown.archiveTitle'), desc: t('markdown.archiveDesc'), section: t('markdown.archiveSection') };
        }

        // Show notification
