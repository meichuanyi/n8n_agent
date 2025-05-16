/**
 * Tests for Supabase Vector Integration
 * 
 * This file contains tests for the Supabase pgvector integration functions
 * following TDD methodology.
 */

// Mock the @supabase/supabase-js module
jest.mock('@supabase/supabase-js', () => {
  const mockSelect = jest.fn().mockReturnThis();
  const mockFrom = jest.fn().mockReturnValue({
    select: mockSelect,
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Test Workflow', category: 'test' },
        { id: 2, name: 'Another Workflow', category: 'workflow' }
      ],
      error: null
    })
  });
  
  const mockRpc = jest.fn().mockResolvedValue({
    data: [
      { id: 1, name: 'Test Workflow', similarity: 0.95 },
      { id: 2, name: 'Similar Workflow', similarity: 0.82 }
    ],
    error: null
  });
  
  const supabaseClientMock = {
    from: mockFrom,
    rpc: mockRpc
  };
  
  return {
    createClient: jest.fn().mockReturnValue(supabaseClientMock)
  };
});

// Module to test - assuming we're working with a structure similar to our implementation
class SupabaseVectorService {
  constructor(url, key) {
    const { createClient } = require('@supabase/supabase-js');
    this.supabase = createClient(url, key);
  }
  
  // Store a workflow with embedding
  async storeWorkflow(workflow, embedding) {
    try {
      const { data, error } = await this.supabase
        .from('workflows')
        .insert([{
          name: workflow.name,
          category: workflow.category,
          description: workflow.description || '',
          tags: workflow.tags || [],
          complexity: workflow.complexity || 'moderate',
          embedding: embedding
        }]);
      
      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Search similar workflows by embedding
  async searchSimilarWorkflows(queryEmbedding, threshold = 0.7, limit = 5) {
    try {
      const { data, error } = await this.supabase
        .rpc('search_similar_workflows', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        });
      
      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Search workflows by criteria
  async searchWorkflows(criteria = {}) {
    try {
      let query = this.supabase.from('workflows').select('*');
      
      if (criteria.category) {
        query = query.eq('category', criteria.category);
      }
      
      if (criteria.tags && Array.isArray(criteria.tags) && criteria.tags.length > 0) {
        query = query.contains('tags', criteria.tags);
      }
      
      if (criteria.complexity) {
        query = query.eq('complexity', criteria.complexity);
      }
      
      const { data, error } = await query.execute();
      
      if (error) throw new Error(error.message);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

describe('Supabase Vector Service', () => {
  let service;
  const SUPABASE_URL = 'https://test.supabase.co';
  const SUPABASE_KEY = 'test-key';
  
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Create a new service instance
    service = new SupabaseVectorService(SUPABASE_URL, SUPABASE_KEY);
  });
  
  describe('storeWorkflow', () => {
    test('should store a workflow with embedding', async () => {
      // Arrange
      const mockWorkflow = {
        name: 'Test Workflow',
        category: 'test',
        description: 'A test workflow',
        tags: ['test', 'workflow'],
        complexity: 'simple'
      };
      const mockEmbedding = Array(1536).fill(0);
      
      // Act
      const result = await service.storeWorkflow(mockWorkflow, mockEmbedding);
      
      // Assert
      expect(result.success).toBe(true);
      expect(service.supabase.from).toHaveBeenCalledWith('workflows');
      expect(service.supabase.from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          name: mockWorkflow.name,
          category: mockWorkflow.category,
          embedding: mockEmbedding
        })
      ]);
    });
  });
  
  describe('searchSimilarWorkflows', () => {
    test('should search for similar workflows by embedding', async () => {
      // Arrange
      const mockEmbedding = Array(1536).fill(0);
      const threshold = 0.8;
      const limit = 3;
      
      // Act
      const result = await service.searchSimilarWorkflows(mockEmbedding, threshold, limit);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(service.supabase.rpc).toHaveBeenCalledWith(
        'search_similar_workflows',
        {
          query_embedding: mockEmbedding,
          match_threshold: threshold,
          match_count: limit
        }
      );
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
      
      // Act
      const result = await service.searchWorkflows(criteria);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(service.supabase.from).toHaveBeenCalledWith('workflows');
      expect(service.supabase.from().select).toHaveBeenCalled();
      expect(service.supabase.from().select().eq).toHaveBeenCalledWith('category', criteria.category);
      expect(service.supabase.from().select().eq().contains).toHaveBeenCalledWith('tags', criteria.tags);
      expect(service.supabase.from().select().eq().contains().eq).toHaveBeenCalledWith('complexity', criteria.complexity);
    });
    
    test('should handle search with no criteria', async () => {
      // Act
      const result = await service.searchWorkflows({});
      
      // Assert
      expect(result.success).toBe(true);
      expect(service.supabase.from).toHaveBeenCalledWith('workflows');
      expect(service.supabase.from().select).toHaveBeenCalled();
    });
  });
});