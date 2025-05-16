# n8n Supabase MCP Server

This MCP server provides integration between n8n workflows and Supabase for relational data storage and retrieval.

## Features

- Store workflow metadata and content in Supabase
- Search workflows by category, tags, and complexity
- Retrieve workflow details by ID
- Get all available categories and tags

## Prerequisites

- Node.js 14+
- Supabase account and project
- n8n instance

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the environment example file and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```

3. Create the following table in your Supabase database:
   ```sql
   CREATE TABLE workflows (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT NOT NULL,
     description TEXT,
     tags TEXT[] DEFAULT '{}',
     complexity TEXT,
     nodes JSONB,
     connections JSONB,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
   );

   -- Create indexes for better performance
   CREATE INDEX idx_workflows_category ON workflows(category);
   CREATE INDEX idx_workflows_complexity ON workflows(complexity);
   CREATE INDEX idx_workflows_tags ON workflows USING GIN(tags);
   ```

## API Endpoints

### Store Workflow
```http
POST /store-workflow
Content-Type: application/json

{
  "workflow": {
    "name": "Email Automation",
    "category": "workflow",
    "description": "Automated email workflow",
    "tags": ["email", "automation"],
    "complexity": "moderate",
    "nodes": {...},
    "connections": {...}
  }
}
```

### Get Workflow by ID
```http
GET /workflow/:id
```

### Search Workflows
```http
GET /search-workflows?category=workflow&tags=email&complexity=moderate
```

### Get All Categories
```http
GET /categories
```

### Get All Tags
```http
GET /tags
```

## Usage with n8n

1. Start the MCP server:
   ```bash
   npm start
   ```

2. Configure the MCP server in your n8n instance:
   ```json
   {
     "mcpServers": {
       "n8n-supabase": {
         "command": "node",
         "args": ["/path/to/supabase-mcp/index.js"],
         "env": {
           "SUPABASE_URL": "your_supabase_url",
           "SUPABASE_ANON_KEY": "your_supabase_anon_key"
         }
       }
     }
   }
   ```

3. Use the MCP server in your workflows:
   ```javascript
   use_mcp_tool(
     server_name: "n8n-supabase",
     tool_name: "store_workflow",
     arguments: {
       "workflow": {
         "name": "My Workflow",
         "category": "workflow",
         "tags": ["email", "automation"],
         "complexity": "moderate"
       }
     }
   )
   ```

## Development

1. Run tests:
   ```bash
   npm test
   ```

2. Start in development mode:
   ```bash
   npm run dev
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT 