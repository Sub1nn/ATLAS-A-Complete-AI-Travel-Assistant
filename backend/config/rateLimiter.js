import rateLimit from "express-rate-limit";

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300);
const chatWindowMs = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const chatMaxRequests = Number(process.env.CHAT_RATE_LIMIT_MAX_REQUESTS || 12);

function clientKey(req) {
  return req.user?._id ? `user:${req.user._id.toString()}` : req.ip;
}

export const rateLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    error: "Too many requests",
    message: "You have exceeded the rate limit. Please try again later.",
    retryAfter: Math.ceil(windowMs / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for ${clientKey(req)}`);
    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil(windowMs / 1000),
    });
  },
});

export const chatRateLimiter = rateLimit({
  windowMs: chatWindowMs,
  max: chatMaxRequests,
  keyGenerator: clientKey,
  message: {
    error: "Chat rate limit exceeded",
    message: "Too many chat messages. Please wait a moment before sending another message.",
    retryAfter: Math.ceil(chatWindowMs / 1000),
  },
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});
