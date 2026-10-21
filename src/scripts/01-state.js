        // File System Access API
        let directoryHandle = null;
        let kanbanFileHandle = null;
        let currentKanbanContent = '';
        let tasks = [];
        let config = {};
        let activeFilters = []; // Array of {type: 'tag'|'category'|'user', value: string}
        let globalSearchTerm = ''; // Global search term for searching in title, description, and notes
        let isEditMode = false;
        let currentDetailTask = null;
        let formSubtasks = [];
        let archivedTasks = [];
        let archiveFileHandle = null;
        let wasArchiveModalActive = false;
        let loadedFormatVersion = 3; // format of the loaded kanban.md: 1 legacy sections, 2 joined metadata lines, 3 one field per line (current)
        let loadedArchiveVersion = 3; // same, for the loaded archive.md
