export class RateLimiter {
  constructor(options = {}) {
    this.userTriggers = new Map();
    this.userMessages = new Map();
    this.groupLastResponse = new Map();
    this.groupInteractions = new Map();

    this.maxTriggersPerWindow = options.maxTriggersPerWindow ?? 5;
    this.windowMs = options.windowMs ?? 60_000;
    this.dedupWindowMs = options.dedupWindowMs ?? 30_000;
    this.groupCooldownMs = options.groupCooldownMs ?? 1_000;
    this.dynamicDelayConfig = options.dynamicDelay ?? {
      enabled: true,
      interactionWindowMs: 600_000,
      baseDelayMs: 60_000,
      maxDelayMs: 600_000,
    };

    this.cleanupTimer = setInterval(() => this.cleanup(), 300_000);
  }

  canProcess(userId, groupId, content) {
    const now = Date.now();

    if (groupId) {
      const lastResponse = this.groupLastResponse.get(groupId);
      if (lastResponse && now - lastResponse < this.groupCooldownMs) {
        return false;
      }
    }

    const triggers = this.userTriggers.get(userId) ?? [];
    const recentTriggers = triggers.filter((time) => now - time < this.windowMs);
    if (recentTriggers.length >= this.maxTriggersPerWindow) {
      return false;
    }

    const messages = this.userMessages.get(userId) ?? [];
    const duplicated = messages.find(
      (item) => item.content === content && now - item.timestamp < this.dedupWindowMs
    );

    return !duplicated;
  }

  record(userId, groupId, content) {
    const now = Date.now();

    const triggers = this.userTriggers.get(userId) ?? [];
    triggers.push(now);
    this.userTriggers.set(userId, triggers);

    const messages = this.userMessages.get(userId) ?? [];
    messages.push({ content, timestamp: now });
    if (messages.length > 3) messages.shift();
    this.userMessages.set(userId, messages);

    if (groupId) {
      this.groupLastResponse.set(groupId, now);
    }
  }

  recordInteraction(groupId, userId) {
    if (!this.dynamicDelayConfig.enabled) return;

    const now = Date.now();
    const windowMs = this.dynamicDelayConfig.interactionWindowMs;

    let groupUsers = this.groupInteractions.get(groupId);
    if (!groupUsers) {
      groupUsers = new Map();
      this.groupInteractions.set(groupId, groupUsers);
    }

    let timestamps = groupUsers.get(userId) ?? [];
    timestamps = timestamps.filter((time) => now - time < windowMs);
    timestamps.push(now);
    groupUsers.set(userId, timestamps);
  }

  getInteractionCount(groupId) {
    const now = Date.now();
    const windowMs = this.dynamicDelayConfig.interactionWindowMs;
    const groupUsers = this.groupInteractions.get(groupId);
    if (!groupUsers) return 0;

    let count = 0;
    for (const timestamps of groupUsers.values()) {
      const recent = timestamps.filter((time) => now - time < windowMs);
      if (recent.length > 0) count++;
    }

    return count;
  }

  calculateDelay(groupId) {
    if (!this.dynamicDelayConfig.enabled) return 0;

    const interactionCount = this.getInteractionCount(groupId);
    if (interactionCount <= 1) return 0;

    const { baseDelayMs, maxDelayMs } = this.dynamicDelayConfig;
    const delay = (interactionCount - 1) * baseDelayMs;
    return Math.min(delay, maxDelayMs);
  }

  getDelayInfo(groupId) {
    const interactionCount = this.getInteractionCount(groupId);
    const delayMs = this.calculateDelay(groupId);
    return {
      delayMs,
      interactionCount,
      shouldDelay: delayMs > 0,
    };
  }

  clearGroupInteractions(groupId) {
    this.groupInteractions.delete(groupId);
  }

  cleanup() {
    const now = Date.now();

    for (const [userId, triggers] of this.userTriggers) {
      const valid = triggers.filter((time) => now - time < this.windowMs);
      if (valid.length === 0) {
        this.userTriggers.delete(userId);
      } else {
        this.userTriggers.set(userId, valid);
      }
    }

    for (const [userId, messages] of this.userMessages) {
      const valid = messages.filter((item) => now - item.timestamp < this.dedupWindowMs);
      if (valid.length === 0) {
        this.userMessages.delete(userId);
      } else {
        this.userMessages.set(userId, valid);
      }
    }

    for (const [groupId, timestamp] of this.groupLastResponse) {
      if (now - timestamp > this.groupCooldownMs * 10) {
        this.groupLastResponse.delete(groupId);
      }
    }

    if (!this.dynamicDelayConfig.enabled) {
      return;
    }

    const windowMs = this.dynamicDelayConfig.interactionWindowMs;
    for (const [groupId, groupUsers] of this.groupInteractions) {
      let hasActiveUser = false;
      for (const [userId, timestamps] of groupUsers) {
        const valid = timestamps.filter((time) => now - time < windowMs);
        if (valid.length === 0) {
          groupUsers.delete(userId);
        } else {
          groupUsers.set(userId, valid);
          hasActiveUser = true;
        }
      }
      if (!hasActiveUser) {
        this.groupInteractions.delete(groupId);
      }
    }
  }

  dispose() {
    clearInterval(this.cleanupTimer);
    this.userTriggers.clear();
    this.userMessages.clear();
    this.groupLastResponse.clear();
    this.groupInteractions.clear();
  }
}

export default RateLimiter;
