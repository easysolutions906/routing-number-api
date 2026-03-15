# Routing Number Lookup API + MCP Server

Federal Reserve ABA routing number lookup, search, and validation. Embeds the FedACH directory data locally for fast, dependency-free lookups.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/data-info` | Data source and freshness info |
| GET | `/lookup?routing=021000021` | Look up by routing number |
| GET | `/search?name=chase&state=NY&limit=25` | Search by name, city, state |
| GET | `/validate?routing=021000021` | Validate routing number checksum |
| POST | `/lookup/batch` | Batch lookup (max 50) |
| GET | `/stats` | Institution counts by state |
| POST | `/mcp` | MCP Streamable HTTP transport |

## MCP Tools

- **routing_lookup** — Look up a bank by routing number
- **routing_search** — Search institutions by name, city, or state
- **routing_validate** — Validate ABA checksum (weights 3,7,1)

## Data Pipeline

```bash
npm run build-data
```

Downloads the FedACH directory from the Federal Reserve and converts to JSON. Falls back to bundled sample data if the download is unavailable.

To use a local file, place `FedACHdir.txt` in `scripts/` and run the build script.

## Setup

```bash
npm ci
npm run build-data
npm start           # requires PORT env var for HTTP mode
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes (HTTP) | Server port. Omit for stdio MCP mode |
| `ADMIN_SECRET` | No | Secret for admin key management endpoints |
| `STRIPE_SECRET_KEY` | No | Stripe API key for billing |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature verification |

## Authentication

Free tier: no API key required (50 lookups/day, 5/min).

Paid plans: pass `x-api-key` header or `api_key` query parameter.

## Checksum Algorithm

ABA routing numbers use a weighted checksum: multiply each digit by the weight `[3,7,1,3,7,1,3,7,1]`, sum the products, and verify the result is divisible by 10.
