/**
 * Database Dump Script
 * 
 * This script exports data from all databases used in the project:
 * 1. Neo4j - Knowledge graph data
 * 2. Supabase - Structured metadata
 * 3. QDRANT - Vector database
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { createClient } = require('@supabase/supabase-js');
const { connectToSupabaseServer } = require('./mcp-client-config');

// Create dumps directory if it doesn't exist
const DUMPS_DIR = path.join(__dirname, 'database-dumps');
if (!fs.existsSync(DUMPS_DIR)) {
  fs.mkdirSync(DUMPS_DIR, { recursive: true });
}

// Neo4j dump function
async function dumpNeo4j() {
  console.log('Starting Neo4j database dump...');
  
  const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );
  
  try {
    const session = driver.session();
    
    // Dump Workflows
    console.log('Dumping Neo4j Workflows...');
    const workflowsResult = await session.run('MATCH (w:Workflow) RETURN w');
    const workflows = workflowsResult.records.map(record => record.get('w').properties);
    fs.writeFileSync(
      path.join(DUMPS_DIR, 'neo4j-workflows.json'), 
      JSON.stringify(workflows, null, 2)
    );
    
    // Dump NodeTypes
    console.log('Dumping Neo4j NodeTypes...');
    const nodeTypesResult = await session.run('MATCH (nt:NodeType) RETURN nt');
    const nodeTypes = nodeTypesResult.records.map(record => record.get('nt').properties);
    fs.writeFileSync(
      path.join(DUMPS_DIR, 'neo4j-node-types.json'), 
      JSON.stringify(nodeTypes, null, 2)
    );
    
    // Dump Tags
    console.log('Dumping Neo4j Tags...');
    const tagsResult = await session.run('MATCH (t:Tag) RETURN t');
    const tags = tagsResult.records.map(record => record.get('t').properties);
    fs.writeFileSync(
      path.join(DUMPS_DIR, 'neo4j-tags.json'), 
      JSON.stringify(tags, null, 2)
    );
    
    // Dump NodeType to Workflow relationships
    console.log('Dumping Neo4j NodeType-Workflow relationships...');
    const ntToWorkflowResult = await session.run(`
      MATCH (nt:NodeType)-[r:USED_IN]->(w:Workflow)
      RETURN nt.name AS nodeType, w.id AS workflowId, r.count AS count
    `);
    const ntToWorkflow = ntToWorkflowResult.records.map(record => ({
      nodeType: record.get('nodeType'),
      workflowId: record.get('workflowId'),
      count: record.get('count')
    }));
    fs.writeFileSync(
      path.join(DUMPS_DIR, 'neo4j-nodetype-workflow-rels.json'), 
      JSON.stringify(ntToWorkflow, null, 2)
    );
    
    // Dump Tag to Workflow relationships
    console.log('Dumping Neo4j Tag-Workflow relationships...');
    const tagToWorkflowResult = await session.run(`
      MATCH (t:Tag)-[r:TAGGED]->(w:Workflow)
      RETURN t.name AS tag, w.id AS workflowId
    `);
    const tagToWorkflow = tagToWorkflowResult.records.map(record => ({
      tag: record.get('tag'),
      workflowId: record.get('workflowId')
    }));
    fs.writeFileSync(
      path.join(DUMPS_DIR, 'neo4j-tag-workflow-rels.json'), 
      JSON.stringify(tagToWorkflow, null, 2)
    );
    
    await session.close();
    console.log('Neo4j dump completed successfully!');
    
  } catch (error) {
    console.error('Error dumping Neo4j data:', error);
  } finally {
    await driver.close();
  }
}

// QDRANT dump function
async function dumpQdrant() {
  console.log('Starting QDRANT database dump...');
  
  const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
  
  const qdrantClient = new QdrantClient({ 
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY
  });
  
  try {
    // Get collections
    console.log('Getting QDRANT collections...');
    const collections = await qdrantClient.getCollections();
    fs.writeFileSync(
      path.join(DUMPS_DIR, 'qdrant-collections.json'), 
      JSON.stringify(collections, null, 2)
    );
    
    // For each collection, get points
    if (collections && collections.collections) {
      for (const collection of collections.collections) {
        console.log(`Dumping points from collection: ${collection.name}`);
        
        try {
          // Get collection info
          const collectionInfo = await qdrantClient.getCollection(collection.name);
          fs.writeFileSync(
            path.join(DUMPS_DIR, `qdrant-collection-${collection.name}-info.json`), 
            JSON.stringify(collectionInfo, null, 2)
          );
          
          // Get points with pagination
          let offset = 0;
          const limit = 100;
          let hasMore = true;
          let allPoints = [];
          
          while (hasMore) {
            const points = await qdrantClient.scroll(collection.name, {
              limit,
              offset: { point_id: offset > 0 ? offset.toString() : null },
              with_payload: true,
              with_vector: false  // Skip vectors to save space
            });
            
            if (points && points.points && points.points.length > 0) {
              allPoints = allPoints.concat(points.points);
              offset += points.points.length;
              
              // Set the next offset to the last point ID
              if (points.points.length < limit) {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
          }
          
          fs.writeFileSync(
            path.join(DUMPS_DIR, `qdrant-collection-${collection.name}-points.json`), 
            JSON.stringify(allPoints, null, 2)
          );
          
        } catch (collectionError) {
          console.error(`Error dumping collection ${collection.name}:`, collectionError);
        }
      }
    }
    
    console.log('QDRANT dump completed successfully!');
    
  } catch (error) {
    console.error('Error dumping QDRANT data:', error);
  }
}

// Supabase dump function using direct connection
async function dumpSupabaseDirect() {
  console.log('Starting Supabase direct database dump...');
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase URL or Key not found in environment variables');
    return;
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  try {
    // Get workflows
    console.log('Dumping Supabase workflows...');
    const { data: workflows, error: workflowsError } = await supabase
      .from('workflows')
      .select('*');
    
    if (workflowsError) {
      console.error('Error fetching workflows:', workflowsError);
    } else {
      fs.writeFileSync(
        path.join(DUMPS_DIR, 'supabase-workflows.json'), 
        JSON.stringify(workflows, null, 2)
      );
    }
    
    // Get tags
    console.log('Dumping Supabase tags...');
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('*');
    
    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
    } else {
      fs.writeFileSync(
        path.join(DUMPS_DIR, 'supabase-tags.json'), 
        JSON.stringify(tags, null, 2)
      );
    }
    
    // Get workflow_tags
    console.log('Dumping Supabase workflow_tags...');
    const { data: workflowTags, error: workflowTagsError } = await supabase
      .from('workflow_tags')
      .select('*');
    
    if (workflowTagsError) {
      console.error('Error fetching workflow_tags:', workflowTagsError);
    } else {
      fs.writeFileSync(
        path.join(DUMPS_DIR, 'supabase-workflow-tags.json'), 
        JSON.stringify(workflowTags, null, 2)
      );
    }
    
    console.log('Supabase direct dump completed successfully!');
    
  } catch (error) {
    console.error('Error dumping Supabase data:', error);
  }
}

// Supabase dump function using MCP
async function dumpSupabaseMCP() {
  console.log('Starting Supabase MCP database dump...');
  
  console.log('Connecting to Supabase MCP server...');
  const supabaseServer = connectToSupabaseServer();
  
  // Initialize connection
  supabaseServer.send({
    type: 'initialize',
    client: { name: 'n8n-templates-supabase-dump', version: '1.0.0' }
  });
  
  let initialized = false;
  const responses = {};
  
  // Set up message handler
  supabaseServer.onMessage((message) => {
    console.log('Received message type:', message.type);
    
    if (message.type === 'initialize_response') {
      console.log('Supabase server connected successfully!');
      initialized = true;
      
      // Get the tools available in the Supabase MCP server
      supabaseServer.send({
        type: 'list_tools',
        id: 'list_tools'
      });
    }
    
    // Handle the list_tools response
    if (message.type === 'response' && message.id === 'list_tools') {
      console.log('Available tools in Supabase MCP server:');
      console.log(message.result);
      
      // Get all workflows
      supabaseServer.send({
        type: 'invoke',
        id: 'get_all_workflows',
        tool: 'get_all_workflows',
        args: {}
      });
    }
    
    // Handle get_all_workflows response
    if (message.type === 'response' && message.id === 'get_all_workflows') {
      responses.workflows = message.result;
      fs.writeFileSync(
        path.join(DUMPS_DIR, 'supabase-mcp-workflows.json'), 
        JSON.stringify(message.result, null, 2)
      );
      
      // Get categories
      supabaseServer.send({
        type: 'invoke',
        id: 'get_categories',
        tool: 'get_categories',
        args: {}
      });
    }
    
    // Handle get_categories response
    if (message.type === 'response' && message.id === 'get_categories') {
      responses.categories = message.result;
      fs.writeFileSync(
        path.join(DUMPS_DIR, 'supabase-mcp-categories.json'), 
        JSON.stringify(message.result, null, 2)
      );
      
      // Get tags
      supabaseServer.send({
        type: 'invoke',
        id: 'get_tags',
        tool: 'get_tags',
        args: {}
      });
    }
    
    // Handle get_tags response
    if (message.type === 'response' && message.id === 'get_tags') {
      responses.tags = message.result;
      fs.writeFileSync(
        path.join(DUMPS_DIR, 'supabase-mcp-tags.json'), 
        JSON.stringify(message.result, null, 2)
      );
      
      // Export all data as a single file
      fs.writeFileSync(
        path.join(DUMPS_DIR, 'supabase-mcp-all-data.json'), 
        JSON.stringify(responses, null, 2)
      );
      
      // Close the connection
      console.log('\nSupabase MCP dump completed successfully!');
      setTimeout(() => {
        supabaseServer.close();
      }, 1000);
    }
    
    // Handle errors
    if (message.type === 'error') {
      console.error('Error from Supabase server:', message.error);
      setTimeout(() => {
        supabaseServer.close();
      }, 1000);
    }
  });
  
  // Handle any connection issues
  setTimeout(() => {
    if (!initialized) {
      console.log('Failed to initialize connection to Supabase MCP server. Please check your configuration.');
      supabaseServer.close();
    }
  }, 10000);
}

// LevelGraph DB Dump
function dumpLevelGraphDB() {
  console.log('Starting LevelGraph database dump...');
  
  const LEVELGRAPH_DIR = path.join(__dirname, 'default_levelgraph_db');
  
  if (!fs.existsSync(LEVELGRAPH_DIR)) {
    console.error('LevelGraph DB directory not found');
    return;
  }
  
  try {
    // Simply copy all files from the LevelGraph directory
    const levelFiles = fs.readdirSync(LEVELGRAPH_DIR);
    
    if (!fs.existsSync(path.join(DUMPS_DIR, 'levelgraph'))) {
      fs.mkdirSync(path.join(DUMPS_DIR, 'levelgraph'), { recursive: true });
    }
    
    levelFiles.forEach(file => {
      fs.copyFileSync(
        path.join(LEVELGRAPH_DIR, file),
        path.join(DUMPS_DIR, 'levelgraph', file)
      );
    });
    
    console.log('LevelGraph DB dump completed successfully!');
    
  } catch (error) {
    console.error('Error dumping LevelGraph data:', error);
  }
}

// Main function
async function dumpAllDatabases() {
  console.log('Starting dump of all databases...');
  
  // Neo4j dump
  await dumpNeo4j().catch(console.error);
  
  // QDRANT dump
  await dumpQdrant().catch(console.error);
  
  // Supabase dumps
  await dumpSupabaseDirect().catch(console.error);
  await dumpSupabaseMCP().catch(console.error);
  
  // LevelGraph dump
  dumpLevelGraphDB();
  
  console.log(`All database dumps completed! Results saved in: ${DUMPS_DIR}`);
}

// Run the main function
dumpAllDatabases().catch(console.error); 