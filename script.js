const notesInput = document.querySelector("#notesInput");
const analyzeBtn = document.querySelector("#analyzeBtn");
const clearBtn = document.querySelector("#clearBtn");
const loadSampleBtn = document.querySelector("#loadSample");
const summaryLength = document.querySelector("#summaryLength");
const summaryLengthValue = document.querySelector("#summaryLengthValue");
const wordCount = document.querySelector("#wordCount");
const readingTime = document.querySelector("#readingTime");
const emptyState = document.querySelector("#emptyState");
const summaryList = document.querySelector("#summaryList");
const keywordList = document.querySelector("#keywordList");
const flashcardGrid = document.querySelector("#flashcardGrid");
const quizList = document.querySelector("#quizList");
const askForm = document.querySelector("#askForm");
const questionInput = document.querySelector("#questionInput");
const answerBox = document.querySelector("#answerBox");
const tabs = [...document.querySelectorAll(".tab")];
const views = {
  summary: document.querySelector("#summaryView"),
  flashcards: document.querySelector("#flashcardsView"),
  quiz: document.querySelector("#quizView"),
  ask: document.querySelector("#askView"),
};

const sampleNotes = `Photosynthesis is the process plants use to transform light energy into chemical energy. It mainly happens in chloroplasts, which contain chlorophyll. Chlorophyll absorbs sunlight, especially red and blue wavelengths, and reflects green light.

The light-dependent reactions happen in the thylakoid membranes. Water molecules are split, oxygen is released, and energy carriers called ATP and NADPH are produced. These carriers store energy that will be used in the next stage.

The Calvin cycle takes place in the stroma of the chloroplast. It uses carbon dioxide, ATP, and NADPH to create glucose. The enzyme RuBisCO helps attach carbon dioxide to a five-carbon molecule, beginning the cycle.

Photosynthesis is important because it produces oxygen and forms the base of many food chains. It also removes carbon dioxide from the atmosphere, which connects it to climate regulation and ecosystem health.`;

const stopWords = new Set([
  "about", "after", "again", "also", "because", "been", "being", "between", "could", "does", "each",
  "from", "have", "into", "more", "most", "other", "over", "such", "than", "that", "their", "then",
  "there", "these", "they", "this", "those", "through", "under", "uses", "using", "very", "were",
  "what", "when", "where", "which", "while", "with", "would", "your", "and", "are", "for", "has",
  "its", "the", "was", "will", "you", "can", "not", "but", "all", "one", "our", "out", "use",
]);

let currentAnalysis = null;

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function countFrequencies(words) {
  return words.reduce((map, word) => {
    map.set(word, (map.get(word) || 0) + 1);
    return map;
  }, new Map());
}

function scoreSentences(sentences, frequencies) {
  return sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    const rawScore = words.reduce((score, word) => score + (frequencies.get(word) || 0), 0);
    const positionBoost = index < 2 ? 1.18 : 1;
    const lengthPenalty = Math.max(words.length, 8);
    return {
      sentence,
      index,
      score: (rawScore / lengthPenalty) * positionBoost,
    };
  });
}

function extractKeywords(frequencies) {
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));
}

function buildSummary(scoredSentences, limit) {
  return scoredSentences
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}

function buildFlashcards(keywords, sentences) {
  return keywords.slice(0, 8).map(({ word }) => {
    const source = sentences.find((sentence) => tokenize(sentence).includes(word)) || sentences[0] || "";
    return {
      term: titleCase(word),
      definition: source,
    };
  });
}

function buildQuiz(summary, keywords) {
  const questions = summary.slice(0, 5).map((sentence, index) => {
    const term = keywords[index]?.word || "main idea";
    return {
      question: `How does "${term}" connect to the main topic?`,
      answer: sentence,
    };
  });

  if (keywords.length >= 3) {
    questions.push({
      question: `Name three key terms from these notes.`,
      answer: keywords.slice(0, 3).map(({ word }) => titleCase(word)).join(", "),
    });
  }

  return questions;
}

function titleCase(word) {
  return word.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function analyzeText() {
  const text = notesInput.value.trim();
  updateStats(text);

  if (!text) {
    currentAnalysis = null;
    renderEmpty();
    return;
  }

  const sentences = splitSentences(text);
  const words = tokenize(text);
  const frequencies = countFrequencies(words);
  const scoredSentences = scoreSentences(sentences, frequencies);
  const keywords = extractKeywords(frequencies);
  const summary = buildSummary(scoredSentences, Number(summaryLength.value));

  currentAnalysis = {
    text,
    sentences,
    keywords,
    summary,
    flashcards: buildFlashcards(keywords, sentences),
    quiz: buildQuiz(summary, keywords),
  };

  renderAnalysis(currentAnalysis);
}

function renderAnalysis(analysis) {
  emptyState.classList.remove("active");
  Object.values(views).forEach((view) => view.classList.remove("active"));
  views[getActiveTab()].classList.add("active");

  summaryList.innerHTML = analysis.summary.map((sentence) => `<li>${escapeHtml(sentence)}</li>`).join("");
  keywordList.innerHTML = analysis.keywords
    .map(({ word, count }) => `<span class="keyword">${escapeHtml(titleCase(word))} <small>${count}</small></span>`)
    .join("");
  flashcardGrid.innerHTML = analysis.flashcards
    .map(
      (card) => `
        <button class="flashcard" type="button">
          <strong>${escapeHtml(card.term)}</strong>
          <p>${escapeHtml(card.definition)}</p>
        </button>
      `,
    )
    .join("");
  quizList.innerHTML = analysis.quiz
    .map(
      (item) => `
        <section class="quiz-card">
          <h3>${escapeHtml(item.question)}</h3>
          <button class="secondary-button reveal-answer" type="button">Reveal Answer</button>
          <p class="quiz-answer">${escapeHtml(item.answer)}</p>
        </section>
      `,
    )
    .join("");
}

function renderEmpty() {
  Object.values(views).forEach((view) => view.classList.remove("active"));
  emptyState.classList.add("active");
  summaryList.innerHTML = "";
  keywordList.innerHTML = "";
  flashcardGrid.innerHTML = "";
  quizList.innerHTML = "";
  answerBox.innerHTML = "<p>Your answer will appear here after analysis.</p>";
}

function updateStats(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  readingTime.textContent = `${Math.max(0, Math.ceil(words / 220))} min`;
}

function answerQuestion(question) {
  if (!currentAnalysis) {
    answerBox.innerHTML = "<p>Analyze notes first, then ask a question.</p>";
    return;
  }

  const questionWords = new Set(tokenize(question));
  const matches = currentAnalysis.sentences
    .map((sentence) => {
      const words = tokenize(sentence);
      const overlap = words.filter((word) => questionWords.has(word)).length;
      return {
        sentence,
        score: overlap / Math.max(questionWords.size, 1),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const best = matches.filter((match) => match.score > 0);
  if (!best.length) {
    answerBox.innerHTML = "<p>I could not find a strong match in the notes. Try using terms that appear in the text.</p>";
    return;
  }

  const confidence = Math.min(99, Math.round(best[0].score * 100));
  answerBox.innerHTML = `
    <p class="confidence">Confidence: ${confidence}%</p>
    ${best.map((match) => `<p>${escapeHtml(match.sentence)}</p>`).join("")}
  `;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function getActiveTab() {
  return document.querySelector(".tab.active")?.dataset.tab || "summary";
}

summaryLength.addEventListener("input", () => {
  summaryLengthValue.textContent = summaryLength.value;
  if (notesInput.value.trim()) {
    analyzeText();
  }
});

analyzeBtn.addEventListener("click", analyzeText);

clearBtn.addEventListener("click", () => {
  notesInput.value = "";
  questionInput.value = "";
  updateStats("");
  renderEmpty();
  notesInput.focus();
});

loadSampleBtn.addEventListener("click", () => {
  notesInput.value = sampleNotes;
  analyzeText();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    if (currentAnalysis) {
      Object.values(views).forEach((view) => view.classList.remove("active"));
      views[tab.dataset.tab].classList.add("active");
      emptyState.classList.remove("active");
    }
  });
});

quizList.addEventListener("click", (event) => {
  const button = event.target.closest(".reveal-answer");
  if (!button) {
    return;
  }
  button.closest(".quiz-card").classList.toggle("revealed");
});

askForm.addEventListener("submit", (event) => {
  event.preventDefault();
  answerQuestion(questionInput.value);
});

notesInput.addEventListener("input", () => updateStats(notesInput.value));

updateStats("");
renderEmpty();
