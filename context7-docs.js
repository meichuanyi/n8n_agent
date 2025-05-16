/**
 * Context7 MCP Client for n8n Documentation
 * 
 * This script uses the Context7 MCP to crawl and process n8n documentation.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const DOCS_URL = 'https://docs.n8n.io/';
const OUTPUT_DIR = path.join(__dirname, 'n8n-docs');
const BATCH_SIZE = 5; // Number of pages to process in parallel

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Connect to the Context7 MCP server
 * @returns {Object} - Context7 MCP server connection object
 */
function connectToContext7Server() {
  console.log('Starting Context7 MCP server...');
  
  // Use npx to run the server
  const serverProcess = spawn('npx', ['-y', '@upstash/context7-mcp@latest'], {
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
 * Crawl and process n8n documentation
 */
async function processN8nDocs() {
  console.log(`Processing n8n documentation from ${DOCS_URL}...`);
  const context7Server = connectToContext7Server();
  
  // Initialize connection
  context7Server.send({
    type: 'initialize',
    client: { name: 'n8n-templates-context7', version: '1.0.0' }
  });
  
  let initialized = false;
  let siteMapUrls = [];
  let processedUrls = 0;
  
  // Set up message handler
  context7Server.onMessage((message) => {
    if (message.type === 'initialize_response') {
      console.log('Context7 MCP server connected successfully!');
      console.log('Server info:', message.server);
      initialized = true;
      
      // List available tools
      context7Server.send({
        type: 'list_tools',
        id: 'list_tools'
      });
    }
    
    // Handle list_tools response
    if (message.type === 'response' && message.id === 'list_tools') {
      console.log('Available tools in Context7 MCP server:');
      console.log(message.result);
      
      // Get the sitemap URLs
      context7Server.send({
        type: 'invoke',
        id: 'get_sitemap',
        tool: 'get_sitemap',
        args: {
          url: DOCS_URL
        }
      });
    }
    
    // Handle get_sitemap response
    if (message.type === 'response' && message.id === 'get_sitemap') {
      console.log(`Retrieved ${message.result.length} URLs from sitemap`);
      siteMapUrls = message.result.filter(url => url.includes('docs.n8n.io') && !url.includes('#'));
      
      if (siteMapUrls.length > 0) {
        console.log(`Processing first batch of URLs (${Math.min(BATCH_SIZE, siteMapUrls.length)} URLs)...`);
        
        // Process the first batch of URLs
        for (let i = 0; i < Math.min(BATCH_SIZE, siteMapUrls.length); i++) {
          processedUrls++;
          processUrl(context7Server, siteMapUrls[i], processedUrls);
        }
      } else {
        console.log('No URLs found in sitemap');
        context7Server.close();
      }
    }
    
    // Handle get_page_content response
    if (message.type === 'response' && message.id.startsWith('page_')) {
      const urlIndex = parseInt(message.id.replace('page_', ''));
      console.log(`Processed URL ${urlIndex} of ${siteMapUrls.length}: ${message.result.url}`);
      
      // Save the processed content
      const fileName = `page_${urlIndex}_${Date.now()}.json`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      
      fs.writeFileSync(filePath, JSON.stringify(message.result, null, 2));
      console.log(`Saved content to ${filePath}`);
      
      // Process the next URL if available
      if (processedUrls < siteMapUrls.length) {
        processedUrls++;
        processUrl(context7Server, siteMapUrls[processedUrls - 1], processedUrls);
      } else if (processedUrls >= siteMapUrls.length) {
        console.log(`All ${siteMapUrls.length} URLs processed`);
        
        // Search the documentation for a specific term
        console.log('\nSearching for workflow information in the docs...');
        context7Server.send({
          type: 'invoke',
          id: 'search',
          tool: 'search_documents',
          args: {
            query: "How to create a workflow in n8n?",
            document_sources: ["web"],
            document_urls: [DOCS_URL],
            max_results: 5
          }
        });
      }
    }
    
    // Handle search_documents response
    if (message.type === 'response' && message.id === 'search') {
      console.log('Search results:');
      console.log(JSON.stringify(message.result, null, 2));
      
      // Process complete, close the connection
      console.log('\nProcessing complete. Closing connection...');
      setTimeout(() => {
        context7Server.close();
      }, 1000);
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error(`Error from Context7 server: ${message.error}`);
      if (processedUrls < siteMapUrls.length) {
        // Skip to the next URL if there was an error
        processedUrls++;
        if (processedUrls < siteMapUrls.length) {
          processUrl(context7Server, siteMapUrls[processedUrls - 1], processedUrls);
        }
      } else {
        context7Server.close();
      }
    }
  });
  
  // Set a timeout for initialization
  setTimeout(() => {
    if (!initialized) {
      console.log('Sending initialization request to Context7 MCP server...');
      // Try again with initialization
      context7Server.send({
        type: 'initialize',
        client: { name: 'n8n-templates-context7', version: '1.0.0' }
      });
      
      // Set another timeout to check again
      setTimeout(() => {
        if (!initialized) {
          console.log('Failed to initialize connection to Context7 MCP server');
          context7Server.close();
        }
      }, 10000);
    }
  }, 5000);
}

/**
 * Process a single URL
 * @param {Object} server - Context7 MCP server connection
 * @param {string} url - URL to process
 * @param {number} index - URL index for tracking
 */
function processUrl(server, url, index) {
  console.log(`Processing URL ${index}: ${url}`);
  
  server.send({
    type: 'invoke',
    id: `page_${index}`,
    tool: 'get_page_content',
    args: {
      url: url,
      extract_headings: true,
      extract_links: true,
      extract_text: true
    }
  });
}

// Run the main function
console.log('Starting n8n documentation processing with Context7 MCP...');
processN8nDocs().catch(console.error);