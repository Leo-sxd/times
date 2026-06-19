const aiService = require('../../aiService');
const dataAnalyzer = require('../../dataAnalyzer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { events, weather, alarms, aiConfig } = JSON.parse(event.body || '{}');
    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    const summary = await aiService.generateSummary(analysis, events, weather, alarms, aiConfig);
    return { statusCode: 200, body: JSON.stringify({ success: true, summary, analysis }) };
  } catch (error) {
    console.error('生成摘要错误:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
