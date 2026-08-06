import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Wraps an MCP server as a client connection.
 * Spawns the server as a child process and communicates via stdio.
 */
export class McpClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  constructor(private name: string) {
    this.client = new Client({ name: `mcp-main/${name}`, version: '0.1.0' });
  }

  /**
   * Connect to the MCP server by spawning its built dist/index.js
   */
  async connect(serverPath: string): Promise<void> {
    const absolutePath = resolve(__dirname, serverPath);

    this.transport = new StdioClientTransport({
      command: 'node',
      args: [absolutePath],
    });

    await this.client.connect(this.transport);
    this.connected = true;
    console.log(`[mcp-main] Connected to ${this.name}`);
  }

  /**
   * Connect to an MCP server using an arbitrary command + args.
   * Useful for servers that run via npx or other CLI commands.
   */
  async connectCommand(
    command: string,
    args: string[],
    env?: Record<string, string>,
  ): Promise<void> {
    this.transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env } as Record<string, string>,
    });

    await this.client.connect(this.transport);
    this.connected = true;
    console.log(`[mcp-main] Connected to ${this.name}`);
  }

  /**
   * Call a tool on the connected MCP server
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (!this.connected) {
      throw new Error(`[mcp-main] ${this.name} is not connected`);
    }

    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    // MCP tools return content array; extract the text content
    const content = result.content as Array<{ type: string; text?: string }>;
    const textContent = content.find((c) => c.type === 'text');

    if (!textContent?.text) {
      throw new Error(
        `[mcp-main] No text response from ${this.name}.${toolName}`,
      );
    }

    // Try to parse as JSON, otherwise return raw text
    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  }

  /**
   * Disconnect and kill the child process
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.connected = false;
      console.log(`[mcp-main] Disconnected from ${this.name}`);
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Creates and connects all MCP clients (gcp-mock, ui, library-context).
 * Server paths are relative to this file's location in dist/.
 */
export async function createMcpClients() {
  const gcpClient = new McpClient('mcp-gcp-mock');
  const uiClient = new McpClient('mcp-ui');
  const libraryContextClient = new McpClient('library-context');

  // Paths relative from dist/ to sibling package dist/index.js
  const gcpServerPath = resolve(__dirname, '../../mcp-gcp-mock/dist/index.js');
  const uiServerPath = resolve(__dirname, '../../mcp-ui/dist/index.js');

  await gcpClient.connect(gcpServerPath);
  await uiClient.connect(uiServerPath);

  // library-context runs from its installed dist/index.js in node_modules
  const projectRoot = resolve(__dirname, '../../../');
  const libraryContextPath = resolve(
    projectRoot,
    'node_modules/@macropaytd/lib-front-mcp-library-context/dist/index.js',
  );
  await libraryContextClient.connectCommand('node', [libraryContextPath], {
    MCP_PROJECT_ROOT: projectRoot,
  });

  return { gcpClient, uiClient, libraryContextClient };
}

