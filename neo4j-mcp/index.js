/**
 * Neo4j MCP Server
 * 
 * This MCP server provides integration between n8n workflows and Neo4j graph database.
 * It allows storing workflow data as a knowledge graph, with nodes representing workflows,
 * n8n nodes, and their relationships.
 */

// Load environment variables
require('dotenv').config();

// Import Neo4j driver
const neo4j = require('neo4j-driver');
const { storeWorkflow, getWorkflow, getWorkflowRelationships, searchWorkflows } = require('./src/neo4j-service');

// MCP protocol implementation
const stdin = process.stdin;
const stdout = process.stdout;

// Initialize Neo4j driver
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  ),
  {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
  }
);

// Define available tools
const tools = {
  // Store a workflow and its nodes in Neo4j
  store_workflow: async (args) => {
    const result = await storeWorkflow(driver, args);
    return result;
  },
  
  // Get a workflow by ID or name
  get_workflow: async (args) => {
    const result = await getWorkflow(driver, args.id || args.name);
    return result;
  },
  
  // Get workflow relationships (e.g., node connections, similar workflows)
  get_workflow_relationships: async (args) => {
    const result = await getWorkflowRelationships(driver, args.id || args.name, args.relationshipType);
    return result;
  },
  
  // Search workflows by criteria (tags, category, etc.)
  search_workflows: async (args) => {
    const result = await searchWorkflows(driver, args);
    return result;
  },
  
  // Get workflow categories
  get_workflow_categories: async () => {
    const session = driver.session();
    try {
      const result = await session.run(
        'MATCH (w:Workflow) RETURN DISTINCT w.category AS category'
      );
      return result.records.map(record => record.get('category'));
    } finally {
      await session.close();
    }
  },
  
  // Get workflow tags
  get_workflow_tags: async () => {
    const session = driver.session();
    try {
      const result = await session.run(
        'MATCH (w:Workflow) UNWIND w.tags AS tag RETURN DISTINCT tag'
      );
      return result.records.map(record => record.get('tag'));
    } finally {
      await session.close();
    }
  }
};

// Set up MCP communication
stdin.setEncoding('utf-8');
let inputBuffer = '';

stdin.on('data', async (chunk) => {
  // Add the new chunk to our buffer
  inputBuffer += chunk;
  
  // Process any complete lines in the buffer
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop(); // Keep the last incomplete line in the buffer
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const message = JSON.parse(line);
      await handleMessage(message);
    } catch (error) {
      console.error(`Failed to process message: ${error.message}`);
      sendError('parse_error', `Failed to parse JSON: ${error.message}`);
    }
  }
});

// Clean up when the process exits
process.on('exit', async () => {
  await driver.close();
});

// Handle MCP messages
async function handleMessage(message) {
  // Handle MCP protocol messages
  try {
    if (message.type === 'initialize') {
      // Respond to initialization request
      sendInitializeResponse(message);
    } else if (message.type === 'list_tools') {
      // Respond with available tools
      sendResponse(message.id, Object.keys(tools));
    } else if (message.type === 'invoke') {
      // Handle tool invocation
      await handleToolInvocation(message);
    } else {
      sendError(message.id, `Unknown message type: ${message.type}`);
    }
  } catch (error) {
    console.error(`Error handling message: ${error.message}`);
    sendError(message.id || 'error', error.message);
  }
}

// Send initialization response
function sendInitializeResponse(message) {
  console.error('Initialized Neo4j MCP server');
  
  const response = {
    type: 'initialize_response',
    server: {
      name: 'neo4j-mcp-server',
      version: '1.0.0',
      capabilities: {
        tools: Object.keys(tools)
      }
    }
  };
  
  sendMessage(response);
}

// Handle tool invocation
async function handleToolInvocation(message) {
  const { id, tool, args } = message;
  
  if (!tools[tool]) {
    sendError(id, `Unknown tool: ${tool}`);
    return;
  }
  
  try {
    const result = await tools[tool](args || {});
    sendResponse(id, result);
  } catch (error) {
    console.error(`Error invoking ${tool}: ${error.message}`);
    sendError(id, error.message);
  }
}

// Send MCP response
function sendResponse(id, result) {
  const response = {
    type: 'response',
    id,
    result
  };
  
  sendMessage(response);
}

// Send MCP error
function sendError(id, error) {
  const response = {
    type: 'error',
    id,
    error
  };
  
  sendMessage(response);
}

// Send message on stdout
function sendMessage(message) {
  stdout.write(JSON.stringify(message) + '\n');
}

// Logging that we started
console.error('Neo4j MCP server started');