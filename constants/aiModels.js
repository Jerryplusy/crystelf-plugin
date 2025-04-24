const aiModels = {
  openai: {
    gpt3: 'text-davinci-003',
    gpt4: 'gpt-4',
    gpt35_turbo: 'gpt-3.5-turbo',
  },

  deepseek: {
    r1: 'deepseek-ai/DeepSeek-R1',
    v3: 'deepseek-ai/DeepSeek-V3',
    r1_distill_Qwen_32b: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', //1.26
    r1_distill_Qwen_14b: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B', //0.7
  },

  THUDM: {
    GLM4_32b: 'THUDM/GLM-4-32B-0414', // 1.89/M tokens
    GLMZ1_32b: 'THUDM/GLM-Z1-32B-0414', // 4/M tokens
    GLM4_9b: 'THUDM/GLM-4-9B-0414', //free
  },

  Qwen: {
    Qwen25VL_32b: 'Qwen/Qwen2.5-VL-32B-Instruct', // 视觉
    QwenQ_32b: 'Qwen/QwQ-32B', //4/M tokens
    Qwen25_72b: 'Qwen/Qwen2.5-72B-Instruct-128K', //4.13
  },
};

export default aiModels;
