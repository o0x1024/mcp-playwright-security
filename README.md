
# Playwright MCP Server for Security 🎭


A Model Context Protocol server that provides browser automation capabilities using Playwright. This server enables LLMs to interact with web pages, take screenshots, generate test code, web scraps the page and execute JavaScript in a real browser environment.


## Installation

You can install the package using either npm, mcp-get, or Smithery:

Using npm:
```bash
npm install -g @gelenlen/playwright-mcp-server-security
```



#### Installation in VS Code

Install the Playwright MCP server in VS Code using one of these buttons:

<!--
// Generate using?:
const config = JSON.stringify({ name: 'playwright', command: 'npx', args: ["-y", "@gelenlen/playwright-mcp-server-security"] });
const urlForWebsites = `vscode:mcp/install?${encodeURIComponent(config)}`;
// Github markdown does not allow linking to `vscode:` directly, so you can use our redirect:
const urlForGithub = `https://insiders.vscode.dev/redirect?url=${encodeURIComponent(urlForWebsites)}`;
-->

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522%2540executeautomation%252Fplaywright-mcp-server-security%2522%255D%257D) 
[<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522%2540executeautomation%252Fplaywright-mcp-server-security%2522%255D%257D)

Alternatively, you can install the Playwright MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"playwright","command":"npx","args":["@gelenlen/playwright-mcp-server-security"]}'
```

```bash
# For VS Code Insiders
code-insiders --add-mcp '{"name":"playwright","command":"npx","args":["@gelenlen/playwright-mcp-server-security"]}'
```

After installation, the ExecuteAutomation Playwright MCP server will be available for use with your GitHub Copilot agent in VS Code.

## Configuration to use Playwright Server
Here's the Claude Desktop configuration to use the Playwright server:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@gelenlen/playwright-mcp-server-security"]
    }
  }
}
```
