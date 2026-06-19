let aiService, dataAnalyzer;
try {
  aiService = require('./aiService');
  dataAnalyzer = require('./dataAnalyzer');
} catch (e) {
  console.error('加载模块失败:', e.message);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
    }

    if (!aiService || !dataAnalyzer) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: '服务模块加载失败' }) };
    }

    const { events, weather, alarms, aiConfig } = JSON.parse(event.body || '{}');
    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    const summary = await aiService.generateSummary(analysis, events, weather, alarms, aiConfig);
    return { statusCode: 200, body: JSON.stringify({ success: true, summary, analysis }) };
  } catch (error) {
    console.error('生成摘要错误:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
