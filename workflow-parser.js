/**
 * Workflow Parser
 * 
 * This script parses n8n workflows, extracts metadata, and generates descriptions.
 * It will be used to vectorize workflows and store them in databases.
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

// Configuration
const WORKFLOWS_DIR = path.join(__dirname, 'workflows');
const OUTPUT_DIR = path.join(__dirname, 'processed-workflows');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extract category from filename
 * @param {string} filename - The workflow filename
 * @returns {string} The category
 */
function extractCategory(filename) {
  const parts = filename.split(':');
  if (parts.length > 1) {
    return parts[0];
  }
  return 'uncategorized';
}

/**
 * Extract name from filename
 * @param {string} filename - The workflow filename
 * @returns {string} The name
 */
function extractName(filename) {
  const parts = filename.split(':');
  if (parts.length > 1) {
    // Remove .json extension from the second part
    return parts[1].replace('.json', '');
  }
  return filename.replace('.json', '');
}

/**
 * Generate a description for a workflow based on its content
 * @param {Object} workflow - The workflow object
 * @returns {string} Generated description
 */
function generateDescription(workflow) {
  let description = '';
  
  // Add workflow name
  if (workflow.name) {
    description += `Workflow Name: ${workflow.name}\n\n`;
  }
  
  // Extract node types and count
  const nodeTypes = {};
  const nodeNames = new Set();
  
  if (workflow.nodes && Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach(node => {
      if (node.type) {
        nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
      }
      if (node.name) {
        nodeNames.add(node.name);
      }
    });
  }
  
  // Add node type summary
  description += 'Node Types:\n';
  Object.entries(nodeTypes).forEach(([type, count]) => {
    description += `- ${type}: ${count}\n`;
  });
  
  // Add node names
  description += '\nNode Names:\n';
  Array.from(nodeNames).forEach(name => {
    description += `- ${name}\n`;
  });
  
  // Add sticky notes content if available
  const stickyNotes = workflow.nodes?.filter(node => node.type === 'n8n-nodes-base.stickyNote');
  if (stickyNotes && stickyNotes.length > 0) {
    description += '\nWorkflow Documentation:\n';
    stickyNotes.forEach(note => {
      if (note.parameters?.content) {
        description += `${note.parameters.content}\n`;
      }
    });
  }
  
  return description;
}

/**
 * Extract tags from a workflow
 * @param {Object} workflow - The workflow object
 * @returns {string[]} Array of tags
 */
function extractTags(workflow) {
  const tags = new Set();
  
  // Add existing tags if available
  if (workflow.tags && Array.isArray(workflow.tags)) {
    workflow.tags.forEach(tag => tags.add(tag));
  }
  
  // Extract node types as tags
  if (workflow.nodes && Array.isArray(workflow.nodes)) {
    workflow.nodes.forEach(node => {
      if (node.type) {
        // Extract the base node type without version or namespace
        const baseType = node.type.split('.').pop();
        if (baseType) tags.add(baseType);
        
        // Add service-specific tags
        if (node.type.includes('gmail')) tags.add('gmail');
        if (node.type.includes('google')) tags.add('google');
        if (node.type.includes('openai')) tags.add('openai');
        if (node.type.includes('langchain')) tags.add('langchain');
        if (node.type.includes('webhook')) tags.add('webhook');
        if (node.type.includes('http')) tags.add('http');
        if (node.type.includes('database')) tags.add('database');
        if (node.type.includes('postgres')) tags.add('postgres');
        if (node.type.includes('supabase')) tags.add('supabase');
      }
    });
  }
  
  return Array.from(tags);
}

/**
 * Analyze workflow complexity
 * @param {Object} workflow - The workflow object
 * @returns {Object} Complexity metrics
 */
function analyzeComplexity(workflow) {
  const metrics = {
    nodeCount: 0,
    connectionCount: 0,
    uniqueNodeTypes: 0,
    complexity: 'simple'
  };
  
  if (workflow.nodes && Array.isArray(workflow.nodes)) {
    metrics.nodeCount = workflow.nodes.length;
    
    // Count unique node types
    const nodeTypes = new Set();
    workflow.nodes.forEach(node => {
      if (node.type) nodeTypes.add(node.type);
    });
    metrics.uniqueNodeTypes = nodeTypes.size;
  }
  
  // Count connections
  if (workflow.connections) {
    let connectionCount = 0;
    Object.values(workflow.connections).forEach(conn => {
      if (Array.isArray(conn.main)) {
        conn.main.forEach(mainConn => {
          if (Array.isArray(mainConn)) {
            connectionCount += mainConn.length;
          }
        });
      }
    });
    metrics.connectionCount = connectionCount;
  }
  
  // Determine complexity
  if (metrics.nodeCount > 15 || metrics.connectionCount > 20) {
    metrics.complexity = 'complex';
  } else if (metrics.nodeCount > 7 || metrics.connectionCount > 10) {
    metrics.complexity = 'moderate';
  }
  
  return metrics;
}

/**
 * Process a single workflow file
 * @param {string} filePath - Path to the workflow file
 * @returns {Object} Processed workflow data
 */
async function processWorkflow(filePath) {
  try {
    const filename = path.basename(filePath);
    const fileContent = await readFile(filePath, 'utf8');
    const workflow = JSON.parse(fileContent);
    
    const category = extractCategory(filename);
    const name = extractName(filename);
    const description = generateDescription(workflow);
    const tags = extractTags(workflow);
    const complexity = analyzeComplexity(workflow);
    
    // Create enriched workflow object
    const enrichedWorkflow = {
      id: workflow.id || `generated-${Date.now()}`,
      originalFilename: filename,
      category,
      name,
      description,
      tags,
      complexity,
      originalWorkflow: workflow
    };
    
    return enrichedWorkflow;
  } catch (error) {
    console.error(`Error processing workflow ${filePath}:`, error);
    return null;
  }
}

/**
 * Main function to process all workflows
 */
async function processAllWorkflows() {
  try {
    // Get all workflow files
    const files = await readdir(WORKFLOWS_DIR);
    const workflowFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${workflowFiles.length} workflow files to process`);
    
    // Process each workflow
    const processedWorkflows = [];
    for (const file of workflowFiles) {
      const filePath = path.join(WORKFLOWS_DIR, file);
      const processedWorkflow = await processWorkflow(filePath);
      
      if (processedWorkflow) {
        processedWorkflows.push(processedWorkflow);
        
        // Save individual processed workflow
        const outputPath = path.join(OUTPUT_DIR, `${processedWorkflow.id}.json`);
        await writeFile(outputPath, JSON.stringify(processedWorkflow, null, 2));
      }
    }
    
    // Save summary of all workflows
    const summaryPath = path.join(OUTPUT_DIR, 'workflows-summary.json');
    await writeFile(summaryPath, JSON.stringify(processedWorkflows, null, 2));
    
    console.log(`Successfully processed ${processedWorkflows.length} workflows`);
    console.log(`Results saved to ${OUTPUT_DIR}`);
    
    return processedWorkflows;
  } catch (error) {
    console.error('Error processing workflows:', error);
    return [];
  }
}

// Export functions for use in other scripts
module.exports = {
  processAllWorkflows,
  processWorkflow,
  generateDescription,
  extractTags,
  analyzeComplexity
};

// Run the script if executed directly
if (require.main === module) {
  processAllWorkflows().catch(console.error);
}
