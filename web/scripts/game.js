(function () {
  const state = {
    categories: [],
    settings: null,
    teamScores: { A: 0, B: 0 },
    currentPicker: "A",
    usedQuestionIds: new Set(),
    currentQuestion: null
  };

  const refs = {
    boardGrid: document.getElementById("boardGrid"),
    teamANameLabel: document.getElementById("teamANameLabel"),
    teamBNameLabel: document.getElementById("teamBNameLabel"),
    teamAScore: document.getElementById("teamAScore"),
    teamBScore: document.getElementById("teamBScore"),
    pickerTeamA: document.getElementById("pickerTeamA"),
    pickerTeamB: document.getElementById("pickerTeamB"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    settingsDrawer: document.getElementById("settingsDrawer"),
    settingsForm: document.getElementById("settingsForm"),
    teamANameInput: document.getElementById("teamANameInput"),
    teamBNameInput: document.getElementById("teamBNameInput"),
    pointsMapInput: document.getElementById("pointsMapInput"),
    allowStealsToggle: document.getElementById("allowStealsToggle"),
    negativeScoringToggle: document.getElementById("negativeScoringToggle"),
    showSongMetaToggle: document.getElementById("showSongMetaToggle"),
    resetGameBtn: document.getElementById("resetGameBtn"),
    questionModal: document.getElementById("questionModal"),
    closeQuestionBtn: document.getElementById("closeQuestionBtn"),
    modalCategory: document.getElementById("modalCategory"),
    modalLevel: document.getElementById("modalLevel"),
    modalPoints: document.getElementById("modalPoints"),
    modalPickingTeam: document.getElementById("modalPickingTeam"),
    songMetaWrap: document.getElementById("songMetaWrap"),
    modalSongTitle: document.getElementById("modalSongTitle"),
    modalArtist: document.getElementById("modalArtist"),
    modalHostNote: document.getElementById("modalHostNote"),
    toggleAnswerBtn: document.getElementById("toggleAnswerBtn"),
    modalTargetWord: document.getElementById("modalTargetWord"),
    teamACorrectBtn: document.getElementById("teamACorrectBtn"),
    teamBCorrectBtn: document.getElementById("teamBCorrectBtn"),
    wrongPickBtn: document.getElementById("wrongPickBtn"),
    noOneBtn: document.getElementById("noOneBtn")
  };

  init().catch(function (err) {
    console.error("Initialization failed:", err);
    refs.boardGrid.innerHTML = "<p>Could not load game data. Check data files.</p>";
  });

  async function init() {
    const [questionsRes, settingsRes] = await Promise.all([
      fetch("data/questions.json"),
      fetch("data/settings.json")
    ]);

    const questionsData = await questionsRes.json();
    const settingsData = await settingsRes.json();
    state.categories = questionsData.categories || [];
    state.settings = settingsData;

    applyConfiguredPoints();
    wireEvents();
    syncSettingsInputs();
    renderAll();
  }

  function applyConfiguredPoints() {
    const pointsByLevel = state.settings.pointsByLevel || [100, 200, 300, 400, 500];
    state.categories.forEach(function (category) {
      category.questions.forEach(function (q) {
        const mapped = pointsByLevel[q.level - 1];
        q.points = Number.isFinite(mapped) ? mapped : q.points;
      });
    });
  }

  function wireEvents() {
    refs.pickerTeamA.addEventListener("click", function () {
      setPicker("A");
    });
    refs.pickerTeamB.addEventListener("click", function () {
      setPicker("B");
    });

    refs.openSettingsBtn.addEventListener("click", openSettings);
    refs.closeSettingsBtn.addEventListener("click", closeSettings);

    refs.settingsForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveSettings();
    });

    refs.resetGameBtn.addEventListener("click", function () {
      const confirmed = window.confirm("Reset scores and board tiles?");
      if (!confirmed) {
        return;
      }
      state.teamScores = { A: 0, B: 0 };
      state.usedQuestionIds.clear();
      state.currentQuestion = null;
      closeQuestionModal();
      renderAll();
    });

    refs.closeQuestionBtn.addEventListener("click", closeQuestionModal);
    refs.noOneBtn.addEventListener("click", resolveQuestionNoOne);
    refs.teamACorrectBtn.addEventListener("click", function () {
      resolveQuestionWinner("A");
    });
    refs.teamBCorrectBtn.addEventListener("click", function () {
      resolveQuestionWinner("B");
    });
    refs.wrongPickBtn.addEventListener("click", resolveWrongPick);

    refs.toggleAnswerBtn.addEventListener("click", function () {
      refs.modalTargetWord.classList.toggle("hidden");
      refs.toggleAnswerBtn.textContent = refs.modalTargetWord.classList.contains("hidden")
        ? "Reveal Target Word"
        : "Hide Target Word";
    });
  }

  function saveSettings() {
    const parsedPoints = parsePointsMap(refs.pointsMapInput.value);
    state.settings.teamAName = sanitizeName(refs.teamANameInput.value, "Team A");
    state.settings.teamBName = sanitizeName(refs.teamBNameInput.value, "Team B");
    state.settings.pointsByLevel = parsedPoints;
    state.settings.allowSteals = refs.allowStealsToggle.checked;
    state.settings.negativeScoring = refs.negativeScoringToggle.checked;
    state.settings.showSongMeta = refs.showSongMetaToggle.checked;

    applyConfiguredPoints();
    closeSettings();
    renderAll();
  }

  function parsePointsMap(raw) {
    const fallback = [100, 200, 300, 400, 500];
    const values = raw.split(",").map(function (part) {
      return Number(part.trim());
    });
    if (values.length !== 5 || values.some(function (n) { return !Number.isFinite(n) || n <= 0; })) {
      return fallback;
    }
    return values;
  }

  function sanitizeName(input, fallback) {
    const trimmed = String(input || "").trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  function syncSettingsInputs() {
    refs.teamANameInput.value = state.settings.teamAName;
    refs.teamBNameInput.value = state.settings.teamBName;
    refs.pointsMapInput.value = state.settings.pointsByLevel.join(",");
    refs.allowStealsToggle.checked = !!state.settings.allowSteals;
    refs.negativeScoringToggle.checked = !!state.settings.negativeScoring;
    refs.showSongMetaToggle.checked = !!state.settings.showSongMeta;
  }

  function renderAll() {
    refs.teamANameLabel.textContent = state.settings.teamAName;
    refs.teamBNameLabel.textContent = state.settings.teamBName;
    refs.teamAScore.textContent = String(state.teamScores.A);
    refs.teamBScore.textContent = String(state.teamScores.B);

    refs.pickerTeamA.classList.toggle("active", state.currentPicker === "A");
    refs.pickerTeamB.classList.toggle("active", state.currentPicker === "B");

    renderBoard();
  }

  function renderBoard() {
    refs.boardGrid.innerHTML = "";
    state.categories.forEach(function (category, colIndex) {
      const header = document.createElement("div");
      header.className = "category-header";
      header.textContent = category.name;
      header.style.gridColumn = String(colIndex + 1);
      header.style.gridRow = "1";
      refs.boardGrid.appendChild(header);
    });

    state.categories.forEach(function (category, colIndex) {
      category.questions
        .slice()
        .sort(function (a, b) { return a.level - b.level; })
        .forEach(function (question, qIndex) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tile-btn";
          btn.style.gridColumn = String(colIndex + 1);
          btn.style.gridRow = String(qIndex + 2);
          btn.textContent = String(question.points);
          btn.dataset.questionId = question.id;

          const used = state.usedQuestionIds.has(question.id);
          btn.disabled = used;
          btn.classList.toggle("used", used);

          btn.addEventListener("click", function () {
            openQuestionModal(category.name, question);
          });

          refs.boardGrid.appendChild(btn);
        });
    });
  }

  function setPicker(team) {
    state.currentPicker = team;
    renderAll();
  }

  function openSettings() {
    syncSettingsInputs();
    refs.settingsDrawer.classList.add("open");
    refs.settingsDrawer.setAttribute("aria-hidden", "false");
  }

  function closeSettings() {
    refs.settingsDrawer.classList.remove("open");
    refs.settingsDrawer.setAttribute("aria-hidden", "true");
  }

  function openQuestionModal(categoryName, question) {
    state.currentQuestion = { categoryName: categoryName, question: question };
    refs.modalCategory.textContent = categoryName;
    refs.modalLevel.textContent = String(question.level);
    refs.modalPoints.textContent = String(question.points);
    refs.modalPickingTeam.textContent = state.currentPicker === "A"
      ? state.settings.teamAName
      : state.settings.teamBName;
    refs.modalHostNote.textContent = question.hostNote || "No note.";
    refs.modalTargetWord.textContent = question.targetWord;
    refs.modalTargetWord.classList.add("hidden");
    refs.toggleAnswerBtn.textContent = "Reveal Target Word";

    if (state.settings.showSongMeta) {
      refs.songMetaWrap.classList.remove("hidden");
      refs.modalSongTitle.textContent = question.songTitle;
      refs.modalArtist.textContent = question.artist;
    } else {
      refs.songMetaWrap.classList.add("hidden");
      refs.modalSongTitle.textContent = "";
      refs.modalArtist.textContent = "";
    }

    refs.questionModal.classList.remove("hidden");
    refs.questionModal.setAttribute("aria-hidden", "false");
  }

  function closeQuestionModal() {
    state.currentQuestion = null;
    refs.questionModal.classList.add("hidden");
    refs.questionModal.setAttribute("aria-hidden", "true");
  }

  function resolveQuestionWinner(team) {
    if (!state.currentQuestion) {
      return;
    }
    const question = state.currentQuestion.question;
    state.teamScores[team] += question.points;
    state.usedQuestionIds.add(question.id);
    closeQuestionModal();
    renderAll();
  }

  function resolveWrongPick() {
    if (!state.currentQuestion) {
      return;
    }
    const question = state.currentQuestion.question;

    if (state.settings.negativeScoring) {
      state.teamScores[state.currentPicker] -= question.points;
    }

    if (!state.settings.allowSteals) {
      state.usedQuestionIds.add(question.id);
      closeQuestionModal();
      renderAll();
      return;
    }

    const stealWinner = window.prompt(
      "Who got the steal? Type A, B, or N for no one.",
      "N"
    );
    if (!stealWinner) {
      renderAll();
      return;
    }

    const normalized = stealWinner.trim().toUpperCase();
    if (normalized === "A" || normalized === "B") {
      state.teamScores[normalized] += question.points;
    }

    state.usedQuestionIds.add(question.id);
    closeQuestionModal();
    renderAll();
  }

  function resolveQuestionNoOne() {
    if (!state.currentQuestion) {
      return;
    }
    state.usedQuestionIds.add(state.currentQuestion.question.id);
    closeQuestionModal();
    renderAll();
  }
})();
