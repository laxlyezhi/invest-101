function app() {
  return {
    weeks: window.COURSE_WEEKS,
    currentView: 'intro',
    currentWeek: 0,
    currentDay: 0,
    progress: {},      // { "wi-di": { done, quiz, reflText, reflScore, reflFeedback } }
    expandedWeeks: {},
    showAI: false,
    showSettings: false,
    aiBaseUrl: '',
    aiKey: '',
    aiModel: '',
    chat: [],
    aiInput: '',
    aiLoading: false,

    init() {
      const p = localStorage.getItem('fc2-progress');
      if (p) this.progress = JSON.parse(p);
      const pos = localStorage.getItem('fc2-pos');
      if (pos) { const [w, d] = pos.split('-').map(Number); this.currentWeek = w; this.currentDay = d; }
      this.aiBaseUrl = localStorage.getItem('ai-baseurl') || '';
      this.aiKey = localStorage.getItem('anthropic-key') || '';
      this.aiModel = localStorage.getItem('anthropic-model') || '';
      // expand current week
      this.expandedWeeks[this.currentWeek] = true;
      this.$nextTick(() => { this.mountWidgets(); this.renderKatex(); });
    },

    // ---- Navigation ----
    get currentWeekDays() { return this.weeks[this.currentWeek].days.length + (this.weeks[this.currentWeek].fieldwork ? 1 : 0); },

    showIntro() {
      this.currentView = 'intro';
      this.$nextTick(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    },

    enterCourse() {
      this.currentView = 'course';
      this.expandedWeeks[this.currentWeek] = true;
      this.$nextTick(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); this.mountWidgets(); this.renderKatex(); });
    },

    gotoDay(wi, di) {
      this.currentView = 'course';
      this.currentWeek = wi;
      this.currentDay = di;
      this.expandedWeeks[wi] = true;
      localStorage.setItem('fc2-pos', wi + '-' + di);
      this.$nextTick(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); this.mountWidgets(); this.renderKatex(); });
    },

    nextDay() {
      const w = this.weeks[this.currentWeek];
      const maxD = w.days.length + (w.fieldwork ? 1 : 0) - 1;
      if (this.currentDay < maxD) { this.gotoDay(this.currentWeek, this.currentDay + 1); }
      else if (this.currentWeek < this.weeks.length - 1) { this.gotoDay(this.currentWeek + 1, 0); }
    },

    prevDay() {
      if (this.currentDay > 0) { this.gotoDay(this.currentWeek, this.currentDay - 1); }
      else if (this.currentWeek > 0) {
        const prevW = this.weeks[this.currentWeek - 1];
        this.gotoDay(this.currentWeek - 1, prevW.days.length + (prevW.fieldwork ? 1 : 0) - 1);
      }
    },

    toggleWeek(wi) { this.expandedWeeks[wi] = !this.expandedWeeks[wi]; },

    // ---- Progress ----
    key(wi, di) { return wi + '-' + di; },

    dayProgress(wi, di) { return this.progress[this.key(wi, di)] || null; },

    markDayDone(wi, di) {
      const k = this.key(wi, di);
      if (!this.progress[k]) this.progress[k] = {};
      this.progress[k].done = true;
      this.saveProgress();
    },

    markQuiz(wi, di, qi, correct) {
      const k = this.key(wi, di);
      if (!this.progress[k]) this.progress[k] = {};
      if (!this.progress[k].quiz) this.progress[k].quiz = {};
      this.progress[k].quiz[qi] = correct;
      this.saveProgress();
    },

    isWeekDone(wi) {
      const w = this.weeks[wi];
      const total = w.days.length + (w.fieldwork ? 1 : 0);
      let done = 0;
      for (let di = 0; di < total; di++) {
        if (this.progress[this.key(wi, di)]?.done) done++;
      }
      return done === total;
    },

    get completedDays() {
      let c = 0;
      this.weeks.forEach((w, wi) => {
        const total = w.days.length + (w.fieldwork ? 1 : 0);
        for (let di = 0; di < total; di++) {
          if (this.progress[this.key(wi, di)]?.done) c++;
        }
      });
      return c;
    },

    get totalDays() {
      let t = 0;
      this.weeks.forEach(w => { t += w.days.length + (w.fieldwork ? 1 : 0); });
      return t;
    },

    get progressPct() { return this.totalDays ? (this.completedDays / this.totalDays) * 100 : 0; },

    saveProgress() { localStorage.setItem('fc2-progress', JSON.stringify(this.progress)); },

    resetProgress() {
      if (!confirm('确定要重置所有学习进度吗？')) return;
      this.progress = {};
      this.currentWeek = 0;
      this.currentDay = 0;
      localStorage.removeItem('fc2-progress');
      localStorage.removeItem('fc2-pos');
      this.showSettings = false;
    },

    // ---- Reflection ----
    getReflection(wi, di) {
      return this.progress[this.key(wi, di)]?.reflText || '';
    },

    saveReflection(wi, di, text) {
      const k = this.key(wi, di);
      if (!this.progress[k]) this.progress[k] = {};
      this.progress[k].reflText = text;
      this.saveProgress();
    },

    // ---- Exercise ----
    getExercise(wi, di) {
      return this.progress[this.key(wi, di)]?.exText || '';
    },

    saveExercise(wi, di, text) {
      const k = this.key(wi, di);
      if (!this.progress[k]) this.progress[k] = {};
      this.progress[k].exText = text;
      this.saveProgress();
    },

    async scoreExercise(wi, di, text, exercisePrompt) {
      if (!this.aiKey || !this.aiModel || !text.trim()) return;
      const k = this.key(wi, di);
      if (!this.progress[k]) this.progress[k] = {};
      this.progress[k]._exScoring = true;
      this.saveProgress();

      try {
        const weekTitle = this.weeks[wi].title;
        const dayTitle = this.weeks[wi].days[di].title;
        const resp = await window.AI.ask({
          baseUrl: this.aiBaseUrl,
          apiKey: this.aiKey,
          model: this.aiModel,
          systemPrompt: `你是金融课程的练习评分助手。学生正在学习第${wi+1}周《${weekTitle}》第${di+1}天《${dayTitle}》。

请按四维度打分（每维度 0-5 分，满分 20）：
1. **计算准确性**：数字是否算对、公式是否用对
2. **逻辑完整性**：是否有推导过程，还是只给了答案
3. **数据运用**：是否用了真实数据/年报数据，还是凭空编造
4. **深度理解**：是否理解了数字背后的含义，而不只是算出结果

输出格式：
**总分：X/20**
- 计算准确性：X/5 — 一句话点评
- 逻辑完整性：X/5 — 一句话点评
- 数据运用：X/5 — 一句话点评
- 深度理解：X/5 — 一句话点评

如果学生答案有错，给出正确答案和简要推导。简洁，不超过 300 字。`,
          messages: [
            { role: 'user', content: `练习题目：${exercisePrompt}\n\n学生的解答：${text}` }
          ]
        });
        const scoreMatch = resp.match(/总分[：:]\s*(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
        this.progress[k].exScore = score;
        this.progress[k].exFeedback = resp;
      } catch (e) {
        this.progress[k].exFeedback = '评分失败：' + e.message;
        this.progress[k].exScore = null;
      } finally {
        this.progress[k]._exScoring = false;
        this.saveProgress();
      }
    },

    async scoreReflection(wi, di, text, prompt) {
      if (!this.aiKey || !this.aiModel || !text.trim()) return;
      const k = this.key(wi, di);
      if (!this.progress[k]) this.progress[k] = {};
      this.progress[k]._scoring = true;
      this.saveProgress();

      try {
        const weekTitle = this.weeks[wi].title;
        const dayTitle = this.weeks[wi].days[di].title;
        const resp = await window.AI.ask({
          baseUrl: this.aiBaseUrl,
          apiKey: this.aiKey,
          model: this.aiModel,
          systemPrompt: `你是金融课程的反思评分助手。学生正在学习第${wi+1}周《${weekTitle}》第${di+1}天《${dayTitle}》。

请按四维度打分（每维度 0-5 分，满分 20）：
1. **理解准确性**：有没有用错概念、数据或逻辑
2. **应用自身**：是否结合了个人经验/持仓/处境，还是空谈
3. **批判性**：有没有反问、质疑、看到权衡
4. **可执行性**：是否产出了「下一步我要做什么」

输出格式：
**总分：X/20**
- 理解准确性：X/5 — 一句话点评
- 应用自身：X/5 — 一句话点评
- 批判性：X/5 — 一句话点评
- 可执行性：X/5 — 一句话点评

最后附 1-2 个追问，引导学生更深入思考。简洁，不超过 200 字。`,
          messages: [
            { role: 'user', content: `反思题目：${prompt}\n\n学生的反思：${text}` }
          ]
        });
        const scoreMatch = resp.match(/总分[：:]\s*(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
        this.progress[k].reflScore = score;
        this.progress[k].reflFeedback = resp;
      } catch (e) {
        this.progress[k].reflFeedback = '评分失败：' + e.message;
        this.progress[k].reflScore = null;
      } finally {
        this.progress[k]._scoring = false;
        this.saveProgress();
      }
    },

    // ---- Widgets ----
    mountWidgets() {
      const w = this.weeks[this.currentWeek];
      const d = w.days[this.currentDay];
      if (!d || !d.widget) return;
      const el = document.getElementById('widget-' + this.currentWeek + '-' + this.currentDay);
      if (el && !el.hasChildNodes() && window.WIDGETS[d.widget]) {
        window.WIDGETS[d.widget](el);
      }
    },

    // ---- Render ----
    renderMd(text) {
      if (!text) return '';
      // Protect math blocks from marked's _ emphasis parsing
      const mathBlocks = [];
      let protected = text.trim().replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
        mathBlocks.push(content);
        return `<!--MATH${mathBlocks.length - 1}-->`;
      });
      let html = marked.parse(protected);
      // Sanitize XSS: strip dangerous HTML/scripts from AI-generated content
      if (window.DOMPurify) {
        html = DOMPurify.sanitize(html);
      }
      // Restore math blocks
      mathBlocks.forEach((content, i) => {
        html = html.replace(`<!--MATH${i}-->`, `$$${content}$$`);
      });
      return html;
    },

    renderKatex() {
      this.$nextTick(() => {
        if (window.renderMathInElement) {
          document.querySelectorAll('.md-content').forEach(el => {
            try {
              window.renderMathInElement(el, {
                delimiters: [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false }
                ],
                throwOnError: false
              });
            } catch (e) {}
          });
        }
      });
    },

    // ---- AI Chat ----
    saveKey() {
      localStorage.setItem('ai-baseurl', this.aiBaseUrl);
      localStorage.setItem('anthropic-key', this.aiKey);
      localStorage.setItem('anthropic-model', this.aiModel);
    },

    async askAI() {
      if (!this.aiInput.trim() || this.aiLoading) return;
      if (!this.aiKey || !this.aiModel) { this.showSettings = true; return; }
      const userMsg = this.aiInput.trim();
      this.chat.push({ role: 'user', content: userMsg });
      this.aiInput = '';
      this.aiLoading = true;
      this.$nextTick(() => { const log = document.getElementById('chat-log'); if (log) log.scrollTop = log.scrollHeight; });

      try {
        const w = this.weeks[this.currentWeek];
        const d = w.days[this.currentDay];
        const weekTitle = w.title;
        const dayTitle = d ? d.title : '外部实战';
        const resp = await window.AI.ask({
          baseUrl: this.aiBaseUrl,
          apiKey: this.aiKey,
          model: this.aiModel,
          systemPrompt: window.AI.systemPrompt(this.currentWeek, weekTitle, dayTitle),
          messages: this.chat.map(m => ({ role: m.role, content: m.content }))
        });
        this.chat.push({ role: 'assistant', content: resp });
      } catch (e) {
        this.chat.push({ role: 'assistant', content: '❌ ' + e.message });
      } finally {
        this.aiLoading = false;
        this.$nextTick(() => { const log = document.getElementById('chat-log'); if (log) log.scrollTop = log.scrollHeight; });
      }
    }
  };
}
