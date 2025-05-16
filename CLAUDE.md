# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains tools for analyzing, categorizing, and storing n8n workflows across multiple database types:

1. **Vector Database (QDRANT)**: For semantic search and similarity matching
2. **Graph Database (Neo4j)**: For relationship mapping (planned)
3. **Relational Database (Supabase)**: For structured metadata storage

## Project Structure

- `workflow-parser.js`: Processes n8n workflow JSON files, extracts metadata, and generates descriptions
- `vectorize-workflows.js`: Demonstrates how to use the QDRANT MCP server to vectorize workflows
- `processed-workflows/`: Contains the processed workflow data with enriched metadata
- `workflows/`: Contains original n8n workflow JSON files
- `supabase-mcp/`: Contains the Supabase MCP server implementation

## Common Commands

### Processing Workflows

```bash
# Process all workflows and generate enriched metadata
npm run parse
# or
node workflow-parser.js
```

### Running the Vectorization Demo

```bash
# Run the vectorization demo script
npm start
# or
node vectorize-workflows.js
```

### Running Tests

```bash
# Run tests
npm test
```

### Working with Supabase MCP

```bash
# Navigate to the Supabase MCP directory
cd supabase-mcp

# Install dependencies
npm install
# or for Python dependencies
pip install -e .

# Start the Supabase MCP server
python -m supabase_mcp.main
```

## Development Guidelines

### Workflow Parser

The workflow parser extracts the following information from n8n workflows:

1. **Category**: Derived from the filename prefix (e.g., "agent:", "workflow:", "tool:")
2. **Name**: Extracted from the filename
3. **Description**: Generated from workflow content, including node types and documentation
4. **Tags**: Extracted from node types and services used
5. **Complexity**: Analyzed based on node count, connection count, and unique node types

When extending the parser, follow these patterns and maintain the same data structure.

### MCP Server Integration

The project uses Cline's MCP (Multi-Call Protocol) servers for database integration. Key considerations:

1. **Environment Variables**: Required variables are different for each MCP server:
   - QDRANT: `OPENAI_API_KEY`, `QDRANT_URL`
   - Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

2. **MCP Server Configuration**: MCP servers must be configured in Cline settings before use.

3. **API Structure**: Each MCP server follows the same pattern of exposing tools that can be called from Cline.

### n8n Workflow JSON Structure

When working with n8n workflows, be aware of these important JSON structure requirements:

1. Workflows must have valid JSON syntax with proper quoting and escaping
2. Node IDs must be unique UUIDs
3. Node types must reference valid n8n node types
4. Connections must reference existing node IDs
5. Position coordinates use X,Y format for node placement

## Known Issues and Limitations

1. Some workflow files (3 out of 38) had JSON parsing errors during initial processing
2. MCP servers require specific environment variables to be set
3. QDRANT server requires a running QDRANT instance (default: http://localhost:6333)
4. Neo4j integration is planned but not yet implemented

## External Dependencies

- **Supabase**: For relational database storage
- **QDRANT**: For vector database storage
- **OpenAI**: For generating embeddings
- **Node.js**: Runtime environment
- **Jest**: Testing framework

## Database Schema

### Supabase Workflows Table

The Supabase `workflows` table has the following structure:

- `id`: Unique identifier (auto-generated)
- `name`: Workflow name
- `category`: Workflow category (agent, workflow, tool, assistant)
- `description`: Generated description of the workflow
- `tags`: Array of tags related to the workflow
- `complexity`: Complexity assessment (simple, moderate, complex)
- `nodes`: JSON string of workflow nodes
- `connections`: JSON string of workflow connections

## Future Development

1. Neo4j integration for relationship mapping
2. Web interface for browsing and searching workflows
3. More advanced analytics and visualization tools
4. Automated workflow suggestions based on user queries