import os
import asyncio
from dotenv import load_dotenv
from mcp.server import Server

# Load environment variables
load_dotenv()

def main():
    """Main entry point for the Supabase MCP server."""
    try:
        # Create and run the server
        server = Server()
        
        # Keep the server running
        loop = asyncio.get_event_loop()
        loop.run_forever()
    except Exception as e:
        print(f"Error starting server: {e}")
        return 1
    return 0

if __name__ == "__main__":
    exit(main())
