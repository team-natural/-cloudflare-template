#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# claude-config volume is root-owned at first; fix it or login won't persist
sudo chown -R vscode:vscode /home/vscode/.claude

# Install project dependencies
npm install

# Install Context Mode (context compression MCP) into the container
npm install -g context-mode

# Install the Playwright MCP globally (must be global: it's invoked via `npx` from
# .mcp.json, and a package.json shouldn't carry it as a devDependency just to satisfy the MCP client)
npm install -g @playwright/mcp

# Install the Chromium browser + OS deps for the Playwright MCP into the container
npx @playwright/mcp install-browser --with-deps chromium
