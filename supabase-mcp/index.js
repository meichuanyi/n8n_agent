const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Store workflow data
app.post('/store-workflow', async (req, res) => {
  try {
    const { workflow } = req.body;
    const { data, error } = await supabase
      .from('workflows')
      .insert([{
        name: workflow.name,
        category: workflow.category,
        description: workflow.description,
        tags: workflow.tags,
        complexity: workflow.complexity,
        nodes: workflow.nodes,
        connections: workflow.connections,
        created_at: new Date(),
        updated_at: new Date()
      }]);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get workflow by ID
app.get('/workflow/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search workflows
app.get('/search-workflows', async (req, res) => {
  try {
    const { category, tags, complexity } = req.query;
    let query = supabase.from('workflows').select('*');

    if (category) {
      query = query.eq('category', category);
    }
    if (tags) {
      query = query.contains('tags', [tags]);
    }
    if (complexity) {
      query = query.eq('complexity', complexity);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all categories
app.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('category')
      .distinct();

    if (error) throw error;
    res.json({ success: true, data: data.map(d => d.category) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all tags
app.get('/tags', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('workflows')
      .select('tags');

    if (error) throw error;
    const allTags = data.reduce((acc, curr) => {
      return [...acc, ...curr.tags];
    }, []);
    const uniqueTags = [...new Set(allTags)];
    res.json({ success: true, data: uniqueTags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Supabase MCP server running on port ${PORT}`);
}); 