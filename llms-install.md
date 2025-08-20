# Snyk Security MCP Installation Guide

This guide helps AI assistants install and configure the Snyk MCP Server for users in their development projects.

## What is Snyk

Snyk is a platform that allows you to scan, prioritize, and fix security vulnerabilities in your code, open-source dependencies, container images, and infrastructure as code configurations. The Snyk platform uses a risk-based approach, focusing security efforts on issues that matter, and eliminating the noise of vulnerabilities that have no meaningful impact.

## What is the Snyk MCP Server

The Snyk MCP Server integrates security scanning directly into AI-assisted software development workflows using the Model Context Protocol (MCP), an open standard that enables AI tools to communicate with external platforms. As part of the Snyk CLI, this server allows AI agents to autonomously run Snyk's vulnerability scans on generated code in real-time, catching security issues like outdated libraries or insecure practices before they become larger problems. By embedding these security checks at the earliest stages of AI-powered development and working alongside existing Snyk IDE plugins, the MCP server ensures both human-written and AI-generated code undergoes proper security validation, addressing the critical need for security guardrails as AI increasingly accelerates software development while potentially introducing the same vulnerabilities human developers might create.

## Installation Steps

### Step 1: Add MCP Configuration

Add the following configuration to the user's MCP settings file (`.cursor/mcp.json` for Cursor, or equivalent for other editors):

```json
{
  "mcpServers": {
    "Snyk Security": {
      "command": "npx",
      "args": ["-y", "snyk@latest", "mcp", "-t", "stdio"],
    }
  }
}
```

### Step 2: Authenticate and Trust folders

Use the `snyk_auth` tool to authenticate the user to the Snyk platform, and then invoke the `snyk_trust` tool to confirm the user trusts Snyk to perform security scans of the contents of the current project's directory.
