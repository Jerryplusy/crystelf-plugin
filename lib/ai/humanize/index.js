import MemoryRetrieval from './memory.js';
import TopicTracker from './topic.js';
import ActionPlanner from './planner.js';
import TypoGenerator from './typo.js';
import EmojiAgent from './emoji-agent.js';
import ExpressionLearner from './expression.js';
export { pickReplyStyle, pickPersonalityState } from './utils.js';

class HumanizeEngine {
  constructor(ai, config, db) {
    this.memoryRetrieval = new MemoryRetrieval(ai, config, db);
    this.topicTracker = new TopicTracker(ai, config, db);
    this.actionPlanner = new ActionPlanner(ai, config);
    this.typoGenerator = new TypoGenerator(config);
    this.emojiAgent = new EmojiAgent(ai, config, db);
    this.expressionLearner = new ExpressionLearner(ai, config, db);
  }

  async init() {}
}

export default HumanizeEngine;
