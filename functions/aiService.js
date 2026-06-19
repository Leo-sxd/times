class AIService {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'openai';
    this._openaiClient = null;
    this._anthropicClient = null;
    this._axios = null;
    this.model = '';
    this.qwenApiKey = '';

    // 根据环境变量初始化默认配置（不创建客户端）
    switch (this.provider) {
      case 'openai':
        this.model = process.env.OPENAI_MODEL || 'gpt-4';
        break;
      case 'anthropic':
        this.model = process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';
        break;
      case 'qwen':
        this.model = process.env.QWEN_MODEL || 'qwen-max';
        this.qwenApiKey = process.env.QWEN_API_KEY || '';
        break;
    }
  }

  // 懒加载 openai
  _getOpenAI() {
    if (!this._openaiClient) {
      try {
        const OpenAI = require('openai');
        this._openaiClient = OpenAI;
      } catch (e) {
        throw new Error('openai 模块加载失败，请确保已安装: npm install openai');
      }
    }
    return this._openaiClient;
  }

  // 懒加载 anthropic
  _getAnthropic() {
    if (!this._anthropicClient) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        this._anthropicClient = Anthropic;
      } catch (e) {
        throw new Error('anthropic 模块加载失败，请确保已安装: npm install @anthropic-ai/sdk');
      }
    }
    return this._anthropicClient;
  }

  // 懒加载 axios
  _getAxios() {
    if (!this._axios) {
      try {
        this._axios = require('axios');
      } catch (e) {
        throw new Error('axios 模块加载失败，请确保已安装: npm install axios');
      }
    }
    return this._axios;
  }

  // 根据动态配置创建客户端
  _resolveConfig(aiConfig) {
    if (aiConfig && aiConfig.apiKey) {
      return {
        provider: aiConfig.provider || this.provider,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model || '',
        baseUrl: aiConfig.baseUrl || ''
      };
    }
    // 回退到环境变量
    return {
      provider: this.provider,
      apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || this.qwenApiKey || '',
      model: this.model,
      baseUrl: ''
    };
  }

  // 构建系统提示词，包含网页数据上下文
  buildSystemPrompt(analysis, events, weather, alarms) {
    const now = new Date();
    const currentTime = now.toLocaleString('zh-CN');

    let prompt = `你是一个智能时间管理助手，专门为用户的"时空规划调度系统"提供智能分析和建议。

当前时间：${currentTime}

## 用户数据分析：

### 事件统计
- 总事件数：${analysis.totalEvents}
- 今日事件：${analysis.todayEvents.length} 个
- 本周事件：${analysis.weekEvents.length} 个
- 本月事件：${analysis.monthEvents.length} 个
- 高优先级事件（紧急度>=80%）：${analysis.highPriorityEvents.length} 个

### 闹钟状态
- 活跃闹钟：${analysis.activeAlarms} 个
- 下次闹钟：${analysis.nextAlarm || '无'}

### 天气信息
${weather ? `当前天气：${weather.description}，温度 ${weather.temperature}°C，湿度 ${weather.humidity}%` : '天气信息未获取'}

### 时间分析
- 本周已安排时间：${analysis.weekScheduledHours.toFixed(1)} 小时
- 平均每日事件数：${analysis.avgDailyEvents.toFixed(1)} 个
- 时间冲突：${analysis.conflicts.length > 0 ? `${analysis.conflicts.length} 个冲突` : '无冲突'}

### 标签分布
${Object.entries(analysis.tagDistribution).map(([tag, count]) => `- ${tag}: ${count} 个事件`).join('\n') || '无标签事件'}

## 你的职责：
1. 根据用户的日程安排提供优化建议
2. 分析时间分配是否合理
3. 检测时间冲突并提醒用户
4. 考虑天气因素对日程的影响
5. 用友好、专业的语气与用户交流
6. 提供具体的、可操作的建议

请用中文回答用户的问题，回答要简洁、实用、有温度。`;

    return prompt;
  }

  // 构建用户消息上下文
  buildContextMessage(events, weather, alarms) {
    const todayEvents = events.filter(e => {
      const eventDate = new Date(e.start);
      const today = new Date();
      return eventDate.toDateString() === today.toDateString();
    });

    let context = `## 当前详细数据：

### 今日事件（${todayEvents.length} 个）
${todayEvents.map(e => `- ${e.name} (${new Date(e.start).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})} - ${new Date(e.end).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}) 紧急度: ${e.urgency}%${e.tag ? ` [${e.tag}]` : ''}`).join('\n') || '今天没有安排事件'}

### 近期高优先级事件
${events.filter(e => e.urgency >= 80).slice(0, 5).map(e => `- ${e.name}: ${new Date(e.start).toLocaleDateString('zh-CN')} 紧急度 ${e.urgency}%`).join('\n') || '近期无高优先级事件'}

### 天气详情
${weather ? `地区：${weather.city || ''} ${weather.district || ''}\n天气：${weather.description}\n温度：${weather.temperature}°C\n湿度：${weather.humidity}%` : '未获取天气信息'}`;

    return context;
  }

  // 聊天接口
  async chat(userMessage, analysis, events, weather, alarms, aiConfig) {
    const systemPrompt = this.buildSystemPrompt(analysis, events, weather, alarms);
    const contextMessage = this.buildContextMessage(events, weather, alarms);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextMessage },
      { role: 'user', content: userMessage }
    ];

    const config = this._resolveConfig(aiConfig);
    switch (config.provider) {
      case 'openai':
        return await this.chatOpenAI(messages, config);
      case 'anthropic':
        return await this.chatAnthropic(messages, config);
      case 'qwen':
        return await this.chatQwen(messages, config);
      default:
        throw new Error(`不支持的 AI 提供商: ${config.provider}`);
    }
  }

  async chatOpenAI(messages, config) {
    const OpenAI = this._getOpenAI();
    const apiKey = (config && config.apiKey) || process.env.OPENAI_API_KEY;
    const model = (config && config.model) || this.model;
    const baseURL = (config && config.baseUrl) || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    const openai = new OpenAI({ apiKey, baseURL });

    const completion = await openai.chat.completions.create({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      max_tokens: 1000
    });

    return completion.choices[0].message.content;
  }

  async chatAnthropic(messages, config) {
    const Anthropic = this._getAnthropic();
    const apiKey = (config && config.apiKey) || process.env.ANTHROPIC_API_KEY;
    const model = (config && config.model) || this.model;

    const anthropic = new Anthropic({ apiKey });

    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1000,
      system: systemMsg ? systemMsg.content : '',
      messages: userMsgs.map(m => ({ role: m.role, content: m.content }))
    });

    return response.content[0].text;
  }

  async chatQwen(messages, config) {
    const axios = this._getAxios();
    const apiKey = (config && config.apiKey) || this.qwenApiKey;
    const model = (config && config.model) || this.model;

    if (!apiKey) {
      throw new Error('通义千问 API Key 未配置');
    }

    const response = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      return response.data.choices[0].message.content;
    }

    throw new Error('通义千问返回格式异常: ' + JSON.stringify(response.data));
  }

  // 生成主动建议
  async generateSuggestions(analysis, events, weather, alarms, aiConfig) {
    const systemPrompt = this.buildSystemPrompt(analysis, events, weather, alarms);
    const contextMessage = this.buildContextMessage(events, weather, alarms);

    const prompt = `${contextMessage}

请根据以上数据，主动为用户提供 3-5 条实用的建议，包括：
1. 今日日程优化建议
2. 时间管理改进点
3. 需要注意的事项（如冲突、高优先级任务等）
4. 天气相关的提醒（如果有影响）

请用简洁的列表形式呈现，每条建议不超过 2 句话。`;

    const config = this._resolveConfig(aiConfig);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    switch (config.provider) {
      case 'openai':
        return await this.chatOpenAI(messages, config);
      case 'anthropic':
        return await this.chatAnthropic(messages, config);
      case 'qwen':
        return await this.chatQwen(messages, config);
      default:
        throw new Error(`不支持的 AI 提供商: ${config.provider}`);
    }
  }

  // 生成数据摘要
  async generateSummary(analysis, events, weather, alarms, aiConfig) {
    const systemPrompt = this.buildSystemPrompt(analysis, events, weather, alarms);
    const contextMessage = this.buildContextMessage(events, weather, alarms);

    const prompt = `${contextMessage}

请为用户生成一份简洁的日程摘要（200字以内），包括：
1. 今日重点事项
2. 本周忙碌程度评估
3. 需要注意的时间冲突
4. 整体时间分配评价

用友好、专业的语气，让用户快速了解自己的时间状况。`;

    const config = this._resolveConfig(aiConfig);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    switch (config.provider) {
      case 'openai':
        return await this.chatOpenAI(messages, config);
      case 'anthropic':
        return await this.chatAnthropic(messages, config);
      case 'qwen':
        return await this.chatQwen(messages, config);
      default:
        throw new Error(`不支持的 AI 提供商: ${config.provider}`);
    }
  }

  // 测试连接
  async testConnection(config) {
    try {
      const resolved = this._resolveConfig(config);
      const messages = [
        { role: 'user', content: '请回复"连接成功"四个字。' }
      ];

      let response;
      switch (resolved.provider) {
        case 'openai':
          response = await this.chatOpenAI(messages, resolved);
          break;
        case 'anthropic':
          response = await this.chatAnthropic(messages, resolved);
          break;
        case 'qwen':
          response = await this.chatQwen(messages, resolved);
          break;
        default:
          throw new Error(`不支持的 AI 提供商: ${resolved.provider}`);
      }

      return { success: true, message: response };
    } catch (error) {
      console.error('测试连接错误:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new AIService();
