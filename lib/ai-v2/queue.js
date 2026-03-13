export class MessageQueueManager {
  constructor() {
    this.pendingMessages = new Map();
    this.activeTargets = new Map();
  }

  enqueue(sessionId, event, triggerReason = 'review') {
    const queue = this.pendingMessages.get(sessionId) || [];
    queue.push({ event, triggerReason, queuedAt: Date.now() });
    this.pendingMessages.set(sessionId, queue);
  }

  getQueue(sessionId) {
    return this.pendingMessages.get(sessionId) || [];
  }

  clearQueue(sessionId) {
    this.pendingMessages.delete(sessionId);
  }

  hasQueue(sessionId) {
    return this.getQueue(sessionId).length > 0;
  }

  isProcessing(sessionId) {
    return this.activeTargets.has(sessionId);
  }

  setActiveTarget(sessionId, target) {
    this.activeTargets.set(sessionId, target);
  }

  clearActiveTarget(sessionId) {
    this.activeTargets.delete(sessionId);
  }
}

export function splitByReplyMarkers(line) {
  return line.split(/(?=\[\[\[reply:\d+\]\]\]|\(\(\(reply:\d+\)\)\))/).filter((item) => item.trim());
}

export function parseLineMarkers(line, quoteMode) {
  const atUsers = [];
  const pokeUsers = [];
  let quoteId;

  for (const pattern of [/\[\[\[at:(\d+)\]\]\]/g, /\(\(\(at:(\d+)\)\)\)/g, /\(\(\((\d+)\)\)\)/g]) {
    for (const match of line.matchAll(pattern)) {
      atUsers.push(Number(match[1]));
    }
  }

  for (const pattern of [/\[\[\[poke:(\d+)\]\]\]/g, /\(\(\(poke:(\d+)\)\)\)/g]) {
    for (const match of line.matchAll(pattern)) {
      pokeUsers.push(Number(match[1]));
    }
  }

  if (quoteMode !== 'skip') {
    for (const pattern of [/\[\[\[reply:(\d+)\]\]\]/g, /\(\(\(reply:(\d+)\)\)\)/g]) {
      for (const match of line.matchAll(pattern)) {
        if (quoteId === undefined) quoteId = Number(match[1]);
      }
    }
  }

  const cleanText = line
    .replace(/\[\[\[at:\d+\]\]\]/g, '')
    .replace(/\(\(\(at:\d+\)\)\)/g, '')
    .replace(/\(\(\(\d+\)\)\)/g, '')
    .replace(/\[\[\[poke:\d+\]\]\]/g, '')
    .replace(/\(\(\(poke:\d+\)\)\)/g, '')
    .replace(/\[\[\[reply:\d+\]\]\]/g, '')
    .replace(/\(\(\(reply:\d+\)\)\)/g, '')
    .trim();

  return { cleanText, atUsers, pokeUsers, quoteId };
}
