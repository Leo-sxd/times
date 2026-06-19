const aiService = require('./aiService');
const dataAnalyzer = require('./dataAnalyzer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { events, weather, alarms, aiConfig } = req.body;

    const analysis = dataAnalyzer.analyzeAll(events, weather, alarms);
    const suggestions = await aiService.generateSuggestions(analysis, events, weather, alarms, aiConfig);

    res.json({ success: true, suggestions, analysis });
  } catch (error) {
    console.error('生成建议错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
