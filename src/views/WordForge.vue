<script setup>
/* ============================================================
   Word Forge — 单词学习（Vue 3 SFC 迁移版）
   - 共享 i18n：useT（来自 ../i18n.js），语言切换由 AppHeader 负责
   - 共享工具：fetchJSON / lsGet / lsSet（来自 ../ok.js）
   - 共享组件：AppHeader / AppFooter
   ============================================================ */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { i18nState, useT } from '../i18n.js'
import { fetchJSON, lsGet, lsSet } from '../ok.js'
import AppHeader from '../components/AppHeader.vue'
import AppFooter from '../components/AppFooter.vue'

/* ---------- 内嵌词库（66 个常用英语单词，覆盖初/中/高三级） ---------- */
const WORDS = [
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
]

/* ---------- i18n 文案（中英双语） ---------- */
const copy = {
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
    lookup: 'Look up', lookupError: 'Lookup failed', lookupNoResult: 'No online definition found',
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
    title: '单词工坊',
    eyebrow: '单词学习',
    lead: '翻转卡片、拼写、选择——通过自我评估巩固词汇。',
    statToday: '今日', statMastered: '已掌握', statAccuracy: '正确率', statStreak: '连对', statTotal: '总练习',
    modeCard: '卡片', modeSpell: '拼写', modeChoice: '选择',
    levelAll: '全部', level1: '初级', level2: '中级', level3: '高级',
    noSpeech: '当前浏览器不支持语音合成，朗读功能已禁用。',
    flipHint: '点击卡片翻转',
    meaningLabel: '释义', translationLabel: '例句翻译',
    prev: '上一张', next: '下一张', flip: '翻转', speakWord: '朗读单词', speakExample: '朗读例句',
    lookup: '查词典', lookupError: '查询失败', lookupNoResult: '未找到在线释义',
    selfAssess: '自我评估：',
    markKnown: '认识', markFuzzy: '模糊', markUnknown: '不认识',
    spellPrompt: '请拼写对应的单词：', spellSubmit: '提交', spellPlaceholder: '输入英文单词…',
    spellCorrect: '正确！🎉', spellWrong: '再试试。', spellAnswer: '答案：', spellYourAnswer: '你的回答：',
    nextWord: '下一个单词',
    choicePrompt: '请选择对应的单词：', choiceCorrect: '答对了！🎉', choiceWrong: '答错了。', choiceAnswer: '答案：', nextQuestion: '下一题',
    empty: '没有符合该筛选的单词。', reset: '重置进度', resetConfirm: '确定要重置所有学习进度吗？'
  }
}

// useT 返回 computed ref，模板中 t('key') 自动 unwrap；脚本中用 t.value('key')
const t = useT(copy)

/* ---------- localStorage 键（统一 wf- 前缀） ---------- */
const LS_KEY = 'wf-progress'

/* ---------- 运行时状态 ---------- */
const mode = ref('card')            // card | spell | choice
const levelFilter = ref(0)          // 0 = 全部
const cardIndex = ref(0)
const speechAvailable = ref(false)
const progress = ref(loadProgress()) // 学习进度
const currentSpell = ref(null)      // 当前拼写题单词对象
const currentChoice = ref(null)     // 当前选择题单词对象
const flipped = ref(false)          // 卡片翻转状态
const spellInput = ref('')          // 拼写输入值
const spellResult = ref(null)       // { correct, target, input }
const choiceOptions = ref([])       // 选择题选项数组
const choiceResult = ref(null)      // { correct, chosen }
const lookupData = ref(null)        // 查词覆盖数据 { phonetic, pos, meaning }
const spellInputEl = ref(null)      // 拼写输入框元素引用（用于聚焦）

/* ---------- 工具函数 ---------- */
function dateStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function freshProgress() {
  return { v: 1, words: {}, streak: 0, best: 0, total: 0, correct: 0, date: dateStr(), todayWords: {} }
}

function loadProgress() {
  const raw = lsGet(LS_KEY)
  if (!raw) return freshProgress()
  try {
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return freshProgress()
    return {
      v: 1,
      words: p.words && typeof p.words === 'object' ? p.words : {},
      streak: p.streak || 0,
      best: p.best || 0,
      total: p.total || 0,
      correct: p.correct || 0,
      date: p.date || dateStr(),
      todayWords: p.todayWords && typeof p.todayWords === 'object' ? p.todayWords : {}
    }
  } catch (e) {
    return freshProgress()
  }
}

function save() {
  lsSet(LS_KEY, JSON.stringify(progress.value))
}

function ensureDate() {
  const today = dateStr()
  if (progress.value.date !== today) {
    progress.value.date = today
    progress.value.todayWords = {}
  }
}

function levelLabel(n) {
  return n === 1 ? t.value('level1') : n === 2 ? t.value('level2') : t.value('level3')
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp
  }
  return a
}

/* 从 pool 取 n 个，不足则从 fallback 补足（去重） */
function sample(pool, n, fallback) {
  const res = []
  const used = {}
  const p = pool.slice()
  while (res.length < n && p.length) {
    const i = Math.floor(Math.random() * p.length)
    const w = p.splice(i, 1)[0]
    used[w.word] = true
    res.push(w)
  }
  if (res.length < n && fallback) {
    const fb = fallback.filter(function (w) { return !used[w.word] })
    while (res.length < n && fb.length) {
      const j = Math.floor(Math.random() * fb.length)
      const w2 = fb.splice(j, 1)[0]
      used[w2.word] = true
      res.push(w2)
    }
  }
  return res
}

/* ---------- 计算属性：词库筛选 ---------- */
const filtered = computed(() =>
  levelFilter.value === 0 ? WORDS.slice() : WORDS.filter(function (w) { return w.level === levelFilter.value })
)

const isEmpty = computed(() => filtered.value.length === 0)

/* 当前卡片对象（带索引越界保护） */
const currentCard = computed(() => {
  const list = filtered.value
  if (!list.length) return null
  let idx = cardIndex.value
  if (idx >= list.length) idx = 0
  if (idx < 0) idx = list.length - 1
  return list[idx]
})

const cardCounter = computed(() => {
  const list = filtered.value
  if (!list.length) return ''
  let idx = cardIndex.value
  if (idx >= list.length) idx = 0
  if (idx < 0) idx = list.length - 1
  return (idx + 1) + ' / ' + list.length
})

/* 卡片正面字段（查词覆盖优先） */
const cardWord = computed(() => currentCard.value ? currentCard.value.word : '')
const cardPhonetic = computed(() => {
  const w = currentCard.value
  if (!w) return ''
  return lookupData.value ? lookupData.value.phonetic : w.phonetic
})
const cardPos = computed(() => {
  const w = currentCard.value
  if (!w) return ''
  return lookupData.value ? lookupData.value.pos : w.pos
})
const cardExample = computed(() => currentCard.value ? currentCard.value.example : '')
const cardLevel = computed(() => currentCard.value ? levelLabel(currentCard.value.level) : '')
const cardMeaning = computed(() => {
  const w = currentCard.value
  if (!w) return ''
  if (lookupData.value) return lookupData.value.meaning
  return i18nState.lang === 'zh' ? w.meaning : w.meaningEn
})
const cardExampleZh = computed(() => currentCard.value ? currentCard.value.exampleZh : '')

/* 当前卡片的自我评估状态（用于按钮高亮） */
const currentCardStatus = computed(() => {
  const w = currentCard.value
  if (!w) return ''
  return (progress.value.words[w.word] && progress.value.words[w.word].s) || ''
})

/* ---------- 计算属性：统计 ---------- */
const statToday = computed(() => Object.keys(progress.value.todayWords || {}).length)
const statMastered = computed(() => {
  let n = 0
  const words = progress.value.words
  for (const w in words) if (words[w].s === 'known') n++
  return n
})
const statAccuracy = computed(() =>
  progress.value.total ? Math.round(progress.value.correct / progress.value.total * 100) + '%' : '0%'
)
const statStreak = computed(() => progress.value.streak)
const statTotal = computed(() => progress.value.total)

/* ---------- 计算属性：拼写模式 ---------- */
const spellMeaning = computed(() => {
  if (!currentSpell.value) return ''
  return i18nState.lang === 'zh' ? currentSpell.value.meaning : currentSpell.value.meaningEn
})
const spellLevel = computed(() => currentSpell.value ? levelLabel(currentSpell.value.level) : '')

/* 拼写结果逐字母对比 */
const spellLetters = computed(() => {
  if (!spellResult.value) return []
  const target = spellResult.value.target
  const input = spellResult.value.input.toLowerCase()
  const tgt = target.toLowerCase()
  return target.split('').map(function (ch, i) {
    const u = input[i]
    const ok = u !== undefined && u === tgt[i]
    return { ch: ch, ok: ok }
  })
})
const spellYourAnswer = computed(() => (spellResult.value && spellResult.value.input) ? spellResult.value.input : '—')

/* ---------- 计算属性：选择模式 ---------- */
const choiceMeaning = computed(() => {
  if (!currentChoice.value) return ''
  return i18nState.lang === 'zh' ? currentChoice.value.meaning : currentChoice.value.meaningEn
})
const choiceLevel = computed(() => currentChoice.value ? levelLabel(currentChoice.value.level) : '')

/* ---------- 进度记录 ---------- */
function setStatus(word, s) {
  if (!progress.value.words[word]) progress.value.words[word] = {}
  progress.value.words[word].s = s
}

function markLearned(word) {
  if (!progress.value.words[word]) progress.value.words[word] = {}
  progress.value.words[word].l = true
}

function touchToday(word) {
  ensureDate()
  progress.value.todayWords[word] = 1
}

function recordAnswer(word, correct) {
  progress.value.total++
  if (correct) {
    progress.value.correct++
    progress.value.streak++
    if (progress.value.streak > progress.value.best) progress.value.best = progress.value.streak
    setStatus(word, 'known')
  } else {
    progress.value.streak = 0
    const cur = progress.value.words[word] && progress.value.words[word].s
    if (cur !== 'known') setStatus(word, 'fuzzy')
  }
  markLearned(word)
  touchToday(word)
  save()
}

/* ---------- 朗读（Web Speech API） ---------- */
function speak(text) {
  if (!speechAvailable.value || !text) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.9
    const voices = synth.getVoices()
    let v = null
    for (let i = 0; i < voices.length; i++) {
      if (/en[-_]US/i.test(voices[i].lang)) { v = voices[i]; break }
    }
    if (!v) {
      for (let j = 0; j < voices.length; j++) {
        if (/^en/i.test(voices[j].lang)) { v = voices[j]; break }
      }
    }
    if (v) u.voice = v
    synth.speak(u)
  } catch (e) {}
}

/* ---------- 查词（调用第三方词典 API） ---------- */
async function lookupCurrentWord() {
  const w = currentCard.value
  if (!w) return
  try {
    const data = await fetchJSON('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w.word))
    if (!Array.isArray(data) || !data.length) throw new Error('no result')
    const entry = data[0]
    let phonetic = ''
    if (entry.phonetics && entry.phonetics.length) {
      for (let i = 0; i < entry.phonetics.length; i++) {
        if (entry.phonetics[i].text) { phonetic = entry.phonetics[i].text; break }
      }
    }
    const meaning = entry.meanings && entry.meanings[0]
    if (!meaning || !meaning.definitions || !meaning.definitions.length) throw new Error('no result')
    lookupData.value = {
      phonetic: phonetic || w.phonetic,
      pos: meaning.partOfSpeech ? meaning.partOfSpeech + '.' : w.pos,
      meaning: meaning.definitions[0].definition
    }
  } catch (e) {
    alert(t.value('lookupError'))
  }
}

/* ---------- 卡片模式操作 ---------- */
function toggleFlip() {
  flipped.value = !flipped.value
}

function onFlipKeydown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggleFlip()
  }
}

function prevCard() {
  const list = filtered.value
  if (!list.length) return
  cardIndex.value = (cardIndex.value - 1 + list.length) % list.length
  flipped.value = false
  lookupData.value = null
}

function nextCard() {
  const list = filtered.value
  if (!list.length) return
  cardIndex.value = (cardIndex.value + 1) % list.length
  flipped.value = false
  lookupData.value = null
}

function speakCardWord() {
  const w = currentCard.value
  if (w) speak(w.word)
}

function speakCardExample() {
  const w = currentCard.value
  if (w) speak(w.example)
}

function markCard(status) {
  const w = currentCard.value
  if (!w) return
  setStatus(w.word, status)
  markLearned(w.word)
  touchToday(w.word)
  save()
}

/* ---------- 拼写模式操作 ---------- */
function newSpellWord() {
  const list = filtered.value
  if (!list.length) return
  let pick
  if (list.length === 1) {
    pick = list[0]
  } else {
    do {
      pick = list[Math.floor(Math.random() * list.length)]
    } while (currentSpell.value && pick.word === currentSpell.value.word)
  }
  currentSpell.value = pick
  spellInput.value = ''
  spellResult.value = null
  nextTick(function () {
    if (spellInputEl.value) spellInputEl.value.focus()
  })
}

function checkSpell() {
  if (!currentSpell.value) return
  const target = currentSpell.value.word
  const input = spellInput.value.trim()
  const correct = input.toLowerCase() === target.toLowerCase()
  recordAnswer(currentSpell.value.word, correct)
  spellResult.value = { correct: correct, target: target, input: input }
}

function speakSpellWord() {
  if (currentSpell.value) speak(currentSpell.value.word)
}

/* ---------- 选择模式操作 ---------- */
function newChoice() {
  const list = filtered.value
  if (!list.length) return
  let pick
  if (list.length === 1) {
    pick = list[0]
  } else {
    do {
      pick = list[Math.floor(Math.random() * list.length)]
    } while (currentChoice.value && pick.word === currentChoice.value.word)
  }
  currentChoice.value = pick
  const pool = list.filter(function (w) { return w.word !== pick.word })
  const distractors = sample(pool, 3, WORDS)
  choiceOptions.value = shuffle([pick].concat(distractors))
  choiceResult.value = null
}

function onChooseOption(word) {
  if (!currentChoice.value || choiceResult.value) return
  const correct = word === currentChoice.value.word
  recordAnswer(currentChoice.value.word, correct)
  choiceResult.value = { correct: correct, chosen: word }
}

/* ---------- 模式 / 难度切换 ---------- */
function setMode(m) {
  mode.value = m
  if (m === 'card') {
    flipped.value = false
    lookupData.value = null
  } else if (m === 'spell') {
    if (!currentSpell.value) newSpellWord()
  } else if (m === 'choice') {
    if (!currentChoice.value) newChoice()
  }
}

function setLevel(l) {
  levelFilter.value = l
  cardIndex.value = 0
  currentSpell.value = null
  currentChoice.value = null
  flipped.value = false
  lookupData.value = null
  if (mode.value === 'spell') newSpellWord()
  else if (mode.value === 'choice') newChoice()
}

function resetProgress() {
  if (!window.confirm(t.value('resetConfirm'))) return
  progress.value = freshProgress()
  save()
  currentSpell.value = null
  currentChoice.value = null
  cardIndex.value = 0
  flipped.value = false
  lookupData.value = null
  setMode(mode.value)
}

/* ---------- 语言切换副作用：复刻原 renderCard 行为 ---------- */
watch(function () { return i18nState.lang }, function () {
  flipped.value = false
  lookupData.value = null
})

/* ---------- 初始化 ---------- */
onMounted(function () {
  ensureDate()
  save()
  // 语音合成可用性检查
  speechAvailable.value =
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
})
</script>

<template>
  <div class="wf-app">
    <AppHeader :title="t('title')" />

    <main class="wf-shell">
      <!-- 简介 -->
      <section class="wf-intro">
        <p class="wf-eyebrow">{{ t('eyebrow') }}</p>
        <p class="wf-lead">{{ t('lead') }}</p>
      </section>

      <!-- 学习统计 -->
      <section class="wf-stats" aria-label="statistics">
        <div class="wf-stat">
          <span class="wf-stat-val">{{ statToday }}</span>
          <span class="wf-stat-label">{{ t('statToday') }}</span>
        </div>
        <div class="wf-stat">
          <span class="wf-stat-val">{{ statMastered }}</span>
          <span class="wf-stat-label">{{ t('statMastered') }}</span>
        </div>
        <div class="wf-stat">
          <span class="wf-stat-val">{{ statAccuracy }}</span>
          <span class="wf-stat-label">{{ t('statAccuracy') }}</span>
        </div>
        <div class="wf-stat">
          <span class="wf-stat-val">{{ statStreak }}</span>
          <span class="wf-stat-label">{{ t('statStreak') }}</span>
        </div>
        <div class="wf-stat">
          <span class="wf-stat-val">{{ statTotal }}</span>
          <span class="wf-stat-label">{{ t('statTotal') }}</span>
        </div>
      </section>

      <!-- 工具栏：模式切换 + 难度筛选 -->
      <section class="wf-toolbar">
        <div class="wf-tabs" role="tablist" aria-label="mode">
          <button class="wf-tab" :class="{ active: mode === 'card' }" type="button" role="tab" @click="setMode('card')">{{ t('modeCard') }}</button>
          <button class="wf-tab" :class="{ active: mode === 'spell' }" type="button" role="tab" @click="setMode('spell')">{{ t('modeSpell') }}</button>
          <button class="wf-tab" :class="{ active: mode === 'choice' }" type="button" role="tab" @click="setMode('choice')">{{ t('modeChoice') }}</button>
        </div>
        <div class="wf-levels" role="group" aria-label="level">
          <button class="wf-level" :class="{ active: levelFilter === 0 }" type="button" @click="setLevel(0)">{{ t('levelAll') }}</button>
          <button class="wf-level" :class="{ active: levelFilter === 1 }" type="button" @click="setLevel(1)">{{ t('level1') }}</button>
          <button class="wf-level" :class="{ active: levelFilter === 2 }" type="button" @click="setLevel(2)">{{ t('level2') }}</button>
          <button class="wf-level" :class="{ active: levelFilter === 3 }" type="button" @click="setLevel(3)">{{ t('level3') }}</button>
        </div>
      </section>

      <!-- 语音不可用提示 -->
      <p v-if="!speechAvailable" class="wf-notice">{{ t('noSpeech') }}</p>

      <!-- 卡片模式 -->
      <section v-if="!isEmpty" v-show="mode === 'card'" class="wf-stage">
        <div class="wf-counter">{{ cardCounter }}</div>

        <div
          class="flip-card"
          :class="{ flipped: flipped }"
          role="button"
          tabindex="0"
          aria-label="flip card"
          @click="toggleFlip"
          @keydown="onFlipKeydown"
        >
          <div class="flip-inner">
            <!-- 正面：单词 / 音标 / 词性 / 英文例句 -->
            <div class="flip-face flip-front">
              <span class="wf-level-badge">{{ cardLevel }}</span>
              <div class="wf-word">{{ cardWord }}</div>
              <div class="wf-phonetic">{{ cardPhonetic }}</div>
              <div class="wf-pos">{{ cardPos }}</div>
              <div class="wf-example">{{ cardExample }}</div>
              <div class="wf-flip-hint">{{ t('flipHint') }}</div>
            </div>
            <!-- 背面：释义 / 例句翻译 -->
            <div class="flip-face flip-back">
              <div class="wf-back-label">{{ t('meaningLabel') }}</div>
              <div class="wf-meaning">{{ cardMeaning }}</div>
              <div class="wf-back-label">{{ t('translationLabel') }}</div>
              <div class="wf-example-zh">{{ cardExampleZh }}</div>
            </div>
          </div>
        </div>

        <div class="wf-card-toolbar">
          <button class="wf-btn" type="button" @click="prevCard"><span>{{ t('prev') }}</span></button>
          <button
            class="wf-btn wf-btn-soft"
            type="button"
            :disabled="!speechAvailable"
            :class="{ 'wf-btn-disabled': !speechAvailable }"
            aria-label="speak word"
            @click="speakCardWord"
          >🔊 <span>{{ t('speakWord') }}</span></button>
          <button
            class="wf-btn wf-btn-soft"
            type="button"
            :disabled="!speechAvailable"
            :class="{ 'wf-btn-disabled': !speechAvailable }"
            aria-label="speak example"
            @click="speakCardExample"
          >🔊 <span>{{ t('speakExample') }}</span></button>
          <button class="wf-btn wf-btn-soft" type="button" aria-label="look up word" @click="lookupCurrentWord">📖 <span>{{ t('lookup') }}</span></button>
          <button class="wf-btn" type="button" @click="toggleFlip"><span>{{ t('flip') }}</span></button>
          <button class="wf-btn" type="button" @click="nextCard"><span>{{ t('next') }}</span></button>
        </div>

        <div class="wf-marks">
          <span class="wf-marks-label">{{ t('selfAssess') }}</span>
          <button class="wf-mark wf-mark-bad" :class="{ active: currentCardStatus === 'unknown' }" type="button" @click="markCard('unknown')">{{ t('markUnknown') }}</button>
          <button class="wf-mark wf-mark-warn" :class="{ active: currentCardStatus === 'fuzzy' }" type="button" @click="markCard('fuzzy')">{{ t('markFuzzy') }}</button>
          <button class="wf-mark wf-mark-good" :class="{ active: currentCardStatus === 'known' }" type="button" @click="markCard('known')">{{ t('markKnown') }}</button>
        </div>
      </section>

      <!-- 拼写模式 -->
      <section v-if="!isEmpty" v-show="mode === 'spell'" class="wf-stage">
        <div class="wf-prompt">
          <span class="wf-prompt-label">{{ t('spellPrompt') }}</span>
          <span class="wf-prompt-meaning">{{ spellMeaning }}</span>
          <span class="wf-level-badge">{{ spellLevel }}</span>
        </div>
        <form class="wf-form" autocomplete="off" @submit.prevent="checkSpell">
          <input
            ref="spellInputEl"
            v-model="spellInput"
            class="wf-input"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            :placeholder="t('spellPlaceholder')"
            :disabled="!!spellResult"
            aria-label="Enter a word"
          />
          <button class="wf-btn wf-btn-primary" type="submit" :disabled="!!spellResult">{{ t('spellSubmit') }}</button>
        </form>
        <div
          v-if="spellResult"
          class="wf-result"
          :class="spellResult.correct ? 'wf-result-good' : 'wf-result-bad'"
        >
          <div class="wf-result-msg" :class="spellResult.correct ? 'wf-msg-good' : 'wf-msg-bad'">
            {{ spellResult.correct ? t('spellCorrect') : t('spellWrong') }}
          </div>
          <div class="wf-compare">
            <span
              v-for="(lt, i) in spellLetters"
              :key="i"
              class="wf-letter"
              :class="lt.ok ? 'wf-letter-ok' : 'wf-letter-bad'"
            >{{ lt.ch }}</span>
          </div>
          <div class="wf-your-answer"><span>{{ t('spellYourAnswer') }}</span> <strong>{{ spellYourAnswer }}</strong></div>
          <div class="wf-answer-line">{{ t('spellAnswer') }} <strong>{{ spellResult.target }}</strong></div>
        </div>
        <div class="wf-card-toolbar">
          <button v-if="spellResult" class="wf-btn wf-btn-primary" type="button" @click="newSpellWord">{{ t('nextWord') }}</button>
          <button
            class="wf-btn wf-btn-soft"
            type="button"
            :disabled="!speechAvailable"
            :class="{ 'wf-btn-disabled': !speechAvailable }"
            aria-label="speak word"
            @click="speakSpellWord"
          >🔊 <span>{{ t('speakWord') }}</span></button>
        </div>
      </section>

      <!-- 选择模式 -->
      <section v-if="!isEmpty" v-show="mode === 'choice'" class="wf-stage">
        <div class="wf-prompt">
          <span class="wf-prompt-label">{{ t('choicePrompt') }}</span>
          <span class="wf-prompt-meaning">{{ choiceMeaning }}</span>
          <span class="wf-level-badge">{{ choiceLevel }}</span>
        </div>
        <div class="wf-options">
          <button
            v-for="opt in choiceOptions"
            :key="opt.word"
            class="wf-option"
            :class="{
              'wf-option-correct': choiceResult && opt.word === currentChoice.word,
              'wf-option-wrong': choiceResult && opt.word === choiceResult.chosen && !choiceResult.correct
            }"
            :disabled="!!choiceResult"
            type="button"
            @click="onChooseOption(opt.word)"
          >{{ opt.word }}</button>
        </div>
        <div
          v-if="choiceResult"
          class="wf-result"
          :class="choiceResult.correct ? 'wf-result-good' : 'wf-result-bad'"
        >
          <div class="wf-result-msg" :class="choiceResult.correct ? 'wf-msg-good' : 'wf-msg-bad'">
            {{ choiceResult.correct ? t('choiceCorrect') : t('choiceWrong') }}
          </div>
          <div v-if="!choiceResult.correct" class="wf-answer-line">{{ t('choiceAnswer') }} <strong>{{ currentChoice.word }}</strong></div>
        </div>
        <div class="wf-card-toolbar">
          <button v-if="choiceResult" class="wf-btn wf-btn-primary" type="button" @click="newChoice">{{ t('nextQuestion') }}</button>
        </div>
      </section>

      <!-- 空状态 -->
      <p v-if="isEmpty" class="wf-empty">{{ t('empty') }}</p>

      <div class="wf-reset-row">
        <button class="wf-btn wf-btn-ghost" type="button" @click="resetProgress">{{ t('reset') }}</button>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============================================================
   Word Forge — 单词学习
   温暖学习主题（color-scheme: light）。
   原 :root 变量迁移到根元素类 .wf-app，--ok-* token 映射到
   本 app 暖色主题，使 AppHeader / AppFooter 等共享组件自动套用。
   ============================================================ */
.wf-app {
  /* 暖色主题色板 */
  --bg: #fdf6ec;
  --surface: #ffffff;
  --text: #2d2417;
  --text-muted: #7a6f5c;
  --border: #e8dcc8;
  --accent: #d97706;
  --accent-2: #059669;
  --accent-soft: #fef3e2;
  --good: #059669;
  --good-bg: #ecfdf5;
  --bad: #dc2626;
  --bad-bg: #fef2f2;
  --warn: #d97706;
  --warn-bg: #fef3e2;
  --shadow: 0 8px 28px rgba(120, 80, 20, 0.08);
  --radius: 14px;
  color-scheme: light;

  background: var(--bg);
  color: var(--text);
  min-height: 100vh;

  /* 映射到 shared.css 的 --ok-* token */
  --ok-bg: var(--bg);
  --ok-panel: var(--surface);
  --ok-line: var(--border);
  --ok-text: var(--text);
  --ok-muted: var(--text-muted);
  --ok-accent: var(--accent);
  --ok-accent-soft: var(--accent-soft);
  --ok-up: var(--good);
  --ok-up-bg: var(--good-bg);
  --ok-down: var(--bad);
  --ok-down-bg: var(--bad-bg);
  --ok-footer-line: var(--border);
  --ok-footer-text: var(--text-muted);
  --ok-footer-link: var(--accent);
  --ok-topbar-line: var(--border);
}

/* ---------- 主容器 ---------- */
.wf-shell {
  width: min(760px, calc(100% - 1.5rem));
  margin: 0 auto;
  padding: 1.4rem 0 3rem;
}

.wf-intro { margin-bottom: 1.2rem; }

.wf-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--accent);
}

.wf-lead {
  margin-top: 0.4rem;
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 52ch;
}

/* ---------- 统计条 ---------- */
.wf-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.8rem 0.5rem;
  box-shadow: var(--shadow);
}

.wf-stat {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.wf-stat-val {
  font-family: "Lora", Georgia, serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}

.wf-stat-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

/* ---------- 工具栏：模式 + 难度 ---------- */
.wf-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  margin: 1.1rem 0 0.9rem;
}

.wf-tabs,
.wf-levels {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.25rem;
  gap: 0.2rem;
}

.wf-tab,
.wf-level {
  font: inherit;
  font-size: 0.8rem;
  padding: 0.4rem 0.85rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 999px;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.wf-tab:hover,
.wf-level:hover { color: var(--text); }

.wf-tab.active,
.wf-level.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* ---------- 通用提示 ---------- */
.wf-notice {
  background: var(--warn-bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 0.7rem 0.9rem;
  border-radius: var(--radius);
  font-size: 0.85rem;
}

.wf-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 2rem 1rem;
  font-size: 0.9rem;
}

/* ---------- 舞台区 ---------- */
.wf-stage { margin-top: 0.4rem; }

.wf-counter {
  text-align: center;
  font-size: 0.78rem;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  margin-bottom: 0.6rem;
  font-variant-numeric: tabular-nums;
}

/* ---------- 翻转卡片 ---------- */
.flip-card {
  perspective: 1400px;
  cursor: pointer;
}

.flip-inner {
  position: relative;
  min-height: 340px;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.flip-card.flipped .flip-inner { transform: rotateY(180deg); }

.flip-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.8rem 1.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
}

.flip-back { transform: rotateY(180deg); }

.wf-level-badge {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--border);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}

.wf-word {
  font-family: "Lora", Georgia, serif;
  font-size: clamp(2rem, 7vw, 2.9rem);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  line-height: 1.05;
}

.wf-phonetic {
  font-family: "Lora", Georgia, serif;
  font-style: italic;
  color: var(--text-muted);
  font-size: 1rem;
}

.wf-pos {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.wf-example {
  margin-top: 0.5rem;
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.5;
  max-width: 42ch;
}

.wf-flip-hint {
  margin-top: 0.6rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.wf-back-label {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  font-weight: 600;
}

.wf-meaning {
  font-family: "Lora", Georgia, serif;
  font-size: clamp(1.3rem, 4vw, 1.7rem);
  font-weight: 600;
  color: var(--accent);
  line-height: 1.3;
  max-width: 40ch;
}

.wf-example-zh {
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.5;
  max-width: 42ch;
}

/* ---------- 卡片工具栏 ---------- */
.wf-card-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 1rem;
}

.wf-btn {
  font: inherit;
  font-size: 0.85rem;
  height: 2.5rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  border-radius: 10px;
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.wf-btn:hover { border-color: var(--accent); color: var(--accent); }
.wf-btn:active { transform: translateY(1px); }

.wf-btn-soft {
  background: var(--accent-soft);
  border-color: var(--accent-soft);
  color: var(--accent);
}

.wf-btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.wf-btn-primary:hover { background: #b46305; border-color: #b46305; color: #fff; }

.wf-btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.wf-btn:disabled,
.wf-btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wf-btn:disabled:hover,
.wf-btn-disabled:hover { border-color: var(--border); color: inherit; background: var(--surface); }

/* ---------- 自我评估按钮 ---------- */
.wf-marks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.wf-marks-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.wf-mark {
  font: inherit;
  font-size: 0.82rem;
  height: 2.3rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  border-radius: 999px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.wf-mark-good:hover, .wf-mark-good.active { background: var(--good); color: #fff; border-color: var(--good); }
.wf-mark-warn:hover, .wf-mark-warn.active { background: var(--warn); color: #fff; border-color: var(--warn); }
.wf-mark-bad:hover, .wf-mark-bad.active { background: var(--bad); color: #fff; border-color: var(--bad); }

/* ---------- 拼写 / 选择模式 ---------- */
.wf-prompt {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.4rem 1.4rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  position: relative;
}

.wf-prompt-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  width: 100%;
}

.wf-prompt-meaning {
  font-family: "Lora", Georgia, serif;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--accent);
  flex: 1;
}

.wf-form {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.wf-input {
  flex: 1;
  font: inherit;
  font-size: 1.05rem;
  height: 2.8rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 10px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.wf-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* ---------- 结果区 ---------- */
.wf-result {
  margin-top: 0.9rem;
  min-height: 1px;
}

.wf-result-good { background: var(--good-bg); border-color: var(--good); }
.wf-result-bad { background: var(--bad-bg); border-color: var(--bad); }
.wf-result-good, .wf-result-bad {
  border: 1px solid;
  border-radius: var(--radius);
  padding: 0.9rem 1rem;
}

.wf-result-msg { font-weight: 700; font-size: 1rem; }
.wf-msg-good { color: var(--good); }
.wf-msg-bad { color: var(--bad); }

.wf-compare {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.6rem;
  justify-content: center;
}

.wf-letter {
  font-family: "Lora", Georgia, serif;
  font-size: 1.4rem;
  font-weight: 700;
  width: 1.7rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.wf-letter-ok { color: var(--good); border-color: var(--good); background: var(--good-bg); }
.wf-letter-bad { color: var(--bad); border-color: var(--bad); background: var(--bad-bg); }

.wf-your-answer, .wf-answer-line {
  margin-top: 0.5rem;
  font-size: 0.88rem;
  color: var(--text-muted);
}
.wf-your-answer strong, .wf-answer-line strong { color: var(--text); }

/* ---------- 选择题选项 ---------- */
.wf-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.wf-option {
  font: inherit;
  font-family: "Lora", Georgia, serif;
  font-size: 1.05rem;
  padding: 0.9rem 0.8rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  border-radius: 12px;
  text-align: center;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}

.wf-option:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.wf-option:active:not(:disabled) { transform: translateY(1px); }
.wf-option:disabled { cursor: default; }

.wf-option-correct { background: var(--good-bg); border-color: var(--good); color: var(--good); font-weight: 700; }
.wf-option-wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); font-weight: 700; }

/* ---------- 重置行 ---------- */
.wf-reset-row {
  margin-top: 2rem;
  text-align: center;
}

/* ---------- 响应式 ---------- */
@media (max-width: 720px) {
  .wf-stats { grid-template-columns: repeat(3, 1fr); gap: 0.8rem 0.5rem; }
  .wf-toolbar { flex-direction: column; align-items: stretch; }
  .wf-tabs, .wf-levels { width: 100%; justify-content: center; }
  .wf-tab, .wf-level { flex: 1; text-align: center; }
  .flip-inner { min-height: 300px; }
  .wf-options { grid-template-columns: 1fr; }
}

@media (max-width: 420px) {
  .wf-stats { grid-template-columns: repeat(2, 1fr); }
  .wf-levels { flex-wrap: wrap; }
}
</style>