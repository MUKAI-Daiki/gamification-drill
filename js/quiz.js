/**
 * quiz.js - クイズ学習モード
 * 4択問題の出題、正誤判定、音響演出（Web Audio API）、プログレス表示、結果発表と記録保存を行います。
 */

const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  playCorrect() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // 明るいチャイム（ド-ソ-ド）
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc1.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc1.frequency.setValueAtTime(1046.50, now + 0.3); // C6

      osc2.frequency.setValueAtTime(1046.50, now + 0.3);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.3);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn("SoundFX error", e);
    }
  },
  playWrong() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.setValueAtTime(196, now + 0.15); // G3

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn("SoundFX error", e);
    }
  },
  playLevelUp() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.3);
      });
    } catch (e) {
      console.warn("SoundFX error", e);
    }
  }
};

const QuizModule = {
  state: {
    category: "すべて",
    questions: [],
    currentIndex: 0,
    answersLog: [], // 各問の回答ログ
    isAnswered: false,
    selectedOption: null
  },

  init() {
    this.loadCategories();
    this.setupEventListeners();
  },

  setupEventListeners() {
    const startBtn = document.getElementById("quiz-start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", () => this.startQuizSession());
    }

    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.goToNextQuestion());
    }

    const restartBtn = document.getElementById("quiz-restart-btn");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => this.resetQuizToLobby());
    }
  },

  loadCategories() {
    const questions = StorageService.getQuestions();
    const categories = ["すべて", ...new Set(questions.map(q => q.category || "一般"))];
    const select = document.getElementById("quiz-category-select");
    if (!select) return;

    select.innerHTML = categories.map(cat => `
      <option value="${cat}">${cat}</option>
    `).join("");

    const totalCountSpan = document.getElementById("quiz-available-count");
    if (totalCountSpan) {
      totalCountSpan.textContent = questions.length;
    }
  },

  startQuizSession() {
    const allQuestions = StorageService.getQuestions();
    if (allQuestions.length === 0) {
      alert("問題が登録されていません。管理画面からCSVをインポートするか問題を追加してください。");
      return;
    }

    const select = document.getElementById("quiz-category-select");
    const countSelect = document.getElementById("quiz-question-count-select");
    const selectedCategory = select ? select.value : "すべて";
    const requestedCount = countSelect ? parseInt(countSelect.value, 10) : 5;

    // フィルタリング
    let pool = selectedCategory === "すべて"
      ? [...allQuestions]
      : allQuestions.filter(q => (q.category || "一般") === selectedCategory);

    if (pool.length === 0) {
      alert("選択されたカテゴリに問題がありません。");
      return;
    }

    // シャッフル
    pool = this.shuffleArray(pool);

    // 問題数制限
    const sessionQuestions = requestedCount > 0 ? pool.slice(0, requestedCount) : pool;

    this.state = {
      category: selectedCategory,
      questions: sessionQuestions,
      currentIndex: 0,
      answersLog: [],
      isAnswered: false,
      selectedOption: null
    };

    // 画面切り替え
    document.getElementById("quiz-lobby-view").classList.add("hidden");
    document.getElementById("quiz-play-view").classList.remove("hidden");
    document.getElementById("quiz-result-view").classList.add("hidden");

    this.renderCurrentQuestion();
  },

  renderCurrentQuestion() {
    const q = this.state.questions[this.state.currentIndex];
    const total = this.state.questions.length;
    const currentNum = this.state.currentIndex + 1;

    this.state.isAnswered = false;
    this.state.selectedOption = null;

    // プログレスバー
    const progressFill = document.getElementById("quiz-progress-fill");
    const progressLabel = document.getElementById("quiz-progress-label");
    const percent = Math.round((currentNum / total) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressLabel) progressLabel.textContent = `第 ${currentNum} 問 / 全 ${total} 問`;

    // カテゴリと問題文
    const catBadge = document.getElementById("quiz-q-category");
    if (catBadge) catBadge.textContent = q.category || "一般";

    const qText = document.getElementById("quiz-q-text");
    if (qText) qText.textContent = q.question;

    // 選択肢ボタン
    const optionsContainer = document.getElementById("quiz-options-container");
    if (optionsContainer) {
      optionsContainer.innerHTML = q.options.map((opt, idx) => `
        <button class="quiz-opt-btn" data-option="${idx + 1}" onclick="QuizModule.handleSelectOption(${idx + 1})">
          <span class="opt-badge">${idx + 1}</span>
          <span class="opt-label">${this.escapeHtml(opt)}</span>
        </button>
      `).join("");
    }

    // フィードバックエリア非表示
    const feedbackBox = document.getElementById("quiz-feedback-box");
    if (feedbackBox) {
      feedbackBox.classList.add("hidden");
      feedbackBox.className = "quiz-feedback-box hidden";
    }

    // 次へボタン非活性/非表示
    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) {
      nextBtn.classList.add("hidden");
      nextBtn.textContent = currentNum === total ? "結果を見る ➔" : "次の問題へ ➔";
    }
  },

  handleSelectOption(optionNum) {
    if (this.state.isAnswered) return;
    this.state.isAnswered = true;
    this.state.selectedOption = optionNum;

    const currentQ = this.state.questions[this.state.currentIndex];
    const isCorrect = Number(currentQ.answer) === Number(optionNum);

    // ログ記録
    this.state.answersLog.push({
      questionId: currentQ.id,
      questionText: currentQ.question,
      category: currentQ.category,
      options: currentQ.options,
      selectedAnswer: optionNum,
      correctAnswer: Number(currentQ.answer),
      isCorrect: isCorrect,
      explanation: currentQ.explanation
    });

    // ボタンのスタイル更新
    const optionButtons = document.querySelectorAll(".quiz-opt-btn");
    optionButtons.forEach(btn => {
      const optVal = parseInt(btn.getAttribute("data-option"), 10);
      btn.disabled = true;
      if (optVal === Number(currentQ.answer)) {
        btn.classList.add("btn-correct");
      } else if (optVal === optionNum && !isCorrect) {
        btn.classList.add("btn-wrong");
      }
    });

    // フィードバック表示＆サウンド
    const feedbackBox = document.getElementById("quiz-feedback-box");
    const feedbackIcon = document.getElementById("quiz-feedback-icon");
    const feedbackTitle = document.getElementById("quiz-feedback-title");
    const feedbackExp = document.getElementById("quiz-feedback-explanation");

    if (isCorrect) {
      SoundFX.playCorrect();
      feedbackBox.className = "quiz-feedback-box correct";
      feedbackIcon.textContent = "⭕";
      feedbackTitle.textContent = "せいかい！ すごい！";
    } else {
      SoundFX.playWrong();
      feedbackBox.className = "quiz-feedback-box wrong";
      feedbackIcon.textContent = "❌";
      feedbackTitle.textContent = "ざんねん！ おしかった！";
    }

    feedbackExp.textContent = currentQ.explanation ? `解説: ${currentQ.explanation}` : "";
    feedbackBox.classList.remove("hidden");

    // 次へボタン表示
    const nextBtn = document.getElementById("quiz-next-btn");
    if (nextBtn) {
      nextBtn.classList.remove("hidden");
      nextBtn.focus();
    }
  },

  goToNextQuestion() {
    this.state.currentIndex++;
    if (this.state.currentIndex < this.state.questions.length) {
      this.renderCurrentQuestion();
    } else {
      this.finishSession();
    }
  },

  finishSession() {
    const totalCount = this.state.questions.length;
    const correctCount = this.state.answersLog.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correctCount / totalCount) * 100);

    // 報酬計算（1問正解ごとにEXP+20、コイン+10、全問ボーナス）
    let earnedExp = correctCount * 20 + 10;
    let earnedCoins = correctCount * 10 + 5;
    if (correctCount === totalCount) {
      earnedExp += 50;
      earnedCoins += 30;
    }

    // 記録をLocalStorageに保存
    const historyEntry = StorageService.addHistory({
      category: this.state.category,
      totalCount,
      correctCount,
      earnedExp,
      earnedCoins,
      details: this.state.answersLog
    });

    // プロファイルへ報酬付与
    const { profile, leveledUp } = StorageService.addRewards(earnedExp, earnedCoins);

    // リザルト画面の描画
    this.renderResultView({
      totalCount,
      correctCount,
      accuracy,
      earnedExp,
      earnedCoins,
      leveledUp,
      profile,
      answersLog: this.state.answersLog
    });

    // ヘッダーや他のビューのステータス更新
    if (window.App) window.App.updateHeaderProfile();
  },

  renderResultView(result) {
    document.getElementById("quiz-play-view").classList.add("hidden");
    document.getElementById("quiz-result-view").classList.remove("hidden");

    const scoreBig = document.getElementById("result-score-big");
    const accuracyPill = document.getElementById("result-accuracy-pill");
    const expReward = document.getElementById("result-exp-reward");
    const coinReward = document.getElementById("result-coin-reward");
    const levelUpNotice = document.getElementById("result-levelup-banner");

    if (scoreBig) scoreBig.textContent = `${result.correctCount} / ${result.totalCount}`;
    if (accuracyPill) accuracyPill.textContent = `正答率 ${result.accuracy}%`;
    if (expReward) expReward.textContent = `+${result.earnedExp} EXP`;
    if (coinReward) coinReward.textContent = `+${result.earnedCoins} コイン`;

    if (result.leveledUp) {
      SoundFX.playLevelUp();
      if (levelUpNotice) {
        levelUpNotice.classList.remove("hidden");
        levelUpNotice.innerHTML = `🎉 <strong>レベルアップ！</strong> レベル <strong>${result.profile.level}</strong> になりました！`;
      }
    } else {
      if (levelUpNotice) levelUpNotice.classList.add("hidden");
    }

    // 復習リスト
    const reviewList = document.getElementById("result-review-list");
    if (reviewList) {
      reviewList.innerHTML = result.answersLog.map((log, idx) => `
        <div class="review-item ${log.isCorrect ? 'item-correct' : 'item-wrong'}">
          <div class="review-header">
            <span class="review-mark">${log.isCorrect ? '⭕ 正解' : '❌ 不正解'}</span>
            <span class="review-title">第 ${idx + 1} 問: ${this.escapeHtml(log.questionText)}</span>
          </div>
          <div class="review-body">
            <div>あなたの回答: <strong>${this.escapeHtml(log.options[log.selectedAnswer - 1] || "-")}</strong></div>
            ${!log.isCorrect ? `<div>正しい答え: <strong class="correct-text">${this.escapeHtml(log.options[log.correctAnswer - 1])}</strong></div>` : ''}
            ${log.explanation ? `<div class="review-exp">解説: ${this.escapeHtml(log.explanation)}</div>` : ''}
          </div>
        </div>
      `).join("");
    }
  },

  resetQuizToLobby() {
    document.getElementById("quiz-result-view").classList.add("hidden");
    document.getElementById("quiz-play-view").classList.add("hidden");
    document.getElementById("quiz-lobby-view").classList.remove("hidden");
    this.loadCategories();
  },

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

window.QuizModule = QuizModule;
