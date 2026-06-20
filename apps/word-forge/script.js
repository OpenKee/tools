/* ============================================================
   Word Forge — 单词学习
   纯本地词库 + Web Speech API 朗读 + localStorage 进度追踪。
   依赖全局 window.OK（shared.js）做 i18n 与语言切换。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 内嵌词库（66 个常用英语单词，覆盖初/中/高三级） ---------- */
  var WORDS = [
    /* 初级 level 1 */
    { word: 'apple', phonetic: '/ˈæpəl/', pos: 'n.', meaning: '苹果', meaningEn: 'a round fruit with red or green skin', example: 'She ate a fresh apple after lunch.', exampleZh: '她午饭后吃了一个新鲜的苹果。', level: 1 },
    { word: 'water', phonetic: '/ˈwɔːtər/', pos: 'n.', meaning: '水', meaningEn: 'the clear liquid that we drink', example: 'Please drink more water every day.', exampleZh: '请每天多喝水。', level: 1 },
    { word: 'book', phonetic: '/bʊk/', pos: 'n.', meaning: '书', meaningEn: 'a set of printed pages bound together', example: 'I read a good book last week.', exampleZh: '我上周读了一本好书。', level: 1 },
    { word: 'friend', phonetic: '/frend/', pos: 'n.', meaning: '朋友', meaningEn: 'a person you like and know well', example: 'He is my best friend at school.', exampleZh: '他是我学校里最好的朋友。', level: 1 },
    { word: 'house', phonetic: '/haʊs/', pos: 'n.', meaning: '房子', meaningEn: 'a building for people to live in', example: 'They bought a new house last year.', exampleZh: '他们去年买了一栋新房子。', level: 1 },
    { word: 'happy', phonetic: '/ˈhæpi/', pos: 'adj.', meaning: '快乐的', meaningEn: 'feeling pleased and content', example: 'The children look very happy today.', exampleZh: '孩子们今天看起来很快乐。', level: 1 },
    { word: 'run', phonetic: '/rʌn/', pos: 'v.', meaning: '跑', meaningEn: 'to move quickly on your feet', example: 'He can run very fast on the track.', exampleZh: '他在跑道上跑得非常快。', level: 1 },
    { word: 'eat', phonetic: '/iːt/', pos: 'v.', meaning: '吃', meaningEn: 'to put food in your mouth and swallow it', example: 'We eat lunch at noon together.', exampleZh: '我们中午一起吃午饭。', level: 1 },
    { word: 'big', phonetic: '/bɪɡ/', pos: 'adj.', meaning: '大的', meaningEn: 'large in size or amount', example: 'That is a really big dog.', exampleZh: '那是一只很大的狗。', level: 1 },
    { word: 'small', phonetic: '/smɔːl/', pos: 'adj.', meaning: '小的', meaningEn: 'not big; little in size', example: 'The cat is small and quiet.', exampleZh: '这只猫又小又安静。', level: 1 },
    { word: 'red', phonetic: '/red/', pos: 'adj.', meaning: '红色的', meaningEn: 'the color of blood or fire', example: 'She wore a bright red dress.', exampleZh: '她穿了一条鲜红色的裙子。', level: 1 },
    { word: 'school', phonetic: '/skuːl/', pos: 'n.', meaning: '学校', meaningEn: 'a place where children learn', example: 'I walk to school every morning.', exampleZh: '我每天早上走路上学。', level: 1 },
    { word: 'teacher', phonetic: '/ˈtiːtʃər/', pos: 'n.', meaning: '老师', meaningEn: 'a person who teaches in a school', example: 'Our teacher is kind and patient.', exampleZh: '我们的老师既和蔼又有耐心。', level: 1 },
    { word: 'time', phonetic: '/taɪm/', pos: 'n.', meaning: '时间', meaningEn: 'what we measure in hours and minutes', example: 'Time flies when you have fun.', exampleZh: '快乐时光飞逝。', level: 1 },
    { word: 'work', phonetic: '/wɜːrk/', pos: 'v.', meaning: '工作', meaningEn: 'to do a job for money', example: 'I work in a city hospital now.', exampleZh: '我现在在一家城市医院工作。', level: 1 },
    { word: 'city', phonetic: '/ˈsɪti/', pos: 'n.', meaning: '城市', meaningEn: 'a large and important town', example: 'Beijing is a very big city.', exampleZh: '北京是一座非常大的城市。', level: 1 },
    { word: 'family', phonetic: '/ˈfæməli/', pos: 'n.', meaning: '家庭', meaningEn: 'a group of related people', example: 'My family is very close and warm.', exampleZh: '我的家庭非常亲密温暖。', level: 1 },
    { word: 'money', phonetic: '/ˈmʌni/', pos: 'n.', meaning: '钱', meaningEn: 'coins and notes used to buy things', example: 'He saved a lot of money this year.', exampleZh: '他今年存了很多钱。', level: 1 },
    { word: 'weather', phonetic: '/ˈweðər/', pos: 'n.', meaning: '天气', meaningEn: 'the condition of the sky and air', example: 'The weather is nice and sunny today.', exampleZh: '今天天气晴朗宜人。', level: 1 },
    { word: 'easy', phonetic: '/ˈiːzi/', pos: 'adj.', meaning: '容易的', meaningEn: 'not difficult to do', example: 'This question is easy for me.', exampleZh: '这个问题对我来说很容易。', level: 1 },
    { word: 'play', phonetic: '/pleɪ/', pos: 'v.', meaning: '玩', meaningEn: 'to do things for fun and enjoyment', example: 'The kids play outside after school.', exampleZh: '孩子们放学后在外面玩。', level: 1 },
    { word: 'music', phonetic: '/ˈmjuːzɪk/', pos: 'n.', meaning: '音乐', meaningEn: 'sounds arranged in a pleasant way', example: 'I love this soft music very much.', exampleZh: '我非常喜欢这首轻柔的音乐。', level: 1 },

    /* 中级 level 2 */
    { word: 'improve', phonetic: '/ɪmˈpruːv/', pos: 'v.', meaning: '改善', meaningEn: 'to make or become better', example: 'She wants to improve her English quickly.', exampleZh: '她想快速提高英语水平。', level: 2 },
    { word: 'journey', phonetic: '/ˈdʒɜːrni/', pos: 'n.', meaning: '旅程', meaningEn: 'the act of traveling from one place to another', example: 'The journey took almost three hours.', exampleZh: '这段旅程花了将近三个小时。', level: 2 },
    { word: 'courage', phonetic: '/ˈkɜːrɪdʒ/', pos: 'n.', meaning: '勇气', meaningEn: 'the ability to face fear or danger', example: 'It takes courage to speak up in public.', exampleZh: '在公众面前发声需要勇气。', level: 2 },
    { word: 'balance', phonetic: '/ˈbæləns/', pos: 'n.', meaning: '平衡', meaningEn: 'a state of being steady and even', example: 'Try to keep a work-life balance.', exampleZh: '尽量保持工作与生活的平衡。', level: 2 },
    { word: 'achieve', phonetic: '/əˈtʃiːv/', pos: 'v.', meaning: '实现', meaningEn: 'to succeed in doing something difficult', example: 'He achieved his goal through hard work.', exampleZh: '他通过努力实现了自己的目标。', level: 2 },
    { word: 'curious', phonetic: '/ˈkjʊriəs/', pos: 'adj.', meaning: '好奇的', meaningEn: 'eager to know or learn something', example: 'Children are naturally curious about the world.', exampleZh: '孩子们对世界天生充满好奇。', level: 2 },
    { word: 'decision', phonetic: '/dɪˈsɪʒən/', pos: 'n.', meaning: '决定', meaningEn: 'a choice that you make about something', example: 'It was a hard decision to make.', exampleZh: '这是一个艰难的决定。', level: 2 },
    { word: 'discover', phonetic: '/dɪˈskʌvər/', pos: 'v.', meaning: '发现', meaningEn: 'to find something for the first time', example: 'Scientists discovered a new planet.', exampleZh: '科学家发现了一颗新行星。', level: 2 },
    { word: 'experience', phonetic: '/ɪkˈspɪriəns/', pos: 'n.', meaning: '经验', meaningEn: 'knowledge gained by doing something', example: 'She has years of teaching experience.', exampleZh: '她有多年的教学经验。', level: 2 },
    { word: 'grateful', phonetic: '/ˈɡreɪtfəl/', pos: 'adj.', meaning: '感激的', meaningEn: 'feeling thankful for something', example: 'I am grateful for all your help.', exampleZh: '我很感激你所有的帮助。', level: 2 },
    { word: 'honest', phonetic: '/ˈɑːnɪst/', pos: 'adj.', meaning: '诚实的', meaningEn: 'always telling the truth', example: 'He is an honest and reliable man.', exampleZh: '他是个诚实可靠的人。', level: 2 },
    { word: 'imagine', phonetic: '/ɪˈmædʒɪn/', pos: 'v.', meaning: '想象', meaningEn: 'to form a picture in your mind', example: 'Imagine a clear blue summer sky.', exampleZh: '想象一片清澈湛蓝的夏日天空。', level: 2 },
    { word: 'knowledge', phonetic: '/ˈnɑːlɪdʒ/', pos: 'n.', meaning: '知识', meaningEn: 'what you know about a subject', example: 'Knowledge is a kind of power.', exampleZh: '知识是一种力量。', level: 2 },
    { word: 'memory', phonetic: '/ˈmeməri/', pos: 'n.', meaning: '记忆', meaningEn: 'the ability to remember things', example: 'He has a very good memory for names.', exampleZh: '他对名字的记忆力很好。', level: 2 },
    { word: 'patient', phonetic: '/ˈpeɪʃənt/', pos: 'adj.', meaning: '耐心的', meaningEn: 'able to wait calmly without anger', example: 'Be patient with the young children.', exampleZh: '对年幼的孩子要有耐心。', level: 2 },
    { word: 'protect', phonetic: '/prəˈtekt/', pos: 'v.', meaning: '保护', meaningEn: 'to keep someone or something safe', example: 'We must protect the earth for the future.', exampleZh: '我们必须为未来保护地球。', level: 2 },
    { word: 'relax', phonetic: '/rɪˈlæks/', pos: 'v.', meaning: '放松', meaningEn: 'to become calm and less tense', example: 'I like to relax on quiet weekends.', exampleZh: '我喜欢在安静的周末放松。', level: 2 },
    { word: 'success', phonetic: '/səkˈses/', pos: 'n.', meaning: '成功', meaningEn: 'achieving a goal you worked for', example: 'Hard work often leads to success.', exampleZh: '努力常常带来成功。', level: 2 },
    { word: 'travel', phonetic: '/ˈtrævəl/', pos: 'v.', meaning: '旅行', meaningEn: 'to go from one place to another', example: 'They love to travel around the world.', exampleZh: '他们热爱环游世界。', level: 2 },
    { word: 'wisdom', phonetic: '/ˈwɪzdəm/', pos: 'n.', meaning: '智慧', meaningEn: 'good judgment from knowledge and experience', example: 'His quiet words show real wisdom.', exampleZh: '他平静的话语显示出真正的智慧。', level: 2 },
    { word: 'confident', phonetic: '/ˈkɑːnfɪdənt/', pos: 'adj.', meaning: '自信的', meaningEn: 'sure of yourself and your abilities', example: 'She is confident about the coming test.', exampleZh: '她对即将到来的考试很自信。', level: 2 },
    { word: 'creative', phonetic: '/kriˈeɪtɪv/', pos: 'adj.', meaning: '有创造力的', meaningEn: 'good at making new and original things', example: 'He is a creative young artist.', exampleZh: '他是个有创造力的年轻艺术家。', level: 2 },

    /* 高级 level 3 */
    { word: 'serendipity', phonetic: '/ˌserənˈdɪpəti/', pos: 'n.', meaning: '意外发现美好事物的能力', meaningEn: 'the occurrence of events by chance in a happy way', example: 'Finding this little cafe was pure serendipity.', exampleZh: '发现这家小咖啡馆纯属意外之喜。', level: 3 },
    { word: 'ephemeral', phonetic: '/ɪˈfemərəl/', pos: 'adj.', meaning: '短暂的', meaningEn: 'lasting for a very short time', example: 'Fame on the internet can be ephemeral.', exampleZh: '网络上的名声可能是短暂的。', level: 3 },
    { word: 'ubiquitous', phonetic: '/juːˈbɪkwɪtəs/', pos: 'adj.', meaning: '无处不在的', meaningEn: 'present everywhere at the same time', example: 'Smartphones are now ubiquitous in daily life.', exampleZh: '智能手机如今在日常生活中无处不在。', level: 3 },
    { word: 'resilient', phonetic: '/rɪˈzɪliənt/', pos: 'adj.', meaning: '有韧性的', meaningEn: 'able to recover quickly from difficulty', example: 'Children are often remarkably resilient.', exampleZh: '孩子们往往有着惊人的韧性。', level: 3 },
    { word: 'meticulous', phonetic: '/məˈtɪkjələs/', pos: 'adj.', meaning: '一丝不苟的', meaningEn: 'very careful about small details', example: 'She is meticulous about every detail of her work.', exampleZh: '她对工作的每个细节都一丝不苟。', level: 3 },
    { word: 'eloquent', phonetic: '/ˈeləkwənt/', pos: 'adj.', meaning: '雄辩的', meaningEn: 'fluent and persuasive in speaking or writing', example: 'He gave an eloquent speech at the meeting.', exampleZh: '他在会上发表了一篇雄辩的演讲。', level: 3 },
    { word: 'pragmatic', phonetic: '/præɡˈmætɪk/', pos: 'adj.', meaning: '务实的', meaningEn: 'dealing with things sensibly and realistically', example: 'We need a pragmatic approach to this problem.', exampleZh: '我们需要用务实的方法处理这个问题。', level: 3 },
    { word: 'ambiguous', phonetic: '/æmˈbɪɡjuəs/', pos: 'adj.', meaning: '模棱两可的', meaningEn: 'having more than one possible meaning', example: 'His answer was vague and ambiguous.', exampleZh: '他的回答含糊而模棱两可。', level: 3 },
    { word: 'profound', phonetic: '/prəˈfaʊnd/', pos: 'adj.', meaning: '深刻的', meaningEn: 'very deep or intense in feeling or meaning', example: 'The book had a profound effect on me.', exampleZh: '这本书对我产生了深刻的影响。', level: 3 },
    { word: 'tenacious', phonetic: '/təˈneɪʃəs/', pos: 'adj.', meaning: '坚韧不拔的', meaningEn: 'keeping a firm hold; not giving up easily', example: 'She is tenacious in her studies and never quits.', exampleZh: '她学习坚韧不拔，从不放弃。', level: 3 },
    { word: 'innovate', phonetic: '/ˈɪnəveɪt/', pos: 'v.', meaning: '创新', meaningEn: 'to introduce new ideas or methods', example: 'Companies must innovate to keep growing.', exampleZh: '公司必须创新才能持续增长。', level: 3 },
    { word: 'empathy', phonetic: '/ˈempəθi/', pos: 'n.', meaning: '共情', meaningEn: 'the ability to share and understand others feelings', example: 'Empathy builds strong bonds between people.', exampleZh: '共情能在人与人之间建立牢固的纽带。', level: 3 },
    { word: 'integrity', phonetic: '/ɪnˈteɡrəti/', pos: 'n.', meaning: '正直', meaningEn: 'being honest and having strong moral principles', example: 'He is widely respected as a man of integrity.', exampleZh: '他作为正直之人广受尊敬。', level: 3 },
    { word: 'nostalgia', phonetic: '/nɑːˈstældʒə/', pos: 'n.', meaning: '怀旧', meaningEn: 'a sentimental longing for the past', example: 'The old song filled her with nostalgia.', exampleZh: '这首老歌让她满怀怀旧之情。', level: 3 },
    { word: 'paradigm', phonetic: '/ˈpærədaɪm/', pos: 'n.', meaning: '范式', meaningEn: 'a typical model or pattern of something', example: 'The new technology created a fresh paradigm.', exampleZh: '这项新技术创造了一个新范式。', level: 3 },
    { word: 'quintessential', phonetic: '/ˌkwɪntɪˈsenʃəl/', pos: 'adj.', meaning: '典型的', meaningEn: 'representing the most perfect example of something', example: 'Paris is the quintessential romantic city.', exampleZh: '巴黎是典型的浪漫之都。', level: 3 },
    { word: 'scrutinize', phonetic: '/ˈskruːtənaɪz/', pos: 'v.', meaning: '仔细审查', meaningEn: 'to examine something very carefully', example: 'The auditor scrutinized every record in detail.', exampleZh: '审计员仔细审查了每一份记录。', level: 3 },
    { word: 'versatile', phonetic: '/ˈvɜːrsətl/', pos: 'adj.', meaning: '多才多艺的', meaningEn: 'able to adapt to many different functions', example: 'She is a versatile and talented performer.', exampleZh: '她是个多才多艺、天赋出众的表演者。', level: 3 },
    { word: 'advocate', phonetic: '/ˈædvəkeɪt/', pos: 'v.', meaning: '提倡', meaningEn: 'to publicly support a cause or policy', example: 'They advocate for equal rights for everyone.', exampleZh: '他们提倡人人享有平等权利。', level: 3 },
    { word: 'benevolent', phonetic: '/bəˈnevələnt/', pos: 'adj.', meaning: '仁慈的', meaningEn: 'kind, generous, and well-meaning', example: 'The benevolent donor helped many families.', exampleZh: '那位仁慈的捐赠者帮助了许多家庭。', level: 3 },
    { word: 'candid', phonetic: '/ˈkændɪd/', pos: 'adj.', meaning: '坦诚的', meaningEn: 'honest and direct in speech', example: 'She gave a candid answer to the question.', exampleZh: '她对这个问题给出了坦诚的回答。', level: 3 },
    { word: 'diligent', phonetic: '/ˈdɪlɪdʒənt/', pos: 'adj.', meaning: '勤奋的', meaningEn: 'showing care and steady effort in work', example: 'He is a diligent and disciplined student.', exampleZh: '他是个勤奋自律的学生。', level: 3 }
  ];

  /* ---------- i18n 文案（中英双语） ---------- */
  var copy = {
    en: {
      back: '← OpenKee Tools',
      title: 'Word Forge',
      eyebrow: 'Vocabulary trainer',
      lead: 'Flip cards, spell, and choose — build your vocabulary with self-assessment.',
      statToday: 'Today', statMastered: 'Mastered', statAccuracy: 'Accuracy', statStreak: 'Streak', statTotal: 'Total',
      modeCard: 'Cards', modeSpell: 'Spell', modeChoice: 'Choice',
      levelAll: 'All', level1: 'Beginner', level2: 'Intermediate', level3: 'Advanced',
      noSpeech: 'Speech synthesis is not available in this browser. Reading aloud is disabled.',
      flipHint: 'Tap card to flip',
      meaningLabel: 'Meaning', translationLabel: 'Translation',
      prev: 'Prev', next: 'Next', flip: 'Flip', speakWord: 'Word', speakExample: 'Example',
      selfAssess: 'Self-assess:',
      markKnown: 'Known', markFuzzy: 'Fuzzy', markUnknown: 'Unknown',
      spellPrompt: 'Spell the word for:', spellSubmit: 'Check', spellPlaceholder: 'Type the word…',
      spellCorrect: 'Correct! 🎉', spellWrong: 'Not quite.', spellAnswer: 'Answer:', spellYourAnswer: 'Your answer:',
      nextWord: 'Next word',
      choicePrompt: 'Choose the word for:', choiceCorrect: 'Correct! 🎉', choiceWrong: 'Wrong.', choiceAnswer: 'Answer:', nextQuestion: 'Next',
      empty: 'No words match this filter.', reset: 'Reset progress', resetConfirm: 'Reset all learning progress?'
    },
    zh: {
      back: '← OpenKee Tools',
      title: 'Word Forge',
      eyebrow: '单词学习',
      lead: '翻转卡片、拼写、选择——通过自我评估巩固词汇。',
      statToday: '今日', statMastered: '已掌握', statAccuracy: '正确率', statStreak: '连对', statTotal: '总练习',
      modeCard: '卡片', modeSpell: '拼写', modeChoice: '选择',
      levelAll: '全部', level1: '初级', level2: '中级', level3: '高级',
      noSpeech: '当前浏览器不支持语音合成，朗读功能已禁用。',
      flipHint: '点击卡片翻转',
      meaningLabel: '释义', translationLabel: '例句翻译',
      prev: '上一张', next: '下一张', flip: '翻转', speakWord: '朗读单词', speakExample: '朗读例句',
      selfAssess: '自我评估：',
      markKnown: '认识', markFuzzy: '模糊', markUnknown: '不认识',
      spellPrompt: '请拼写对应的单词：', spellSubmit: '提交', spellPlaceholder: '输入英文单词…',
      spellCorrect: '正确！🎉', spellWrong: '再试试。', spellAnswer: '答案：', spellYourAnswer: '你的回答：',
      nextWord: '下一个单词',
      choicePrompt: '请选择对应的单词：', choiceCorrect: '答对了！🎉', choiceWrong: '答错了。', choiceAnswer: '答案：', nextQuestion: '下一题',
      empty: '没有符合该筛选的单词。', reset: '重置进度', resetConfirm: '确定要重置所有学习进度吗？'
    }
  };

  /* ---------- localStorage 键（统一 wf- 前缀） ---------- */
  var LS_KEY = 'wf-progress';

  /* ---------- 运行时状态 ---------- */
  var lang = 'en';
  var mode = 'card';        // card | spell | choice
  var levelFilter = 0;      // 0 = 全部
  var cardIndex = 0;
  var speechAvailable = false;
  var progress = freshProgress();
  var currentSpell = null;  // 当前拼写题单词对象
  var currentChoice = null; // 当前选择题单词对象

  /* ---------- DOM 缓存（init 中赋值） ---------- */
  var dom = {};

  /* ---------- 工具函数 ---------- */
  function t(key) { return OK.t(key, copy); }

  function dateStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function freshProgress() {
    return { v: 1, words: {}, streak: 0, best: 0, total: 0, correct: 0, date: dateStr(), todayWords: {} };
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return freshProgress();
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return freshProgress();
      return {
        v: 1,
        words: p.words && typeof p.words === 'object' ? p.words : {},
        streak: p.streak || 0,
        best: p.best || 0,
        total: p.total || 0,
        correct: p.correct || 0,
        date: p.date || dateStr(),
        todayWords: p.todayWords && typeof p.todayWords === 'object' ? p.todayWords : {}
      };
    } catch (e) {
      return freshProgress();
    }
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {}
  }

  function ensureDate() {
    var today = dateStr();
    if (progress.date !== today) {
      progress.date = today;
      progress.todayWords = {};
    }
  }

  function filteredWords() {
    return levelFilter === 0 ? WORDS.slice() : WORDS.filter(function (w) { return w.level === levelFilter; });
  }

  function levelLabel(n) {
    return n === 1 ? t('level1') : n === 2 ? t('level2') : t('level3');
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* 从 pool 取 n 个，不足则从 fallback 补足（去重） */
  function sample(pool, n, fallback) {
    var res = [];
    var used = {};
    var p = pool.slice();
    while (res.length < n && p.length) {
      var i = Math.floor(Math.random() * p.length);
      var w = p.splice(i, 1)[0];
      used[w.word] = true;
      res.push(w);
    }
    if (res.length < n && fallback) {
      var fb = fallback.filter(function (w) { return !used[w.word]; });
      while (res.length < n && fb.length) {
        var j = Math.floor(Math.random() * fb.length);
        var w2 = fb.splice(j, 1)[0];
        used[w2.word] = true;
        res.push(w2);
      }
    }
    return res;
  }

  /* ---------- 进度记录 ---------- */
  function setStatus(word, s) {
    if (!progress.words[word]) progress.words[word] = {};
    progress.words[word].s = s;
  }

  function markLearned(word) {
    if (!progress.words[word]) progress.words[word] = {};
    progress.words[word].l = true;
  }

  function touchToday(word) {
    ensureDate();
    progress.todayWords[word] = 1;
  }

  function recordAnswer(word, correct) {
    progress.total++;
    if (correct) {
      progress.correct++;
      progress.streak++;
      if (progress.streak > progress.best) progress.best = progress.streak;
      setStatus(word, 'known');
    } else {
      progress.streak = 0;
      var cur = progress.words[word] && progress.words[word].s;
      if (cur !== 'known') setStatus(word, 'fuzzy');
    }
    markLearned(word);
    touchToday(word);
    save();
    renderStats();
  }

  /* ---------- 朗读（Web Speech API） ---------- */
  function speak(text) {
    if (!speechAvailable || !text) return;
    try {
      var synth = window.speechSynthesis;
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      var voices = synth.getVoices();
      var v = null;
      for (var i = 0; i < voices.length; i++) {
        if (/en[-_]US/i.test(voices[i].lang)) { v = voices[i]; break; }
      }
      if (!v) {
        for (var j = 0; j < voices.length; j++) {
          if (/^en/i.test(voices[j].lang)) { v = voices[j]; break; }
        }
      }
      if (v) u.voice = v;
      synth.speak(u);
    } catch (e) {}
  }

  /* ---------- 渲染：统计 ---------- */
  function renderStats() {
    var today = Object.keys(progress.todayWords || {}).length;
    var mastered = 0;
    Object.keys(progress.words).forEach(function (w) {
      if (progress.words[w].s === 'known') mastered++;
    });
    var acc = progress.total ? Math.round(progress.correct / progress.total * 100) : 0;
    dom.statToday.textContent = today;
    dom.statMastered.textContent = mastered;
    dom.statAccuracy.textContent = acc + '%';
    dom.statStreak.textContent = progress.streak;
    dom.statTotal.textContent = progress.total;
  }

  /* ---------- 渲染：卡片模式 ---------- */
  function renderCard() {
    var list = filteredWords();
    if (!list.length) { showEmpty(true); return; }
    showEmpty(false);
    if (cardIndex >= list.length) cardIndex = 0;
    if (cardIndex < 0) cardIndex = list.length - 1;
    var w = list[cardIndex];
    dom.cardWord.textContent = w.word;
    dom.cardPhonetic.textContent = w.phonetic;
    dom.cardPos.textContent = w.pos;
    dom.cardExample.textContent = w.example;
    dom.cardLevel.textContent = levelLabel(w.level);
    dom.cardMeaning.textContent = lang === 'zh' ? w.meaning : w.meaningEn;
    dom.cardExampleZh.textContent = w.exampleZh;
    dom.cardCounter.textContent = (cardIndex + 1) + ' / ' + list.length;
    dom.flipCard.classList.remove('flipped');
    updateMarksUI(w);
  }

  function updateMarksUI(w) {
    var s = (progress.words[w.word] && progress.words[w.word].s) || '';
    [dom.btnKnown, dom.btnFuzzy, dom.btnUnknown].forEach(function (b) { b.classList.remove('active'); });
    if (s === 'known') dom.btnKnown.classList.add('active');
    else if (s === 'fuzzy') dom.btnFuzzy.classList.add('active');
    else if (s === 'unknown') dom.btnUnknown.classList.add('active');
  }

  function markCard(status) {
    var list = filteredWords();
    var w = list[cardIndex];
    if (!w) return;
    setStatus(w.word, status);
    markLearned(w.word);
    touchToday(w.word);
    save();
    updateMarksUI(w);
    renderStats();
  }

  /* ---------- 渲染：拼写模式 ---------- */
  function newSpellWord() {
    var list = filteredWords();
    if (!list.length) { showEmpty(true); return; }
    showEmpty(false);
    var pick;
    if (list.length === 1) {
      pick = list[0];
    } else {
      do {
        pick = list[Math.floor(Math.random() * list.length)];
      } while (currentSpell && pick.word === currentSpell.word);
    }
    currentSpell = pick;
    renderSpellPrompt();
    dom.spellInput.value = '';
    dom.spellInput.disabled = false;
    dom.spellResult.innerHTML = '';
    dom.spellResult.className = 'wf-result';
    dom.btnSpellNext.classList.add('wf-hidden');
    dom.btnSpellCheck.disabled = false;
    dom.spellInput.focus();
  }

  function renderSpellPrompt() {
    if (!currentSpell) return;
    dom.spellMeaning.textContent = lang === 'zh' ? currentSpell.meaning : currentSpell.meaningEn;
    dom.spellLevel.textContent = levelLabel(currentSpell.level);
    dom.spellInput.placeholder = t('spellPlaceholder');
  }

  function checkSpell(e) {
    e.preventDefault();
    if (!currentSpell) return;
    var target = currentSpell.word;
    var input = dom.spellInput.value.trim();
    var correct = input.toLowerCase() === target.toLowerCase();
    recordAnswer(currentSpell.word, correct);
    renderSpellResult(target, input, correct);
    dom.spellInput.disabled = true;
    dom.btnSpellCheck.disabled = true;
    dom.btnSpellNext.classList.remove('wf-hidden');
  }

  function renderSpellResult(target, input, correct) {
    var tgt = target.toLowerCase();
    var inp = input.toLowerCase();
    var letters = target.split('').map(function (ch, i) {
      var u = inp[i];
      var ok = u !== undefined && u === tgt[i];
      return '<span class="wf-letter ' + (ok ? 'wf-letter-ok' : 'wf-letter-bad') + '">' + OK.escape(ch) + '</span>';
    }).join('');
    var yourAns = input ? OK.escape(input) : '—';
    dom.spellResult.innerHTML =
      '<div class="wf-result-msg ' + (correct ? 'wf-msg-good' : 'wf-msg-bad') + '">' + (correct ? t('spellCorrect') : t('spellWrong')) + '</div>' +
      '<div class="wf-compare">' + letters + '</div>' +
      '<div class="wf-your-answer"><span>' + t('spellYourAnswer') + '</span> <strong>' + yourAns + '</strong></div>' +
      '<div class="wf-answer-line">' + t('spellAnswer') + ' <strong>' + OK.escape(target) + '</strong></div>';
    dom.spellResult.className = 'wf-result ' + (correct ? 'wf-result-good' : 'wf-result-bad');
  }

  /* ---------- 渲染：选择模式 ---------- */
  function newChoice() {
    var list = filteredWords();
    if (!list.length) { showEmpty(true); return; }
    showEmpty(false);
    var pick;
    if (list.length === 1) {
      pick = list[0];
    } else {
      do {
        pick = list[Math.floor(Math.random() * list.length)];
      } while (currentChoice && pick.word === currentChoice.word);
    }
    currentChoice = pick;
    var pool = list.filter(function (w) { return w.word !== pick.word; });
    var distractors = sample(pool, 3, WORDS);
    var opts = shuffle([pick].concat(distractors));
    renderChoicePrompt();
    dom.choiceOptions.innerHTML = opts.map(function (w) {
      return '<button class="wf-option" type="button" data-word="' + OK.escape(w.word) + '">' + OK.escape(w.word) + '</button>';
    }).join('');
    Array.prototype.forEach.call(dom.choiceOptions.querySelectorAll('.wf-option'), function (b) {
      b.addEventListener('click', onChooseOption);
    });
    dom.choiceResult.innerHTML = '';
    dom.choiceResult.className = 'wf-result';
    dom.btnChoiceNext.classList.add('wf-hidden');
  }

  function renderChoicePrompt() {
    if (!currentChoice) return;
    dom.choiceMeaning.textContent = lang === 'zh' ? currentChoice.meaning : currentChoice.meaningEn;
    dom.choiceLevel.textContent = levelLabel(currentChoice.level);
  }

  function onChooseOption(e) {
    if (!currentChoice) return;
    var chosen = e.currentTarget.dataset.word;
    var correct = chosen === currentChoice.word;
    recordAnswer(currentChoice.word, correct);
    Array.prototype.forEach.call(dom.choiceOptions.querySelectorAll('.wf-option'), function (b) {
      b.disabled = true;
      if (b.dataset.word === currentChoice.word) b.classList.add('wf-option-correct');
      else if (b.dataset.word === chosen) b.classList.add('wf-option-wrong');
    });
    if (correct) {
      dom.choiceResult.innerHTML = '<div class="wf-result-msg wf-msg-good">' + t('choiceCorrect') + '</div>';
    } else {
      dom.choiceResult.innerHTML = '<div class="wf-result-msg wf-msg-bad">' + t('choiceWrong') + '</div><div class="wf-answer-line">' + t('choiceAnswer') + ' <strong>' + OK.escape(currentChoice.word) + '</strong></div>';
    }
    dom.choiceResult.className = 'wf-result ' + (correct ? 'wf-result-good' : 'wf-result-bad');
    dom.btnChoiceNext.classList.remove('wf-hidden');
  }

  /* ---------- 模式 / 难度切换 ---------- */
  function setMode(m) {
    mode = m;
    [dom.modeCard, dom.modeSpell, dom.modeChoice].forEach(function (b) { b.classList.remove('active'); });
    var map = { card: dom.modeCard, spell: dom.modeSpell, choice: dom.modeChoice };
    map[m].classList.add('active');
    dom.cardSection.classList.toggle('wf-hidden', m !== 'card');
    dom.spellSection.classList.toggle('wf-hidden', m !== 'spell');
    dom.choiceSection.classList.toggle('wf-hidden', m !== 'choice');
    if (m === 'card') renderCard();
    else if (m === 'spell') { if (!currentSpell) newSpellWord(); else renderSpellPrompt(); }
    else if (m === 'choice') { if (!currentChoice) newChoice(); else renderChoicePrompt(); }
  }

  function setLevel(l) {
    levelFilter = l;
    [dom.levelAll, dom.level1, dom.level2, dom.level3].forEach(function (b) { b.classList.remove('active'); });
    var map = { 0: dom.levelAll, 1: dom.level1, 2: dom.level2, 3: dom.level3 };
    map[l].classList.add('active');
    cardIndex = 0;
    currentSpell = null;
    currentChoice = null;
    if (mode === 'card') renderCard();
    else if (mode === 'spell') newSpellWord();
    else if (mode === 'choice') newChoice();
  }

  function showEmpty(on) {
    dom.emptyNotice.hidden = !on;
    if (on) {
      dom.cardSection.classList.add('wf-hidden');
      dom.spellSection.classList.add('wf-hidden');
      dom.choiceSection.classList.add('wf-hidden');
    }
  }

  /* ---------- 语言切换回调 ---------- */
  function onLangToggle() {
    lang = OK.lang;
    renderStats();
    renderCard();
    renderSpellPrompt();
    renderChoicePrompt();
  }

  /* ---------- 初始化 ---------- */
  function init() {
    // 缓存 DOM
    var ids = [
      'langBtn', 'statToday', 'statMastered', 'statAccuracy', 'statStreak', 'statTotal',
      'modeCard', 'modeSpell', 'modeChoice', 'levelAll', 'level1', 'level2', 'level3',
      'noSpeechNotice', 'cardSection', 'cardCounter', 'flipCard', 'cardLevel', 'cardWord',
      'cardPhonetic', 'cardPos', 'cardExample', 'cardMeaning', 'cardExampleZh',
      'btnPrev', 'btnSpeakWord', 'btnSpeakExample', 'btnFlip', 'btnNext',
      'btnKnown', 'btnFuzzy', 'btnUnknown',
      'spellSection', 'spellMeaning', 'spellLevel', 'spellForm', 'spellInput',
      'btnSpellCheck', 'spellResult', 'btnSpellNext', 'btnSpellSpeak',
      'choiceSection', 'choiceMeaning', 'choiceLevel', 'choiceOptions', 'choiceResult', 'btnChoiceNext',
      'emptyNotice', 'resetBtn'
    ];
    ids.forEach(function (id) { dom[id] = document.getElementById(id); });

    lang = OK.lang;
    progress = loadProgress();
    ensureDate();
    save();

    // 语音合成可用性检查
    speechAvailable = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
    if (!speechAvailable) {
      dom.noSpeechNotice.hidden = false;
      [dom.btnSpeakWord, dom.btnSpeakExample, dom.btnSpellSpeak].forEach(function (b) {
        b.disabled = true;
        b.classList.add('wf-btn-disabled');
      });
    }

    // i18n 初始化 + 语言切换
    OK.applyI18n(copy);
    OK.initLangToggle(dom.langBtn, copy, onLangToggle);

    // 事件绑定：模式
    dom.modeCard.addEventListener('click', function () { setMode('card'); });
    dom.modeSpell.addEventListener('click', function () { setMode('spell'); });
    dom.modeChoice.addEventListener('click', function () { setMode('choice'); });

    // 事件绑定：难度
    dom.levelAll.addEventListener('click', function () { setLevel(0); });
    dom.level1.addEventListener('click', function () { setLevel(1); });
    dom.level2.addEventListener('click', function () { setLevel(2); });
    dom.level3.addEventListener('click', function () { setLevel(3); });

    // 事件绑定：卡片
    dom.flipCard.addEventListener('click', function () { dom.flipCard.classList.toggle('flipped'); });
    dom.flipCard.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dom.flipCard.classList.toggle('flipped'); }
    });
    dom.btnFlip.addEventListener('click', function () { dom.flipCard.classList.toggle('flipped'); });
    dom.btnPrev.addEventListener('click', function () { cardIndex--; renderCard(); });
    dom.btnNext.addEventListener('click', function () { cardIndex++; renderCard(); });
    dom.btnSpeakWord.addEventListener('click', function () {
      var w = filteredWords()[cardIndex];
      if (w) speak(w.word);
    });
    dom.btnSpeakExample.addEventListener('click', function () {
      var w = filteredWords()[cardIndex];
      if (w) speak(w.example);
    });
    dom.btnKnown.addEventListener('click', function () { markCard('known'); });
    dom.btnFuzzy.addEventListener('click', function () { markCard('fuzzy'); });
    dom.btnUnknown.addEventListener('click', function () { markCard('unknown'); });

    // 事件绑定：拼写
    dom.spellForm.addEventListener('submit', checkSpell);
    dom.btnSpellNext.addEventListener('click', newSpellWord);
    dom.btnSpellSpeak.addEventListener('click', function () { if (currentSpell) speak(currentSpell.word); });

    // 事件绑定：选择
    dom.btnChoiceNext.addEventListener('click', newChoice);

    // 事件绑定：重置
    dom.resetBtn.addEventListener('click', function () {
      if (window.confirm(t('resetConfirm'))) {
        progress = freshProgress();
        save();
        currentSpell = null;
        currentChoice = null;
        cardIndex = 0;
        renderStats();
        setMode(mode);
      }
    });

    // 首次渲染
    renderStats();
    setMode('card');
  }

  OK.ready(init);
})();
