import { MiddlewareHandler } from 'hono';

// Simple in-memory rate limiting (for production, use Redis or similar)
const requests = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per minute per IP

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') ||
             c.req.header('X-Forwarded-For') ||
             c.req.header('X-Real-IP') ||
             'unknown';

  const now = Date.now();
  const key = `${ip}:${c.req.path}`;

  const current = requests.get(key);

  if (!current || now > current.resetTime) {
    // Reset or create new entry
    requests.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
  } else if (current.count >= RATE_LIMIT_MAX) {
    return c.json({
      success: false,
      error: 'Too many requests. Please wait before trying again.',
      retryAfter: Math.ceil((current.resetTime - now) / 1000)
    }, 429);
  } else {
    current.count++;
  }

  // Clean up old entries occasionally
  if (Math.random() < 0.01) { // 1% chance
    for (const [k, v] of requests.entries()) {
      if (now > v.resetTime) {
        requests.delete(k);
      }
    }
  }

  await next();
};
