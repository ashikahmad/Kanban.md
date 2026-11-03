        // Where the board's files come from (see 03a-sources.js). null = no board open.
        let source = null;
        let currentKanbanContent = '';
        let tasks = [];
        let config = {};
        let activeFilters = []; // Array of {type: 'tag'|'category'|'user', value: string}
        let globalSearchTerm = ''; // Global search term for searching in title, description, and notes
        let isEditMode = false;
        let currentDetailTask = null;
        let formSubtasks = [];
        let archivedTasks = [];
        // How the open detail view was reached: an archived task is read-only, and when it was opened from the
        // archive panel (hidden behind it) closing it brings that panel back.
        let detailCtx = { archived: false, fromArchivePanel: false };
        let loadedFormatVersion = 3; // format of the loaded kanban.md: 1 legacy sections, 2 joined metadata lines, 3 one field per line (current)
        let loadedArchiveVersion = 3; // same, for the loaded archive.md
