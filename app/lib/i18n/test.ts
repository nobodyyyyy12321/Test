type TestLocale = "zh-TW" | "zh-CN" | "en";

type TestTextKey =
  | "submit"
  | "retryWrong"
  | "restart"
  | "groupLabel"
  | "noGroupText"
  | "multipleBadge"
  | "fillBadge"
  | "fillPlaceholder"
  | "correct"
  | "correctAnswer"
  | "examTerminated"
  | "leftPage"
  | "confirm"
  | "abandonTitle"
  | "abandonBody"
  | "continueBtn"
  | "abandonBtn"
  | "formalWarning"
  | "start"
  | "speakLabel"
  | "checkLabel"
  | "selectAll"
  | "deselectAll"
  | "selectWrong"
  | "deselectWrong"
  | "prevPage"
  | "nextPage"
  | "shareFrom"
  | "practiceDescriptionSuffix"
  | "loading";

type TestDictionary = Record<TestTextKey, string>;

const testZhTW: TestDictionary = {
  submit: "交卷",
  retryWrong: "錯題重練",
  restart: "重新開始",
  groupLabel: "題組說明",
  noGroupText: "（此題組未提供說明文字）",
  multipleBadge: "多選",
  fillBadge: "填充",
  fillPlaceholder: "輸入答案",
  correct: "答對",
  correctAnswer: "正確答案：",
  examTerminated: "測驗已終止",
  leftPage: "偵測到離開頁面，本次測驗已作廢",
  confirm: "確認",
  abandonTitle: "放棄測驗？",
  abandonBody: "離開後將無法繼續本次測驗",
  continueBtn: "繼續作答",
  abandonBtn: "放棄測驗",
  formalWarning: "開始後交卷前不得離開測驗畫面",
  start: "開始",
  speakLabel: "朗讀英文",
  checkLabel: "勾選",
  selectAll: "全選",
  deselectAll: "取消全選",
  selectWrong: "勾選答錯題",
  deselectWrong: "取消勾選",
  prevPage: "上一頁",
  nextPage: "下一頁",
  shareFrom: "from Exam",
  practiceDescriptionSuffix: "練習題",
  loading: "載入中…",
};

const testEn: TestDictionary = {
  submit: "Submit",
  retryWrong: "Retry Wrong",
  restart: "Restart",
  groupLabel: "Passage",
  noGroupText: "(No passage text provided)",
  multipleBadge: "Multi",
  fillBadge: "Fill",
  fillPlaceholder: "Type your answer",
  correct: "Correct",
  correctAnswer: "Answer: ",
  examTerminated: "Quiz Ended",
  leftPage: "You left the page. This attempt is void.",
  confirm: "OK",
  abandonTitle: "Abandon quiz?",
  abandonBody: "You cannot resume after leaving.",
  continueBtn: "Continue",
  abandonBtn: "Abandon",
  formalWarning: "You may not leave the screen during the quiz.",
  start: "Start",
  speakLabel: "Speak",
  checkLabel: "Select",
  selectAll: "Select All",
  deselectAll: "Deselect All",
  selectWrong: "Select Wrong",
  deselectWrong: "Deselect",
  prevPage: "Previous Page",
  nextPage: "Next Page",
  shareFrom: "from Exam",
  practiceDescriptionSuffix: "practice questions",
  loading: "Loading…",
};

const testZhCN: TestDictionary = {
  submit: "交卷",
  retryWrong: "错题重练",
  restart: "重新开始",
  groupLabel: "题组说明",
  noGroupText: "（此题组未提供说明文字）",
  multipleBadge: "多选",
  fillBadge: "填空",
  fillPlaceholder: "输入答案",
  correct: "答对",
  correctAnswer: "正确答案：",
  examTerminated: "测验已终止",
  leftPage: "检测到离开页面，本次测验已作废",
  confirm: "确认",
  abandonTitle: "放弃测验？",
  abandonBody: "离开后将无法继续本次测验",
  continueBtn: "继续作答",
  abandonBtn: "放弃测验",
  formalWarning: "开始后交卷前不得离开测验画面",
  start: "开始",
  speakLabel: "朗读英文",
  checkLabel: "勾选",
  selectAll: "全选",
  deselectAll: "取消全选",
  selectWrong: "勾选答错题",
  deselectWrong: "取消勾选",
  prevPage: "上一页",
  nextPage: "下一页",
  shareFrom: "from Exam",
  practiceDescriptionSuffix: "练习题",
  loading: "加载中…",
};

const TEST_TEXTS: Record<TestLocale, TestDictionary> = {
  "zh-TW": testZhTW,
  "zh-CN": testZhCN,
  en: testEn,
};

export function normalizeTestLanguage(lang?: string | null): TestLocale {
  if (lang === "en") return "en";
  if (lang === "zh-CN") return "zh-CN";
  return "zh-TW";
}

export function getTestText(lang: string | null | undefined, key: TestTextKey): string {
  const normalized = normalizeTestLanguage(lang);
  return TEST_TEXTS[normalized][key];
}

export function getTestLabels(lang: string | null | undefined) {
  const normalized = normalizeTestLanguage(lang);
  const t = TEST_TEXTS[normalized];

  return {
    score: (correct: number, answered: number) =>
      normalized === "en" ? `${correct}/${answered}` : normalized === "zh-CN" ? `答 ${correct}/${answered}` : `寫 ${correct}/${answered}`,
    submit: t.submit,
    retryWrong: t.retryWrong,
    restart: t.restart,
    groupLabel: t.groupLabel,
    noGroupText: t.noGroupText,
    multipleBadge: t.multipleBadge,
    fillBadge: t.fillBadge,
    fillPlaceholder: t.fillPlaceholder,
    correct: t.correct,
    correctAnswer: t.correctAnswer,
    examTerminated: t.examTerminated,
    leftPage: t.leftPage,
    confirm: t.confirm,
    abandonTitle: t.abandonTitle,
    abandonBody: t.abandonBody,
    continueBtn: t.continueBtn,
    abandonBtn: t.abandonBtn,
    formalWarning: t.formalWarning,
    start: t.start,
    speakLabel: t.speakLabel,
    checkLabel: t.checkLabel,
    selectAll: t.selectAll,
    deselectAll: t.deselectAll,
    selectWrong: t.selectWrong,
    deselectWrong: t.deselectWrong,
    prevPage: t.prevPage,
    nextPage: t.nextPage,
    shareFrom: t.shareFrom,
    loading: t.loading,
    shareScoreCard: (score: number, title: string) =>
      normalized === "en"
        ? `I scored ${score}/100 on "${title}"! Come and challenge yourself!`
        : normalized === "zh-CN"
        ? `我在「${title}」中拿了 ${score}/100 分，快来挑战！`
        : `我在「${title}」中拿了 ${score}/100 分，快來挑戰！`,
  };
}

export function getTestMetadataDescription(title: string, lang?: string | null): string {
  const suffix = getTestText(lang, "practiceDescriptionSuffix");
  if (normalizeTestLanguage(lang) === "en") {
    return `${title} ${suffix}`;
  }
  return `${title} ${suffix}`;
}
