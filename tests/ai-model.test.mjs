import test from 'node:test';
import assert from 'node:assert/strict';

// 模型调用的契约：一个聊天功能能不能用，全看这一层。
// 本地 .env.local 没有密钥，所以这里用假的 fetch 覆盖，把「服务商怎么答、怎么错」都演一遍。
const cleanEnv = () => {
  for (const key of ['AI_API_URL', 'AI_API_KEY', 'AI_MODEL', 'AI_PROVIDER', 'DEEPSEEK_API_KEY', 'DASHSCOPE_API_KEY']) {
    delete process.env[key];
  }
};
cleanEnv();

const {modelConfig, aiReady, aiStatus, callModel, chatWithRole, chatWithCompanion, ModelError} = await import('../lib/ai.mjs');

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); } finally { globalThis.fetch = original; }
};

const reply = content => async () => ({ok: true, status: 200, json: async () => ({choices: [{message: {content}}]})});

test('没有密钥时 aiReady 为假，界面能拿到「缺什么」', () => {
  cleanEnv();
  assert.equal(aiReady(), false);
  assert.equal(modelConfig(), null);
  const status = aiStatus();
  assert.equal(status.ready, false);
  assert.equal(status.provider, null);
});

test('只填 DeepSeek 的 key 就能用，不用手抄接口地址和模型名', () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  const config = modelConfig();
  assert.equal(config.provider, 'deepseek');
  assert.equal(config.url, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(config.model, 'deepseek-chat');
  assert.equal(aiReady(), true);
  assert.equal(aiStatus().name, 'DeepSeek');
});

test('只填百炼的 key 也能用，走兼容模式地址', () => {
  cleanEnv();
  process.env.DASHSCOPE_API_KEY = 'sk-dash';
  const config = modelConfig();
  assert.equal(config.provider, 'dashscope');
  assert.match(config.url, /dashscope\.aliyuncs\.com\/compatible-mode/);
  assert.equal(config.model, 'qwen-plus');
});

test('AI_PROVIDER 指定谁就只用谁，两家都有 key 时也不串', () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-a';
  process.env.DASHSCOPE_API_KEY = 'sk-b';
  process.env.AI_PROVIDER = 'dashscope';
  assert.equal(modelConfig().provider, 'dashscope');
  process.env.AI_PROVIDER = 'deepseek';
  assert.equal(modelConfig().provider, 'deepseek');
});

test('显式填了 URL/KEY/MODEL 就以显式配置为准，兼容任何 OpenAI 格式服务', () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-ignored';
  process.env.AI_API_URL = 'https://api.example.com/v1/chat/completions';
  process.env.AI_API_KEY = 'custom-key';
  process.env.AI_MODEL = 'my-model';
  const config = modelConfig();
  assert.equal(config.provider, 'custom');
  assert.equal(config.url, 'https://api.example.com/v1/chat/completions');
  assert.equal(config.model, 'my-model');
  cleanEnv();
});

test('没配模型时 chatWithRole 直接抛 503，不返回假话', async () => {
  cleanEnv();
  await assert.rejects(() => chatWithRole([{role: 'user', content: '今天好累'}]), (error) => {
    assert.ok(error instanceof ModelError);
    assert.equal(error.status, 503);
    assert.match(error.message, /还没有配置模型服务/);
    return true;
  });
});

test('模型正常返回就原样交给调用方', async () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  const text = await withFetch(reply('  我听着呢。今天怎么了？  '), () => chatWithRole([{role: 'user', content: '今天好累'}]));
  assert.equal(text, '我听着呢。今天怎么了？');
});

test('401 翻成人话：密钥无效，并带上服务商名字', async () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-bad';
  const respond = async () => ({ok: false, status: 401, text: async () => JSON.stringify({error: {message: 'Authentication Fails'}})});
  await withFetch(respond, async () => {
    await assert.rejects(() => callModel([{role: 'user', content: 'hi'}]), (error) => {
      assert.match(error.message, /DeepSeek/);
      assert.match(error.message, /密钥无效/);
      assert.match(error.message, /Authentication Fails/);
      assert.equal(error.status, 502);
      return true;
    });
  });
});

test('402 / 429 分别说清是余额还是限流', async () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  for (const [status, hint] of [[402, /余额不足/], [429, /额度/]]) {
    const respond = async () => ({ok: false, status, text: async () => ''});
    await withFetch(respond, async () => {
      await assert.rejects(() => callModel([{role: 'user', content: 'hi'}]), (error) => {
        assert.match(error.message, hint, `${status} 的说明不对：${error.message}`);
        return true;
      });
    });
  }
});

test('网络不通与超时都报 504，并保留原始错误便于排查', async () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  await withFetch(async () => { throw new Error('fetch failed'); }, async () => {
    await assert.rejects(() => callModel([{role: 'user', content: 'hi'}]), (error) => {
      assert.equal(error.status, 504);
      assert.match(error.message, /网络不通/);
      assert.match(error.message, /fetch failed/);
      return true;
    });
  });
  await withFetch(async () => {
    const error = new Error('timed out');
    error.name = 'TimeoutError';
    throw error;
  }, async () => {
    await assert.rejects(() => callModel([{role: 'user', content: 'hi'}]), (error) => {
      assert.match(error.message, /请求超时/);
      return true;
    });
  });
});

test('返回内容格式不对时明确报错，不返回空串', async () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  await withFetch(async () => ({ok: true, status: 200, json: async () => ({choices: []})}), async () => {
    await assert.rejects(() => chatWithCompanion([{role: 'user', content: 'hi'}]), (error) => {
      assert.match(error.message, /格式不兼容/);
      return true;
    });
  });
  await withFetch(reply('   '), async () => {
    await assert.rejects(() => chatWithCompanion([{role: 'user', content: 'hi'}]), (error) => {
      assert.match(error.message, /没有返回内容/);
      return true;
    });
  });
});

test('发给服务商的请求带上了模型名、密钥与温度', async () => {
  cleanEnv();
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  let captured = null;
  const capture = async (url, init) => {
    captured = {url: String(url), init};
    return {ok: true, status: 200, json: async () => ({choices: [{message: {content: '嗯。'}}]})};
  };
  await withFetch(capture, () => chatWithRole([{role: 'system', content: '你是母亲'}, {role: 'user', content: '今天好累'}]));
  assert.equal(captured.url, 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(captured.init.headers.Authorization, 'Bearer sk-test');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.temperature, 0.75);
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[1].content, '今天好累');
  cleanEnv();
});
