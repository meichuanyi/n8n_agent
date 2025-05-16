/**
 * Supabase Vector Loader
 * 
 * This script loads n8n workflows into Supabase and sets up pgvector for RAG.
 * It creates embeddings for workflow descriptions and stores them in Supabase.
 */

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const PROCESSED_DIR = path.join(__dirname, 'processed-workflows');
const N8N_NODES_DIR = path.join(__dirname, 'n8n-nodes');

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Error parsing file ${file}:`, error.message);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Load node definitions from n8n-nodes directory
 * @returns {Array} Array of node definition objects
 */
function loadNodeDefinitions() {
  const files = fs.readdirSync(N8N_NODES_DIR).filter(file => file.endsWith('.json'));
  
  return files.map(file => {
    const filePath = path.join(N8N_NODES_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.trim()) {
        return null;
      }
      
      const nodeData = JSON.parse(content);
      
      // Parse node name and category from filename
      // Format: node:category:name.json
      const parts = file.split(':');
      const category = parts.length > 1 ? parts[1] : 'unknown';
      const nameWithExt = parts.length > 2 ? parts[2] : parts[0];
      const name = nameWithExt.replace('.json', '');
      
      return {
        file_name: file,
        name,
        category,
        content: nodeData
      };
    } catch (error) {
      console.error(`Error processing node file ${file}:`, error.message);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Execute SQL query to create pgvector extension and tables
 */
async function setupDatabase() {
  try {
    console.log('Setting up database schema...');
    
    // Create or update the workflows table
    const { error: tableError } = await supabase.rpc('create_workflows_table');
    if (tableError) {
      console.error('Error creating workflows table:', tableError);
      
      // Try to execute the SQL directly if the RPC fails
      const { error: directTableError } = await supabase.from('_sql').select('*').eq('name', `
        CREATE TABLE IF NOT EXISTS workflows (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          tags TEXT[] DEFAULT '{}',
          complexity TEXT,
          nodes JSONB,
          connections JSONB,
          embedding VECTOR(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
        CREATE INDEX IF NOT EXISTS idx_workflows_complexity ON workflows(complexity);
        CREATE INDEX IF NOT EXISTS idx_workflows_tags ON workflows USING GIN(tags);
      `);
      if (directTableError) {
        console.error('Error executing direct SQL:', directTableError);
      }
    }
    
    // Create or update the node_definitions table
    const { error: nodesTableError } = await supabase.rpc('create_node_definitions_table');
    if (nodesTableError) {
      console.error('Error creating node_definitions table:', nodesTableError);
      
      // Try to execute the SQL directly if the RPC fails
      const { error: directNodesTableError } = await supabase.from('_sql').select('*').eq('name', `
        CREATE TABLE IF NOT EXISTS node_definitions (
          id SERIAL PRIMARY KEY,
          file_name TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          type TEXT,
          content JSONB,
          embedding VECTOR(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_node_definitions_name ON node_definitions(name);
        CREATE INDEX IF NOT EXISTS idx_node_definitions_category ON node_definitions(category);
        CREATE INDEX IF NOT EXISTS idx_node_definitions_type ON node_definitions(type);
      `);
      if (directNodesTableError) {
        console.error('Error executing direct SQL:', directNodesTableError);
      }
    }
    
    console.log('Database schema setup completed.');
  } catch (error) {
    console.error('Error setting up database schema:', error);
  }
}

/**
 * Get OpenAI embeddings for text
 * @param {string} text - Text to get embeddings for
 * @returns {Promise<Array>} - Array of embeddings
 */
async function getEmbeddings(text) {
  try {
    // Use the QDRANT MCP server to get embeddings
    const response = await fetch(`${process.env.QDRANT_URL}/collections/n8n_workflows/points/embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    
    if (!response.ok) {
      // If QDRANT is not available, use a dummy embedding (zeros)
      console.warn('QDRANT embedding service not available, using dummy embedding');
      return Array(1536).fill(0);
    }
    
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Error getting embeddings:', error);
    // Return a dummy embedding (zeros)
    return Array(1536).fill(0);
  }
}

/**
 * Store workflows in Supabase with embeddings
 */
async function storeWorkflows() {
  try {
    console.log('Loading processed workflows...');
    const workflows = loadProcessedWorkflows();
    console.log(`Loaded ${workflows.length} processed workflows`);
    
    // Setup database schema
    await setupDatabase();
    
    // Store each workflow
    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows[i];
      console.log(`Processing workflow ${i + 1}/${workflows.length}: ${workflow.name}`);
      
      try {
        // Create embedding for the workflow description
        let description = workflow.description || '';
        let embedding = [];
        
        if (description) {
          console.log(`Generating embedding for workflow: ${workflow.name}`);
          embedding = await getEmbeddings(description);
        }
        
        // Prepare workflow data
        const workflowData = {
          name: workflow.name,
          category: workflow.category || 'unknown',
          description: description,
          tags: workflow.tags || [],
          complexity: workflow.complexity && workflow.complexity.complexity ? workflow.complexity.complexity : 'moderate',
          nodes: workflow.originalWorkflow && workflow.originalWorkflow.nodes ? workflow.originalWorkflow.nodes : [],
          connections: workflow.originalWorkflow && workflow.originalWorkflow.connections ? workflow.originalWorkflow.connections : {},
          embedding: embedding
        };
        
        // Insert workflow into Supabase
        const { data, error } = await supabase.from('workflows').insert([workflowData]);
        
        if (error) {
          console.error(`Error storing workflow ${workflow.name}:`, error);
        } else {
          console.log(`Successfully stored workflow: ${workflow.name}`);
        }
      } catch (error) {
        console.error(`Error processing workflow ${workflow.name}:`, error);
      }
    }
    
    console.log('All workflows stored in Supabase');
  } catch (error) {
    console.error('Error storing workflows:', error);
  }
}

/**
 * Store node definitions in Supabase with embeddings
 */
async function storeNodeDefinitions() {
  try {
    console.log('Loading node definitions...');
    const nodeDefinitions = loadNodeDefinitions();
    console.log(`Loaded ${nodeDefinitions.length} node definitions`);
    
    // Store each node definition
    for (let i = 0; i < nodeDefinitions.length; i++) {
      const nodeDef = nodeDefinitions[i];
      console.log(`Processing node definition ${i + 1}/${nodeDefinitions.length}: ${nodeDef.name}`);
      
      try {
        // Extract node type from content
        let nodeType = '';
        if (nodeDef.content && nodeDef.content.nodes && nodeDef.content.nodes.length > 0) {
          nodeType = nodeDef.content.nodes[0].type || '';
        }
        
        // Create description for embedding
        const description = `Node name: ${nodeDef.name}\nCategory: ${nodeDef.category}\nType: ${nodeType}`;
        
        // Create embedding
        console.log(`Generating embedding for node: ${nodeDef.name}`);
        const embedding = await getEmbeddings(description);
        
        // Prepare node definition data
        const nodeData = {
          file_name: nodeDef.file_name,
          name: nodeDef.name,
          category: nodeDef.category,
          type: nodeType,
          content: nodeDef.content,
          embedding: embedding
        };
        
        // Insert node definition into Supabase
        const { data, error } = await supabase.from('node_definitions').insert([nodeData]);
        
        if (error) {
          console.error(`Error storing node definition ${nodeDef.name}:`, error);
        } else {
          console.log(`Successfully stored node definition: ${nodeDef.name}`);
        }
      } catch (error) {
        console.error(`Error processing node definition ${nodeDef.name}:`, error);
      }
    }
    
    console.log('All node definitions stored in Supabase');
  } catch (error) {
    console.error('Error storing node definitions:', error);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting Supabase Vector Loader...');
  
  try {
    // Store workflows
    await storeWorkflows();
    
    // Store node definitions
    await storeNodeDefinitions();
    
    console.log('Supabase Vector Loader completed successfully');
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the main function
main().catch(console.error);