/**
 * Workflow Vectorization Script
 * 
 * This script processes n8n workflows, vectorizes them using the QDRANT MCP server,
 * and demonstrates how to search for similar workflows.
 */

const fs = require('fs');
const path = require('path');
const { processAllWorkflows } = require('./workflow-parser');

// Configuration
const WORKFLOWS_DIR = path.join(__dirname, 'workflows');
const PROCESSED_DIR = path.join(__dirname, 'processed-workflows');

/**
 * Main function to run the workflow vectorization process
 */
async function main() {
  try {
    console.log('Step 1: Processing workflows...');
    const processedWorkflows = await processAllWorkflows();
    console.log(`Successfully processed ${processedWorkflows.length} workflows`);
    
    console.log('\nStep 2: Vectorizing workflows using QDRANT MCP server...');
    console.log('Note: This requires the QDRANT MCP server to be running.');
    console.log('The MCP server should be configured in the Cline MCP settings.');
    console.log('To use this script, restart Cline after adding the MCP server configuration.');
    
    console.log('\nTo vectorize the workflows, use the following MCP tool:');
    console.log(`
    use_mcp_tool(
      server_name: "n8n-workflows-qdrant",
      tool_name: "vectorize_workflows",
      arguments: {
        "workflowsDir": "${WORKFLOWS_DIR}",
        "processedDir": "${PROCESSED_DIR}"
      }
    )
    `);
    
    console.log('\nTo search for similar workflows, use the following MCP tool:');
    console.log(`
    use_mcp_tool(
      server_name: "n8n-workflows-qdrant",
      tool_name: "search_similar_workflows",
      arguments: {
        "query": "workflow that handles email automation",
        "limit": 5,
        "filter": {
          "category": "workflow",
          "tags": ["email", "automation"],
          "complexity": "moderate"
        }
      }
    )
    `);
    
    console.log('\nTo get all workflow categories, use the following MCP tool:');
    console.log(`
    use_mcp_tool(
      server_name: "n8n-workflows-qdrant",
      tool_name: "get_workflow_categories",
      arguments: {}
    )
    `);
    
    console.log('\nTo get all workflow tags, use the following MCP tool:');
    console.log(`
    use_mcp_tool(
      server_name: "n8n-workflows-qdrant",
      tool_name: "get_workflow_tags",
      arguments: {}
    )
    `);
    
    // Print summary of processed workflows
    console.log('\nSummary of processed workflows:');
    const categories = {};
    const tags = new Set();
    
    processedWorkflows.forEach(workflow => {
      // Count categories
      if (!categories[workflow.category]) {
        categories[workflow.category] = 0;
      }
      categories[workflow.category]++;
      
      // Collect tags
      workflow.tags.forEach(tag => tags.add(tag));
    });
    
    console.log('Categories:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`- ${category}: ${count} workflows`);
    });
    
    console.log('\nTags:');
    console.log([...tags].sort().join(', '));
    
    console.log('\nWorkflow vectorization process completed successfully!');
  } catch (error) {
    console.error('Error in workflow vectorization process:', error);
  }
}

// Run the main function
main().catch(console.error);
