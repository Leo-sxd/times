const aiService = require('../aiService');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { provider, apiKey, model, baseUrl } = JSON.parse(event.body || '{}');
    console.log('收到测试连接请求:', { provider, model, hasApiKey: !!apiKey });

    if (!apiKey) {
      return { statusCode: 200, body: JSON.stringify({ success: false, error: 'API Key 不能为空' }) };
    }

    const testConfig = { provider, apiKey, model, baseUrl };
    const result = await aiService.testConnection(testConfig);
    console.log('测试结果:', result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error('测试连接错误:', error);
    return { statusCode: 200, body: JSON.stringify({ success: false, error: error.message || '未知错误' }) };
  }
};
