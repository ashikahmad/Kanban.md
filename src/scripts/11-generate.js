        // kanban.md text for the current state (serializer lives in core/board.js). The source comment is kept when the
        // file has it (a deleted one stays deleted); `addSourceComment` adds it (the one-time migration).
        function generateMarkdown({ addSourceComment = false } = {}) {
            // Keep the live config normalized (de-duplicated lists, defaults), as saving always did.
            Object.assign(config, normalizeConfig(config));
            // With a backlog file, its tasks live there, not in kanban.md.
            const bc = resolveBacklogFile(config);
            return generateBoard({ config, tasks: bc ? tasks.filter((x) => x.status !== bc.column) : tasks },
                { sourceComment: addSourceComment || hasSourceComment(currentKanbanContent) });
        }

        // Localized heading lines of archive.md.
        function archiveStrings() {
            return { title: t('markdown.archiveTitle'), desc: t('markdown.archiveDesc'), section: t('markdown.archiveSection') };
        }

        // Show notification
