/**
 * app.js - メインコントローラー
 * タブ切り替え、ステータス同期、ゲーミフィケーションスペースおよび学習履歴の描画を統括します。
 */

const App = {
  activeTab: "gamification", // "gamification" | "quiz" | "history" | "admin"

  init() {
    // 各モジュール初期化
    if (window.QuizModule) window.QuizModule.init();
    if (window.AdminModule) window.AdminModule.init();

    this.setupNavigation();
    this.updateHeaderProfile();
    this.renderGamificationSpace();
    this.renderHistoryView();
  },

  setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-tab-btn");
    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });

    // 履歴クリアボタン
    const clearHistoryBtn = document.getElementById("clear-history-btn");
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", () => {
        if (confirm("学習履歴をすべて消去しますか？（レベルやコインは保持されます）")) {
          StorageService.clearHistory();
          this.renderHistoryView();
          alert("履歴を消去しました。");
        }
      });
    }

    // 学習開始ショートカット（ゲーミフィケーション画面の「今すぐ冒険に出る」ボタン等）
    const startStudyActionBtn = document.getElementById("hero-start-drill-btn");
    if (startStudyActionBtn) {
      startStudyActionBtn.addEventListener("click", () => {
        this.switchTab("quiz");
      });
    }
  },

  switchTab(tabName) {
    this.activeTab = tabName;

    // タブボタンのアクティブ状態更新
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      if (btn.getAttribute("data-tab") === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // ビューの表示・非表示
    document.querySelectorAll(".view-section").forEach(sec => {
      sec.classList.add("hidden");
    });
    const targetSection = document.getElementById(`view-${tabName}`);
    if (targetSection) {
      targetSection.classList.remove("hidden");
    }

    // タブに応じた再描画
    if (tabName === "gamification") {
      this.renderGamificationSpace();
    } else if (tabName === "history") {
      this.renderHistoryView();
    } else if (tabName === "admin") {
      if (window.AdminModule) window.AdminModule.renderQuestionList();
    } else if (tabName === "quiz") {
      if (window.QuizModule) window.QuizModule.loadCategories();
    }
  },

  updateHeaderProfile() {
    const profile = StorageService.getProfile();

    // ユーザー名
    const nameEl = document.getElementById("header-user-name");
    if (nameEl) nameEl.textContent = profile.name;

    // レベル
    const levelEl = document.getElementById("header-level-badge");
    if (levelEl) levelEl.textContent = `Lv.${profile.level}`;

    // EXP
    const expText = document.getElementById("header-exp-text");
    const expFill = document.getElementById("header-exp-fill");
    if (expText) expText.textContent = `${profile.exp} / ${profile.expToNext} EXP`;
    if (expFill) {
      const pct = Math.min(100, Math.round((profile.exp / profile.expToNext) * 100));
      expFill.style.width = `${pct}%`;
    }

    // コイン
    const coinEl = document.getElementById("header-coins");
    if (coinEl) coinEl.textContent = profile.coins;

    // 連続学習日数
    const streakEl = document.getElementById("header-streak");
    if (streakEl) streakEl.textContent = `${profile.streakDays}日連続`;
  },

  renderGamificationSpace() {
    this.updateHeaderProfile();
    const profile = StorageService.getProfile();

    // ゲーミフィケーションダッシュボードの数値
    const statLevel = document.getElementById("game-stat-level");
    const statCoins = document.getElementById("game-stat-coins");
    const statSolved = document.getElementById("game-stat-solved");
    const statCorrectRate = document.getElementById("game-stat-rate");

    if (statLevel) statLevel.textContent = `Lv.${profile.level}`;
    if (statCoins) statCoins.textContent = profile.coins;
    if (statSolved) statSolved.textContent = `${profile.totalSolved}問`;

    const rate = profile.totalSolved > 0
      ? Math.round((profile.totalCorrect / profile.totalSolved) * 100)
      : 0;
    if (statCorrectRate) statCorrectRate.textContent = `${rate}%`;

    // バッジ一覧
    const badgesContainer = document.getElementById("game-badges-grid");
    if (badgesContainer) {
      badgesContainer.innerHTML = profile.badges.map(b => `
        <div class="badge-card ${b.unlocked ? 'unlocked' : 'locked'}">
          <div class="badge-icon">${b.icon}</div>
          <div class="badge-name">${b.name}</div>
          <div class="badge-desc">${b.desc}</div>
          <div class="badge-status">${b.unlocked ? '✨ かくとく済' : '🔒 みかいほう'}</div>
        </div>
      `).join("");
    }
  },

  renderHistoryView() {
    const history = StorageService.getHistory();
    const listContainer = document.getElementById("history-list-container");
    const emptyNotice = document.getElementById("history-empty-notice");
    const countBadge = document.getElementById("history-total-count");

    if (countBadge) countBadge.textContent = `${history.length}回`;

    if (!listContainer) return;

    if (history.length === 0) {
      if (emptyNotice) emptyNotice.classList.remove("hidden");
      listContainer.innerHTML = "";
      return;
    }

    if (emptyNotice) emptyNotice.classList.add("hidden");

    listContainer.innerHTML = history.map(item => `
      <div class="history-card">
        <div class="history-main">
          <div class="history-meta">
            <span class="cat-pill">${item.category}</span>
            <span class="history-date">${item.date}</span>
          </div>
          <div class="history-score-row">
            <span class="history-score">${item.correctCount} / ${item.totalCount} 問正解</span>
            <span class="history-accuracy-pill ${item.accuracy >= 80 ? 'pill-high' : item.accuracy >= 50 ? 'pill-mid' : 'pill-low'}">
              正答率 ${item.accuracy}%
            </span>
          </div>
        </div>
        <div class="history-rewards">
          <span class="reward-tag exp">+${item.earnedExp} EXP</span>
          <span class="reward-tag coin">+${item.earnedCoins} コイン</span>
        </div>
      </div>
    `).join("");
  }
};

window.App = App;

// DOMContentLoaded で起動
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
