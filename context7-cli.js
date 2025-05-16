/**
 * Context7 CLI script for n8n documentation
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, 'n8n-docs');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Initialize and search in the same command
console.log('Searching n8n documentation...');
try {
  const command = `echo '{"type":"initialize","client":{"name":"n8n-docs","version":"1.0.0"}}
{"type":"invoke","id":"search1","tool":"search_documents","args":{"query":"How to create a workflow in n8n?","document_sources":["web"],"document_urls":["https://docs.n8n.io/"],"max_results":3}}' | npx -y @upstash/context7-mcp@latest`;
  
  const result = execSync(command, { encoding: 'utf-8' });
  
  // Write the output to a file
  const outputFile = path.join(OUTPUT_DIR, 'search_results.json');
  fs.writeFileSync(outputFile, result);
  
  console.log(`Output saved to ${outputFile}`);
  console.log('Processing completed successfully!');
} catch (error) {
  console.error('Error executing Context7 command:', error.message);
}