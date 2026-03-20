import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Initialize Upstash Redis from auto-injected env vars
  const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  try {
    // GET: peek at current counter
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const locationCode = url.searchParams.get('location') || 'HUB';
      const year = url.searchParams.get('year') || new Date().getFullYear().toString();

      const key = `skyarc_seq:${locationCode}:${year}`;
      const current = (await redis.get(key)) || 0;

      return new Response(
        JSON.stringify({ locationCode, year, currentSeq: current, nextSeq: current + 1 }),
        { status: 200, headers }
      );
    }

    // POST: atomically increment and return agreement number
    if (req.method === 'POST') {
      const body = await req.json();
      const { locationCode, year } = body;

      if (!locationCode || !year) {
        return new Response(
          JSON.stringify({ error: 'locationCode and year are required' }),
          { status: 400, headers }
        );
      }

      const key = `skyarc_seq:${locationCode}:${year}`;
      const newSeq = await redis.incr(key);
      const agreementNumber = `SA/${locationCode}/${year}/${String(newSeq).padStart(3, '0')}`;

      return new Response(
        JSON.stringify({ agreementNumber, seq: newSeq, locationCode, year }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  } catch (error) {
    console.error('Redis Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to access counter store', details: String(error) }),
      { status: 500, headers }
    );
  }
}