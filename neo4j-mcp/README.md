# n8n Neo4j MCP Server

This MCP server provides integration between n8n workflows and Neo4j for graph database storage and analysis.

## Features

- Store n8n workflows as a knowledge graph in Neo4j
- Represent workflow nodes and their connections as a graph
- Search for workflows by various criteria
- Find relationships between workflows and nodes
- Analyze workflow complexity and structure

## Prerequisites

- Node.js 14+
- Neo4j database (local or cloud)
- n8n instance

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment example file and fill in your Neo4j credentials:
   ```bash
   cp .env.example .env
   ```

3. Start the server:
   ```bash
   npm start
   ```

## API Tools

The Neo4j MCP server provides the following tools:

### store_workflow

Stores a workflow and its components in Neo4j.

```javascript
{
  "type": "invoke",
  "id": "1",
  "tool": "store_workflow",
  "args": {
    "id": "workflow_123",
    "name": "Email Processing Workflow",
    "category": "workflow",
    "description": "Processes incoming emails and extracts data",
    "tags": ["email", "automation", "data extraction"],
    "complexity": "moderate",
    "nodes": [...],
    "connections": {...}
  }
}
```

### get_workflow

Retrieves a workflow by ID or name.

```javascript
{
  "type": "invoke",
  "id": "2",
  "tool": "get_workflow",
  "args": {
    "id": "workflow_123"
  }
}
```

### get_workflow_relationships

Gets relationships for a workflow.

```javascript
{
  "type": "invoke",
  "id": "3",
  "tool": "get_workflow_relationships",
  "args": {
    "id": "workflow_123",
    "relationshipType": "nodes" // or "similar"
  }
}
```

### search_workflows

Searches for workflows based on various criteria.

```javascript
{
  "type": "invoke",
  "id": "4",
  "tool": "search_workflows",
  "args": {
    "category": "workflow",
    "tags": ["email", "automation"],
    "search": "email",
    "limit": 10,
    "skip": 0
  }
}
```

### get_workflow_categories

Gets all unique workflow categories.

```javascript
{
  "type": "invoke",
  "id": "5",
  "tool": "get_workflow_categories",
  "args": {}
}
```

### get_workflow_tags

Gets all unique workflow tags.

```javascript
{
  "type": "invoke",
  "id": "6",
  "tool": "get_workflow_tags",
  "args": {}
}
```

## Graph Model

The Neo4j graph model for n8n workflows consists of:

- **Workflow** nodes - representing n8n workflows
- **Node** nodes - representing n8n nodes within workflows
- **CONTAINS** relationships - connecting workflows to their nodes
- **CONNECTS_TO** relationships - connecting nodes to each other based on workflow connections

## Usage with n8n

1. Configure the MCP server in your n8n instance:
   ```json
   {
     "mcpServers": {
       "n8n-neo4j": {
         "command": "node",
         "args": ["/path/to/neo4j-mcp/index.js"],
         "env": {
           "NEO4J_URI": "bolt://localhost:7687",
           "NEO4J_USERNAME": "neo4j",
           "NEO4J_PASSWORD": "password"
         }
       }
     }
   }
   ```

2. Use the MCP server in your workflows:
   ```javascript
   // Example: Store a workflow
   use_mcp_tool(
     server_name: "n8n-neo4j",
     tool_name: "store_workflow",
     arguments: {
       "name": "My Workflow",
       "category": "workflow",
       "tags": ["email", "automation"],
       "complexity": "moderate"
     }
   )
   ```

## Development

1. Run in development mode (with auto-reload):
   ```bash
   npm run dev
   ```

2. Run tests:
   ```bash
   npm test
   ```

## License

MIT