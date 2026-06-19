const aiService = require('../server/services/aiService');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

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
};
