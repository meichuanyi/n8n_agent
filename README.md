# n8n Workflow Vectorization and Knowledge Graph

This project provides tools for analyzing, categorizing, and storing n8n workflows across multiple database types:

1. **Vector Database (QDRANT)**: For semantic search and similarity matching
2. **Graph Database (Neo4j)**: For relationship mapping and ontological representation
3. **Relational Database (Supabase)**: For structured metadata storage

## MCP Integrations

This project now includes Model Context Protocol (MCP) integrations for:

1. **n8n**: Import and manage workflows directly with n8n's API
2. **QDRANT**: Vector search and similarity matching for workflows
3. **Supabase**: Structured data storage for workflow metadata
4. **Workflow Validation**: Validate workflows against best practices

## Project Structure

- `workflow-parser.js`: Processes n8n workflow JSON files, extracts metadata, and generates descriptions
- `vectorize-workflows.js`: Demonstrates how to use the QDRANT MCP server to vectorize workflows
- `n8n-mcp-client.js`: Client for interacting with the n8n MCP server
- `n8n-workflow-validator.js`: Validator for n8n workflows against best practices
- `validate-workflow.js`: CLI tool for validating workflows
- `import-to-n8n.js`: Tool for importing workflows to n8n
- `processed-workflows/`: Contains the processed workflow data with enriched metadata
- `workflows/`: Directory containing original n8n workflow files
- MCP Servers located in `/Users/kinglerbercy/MCP/`:

## Setup and Installation

### 1. Process Workflows

The `workflow-parser.js` script processes n8n workflow files, extracting metadata and generating descriptions:

```bash
npm run parse
# or
node workflow-parser.js
```

This creates enriched workflow data in the `processed-workflows/` directory.

### 2. Configure Environment Variables

Copy the example environment file and update with your settings:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. MCP Integrations

#### QDRANT MCP Integration

```bash
# Connect to QDRANT for vectorization and semantic search
npm run vectorize-mcp
```

#### Supabase MCP Integration

```bash
# Store workflows in Supabase
npm run supabase-mcp
```

#### n8n MCP Integration

```bash
# Connect to n8n and list workflows
npm run n8n-demo

# Import all workflows to n8n
npm run import-all

# Import a specific workflow to n8n
npm run import <workflow-id>
# or
npm run import <workflow-file.json>
```

#### Workflow Validation

```bash
# Validate a workflow in n8n by ID
npm run validate <workflow-id>

# Validate a local workflow file
npm run validate -f <workflow-file.json>

# Validate with high strictness
npm run validate -s high <workflow-id>

# Run specific validators only
npm run validate -v naming,security,errorHandling <workflow-id>
```

The workflow validator checks for best practices in five categories:

1. **Naming**: Ensures workflows and nodes have descriptive names
2. **Error Handling**: Checks for proper error handling nodes and patterns
3. **Security**: Validates credential usage and security practices
4. **Performance**: Identifies potential performance issues
5. **Documentation**: Ensures workflows are properly documented

### 4. Manual Vectorization (Legacy Method)

The QDRANT MCP server can also be configured in the Cline MCP settings:

```json
"n8n-workflows-qdrant": {
  "command": "node",
  "args": [
    "/Users/kinglerbercy/MCP/qdrant-server/index.js"
  ],
  "env": {
    "OPENAI_API_KEY": "your-openai-api-key",
    "QDRANT_URL": "http://localhost:6333"
  },
  "disabled": false,
  "autoApprove": []
}
```

After restarting Cline with the MCP server configuration, you can use the MCP tools to vectorize and search workflows:

```javascript
// Vectorize workflows
use_mcp_tool(
  server_name: "n8n-workflows-qdrant",
  tool_name: "vectorize_workflows",
  arguments: {
    "workflowsDir": "/path/to/workflows",
    "processedDir": "/path/to/processed-workflows"
  }
)

// Search for similar workflows
use_mcp_tool(
  server_name: "n8n-workflows-qdrant",
  tool_name: "search_similar_workflows",
  arguments: {
    "query": "workflow that handles email automation",
    "limit": 5,
    "filter": {
      "category": "workflow",
      "tags": ["email", "automation"],
      "complexity": "moderate"
    }
  }
)
```

## Workflow Analysis

The workflow parser extracts the following information:

1. **Category**: Derived from the filename prefix (e.g., "agent:", "workflow:", "tool:")
2. **Name**: Extracted from the filename
3. **Description**: Generated from workflow content, including node types and documentation
4. **Tags**: Extracted from node types and services used
5. **Complexity**: Analyzed based on node count, connection count, and unique node types

## Database Integration

### Vector Database (QDRANT)

- **Purpose**: Semantic search and similarity matching
- **Implementation**: QDRANT MCP server with OpenAI embeddings
- **Features**: Search by query, filter by category, tags, and complexity

### Graph Database (Neo4j)

- **Purpose**: Relationship mapping and ontological representation
- **Implementation**: To be implemented
- **Features**: Query relationships between workflows, node types, and categories

### Relational Database (Supabase)

- **Purpose**: Structured metadata storage
- **Implementation**: To be implemented
- **Features**: SQL queries for structured data analysis

## Available MCP Tools

### QDRANT MCP Tools

The QDRANT MCP server provides the following tools:

1. `vectorize_workflows`: Vectorize n8n workflows and store them in Qdrant
2. `search_similar_workflows`: Search for similar workflows based on a query
3. `get_workflow_categories`: Get all workflow categories
4. `get_workflow_tags`: Get all workflow tags

### n8n MCP Tools

The n8n MCP server provides the following tools:

1. `list_workflows`: Get all workflows from n8n
2. `get_workflow`: Get a specific workflow by ID
3. `create_workflow`: Create a new workflow
4. `update_workflow`: Update an existing workflow
5. `delete_workflow`: Delete a workflow
6. `import_workflow`: Import a workflow from a file
7. `export_workflow`: Export a workflow to a file

### Workflow Validation Tools

The workflow validator provides the following validation categories:

1. `naming`: Validate node and workflow naming conventions
2. `errorHandling`: Validate error handling patterns
3. `security`: Validate security practices and credential usage
4. `performance`: Identify potential performance issues
5. `documentation`: Ensure proper workflow documentation

## Future Enhancements

1. Implement Neo4j integration for relationship mapping
2. Implement Supabase integration for structured metadata storage
3. Create a web interface for browsing and searching workflows
4. Add more advanced analytics and visualization tools
## ❓ Frequently Asked Questions (FAQ)

### General

**Q: What is n8n_agent?**

A: n8n_agent is a project for analyzing, categorizing, and storing n8n workflows across multiple database types:
- **Vector Database (QDRANT)**: For semantic search and similarity matching
- **Graph Database (Neo4j)**: For relationship mapping and ontological representation
- **Relational Database (Supabase)**: For structured metadata storage

**Q: What are MCP Integrations?**

A: MCP (Model Context Protocol) integrations provide:
- **n8n**: Import and manage workflows directly with n8n's API
- **QDRANT**: Vector search and similarity matching for workflows
- **Supabase**: Structured data storage for workflow metadata
- **Workflow Validation**: Validate workflows against best practices

### Setup & Installation

**Q: How do I process workflows?**

A: Run the workflow parser:
```bash
npm run parse
# or
node workflow-parser.js
```
This creates enriched workflow data in the `processed-workflows/` directory.

**Q: How do I configure environment variables?**

A: Copy the example environment file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

**Q: What environment variables are required?**

A: Required variables:
- `OPENAI_API_KEY`: For generating embeddings
- `QDRANT_URL`: Qdrant server URL (default: `http://localhost:6333`)
- `N8N_API_URL`: n8n API URL
- `N8N_API_KEY`: n8n API key

### MCP Integrations

**Q: How do I use QDRANT MCP Integration?**

A:
```bash
npm run vectorize-mcp
```

Available tools:
- `vectorize_workflows`: Vectorize and store workflows in Qdrant
- `search_similar_workflows`: Search by query with filters
- `get_workflow_categories`: Get all workflow categories
- `get_workflow_tags`: Get all workflow tags

**Q: How do I use n8n MCP Integration?**

A:
```bash
# List workflows
npm run n8n-demo

# Import all workflows to n8n
npm run import-all

# Import specific workflow
npm run import <workflow-id>
```

Available tools:
- `list_workflows`: Get all workflows from n8n
- `get_workflow`: Get specific workflow by ID
- `create_workflow`: Create new workflow
- `update_workflow`: Update existing workflow
- `delete_workflow`: Delete workflow
- `import_workflow`: Import from file
- `export_workflow`: Export to file

**Q: How do I use Workflow Validation?**

A:
```bash
# Validate workflow in n8n by ID
npm run validate <workflow-id>

# Validate local workflow file
npm run validate -f <workflow-file.json>

# Validate with high strictness
npm run validate -s high <workflow-id>

# Run specific validators
npm run validate -v naming,security,errorHandling <workflow-id>
```

### Workflow Analysis

**Q: What information is extracted from workflows?**

A: The parser extracts:
1. **Category**: Derived from filename prefix (e.g., "agent:", "workflow:", "tool:")
2. **Name**: Extracted from filename
3. **Description**: Generated from workflow content, node types, documentation
4. **Tags**: Extracted from node types and services used
5. **Complexity**: Analyzed based on node count, connections, unique node types

**Q: What validation categories are available?**

A: Five validation categories:
1. **Naming**: Ensures workflows and nodes have descriptive names
2. **Error Handling**: Checks for proper error handling nodes and patterns
3. **Security**: Validates credential usage and security practices
4. **Performance**: Identifies potential performance issues
5. **Documentation**: Ensures workflows are properly documented

### Database Integration

**Q: What is the Vector Database (QDRANT) used for?**

A: QDRANT provides:
- Semantic search and similarity matching
- OpenAI embeddings for vectorization
- Search by query, filter by category, tags, complexity

**Q: What is the Graph Database (Neo4j) used for?**

A: Neo4j provides:
- Relationship mapping and ontological representation
- Query relationships between workflows, node types, categories
- (Currently in development)

**Q: What is the Relational Database (Supabase) used for?**

A: Supabase provides:
- Structured metadata storage
- SQL queries for structured data analysis
- (Currently in development)

### Troubleshooting

**Q: QDRANT connection fails?**

A:
- Check QDRANT_URL is correct
- Verify Qdrant server is running on port 6333
- Check firewall settings

**Q: n8n API connection fails?**

A:
- Verify N8N_API_URL is correct
- Check N8N_API_KEY is valid
- Ensure n8n server is running

**Q: Workflow validation fails?**

A:
- Check validator categories with `-v` flag
- Use `-s high` for stricter validation
- Review specific validator output

**Q: Where can I get help?**

A:
- Check project documentation
- Review MCP server logs
- Submit GitHub Issues for bugs