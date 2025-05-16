/**
 * n8n Workflow Validator CLI
 * 
 * This script validates n8n workflows against best practices.
 * It can validate workflows in n8n or locally stored workflow files.
 */

const fs = require('fs');
const path = require('path');
const { validateN8nWorkflow } = require('./n8n-mcp-client');
const { validateWorkflow } = require('./n8n-workflow-validator');

// Configuration
const PROCESSED_DIR = path.join(__dirname, 'processed-workflows');

/**
 * Parse command line arguments
 * @returns {Object} Parsed command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    workflowId: null,
    workflowFile: null,
    validators: ['naming', 'errorHandling', 'security', 'performance', 'documentation'],
    strictness: 'medium',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--strictness' || arg === '-s') {
      if (i + 1 < args.length) {
        const strictness = args[i + 1].toLowerCase();
        if (['low', 'medium', 'high'].includes(strictness)) {
          options.strictness = strictness;
          i++;
        }
      }
    } else if (arg === '--validators' || arg === '-v') {
      if (i + 1 < args.length) {
        const validators = args[i + 1].split(',');
        const validValidators = ['naming', 'errorHandling', 'security', 'performance', 'documentation'];
        const filteredValidators = validators.filter(v => validValidators.includes(v));
        if (filteredValidators.length > 0) {
          options.validators = filteredValidators;
          i++;
        }
      }
    } else if (arg === '--file' || arg === '-f') {
      if (i + 1 < args.length) {
        options.workflowFile = args[i + 1];
        i++;
      }
    } else if (!options.workflowId && !options.workflowFile) {
      // If no other identifier set, treat as workflow ID
      options.workflowId = arg;
    }
  }
  
  return options;
}

/**
 * Display usage help
 */
function showHelp() {
  console.log(`
n8n Workflow Validator

Usage:
  node validate-workflow.js [options] [workflow-id]
  
Options:
  -h, --help                Show this help message
  -s, --strictness LEVEL    Set validation strictness (low, medium, high)
  -v, --validators LIST     Comma-separated list of validators to run
                           (naming,errorHandling,security,performance,documentation)
  -f, --file PATH           Validate a local workflow file instead of one in n8n

Examples:
  node validate-workflow.js 123456                       # Validate workflow by ID
  node validate-workflow.js -s high 123456               # Validate with high strictness
  node validate-workflow.js -v naming,security 123456    # Only run naming and security validators
  node validate-workflow.js -f ./workflows/workflow.json # Validate a local workflow file
  `);
}

/**
 * Validate a local workflow file
 * @param {string} filePath - Path to the workflow file
 * @param {Object} options - Validation options
 */
function validateLocalWorkflow(filePath, options) {
  try {
    console.log(`Validating workflow file: ${filePath}`);
    
    // Read the workflow file
    const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Extract the original workflow if this is a processed workflow
    const workflow = workflowData.originalWorkflow || workflowData;
    
    // Validate the workflow
    const validationResults = validateWorkflow(workflow, {
      validators: options.validators,
      strictness: options.strictness
    });
    
    // Print validation results
    console.log('\nWorkflow Validation Results:');
    console.log('==========================');
    console.log(`Workflow: ${validationResults.workflow.name || filePath}`);
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
  } catch (error) {
    console.error(`Error validating workflow file: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const options = parseArgs();
  
  // Show help if requested or no workflow ID or file provided
  if (options.help || (!options.workflowId && !options.workflowFile)) {
    showHelp();
    return;
  }
  
  // Validate a workflow in n8n
  if (options.workflowId) {
    await validateN8nWorkflow(options.workflowId, {
      validators: options.validators,
      strictness: options.strictness
    });
  }
  // Validate a local workflow file
  else if (options.workflowFile) {
    validateLocalWorkflow(options.workflowFile, options);
  }
}

// Run the main function
main().catch(console.error);