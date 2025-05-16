/**
 * Direct Context7 approach for fetching n8n documentation
 */
const { WebFetch } = require('@upstash/context7-web-fetch');
const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = path.join(__dirname, 'n8n-docs');
const DOCS_URL = 'https://docs.n8n.io/';

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchN8nDocs() {
  try {
    console.log(`Fetching n8n documentation from ${DOCS_URL}...`);
    
    const fetcher = new WebFetch();
    const result = await fetcher.fetch({
      url: DOCS_URL,
      extract_headings: true,
      extract_links: true,
      extract_text: true
    });
    
    // Write the output to a file
    const outputFile = path.join(OUTPUT_DIR, 'n8n_docs_main.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    
    console.log(`Main documentation saved to ${outputFile}`);
    
    // Extract links and fetch a few important pages
    const links = result.links || [];
    const relevantLinks = links
      .filter(link => link.url.startsWith(DOCS_URL) && !link.url.includes('#'))
      .slice(0, 5); // Just get 5 links for demo purposes
    
    console.log(`Found ${links.length} links, processing ${relevantLinks.length} important pages...`);
    
    for (let i = 0; i < relevantLinks.length; i++) {
      const link = relevantLinks[i];
      console.log(`Fetching page ${i + 1}/${relevantLinks.length}: ${link.url}`);
      
      try {
        const pageResult = await fetcher.fetch({
          url: link.url,
          extract_headings: true,
          extract_links: false,
          extract_text: true
        });
        
        const pageFile = path.join(OUTPUT_DIR, `n8n_docs_page_${i + 1}.json`);
        fs.writeFileSync(pageFile, JSON.stringify(pageResult, null, 2));
        console.log(`Page saved to ${pageFile}`);
      } catch (pageError) {
        console.error(`Error fetching page ${link.url}:`, pageError.message);
      }
    }
    
    console.log('Documentation fetching completed successfully!');
  } catch (error) {
    console.error('Error fetching documentation:', error.message);
  }
}

// Run the function
fetchN8nDocs().catch(console.error);