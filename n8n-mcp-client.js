/**
 * n8n MCP Client
 * 
 * This script connects to the n8n MCP server running in a Docker container
 * and demonstrates how to interact with n8n workflows.
 */

const path = require('path');
const { spawn } = require('child_process');

// Load environment variables from .env file
require('dotenv').config();

// Configuration - get from environment variables
const N8N_HOST = process.env.N8N_HOST || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Path to the n8n MCP server executable or script
const N8N_MCP_SERVER_PATH = process.env.N8N_MCP_SERVER_PATH || '/Users/kinglerbercy/MCP/n8n-mcp-server/build/index.js';

/**
 * Connect to the n8n MCP server
 * @returns {Object} - n8n MCP server connection object
 */
function connectToN8nServer() {
  // Environment variables for the n8n MCP server
  const env = {
    ...process.env,
    N8N_HOST,
    N8N_API_KEY
  };
  
  console.log(`Starting n8n MCP server with host: ${N8N_HOST}`);
  
  // Use Node.js to run the server script
  const serverProcess = spawn('node', [N8N_MCP_SERVER_PATH], {
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
 * Demonstrates n8n workflow management via MCP
 */
async function demonstrateN8nWorkflows() {
  console.log('Connecting to n8n MCP server...');
  const n8nServer = connectToN8nServer();
  
  // Initialize MCP connection
  n8nServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-client', version: '1.0.0' }
  });
  
  // Set up message handler
  n8nServer.onMessage((message) => {
    if (message.type === 'initialize_response') {
      console.log('n8n MCP server connected successfully!');
      console.log('Server info:', message.server);
      
      // Get available tools
      n8nServer.send({
        type: 'list_tools',
        id: 'list_tools'
      });
    }
    
    // Handle tool list response
    if (message.type === 'response' && message.id === 'list_tools') {
      console.log('\nAvailable n8n MCP tools:');
      console.log(message.result.join('\n'));
      
      // List workflows
      console.log('\nListing n8n workflows...');
      n8nServer.send({
        type: 'invoke',
        id: 'list_workflows',
        tool: 'list_workflows',
        args: {}
      });
    }
    
    // Handle list workflows response
    if (message.type === 'response' && message.id === 'list_workflows') {
      console.log('\nWorkflows in n8n:');
      const workflows = message.result;
      
      if (workflows && workflows.length > 0) {
        workflows.forEach((workflow, index) => {
          console.log(`${index + 1}. ${workflow.name} (ID: ${workflow.id})`);
        });
        
        // Get details of the first workflow
        if (workflows[0] && workflows[0].id) {
          console.log(`\nGetting details for workflow: ${workflows[0].name}`);
          n8nServer.send({
            type: 'invoke',
            id: 'get_workflow',
            tool: 'get_workflow',
            args: { workflowId: workflows[0].id }
          });
        } else {
          // No workflows, try to create one
          createExampleWorkflow(n8nServer);
        }
      } else {
        console.log('No workflows found');
        createExampleWorkflow(n8nServer);
      }
    }
    
    // Handle get workflow response
    if (message.type === 'response' && message.id === 'get_workflow') {
      console.log('\nWorkflow details:');
      const workflow = message.result;
      console.log(`Name: ${workflow.name}`);
      console.log(`Active: ${workflow.active}`);
      console.log(`Nodes: ${workflow.nodes?.length || 0}`);
      console.log(`Connections: ${Object.keys(workflow.connections || {}).length}`);
      
      // Get tags
      console.log('\nGetting workflow tags...');
      n8nServer.send({
        type: 'invoke',
        id: 'get_tags',
        tool: 'get_tags',
        args: {}
      });
    }
    
    // Handle get tags response
    if (message.type === 'response' && message.id === 'get_tags') {
      console.log('\nWorkflow tags:');
      const tags = message.result;
      
      if (tags && tags.length > 0) {
        tags.forEach((tag, index) => {
          console.log(`${index + 1}. ${tag.name} (ID: ${tag.id})`);
        });
      } else {
        console.log('No tags found');
      }
      
      // Finish demo
      console.log('\nDemo completed. Closing connection...');
      setTimeout(() => {
        n8nServer.close();
      }, 1000);
    }
    
    // Handle create workflow response
    if (message.type === 'response' && message.id === 'create_workflow') {
      console.log('\nWorkflow created:');
      const workflow = message.result;
      console.log(`Name: ${workflow.name}`);
      console.log(`ID: ${workflow.id}`);
      
      // Finish demo
      console.log('\nDemo completed. Closing connection...');
      setTimeout(() => {
        n8nServer.close();
      }, 1000);
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error('\nError from n8n MCP server:', message.error);
      setTimeout(() => {
        n8nServer.close();
      }, 1000);
    }
  });
}

/**
 * Create an example workflow
 * @param {Object} n8nServer - n8n MCP server connection
 */
function createExampleWorkflow(n8nServer) {
  console.log('\nCreating example workflow...');
  
  // Simple workflow definition with a Schedule trigger and an HTTP request
  const workflowData = {
    name: "Example Workflow from MCP",
    nodes: [
      {
        parameters: {
          triggerTimes: {
            item: [
              {
                mode: "everyX",
                value: 1,
                unit: "hours"
              }
            ]
          }
        },
        id: "6a904c6c-ebf2-4d97-b2e2-e3d0085e763a",
        name: "Schedule Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1,
        position: [250, 300]
      },
      {
        parameters: {
          url: "https://example.com/api",
          method: "GET",
          authentication: "none",
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: "Content-Type",
                value: "application/json"
              }
            ]
          },
          options: {}
        },
        id: "3a0a6fec-bbb4-4d8e-9526-248af25a307b",
        name: "HTTP Request",
        type: "n8n-nodes-base.httpRequest",
        typeVersion: 2,
        position: [500, 300]
      }
    ],
    connections: {
      "Schedule Trigger": {
        main: [
          [
            {
              node: "HTTP Request",
              type: "main",
              index: 0
            }
          ]
        ]
      }
    },
    active: false,
    settings: {
      executionOrder: "v1",
      saveManualExecutions: true,
      callerPolicy: "workflowsFromSameOwner"
    },
    tags: []
  };
  
  n8nServer.send({
    type: 'invoke',
    id: 'create_workflow',
    tool: 'create_workflow',
    args: { workflow: workflowData }
  });
}

// Use this function to import a workflow from the processed-workflows directory
function importWorkflow(n8nServer, workflowFilePath) {
  const fs = require('fs');
  
  if (!fs.existsSync(workflowFilePath)) {
    console.error(`Workflow file not found: ${workflowFilePath}`);
    return;
  }
  
  try {
    const workflowData = JSON.parse(fs.readFileSync(workflowFilePath, 'utf8'));
    
    // Extract the workflow data - if this is a processed workflow, get the original workflow
    const workflow = workflowData.originalWorkflow || workflowData;
    
    console.log(`Importing workflow: ${workflow.name || 'Unnamed workflow'}`);
    
    n8nServer.send({
      type: 'invoke',
      id: 'create_workflow',
      tool: 'create_workflow',
      args: { workflow }
    });
  } catch (error) {
    console.error(`Error importing workflow: ${error.message}`);
  }
}

// Run the demonstration
console.log('Starting n8n MCP client demonstration...');
demonstrateN8nWorkflows().catch(console.error);

/**
 * Validate a workflow in n8n
 * @param {string} workflowId - The ID of the workflow to validate
 * @param {Object} options - Validation options
 * @param {string[]} options.validators - Array of validators to run
 * @param {string} options.strictness - Validation strictness level
 */
async function validateN8nWorkflow(workflowId, options = {}) {
  const { validateWorkflow } = require('./n8n-workflow-validator');

  console.log(`Validating workflow ${workflowId}...`);
  const n8nServer = connectToN8nServer();

  // Initialize MCP connection
  n8nServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-validator', version: '1.0.0' }
  });

  // Set up message handler
  n8nServer.onMessage((message) => {
    if (message.type === 'initialize_response') {
      console.log('n8n MCP server connected successfully!');

      // Get workflow details
      n8nServer.send({
        type: 'invoke',
        id: 'get_workflow',
        tool: 'get_workflow',
        args: { workflowId }
      });
    }

    // Handle get workflow response
    if (message.type === 'response' && message.id === 'get_workflow') {
      console.log(`Retrieved workflow: ${message.result.name}`);

      // Validate the workflow
      const workflow = message.result;
      const validationResults = validateWorkflow(workflow, options);

      // Print validation results
      console.log('\nWorkflow Validation Results:');
      console.log('==========================');
      console.log(`Workflow: ${validationResults.workflow.name}`);
      console.log(`Strictness: ${validationResults.strictness}`);
      console.log(`Passed: ${validationResults.passed ? 'Yes' : 'No'}`);
      console.log(`Total Issues: ${validationResults.totalIssues}`);

      // Print detailed results by category
      Object.keys(validationResults.results).forEach(category => {
        const result = validationResults.results[category];
        console.log(`\n${category.charAt(0).toUpperCase() + category.slice(1)}:`);
        console.log(`  Passed: ${result.passed ? 'Yes' : 'No'}`);

        if (result.issues.length > 0) {
          console.log('  Issues:');
          result.issues.forEach(issue => {
            console.log(`    - ${issue}`);
          });
        }

        if (result.suggestions.length > 0) {
          console.log('  Suggestions:');
          result.suggestions.forEach(suggestion => {
            console.log(`    - ${suggestion}`);
          });
        }
      });

      // Close the connection
      setTimeout(() => {
        n8nServer.close();
      }, 1000);
    }

    // Handle errors
    if (message.type === 'error') {
      console.error(`Error: ${message.error}`);
      setTimeout(() => {
        n8nServer.close();
      }, 1000);
    }
  });
}

// Export functions for use in other scripts
module.exports = {
  connectToN8nServer,
  importWorkflow,
  validateN8nWorkflow
};