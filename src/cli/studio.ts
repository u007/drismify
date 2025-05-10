import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { spawn } from 'child_process';
import { createAdapterFromDatasource } from '../adapters';

/**
 * Studio options
 */
export interface StudioOptions {
  /**
   * Path to the schema file
   */
  schemaPath?: string;
  
  /**
   * Port to run the studio on
   */
  port?: number;
  
  /**
   * Whether to open the browser automatically
   */
  browser?: boolean;
  
  /**
   * Whether to run in read-only mode
   */
  readOnly?: boolean;
}

/**
 * Start the Drismify Studio
 */
export async function startStudio(options: StudioOptions): Promise<void> {
  const {
    schemaPath = 'schema.prisma',
    port = 5555,
    browser = true,
    readOnly = false
  } = options;
  
  // Check if the schema file exists
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  
  // Read the schema file
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  
  // Parse the schema
  const parser = require('../parser/generatedParser.js');
  const ast = parser.parse(schemaContent);
  
  // Extract datasource from the AST
  const datasource = ast.find((node: any) => node.type === 'datasource');
  if (!datasource) {
    throw new Error('No datasource found in the schema');
  }
  
  // Create adapter from datasource
  const adapter = await createAdapterFromDatasource(datasource);
  
  // Check if the studio dependencies are installed
  const studioPath = path.join(__dirname, '..', '..', 'node_modules', '@drismify', 'studio');
  if (!fs.existsSync(studioPath)) {
    console.log('Drismify Studio is not installed. Installing now...');
    
    try {
      // Install the studio package
      const child = spawn('npm', ['install', '@drismify/studio@latest'], {
        stdio: 'inherit',
        shell: true
      });
      
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Installation exited with code ${code}`));
          }
        });
      });
      
      console.log('Drismify Studio installed successfully');
    } catch (error) {
      console.error('Error installing Drismify Studio:', error);
      throw new Error('Failed to install Drismify Studio. Please try again.');
    }
  }
  
  console.log(`Starting Drismify Studio on http://localhost:${port}`);
  console.log(`Read-only mode: ${readOnly ? 'enabled' : 'disabled'}`);
  
  // Extract models from the AST
  const models = ast.filter((node: any) => node.type === 'model');
  
  // Extract enums from the AST
  const enums = ast.filter((node: any) => node.type === 'enum');
  
  // Connect to the database
  await adapter.connect();
  
  try {
    // Create studio server
    const server = http.createServer(async (req, res) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      // Parse URL
      const url = new URL(req.url || '/', `http://localhost:${port}`);
      const pathname = url.pathname;
      
      // API endpoints
      if (pathname === '/api/models') {
        // Return models
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ models, enums }));
      } else if (pathname === '/api/schema') {
        // Return schema
        res.setHeader('Content-Type', 'text/plain');
        res.writeHead(200);
        res.end(schemaContent);
      } else if (pathname.startsWith('/api/data/')) {
        // Handle data requests
        const modelName = pathname.replace('/api/data/', '');
        const tableName = toSnakeCase(modelName);
        
        if (req.method === 'GET') {
          try {
            // Query parameters
            const limit = parseInt(url.searchParams.get('limit') || '100', 10);
            const offset = parseInt(url.searchParams.get('offset') || '0', 10);
            const orderBy = url.searchParams.get('orderBy');
            const search = url.searchParams.get('search');
            
            // Build query
            const query: any = {
              limit,
              offset
            };
            
            if (orderBy) {
              query.orderBy = JSON.parse(orderBy);
            }
            
            if (search) {
              query.where = JSON.parse(search);
            }
            
            // Query data
            const data = await adapter.findMany(tableName, query);
            const count = await adapter.count(tableName, search ? { where: JSON.parse(search) } : {});
            
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify({ data, count }));
          } catch (error: any) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
          }
        } else if (req.method === 'POST' && !readOnly) {
          // Create record
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            
            req.on('end', async () => {
              try {
                const data = JSON.parse(body);
                const result = await adapter.insert(tableName, data);
                
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(201);
                res.end(JSON.stringify(result));
              } catch (error: any) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          } catch (error: any) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
          }
        } else if (req.method === 'PUT' && !readOnly) {
          // Update record
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            
            req.on('end', async () => {
              try {
                const data = JSON.parse(body);
                const id = url.searchParams.get('id');
                
                if (!id) {
                  throw new Error('ID is required for update');
                }
                
                const result = await adapter.update(tableName, { where: { id }, data });
                
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify(result));
              } catch (error: any) {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          } catch (error: any) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
          }
        } else if (req.method === 'DELETE' && !readOnly) {
          // Delete record
          try {
            const id = url.searchParams.get('id');
            
            if (!id) {
              throw new Error('ID is required for delete');
            }
            
            const result = await adapter.delete(tableName, { where: { id } });
            
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(result));
          } catch (error: any) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
          }
        } else {
          res.writeHead(405);
          res.end('Method Not Allowed');
        }
      } else if (pathname === '/' || pathname.startsWith('/models/')) {
        // Serve studio web UI
        try {
          // Serve the studio web UI (loaded from @drismify/studio package)
          const studioIndexPath = path.join(studioPath, 'dist', 'index.html');
          
          if (fs.existsSync(studioIndexPath)) {
            const html = fs.readFileSync(studioIndexPath, 'utf-8');
            
            // Inject configuration
            const configScript = `
              <script>
                window.DRISMIFY_CONFIG = {
                  readOnly: ${readOnly},
                  schemaPath: "${schemaPath}",
                  apiUrl: "http://localhost:${port}/api"
                };
              </script>
            `;
            
            const modifiedHtml = html.replace('</head>', `${configScript}</head>`);
            
            res.setHeader('Content-Type', 'text/html');
            res.writeHead(200);
            res.end(modifiedHtml);
          } else {
            res.writeHead(404);
            res.end('Studio UI not found');
          }
        } catch (error: any) {
          res.writeHead(500);
          res.end(`Error serving Studio UI: ${error.message}`);
        }
      } else if (pathname.startsWith('/assets/')) {
        // Serve static assets
        try {
          const assetPath = path.join(studioPath, 'dist', pathname);
          
          if (fs.existsSync(assetPath)) {
            const content = fs.readFileSync(assetPath);
            
            // Set content type based on file extension
            const ext = path.extname(assetPath);
            let contentType = 'text/plain';
            
            switch (ext) {
              case '.js':
                contentType = 'application/javascript';
                break;
              case '.css':
                contentType = 'text/css';
                break;
              case '.json':
                contentType = 'application/json';
                break;
              case '.png':
                contentType = 'image/png';
                break;
              case '.jpg':
              case '.jpeg':
                contentType = 'image/jpeg';
                break;
              case '.svg':
                contentType = 'image/svg+xml';
                break;
            }
            
            res.setHeader('Content-Type', contentType);
            res.writeHead(200);
            res.end(content);
          } else {
            res.writeHead(404);
            res.end('Asset not found');
          }
        } catch (error: any) {
          res.writeHead(500);
          res.end(`Error serving asset: ${error.message}`);
        }
      } else {
        // Not found
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    
    // Start server
    server.listen(port, () => {
      console.log(`Drismify Studio is running at http://localhost:${port}`);
      
      // Open browser if requested
      if (browser) {
        openBrowser(`http://localhost:${port}`);
      }
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please try a different port.`);
      } else {
        console.error('Studio server error:', error);
      }
      
      // Close adapter connection
      adapter.disconnect().catch(console.error);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\nStopping Drismify Studio...');
      
      // Close server and adapter connection
      server.close();
      adapter.disconnect().catch(console.error);
      
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting Studio:', error);
    await adapter.disconnect();
    throw error;
  }
}

/**
 * Open the default browser
 */
function openBrowser(url: string): void {
  const command = process.platform === 'win32' ? 'start' :
    process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  spawn(command, [url], { stdio: 'ignore', shell: true });
}

/**
 * Convert PascalCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}