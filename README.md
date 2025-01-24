# ShopSmartScan - Backend

A Cloudflare Worker application built with Hono and Google's Generative AI for smart shopping assistance.

## Prerequisites

- Node.js
- Wrangler CLI
- Bun (for package management)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Set up your environment variables in `.dev.vars`

## Available Commands

- `bun run dev` - Start development server
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun run format` - Format code using Biome
- `bun run lint` - Lint code using Biome
- `bun run check` - Check and fix code issues using Biome

## Tech Stack

- Hono - Web framework
- Google Generative AI
- Cloudflare Workers
- TypeScript
- Biome - Code formatter and linter
- Zod - Schema validation
