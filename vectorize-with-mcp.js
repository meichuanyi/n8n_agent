/**
 * Vectorize Workflows with MCP
 * 
 * This script connects to the QDRANT MCP server and vectorizes workflows.
 */

const path = require('path');
const { connectToQdrantServer } = require('./mcp-client-config');

// Configuration
const WORKFLOWS_DIR = path.join(__dirname, 'workflows');
const PROCESSED_DIR = path.join(__dirname, 'processed-workflows');

/**
 * Vectorize workflows using the QDRANT MCP server
 */
async function vectorizeWorkflows() {
  console.log('Connecting to QDRANT MCP server...');
  const qdrantServer = connectToQdrantServer();
  
  // Initialize connection
  qdrantServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-vectorizer', version: '1.0.0' }
  });
  
  // Set up message handler
  qdrantServer.onMessage((message) => {
    console.log('Received message:', message);
    
    if (message.type === 'initialize_response') {
      console.log('QDRANT server connected successfully!');
      
      // Vector workflows
      console.log('Vectorizing workflows...');
      qdrantServer.send({
        type: 'invoke',
        id: 'vectorize',
        tool: 'vectorize_workflows',
        args: {
          workflowsDir: WORKFLOWS_DIR,
          processedDir: PROCESSED_DIR
        }
      });
    }
    
    // Handle the vectorization response
    if (message.type === 'response' && message.id === 'vectorize') {
      console.log('Vectorization completed:');
      console.log(message.result);
      
      // Search for similar workflows
      console.log('\nSearching for email automation workflows...');
      qdrantServer.send({
        type: 'invoke',
        id: 'search',
        tool: 'search_similar_workflows',
        args: {
          query: "workflow that handles email automation",
          limit: 5,
          filter: {
            category: "workflow",
            tags: ["email", "automation"]
          }
        }
      });
    }
    
    // Handle the search response
    if (message.type === 'response' && message.id === 'search') {
      console.log('Search results:');
      console.log(JSON.stringify(message.result, null, 2));
      
      // Get all workflow categories
      console.log('\nGetting workflow categories...');
      qdrantServer.send({
        type: 'invoke',
        id: 'categories',
        tool: 'get_workflow_categories',
        args: {}
      });
    }
    
    // Handle the categories response
    if (message.type === 'response' && message.id === 'categories') {
      console.log('Workflow categories:');
      console.log(message.result);
      
      // Get all workflow tags
      console.log('\nGetting workflow tags...');
      qdrantServer.send({
        type: 'invoke',
        id: 'tags',
        tool: 'get_workflow_tags',
        args: {}
      });
    }
    
    // Handle the tags response
    if (message.type === 'response' && message.id === 'tags') {
      console.log('Workflow tags:');
      console.log(message.result);
      
      // Close the connection
      console.log('\nDone. Closing connection...');
      setTimeout(() => {
        qdrantServer.close();
      }, 1000);
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error('Error from QDRANT server:', message.error);
      setTimeout(() => {
        qdrantServer.close();
      }, 1000);
    }
  });
}

// Run the vectorization
console.log('Starting workflow vectorization with MCP...');
vectorizeWorkflows().catch(console.error);