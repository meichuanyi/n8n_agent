/**
 * Direct File Dump Script
 * 
 * This script directly copies all workflow files to a dump directory.
 */

const fs = require('fs');
const path = require('path');

// Create dumps directory if it doesn't exist
const DUMPS_DIR = path.join(__dirname, 'database-dumps', 'files');
if (!fs.existsSync(DUMPS_DIR)) {
  fs.mkdirSync(DUMPS_DIR, { recursive: true });
}

// Directories to copy
const dirs = [
  {
    source: 'processed-workflows',
    destination: path.join(DUMPS_DIR, 'processed-workflows')
  },
  {
    source: 'workflows',
    destination: path.join(DUMPS_DIR, 'workflows')
  },
  {
    source: 'default_levelgraph_db',
    destination: path.join(DUMPS_DIR, 'levelgraph')
  }
];

// Copy all files from source to destination
function copyDirectory(source, destination) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  // Get all files in source directory
  const files = fs.readdirSync(source);
  
  // Copy each file to destination
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const destPath = path.join(destination, file);
    
    // Check if it's a directory
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${sourcePath} to ${destPath}`);
    }
  }
}

// Copy all directories
console.log('Starting direct file dump...');
for (const dir of dirs) {
  if (fs.existsSync(dir.source)) {
    console.log(`Copying ${dir.source} to ${dir.destination}...`);
    copyDirectory(dir.source, dir.destination);
  } else {
    console.error(`Source directory does not exist: ${dir.source}`);
  }
}

console.log('Direct file dump completed successfully!'); 