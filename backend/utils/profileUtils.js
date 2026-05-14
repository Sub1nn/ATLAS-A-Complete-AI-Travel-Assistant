export const conversationContext = new Map();

export function createUserContext(userId) {
  const context = {
    history: [],
    currentLocation: null,
    preferences: {
      budget: "mid-range",
      travelStyle: "balanced",
      interests: [],
    },
    createdAt: new Date(),
    lastActive: new Date(),
  };

  conversationContext.set(userId, context);
  return context;
}

export function updateUserContext(userId, updates) {
  const context = conversationContext.get(userId);
  if (!context) {
    return createUserContext(userId);
  }

  Object.assign(context, updates);
  context.lastActive = new Date();
  conversationContext.set(userId, context);
  return context;
}

export function cleanupOldContexts(maxAgeMs = 24 * 60 * 60 * 1000) {
  // 24 hours
  const now = Date.now();
  const toDelete = [];

  for (const [userId, context] of conversationContext.entries()) {
    if (now - context.lastActive.getTime() > maxAgeMs) {
      toDelete.push(userId);
    }
  }

  toDelete.forEach((userId) => conversationContext.delete(userId));
  console.log(`🧹 Cleaned up ${toDelete.length} old conversation contexts`);
}

export function getContextStats() {
  return {
    totalContexts: conversationContext.size,
    activeToday: Array.from(conversationContext.values()).filter(
      (context) =>
        Date.now() - context.lastActive.getTime() < 24 * 60 * 60 * 1000
    ).length,
  };
}

// Run cleanup every hour
setInterval(cleanupOldContexts, 60 * 60 * 1000);
