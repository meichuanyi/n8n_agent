/**
 * Import Workflows to n8n
 * 
 * This script imports processed workflows into an n8n instance using the MCP server.
 */

const fs = require('fs');
const path = require('path');
const { connectToN8nServer, importWorkflow } = require('./n8n-mcp-client');

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
 * Import all processed workflows into n8n
 */
async function importAllWorkflows() {
  console.log('Loading processed workflows...');
  const workflows = loadProcessedWorkflows();
  console.log(`Loaded ${workflows.length} processed workflows`);
  
  console.log('Connecting to n8n MCP server...');
  const n8nServer = connectToN8nServer();
  
  // Initialize connection
  n8nServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-importer', version: '1.0.0' }
  });
  
  let workflowIndex = 0;
  let initialized = false;
  
  // Set up message handler
  n8nServer.onMessage((message) => {
    if (message.type === 'initialize_response') {
      console.log('n8n MCP server connected successfully!');
      initialized = true;
      
      if (workflows.length > 0) {
        importNextWorkflow();
      } else {
        console.log('No workflows to import');
        n8nServer.close();
      }
    }
    
    // Handle workflow import response
    if (message.type === 'response' && message.id.startsWith('import_')) {
      console.log(`Workflow imported successfully: ${workflows[workflowIndex].name || 'Unnamed workflow'}`);
      
      // Import the next workflow
      workflowIndex++;
      if (workflowIndex < workflows.length) {
        importNextWorkflow();
      } else {
        console.log('All workflows imported successfully!');
        setTimeout(() => {
          n8nServer.close();
        }, 1000);
      }
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error(`Error importing workflow: ${message.error}`);
      
      // Try the next workflow if there was an error
      workflowIndex++;
      if (workflowIndex < workflows.length) {
        importNextWorkflow();
      } else {
        console.log('Finished processing all workflows');
        setTimeout(() => {
          n8nServer.close();
        }, 1000);
      }
    }
  });
  
  // Import the next workflow in the queue
  function importNextWorkflow() {
    const workflow = workflows[workflowIndex];
    console.log(`Importing workflow ${workflowIndex + 1}/${workflows.length}: ${workflow.name || 'Unnamed workflow'}`);
    
    // Extract the original workflow data
    const workflowData = workflow.originalWorkflow || workflow;
    
    // Send import request
    n8nServer.send({
      type: 'invoke',
      id: `import_${workflowIndex}`,
      tool: 'create_workflow',
      args: { workflow: workflowData }
    });
  }
  
  // Handle any connection issues
  setTimeout(() => {
    if (!initialized) {
      console.log('Failed to initialize connection to n8n MCP server. Please check your configuration.');
      n8nServer.close();
    }
  }, 10000);
}

// Function to import a single workflow by ID or filename
function importSingleWorkflow(workflowIdOrFile) {
  // Check if the argument is a file path or just an ID
  let workflowFile;
  
  if (workflowIdOrFile.endsWith('.json')) {
    workflowFile = workflowIdOrFile;
  } else {
    workflowFile = path.join(PROCESSED_DIR, `${workflowIdOrFile}.json`);
  }
  
  if (!fs.existsSync(workflowFile)) {
    console.error(`Workflow file not found: ${workflowFile}`);
    return;
  }
  
  console.log(`Importing single workflow from: ${workflowFile}`);
  
  const n8nServer = connectToN8nServer();
  
  // Initialize connection
  n8nServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-importer', version: '1.0.0' }
  });
  
  // Set up message handler
  n8nServer.onMessage((message) => {
    if (message.type === 'initialize_response') {
      console.log('n8n MCP server connected successfully!');
      
      // Read and import the workflow file
      try {
        const workflowData = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
        const workflow = workflowData.originalWorkflow || workflowData;
        
        console.log(`Importing workflow: ${workflow.name || 'Unnamed workflow'}`);
        
        n8nServer.send({
          type: 'invoke',
          id: 'import_single',
          tool: 'create_workflow',
          args: { workflow }
        });
      } catch (error) {
        console.error(`Error reading or parsing workflow file: ${error.message}`);
        n8nServer.close();
      }
    }
    
    // Handle workflow import response
    if (message.type === 'response' && message.id === 'import_single') {
      console.log('Workflow imported successfully!');
      console.log(`Workflow ID: ${message.result.id}`);
      console.log(`Workflow name: ${message.result.name}`);
      
      setTimeout(() => {
        n8nServer.close();
      }, 1000);
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error(`Error importing workflow: ${message.error}`);
      setTimeout(() => {
        n8nServer.close();
      }, 1000);
    }
  });
}

// Process command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Import all workflows if no arguments provided
  console.log('Importing all workflows...');
  importAllWorkflows().catch(console.error);
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
Import Workflows to n8n

Usage:
  node import-to-n8n.js               Import all workflows from processed-workflows directory
  node import-to-n8n.js <file.json>   Import a specific workflow file
  node import-to-n8n.js <id>          Import a specific workflow by ID from processed-workflows directory
  node import-to-n8n.js --help        Show this help message
  `);
} else {
  // Import a single workflow
  importSingleWorkflow(args[0]);
}

// Export functions for use in other scripts
module.exports = {
  loadProcessedWorkflows,
  importAllWorkflows,
  importSingleWorkflow
};