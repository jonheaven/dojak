import { MiddlewareHandler } from 'hono';

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    console.error('API Error:', error);

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    return c.json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }, statusCode);
  }
};
