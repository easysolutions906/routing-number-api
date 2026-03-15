#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import * as routing from './data/routing.js';
import { authMiddleware, createKey, revokeKey, PLANS, incrementUsage } from './keys.js';
import { createCheckoutSession, handleWebhook } from './stripe.js';

// --- MCP Server ---

const server = new McpServer({
  name: 'mcp-routing',
  version: '1.0.0',
});

server.tool(
  'routing_lookup',
  `Look up a bank or financial institution by its 9-digit ABA routing number. Returns institution name, address, phone, and Federal Reserve district. Searches ${routing.totalInstitutions.toLocaleString()} institutions from the FedACH directory.`,
  { routing: z.string().describe('9-digit ABA routing number (e.g., "021000021")') },
  async ({ routing: rtn }) => ({
    content: [{ type: 'text', text: JSON.stringify(routing.lookup(rtn), null, 2) }],
  }),
);

server.tool(
  'routing_search',
  `Search ${routing.totalInstitutions.toLocaleString()} financial institutions by bank name, city, or state. Returns matching routing numbers and institution details.`,
  {
    name: z.string().optional().describe('Bank or institution name to search (e.g., "Chase", "Wells Fargo")'),
    city: z.string().optional().describe('City name (e.g., "New York", "Chicago")'),
    state: z.string().optional().describe('2-letter state code (e.g., "NY", "CA")'),
    limit: z.number().optional().describe('Max results to return (default 25, max 100)'),
  },
  async (params) => ({
    content: [{ type: 'text', text: JSON.stringify(routing.search(params), null, 2) }],
  }),
);

server.tool(
  'routing_validate',
  'Validate an ABA routing number checksum using the official Federal Reserve algorithm (weights 3,7,1). Also identifies the Federal Reserve district and checks if the number exists in the FedACH directory.',
  { routing: z.string().describe('9-digit routing number to validate (e.g., "021000021")') },
  async ({ routing: rtn }) => ({
    content: [{ type: 'text', text: JSON.stringify(routing.validateChecksum(rtn), null, 2) }],
  }),
);

// --- Start ---

const TOOL_COUNT = 3;

const main = async () => {
  const port = process.env.PORT;

  if (port) {
    const app = express();
    app.use(express.json());

    // --- Public endpoints (no auth) ---

    app.get('/', (_req, res) => {
      res.json({
        name: 'Routing Number Lookup API',
        version: '1.0.0',
        description: 'Federal Reserve ABA routing number lookup, search, and validation',
        totalInstitutions: routing.totalInstitutions,
        endpoints: {
          lookup: 'GET /lookup?routing=021000021',
          search: 'GET /search?name=chase&state=NY&limit=25',
          validate: 'GET /validate?routing=021000021',
          batch: 'POST /lookup/batch',
          stats: 'GET /stats',
          dataInfo: 'GET /data-info',
          health: 'GET /health',
        },
        mcp: 'POST /mcp',
        tools: TOOL_COUNT,
        plans: PLANS,
      });
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', totalInstitutions: routing.totalInstitutions });
    });

    app.get('/data-info', (_req, res) => {
      res.json(routing.dataInfo());
    });

    // --- Authenticated endpoints ---

    app.get('/lookup', authMiddleware, (req, res) => {
      const { routing: rtn } = req.query;
      if (!rtn) {
        return res.status(400).json({ error: 'Missing required parameter: routing' });
      }
      incrementUsage(req.identifier);
      res.json(routing.lookup(rtn));
    });

    app.get('/search', authMiddleware, (req, res) => {
      const { name, city, state, limit } = req.query;
      if (!name && !city && !state) {
        return res.status(400).json({ error: 'At least one search parameter required: name, city, or state' });
      }
      incrementUsage(req.identifier);
      res.json(routing.search({ name, city, state, limit }));
    });

    app.get('/validate', authMiddleware, (req, res) => {
      const { routing: rtn } = req.query;
      if (!rtn) {
        return res.status(400).json({ error: 'Missing required parameter: routing' });
      }
      incrementUsage(req.identifier);
      res.json(routing.validateChecksum(rtn));
    });

    app.post('/lookup/batch', authMiddleware, (req, res) => {
      const { routingNumbers } = req.body;
      if (!routingNumbers || !Array.isArray(routingNumbers)) {
        return res.status(400).json({ error: 'Body must contain routingNumbers array' });
      }

      const maxBatch = req.plan.batchLimit || 50;
      if (routingNumbers.length > maxBatch) {
        return res.status(400).json({
          error: `Batch size exceeds limit of ${maxBatch} for your plan`,
          plan: req.planName,
          limit: maxBatch,
        });
      }

      incrementUsage(req.identifier, routingNumbers.length);
      res.json(routing.batchLookup(routingNumbers));
    });

    app.get('/stats', authMiddleware, (req, res) => {
      incrementUsage(req.identifier);
      res.json(routing.stats());
    });

    // --- Stripe checkout ---

    app.post('/checkout', async (req, res) => {
      try {
        const { plan, success_url, cancel_url } = req.body;
        const session = await createCheckoutSession(plan, success_url, cancel_url);
        res.json(session);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
      try {
        const result = handleWebhook(req.body, req.headers['stripe-signature']);
        res.json({ received: true, result });
      } catch (err) {
        console.error('[webhook] Error:', err.message);
        res.status(400).json({ error: err.message });
      }
    });

    // --- Admin key management ---

    const adminAuth = (req, res, next) => {
      const secret = process.env.ADMIN_SECRET;
      if (!secret || req.headers['x-admin-secret'] !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    };

    app.post('/admin/keys', adminAuth, (req, res) => {
      const { plan, email } = req.body;
      const result = createKey(plan, email);
      res.json(result);
    });

    app.delete('/admin/keys/:key', adminAuth, (req, res) => {
      const revoked = revokeKey(req.params.key);
      res.json({ revoked });
    });

    // --- MCP transport ---

    const transports = {};

    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      let transport = transports[sessionId];

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };
        await server.connect(transport);
        transports[transport.sessionId] = transport;
      }

      await transport.handleRequest(req, res, req.body);
    });

    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      const transport = transports[sessionId];
      if (!transport) {
        res.status(400).json({ error: 'No active session. Send a POST to /mcp first.' });
        return;
      }
      await transport.handleRequest(req, res);
    });

    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      const transport = transports[sessionId];
      if (!transport) {
        res.status(400).json({ error: 'No active session.' });
        return;
      }
      await transport.handleRequest(req, res);
    });

    app.listen(parseInt(port, 10), () => {
      console.log(`Routing number API + MCP server running on port ${port}`);
      console.log(`  ${routing.totalInstitutions} institutions loaded`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
};

main().catch((err) => {
  console.error('Failed to start routing number server:', err);
  process.exit(1);
});
