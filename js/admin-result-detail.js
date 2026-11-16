
/**
 * ======================================================
 * GGN TEST
 * ADMIN RESULT DETAIL
 * ======================================================
 *
 * File: js/admin-result-detail.js
 * Version: 1.0.0
 * Updated: 2026-11-16
 *
 * PURPOSE
 * - Load individual examinee result details
 * - Display 9 subjects x 10 questions
 * - Display selected answer and correct answer
 * - Allow immediate score adjustment
 * - Restore previous value if saving fails
 *
 * DEPENDENCIES
 * - js/api.js
 * - js/admin.js
 * - js/admin-results.js
 * ======================================================
 */

"use strict";


/* ======================================================
   OPEN INDIVIDUAL RESULT
====================================================== */

async function openAdminExamineeResult(person) {
    if (!person || !person.nationalId || !person.cohortId) {
        adminShowAlert(
            "ไม่พบข้อมูลผู้เข้าสอบหรือรุ่นการทดสอบ",
            "danger"
        );

        return;
    }

    const oldModal = document.getElementById(
        "admin-result-detail-modal"
    );

    if (oldModal) {
        oldModal.remove();
    }

    const modal = document.createElement("div");

    modal.id = "admin-result-detail-modal";
    modal.className = "modal-overlay";

    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="modal modal-result-detail">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">
              ตรวจสอบและแก้ไขคะแนนรายบุคคล
            </h3>

            <div class="text-muted">
              ${adminEscape(person.examineeName || "-")}
              ·
              ${adminEscape(person.nationalId || "")}
            </div>
          </div>

          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-result-close>
            ปิด
          </button>
        </div>

        <div class="modal-body">
          <div class="result-detail-help">
            แสดง 9 วิชา × 10 ข้อ
            คะแนนในแต่ละช่องแก้ไขได้
            ระบบจะบันทึกทับคะแนนเดิมทันทีเมื่อเปลี่ยนค่า

            <span>
              คำตอบที่เลือก / เฉลย · คะแนนที่ได้ / คะแนนเต็ม
            </span>
          </div>

          <div class="result-detail-loading">
            กำลังโหลดคำตอบทั้ง 9 วิชา...
          </div>

          <div class="result-detail-content"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
        modal.remove();
    };

    modal.querySelector("[data-result-close]")
        .addEventListener("click", close);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            close();
        }
    });

    try {
        const detail = await adminRequest(
            "admin.result.detail",
            {
                nationalId: person.nationalId,
                cohortId: person.cohortId
            }
        );

        // Modal may have been closed while the API request was running.
        if (!modal.isConnected) return;

        const subjects = Array.isArray(detail.subjects)
            ? detail.subjects
            : [];

        const loading = modal.querySelector(
            ".result-detail-loading"
        );

        const content = modal.querySelector(
            ".result-detail-content"
        );

        if (loading) {
            loading.remove();
        }

        if (!subjects.length) {
            content.textContent = "ไม่พบรายละเอียดผลสอบ";
            return;
        }

        renderAdminResultDetailTable(
            content,
            subjects
        );

    } catch (error) {
        if (!modal.isConnected) return;

        const loading = modal.querySelector(
            ".result-detail-loading"
        );

        if (loading) {
            loading.textContent =
                `โหลดรายละเอียดไม่สำเร็จ: ${error.message}`;

            loading.classList.add("is-error");
        }

        console.error(
            "[GGN Admin] Result detail:",
            error
        );
    }
}


/* ======================================================
   RENDER DETAIL TABLE
====================================================== */

function renderAdminResultDetailTable(container, subjects) {
    if (!container) return;

    container.replaceChildren();

    const table = document.createElement("table");

    table.className =
        "table result-question-matrix";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    [
        "รายวิชา",
        ...Array.from(
            { length: 10 },
            (_, index) => `ข้อ ${index + 1}`
        )
    ].forEach(label => {
        const th = document.createElement("th");

        th.textContent = label;

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    subjects.forEach(subject => {
        const row = document.createElement("tr");

        const nameCell = document.createElement("th");

        nameCell.className = "result-subject-name";

        nameCell.textContent =
            subject.subjectName ||
            subject.subjectCode ||
            "-";

        row.appendChild(nameCell);

        const questionMap = new Map(
            (subject.questions || []).map(question => [
                Number(question.questionNo),
                question
            ])
        );

        for (let questionNo = 1; questionNo <= 10; questionNo++) {
            const cell = document.createElement("td");

            const question = questionMap.get(questionNo);

            if (!subject.attemptId || !question) {
                const empty = document.createElement("div");

                empty.className = "result-question-empty";

                empty.textContent = subject.attemptId
                    ? "ไม่มีข้อสอบ"
                    : "ยังไม่ได้สอบ";

                cell.appendChild(empty);

            } else {
                const card = createAdminResultQuestionCard(
                    subject,
                    question,
                    questionNo
                );

                cell.appendChild(card);
            }

            row.appendChild(cell);
        }

        tbody.appendChild(row);
    });

    table.appendChild(tbody);

    const wrapper = document.createElement("div");

    wrapper.className =
        "table-wrapper result-question-matrix-wrap";

    wrapper.appendChild(table);

    container.appendChild(wrapper);

    container.addEventListener(
        "change",
        handleAdminResultScoreChange
    );
}


/* ======================================================
   CREATE QUESTION CARD
====================================================== */

function createAdminResultQuestionCard(
    subject,
    question,
    questionNo
) {
    const card = document.createElement("div");

    card.className = "result-question-cell";

    const choices = [
        ["A", question.choiceA],
        ["B", question.choiceB],
        ["C", question.choiceC],
        ["D", question.choiceD]
    ]
        .filter(item => item[1])
        .map(item => `${item[0]}. ${item[1]}`)
        .join("\n");

    card.title =
        `${question.questionText || ""}\n${choices}`;

    const prompt = document.createElement("div");

    prompt.className = "result-question-number";
    prompt.textContent = `ข้อ ${questionNo}`;

    const questionText = document.createElement("div");

    questionText.className =
        "result-question-prompt";

    questionText.textContent =
        question.questionText || "ไม่มีข้อความคำถาม";

    const selectedAnswer =
        String(question.selectedAnswer || "").toUpperCase();

    const correctAnswer =
        String(question.correctAnswer || "").toUpperCase();

    const selectedText = selectedAnswer
        ? question[`choice${selectedAnswer}`] || ""
        : "ไม่ได้ตอบ";

    const correctText = correctAnswer
        ? question[`choice${correctAnswer}`] || ""
        : "";

    const answers = document.createElement("div");

    answers.className =
        "result-question-answers";

    answers.textContent =
        `ตอบ ${selectedAnswer || "—"}${
            selectedText ? `: ${selectedText}` : ""
        } · เฉลย ${correctAnswer || "—"}${
            correctText ? `: ${correctText}` : ""
        }`;

    const maxScore = Number(question.maxScore);

    const safeMaxScore =
        Number.isFinite(maxScore) && maxScore >= 0
            ? maxScore
            : 0;

    const originalScore = Number(question.awardedScore ?? 0);

    const safeOriginalScore =
        Number.isFinite(originalScore) &&
        originalScore >= 0 &&
        originalScore <= safeMaxScore
            ? originalScore
            : 0;

    const scoreLabel = document.createElement("label");

    scoreLabel.className =
        "result-question-score-label";

    scoreLabel.textContent =
        `คะแนน / ${adminFormatNumber(safeMaxScore, 2)}`;

    const input = document.createElement("input");

    input.type = "number";

    input.className =
        "form-control result-question-score";

    input.min = "0";
    input.max = String(safeMaxScore);
    input.step = "0.01";

    input.value = String(safeOriginalScore);

    input.dataset.attemptId = subject.attemptId;
    input.dataset.questionId = question.questionId;
    input.dataset.maxScore = String(safeMaxScore);
    input.dataset.originalScore = String(safeOriginalScore);

    input.title =
        question.questionText || `ข้อ ${questionNo}`;

    const status = document.createElement("small");

    status.className =
        "result-question-save-status";

    status.setAttribute("aria-live", "polite");

    card.append(
        prompt,
        questionText,
        answers,
        scoreLabel,
        input,
        status
    );

    return card;
}


/* ======================================================
   HANDLE SCORE CHANGE
====================================================== */

async function handleAdminResultScoreChange(event) {
    const input = event.target.closest(
        ".result-question-score"
    );

    if (!input) return;

    const value = Number(input.value);
    const maxScore = Number(input.dataset.maxScore);

    const originalScore = Number(
        input.dataset.originalScore ?? 0
    );

    const status = input.parentElement.querySelector(
        ".result-question-save-status"
    );

    if (!status) return;

    if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > maxScore
    ) {
        input.value = String(originalScore);

        status.textContent =
            `คะแนนต้องอยู่ระหว่าง 0-${maxScore}`;

        status.className =
            "result-question-save-status is-error";

        return;
    }

    if (value === originalScore) {
        status.textContent = "";
        status.className = "result-question-save-status";
        return;
    }

    input.disabled = true;

    status.textContent = "กำลังบันทึก...";

    status.className =
        "result-question-save-status";

    try {
        await adminRequest(
            "admin.result.adjustScore",
            {
                attemptId: input.dataset.attemptId,
                questionId: input.dataset.questionId,
                awardedScore: value
            }
        );

        // The new value becomes the rollback value only after API success.
        input.dataset.originalScore = String(value);
        input.defaultValue = String(value);

        status.textContent = "บันทึกแล้ว";

        status.className =
            "result-question-save-status is-success";

        await loadAdminResults();

    } catch (error) {
        // Restore the last successfully saved score.
        input.value = String(originalScore);

        status.textContent =
            error.message || "บันทึกไม่สำเร็จ";

        status.className =
            "result-question-save-status is-error";

        adminShowAlert(
            `บันทึกคะแนนไม่สำเร็จ: ${error.message}`,
            "danger"
        );

        console.error(
            "[GGN Admin] Adjust score:",
            error
        );

    } finally {
        input.disabled = false;
    }
}
