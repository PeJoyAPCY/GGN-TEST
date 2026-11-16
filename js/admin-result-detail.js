
/**
 * ======================================================
 * GGN TEST
 * ADMIN RESULT DETAIL
 * ======================================================
 *
 * File: js/admin-result-detail.js
 * Version: 1.0.1
 * Updated: 2026-11-16
 *
 * PURPOSE
 * - Display individual examinee results
 * - Display questions and answers by subject
 * - Allow Admin to adjust awarded score
 * - Save adjusted score immediately
 * ======================================================
 */

"use strict";

let GGNAdminResultDetailRequestVersion = 0;


/* ======================================================
   1. MODAL
====================================================== */

function getAdminResultDetailModal() {
    let modal = adminElement("admin-result-detail-modal");

    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "admin-result-detail-modal";
    modal.className = "modal-overlay hidden";
    modal.hidden = true;

    modal.innerHTML = `
        <div class="modal modal-result-detail"
             role="dialog"
             aria-modal="true"
             aria-labelledby="admin-result-detail-title">

            <div class="modal-header">
                <div>
                    <h2 id="admin-result-detail-title">
                        รายละเอียดผลสอบ
                    </h2>
                    <div id="admin-result-detail-person"
                         class="text-muted"></div>
                </div>

                <button type="button"
                        id="admin-result-detail-close"
                        class="btn btn-secondary">
                    ปิด
                </button>
            </div>

            <div id="admin-result-detail-status"
                 class="alert hidden"
                 role="status"
                 aria-live="polite"></div>

            <div id="admin-result-detail-loading"
                 class="loading">
                กำลังโหลดรายละเอียดผลสอบ...
            </div>

            <div id="admin-result-detail-content"></div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeAdminResultDetail();
        }
    });

    modal.querySelector(
        "#admin-result-detail-close"
    ).addEventListener("click", closeAdminResultDetail);

    return modal;
}


function closeAdminResultDetail() {
    GGNAdminResultDetailRequestVersion += 1;

    adminShow("admin-result-detail-modal", false);
}


/* ======================================================
   2. OPEN DETAIL
====================================================== */

async function openAdminExamineeResult(person) {
    if (!person || !person.nationalId) {
        adminShowAlert(
            "ไม่พบเลขบัตรประชาชนของผู้เข้าสอบ",
            "error"
        );

        return;
    }

    const requestVersion =
        ++GGNAdminResultDetailRequestVersion;

    const modal = getAdminResultDetailModal();

    adminText(
        "admin-result-detail-person",
        `${person.examineeName || "-"} | ${person.nationalId}`
    );

    const content = adminElement(
        "admin-result-detail-content"
    );

    const loading = adminElement(
        "admin-result-detail-loading"
    );

    const status = adminElement(
        "admin-result-detail-status"
    );

    if (content) content.replaceChildren();

    if (status) {
        status.hidden = true;
        status.classList.add("hidden");
        status.textContent = "";
    }

    if (loading) {
        loading.hidden = false;
        loading.classList.remove("hidden");
    }

    adminShow("admin-result-detail-modal", true);

    try {
        const response = await adminRequest(
            "admin.result.detail",
            {
                nationalId: person.nationalId,
                cohortId: person.cohortId
            }
        );

        if (
            requestVersion !==
            GGNAdminResultDetailRequestVersion ||
            !modal.isConnected
        ) {
            return;
        }

        if (loading) {
            loading.hidden = true;
            loading.classList.add("hidden");
        }

        const subjects = Array.isArray(response.subjects)
            ? response.subjects
            : [];

        renderAdminResultDetail(
            subjects,
            content
        );

    } catch (error) {
        if (
            requestVersion !==
            GGNAdminResultDetailRequestVersion ||
            !modal.isConnected
        ) {
            return;
        }

        if (loading) {
            loading.hidden = true;
            loading.classList.add("hidden");
        }

        if (status) {
            status.className = "alert alert-danger";
            status.textContent =
                `โหลดรายละเอียดผลสอบไม่สำเร็จ: ${error.message}`;
            status.hidden = false;
        }

        console.error(
            "[GGN Admin] Result detail:",
            error
        );
    }
}


/* ======================================================
   3. RENDER DETAIL
====================================================== */

function renderAdminResultDetail(subjects, container) {
    if (!container) return;

    container.replaceChildren();

    if (!subjects.length) {
        const empty = document.createElement("div");

        empty.className = "empty-state";
        empty.textContent =
            "ไม่พบข้อมูลรายละเอียดการสอบของผู้เข้าสอบรายนี้";

        container.appendChild(empty);
        return;
    }

    subjects.forEach(subject => {
        const section = document.createElement("section");
        section.className = "result-detail-subject";

        const heading = document.createElement("h3");

        heading.textContent =
            `${subject.subjectName || subject.subjectCode || "รายวิชา"} ` +
            `(${subject.subjectCode || "-"})`;

        section.appendChild(heading);

        const questions = Array.isArray(subject.questions)
            ? subject.questions
            : [];

        if (!questions.length) {
            const empty = document.createElement("p");

            empty.className = "text-muted";
            empty.textContent = "ไม่มีรายละเอียดข้อสอบ";

            section.appendChild(empty);
            container.appendChild(section);
            return;
        }

        const tableWrapper = document.createElement("div");
        tableWrapper.className = "table-wrapper";

        const table = document.createElement("table");
        table.className = "table result-detail-table";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        [
            "ข้อ",
            "คำถาม",
            "คำตอบที่เลือก",
            "เฉลย",
            "คะแนนที่ได้",
            "คะแนนเต็ม"
        ].forEach(label => {
            const th = document.createElement("th");
            th.textContent = label;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);

        const tbody = document.createElement("tbody");

        questions.forEach(question => {
            const row = document.createElement("tr");

            row.appendChild(
                adminCreateCell(question.questionNo ?? "-")
            );

            const questionCell = document.createElement("td");

            const questionText = document.createElement("div");
            questionText.className = "question-text";
            questionText.textContent =
                question.questionText || "(ไม่มีข้อความคำถาม)";

            questionCell.appendChild(questionText);

            const choices = document.createElement("div");
            choices.className = "question-choices";

            ["A", "B", "C", "D"].forEach(letter => {
                const choice = document.createElement("div");

                choice.textContent =
                    `${letter}. ${question[`choice${letter}`] || "-"}`;

                if (
                    String(question.correctAnswer || "")
                        .toUpperCase() === letter
                ) {
                    choice.classList.add("is-correct");
                }

                choices.appendChild(choice);
            });

            questionCell.appendChild(choices);
            row.appendChild(questionCell);

            row.appendChild(
                adminCreateCell(question.selectedAnswer || "-")
            );

            row.appendChild(
                adminCreateCell(question.correctAnswer || "-")
            );

            const scoreCell = document.createElement("td");
            const scoreInput = document.createElement("input");

            scoreInput.type = "number";
            scoreInput.className = "form-control result-score-input";
            scoreInput.min = "0";
            scoreInput.max = String(question.maxScore ?? 0);
            scoreInput.step = "0.01";

            scoreInput.value =
                String(question.awardedScore ?? 0);

            scoreInput.dataset.originalScore =
                String(question.awardedScore ?? 0);

            scoreInput.dataset.attemptId =
                String(subject.attemptId || "");

            scoreInput.dataset.questionId =
                String(question.questionId || "");

            scoreInput.dataset.maxScore =
                String(question.maxScore ?? 0);

            scoreInput.addEventListener("change", () => {
                saveAdminAdjustedScore(scoreInput);
            });

            scoreCell.appendChild(scoreInput);
            row.appendChild(scoreCell);

            row.appendChild(
                adminCreateCell(
                    adminFormatNumber(question.maxScore ?? 0, 2)
                )
            );

            tbody.appendChild(row);
        });

        table.append(thead, tbody);
        tableWrapper.appendChild(table);
        section.appendChild(tableWrapper);

        container.appendChild(section);
    });
}


/* ======================================================
   4. SAVE ADJUSTED SCORE
====================================================== */

async function saveAdminAdjustedScore(input) {
    if (!input || input.disabled) return;

    const previousScore = Number(
        input.dataset.originalScore || 0
    );

    const nextScore = Number(input.value);

    const maxScore = Number(
        input.dataset.maxScore || 0
    );

    const attemptId =
        input.dataset.attemptId || "";

    const questionId =
        input.dataset.questionId || "";

    if (!attemptId || !questionId) {
        input.value = String(previousScore);

        adminShowAlert(
            "ข้อมูล attemptId หรือ questionId ไม่ครบ ไม่สามารถบันทึกคะแนนได้",
            "error"
        );

        return;
    }

    if (
        !Number.isFinite(nextScore) ||
        nextScore < 0 ||
        nextScore > maxScore
    ) {
        input.value = String(previousScore);

        adminShowAlert(
            `คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxScore}`,
            "warning"
        );

        return;
    }

    if (nextScore === previousScore) {
        return;
    }

    input.disabled = true;

    try {
        await adminRequest(
            "admin.result.adjustScore",
            {
                attemptId,
                questionId,
                awardedScore: nextScore
            }
        );

        input.dataset.originalScore = String(nextScore);
        input.value = String(nextScore);

        const status = adminElement(
            "admin-result-detail-status"
        );

        if (status) {
            status.className = "alert alert-success";
            status.textContent =
                "บันทึกคะแนนที่แก้ไขเรียบร้อยแล้ว";
            status.hidden = false;
        }

        await loadAdminResults();

    } catch (error) {
        input.value = String(previousScore);

        adminShowAlert(
            `บันทึกคะแนนไม่สำเร็จ: ${error.message}`,
            "error"
        );

        console.error(
            "[GGN Admin] Adjust score:",
            error
        );

    } finally {
        input.disabled = false;
    }
}