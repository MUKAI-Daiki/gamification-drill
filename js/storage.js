/**
 * storage.js - LocalStorage管理モジュール
 * DBを使用せず、ブラウザのLocalStorageで問題アセット・ユーザーデータ・学習履歴を永続化します。
 */

const DEFAULT_QUESTIONS = [
  {
    id: 1,
    category: "算数",
    question: "8 × 7 の答えはどれ？",
    options: ["54", "56", "58", "64"],
    answer: 2,
    explanation: "「はちしち ごじゅうろく」だよ！"
  },
  {
    id: 2,
    category: "算数",
    question: "直角（ちょっかく）は何度のこと？",
    options: ["45度", "90度", "180度", "360度"],
    answer: 2,
    explanation: "三角定規のかどの角度のひとつが直角（90度）だね！"
  },
  {
    id: 3,
    category: "理科",
    question: "昆虫（こんちゅう）の足は何本ある？",
    options: ["4本", "6本", "8本", "10本"],
    answer: 2,
    explanation: "昆虫の足はむねから6本はえているよ！（クモは8本だから昆虫じゃないよ）"
  },
  {
    id: 4,
    category: "理科",
    question: "植物が太陽の光をあびて栄養をつくるはたらきを何という？",
    options: ["呼吸", "蒸散", "光合成", "受粉"],
    answer: 3,
    explanation: "葉っぱの中の葉緑体で光合成（こうごうせい）がおこなわれるよ！"
  },
  {
    id: 5,
    category: "国語",
    question: "「犬も歩けば＿＿＿にあたる」空らんに入る言葉は？",
    options: ["電柱", "石ころ", "棒", "猫"],
    answer: 3,
    explanation: "「犬も歩けば棒にあたる」は、何かをしようとすると災難にあうこと、または思いがけない幸運にあうことのたとえだよ！"
  }
];

const DEFAULT_PROFILE = {
  name: "ぼうけんしゃ",
  level: 1,
  exp: 0,
  expToNext: 100,
  coins: 50,
  streakDays: 1,
  lastPlayedDate: new Date().toISOString().split("T")[0],
  totalSolved: 0,
  totalCorrect: 0,
  badges: [
    { id: "first_step", name: "はじめの一歩", icon: "🌱", desc: "ドリルを1回クリアした", unlocked: false },
    { id: "perfect_score", name: "パーフェクト！", icon: "⭐", desc: "満点を取った", unlocked: false },
    { id: "streak_3", name: "3日連続マスター", icon: "🔥", desc: "3日連続で学習した", unlocked: false },
    { id: "math_master", name: "算数ファイター", icon: "⚔️", desc: "算数の問題を10問クリア", unlocked: false }
  ]
};

const StorageKeys = {
  QUESTIONS: "gamified_drill_questions_v1",
  PROFILE: "gamified_drill_profile_v1",
  HISTORY: "gamified_drill_history_v1"
};

const StorageService = {
  // --- 問題管理 ---
  getQuestions() {
    try {
      const data = localStorage.getItem(StorageKeys.QUESTIONS);
      if (!data) {
        this.saveQuestions(DEFAULT_QUESTIONS);
        return DEFAULT_QUESTIONS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error("問題読み込みエラー:", e);
      return DEFAULT_QUESTIONS;
    }
  },

  saveQuestions(questions) {
    try {
      localStorage.setItem(StorageKeys.QUESTIONS, JSON.stringify(questions));
      return true;
    } catch (e) {
      console.error("問題保存エラー:", e);
      return false;
    }
  },

  addQuestion(question) {
    const list = this.getQuestions();
    const newId = list.length > 0 ? Math.max(...list.map(q => q.id || 0)) + 1 : 1;
    question.id = newId;
    list.push(question);
    this.saveQuestions(list);
    return question;
  },

  deleteQuestion(id) {
    const list = this.getQuestions();
    const filtered = list.filter(q => q.id !== id);
    this.saveQuestions(filtered);
    return filtered;
  },

  // --- ゲーミフィケーションプロファイル ---
  getProfile() {
    try {
      const data = localStorage.getItem(StorageKeys.PROFILE);
      if (!data) {
        this.saveProfile(DEFAULT_PROFILE);
        return DEFAULT_PROFILE;
      }
      const parsed = JSON.parse(data);
      // 新しいバッジ項目等とのマージ対応
      return { ...DEFAULT_PROFILE, ...parsed };
    } catch (e) {
      console.error("プロファイル読み込みエラー:", e);
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile) {
    try {
      localStorage.setItem(StorageKeys.PROFILE, JSON.stringify(profile));
      return true;
    } catch (e) {
      console.error("プロファイル保存エラー:", e);
      return false;
    }
  },

  addRewards(earnedExp, earnedCoins) {
    const profile = this.getProfile();
    profile.exp += earnedExp;
    profile.coins += earnedCoins;

    // レベルアップ判定
    let leveledUp = false;
    while (profile.exp >= profile.expToNext) {
      profile.exp -= profile.expToNext;
      profile.level += 1;
      profile.expToNext = Math.round(profile.expToNext * 1.3);
      leveledUp = true;
    }

    this.saveProfile(profile);
    return { profile, leveledUp };
  },

  // --- 学習履歴管理 ---
  getHistory() {
    try {
      const data = localStorage.getItem(StorageKeys.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("履歴読み込みエラー:", e);
      return [];
    }
  },

  addHistory(sessionResult) {
    const history = this.getHistory();
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString("ja-JP"),
      category: sessionResult.category,
      totalCount: sessionResult.totalCount,
      correctCount: sessionResult.correctCount,
      accuracy: Math.round((sessionResult.correctCount / sessionResult.totalCount) * 100),
      earnedExp: sessionResult.earnedExp,
      earnedCoins: sessionResult.earnedCoins,
      details: sessionResult.details // 各問題の正誤
    };
    history.unshift(entry); // 最新順
    if (history.length > 100) history.pop(); // 最新100件保持
    localStorage.setItem(StorageKeys.HISTORY, JSON.stringify(history));

    // プロファイルの通算記録更新
    const profile = this.getProfile();
    profile.totalSolved += sessionResult.totalCount;
    profile.totalCorrect += sessionResult.correctCount;

    // バッジ解放チェック
    if (!profile.badges.find(b => b.id === "first_step")?.unlocked) {
      const badge = profile.badges.find(b => b.id === "first_step");
      if (badge) badge.unlocked = true;
    }
    if (sessionResult.correctCount === sessionResult.totalCount && sessionResult.totalCount >= 3) {
      const badge = profile.badges.find(b => b.id === "perfect_score");
      if (badge) badge.unlocked = true;
    }
    this.saveProfile(profile);

    return entry;
  },

  clearHistory() {
    localStorage.removeItem(StorageKeys.HISTORY);
  },

  // --- バックアップ（エクスポート / インポート） ---
  exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      questions: this.getQuestions(),
      profile: this.getProfile(),
      history: this.getHistory()
    };
  },

  importAll(jsonObj) {
    if (!jsonObj || !jsonObj.questions) {
      throw new Error("無効なバックアップデータです。");
    }
    if (Array.isArray(jsonObj.questions)) {
      this.saveQuestions(jsonObj.questions);
    }
    if (jsonObj.profile) {
      this.saveProfile(jsonObj.profile);
    }
    if (Array.isArray(jsonObj.history)) {
      localStorage.setItem(StorageKeys.HISTORY, JSON.stringify(jsonObj.history));
    }
    return true;
  },

  resetDefaults() {
    this.saveQuestions(DEFAULT_QUESTIONS);
    this.saveProfile(DEFAULT_PROFILE);
    this.clearHistory();
  }
};

window.StorageService = StorageService;
