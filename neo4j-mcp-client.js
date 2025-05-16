/**
 * Neo4j MCP Client
 * 
 * This script connects to the Neo4j MCP server and demonstrates how to store
 * n8n workflows as a knowledge graph in Neo4j.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Load environment variables from .env file
require('dotenv').config();

// Configuration
const NEO4J_MCP_SERVER_PATH = path.join(__dirname, 'neo4j-mcp/index.js');
const PROCESSED_DIR = path.join(__dirname, 'processed-workflows');

/**
 * Connect to the Neo4j MCP server
 * @returns {Object} - Neo4j MCP server connection object
 */
function connectToNeo4jServer() {
  // Environment variables for the Neo4j MCP server
  const env = {
    ...process.env,
    NEO4J_URI: process.env.NEO4J_URI || 'bolt://localhost:7687',
    NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'password'
  };
  
  console.log(`Starting Neo4j MCP server with URI: ${env.NEO4J_URI}`);
  
  // Use Node.js to run the server script
  const serverProcess = spawn('node', [NEO4J_MCP_SERVER_PATH], {
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Log server startup
  serverProcess.stdout.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`Server stderr: ${data}`);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
  
  // Return an object representing the connection
  return {
    process: serverProcess,
    send: (message) => {
      serverProcess.stdin.write(JSON.stringify(message) + '\n');
    },
    onMessage: (callback) => {
      let buffer = '';
      serverProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const messages = buffer.split('\n');
        buffer = messages.pop();
        
        for (const msg of messages) {
          try {
            const parsedMsg = JSON.parse(msg);
            callback(parsedMsg);
          } catch (err) {
            // Might be non-JSON output from the server, just log it
            if (msg.trim()) {
              console.log(`Server output: ${msg.trim()}`);
            }
          }
        }
      });
    },
    close: () => {
      serverProcess.kill();
    }
  };
}

/**
 * Load processed workflows from the processed-workflows directory
 * @returns {Array} Array of processed workflow objects
 */
function loadProcessedWorkflows() {
  const summaryPath = path.join(PROCESSED_DIR, 'workflows-summary.json');
  
  if (fs.existsSync(summaryPath)) {
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  }
  
  // If summary doesn't exist, try to load individual files
  const files = fs.readdirSync(PROCESSED_DIR).filter(file => file.endsWith('.json') && file !== 'workflows-summary.json');
  
  return files.map(file => {
    const filePath = path.join(PROCESSED_DIR, file);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  });
}

/**
 * Demonstrates Neo4j workflow storage and retrieval
 */
async function demonstrateNeo4jWorkflows() {
  console.log('Loading processed workflows...');
  const workflows = loadProcessedWorkflows();
  console.log(`Loaded ${workflows.length} processed workflows`);
  
  console.log('Connecting to Neo4j MCP server...');
  const neo4jServer = connectToNeo4jServer();
  
  // Initialize MCP connection
  neo4jServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-neo4j', version: '1.0.0' }
  });
  
  let workflowIndex = 0;
  let initialized = false;
  
  // Set up message handler
  neo4jServer.onMessage((message) => {
    console.log('Received message type:', message.type);
    
    if (message.type === 'initialize_response') {
      console.log('Neo4j MCP server connected successfully!');
      console.log('Server info:', message.server);
      initialized = true;
      
      // Get the tools available in the Neo4j MCP server
      neo4jServer.send({
        type: 'list_tools',
        id: 'list_tools'
      });
    }
    
    // Handle the list_tools response
    if (message.type === 'response' && message.id === 'list_tools') {
      console.log('Available tools in Neo4j MCP server:');
      console.log(message.result);
      
      // Start storing workflows
      if (workflows.length > 0 && workflowIndex < workflows.length) {
        const workflow = workflows[workflowIndex];
        console.log(`Storing workflow ${workflowIndex + 1}/${workflows.length}: ${workflow.name}`);
        
        neo4jServer.send({
          type: 'invoke',
          id: `store_${workflowIndex}`,
          tool: 'store_workflow',
          args: workflow
        });
      } else {
        console.log('No workflows to store');
        neo4jServer.close();
      }
    }
    
    // Handle workflow store response
    if (message.type === 'response' && message.id.startsWith('store_')) {
      console.log(`Workflow stored successfully: ${message.id}`);
      console.log(message.result);
      
      // Store the next workflow
      workflowIndex++;
      
      if (workflowIndex < workflows.length && workflowIndex < 5) { // Limit to 5 workflows for demo
        const workflow = workflows[workflowIndex];
        console.log(`Storing workflow ${workflowIndex + 1}/${workflows.length}: ${workflow.name}`);
        
        neo4jServer.send({
          type: 'invoke',
          id: `store_${workflowIndex}`,
          tool: 'store_workflow',
          args: workflow
        });
      } else {
        console.log('Demo workflows stored successfully!');
        
        // Try retrieving a workflow
        if (workflows.length > 0) {
          console.log('\nRetrieving workflow:', workflows[0].name);
          neo4jServer.send({
            type: 'invoke',
            id: 'get_workflow',
            tool: 'get_workflow',
            args: { id: workflows[0].id || generateId(workflows[0].name) }
          });
        } else {
          neo4jServer.close();
        }
      }
    }
    
    // Handle get workflow response
    if (message.type === 'response' && message.id === 'get_workflow') {
      console.log('Retrieved workflow:');
      console.log(JSON.stringify(message.result, null, 2));
      
      // Get workflow relationships
      if (message.result.success) {
        const workflowId = message.result.workflow.id;
        console.log('\nGetting workflow relationships for:', workflowId);
        neo4jServer.send({
          type: 'invoke',
          id: 'get_relationships',
          tool: 'get_workflow_relationships',
          args: { id: workflowId, relationshipType: 'nodes' }
        });
      } else {
        // Close the connection
        console.log('\nDone. Closing connection...');
        setTimeout(() => {
          neo4jServer.close();
        }, 1000);
      }
    }
    
    // Handle get relationships response
    if (message.type === 'response' && message.id === 'get_relationships') {
      console.log('Workflow relationships:');
      console.log(JSON.stringify(message.result, null, 2));
      
      // Search for workflows
      console.log('\nSearching for workflows with specific tags...');
      neo4jServer.send({
        type: 'invoke',
        id: 'search',
        tool: 'search_workflows',
        args: {
          tags: ['automation', 'webhook'],
          limit: 5
        }
      });
    }
    
    // Handle search response
    if (message.type === 'response' && message.id === 'search') {
      console.log('Search results:');
      console.log(JSON.stringify(message.result, null, 2));
      
      // Get categories
      neo4jServer.send({
        type: 'invoke',
        id: 'categories',
        tool: 'get_workflow_categories',
        args: {}
      });
    }
    
    // Handle categories response
    if (message.type === 'response' && message.id === 'categories') {
      console.log('Workflow categories:');
      console.log(message.result);
      
      // Get tags
      neo4jServer.send({
        type: 'invoke',
        id: 'tags',
        tool: 'get_workflow_tags',
        args: {}
      });
    }
    
    // Handle tags response
    if (message.type === 'response' && message.id === 'tags') {
      console.log('Workflow tags:');
      console.log(message.result);
      
      // Close the connection
      console.log('\nDone. Closing connection...');
      setTimeout(() => {
        neo4jServer.close();
      }, 1000);
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error('Error from Neo4j server:', message.error);
      
      // Try the next workflow if there was an error
      if (message.id.startsWith('store_')) {
        workflowIndex++;
        
        if (workflowIndex < workflows.length && workflowIndex < 5) {
          const workflow = workflows[workflowIndex];
          console.log(`Storing workflow ${workflowIndex + 1}/${workflows.length}: ${workflow.name}`);
          
          neo4jServer.send({
            type: 'invoke',
            id: `store_${workflowIndex}`,
            tool: 'store_workflow',
            args: workflow
          });
        } else {
          console.log('Finished processing demo workflows');
          neo4jServer.close();
        }
      } else {
        setTimeout(() => {
          neo4jServer.close();
        }, 1000);
      }
    }
  });
  
  // Handle any connection issues
  setTimeout(() => {
    if (!initialized) {
      console.log('Failed to initialize connection to Neo4j MCP server. Please check your configuration.');
      neo4jServer.close();
    }
  }, 10000);
}

/**
 * Generate an ID from a name
 * @param {string} name - The name to convert
 * @returns {string} The generated ID
 */
function generateId(name) {
  if (!name) return `workflow_${Date.now()}`;
  
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    + '_' + Date.now().toString(36);
}

// Run the demonstration if this script is executed directly
if (require.main === module) {
  console.log('Starting Neo4j MCP integration demo...');
  demonstrateNeo4jWorkflows().catch(console.error);
}

// Export functions for use in other scripts
module.exports = {
  connectToNeo4jServer,
  demonstrateNeo4jWorkflows
};