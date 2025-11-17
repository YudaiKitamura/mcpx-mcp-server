import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { McpX } from './lib/mcpx/mcpx';
import { DataType } from './lib/mcpx/type.d';
import { fileURLToPath } from 'url';
import path from "path";
import fs from "fs/promises";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const server = new McpServer({
  name: 'mcpx-mcp-server',
  version: '1.0.0'
});

const dataTypeSchema = z.enum([
  DataType.Short,
  DataType.Int,
  DataType.Float,
  DataType.Bool,
]);

server.registerTool(
  'batch-read',
  {
    title: '連続デバイス一括読み出し',
    description: `
      指定したPLCのデバイス範囲を一括で読み取ります。
      - address: 読み取り開始アドレス（例: D1000, X1A）
      - length: 読み取る連続デバイスの数
      - deviceType: 読み取り値の型（数値型またはブール型）

      返却される値は配列で、deviceTypeに応じて数値または真偽値となります。
      各アドレスのコメントや固有の情報は 'get-device-descriptions' メソッドで取得可能です。
      `,
    inputSchema: { address: z.string(), length: z.number(), deviceType: dataTypeSchema },
    outputSchema: { result: z.array(z.union([z.number(), z.boolean()])) }
  },
  async ({ address, length, deviceType }) => {
    const mcpx = new McpX('192.168.12.88', 10000);
    const values = mcpx.batchRead(deviceType, address, length);
    mcpx.dispose();
    const output = { result: Array.from(values) };

    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    };
    }
);

server.registerTool(
  'batch-write',
  {
    title: '連続デバイス一括書き込み',
    description: `
      '指定したPLCのデバイスに対して、配列で与えた値を一括で書き込みます。
      - address: 書き込み開始アドレス（例: D1000, X1A）
      - length: 書き込みする連続デバイスの数
      - deviceType: 書き込み値の型（数値型またはブール型）

      返却される値は真偽値で、処理が正常に完了するとtrueを返します。
      各アドレスのコメントや固有の情報は 'get-device-descriptions' メソッドで取得可能です。
      `,
    inputSchema: { address: z.string(), value: z.array(z.union([z.number(), z.boolean()])), deviceType: dataTypeSchema },
    outputSchema: { result: z.boolean() }
  },
  async ({ address, value, deviceType }) => {
    const mcpx = new McpX('192.168.12.88', 10000);
    mcpx.batchWrite(deviceType, address, value);
    mcpx.dispose();
    const output = { result: true };

    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);

server.registerTool(
  'get-device-descriptions',
  {
    title: 'デバイス情報取得',
    description:`
      アクセス可能なPLCのデバイス一覧と、それぞれの詳細情報を取得します。

      返却される情報:
      - address: デバイスアドレス（例: D1000, X1A）
      - name: デバイスの名称
      - comment: デバイスに関するコメントや説明
      `,
    inputSchema: {},
    outputSchema: { descriptions: z.array(z.object({ address: z.string(), name: z.string(), comment: z.string() })) }
  },
  async () => {
    try {
      const filePath = path.join(dirname, "address-comment.json");
      const text = await fs.readFile(filePath, "utf-8");
      const descriptions = JSON.parse(text);

      return {
        content: [{ type: 'text', text: JSON.stringify({ text }) }],
        structuredContent: { descriptions }
      };    
    } catch (err) {
        throw new Error(`リソースの読み込みに失敗しました。: ${err}`);
    }
  }
);

// TODO: 現状のGemini CLIでは、リソースに対応していないため、未検証（https://github.com/google-gemini/gemini-cli/issues/1459）
server.registerResource(
  "device-comments",
  "mcp://adress-comment",
  {
    title: "デバイスコメント",
    description: "アドレスとコメントの対応表",
    mimeType: "application/json"
  },
  async (uri: URL) => {
    try {
      const filePath = path.join(dirname, "address-comment.json");
      const text = await fs.readFile(filePath, "utf-8");
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text,
          }],
        };
    } catch (err) {
      throw new Error(`リソースの読み込みに失敗しました。: ${err}`);
    }
  }
);

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on('close', () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
  console.log(`McpX MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
  console.error('Server error:', error);
  process.exit(1);
});
