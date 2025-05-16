/**
 * MCP Client Configuration for n8n-templates
 * 
 * This file configures MCP clients for:
 * 1. QDRANT vector database server
 * 2. Supabase database server
 */

const path = require('path');
const { spawn } = require('child_process');

// Configuration
const QDRANT_SERVER_PATH = path.join('/Users/kinglerbercy/MCP/qdrant-server/index.js');
const SUPABASE_SERVER_PATH = path.join('/Users/kinglerbercy/MCP/supabase-mcp-server/supabase_mcp/main.py');

/**
 * Connect to an MCP server via stdio
 * @param {string} command - The command to execute the server
 * @param {string[]} args - Command line arguments
 * @param {Object} env - Environment variables
 * @returns {Object} - Server connection object
 */
function connectToMCPServer(command, args, env = {}) {
  // Combine process.env with additional env variables
  const serverEnv = { ...process.env, ...env };
  
  console.log(`Starting MCP server: ${command} ${args.join(' ')}`);
  
  // Spawn the server process
  const serverProcess = spawn(command, args, {
    env: serverEnv,
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
            console.error('Error parsing message:', err);
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
 * Connect to the QDRANT MCP server
 * @returns {Object} - QDRANT server connection object
 */
function connectToQdrantServer() {
  // Environment variables for QDRANT server
  const env = {
    QDRANT_URL: 'http://localhost:6333',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'your-openai-api-key'
  };
  
  return connectToMCPServer('node', [QDRANT_SERVER_PATH], env);
}

/**
 * Connect to the Supabase MCP server
 * @returns {Object} - Supabase server connection object
 */
function connectToSupabaseServer() {
  // Environment variables for Supabase server
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || 'your-supabase-url',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-supabase-service-role-key'
  };
  
  return connectToMCPServer('python', ['-m', 'supabase_mcp.main'], env);
}

/**
 * Example function to test connection to QDRANT server
 */
async function testQdrantServer() {
  const qdrantServer = connectToQdrantServer();
  
  // Initialize MCP connection
  qdrantServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates', version: '1.0.0' }
  });
  
  // Set up message handler
  qdrantServer.onMessage((message) => {
    console.log('Received from QDRANT server:', message);
    
    // If we got an initialization response, try a tool invocation
    if (message.type === 'initialize_response') {
      console.log('QDRANT server connected successfully!');
      
      // Example tool invocation - Get workflow categories
      qdrantServer.send({
        type: 'invoke',
        id: '1',
        tool: 'get_workflow_categories',
        args: {}
      });
    }
    
    // Handle tool invocation result
    if (message.type === 'response' && message.id === '1') {
      console.log('Tool invocation result:', message.result);
      
      // Close the connection after receiving the result
      setTimeout(() => {
        qdrantServer.close();
      }, 1000);
    }
  });
}

/**
 * Example function to test connection to Supabase server
 */
async function testSupabaseServer() {
  const supabaseServer = connectToSupabaseServer();
  
  // Initialize MCP connection
  supabaseServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates', version: '1.0.0' }
  });
  
  // Set up message handler
  supabaseServer.onMessage((message) => {
    console.log('Received from Supabase server:', message);
    
    // If we got an initialization response, try a tool invocation
    if (message.type === 'initialize_response') {
      console.log('Supabase server connected successfully!');
      
      // Example tool invocation - Get workflows
      supabaseServer.send({
        type: 'invoke',
        id: '1',
        tool: 'list_workflows',
        args: { limit: 5 }
      });
    }
    
    // Handle tool invocation result
    if (message.type === 'response' && message.id === '1') {
      console.log('Tool invocation result:', message.result);
      
      // Close the connection after receiving the result
      setTimeout(() => {
        supabaseServer.close();
      }, 1000);
    }
  });
}

// Export connection functions
module.exports = {
  connectToQdrantServer,
  connectToSupabaseServer,
  testQdrantServer,
  testSupabaseServer
};

// If this script is run directly, test the connections
if (require.main === module) {
  console.log('Testing MCP server connections...');
  
  // Test QDRANT server
  testQdrantServer().catch(console.error);
  
  // Wait a bit before testing Supabase server
  setTimeout(() => {
    testSupabaseServer().catch(console.error);
  }, 5000);
}