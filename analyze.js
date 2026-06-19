const aiService = require('../server/services/aiService');
const dataAnalyzer = require('../server/services/dataAnalyzer');

module.exports = async (req, res) => {
  // 只处理 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { events, weather, alarms, userMessage, aiConfig } = req.body;

    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    const response = await aiService.chat(userMessage, analysis, events, weather, alarms, aiConfig);

    res.json({ success: true, response, analysis });
  } catch (error) {
    console.error('分析错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
