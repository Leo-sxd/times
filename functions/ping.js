exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      success: true, 
      message: '函数正常工作',
      timestamp: new Date().toISOString()
    })
  };
};
