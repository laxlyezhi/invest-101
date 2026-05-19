// AI 助手 —— 前端直连 API
// 支持 Anthropic、OpenAI 及兼容 OpenAI 格式的第三方 API

window.AI = {
  async ask({ baseUrl, apiKey, model, messages, systemPrompt }) {
    if (!baseUrl) throw new Error('未配置 API Base URL');
    if (!apiKey) throw new Error('未配置 API Key');
    if (!model) throw new Error('未选择模型');

    // 判断 API 类型
    const isAnthropic = baseUrl.includes('anthropic');

    if (isAnthropic) {
      return this._askAnthropic({ baseUrl, apiKey, model, messages, systemPrompt });
    } else {
      return this._askOpenAI({ baseUrl, apiKey, model, messages, systemPrompt });
    }
  },

  async _askAnthropic({ baseUrl, apiKey, model, messages, systemPrompt }) {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('API 错误：' + txt);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '(空响应)';
  },

  async _askOpenAI({ baseUrl, apiKey, model, messages, systemPrompt }) {
    // 转换消息格式：将所有 role='assistant' 保留，确保 role 在 ['system','user','assistant'] 中
    const validMessages = messages.map(m => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content
    }));

    // OpenAI 格式：system 作为 message 插入开头
    const openaiMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...validMessages]
      : validMessages;

    const body = {
      model,
      messages: openaiMessages
    };

    console.log('[AI Request]', baseUrl, JSON.stringify(body, null, 2));

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const resText = await res.text();
    console.log('[AI Response]', res.status, resText);

    if (!res.ok) {
      throw new Error('API 错误：' + resText);
    }

    const data = JSON.parse(resText);
    return data.choices?.[0]?.message?.content || '(空响应)';
  },

  systemPrompt(currentWeek, weekTitle, dayTitle) {
    return `你是金融课程的 AI 助教，正在辅导一位**自学金融**的学生。

当前学习进度：第 ${currentWeek + 1}周《${weekTitle}》· ${dayTitle || ''}。

助教风格要求：
1. **用简单直白的大白话解释金融概念**，避免理工科术语和公式堆砌。把复杂概念拆成生活化的比喻，让非金融背景的人也能听懂。
2. **诚实**：不确定就说不确定；有争议就说明分歧。
3. **简洁**：默认不超过 300 字。除非学生明确要求详细。
4. **启发式**：优先反问引导思考，而不是直接给答案。
5. **具体**：尽量用真实公司举例（A股/港股/美股）。
6. **中文回答**。

禁止：空话、营销话术、股票推荐、"这是教育参考不构成投资建议"这种免责废话。`
  }
};
