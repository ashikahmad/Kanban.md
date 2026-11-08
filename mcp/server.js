#!/usr/bin/env node
// Kanban.md MCP server (stdio), started by `kanbanmd mcp [--dir FOLDER]` (or KANBANMD_DIR). The board folder is
// --dir, else board/, else the project folder, else docs/ (see io/board-dir.js).
// Read and write tools. Every call re-reads the files, so it always sees the page's and other
// writers' latest changes; every write is one verified, locked, atomic edit.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { publicTools, callTool, SERVER_INSTRUCTIONS } from './tools.js';
import { resolveBoardDir } from '../io/board-dir.js';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const argDir = process.argv.indexOf('--dir');
const dir = resolveBoardDir((argDir > 0 && process.argv[argDir + 1]) || process.env.KANBANMD_DIR);
// --read-only (or KANBANMD_READONLY=1): expose only the read tools (fewer tokens, and no way to write).
const readOnly = process.argv.includes('--read-only') || process.env.KANBANMD_READONLY === '1';

const server = new Server(
    { name: 'kanbanmd', version },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: publicTools({ readOnly }) }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const client = server.getClientVersion();
    return callTool(dir, req.params.name, req.params.arguments, { actor: (client && client.name) || 'mcp', readOnly });
});

await server.connect(new StdioServerTransport());
