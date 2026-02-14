import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MCP_SERVER_NAME } from '../src/server-metadata.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ status: 'ok', server: MCP_SERVER_NAME });
}
