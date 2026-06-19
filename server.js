require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const aiService = require('./services/aiService');
const dataAnalyzer = require('./services/dataAnalyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 托管前端静态文件（上级目录）- 禁用缓存以确保修改立即生效
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 智能分析接口
app.post('/api/analyze', async (req, res) => {
  try {
    const { events, weather, alarms, userMessage, aiConfig } = req.body;
    
    // 收集和分析数据
    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    
    // 生成 AI 响应（传入动态配置）
    const response = await aiService.chat(userMessage, analysis, events, weather, alarms, aiConfig);
    
    res.json({
      success: true,
      response,
      analysis
    });
  } catch (error) {
    console.error('分析错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 主动建议接口
app.post('/api/suggestions', async (req, res) => {
  try {
    const { events, weather, alarms, aiConfig } = req.body;
    
    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    const suggestions = await aiService.generateSuggestions(analysis, events, weather, alarms, aiConfig);
    
    res.json({
      success: true,
      suggestions,
      analysis
    });
  } catch (error) {
    console.error('生成建议错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 数据摘要接口
app.post('/api/summary', async (req, res) => {
  try {
    const { events, weather, alarms, aiConfig } = req.body;
    
    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    const summary = await aiService.generateSummary(analysis, events, weather, alarms, aiConfig);
    
    res.json({
      success: true,
      summary,
      analysis
    });
  } catch (error) {
    console.error('生成摘要错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 测试 AI 连接接口
app.post('/api/test', async (req, res) => {
  try {
    const { provider, apiKey, model, baseUrl } = req.body;
    
    console.log('收到测试连接请求:', { provider, model, hasApiKey: !!apiKey });
    
    if (!apiKey) {
      return res.json({ success: false, error: 'API Key 不能为空' });
    }
    
    const testConfig = { provider, apiKey, model, baseUrl };
    const result = await aiService.testConnection(testConfig);
    
    console.log('测试结果:', result);
    res.json(result);
  } catch (error) {
    console.error('测试连接错误:', error);
    res.json({
      success: false,
      error: error.message || '未知错误'
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 时空规划调度系统运行在 http://localhost:${PORT}`);
  console.log(`📊 支持的 AI 提供商: ${process.env.AI_PROVIDER || 'openai'}`);
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});
