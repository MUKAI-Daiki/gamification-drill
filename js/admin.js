/**
 * admin.js - 管理画面モジュール
 * 問題アセットのCSVインポート/エクスポート、一覧閲覧、削除、バックアップ管理を行います。
 */

const AdminModule = {
  init() {
    this.renderQuestionList();
    this.setupEventListeners();
  },

  setupEventListeners() {
    // CSVインポート
    const csvFileInput = document.getElementById("csv-file-input");
    const dropZone = document.getElementById("csv-drop-zone");

    if (csvFileInput) {
      csvFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.processCsvFile(file);
      });
    }

    if (dropZone) {
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
      });
      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file) this.processCsvFile(file);
      });
      dropZone.addEventListener("click", () => {
        csvFileInput.click();
      });
    }

    // サンプルCSVダウンロード
    const sampleDownloadBtn = document.getElementById("download-sample-csv-btn");
    if (sampleDownloadBtn) {
      sampleDownloadBtn.addEventListener("click", () => this.downloadSampleCsv());
    }

    // バックアップJSONダウンロード
    const exportBackupBtn = document.getElementById("export-backup-btn");
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener("click", () => this.exportBackup());
    }

    // バックアップ復元
    const importBackupInput = document.getElementById("import-backup-input");
    if (importBackupInput) {
      importBackupInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) this.importBackup(file);
      });
    }

    // 初期化ボタン
    const resetDefaultsBtn = document.getElementById("reset-defaults-btn");
    if (resetDefaultsBtn) {
      resetDefaultsBtn.addEventListener("click", () => {
        if (confirm("問題と学習履歴、ステータスを初期状態に戻しますか？\n（現在の記録は失われます）")) {
          StorageService.resetDefaults();
          this.renderQuestionList();
          if (window.App) window.App.updateHeaderProfile();
          alert("初期状態にリセットしました。");
        }
      });
    }

    // 新規問題の手動追加フォーム
    const addQuestionForm = document.getElementById("add-question-form");
    if (addQuestionForm) {
      addQuestionForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleManualAddQuestion();
      });
    }
  },

  renderQuestionList() {
    const questions = StorageService.getQuestions();
    const countBadge = document.getElementById("admin-question-count");
    if (countBadge) countBadge.textContent = `${questions.length}問`;

    const container = document.getElementById("admin-question-table-body");
    if (!container) return;

    if (questions.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="empty-cell">登録されている問題がありません。CSVまたは下のフォームから追加してください。</td>
        </tr>
      `;
      return;
    }

    container.innerHTML = questions.map((q, idx) => `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td class="col-cat"><span class="cat-pill">${this.escapeHtml(q.category || "一般")}</span></td>
        <td class="col-q"><strong>${this.escapeHtml(q.question)}</strong></td>
        <td class="col-opts">
          <ol class="admin-opt-list">
            ${q.options.map((opt, i) => `
              <li class="${(i + 1) === Number(q.answer) ? 'correct-opt' : ''}">${this.escapeHtml(opt)}</li>
            `).join("")}
          </ol>
        </td>
        <td class="col-ans"><span class="badge-ans">選択肢 ${q.answer}</span></td>
        <td class="col-exp">${this.escapeHtml(q.explanation || "-")}</td>
        <td class="col-action">
          <button class="btn-icon-delete" onclick="AdminModule.deleteQuestion(${q.id})" title="削除">🗑️</button>
        </td>
      </tr>
    `).join("");
  },

  deleteQuestion(id) {
    if (confirm("この問題を削除してもよろしいですか？")) {
      StorageService.deleteQuestion(id);
      this.renderQuestionList();
      if (window.QuizModule) window.QuizModule.loadCategories();
    }
  },

  processCsvFile(file) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      alert("CSVファイル（.csv）を選択してください。");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = this.parseCsv(text);
        if (parsed.length === 0) {
          alert("有効な問題データが見つかりませんでした。ヘッダーやフォーマットを確認してください。");
          return;
        }

        const currentList = StorageService.getQuestions();
        const baseId = currentList.length > 0 ? Math.max(...currentList.map(q => q.id || 0)) : 0;

        const newQuestions = parsed.map((item, index) => ({
          id: baseId + index + 1,
          category: item.category || "一般",
          question: item.question,
          options: [item.option1, item.option2, item.option3, item.option4],
          answer: parseInt(item.answer, 10) || 1,
          explanation: item.explanation || ""
        }));

        const mode = confirm(`${newQuestions.length}問の問題が見つかりました。\n\n【OK】: 現在の問題に追加する\n【キャンセル】: 現在の問題をすべて置き換える`);

        const finalList = mode ? [...currentList, ...newQuestions] : newQuestions;
        StorageService.saveQuestions(finalList);

        this.renderQuestionList();
        if (window.QuizModule) window.QuizModule.loadCategories();
        alert(`インポートが完了しました！（合計 ${finalList.length} 問）`);
      } catch (err) {
        console.error("CSV処理エラー:", err);
        alert("CSVの読み込み中にエラーが発生しました: " + err.message);
      }
    };
    reader.readAsText(file, "UTF-8");
  },

  parseCsv(csvText) {
    // 簡易RFC対応CSVパース（クォートと改行対応）
    const lines = [];
    let row = [];
    let inQuotes = false;
    let currentField = "";

    const cleanText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // スキップ
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim());
        currentField = "";
      } else if (char === '\n' && !inQuotes) {
        row.push(currentField.trim());
        if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
          lines.push(row);
        }
        row = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
    if (currentField || row.length > 0) {
      row.push(currentField.trim());
      lines.push(row);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.toLowerCase().trim());
    const expected = ["question", "option1", "option2", "option3", "option4", "answer"];
    const hasRequired = expected.every(col => headers.includes(col));

    if (!hasRequired) {
      throw new Error(`必要な列名が見つかりません。\n必要列: question, option1, option2, option3, option4, answer\n検出列: ${headers.join(", ")}`);
    }

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const r = lines[i];
      if (r.length < headers.length) continue;
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = r[idx] || "";
      });
      if (rowObj.question && rowObj.option1 && rowObj.option2) {
        items.push(rowObj);
      }
    }
    return items;
  },

  downloadSampleCsv() {
    const csvContent =
      "id,category,question,option1,option2,option3,option4,answer,explanation\n" +
      "1,算数,8 × 7 の答えはどれ？,54,56,58,64,2,「はちしち ごじゅうろく」だよ！\n" +
      "2,算数,直角（ちょっかく）は何度のこと？,45度,90度,180度,360度,2,三角定規のかどの角度が直角（90度）だね！\n" +
      "3,理科,昆虫（こんちゅう）の足は何本ある？,4本,6本,8本,10本,2,昆虫の足はむねから6本はえているよ！\n" +
      "4,理科,植物が太陽の光をあびて栄養をつくるはたらきを何という？,呼吸,蒸散,光合成,受粉,3,葉っぱの中の葉緑体で光合成がおこなわれるよ！\n" +
      "5,国語,「犬も歩けば＿＿＿にあたる」空らんに入る言葉は？,電柱,石ころ,棒,猫,3,「犬も歩けば棒にあたる」だよ！\n";

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" }); // BOM付きUTF-8（Excel対応）
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "sample-questions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportBackup() {
    const data = StorageService.exportAll();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `drill-backup-${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  importBackup(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        StorageService.importAll(obj);
        this.renderQuestionList();
        if (window.App) window.App.updateHeaderProfile();
        if (window.QuizModule) window.QuizModule.loadCategories();
        alert("バックアップデータを正常に復元しました！");
      } catch (err) {
        alert("バックアップ復元エラー: " + err.message);
      }
    };
    reader.readAsText(file);
  },

  handleManualAddQuestion() {
    const catInput = document.getElementById("q-input-category");
    const qInput = document.getElementById("q-input-text");
    const opt1 = document.getElementById("q-input-opt1");
    const opt2 = document.getElementById("q-input-opt2");
    const opt3 = document.getElementById("q-input-opt3");
    const opt4 = document.getElementById("q-input-opt4");
    const ans = document.getElementById("q-input-ans");
    const exp = document.getElementById("q-input-exp");

    if (!qInput.value.trim() || !opt1.value.trim() || !opt2.value.trim()) {
      alert("問題文と選択肢1・2は必須です。");
      return;
    }

    const newQ = {
      category: catInput.value.trim() || "一般",
      question: qInput.value.trim(),
      options: [opt1.value.trim(), opt2.value.trim(), opt3.value.trim(), opt4.value.trim()],
      answer: parseInt(ans.value, 10),
      explanation: exp.value.trim()
    };

    StorageService.addQuestion(newQ);
    this.renderQuestionList();
    if (window.QuizModule) window.QuizModule.loadCategories();

    // フォームリセット
    qInput.value = "";
    opt1.value = "";
    opt2.value = "";
    opt3.value = "";
    opt4.value = "";
    exp.value = "";
    alert("問題を追加しました！");
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

window.AdminModule = AdminModule;
