export function pickReplyStyle(config) {
  const replyStyle = config.replyStyle || {};
  const baseStyle = replyStyle.baseStyle || '';
  const styles = Array.isArray(replyStyle.multipleStyles) ? replyStyle.multipleStyles : [];
  const probability = Number(replyStyle.multipleProbability || 0);

  if (styles.length > 0 && probability > 0 && Math.random() < probability) {
    return styles[Math.floor(Math.random() * styles.length)];
  }

  return baseStyle;
}

export function pickPersonalityState(config) {
  const personality = config.personality || {};
  const states = Array.isArray(personality.states) ? personality.states : [];
  const probability = Number(personality.stateProbability || 0);

  if (states.length > 0 && probability > 0 && Math.random() < probability) {
    return states[Math.floor(Math.random() * states.length)];
  }

  return null;
}
