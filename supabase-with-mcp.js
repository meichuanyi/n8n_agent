/**
 * Supabase Integration with MCP
 * 
 * This script connects to the Supabase MCP server and stores workflow data.
 */

const path = require('path');
const fs = require('fs');
const { connectToSupabaseServer } = require('./mcp-client-config');

// Configuration
const PROCESSED_DIR = path.join(__dirname, 'processed-workflows');

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
 * Store workflows in Supabase using the MCP server
 */
async function storeWorkflowsInSupabase() {
  console.log('Loading processed workflows...');
  const workflows = loadProcessedWorkflows();
  console.log(`Loaded ${workflows.length} processed workflows`);
  
  console.log('Connecting to Supabase MCP server...');
  const supabaseServer = connectToSupabaseServer();
  
  // Initialize connection
  supabaseServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-supabase', version: '1.0.0' }
  });
  
  let workflowIndex = 0;
  let initialized = false;
  
  // Set up message handler
  supabaseServer.onMessage((message) => {
    console.log('Received message type:', message.type);
    
    if (message.type === 'initialize_response') {
      console.log('Supabase server connected successfully!');
      initialized = true;
      
      // Get the tools available in the Supabase MCP server
      supabaseServer.send({
        type: 'list_tools',
        id: 'list_tools'
      });
    }
    
    // Handle the list_tools response
    if (message.type === 'response' && message.id === 'list_tools') {
      console.log('Available tools in Supabase MCP server:');
      console.log(message.result);
      
      // Start storing workflows
      if (workflows.length > 0 && workflowIndex < workflows.length) {
        const workflow = workflows[workflowIndex];
        console.log(`Storing workflow ${workflowIndex + 1}/${workflows.length}: ${workflow.name}`);
        
        supabaseServer.send({
          type: 'invoke',
          id: `store_${workflowIndex}`,
          tool: 'store_workflow',
          args: workflow
        });
      } else {
        console.log('No workflows to store');
        supabaseServer.close();
      }
    }
    
    // Handle workflow store response
    if (message.type === 'response' && message.id.startsWith('store_')) {
      console.log(`Workflow stored successfully: ${message.id}`);
      
      // Store the next workflow
      workflowIndex++;
      
      if (workflowIndex < workflows.length) {
        const workflow = workflows[workflowIndex];
        console.log(`Storing workflow ${workflowIndex + 1}/${workflows.length}: ${workflow.name}`);
        
        supabaseServer.send({
          type: 'invoke',
          id: `store_${workflowIndex}`,
          tool: 'store_workflow',
          args: workflow
        });
      } else {
        console.log('All workflows stored successfully!');
        
        // Search for workflows
        console.log('\nSearching for workflows in Supabase...');
        supabaseServer.send({
          type: 'invoke',
          id: 'search',
          tool: 'search_workflows',
          args: {
            category: 'agent',
            tags: ['openai', 'webhook']
          }
        });
      }
    }
    
    // Handle search response
    if (message.type === 'response' && message.id === 'search') {
      console.log('Search results:');
      console.log(JSON.stringify(message.result, null, 2));
      
      // Get categories
      supabaseServer.send({
        type: 'invoke',
        id: 'categories',
        tool: 'get_categories',
        args: {}
      });
    }
    
    // Handle categories response
    if (message.type === 'response' && message.id === 'categories') {
      console.log('Workflow categories:');
      console.log(message.result);
      
      // Get tags
      supabaseServer.send({
        type: 'invoke',
        id: 'tags',
        tool: 'get_tags',
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
        supabaseServer.close();
      }, 1000);
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error('Error from Supabase server:', message.error);
      
      // Try the next workflow if there was an error
      if (message.id.startsWith('store_')) {
        workflowIndex++;
        
        if (workflowIndex < workflows.length) {
          const workflow = workflows[workflowIndex];
          console.log(`Storing workflow ${workflowIndex + 1}/${workflows.length}: ${workflow.name}`);
          
          supabaseServer.send({
            type: 'invoke',
            id: `store_${workflowIndex}`,
            tool: 'store_workflow',
            args: workflow
          });
        } else {
          console.log('Finished processing all workflows');
          supabaseServer.close();
        }
      } else {
        setTimeout(() => {
          supabaseServer.close();
        }, 1000);
      }
    }
  });
  
  // Handle any connection issues
  setTimeout(() => {
    if (!initialized) {
      console.log('Failed to initialize connection to Supabase MCP server. Please check your configuration.');
      supabaseServer.close();
    }
  }, 10000);
}

// Run the function
console.log('Starting Supabase MCP integration...');
storeWorkflowsInSupabase().catch(console.error);