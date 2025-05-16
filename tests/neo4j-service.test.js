/**
 * Tests for Neo4j Service
 * 
 * This file contains tests for the Neo4j service functions
 * following TDD methodology.
 */

const path = require('path');
const neo4j = require('neo4j-driver');

// Module to test
const neo4jServicePath = path.join(__dirname, '../neo4j-mcp/src/neo4j-service');
const neo4jService = require(neo4jServicePath);

// Mock Neo4j driver
jest.mock('neo4j-driver', () => {
  const mockSession = {
    run: jest.fn().mockResolvedValue({
      records: [{ get: jest.fn().mockReturnValue({ properties: { id: 'test-id' } }) }]
    }),
    close: jest.fn().mockResolvedValue(undefined),
    beginTransaction: jest.fn().mockReturnValue({
      run: jest.fn().mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue({ properties: { id: 'test-id' } }) }]
      }),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    })
  };
  
  const mockDriver = {
    session: jest.fn().mockReturnValue(mockSession),
    close: jest.fn().mockResolvedValue(undefined)
  };
  
  return {
    driver: jest.fn().mockReturnValue(mockDriver),
    auth: {
      basic: jest.fn(),
      none: jest.fn()
    }
  };
});

// Sample test data
const mockWorkflow = {
  id: 'test-workflow',
  name: 'Test Workflow',
  category: 'test',
  description: 'A test workflow',
  tags: ['test', 'workflow'],
  complexity: 'simple',
  nodes: [
    {
      id: 'node1',
      name: 'Node 1',
      type: 'test-node-type',
      typeVersion: 1,
      position: [100, 200]
    }
  ],
  connections: {
    'Node 1': {
      main: [[{ node: 'Node 2', type: 'main', index: 0 }]]
    }
  }
};

describe('Neo4j Service', () => {
  let driver;
  let mockSession;
  let mockTransaction;
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock driver and session
    driver = neo4j.driver();
    mockSession = driver.session();
    mockTransaction = mockSession.beginTransaction();
  });
  
  describe('storeWorkflow', () => {
    test('should store a workflow successfully', async () => {
      // Arrange
      const expectedResult = {
        success: true,
        workflowId: 'test-id',
        message: 'Workflow stored successfully'
      };
      
      // Act
      const result = await neo4jService.storeWorkflow(driver, mockWorkflow);
      
      // Assert
      expect(result).toEqual(expectedResult);
      expect(driver.session).toHaveBeenCalled();
      expect(mockSession.beginTransaction).toHaveBeenCalled();
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (w:Workflow {id: $id})'),
        expect.objectContaining({
          id: mockWorkflow.id,
          name: mockWorkflow.name,
          category: mockWorkflow.category
        })
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle workflow with missing fields and use defaults', async () => {
      // Arrange
      const simpleWorkflow = {
        name: 'Simple Workflow'
      };
      
      // Act
      const result = await neo4jService.storeWorkflow(driver, simpleWorkflow);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (w:Workflow {id: $id})'),
        expect.objectContaining({
          // Should use a generated ID since none was provided
          name: simpleWorkflow.name,
          category: 'unknown',  // Default category
          description: '',  // Default description
          tags: [],  // Default tags
          complexity: 'moderate'  // Default complexity
        })
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
    
    test('should store workflow with nodes', async () => {
      // Arrange
      const workflow = {
        id: 'workflow-with-nodes',
        name: 'Workflow With Nodes',
        nodes: [
          {
            id: 'node1',
            name: 'Node 1',
            type: 'test-node',
            typeVersion: 1,
            position: [100, 200]
          },
          {
            id: 'node2',
            name: 'Node 2',
            type: 'test-node-2',
            typeVersion: 1,
            position: [300, 400]
          }
        ]
      };
      
      // Act
      const result = await neo4jService.storeWorkflow(driver, workflow);
      
      // Assert
      expect(result.success).toBe(true);
      // Check that node creation was called for each node
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (n:Node {id: $nodeId})'),
        expect.objectContaining({
          nodeId: 'node1',
          name: 'Node 1',
          type: 'test-node'
        })
      );
      expect(mockTransaction.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (n:Node {id: $nodeId})'),
        expect.objectContaining({
          nodeId: 'node2',
          name: 'Node 2',
          type: 'test-node-2'
        })
      );
    });
    
    test('should store workflow with connections', async () => {
      // Arrange
      const workflow = {
        id: 'workflow-with-connections',
        name: 'Workflow With Connections',
        nodes: [
          { id: 'node1', name: 'Node 1' },
          { id: 'node2', name: 'Node 2' }
        ],
        connections: {
          'Node 1': {
            main: [
              [{ node: 'Node 2', type: 'main', index: 0 }]
            ]
          }
        }
      };
      
      // This is a complex test that requires specific implementation of run
      // We'll need to check that workflow storage completed successfully
      const originalRun = mockTransaction.run;
      mockTransaction.run = jest.fn().mockImplementation((query, params) => {
        // For workflow queries
        if (query.includes('MERGE (w:Workflow {id: $id})')) {
          return { records: [{ get: () => ({ properties: { id: 'workflow-with-connections' } }) }] };
        }
        
        // For node queries - returning empty to avoid creating nodes that we'll then try to connect
        if (query.includes('MERGE (n:Node {id: $nodeId})')) {
          return { records: [] };
        }
        
        // For finding nodes by name
        if (query.includes('n.name = $nodeName')) {
          if (params.nodeName === 'Node 1') {
            return { records: [{ get: () => ({ id: 'node1' }) }] };
          }
          if (params.nodeName === 'Node 2') {
            return { records: [{ get: () => ({ id: 'node2' }) }] };
          }
          return { records: [] };
        }
        
        // For connection creation
        if (query.includes('MERGE (source)-[c:CONNECTS_TO')) {
          return { records: [] };
        }
        
        return { records: [{ get: () => ({ properties: { id: 'test-id' } }) }] };
      });
      
      // Act
      const result = await neo4jService.storeWorkflow(driver, workflow);
      
      // Assert
      expect(result.success).toBe(true);
      // Restore the original mock for other tests
      mockTransaction.run = originalRun;
    });
    
    test('should skip connection creation if source node not found', async () => {
      // Arrange
      const workflow = {
        id: 'workflow-missing-node',
        name: 'Workflow With Missing Node',
        connections: {
          'Missing Node': {
            main: [
              [{ node: 'Target Node', type: 'main', index: 0 }]
            ]
          }
        }
      };
      
      // For source node lookup - return empty to simulate node not found
      mockTransaction.run.mockImplementation((query, params) => {
        if (query.includes('n.name = $nodeName') && params.nodeName === 'Missing Node') {
          return { records: [] };
        }
        return { records: [{ get: jest.fn().mockReturnValue({ properties: { id: 'test-id' } }) }] };
      });
      
      // Act
      const result = await neo4jService.storeWorkflow(driver, workflow);
      
      // Assert
      expect(result.success).toBe(true);
      // Should still complete despite missing node
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
    
    test('should skip connection creation if target node not found', async () => {
      // Arrange
      const workflow = {
        id: 'workflow-missing-target',
        name: 'Workflow With Missing Target',
        connections: {
          'Source Node': {
            main: [
              [{ node: 'Missing Target', type: 'main', index: 0 }]
            ]
          }
        }
      };
      
      // For node lookups
      mockTransaction.run.mockImplementation((query, params) => {
        if (query.includes('n.name = $nodeName') && params.nodeName === 'Source Node') {
          return { records: [{ get: jest.fn().mockReturnValue({ id: 'node1' }) }] };
        }
        if (query.includes('n.name = $nodeName') && params.nodeName === 'Missing Target') {
          return { records: [] };  // Target node not found
        }
        return { records: [{ get: jest.fn().mockReturnValue({ properties: { id: 'test-id' } }) }] };
      });
      
      // Act
      const result = await neo4jService.storeWorkflow(driver, workflow);
      
      // Assert
      expect(result.success).toBe(true);
      // Should still complete despite missing target node
      expect(mockTransaction.commit).toHaveBeenCalled();
    });
    
    test('should handle errors and rollback transaction', async () => {
      // Arrange
      const expectedError = new Error('Database error');
      mockTransaction.run.mockRejectedValueOnce(expectedError);
      
      // Act
      const result = await neo4jService.storeWorkflow(driver, mockWorkflow);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(expectedError.message);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockSession.close).toHaveBeenCalled();
    });
  });
  
  describe('getWorkflow', () => {
    test('should retrieve a workflow by ID', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn().mockReturnValue({
            id: workflowId,
            name: 'Test Workflow',
            category: 'test'
          })
        }]
      });
      
      // Mock second call for nodes
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn().mockReturnValue({
            id: 'node1',
            name: 'Node 1',
            type: 'test-node-type'
          })
        }]
      });
      
      // Mock third call for connections
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn().mockReturnValue('Node 1'),
          get: jest.fn().mockReturnValue('Node 2'),
          get: jest.fn().mockReturnValue(0),
          get: jest.fn().mockReturnValue(0)
        }]
      });
      
      // Act
      const result = await neo4jService.getWorkflow(driver, workflowId);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow.id).toBe(workflowId);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:Workflow)'),
        expect.objectContaining({ identifier: workflowId })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle nodes with string position and parameters', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn().mockReturnValue({
            id: workflowId,
            name: 'Test Workflow',
            category: 'test'
          })
        }]
      });
      
      // Mock second call for nodes with string position/parameters
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn().mockReturnValue({
            id: 'node1',
            name: 'Node 1',
            type: 'test-node-type',
            position: '[100, 200]',  // String position
            parameters: '{"param1":"value1"}'  // String parameters
          })
        }]
      });
      
      // Mock third call for connections
      mockSession.run.mockResolvedValueOnce({
        records: []
      });
      
      // Act
      const result = await neo4jService.getWorkflow(driver, workflowId);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow.nodes[0].position).toEqual([100, 200]);
      expect(result.workflow.nodes[0].parameters).toEqual({param1: 'value1'});
    });
    
    test('should handle malformed JSON in position and parameters', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn().mockReturnValue({
            id: workflowId,
            name: 'Test Workflow'
          })
        }]
      });
      
      // Mock second call for nodes with invalid JSON
      mockSession.run.mockResolvedValueOnce({
        records: [{
          get: jest.fn().mockReturnValue({
            id: 'node1',
            name: 'Node 1',
            position: '{invalid-json}',  // Invalid JSON
            parameters: '{also-invalid}'  // Invalid JSON
          })
        }]
      });
      
      // Mock third call for connections
      mockSession.run.mockResolvedValueOnce({
        records: []
      });
      
      // Act
      const result = await neo4jService.getWorkflow(driver, workflowId);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      // The invalid JSON should remain as strings
      expect(result.workflow.nodes[0].position).toBe('{invalid-json}');
      expect(result.workflow.nodes[0].parameters).toBe('{also-invalid}');
    });
    
    test('should handle database error', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      mockSession.run.mockRejectedValueOnce(new Error('Database workflow fetch error'));
      
      // Act
      const result = await neo4jService.getWorkflow(driver, workflowId);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database workflow fetch error');
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle workflow not found', async () => {
      // Arrange
      const workflowId = 'non-existent';
      mockSession.run.mockResolvedValueOnce({ records: [] });
      
      // Act
      const result = await neo4jService.getWorkflow(driver, workflowId);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow not found');
      expect(mockSession.close).toHaveBeenCalled();
    });
  });
  
  describe('searchWorkflows', () => {
    test('should search workflows by criteria', async () => {
      // Arrange
      const criteria = {
        category: 'test',
        tags: ['workflow'],
        complexity: 'simple'
      };
      
      mockSession.run.mockResolvedValueOnce({
        records: [
          { get: jest.fn().mockReturnValue({ id: 'workflow1', name: 'Workflow 1' }) },
          { get: jest.fn().mockReturnValue({ id: 'workflow2', name: 'Workflow 2' }) }
        ]
      });
      
      // Act
      const result = await neo4jService.searchWorkflows(driver, criteria);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.workflows).toBeDefined();
      expect(result.workflows.length).toBe(2);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:Workflow)'),
        expect.objectContaining({
          category: criteria.category,
          complexity: criteria.complexity
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle search with text search criteria', async () => {
      // Arrange
      const criteria = {
        search: 'test query',
        limit: 10,
        skip: 5
      };
      
      mockSession.run.mockResolvedValueOnce({
        records: [
          { get: jest.fn().mockReturnValue({ id: 'workflow3', name: 'Workflow 3' }) }
        ]
      });
      
      // Act
      const result = await neo4jService.searchWorkflows(driver, criteria);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.workflows).toBeDefined();
      expect(result.workflows.length).toBe(1);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:Workflow)'),
        expect.objectContaining({
          search: criteria.search,
          limit: criteria.limit,
          skip: criteria.skip
        })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle database error', async () => {
      // Arrange
      mockSession.run.mockRejectedValueOnce(new Error('Database search error'));
      
      // Act
      const result = await neo4jService.searchWorkflows(driver);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database search error');
      expect(mockSession.close).toHaveBeenCalled();
    });
  });
  
  describe('getWorkflowRelationships', () => {
    test('should get workflow node relationships', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      // First call for validating the workflow exists
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('test-workflow') }]
      });
      
      // Second call for getting relationships
      mockSession.run.mockResolvedValueOnce({
        records: [
          { 
            get: function(key) {
              if (key === 'sourceName') return 'Node 1';
              if (key === 'targetName') return 'Node 2';
              if (key === 'connections') return [{ sourceOutput: 0, targetInput: 0 }];
              return null;
            }
          }
        ]
      });
      
      // Act
      const result = await neo4jService.getWorkflowRelationships(driver, workflowId, 'nodes');
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.relationships).toBeDefined();
      expect(result.relationships.length).toBe(1);
      expect(result.relationships[0]).toEqual({
        source: 'Node 1',
        target: 'Node 2',
        connections: [{ sourceOutput: 0, targetInput: 0 }]
      });
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:Workflow)'),
        expect.objectContaining({ identifier: workflowId })
      );
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should get similar workflows', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      // First call for validating the workflow exists
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('test-workflow') }]
      });
      
      // Second call for getting similar workflows
      mockSession.run.mockResolvedValueOnce({
        records: [
          { 
            get: function(key) {
              if (key === 'workflow') return { id: 'workflow2', name: 'Similar Workflow', tags: ['test'] };
              if (key === 'commonTags') return 1;
              return null;
            }
          }
        ]
      });
      
      // Act
      const result = await neo4jService.getWorkflowRelationships(driver, workflowId, 'similar');
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.similarWorkflows).toBeDefined();
      expect(result.similarWorkflows.length).toBe(1);
      expect(result.similarWorkflows[0]).toEqual({
        workflow: { id: 'workflow2', name: 'Similar Workflow', tags: ['test'] },
        commonTags: 1
      });
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle workflow not found', async () => {
      // Arrange
      const workflowId = 'non-existent';
      // Call for validating the workflow exists returns empty
      mockSession.run.mockResolvedValueOnce({ records: [] });
      
      // Act
      const result = await neo4jService.getWorkflowRelationships(driver, workflowId);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow not found');
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle unknown relationship type', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      const relationshipType = 'unknown';
      // Call for validating the workflow exists
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue('test-workflow') }]
      });
      
      // Act
      const result = await neo4jService.getWorkflowRelationships(driver, workflowId, relationshipType);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown relationship type');
      expect(mockSession.close).toHaveBeenCalled();
    });
    
    test('should handle database error', async () => {
      // Arrange
      const workflowId = 'test-workflow';
      mockSession.run.mockRejectedValueOnce(new Error('Database relationship error'));
      
      // Act
      const result = await neo4jService.getWorkflowRelationships(driver, workflowId);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database relationship error');
      expect(mockSession.close).toHaveBeenCalled();
    });
  });
  
  describe('generateId', () => {
    test('should generate ID from name', () => {
      // We want to test the behavior of the function without relying on the exact output format
      // since it has a timestamp part that will change
      
      // Act
      const result = neo4jService.generateId('Test Workflow Name');
      
      // Assert
      // Check that it contains the lowercase version of the name with underscores
      expect(result).toContain('test_workflow_name');
      // Check that it doesn't match the input directly (has been transformed)
      expect(result).not.toEqual('Test Workflow Name');
    });
    
    test('should handle empty name', () => {
      // Act
      const result = neo4jService.generateId('');
      
      // Assert
      // Check that it starts with "workflow_" followed by numbers
      expect(result).toContain('workflow_');
      // Check that it doesn't just equal the prefix (has a timestamp)
      expect(result).not.toEqual('workflow_');
    });
    
    test('should handle null name', () => {
      // Act
      const result = neo4jService.generateId(null);
      
      // Assert
      // Check that it starts with "workflow_" followed by numbers
      expect(result).toContain('workflow_');
      // Check that it doesn't just equal the prefix (has a timestamp)
      expect(result).not.toEqual('workflow_');
    });
  });
});