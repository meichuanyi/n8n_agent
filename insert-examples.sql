-- Insert example workflows with zero vectors
INSERT INTO workflows (name, category, description, tags, complexity, embedding)
VALUES 
('calendar_manager_agent', 'agent', 'Calendar management agent that handles scheduling and appointments', ARRAY['calendar', 'scheduling', 'agent'], 'complex', 
  (SELECT array_fill(0::float4, ARRAY[1536]) AS zero_vector)),
('website_scraper', 'tool', 'Web scraping tool that extracts data from websites', ARRAY['scraping', 'web', 'data'], 'moderate', 
  (SELECT array_fill(0::float4, ARRAY[1536]) AS zero_vector)),
('email_automation', 'workflow', 'Email automation workflow for sending responses to incoming emails', ARRAY['email', 'automation'], 'simple', 
  (SELECT array_fill(0::float4, ARRAY[1536]) AS zero_vector));

-- Insert example node definitions with zero vectors
INSERT INTO node_definitions (file_name, name, category, type, embedding)
VALUES 
('node:edit:code_node.json', 'code_node', 'edit', 'n8n-nodes-base.code', 
  (SELECT array_fill(0::float4, ARRAY[1536]) AS zero_vector)),
('node:trigger:webhook_node.json', 'webhook_node', 'trigger', 'n8n-nodes-base.webhook', 
  (SELECT array_fill(0::float4, ARRAY[1536]) AS zero_vector)),
('node:edit:filter_node.json', 'filter_node', 'edit', 'n8n-nodes-base.filter', 
  (SELECT array_fill(0::float4, ARRAY[1536]) AS zero_vector));