#!/usr/bin/env node
// Kanban.md MCP server (stdio).   kanbanmd-mcp --dir /path/to/project    (or KANBANMD_DIR)
// Read and write tools. Every call re-reads the files, so it always sees the page's and other
// writers' latest changes; every write is one verified, locked, atomic edit.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { publicTools, callTool, SERVER_INSTRUCTIONS } from './tools.js';

const argDir = process.argv.indexOf('--dir');
const dir = (argDir > 0 && process.argv[argDir + 1]) || process.env.KANBANMD_DIR || process.cwd();
// --read-only (or KANBANMD_READONLY=1): expose only the read tools (fewer tokens, and no way to write).
const readOnly = process.argv.includes('--read-only') || process.env.KANBANMD_READONLY === '1';

const server = new Server(
    { name: 'kanbanmd', version: '0.1.0' },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: publicTools({ readOnly }) }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const client = server.getClientVersion();
    return callTool(dir, req.params.name, req.params.arguments, { actor: (client && client.name) || 'mcp', readOnly });
});

await server.connect(new StdioServerTransport());
