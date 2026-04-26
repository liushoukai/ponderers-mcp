# 🦉 Ponderers MCP Server

[![MCP Badge](https://lobehub.com/badge/mcp/liushoukai-ponderers-mcp)](https://lobehub.com/mcp/liushoukai-ponderers-mcp)

A Model Context Protocol (MCP) server implemented in Rust using the official rmcp SDK, providing a collection of utility tools.

## 🧰 Available Tools

### 🛠️ get_ip_info

Get the current machine's public IP information.

- ✅ IP address
- ✅ Geolocation (city, region, country)
- ✅ ISP information
- ✅ Timezone
- ✅ Latitude and longitude coordinates

### 🛠️ get_openrouter_models

Get the list of all models supported by the OpenRouter platform, returned in compact format: `model_id | name | date`.

### 🛠️ get_openrouter_model_detail

Get detailed information for a specific model by ID.

| Parameter | Type   | Description                          |
|-----------|--------|--------------------------------------|
| `id`      | string | Model ID, e.g. `openai/gpt-4o`      |

Returns name, description, context length, pricing, and the date the model was added to OpenRouter.

## 🚀 Quick Start

### ⚙️ Configure MCP Client

#### Claude Desktop Configuration

Edit the configuration file:
- ✅ macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- ✅ Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- ✅ Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tools": {
      "command": "npx",
      "args": ["-y", "@liushoukai/ponderers-mcp"]
    }
  }
}
```

### 🔄 Restart Claude Desktop

After configuration, completely quit and restart Claude Desktop.

## 🔍 Enable Verbose Logging

Add an `env` field to the configuration to view detailed runtime logs:

```json
{
  "mcpServers": {
    "tools": {
      "command": "npx",
      "args": ["-y", "@liushoukai/ponderers-mcp"],
      "env": {
        "RUST_LOG": "debug"
      }
    }
  }
}
```
