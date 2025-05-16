import os
import json
from typing import Any, Dict, List, Optional
from supabase import create_client, Client

class Server:
    def __init__(self):
        """Initialize the Supabase MCP server."""
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
    
    async def store_workflow(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """Store a workflow in Supabase."""
        try:
            data = {
                "name": workflow["name"],
                "category": workflow["category"],
                "description": workflow.get("description", ""),
                "tags": workflow.get("tags", []),
                "complexity": workflow.get("complexity", "moderate"),
                "nodes": json.dumps(workflow.get("nodes", {})),
                "connections": json.dumps(workflow.get("connections", {})),
            }
            
            result = self.supabase.table("workflows").insert(data).execute()
            return {"success": True, "data": result.data}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_workflow(self, workflow_id: int) -> Dict[str, Any]:
        """Get a workflow by ID."""
        try:
            result = self.supabase.table("workflows").select("*").eq("id", workflow_id).single().execute()
            return {"success": True, "data": result.data}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def search_workflows(self, category: Optional[str] = None, 
                             tags: Optional[List[str]] = None,
                             complexity: Optional[str] = None) -> Dict[str, Any]:
        """Search workflows by criteria."""
        try:
            query = self.supabase.table("workflows").select("*")
            
            if category:
                query = query.eq("category", category)
            if tags:
                query = query.contains("tags", tags)
            if complexity:
                query = query.eq("complexity", complexity)
            
            result = query.execute()
            return {"success": True, "data": result.data}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_categories(self) -> Dict[str, Any]:
        """Get all unique workflow categories."""
        try:
            result = self.supabase.table("workflows").select("category").execute()
            categories = list(set(item["category"] for item in result.data))
            return {"success": True, "data": categories}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_tags(self) -> Dict[str, Any]:
        """Get all unique workflow tags."""
        try:
            result = self.supabase.table("workflows").select("tags").execute()
            all_tags = []
            for item in result.data:
                all_tags.extend(item["tags"])
            unique_tags = list(set(all_tags))
            return {"success": True, "data": unique_tags}
        except Exception as e:
            return {"success": False, "error": str(e)}
