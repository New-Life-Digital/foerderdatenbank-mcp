#!/usr/bin/env node
// Lokaler Start für Claude Desktop, Claude Code, Cursor & Co.:
//   npx -y foerderdatenbank-mcp

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { erstelleServer } from '../lib/server.mjs'

const server = erstelleServer()
await server.connect(new StdioServerTransport())
