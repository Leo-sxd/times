const aiService = require('../aiService');
const dataAnalyzer = require('../dataAnalyzer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { events, weather, alarms, userMessage, aiConfig } = JSON.parse(event.body || '{}');
    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    const response = await aiService.chat(userMessage, analysis, events, weather, alarms, aiConfig);
    return { statusCode: 200, body: JSON.stringify({ success: true, response, analysis }) };
  } catch (error) {
    console.error('分析错误:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
