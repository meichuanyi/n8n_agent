/**
 * Simple Context7 MCP example
 */
const { spawn } = require('child_process');

// Use npx to run the Context7 MCP server
const process = spawn('npx', ['-y', '@upstash/context7-mcp@latest'], {
  stdio: 'inherit'
});

// Handle process termination
process.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});