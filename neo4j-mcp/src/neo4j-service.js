/**
 * Neo4j Service
 * 
 * This service provides functions to interact with the Neo4j graph database.
 * It implements the core functionality for storing and retrieving n8n workflows
 * as a knowledge graph.
 */

/**
 * Store a workflow and its components in Neo4j
 * @param {Object} driver - Neo4j driver instance
 * @param {Object} workflow - The workflow data to store
 * @returns {Object} The result of the operation
 */
async function storeWorkflow(driver, workflow) {
  const session = driver.session();
  
  try {
    // Create a transaction
    const txc = session.beginTransaction();
    
    try {
      // Create workflow node
      const workflowResult = await txc.run(
        `
        MERGE (w:Workflow {id: $id})
        ON CREATE SET 
          w.name = $name,
          w.category = $category,
          w.description = $description,
          w.tags = $tags,
          w.complexity = $complexity,
          w.createdAt = datetime()
        ON MATCH SET 
          w.name = $name,
          w.category = $category,
          w.description = $description,
          w.tags = $tags,
          w.complexity = $complexity,
          w.updatedAt = datetime()
        RETURN w
        `,
        {
          id: workflow.id || generateId(workflow.name),
          name: workflow.name,
          category: workflow.category || 'unknown',
          description: workflow.description || '',
          tags: workflow.tags || [],
          complexity: workflow.complexity || 'moderate'
        }
      );
      
      const workflowNode = workflowResult.records[0].get('w');
      const workflowId = workflowNode.properties.id;
      
      // Store workflow nodes
      if (workflow.nodes && Array.isArray(workflow.nodes)) {
        for (const node of workflow.nodes) {
          await txc.run(
            `
            MERGE (n:Node {id: $nodeId})
            ON CREATE SET 
              n.name = $name,
              n.type = $type,
              n.typeVersion = $typeVersion,
              n.position = $position,
              n.createdAt = datetime()
            ON MATCH SET 
              n.name = $name,
              n.type = $type,
              n.typeVersion = $typeVersion,
              n.position = $position,
              n.updatedAt = datetime()
            
            WITH n
            MATCH (w:Workflow {id: $workflowId})
            MERGE (w)-[r:CONTAINS]->(n)
            
            RETURN n
            `,
            {
              nodeId: node.id,
              name: node.name,
              type: node.type,
              typeVersion: node.typeVersion,
              position: JSON.stringify(node.position),
              parameters: JSON.stringify(node.parameters),
              workflowId
            }
          );
        }
      }
      
      // Store connections
      if (workflow.connections && typeof workflow.connections === 'object') {
        for (const sourceNodeName in workflow.connections) {
          const sourceConnectionData = workflow.connections[sourceNodeName];
          
          if (sourceConnectionData.main && Array.isArray(sourceConnectionData.main)) {
            for (let outputIndex = 0; outputIndex < sourceConnectionData.main.length; outputIndex++) {
              const connections = sourceConnectionData.main[outputIndex];
              
              if (connections && Array.isArray(connections)) {
                for (const connection of connections) {
                  // Find the source node by name
                  const sourceNodeResult = await txc.run(
                    `
                    MATCH (w:Workflow {id: $workflowId})-[:CONTAINS]->(n:Node)
                    WHERE n.name = $nodeName
                    RETURN n
                    `,
                    {
                      workflowId,
                      nodeName: sourceNodeName
                    }
                  );
                  
                  if (sourceNodeResult.records.length === 0) {
                    continue;  // Skip if source node not found
                  }
                  
                  // Find the target node by name
                  const targetNodeResult = await txc.run(
                    `
                    MATCH (w:Workflow {id: $workflowId})-[:CONTAINS]->(n:Node)
                    WHERE n.name = $nodeName
                    RETURN n
                    `,
                    {
                      workflowId,
                      nodeName: connection.node
                    }
                  );
                  
                  if (targetNodeResult.records.length === 0) {
                    continue;  // Skip if target node not found
                  }
                  
                  // Create connection
                  await txc.run(
                    `
                    MATCH (source:Node), (target:Node)
                    WHERE source.name = $sourceName AND target.name = $targetName
                    AND exists(((:Workflow {id: $workflowId})-[:CONTAINS]->(source)))
                    AND exists(((:Workflow {id: $workflowId})-[:CONTAINS]->(target)))
                    MERGE (source)-[c:CONNECTS_TO {
                      workflowId: $workflowId,
                      sourceOutput: $outputIndex,
                      targetInput: $inputIndex
                    }]->(target)
                    RETURN c
                    `,
                    {
                      workflowId,
                      sourceName: sourceNodeName,
                      targetName: connection.node,
                      outputIndex,
                      inputIndex: connection.index || 0
                    }
                  );
                }
              }
            }
          }
        }
      }
      
      // Commit the transaction
      await txc.commit();
      
      return {
        success: true,
        workflowId,
        message: 'Workflow stored successfully'
      };
      
    } catch (error) {
      // Rollback the transaction
      await txc.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error storing workflow:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await session.close();
  }
}

/**
 * Get a workflow by ID or name
 * @param {Object} driver - Neo4j driver instance
 * @param {string} identifier - The workflow ID or name
 * @returns {Object} The workflow data
 */
async function getWorkflow(driver, identifier) {
  const session = driver.session();
  
  try {
    // Try to get by ID first, then by name
    const result = await session.run(
      `
      MATCH (w:Workflow)
      WHERE w.id = $identifier OR w.name = $identifier
      RETURN w {
        .id,
        .name,
        .category,
        .description,
        .tags,
        .complexity,
        .createdAt,
        .updatedAt
      } AS workflow
      `,
      { identifier }
    );
    
    if (result.records.length === 0) {
      return {
        success: false,
        error: `Workflow not found: ${identifier}`
      };
    }
    
    const workflow = result.records[0].get('workflow');
    
    // Get workflow nodes
    const nodesResult = await session.run(
      `
      MATCH (w:Workflow)-[:CONTAINS]->(n:Node)
      WHERE w.id = $workflowId
      RETURN n {
        .id,
        .name,
        .type,
        .typeVersion,
        .position,
        .parameters
      } AS node
      `,
      { workflowId: workflow.id }
    );
    
    const nodes = nodesResult.records.map(record => {
      const node = record.get('node');
      
      // Parse position if stored as string
      if (typeof node.position === 'string') {
        try {
          node.position = JSON.parse(node.position);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      // Parse parameters if stored as string
      if (typeof node.parameters === 'string') {
        try {
          node.parameters = JSON.parse(node.parameters);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      return node;
    });
    
    // Get connections
    const connectionsResult = await session.run(
      `
      MATCH (source:Node)-[c:CONNECTS_TO]->(target:Node)
      WHERE c.workflowId = $workflowId
      RETURN source.name AS sourceName, target.name AS targetName, 
             c.sourceOutput AS outputIndex, c.targetInput AS inputIndex
      `,
      { workflowId: workflow.id }
    );
    
    // Transform to n8n connection format
    const connections = {};
    connectionsResult.records.forEach(record => {
      const sourceName = record.get('sourceName');
      const targetName = record.get('targetName');
      const outputIndex = record.get('outputIndex');
      const inputIndex = record.get('inputIndex');
      
      if (!connections[sourceName]) {
        connections[sourceName] = { main: [] };
      }
      
      if (!connections[sourceName].main[outputIndex]) {
        connections[sourceName].main[outputIndex] = [];
      }
      
      connections[sourceName].main[outputIndex].push({
        node: targetName,
        type: 'main',
        index: inputIndex
      });
    });
    
    return {
      success: true,
      workflow: {
        ...workflow,
        nodes,
        connections
      }
    };
    
  } catch (error) {
    console.error('Error getting workflow:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await session.close();
  }
}

/**
 * Get workflow relationships
 * @param {Object} driver - Neo4j driver instance
 * @param {string} identifier - The workflow ID or name
 * @param {string} relationshipType - Type of relationship to retrieve
 * @returns {Object} The relationship data
 */
async function getWorkflowRelationships(driver, identifier, relationshipType = 'nodes') {
  const session = driver.session();
  
  try {
    // Validate the workflow exists
    const workflowResult = await session.run(
      `
      MATCH (w:Workflow)
      WHERE w.id = $identifier OR w.name = $identifier
      RETURN w.id AS id
      `,
      { identifier }
    );
    
    if (workflowResult.records.length === 0) {
      return {
        success: false,
        error: `Workflow not found: ${identifier}`
      };
    }
    
    const workflowId = workflowResult.records[0].get('id');
    
    if (relationshipType === 'nodes') {
      // Get workflow nodes and their relationships
      const result = await session.run(
        `
        MATCH p=(w:Workflow {id: $workflowId})-[:CONTAINS]->(source:Node)-[c:CONNECTS_TO]->(target:Node)
        RETURN source.name AS sourceName, target.name AS targetName, 
               collect(c {.sourceOutput, .targetInput}) AS connections
        `,
        { workflowId }
      );
      
      return {
        success: true,
        relationships: result.records.map(record => ({
          source: record.get('sourceName'),
          target: record.get('targetName'),
          connections: record.get('connections')
        }))
      };
      
    } else if (relationshipType === 'similar') {
      // Find similar workflows based on tags
      const result = await session.run(
        `
        MATCH (w1:Workflow {id: $workflowId})
        MATCH (w2:Workflow)
        WHERE w1 <> w2 AND ANY(tag IN w1.tags WHERE tag IN w2.tags)
        WITH w2, size([tag IN w1.tags WHERE tag IN w2.tags]) AS commonTags
        ORDER BY commonTags DESC
        LIMIT 10
        RETURN w2 {.id, .name, .category, .tags} AS workflow, commonTags
        `,
        { workflowId }
      );
      
      return {
        success: true,
        similarWorkflows: result.records.map(record => ({
          workflow: record.get('workflow'),
          commonTags: record.get('commonTags')
        }))
      };
      
    } else {
      return {
        success: false,
        error: `Unknown relationship type: ${relationshipType}`
      };
    }
    
  } catch (error) {
    console.error('Error getting workflow relationships:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await session.close();
  }
}

/**
 * Search workflows by criteria
 * @param {Object} driver - Neo4j driver instance
 * @param {Object} criteria - Search criteria
 * @returns {Object} The search results
 */
async function searchWorkflows(driver, criteria = {}) {
  const session = driver.session();
  
  try {
    let query = `
      MATCH (w:Workflow)
      WHERE 1=1
    `;
    
    const params = {};
    
    // Add category filter
    if (criteria.category) {
      query += `
        AND w.category = $category
      `;
      params.category = criteria.category;
    }
    
    // Add tags filter
    if (criteria.tags && Array.isArray(criteria.tags) && criteria.tags.length > 0) {
      query += `
        AND ALL(tag IN $tags WHERE tag IN w.tags)
      `;
      params.tags = criteria.tags;
    }
    
    // Add complexity filter
    if (criteria.complexity) {
      query += `
        AND w.complexity = $complexity
      `;
      params.complexity = criteria.complexity;
    }
    
    // Add name search
    if (criteria.search) {
      query += `
        AND (w.name CONTAINS $search OR w.description CONTAINS $search)
      `;
      params.search = criteria.search;
    }
    
    // Add pagination
    const limit = criteria.limit || 20;
    const skip = criteria.skip || 0;
    
    query += `
      RETURN w {
        .id,
        .name,
        .category,
        .description,
        .tags,
        .complexity,
        .createdAt,
        .updatedAt
      } AS workflow
      ORDER BY w.createdAt DESC
      SKIP $skip
      LIMIT $limit
    `;
    
    params.skip = skip;
    params.limit = limit;
    
    const result = await session.run(query, params);
    
    return {
      success: true,
      workflows: result.records.map(record => record.get('workflow')),
      total: result.records.length,
      limit,
      skip
    };
    
  } catch (error) {
    console.error('Error searching workflows:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await session.close();
  }
}

/**
 * Generate an ID from a name
 * @param {string} name - The name to convert
 * @returns {string} The generated ID
 */
function generateId(name) {
  if (!name) return `workflow_${Date.now()}`;
  
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    + '_' + Date.now().toString(36);
}

module.exports = {
  storeWorkflow,
  getWorkflow,
  getWorkflowRelationships,
  searchWorkflows,
  generateId  // Export generateId for testing
};