/* ============================================================
   Quiz Arena — 知识竞答
   数据来源：Open Trivia DB（免费公开 API，支持 CORS）
   ============================================================ */
(function () {
  'use strict';

  // ---------- 国际化文案 ----------
  var copy = {
    en: {
      eyebrow: 'Open Trivia DB · Trivia Challenge',
      title: 'Quiz Arena',
      lead: 'Pick a category and difficulty, then answer as many questions as you can.',
      category: 'Category',
      difficulty: 'Difficulty',
      amount: 'Questions',
      anyDifficulty: 'Any',
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      start: 'Start Quiz',
      loading: 'Loading questions…',
      next: 'Next →',
      resultTitle: 'Quiz Complete',
      playAgain: 'Play Again',
      fetchError: 'Failed to load questions.',
      dataSource: 'Data: Open Trivia DB',
      allProjects: 'All projects ↗',
      correct: 'Correct!',
      wrong: 'Wrong! The correct answer was: {answer}',
      scoreMessage: 'You answered {correct} out of {total} correctly.',
      excellent: 'Excellent work!',
      good: 'Good job!',
      keepPracticing: 'Keep practicing!',
      question: 'Question',
      of: 'of',
    },
    zh: {
      eyebrow: 'Open Trivia DB · 知识竞答',
      title: 'Quiz Arena',
      lead: '选择分类和难度，挑战你的知识储备。',
      category: '分类',
      difficulty: '难度',
      amount: '题目数',
      anyDifficulty: '任意',
      easy: '简单',
      medium: '中等',
      hard: '困难',
      start: '开始答题',
      loading: '加载题目中…',
      next: '下一题 →',
      resultTitle: '答题完成',
      playAgain: '再玩一次',
      fetchError: '题目加载失败。',
      dataSource: '数据：Open Trivia DB',
      allProjects: '全部项目 ↗',
      correct: '回答正确！',
      wrong: '回答错误！正确答案是：{answer}',
      scoreMessage: '你答对了 {correct} / {total} 题。',
      excellent: '太棒了！',
      good: '不错！',
      keepPracticing: '继续加油！',
      question: '第',
      of: '题，共',
    }
  };

  // ---------- API 地址 ----------
  var API_BASE = 'https://opentdb.com';

  // ---------- DOM 引用 ----------
  var langBtn, setupPanel, categorySelect, difficultySelect, amountSelect,
      startBtn, loadingRow, gamePanel, progressFill, questionCounter,
      questionMeta, questionCard, answersGrid, feedbackRow, nextBtn,
      resultPanel, resultScore, resultMessage, restartBtn, errorState;

  // ---------- 状态 ----------
  var categories = [];
  var questions = [];
  var currentIndex = 0;
  var correctCount = 0;
  var answered = false;

  // ---------- 工具 ----------
  function t(k) { return OK.t(k, copy); }

  function applyLanguage() {
    OK.applyI18n(copy);
    renderCategories();
  }

  function decodeHtml(html) {
    var txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ---------- API 调用 ----------
  function fetchJSON(path) {
    return OK.fetchJSON(API_BASE + path, { timeout: 15000 });
  }

  function loadCategories() {
    fetchJSON('/api_category.php')
      .then(function (data) {
        categories = data.trivia_categories || [];
        renderCategories();
      })
      .catch(function (err) {
        console.warn('Categories load failed:', err);
      });
  }

  function renderCategories() {
    var html = '';
    categories.forEach(function (c) {
      html += '<option value="' + c.id + '">' + OK.escape(decodeHtml(c.name)) + '</option>';
    });
    categorySelect.innerHTML = '<option value="" data-ok-i18n="anyCategory">' + (t('anyCategory') || 'Any') + '</option>' + html;
  }

  function startQuiz() {
    var category = categorySelect.value;
    var difficulty = difficultySelect.value;
    var amount = amountSelect.value;

    var params = ['amount=' + encodeURIComponent(amount)];
    if (category) params.push('category=' + encodeURIComponent(category));
    if (difficulty) params.push('difficulty=' + encodeURIComponent(difficulty));
    params.push('type=multiple');

    setupPanel.style.display = 'none';
    resultPanel.style.display = 'none';
    errorState.style.display = 'none';
    loadingRow.style.display = '';

    fetchJSON('/api.php?' + params.join('&'))
      .then(function (data) {
        loadingRow.style.display = 'none';
        if (data.response_code !== 0 || !data.results || !data.results.length) {
          errorState.style.display = '';
          setupPanel.style.display = '';
          return;
        }
        questions = data.results.map(function (q) {
          return {
            question: decodeHtml(q.question),
            correct: decodeHtml(q.correct_answer),
            answers: shuffle([decodeHtml(q.correct_answer)].concat(q.incorrect_answers.map(decodeHtml)))
          };
        });
        currentIndex = 0;
        correctCount = 0;
        gamePanel.style.display = '';
        showQuestion();
      })
      .catch(function (err) {
        loadingRow.style.display = 'none';
        errorState.style.display = '';
        setupPanel.style.display = '';
        console.warn('Quiz load failed:', err);
      });
  }

  function showQuestion() {
    answered = false;
    feedbackRow.style.display = 'none';
    nextBtn.style.display = 'none';

    var q = questions[currentIndex];
    var progress = ((currentIndex) / questions.length) * 100;
    progressFill.style.width = progress + '%';

    questionCounter.textContent = t('question') + ' ' + (currentIndex + 1) + ' / ' + questions.length;
    questionMeta.textContent = (difficultySelect.value || t('anyDifficulty')).toUpperCase();
    questionCard.textContent = q.question;

    answersGrid.innerHTML = q.answers.map(function (a, i) {
      return '<button class="answer-btn" data-idx="' + i + '" type="button">' + OK.escape(a) + '</button>';
    }).join('');

    answersGrid.querySelectorAll('.answer-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!answered) handleAnswer(parseInt(btn.dataset.idx, 10));
      });
    });
  }

  function handleAnswer(idx) {
    answered = true;
    var q = questions[currentIndex];
    var selected = q.answers[idx];
    var isCorrect = selected === q.correct;
    if (isCorrect) correctCount++;

    var buttons = answersGrid.querySelectorAll('.answer-btn');
    buttons.forEach(function (btn, i) {
      btn.disabled = true;
      var ans = q.answers[i];
      if (ans === q.correct) btn.classList.add('correct');
      else if (i === idx) btn.classList.add('wrong');
    });

    feedbackRow.style.display = '';
    feedbackRow.className = 'feedback-row ' + (isCorrect ? 'correct' : 'wrong');
    feedbackRow.textContent = isCorrect ? t('correct') : t('wrong').replace('{answer}', q.correct);

    nextBtn.style.display = '';
  }

  function nextQuestion() {
    currentIndex++;
    if (currentIndex >= questions.length) {
      showResults();
    } else {
      showQuestion();
    }
  }

  function showResults() {
    gamePanel.style.display = 'none';
    resultPanel.style.display = '';
    progressFill.style.width = '100%';
    resultScore.textContent = correctCount + ' / ' + questions.length;
    resultMessage.textContent = t('scoreMessage').replace('{correct}', correctCount).replace('{total}', questions.length);

    var msg = '';
    var ratio = correctCount / questions.length;
    if (ratio >= 0.8) msg = t('excellent');
    else if (ratio >= 0.5) msg = t('good');
    else msg = t('keepPracticing');
    resultMessage.textContent += ' ' + msg;
  }

  // ---------- 启动 ----------
  OK.ready(function () {
    langBtn = document.getElementById('langBtn');
    setupPanel = document.getElementById('setupPanel');
    categorySelect = document.getElementById('categorySelect');
    difficultySelect = document.getElementById('difficultySelect');
    amountSelect = document.getElementById('amountSelect');
    startBtn = document.getElementById('startBtn');
    loadingRow = document.getElementById('loadingRow');
    gamePanel = document.getElementById('gamePanel');
    progressFill = document.getElementById('progressFill');
    questionCounter = document.getElementById('questionCounter');
    questionMeta = document.getElementById('questionMeta');
    questionCard = document.getElementById('questionCard');
    answersGrid = document.getElementById('answersGrid');
    feedbackRow = document.getElementById('feedbackRow');
    nextBtn = document.getElementById('nextBtn');
    resultPanel = document.getElementById('resultPanel');
    resultScore = document.getElementById('resultScore');
    resultMessage = document.getElementById('resultMessage');
    restartBtn = document.getElementById('restartBtn');
    errorState = document.getElementById('errorState');

    OK.initLangToggle(langBtn, copy, applyLanguage);
    applyLanguage();
    loadCategories();

    startBtn.addEventListener('click', startQuiz);
    nextBtn.addEventListener('click', nextQuestion);
    restartBtn.addEventListener('click', function () {
      resultPanel.style.display = 'none';
      setupPanel.style.display = '';
    });
  });
})();
