# MCP Routing Number Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for looking up, searching, and validating ABA routing numbers from the Federal Reserve FedACH directory.

## Tools (3 total)

| Tool | Description |
|------|-------------|
| `routing_lookup` | Look up a bank by its 9-digit ABA routing number |
| `routing_search` | Search institutions by name, city, or state |
| `routing_validate` | Validate an ABA routing number checksum (weights 3,7,1) |

## Install

```bash
npx @easysolutions906/mcp-routing
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "routing": {
      "command": "npx",
      "args": ["-y", "@easysolutions906/mcp-routing"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "routing": {
      "command": "npx",
      "args": ["-y", "@easysolutions906/mcp-routing"]
    }
  }
}
```

## REST API

Set `PORT` env var to run as an HTTP server.

- `GET /lookup?routing=021000021` -- look up by routing number
- `GET /search?name=chase&state=NY` -- search by name, city, or state
- `GET /validate?routing=021000021` -- validate routing number checksum
- `POST /lookup/batch` -- batch lookup multiple routing numbers
- `GET /stats` -- institution counts by state

## Data Source

FedACH directory from the [Federal Reserve](https://www.frbservices.org/). Run `npm run build-data` to download and regenerate. Falls back to bundled data if the download is unavailable.

## Transport

- **stdio** (default) -- for local use with Claude Desktop and Cursor
- **HTTP** -- set `PORT` env var to start in Streamable HTTP mode on `/mcp`
