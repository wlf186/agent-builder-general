// 监听 SSE 响应，检查后端是否发送了 thinking 和 tool_call 事件
const http = require('http');

function testChat(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: message,
      history: []
    });

    const options = {
      hostname: 'localhost',
      port: 20881,
      path: '/api/agents/test/chat/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      console.log(`\n=== 测试消息: ${message} ===`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers: ${JSON.stringify(res.headers)}`);

      let buffer = '';
      let hasThinking = false;
      let hasToolCall = false;
      let hasContent = false;

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);
              console.log(`Event: ${event.type}`);
              
              if (event.type === 'thinking') {
                hasThinking = true;
                console.log(`  Thinking: ${event.content?.substring(0, 100) || '(empty)'}`);
              } else if (event.type === 'tool_call') {
                hasToolCall = true;
                console.log(`  Tool Call: ${event.name}`, event.args);
              } else if (event.type === 'content') {
                hasContent = true;
                console.log(`  Content: ${event.content?.substring(0, 50)}...`);
              }
            } catch (e) {
              console.log(`  Parse error: ${data.substring(0, 100)}`);
            }
          }
        }
      });

      res.on('end', () => {
        console.log(`\n结果汇总:`);
        console.log(`  Thinking 事件: ${hasThinking ? '✅' : '❌'}`);
        console.log(`  Tool Call 事件: ${hasToolCall ? '✅' : '❌'}`);
        console.log(`  Content 事件: ${hasContent ? '✅' : '❌'}`);
        resolve({ hasThinking, hasToolCall, hasContent });
      });
    });

    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('AC130 SSE 响应监控');
  console.log('='.repeat(60));

  try {
    await testChat('讲一个冷笑话');
    await testChat('3294/919+213');
    await testChat('BTC的最新价格');
  } catch (e) {
    console.error('Test failed:', e);
  }

  console.log('\n测试完成');
  process.exit(0);
}

main();
