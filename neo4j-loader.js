/**
 * Neo4j Loader Script
 * 
 * This script loads n8n nodes and workflows data into Neo4j.
 * It creates a knowledge graph representing the relationships between:
 * - Workflows
 * - Nodes
 * - Node Types
 * - Tags
 */

const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
require('dotenv').config();

// Configuration
const NEO4J_URI = 'bolt://localhost:7687';
const N8N_NODES_DIR = path.join(__dirname, 'n8n-nodes');
const PROCESSED_WORKFLOWS_DIR = path.join(__dirname, 'processed-workflows');

// Initialize Neo4j driver
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.none()
);

/**
 * Main function to load all data
 */
async function loadAllData() {
  console.log('Starting data load to Neo4j...');
  
  try {
    // Create constraints and indexes for better performance
    await createConstraintsAndIndexes();
    
    // Load node definitions
    await loadNodeDefinitions();
    
    // Load workflows
    await loadWorkflows();
    
    // Create relationships between node types and workflows
    await createNodeTypeToWorkflowRelationships();
    
    // Create relationships between tags and workflows
    await createTagToWorkflowRelationships();
    
    console.log('Data load completed successfully!');
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    await driver.close();
  }
}

/**
 * Create constraints and indexes for better performance
 */
async function createConstraintsAndIndexes() {
  const session = driver.session();
  
  try {
    console.log('Creating constraints and indexes...');
    
    // Create constraints
    await session.run('CREATE CONSTRAINT workflow_id IF NOT EXISTS FOR (w:Workflow) REQUIRE w.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT node_id IF NOT EXISTS FOR (n:Node) REQUIRE n.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT node_type_name IF NOT EXISTS FOR (nt:NodeType) REQUIRE nt.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT tag_name IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE');
    
    // Create indexes
    await session.run('CREATE INDEX workflow_name IF NOT EXISTS FOR (w:Workflow) ON (w.name)');
    await session.run('CREATE INDEX workflow_category IF NOT EXISTS FOR (w:Workflow) ON (w.category)');
    
    console.log('Constraints and indexes created.');
  } finally {
    await session.close();
  }
}

/**
 * Load node definitions from n8n-nodes directory
 */
async function loadNodeDefinitions() {
  const session = driver.session();
  
  try {
    console.log('Loading node definitions...');
    
    // Get all files in the n8n-nodes directory
    const files = fs.readdirSync(N8N_NODES_DIR);
    
    // Process each file
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(N8N_NODES_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Skip empty files
      if (!content.trim()) continue;
      
      try {
        const nodeData = JSON.parse(content);
        
        // Skip if there are no nodes
        if (!nodeData.nodes || !Array.isArray(nodeData.nodes) || nodeData.nodes.length === 0) continue;
        
        // Parse node name and category from filename
        // Format: node:category:name.json
        const parts = file.split(':');
        const category = parts.length > 1 ? parts[1] : 'unknown';
        const nameWithExt = parts.length > 2 ? parts[2] : parts[0];
        const name = nameWithExt.replace('.json', '');
        
        // Process each node in the file
        for (const node of nodeData.nodes) {
          // Store the node type
          await session.run(
            `
            MERGE (nt:NodeType {name: $typeName})
            ON CREATE SET 
              nt.displayName = $displayName,
              nt.category = $category,
              nt.createdAt = datetime()
            RETURN nt
            `,
            {
              typeName: node.type,
              displayName: node.name,
              category: category
            }
          );
          
          // Store the node definition
          await session.run(
            `
            MERGE (n:NodeDefinition {id: $id})
            ON CREATE SET 
              n.name = $name,
              n.type = $type,
              n.typeVersion = $typeVersion,
              n.category = $category,
              n.parameters = $parameters,
              n.createdAt = datetime()
            ON MATCH SET
              n.name = $name,
              n.type = $type,
              n.typeVersion = $typeVersion,
              n.category = $category,
              n.parameters = $parameters,
              n.updatedAt = datetime()
            
            WITH n
            MATCH (nt:NodeType {name: $type})
            MERGE (n)-[:IS_TYPE]->(nt)
            
            RETURN n
            `,
            {
              id: node.id || `${node.type}_${node.name}_${Date.now()}`.toLowerCase(),
              name: node.name,
              type: node.type,
              typeVersion: node.typeVersion || 1,
              category: category,
              parameters: JSON.stringify(node.parameters || {})
            }
          );
        }
      } catch (error) {
        console.error(`Error processing node file ${file}:`, error.message);
      }
    }
    
    console.log('Node definitions loaded.');
  } finally {
    await session.close();
  }
}

/**
 * Load workflows from processed-workflows directory
 */
async function loadWorkflows() {
  const session = driver.session();
  
  try {
    console.log('Loading workflows...');
    
    // Get all files in the processed-workflows directory
    const files = fs.readdirSync(PROCESSED_WORKFLOWS_DIR);
    
    // Process each file
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'workflows-summary.json') continue;
      
      const filePath = path.join(PROCESSED_WORKFLOWS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      try {
        const workflowData = JSON.parse(content);
        
        // Skip if this is not a valid workflow
        if (!workflowData.id || !workflowData.name) continue;
        
        // Create workflow node
        await session.run(
          `
          MERGE (w:Workflow {id: $id})
          ON CREATE SET 
            w.name = $name,
            w.category = $category,
            w.description = $description,
            w.complexity = $complexity,
            w.nodeCount = $nodeCount,
            w.connectionCount = $connectionCount,
            w.uniqueNodeTypes = $uniqueNodeTypes,
            w.createdAt = datetime()
          ON MATCH SET
            w.name = $name,
            w.category = $category,
            w.description = $description,
            w.complexity = $complexity,
            w.nodeCount = $nodeCount,
            w.connectionCount = $connectionCount,
            w.uniqueNodeTypes = $uniqueNodeTypes,
            w.updatedAt = datetime()
          RETURN w
          `,
          {
            id: workflowData.id,
            name: workflowData.name,
            category: workflowData.category || 'unknown',
            description: workflowData.description || '',
            complexity: workflowData.complexity ? workflowData.complexity.complexity : 'unknown',
            nodeCount: workflowData.complexity ? workflowData.complexity.nodeCount : 0,
            connectionCount: workflowData.complexity ? workflowData.complexity.connectionCount : 0,
            uniqueNodeTypes: workflowData.complexity ? workflowData.complexity.uniqueNodeTypes : 0
          }
        );
        
        // Create tags
        if (workflowData.tags && Array.isArray(workflowData.tags)) {
          for (const tagName of workflowData.tags) {
            await session.run(
              `
              MERGE (t:Tag {name: $tagName})
              ON CREATE SET t.createdAt = datetime()
              
              WITH t
              MATCH (w:Workflow {id: $workflowId})
              MERGE (w)-[r:HAS_TAG]->(t)
              
              RETURN t
              `,
              {
                tagName,
                workflowId: workflowData.id
              }
            );
          }
        }
        
        // Process original workflow nodes and connections
        if (workflowData.originalWorkflow && workflowData.originalWorkflow.nodes) {
          for (const node of workflowData.originalWorkflow.nodes) {
            // Create node
            await session.run(
              `
              MERGE (n:Node {id: $id})
              ON CREATE SET 
                n.name = $name,
                n.type = $type,
                n.typeVersion = $typeVersion,
                n.parameters = $parameters,
                n.position = $position,
                n.createdAt = datetime()
              ON MATCH SET
                n.name = $name,
                n.type = $type,
                n.typeVersion = $typeVersion,
                n.parameters = $parameters,
                n.position = $position,
                n.updatedAt = datetime()
              
              WITH n
              MATCH (w:Workflow {id: $workflowId})
              MERGE (w)-[r:CONTAINS]->(n)
              
              WITH n
              MATCH (nt:NodeType {name: $type})
              MERGE (n)-[r2:IS_TYPE]->(nt)
              
              RETURN n
              `,
              {
                id: node.id,
                name: node.name,
                type: node.type,
                typeVersion: node.typeVersion || 1,
                parameters: JSON.stringify(node.parameters || {}),
                position: JSON.stringify(node.position || {}),
                workflowId: workflowData.id
              }
            );
          }
          
          // Create connections
          if (workflowData.originalWorkflow.connections) {
            for (const [sourceName, sourceConnections] of Object.entries(workflowData.originalWorkflow.connections)) {
              // Find the source node
              const sourceNodeResult = await session.run(
                `
                MATCH (w:Workflow {id: $workflowId})-[:CONTAINS]->(n:Node)
                WHERE n.name = $nodeName
                RETURN n.id AS id
                `,
                {
                  workflowId: workflowData.id,
                  nodeName: sourceName
                }
              );
              
              if (sourceNodeResult.records.length === 0) continue;
              
              const sourceNodeId = sourceNodeResult.records[0].get('id');
              
              // Process connections
              if (sourceConnections.main && Array.isArray(sourceConnections.main)) {
                for (let outputIndex = 0; outputIndex < sourceConnections.main.length; outputIndex++) {
                  const connections = sourceConnections.main[outputIndex];
                  
                  if (connections && Array.isArray(connections)) {
                    for (const connection of connections) {
                      // Find the target node
                      const targetNodeResult = await session.run(
                        `
                        MATCH (w:Workflow {id: $workflowId})-[:CONTAINS]->(n:Node)
                        WHERE n.name = $nodeName
                        RETURN n.id AS id
                        `,
                        {
                          workflowId: workflowData.id,
                          nodeName: connection.node
                        }
                      );
                      
                      if (targetNodeResult.records.length === 0) continue;
                      
                      const targetNodeId = targetNodeResult.records[0].get('id');
                      
                      // Create connection
                      await session.run(
                        `
                        MATCH (source:Node {id: $sourceId}), (target:Node {id: $targetId})
                        MERGE (source)-[c:CONNECTS_TO {
                          workflowId: $workflowId,
                          sourceOutput: $outputIndex,
                          targetInput: $inputIndex,
                          type: $connectionType
                        }]->(target)
                        RETURN c
                        `,
                        {
                          sourceId: sourceNodeId,
                          targetId: targetNodeId,
                          workflowId: workflowData.id,
                          outputIndex,
                          inputIndex: connection.index || 0,
                          connectionType: connection.type || 'main'
                        }
                      );
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing workflow file ${file}:`, error.message);
      }
    }
    
    console.log('Workflows loaded.');
  } finally {
    await session.close();
  }
}

/**
 * Create relationships between node types and workflows that use them
 */
async function createNodeTypeToWorkflowRelationships() {
  const session = driver.session();
  
  try {
    console.log('Creating node type to workflow relationships...');
    
    await session.run(
      `
      MATCH (w:Workflow)-[:CONTAINS]->(n:Node)-[:IS_TYPE]->(nt:NodeType)
      MERGE (w)-[r:USES_NODE_TYPE]->(nt)
      ON CREATE SET 
        r.count = 1,
        r.createdAt = datetime()
      ON MATCH SET 
        r.count = r.count + 1,
        r.updatedAt = datetime()
      RETURN count(r) as relationships
      `
    );
    
    console.log('Node type to workflow relationships created.');
  } finally {
    await session.close();
  }
}

/**
 * Create relationships between tags and workflows
 */
async function createTagToWorkflowRelationships() {
  const session = driver.session();
  
  try {
    console.log('Creating tag to workflow relationships...');
    
    // Create relationships between tags and node types
    await session.run(
      `
      MATCH (w:Workflow)-[:CONTAINS]->(n:Node)-[:IS_TYPE]->(nt:NodeType)
      MATCH (w)-[:HAS_TAG]->(t:Tag)
      MERGE (nt)-[r:ASSOCIATED_WITH]->(t)
      ON CREATE SET 
        r.count = 1,
        r.createdAt = datetime()
      ON MATCH SET 
        r.count = r.count + 1,
        r.updatedAt = datetime()
      RETURN count(r) as relationships
      `
    );
    
    // Create relationships between similar workflows (shared tags)
    await session.run(
      `
      MATCH (w1:Workflow)-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(w2:Workflow)
      WHERE id(w1) < id(w2)
      WITH w1, w2, count(t) AS tagOverlap
      WHERE tagOverlap > 2
      MERGE (w1)-[r:SIMILAR_TO {tagOverlap: tagOverlap}]->(w2)
      RETURN count(r) as relationships
      `
    );
    
    console.log('Tag relationships created.');
  } finally {
    await session.close();
  }
}

// Run if called directly
if (require.main === module) {
  loadAllData()
    .catch(err => {
      console.error('Error in main process:', err);
      process.exit(1);
    });
}

module.exports = {
  loadAllData,
  driver
};