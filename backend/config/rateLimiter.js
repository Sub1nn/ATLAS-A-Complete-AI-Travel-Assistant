import rateLimit from "express-rate-limit";

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "You have exceeded the rate limit. Please try again later.",
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000
    ),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil(
        (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000
      ),
    });
  },
});

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 chat requests per minute
  message: {
    error: "Chat rate limit exceeded",
    message:
      "Too many chat messages. Please wait a moment before sending another message.",
    retryAfter: 60,
  },
  skipSuccessfulRequests: false,
  keyGenerator: (req, res) => {
    // Use userId from request body if available, otherwise fall back to IP
    if (req.body && req.body.userId) {
      return `user:${req.body.userId}`;
    }
    // Use the standard IP key generator that handles IPv6 properly
    return req.ip;
  },
  // Handle IPv6 addresses properly
  standardHeaders: true,
  legacyHeaders: false,
});
