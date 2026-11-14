
/* ======================================================
   GGN TEST
   EXAMINEE APPLICATION
   Version: 1.0.0
   File: js/app.js
   ====================================================== */

"use strict";

/* ======================================================
   1. APPLICATION STATE
   ====================================================== */

const GGNApp = {
  examinee: null,
  pendingIdentity: null,
  sessionToken: null,
  subjects: [],
  session: null,

  currentQuestionIndex: 0,

  timerInterval: null,
  remainingSeconds: 0,

  savingAnswers: new Map(),
  answeredQuestions: new Map(),

  isSubmitting: false,
  isStarting: false,
  isLoading: false,

  confirmCallback: null,

};


/* ======================================================
   2. DOM HELPERS
   ====================================================== */

function $(id) {
  return document.getElementById(id);
}

function showElement(id) {
  const element = $(id);

  if (element) {
    element.classList.remove("hidden");
  }
}

function hideElement(id) {
  const element = $(id);

  if (element) {
    element.classList.add("hidden");
  }
}

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent =
      value === null || value === undefined
        ? ""
        : String(value);
  }
}

function setHtml(id, html) {
  const element = $(id);

  if (element) {
    element.innerHTML = html;
  }
}

function setButtonLoading(buttonId, loading, loadingText = "กำลังดำเนินการ...") {
  const button = $(buttonId);

  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = loadingText;

  } else {
    button.disabled = buttonId === "btn-enter-system"
      ? String($("examinee-national-id")?.value || "").length !== 13
      : false;

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}


/* ======================================================
   3. RESPONSE NORMALIZATION
   ====================================================== */

function getResponseData(response) {
  if (!response || typeof response !== "object") {
    return null;
  }

  return response.data ?? response;
}

function getResponseArray(response, possibleKeys = []) {
  const data = getResponseData(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  for (const key of possibleKeys) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }

  return [];
}

function getErrorMessage(error) {
  if (!error) {
    return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  }

  return error.message ||
    "ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง";
}


/* ======================================================
   4. SECTION MANAGEMENT
   ====================================================== */

const GGN_SECTIONS = [
  "selection-section",
  "examinee-dashboard",
  "exam-instructions-section",
  "exam-section",
  "exam-result-section",
  "system-error-section"
];

function showSection(sectionId) {
  GGN_SECTIONS.forEach(id => {
    hideElement(id);
  });

  showElement(sectionId);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ======================================================
   5. ALERT MESSAGE
   ====================================================== */

function showAlert(message, type = "info") {
  const alert = $("global-alert");

  if (!alert) return;

  alert.className = `alert alert-${type}`;
  alert.textContent = message;

  alert.classList.remove("hidden");

  alert.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

function hideAlert() {
  hideElement("global-alert");
}


/* ======================================================
   6. LOADING
   ====================================================== */

function showLoading(message = "กำลังโหลดข้อมูล...") {
  GGNApp.isLoading = true;

  const loading = $("app-loading");

  if (loading) {
    const paragraph = loading.querySelector("p");

    if (paragraph) {
      paragraph.textContent = message;
    }

    loading.classList.remove("hidden");
  }
}

function hideLoading() {
  GGNApp.isLoading = false;
  hideElement("app-loading");
}


/* ======================================================
   7. CONNECTION STATUS
   ====================================================== */

function setConnectionStatus(status, message) {
  const element = $("connection-status");

  if (!element) return;

  const badgeClass = {
    online: "badge-success",
    offline: "badge-danger",
    checking: "badge-secondary"
  };

  const cssClass =
    badgeClass[status] || "badge-secondary";

  element.innerHTML = `
    <span class="badge ${cssClass}">
      ${escapeHtml(message)}
    </span>
  `;
}


/* ======================================================
   8. EXAMINEE INITIALIZATION
   ====================================================== */

async function initializeGGNApp() {
  showLoading("กำลังเชื่อมต่อระบบ GGN Test");
  setConnectionStatus("checking", "กำลังตรวจสอบระบบ");

  try {
    // Session อยู่ในหน่วยความจำของหน้านี้เท่านั้น ไม่บันทึกเลขบัตร
    // หรือ examineeId ลง localStorage/sessionStorage
    GGNApp.examinee = null;
    GGNApp.pendingIdentity = null;
    GGNApp.sessionToken = null;
    showSection("selection-section");
    resetIdentityForm();

    await GGNApi.request("system.ping", {}, { retry: false });

    setConnectionStatus("online", "เชื่อมต่อระบบแล้ว");
  } catch (error) {
    console.error("[GGN TEST] Initialization failed:", error);
    setConnectionStatus("offline", "ไม่สามารถเชื่อมต่อระบบได้");
    showSystemError(getErrorMessage(error));
  } finally {
    hideLoading();
  }
}


/* ======================================================
   9. NATIONAL ID IDENTITY CHECK
   ====================================================== */

function resetIdentityForm() {
  const input = $("examinee-national-id");
  if (input) input.value = "";
  GGNApp.pendingIdentity = null;
  hideElement("examinee-information");
  hideElement("national-id-error");
  const button = $("btn-enter-system");
  if (button) {
    button.disabled = true;
    button.textContent = "ตรวจสอบเลขบัตรประชาชน";
  }
}

function showNationalIdError(message) {
  const error = $("national-id-error");
  if (!error) return;
  error.textContent = message || "ไม่สามารถตรวจสอบข้อมูลได้";
  error.classList.remove("hidden");
}

function handleNationalIdInput() {
  const input = $("examinee-national-id");
  if (!input) return;
  input.value = input.value.replace(/\D/g, "").slice(0, 13);
  GGNApp.pendingIdentity = null;
  hideElement("examinee-information");
  hideElement("national-id-error");
  const button = $("btn-enter-system");
  if (button) {
    button.disabled = input.value.length !== 13;
    button.textContent = "ตรวจสอบเลขบัตรประชาชน";
  }
}

async function handleEnterSystem(event) {
  event.preventDefault();
  hideElement("national-id-error");

  const input = $("examinee-national-id");
  const nationalId = String(input?.value || "").trim();
  if (!/^\d{13}$/.test(nationalId)) {
    showNationalIdError("กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก");
    input?.focus();
    return;
  }

  const button = $("btn-enter-system");
  if (GGNApp.pendingIdentity) {
    await confirmExamineeIdentity(nationalId);
    return;
  }

  setButtonLoading("btn-enter-system", true, "กำลังตรวจสอบข้อมูล...");
  showLoading("กำลังตรวจสอบข้อมูลผู้เข้าสอบ");
  try {
    const response = await GGNApi.request(
      "identity.lookup",
      { nationalId },
      { retry: false }
    );
    const profile = getResponseData(response) || {};
    if (!profile.firstName || !profile.cohortId) {
      throw new Error("ข้อมูลผู้เข้าสอบไม่ครบถ้วน กรุณาติดต่อเจ้าหน้าที่");
    }
    GGNApp.pendingIdentity = profile;
    setText("selected-examinee-name", profile.fullName || `${profile.firstName} ${profile.lastName}`);
    setText("selected-examinee-cohort", profile.cohortName || profile.cohortCode || profile.cohortId || "-");
    showElement("examinee-information");
    if (button) {
      button.disabled = false;
      button.textContent = "ยืนยันข้อมูลและเข้าสู่ระบบ";
    }
  } catch (error) {
    GGNApp.pendingIdentity = null;
    showNationalIdError(getErrorMessage(error));
  } finally {
    hideLoading();
    if (button) {
      button.disabled = false;
      if (!GGNApp.pendingIdentity) button.textContent = "ตรวจสอบเลขบัตรประชาชน";
    }
  }
}

async function confirmExamineeIdentity(nationalId) {
  const button = $("btn-enter-system");
  setButtonLoading("btn-enter-system", true, "กำลังยืนยันตัวตน...");
  showLoading("กำลังสร้าง Session ผู้เข้าสอบ");
  try {
    const response = await GGNApi.request(
      "identity.login",
      { nationalId },
      { retry: false }
    );
    const data = getResponseData(response) || {};
    if (!data.sessionToken || !data.examinee) {
      throw new Error("ระบบไม่ได้รับ Session ผู้เข้าสอบ กรุณาลองใหม่");
    }
    GGNApp.sessionToken = data.sessionToken;
    GGNApp.examinee = Object.assign({}, GGNApp.pendingIdentity || {}, data.examinee);
    GGNApp.pendingIdentity = null;
    const nationalIdInput = $("examinee-national-id");
    if (nationalIdInput) nationalIdInput.value = "";
    hideElement("examinee-information");
    await loadExamineeDashboard();
  } catch (error) {
    GGNApp.sessionToken = null;
    GGNApp.examinee = null;
    showNationalIdError(getErrorMessage(error));
  } finally {
    hideLoading();
    if (button) {
      button.disabled = false;
      button.textContent = "ตรวจสอบเลขบัตรประชาชน";
    }
  }
}


/* ======================================================
   10. EXAMINEE DASHBOARD
   ====================================================== */

async function loadExamineeDashboard() {
  if (!GGNApp.sessionToken || !GGNApp.examinee) {
    showSection("selection-section");
    return;
  }

  showLoading("กำลังโหลดข้อมูลการสอบ");
  try {
    const response = await GGNApi.request(
      "exam.dashboard",
      { sessionToken: GGNApp.sessionToken },
      { retry: false }
    );
    const data = getResponseData(response) || {};
    if (data.examinee) GGNApp.examinee = Object.assign({}, GGNApp.examinee, data.examinee);
    GGNApp.subjects = Array.isArray(data.subjects) ? data.subjects : [];
    renderExamineeProfile();
    renderSubjectList(GGNApp.subjects);
    renderDashboardStatistics(GGNApp.subjects);
    showSection("examinee-dashboard");
    setConnectionStatus("online", "เชื่อมต่อระบบแล้ว");
  } catch (error) {
    console.error("[GGN TEST] Dashboard error:", error);
    if (String(error.code || "").includes("SESSION")) {
      GGNApp.sessionToken = null;
      GGNApp.examinee = null;
      resetIdentityForm();
      showSection("selection-section");
      showAlert("Session หมดอายุ กรุณายืนยันตัวตนใหม่", "warning");
    } else {
      showSystemError(getErrorMessage(error));
    }
  } finally {
    hideLoading();
  }
}

function renderExamineeProfile() {
  const examinee = GGNApp.examinee;
  if (!examinee) return;
  setText("dashboard-examinee-name", examinee.fullName || `${examinee.firstName || ""} ${examinee.lastName || ""}`.trim());
  setText("dashboard-examinee-cohort", examinee.cohortName || examinee.cohortCode || examinee.cohortId || "-");
}


/* ======================================================
   13. SUBJECT STATUS
   ====================================================== */

function getSubjectStatus(subject) {
  const status =
    String(
      subject.attemptStatus ||
      subject.examStatus ||
      subject.status ||
      ""
    ).toUpperCase();

  if (
    status === "IN_PROGRESS" ||
    status === "INPROGRESS"
  ) {
    return "IN_PROGRESS";
  }

  if (
    status === "SUBMITTED" ||
    status === "COMPLETED"
  ) {
    return "SUBMITTED";
  }

  if (
    status === "TIME_EXPIRED" ||
    status === "EXPIRED"
  ) {
    return "TIME_EXPIRED";
  }

  if (
    status === "PASSED" ||
    subject.resultStatus === "PASS"
  ) {
    return "PASSED";
  }

  if (
    status === "FAILED" ||
    subject.resultStatus === "FAIL"
  ) {
    return "FAILED";
  }

  const examStatus = String(subject.examStatus || "").toUpperCase();
  if (examStatus === "NOT_YET_OPEN") return "NOT_YET_OPEN";
  if (examStatus === "CLOSED") return "CLOSED";
  if (examStatus === "CONFIGURATION_ERROR") return "CONFIGURATION_ERROR";
  if (examStatus === "NOT_AVAILABLE" || !examStatus) return "NOT_AVAILABLE";

  return "PENDING";
}

function getSubjectStatusDisplay(subject) {
  const status = getSubjectStatus(subject);

  const statusMap = {
    PENDING: {
      text: "รอสอบ",
      badge: "badge-secondary",
      button: "เริ่มสอบ",
      disabled: false
    },

    IN_PROGRESS: {
      text: "กำลังสอบ",
      badge: "badge-warning",
      button: "ทำข้อสอบต่อ",
      disabled: false
    },

    SUBMITTED: {
      text: "ส่งข้อสอบแล้ว",
      badge: "badge-info",
      button: "สอบแล้ว",
      disabled: true
    },

    TIME_EXPIRED: {
      text: "หมดเวลาสอบ",
      badge: "badge-danger",
      button: "สิ้นสุดการสอบ",
      disabled: true
    },

    PASSED: {
      text: "ผ่าน",
      badge: "badge-success",
      button: "สอบแล้ว",
      disabled: true
    },

    FAILED: {
      text: "ไม่ผ่าน",
      badge: "badge-danger",
      button: "สอบแล้ว",
      disabled: true
    },

    NOT_YET_OPEN: {
      text: "ยังไม่ถึงเวลาเปิดสอบ",
      badge: "badge-secondary",
      button: "ยังไม่เปิดสอบ",
      disabled: true
    },

    CLOSED: {
      text: "ปิดสอบแล้ว",
      badge: "badge-secondary",
      button: "ปิดสอบแล้ว",
      disabled: true
    },

    NOT_AVAILABLE: {
      text: "ยังไม่มีชุดข้อสอบ",
      badge: "badge-secondary",
      button: "ยังไม่พร้อมสอบ",
      disabled: true
    },

    CONFIGURATION_ERROR: {
      text: "โปรดติดต่อเจ้าหน้าที่",
      badge: "badge-danger",
      button: "ไม่พร้อมสอบ",
      disabled: true
    }
  };

  return statusMap[status];
}


/* ======================================================
   14. RENDER SUBJECT LIST
   ====================================================== */

function renderSubjectList(subjects) {
  const container = $("subject-list");

  if (!container) return;

  container.innerHTML = "";

  hideElement("subject-list-loading");
  const openCount = (Array.isArray(subjects) ? subjects : []).filter(subject =>
    subject.examStatus === "AVAILABLE" ||
    (subject.attemptStatus === "IN_PROGRESS" && subject.examStatus === "ATTEMPT_EXISTS")
  ).length;
  setText("subject-open-count", `${openCount} วิชาเปิดสอบ`);

  if (!subjects || subjects.length === 0) {
    showElement("subject-list-empty");
    return;
  }

  hideElement("subject-list-empty");

  subjects
    .slice()
    .sort((a, b) => {
      return Number(a.displayOrder || 0) -
        Number(b.displayOrder || 0);
    })
    .forEach((subject, index) => {

      const status =
        getSubjectStatusDisplay(subject);

      const card = document.createElement("div");

      card.className = "card mb-3";

      const title =
        subject.subjectName ||
        subject.name ||
        `วิชาที่ ${index + 1}`;

      const description =
        subject.description || "";

      const questionCount =
        subject.totalQuestions ??
        subject.questionCount ??
        "-";

      const duration =
        subject.durationMinutes ??
        "-";

      const button = document.createElement("button");

      button.type = "button";
      button.className =
        status.disabled
          ? "btn btn-secondary"
          : "btn btn-primary";

      button.textContent = status.button;
      button.disabled = status.disabled;

      if (!status.disabled) {
        button.addEventListener("click", () => {
          openExamInstructions(subject);
        });
      }

      const header = document.createElement("div");
      header.className = "card-header";

      const titleElement = document.createElement("div");
      titleElement.className = "card-title";
      titleElement.textContent = title;

      const badge = document.createElement("span");
      badge.className = `badge ${status.badge}`;
      badge.textContent = status.text;

      header.appendChild(titleElement);
      header.appendChild(badge);

      const descriptionElement =
        document.createElement("p");

      descriptionElement.textContent = description;

      const information =
        document.createElement("div");

      information.className =
        "flex flex-wrap gap-3 mt-3 mb-3";

      information.innerHTML = `
        <span class="text-secondary">
          จำนวนข้อ: ${escapeHtml(questionCount)}
        </span>

        <span class="text-secondary">
          เวลาสอบ: ${escapeHtml(duration)} นาที
        </span>
      `;

      const footer = document.createElement("div");
      footer.className = "card-footer flex-between flex-wrap gap-3";

      const resultText =
        document.createElement("span");

      resultText.className = "text-secondary";

      if (
        subject.score !== undefined &&
        subject.score !== null
      ) {
        resultText.textContent =
          `คะแนน: ${subject.score}`;
      } else {
        resultText.textContent =
          "เลือกเริ่มสอบเมื่อพร้อม";
      }

      footer.appendChild(resultText);
      footer.appendChild(button);

      card.appendChild(header);

      if (description) {
        card.appendChild(descriptionElement);
      }

      card.appendChild(information);
      card.appendChild(footer);

      container.appendChild(card);
    });
}


/* ======================================================
   15. DASHBOARD STATISTICS
   ====================================================== */

function renderDashboardStatistics(subjects) {
  const stats = {
    passed: 0,
    pending: 0,
    inProgress: 0
  };

  subjects.forEach(subject => {
    const status = getSubjectStatus(subject);

    if (status === "PASSED") {
      stats.passed++;

    } else if (status === "IN_PROGRESS") {
      stats.inProgress++;

    } else if (status === "PENDING") {
      stats.pending++;
    }
  });

  setText(
    "total-subjects",
    subjects.length
  );

  setText(
    "passed-subjects",
    stats.passed
  );

  setText(
    "pending-subjects",
    stats.pending
  );

  setText(
    "in-progress-subjects",
    stats.inProgress
  );
}


/* ======================================================
   16. EXAM INSTRUCTIONS
   ====================================================== */

function openExamInstructions(subject) {
  if (!subject || !subject.subjectId) {
    showAlert(
      "ข้อมูลรายวิชาไม่ถูกต้อง",
      "danger"
    );

    return;
  }

  const canResume = subject.attemptStatus === "IN_PROGRESS";
  if (subject.examStatus !== "AVAILABLE" && !canResume) {
    showAlert("วิชานี้ยังไม่เปิดให้เข้าสอบ กรุณาเลือกวิชาที่มีสถานะเปิดสอบ", "warning");
    return;
  }

  GGNApp.selectedSubject = subject;

  setText(
    "instruction-subject-name",
    subject.subjectName || subject.name
  );

  setText(
    "instruction-question-count",
    subject.totalQuestions ??
    subject.questionCount ??
    "-"
  );

  setText(
    "instruction-duration",
    subject.durationMinutes
      ? `${subject.durationMinutes} นาที`
      : "-"
  );

  const checkbox =
    $("confirm-exam-instructions");

  if (checkbox) {
    checkbox.checked = false;
  }

  const button = $("btn-start-exam");

  if (button) {
    button.disabled = true;
  }

  showSection("exam-instructions-section");
}


/* ======================================================
   17. START OR RESUME EXAM
   ====================================================== */

async function startSelectedExam() {
  if (GGNApp.isStarting) return;

  const subject = GGNApp.selectedSubject;
  const examinee = GGNApp.examinee;

  if (!subject || !examinee) {
    showAlert(
      "ไม่พบข้อมูลผู้เข้าสอบหรือรายวิชา",
      "danger"
    );

    return;
  }

  GGNApp.isStarting = true;

  setButtonLoading(
    "btn-start-exam",
    true,
    "กำลังเตรียมข้อสอบ..."
  );

  showLoading("กำลังตรวจสอบสถานะการสอบ");

  try {

    const response = await GGNApi.request(
      "exam.start",
      {
        sessionToken: GGNApp.sessionToken,
        subjectId: subject.subjectId
      },
      {
        retry: false
      }
    );

    const session = getResponseData(response);

    if (
      !session ||
      !session.attemptId ||
      !Array.isArray(session.questions)
    ) {
      throw new Error(
        "ข้อมูลข้อสอบจาก Backend ไม่ครบถ้วน"
      );
    }


    GGNApp.session = session;

    GGNApp.currentQuestionIndex = 0;

    GGNApp.answeredQuestions.clear();

    const responses =
      Array.isArray(session.responses)
        ? session.responses
        : [];

    responses.forEach(responseItem => {
      if (
        responseItem.questionId &&
        responseItem.selectedAnswer
      ) {
        GGNApp.answeredQuestions.set(
          responseItem.questionId,
          responseItem.selectedAnswer
        );
      }
    });

    renderExam();

    showSection("exam-section");

    stopExamTimer();

    const timerElement = document.getElementById("exam-timer");

    if (timerElement) {
      timerElement.textContent = "ตามรอบเวลาที่กำหนด";
    }

    if (session.resumed) {
      showAlert(
        "กลับเข้าสู่ข้อสอบเดิมแล้ว สามารถทำข้อสอบต่อได้",
        "info"
      );
    }

  } catch (error) {

    console.error(
      "[GGN TEST] Start exam error:",
      error
    );

    showAlert(
      getErrorMessage(error),
      "danger"
    );

  } finally {

    hideLoading();

    GGNApp.isStarting = false;

    setButtonLoading(
      "btn-start-exam",
      false
    );
  }
}


/* ======================================================
   18. QUESTION NORMALIZATION
   ====================================================== */

function getQuestionChoices(question) {
  if (
    Array.isArray(question.choices)
  ) {
    return question.choices.map((choice, index) => {

      if (typeof choice === "string") {
        return {
          key: ["A", "B", "C", "D"][index],
          text: choice
        };
      }

      return {
        key:
          choice.key ||
          choice.label ||
          ["A", "B", "C", "D"][index],

        text:
          choice.text ||
          choice.value ||
          ""
      };
    });
  }

  return [
    {
      key: "A",
      text: question.choiceA
    },
    {
      key: "B",
      text: question.choiceB
    },
    {
      key: "C",
      text: question.choiceC
    },
    {
      key: "D",
      text: question.choiceD
    }
  ].filter(choice => {
    return choice.text !== undefined &&
      choice.text !== null &&
      choice.text !== "";
  });
}


/* ======================================================
   19. RENDER EXAM
   ====================================================== */

function renderExam() {
  const session = GGNApp.session;

  if (!session) return;

  setText(
    "exam-subject-name",
    session.subjectName ||
    GGNApp.selectedSubject?.subjectName ||
    "แบบทดสอบ"
  );

  setText(
    "exam-examinee-name",
    GGNApp.examinee?.fullName || ""
  );

  renderQuestionNavigation();

  renderCurrentQuestion();

  updateExamProgress();
}


/* ======================================================
   20. QUESTION NAVIGATION
   ====================================================== */

function renderQuestionNavigation() {
  const container =
    $("exam-question-navigation");

  if (!container) return;

  container.innerHTML = "";

  const questions =
    GGNApp.session?.questions || [];

  questions.forEach((question, index) => {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className = "question-nav-btn";

    button.textContent = String(index + 1);

    if (
      GGNApp.answeredQuestions.has(
        question.questionId
      )
    ) {
      button.classList.add("answered");
    }

    if (
      index === GGNApp.currentQuestionIndex
    ) {
      button.classList.add("current");
    }

    button.addEventListener("click", () => {
      goToQuestion(index);
    });

    container.appendChild(button);
  });
}

function goToQuestion(index) {
  const questions =
    GGNApp.session?.questions || [];

  if (
    index < 0 ||
    index >= questions.length
  ) {
    return;
  }

  GGNApp.currentQuestionIndex = index;

  renderQuestionNavigation();

  renderCurrentQuestion();

  updateExamProgress();
}

function goToPreviousQuestion() {
  goToQuestion(
    GGNApp.currentQuestionIndex - 1
  );
}

function goToNextQuestion() {
  goToQuestion(
    GGNApp.currentQuestionIndex + 1
  );
}


/* ======================================================
   21. RENDER CURRENT QUESTION
   ====================================================== */

function renderCurrentQuestion() {
  const container =
    $("exam-question-container");

  if (!container) return;

  const questions =
    GGNApp.session?.questions || [];

  const index =
    GGNApp.currentQuestionIndex;

  const question = questions[index];

  if (!question) return;

  const questionId = question.questionId;

  const selectedAnswer =
    GGNApp.answeredQuestions.get(questionId) || "";

  const choices = getQuestionChoices(question);

  const card = document.createElement("div");

  card.className = "exam-question-card";

  const number = document.createElement("div");

  number.className = "question-number";

  number.textContent =
    `ข้อที่ ${index + 1} จาก ${questions.length}`;

  const questionText =
    document.createElement("div");

  questionText.className = "question-text";

  questionText.textContent =
    question.questionText || "";

  card.appendChild(number);
  card.appendChild(questionText);

  if (question.questionImageUrl) {
    const image =
      document.createElement("img");

    image.className = "question-image";

    image.src = question.questionImageUrl;

    image.alt = `รูปประกอบข้อสอบ ${index + 1}`;

    image.loading = "lazy";

    image.onerror = () => {
      image.classList.add("hidden");
    };

    card.appendChild(image);
  }

  const choiceList =
    document.createElement("div");

  choiceList.className = "choice-list";

  choices.forEach(choice => {

    const label =
      document.createElement("label");

    label.className = "choice-item";

    if (selectedAnswer === choice.key) {
      label.classList.add("selected");
    }

    const input =
      document.createElement("input");

    input.type = "radio";
    input.name = "exam-answer";
    input.value = choice.key;

    input.checked =
      selectedAnswer === choice.key;

    input.addEventListener("change", () => {
      handleAnswerSelection(
        question,
        choice.key,
        label
      );
    });

    const choiceLabel =
      document.createElement("span");

    choiceLabel.className = "choice-label";
    choiceLabel.textContent = choice.key;

    const choiceText =
      document.createElement("span");

    choiceText.className = "choice-text";
    choiceText.textContent = choice.text;

    label.appendChild(input);
    label.appendChild(choiceLabel);
    label.appendChild(choiceText);

    choiceList.appendChild(label);
  });

  card.appendChild(choiceList);

  container.innerHTML = "";

  container.appendChild(card);

  const previousButton =
    $("btn-previous-question");

  const nextButton =
    $("btn-next-question");

  if (previousButton) {
    previousButton.disabled = index === 0;
  }

  if (nextButton) {
    nextButton.disabled =
      index === questions.length - 1;
  }
}


/* ======================================================
   22. SAVE ANSWER
   ====================================================== */

async function handleAnswerSelection(
  question,
  selectedAnswer
) {
  if (
    GGNApp.isSubmitting ||
    !GGNApp.session
  ) {
    return;
  }

  const questionId = question.questionId;

  GGNApp.answeredQuestions.set(
    questionId,
    selectedAnswer
  );

  renderQuestionNavigation();

  updateExamProgress();

  const previousRequest =
    GGNApp.savingAnswers.get(questionId);

  if (previousRequest) {
    await previousRequest.catch(() => {});
  }

  const savePromise = saveExamAnswer(
    questionId,
    selectedAnswer
  );

  GGNApp.savingAnswers.set(
    questionId,
    savePromise
  );

  try {

    await savePromise;

  } catch (error) {

    console.error(
      "[GGN TEST] Save answer failed:",
      error
    );

    showAlert(
      "บันทึกคำตอบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและเลือกคำตอบอีกครั้ง",
      "danger"
    );

  } finally {

    if (
      GGNApp.savingAnswers.get(questionId) ===
      savePromise
    ) {
      GGNApp.savingAnswers.delete(questionId);
    }
  }
}

async function saveExamAnswer(
  questionId,
  selectedAnswer
) {
  const session = GGNApp.session;

  if (!session) {
    throw new Error(
      "ไม่พบข้อมูลการสอบ"
    );
  }

  return GGNApi.request(
    "exam.saveAnswer",
    {
      sessionToken: GGNApp.sessionToken,
      attemptId: session.attemptId,
      questionId,
      selectedAnswer
    },
    {
      retry: false
    }
  );
}


/* ======================================================
   23. EXAM PROGRESS
   ====================================================== */

function updateExamProgress() {
  const questions =
    GGNApp.session?.questions || [];

  const total = questions.length;

  const answered =
    GGNApp.answeredQuestions.size;

  const percentage =
    total > 0
      ? Math.round((answered / total) * 100)
      : 0;

  setText(
    "exam-progress-text",
    `${answered}/${total}`
  );

  const progressBar =
    $("exam-progress-bar");

  if (progressBar) {
    progressBar.style.width =
      `${percentage}%`;
  }
}


/* ======================================================
   24. EXAM TIMER
   ====================================================== */

function stopExamTimer() {
  if (GGNApp.timerInterval) {
    clearInterval(GGNApp.timerInterval);

    GGNApp.timerInterval = null;
  }
}

function startExamTimer(remainingSeconds) {
  stopExamTimer();

  GGNApp.remainingSeconds =
    Math.max(0, Math.floor(remainingSeconds));

  updateTimerDisplay();

  if (GGNApp.remainingSeconds <= 0) {
    handleTimeExpired();
    return;
  }

  GGNApp.timerInterval = setInterval(() => {

    GGNApp.remainingSeconds--;

    updateTimerDisplay();

    if (GGNApp.remainingSeconds <= 0) {
      handleTimeExpired();
    }

  }, 1000);
}

function updateTimerDisplay() {
  const seconds =
    Math.max(0, GGNApp.remainingSeconds);

  const minutes =
    Math.floor(seconds / 60);

  const remaining =
    seconds % 60;

  const display =
    `${String(minutes).padStart(2, "0")}:` +
    `${String(remaining).padStart(2, "0")}`;

  setText("exam-timer", display);

  const timer = $("exam-timer");

  if (timer) {
    timer.classList.toggle(
      "text-danger",
      seconds <= 60
    );
  }
}

async function handleTimeExpired() {
  if (GGNApp.isSubmitting) return;

  stopExamTimer();

  showAlert(
    "หมดเวลาสอบแล้ว ระบบกำลังส่งข้อสอบ",
    "warning"
  );

  await submitCurrentExam(true);
}


/* ======================================================
   25. WAIT FOR ANSWER SAVES
   ====================================================== */

async function waitForPendingAnswers() {
  const pending = [
    ...GGNApp.savingAnswers.values()
  ];

  if (pending.length > 0) {
    await Promise.all(pending);
  }
}


/* ======================================================
   26. SUBMIT CONFIRMATION
   ====================================================== */

function showConfirmModal(
  message,
  onConfirm,
  title = "ยืนยันการดำเนินการ"
) {
  setText(
    "confirm-modal-title",
    title
  );

  setText(
    "confirm-modal-message",
    message
  );

  GGNApp.confirmCallback = onConfirm;

  showElement("confirm-modal");
}

function closeConfirmModal() {
  hideElement("confirm-modal");

  GGNApp.confirmCallback = null;
}

function confirmModalAction() {
  const callback =
    GGNApp.confirmCallback;

  closeConfirmModal();

  if (typeof callback === "function") {
    callback();
  }
}

function confirmSubmitExam() {
  if (GGNApp.isSubmitting) return;

  const total =
    GGNApp.session?.questions?.length || 0;

  const answered =
    GGNApp.answeredQuestions.size;

  const unanswered =
    Math.max(0, total - answered);

  let message =
    "เมื่อส่งข้อสอบแล้วจะไม่สามารถกลับมาแก้ไขคำตอบได้";

  if (unanswered > 0) {
    message +=
      ` ขณะนี้ยังไม่ได้ตอบ ${unanswered} ข้อ`;
  }

  message += " ต้องการส่งข้อสอบหรือไม่?";

  showConfirmModal(
    message,
    () => submitCurrentExam(false),
    "ยืนยันการส่งข้อสอบ"
  );
}


/* ======================================================
   27. SUBMIT EXAM
   ====================================================== */

async function submitCurrentExam(isTimeExpired = false) {
  if (
    GGNApp.isSubmitting ||
    !GGNApp.session
  ) {
    return;
  }

  GGNApp.isSubmitting = true;

  stopExamTimer();

  const submitButton =
    $("btn-submit-exam");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      "กำลังส่งข้อสอบ...";
  }

  showLoading("กำลังบันทึกผลการสอบ");

  try {

    await waitForPendingAnswers();

    const response = await GGNApi.request(
      "exam.submit",
      {
        sessionToken: GGNApp.sessionToken,
        attemptId: GGNApp.session.attemptId
      },
      {
        retry: false
      }
    );

    const result =
      getResponseData(response) || {};

    renderExamResult(result);

    showSection("exam-result-section");

    clearSavedExamSession();

  } catch (error) {

    console.error(
      "[GGN TEST] Submit exam error:",
      error
    );

    showSystemError(
      isTimeExpired
        ? "หมดเวลาสอบแล้ว แต่ระบบยังไม่ได้รับการยืนยันผลการส่งข้อสอบ กรุณาเชื่อมต่ออินเทอร์เน็ตและตรวจสอบสถานะกับเจ้าหน้าที่"
        : getErrorMessage(error)
    );

  } finally {

    hideLoading();

    GGNApp.isSubmitting = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "ส่งข้อสอบ";
    }
  }
}


/* ======================================================
   28. RENDER EXAM RESULT
   Examinee: Confirmation only, no score display
   ====================================================== */

function renderExamResult(result) {

  const section = $("exam-result-section");

  if (!section) return;

  // Preserve the existing dashboard button and its event listener.
  const backButton = $("btn-back-to-dashboard");

  if (backButton) {
    backButton.remove();
  }

  // Remove all score and result details from the result screen.
  section.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "card text-center";

  const title = document.createElement("h2");
  title.textContent = "ส่งข้อสอบเรียบร้อยแล้ว";

  const message = document.createElement("p");
  message.textContent = "ระบบบันทึกการส่งข้อสอบของคุณแล้ว";

  wrapper.appendChild(title);
  wrapper.appendChild(message);

  section.appendChild(wrapper);

  // Restore the existing button.
  if (backButton) {
    section.appendChild(backButton);
  }

}


/* ======================================================
   29. RETURN TO DASHBOARD
   ====================================================== */

async function returnToDashboard() {
  GGNApp.session = null;

  GGNApp.selectedSubject = null;

  GGNApp.currentQuestionIndex = 0;

  GGNApp.answeredQuestions.clear();

  GGNApp.savingAnswers.clear();

  GGNApp.isSubmitting = false;

  stopExamTimer();

  await loadExamineeDashboard();
}


/* ======================================================
   30. CHANGE EXAMINEE
   ====================================================== */

function changeExaminee() {
  if (GGNApp.session) {
    showAlert(
      "ไม่สามารถเปลี่ยนผู้เข้าสอบระหว่างทำข้อสอบได้",
      "warning"
    );

    return;
  }

  GGNApp.examinee = null;
  GGNApp.pendingIdentity = null;
  GGNApp.sessionToken = null;
  GGNApp.subjects = [];
  GGNApp.session = null;
  resetIdentityForm();
  showSection("selection-section");
}


/* ======================================================
   31. SYSTEM ERROR
   ====================================================== */

function showSystemError(message) {
  setText(
    "system-error-message",
    message
  );

  showSection("system-error-section");
}


/* ======================================================
   32. RETRY SYSTEM
   ====================================================== */

async function retrySystem() {
  hideAlert();

  GGNApp.session = null;

  await initializeGGNApp();
}


/* ======================================================
   33. CLEAR SESSION
   ====================================================== */

function clearSavedExamSession() {
  /*
   * ไม่เก็บคำตอบหรือเฉลยไว้ใน localStorage
   *
   * การกลับเข้าสอบจะใช้ attemptId และ deadline
   * ที่ Backend ตรวจสอบจากฐานข้อมูล
   */
}


/* ======================================================
   34. EVENT LISTENERS
   ====================================================== */

function setupGGNEventListeners() {

  $("examinee-national-id")
    ?.addEventListener("input", handleNationalIdInput);


  $("examinee-selection-form")
    ?.addEventListener(
      "submit",
      handleEnterSystem
    );


  $("btn-change-examinee")
    ?.addEventListener(
      "click",
      changeExaminee
    );


  $("confirm-exam-instructions")
    ?.addEventListener("change", event => {

      const button = $("btn-start-exam");

      if (button) {
        button.disabled = !event.target.checked;
      }

    });


  $("btn-start-exam")
    ?.addEventListener(
      "click",
      startSelectedExam
    );


  $("btn-cancel-exam")
    ?.addEventListener("click", () => {
      showSection("examinee-dashboard");
    });


  $("btn-previous-question")
    ?.addEventListener(
      "click",
      goToPreviousQuestion
    );


  $("btn-next-question")
    ?.addEventListener(
      "click",
      goToNextQuestion
    );


  $("btn-submit-exam")
    ?.addEventListener(
      "click",
      confirmSubmitExam
    );


  $("btn-back-to-dashboard")
    ?.addEventListener(
      "click",
      returnToDashboard
    );


  $("btn-retry-system")
    ?.addEventListener(
      "click",
      retrySystem
    );


  $("btn-confirm-cancel")
    ?.addEventListener(
      "click",
      closeConfirmModal
    );


  $("btn-confirm-ok")
    ?.addEventListener(
      "click",
      confirmModalAction
    );

}


/* ======================================================
   35. PAGE INITIALIZATION
   ====================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupGGNEventListeners();

    initializeGGNApp();

  }
);
