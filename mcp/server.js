#!/usr/bin/env node
// Kanban.md MCP server (stdio).   kanbanmd-mcp --dir /path/to/project    (or KANBANMD_DIR)
// Read tools only for now; every call re-reads the files, so it always sees the page's and other
// writers' latest changes.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { publicTools, callTool, SERVER_INSTRUCTIONS } from './tools.js';

const argDir = process.argv.indexOf('--dir');
const dir = (argDir > 0 && process.argv[argDir + 1]) || process.env.KANBANMD_DIR || process.cwd();

const server = new Server(
    { name: 'kanbanmd', version: '0.1.0' },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: publicTools() }));
server.setRequestHandler(CallToolRequestSchema, async (req) => callTool(dir, req.params.name, req.params.arguments));

await server.connect(new StdioServerTransport());
