/**
 * ======================================================
 * GGN TEST
 * ADMIN INDIVIDUAL RESULT DETAIL
 * ======================================================
 * File: js/admin-result-detail.js
 * Version: 1.2.1
 * Updated: 2026-11-16
 *
 * Responsibilities:
 * - Open an examinee's result detail modal
 * - Show 9 subject buttons in a 4-column grid
 * - Show one selected subject's 10 questions only
 * - Display question number, correct answer, selected answer,
 *   editable answer, awarded score, and maximum score
 * - Preserve original examinee answers in ExamResponses.selectedAnswer
 * - Save adjusted answer and score together
 *
 * Dependencies loaded before this file:
 * - js/api.js
 * - js/admin.js helpers (adminRequest, adminShowAlert,
 *   adminFormatNumber, loadAdminResults)
 * ======================================================
 */

"use strict";

(function () {
    const STYLE_ID = "ggn-result-detail-style-v121";
    const MODAL_ID = "admin-result-detail-modal";

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            #${MODAL_ID} { z-index: 1100; }
            #${MODAL_ID} .modal-result-detail {
                width: min(920px, 100%);
                max-width: 920px;
                max-height: 92vh;
                display: flex;
                flex-direction: column;
            }
            #${MODAL_ID} .modal-header { flex: 0 0 auto; }
            #${MODAL_ID} .modal-body {
                overflow-y: auto;
                min-height: 0;
            }
            #${MODAL_ID} .result-detail-person {
                margin-top: 4px;
                color: #64748b;
                font-size: 13px;
                overflow-wrap: anywhere;
            }
            #${MODAL_ID} .result-subject-picker {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 10px;
            }
            #${MODAL_ID} .result-subject-button {
                min-width: 0;
                min-height: 76px;
                padding: 10px 7px;
                border: 1px solid #dbe3ee;
                border-radius: 12px;
                background: #fff;
                color: #1e293b;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                cursor: pointer;
                transition: border-color .15s ease, background .15s ease,
                    box-shadow .15s ease, transform .15s ease;
            }
            #${MODAL_ID} .result-subject-button:hover:not(:disabled) {
                border-color: #60a5fa;
                background: #eff6ff;
                box-shadow: 0 3px 10px rgba(37, 99, 235, .08);
                transform: translateY(-1px);
            }
            #${MODAL_ID} .result-subject-button:focus-visible {
                outline: 3px solid rgba(59, 130, 246, .25);
                outline-offset: 2px;
            }
            #${MODAL_ID} .result-subject-button:disabled {
                cursor: not-allowed;
                opacity: .55;
                background: #f8fafc;
            }
            #${MODAL_ID} .result-subject-name {
                width: 100%;
                font-size: 12px;
                line-height: 1.35;
                font-weight: 700;
                text-align: center;
                overflow-wrap: anywhere;
            }
            #${MODAL_ID} .result-subject-score {
                font-size: 16px;
                line-height: 1.2;
                font-weight: 800;
                color: #1d4ed8;
                font-variant-numeric: tabular-nums;
            }
            #${MODAL_ID} .result-subject-status {
                font-size: 10px;
                color: #64748b;
            }
            #${MODAL_ID} .result-detail-subject-heading {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 12px;
            }
            #${MODAL_ID} .result-detail-subject-title {
                margin: 0;
                font-size: 16px;
                font-weight: 800;
                color: #1e293b;
            }
            #${MODAL_ID} .result-detail-subject-total {
                color: #1d4ed8;
                font-size: 14px;
                font-weight: 800;
                font-variant-numeric: tabular-nums;
            }
            #${MODAL_ID} .result-detail-table-wrap {
                width: 100%;
                overflow-x: auto;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
            }
            #${MODAL_ID} .result-detail-table {
                width: 100%;
                min-width: 440px;
                border-collapse: collapse;
                table-layout: fixed;
                margin: 0;
            }
            #${MODAL_ID} .result-detail-table th,
            #${MODAL_ID} .result-detail-table td {
                padding: 10px 8px;
                text-align: center;
                vertical-align: middle;
                border-bottom: 1px solid #e2e8f0;
                font-size: 13px;
            }
            #${MODAL_ID} .result-detail-table thead th {
                background: #f1f5f9;
                color: #334155;
                font-weight: 800;
                white-space: nowrap;
            }
            #${MODAL_ID} .result-detail-table tbody tr:last-child td {
                border-bottom: 0;
            }
            #${MODAL_ID} .result-detail-table tbody tr:nth-child(even) {
                background: #fafcff;
            }
            #${MODAL_ID} .result-detail-answer {
                font-weight: 800;
                font-size: 15px;
            }
            #${MODAL_ID} .result-detail-answer.is-correct { color: #15803d; }
            #${MODAL_ID} .result-detail-answer.is-wrong { color: #b91c1c; }
            #${MODAL_ID} .result-detail-answer-select {
                width: 68px;
                max-width: 100%;
                min-height: 36px;
                padding: 5px 6px;
                text-align: center;
                text-align-last: center;
                font-size: 14px;
                font-weight: 700;
            }
            #${MODAL_ID} .result-detail-score-input {
                width: 66px;
                max-width: 100%;
                min-height: 36px;
                padding: 5px 6px;
                text-align: center;
                font-size: 14px;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }
            #${MODAL_ID} .result-detail-score-input.is-invalid {
                border-color: #dc2626;
                box-shadow: 0 0 0 2px rgba(220, 38, 38, .10);
            }
            #${MODAL_ID} .result-detail-max-score {
                color: #475569;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
            }
            #${MODAL_ID} .result-detail-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 10px;
                padding: 13px 19px;
                border-top: 1px solid #e2e8f0;
                background: #f8fafc;
            }
            #${MODAL_ID} .result-detail-save-message {
                min-height: 18px;
                font-size: 12px;
                color: #64748b;
            }
            #${MODAL_ID} .result-detail-save-message.is-error { color: #b91c1c; }
            #${MODAL_ID} .result-detail-save-message.is-success { color: #15803d; }
            #${MODAL_ID} .result-detail-empty {
                padding: 18px 10px;
                text-align: center;
                color: #64748b;
                font-size: 13px;
            }
            @media (max-width: 560px) {
                #${MODAL_ID} { padding: 8px; }
                #${MODAL_ID} .modal-result-detail { max-height: 96vh; }
                #${MODAL_ID} .modal-body { padding: 13px 12px; }
                #${MODAL_ID} .result-subject-picker { gap: 7px; }
                #${MODAL_ID} .result-subject-button {
                    min-height: 68px;
                    padding: 8px 4px;
                    border-radius: 9px;
                }
                #${MODAL_ID} .result-subject-name { font-size: 10px; }
                #${MODAL_ID} .result-subject-score { font-size: 14px; }
                #${MODAL_ID} .result-detail-footer { padding: 11px 12px; }
            }
        `;
        document.head.appendChild(style);
    }

    function formatNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "0";
        return typeof adminFormatNumber === "function"
            ? adminFormatNumber(number, 2).replace(/\.00$/, "")
            : String(number);
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined && text !== null) element.textContent = String(text);
        return element;
    }

    function setSaveMessage(modal, message, state) {
        const target = modal.querySelector(".result-detail-save-message");
        if (!target) return;
        target.textContent = message || "";
        target.classList.toggle("is-error", state === "error");
        target.classList.toggle("is-success", state === "success");
    }

    function hasUnsavedChanges(modal) {
        const scoreChanged = Array.from(modal.querySelectorAll(".result-detail-score-input:not(:disabled)"))
            .some(input => Math.abs(Number(input.value) - Number(input.dataset.originalScore)) > 0.000001);
        const answerChanged = Array.from(modal.querySelectorAll(".result-detail-answer-select:not(:disabled)"))
            .some(select => select.value !== (select.dataset.originalAnswer || ""));
        return scoreChanged || answerChanged;
    }

    function confirmDiscardChanges(modal) {
        if (!hasUnsavedChanges(modal)) return true;
        return window.confirm("มีคะแนนที่แก้ไขแล้วยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?");
    }

    function calculateSubjectScore(subject) {
        const questions = Array.isArray(subject.questions) ? subject.questions : [];
        return questions.reduce((sum, question) => {
            const value = Number(question.awardedScore ?? 0);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
    }

    function calculateSubjectMax(subject) {
        const questions = Array.isArray(subject.questions) ? subject.questions : [];
        return questions.reduce((sum, question) => {
            const value = Number(question.maxScore ?? 0);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
    }

    function updateSubjectButton(modal, subject) {
        const button = Array.from(modal.querySelectorAll(".result-subject-button"))
            .find(item => item.dataset.subjectId === String(subject.subjectId));
        if (!button) return;
        const score = calculateSubjectScore(subject);
        const max = calculateSubjectMax(subject);
        const scoreElement = button.querySelector(".result-subject-score");
        if (scoreElement) scoreElement.textContent = `${formatNumber(score)} / ${formatNumber(max)}`;
    }

    function renderSubjectPicker(modal, subjects, onSelect) {
        const picker = modal.querySelector(".result-subject-picker");
        picker.replaceChildren();

        subjects.forEach((subject, index) => {
            const attempted = Boolean(subject.attemptId) && Array.isArray(subject.questions) && subject.questions.length > 0;
            const button = makeElement("button", "result-subject-button");
            button.type = "button";
            button.disabled = !attempted;
            button.dataset.subjectId = String(subject.subjectId || `subject-${index + 1}`);
            button.appendChild(makeElement(
                "span",
                "result-subject-name",
                subject.subjectName || subject.subjectCode || `วิชาที่ ${index + 1}`
            ));

            if (attempted) {
                button.appendChild(makeElement(
                    "span",
                    "result-subject-score",
                    `${formatNumber(calculateSubjectScore(subject))} / ${formatNumber(calculateSubjectMax(subject))}`
                ));
            } else {
                button.appendChild(makeElement("span", "result-subject-status", "ยังไม่สอบ"));
            }

            button.addEventListener("click", () => onSelect(subject));
            picker.appendChild(button);
        });
    }

    function renderSubjectQuestions(modal, subject) {
        const view = modal.querySelector(".result-detail-subject-view");
        const pickerView = modal.querySelector(".result-detail-picker-view");
        const title = modal.querySelector(".result-detail-subject-title");
        const total = modal.querySelector(".result-detail-subject-total");
        const tbody = modal.querySelector(".result-detail-table tbody");
        const saveButton = modal.querySelector("[data-result-save]");

        pickerView.classList.add("hidden");
        view.classList.remove("hidden");
        title.textContent = subject.subjectName || subject.subjectCode || "รายละเอียดรายวิชา";

        const questions = (Array.isArray(subject.questions) ? subject.questions : [])
            .slice()
            .sort((a, b) => Number(a.questionNo || 0) - Number(b.questionNo || 0));
        const questionMap = new Map(questions.map(q => [Number(q.questionNo), q]));
        tbody.replaceChildren();

        for (let questionNo = 1; questionNo <= 10; questionNo++) {
            const question = questionMap.get(questionNo);
            const row = document.createElement("tr");

            row.appendChild(makeElement("td", "", questionNo));
            row.appendChild(makeElement(
                "td",
                `result-detail-answer ${question && question.correctAnswer ? "is-correct" : ""}`,
                question?.correctAnswer || "—"
            ));
            const answerCell = document.createElement("td");
            const answerSelect = document.createElement("select");
            answerSelect.className = "form-control result-detail-answer-select";
            answerSelect.setAttribute("aria-label", `คำตอบที่แสดงข้อ ${questionNo}`);
            ["A", "B", "C", "D"].forEach(optionValue => {
                const option = document.createElement("option");
                option.value = optionValue;
                option.textContent = optionValue;
                answerSelect.appendChild(option);
            });
            answerSelect.value = question?.selectedAnswer || "";
            if (!answerSelect.value) {
                const blank = document.createElement("option");
                blank.value = "";
                blank.textContent = "—";
                blank.selected = true;
                answerSelect.insertBefore(blank, answerSelect.firstChild);
            }
            answerSelect.dataset.originalAnswer = question?.selectedAnswer || "";
            answerSelect.dataset.originalSelectedAnswer = question?.originalSelectedAnswer || "";
            answerSelect.dataset.correctAnswer = question?.correctAnswer || "";
            answerSelect.dataset.questionId = question?.questionId || "";
            answerSelect.disabled = !question || !question.questionId;
            answerCell.appendChild(answerSelect);
            row.appendChild(answerCell);

            const scoreCell = document.createElement("td");
            const input = document.createElement("input");
            input.type = "number";
            input.className = "form-control result-detail-score-input";
            input.min = "0";
            input.max = String(question?.maxScore ?? 0);
            input.step = "0.01";
            input.inputMode = "decimal";
            input.value = question ? String(Number(question.awardedScore ?? 0)) : "0";
            input.dataset.questionNo = String(questionNo);
            input.dataset.questionId = question?.questionId || "";
            input.dataset.attemptId = subject.attemptId || "";
            input.dataset.maxScore = String(question?.maxScore ?? 0);
            input.dataset.originalScore = input.value;
            input.disabled = !question || !question.questionId;
            input.setAttribute("aria-label", `คะแนนข้อ ${questionNo}`);
            input.addEventListener("input", () => {
                input.classList.remove("is-invalid");
                const max = Number(input.dataset.maxScore);
                if (answerSelect.dataset.correctAnswer && max > 0 && Number(input.value) >= max) {
                    answerSelect.value = answerSelect.dataset.correctAnswer;
                }
            });
            scoreCell.appendChild(input);
            row.appendChild(scoreCell);

            row.appendChild(makeElement(
                "td",
                "result-detail-max-score",
                question ? formatNumber(question.maxScore) : "—"
            ));

            tbody.appendChild(row);
        }

        const score = calculateSubjectScore(subject);
        const max = calculateSubjectMax(subject);
        total.textContent = `คะแนนรวม ${formatNumber(score)} / ${formatNumber(max)}`;
        saveButton.disabled = false;
        saveButton.textContent = "บันทึกคะแนน";
        setSaveMessage(modal, "แก้ไขคำตอบหรือคะแนน แล้วกดบันทึกด้านล่าง", "");
        modal._selectedSubject = subject;
    }

    async function saveSubjectScores(modal, subjects, person) {
        const subject = modal._selectedSubject;
        if (!subject || !subject.attemptId) return;

        const saveButton = modal.querySelector("[data-result-save]");
        const inputs = Array.from(modal.querySelectorAll(".result-detail-score-input:not(:disabled)"));
        const changes = [];
        let validationError = "";

        inputs.forEach(input => {
            const raw = input.value.trim();
            const value = Number(raw);
            const max = Number(input.dataset.maxScore);
            if (!raw || !Number.isFinite(value) || value < 0 || value > max) {
                validationError = `คะแนนข้อ ${input.dataset.questionNo} ต้องอยู่ระหว่าง 0 ถึง ${formatNumber(max)}`;
                input.classList.add("is-invalid");
                return;
            }
            input.classList.remove("is-invalid");
            const answerSelect = input.closest("tr")?.querySelector(".result-detail-answer-select");
            let selectedAnswer = answerSelect ? answerSelect.value : "";
            // Full credit must never be displayed with an incorrect selected choice.
            if (value >= max && max > 0 && answerSelect?.dataset.correctAnswer) {
                selectedAnswer = answerSelect.dataset.correctAnswer;
                answerSelect.value = selectedAnswer;
            }
            const answerChanged = answerSelect && selectedAnswer !== (answerSelect.dataset.originalAnswer || "");
            const scoreChanged = Math.abs(value - Number(input.dataset.originalScore)) > 0.000001;
            if (scoreChanged || answerChanged) {
                changes.push({
                    input,
                    answerSelect,
                    questionNo: Number(input.dataset.questionNo),
                    attemptId: input.dataset.attemptId,
                    questionId: input.dataset.questionId,
                    awardedScore: value,
                    selectedAnswer
                });
            }
        });

        if (validationError) {
            setSaveMessage(modal, validationError, "error");
            return;
        }

        if (!changes.length) {
            setSaveMessage(modal, "ไม่มีคะแนนที่เปลี่ยนแปลง", "success");
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "กำลังบันทึก...";
        inputs.forEach(input => { input.disabled = true; });
        modal.querySelectorAll(".result-detail-answer-select").forEach(select => { select.disabled = true; });
        setSaveMessage(modal, `กำลังบันทึก ${changes.length} ข้อ...`, "");

        const saved = [];
        const failed = [];

        for (const change of changes) {
            try {
                await adminRequest("admin.result.adjustScore", {
                    attemptId: change.attemptId,
                    questionId: change.questionId,
                    awardedScore: change.awardedScore,
                    selectedAnswer: change.selectedAnswer
                });
                change.input.dataset.originalScore = String(change.awardedScore);
                if (change.answerSelect) {
                    change.answerSelect.dataset.originalAnswer = change.selectedAnswer;
                    change.answerSelect.dataset.originalSelectedAnswer = change.answerSelect.dataset.originalSelectedAnswer || "";
                }
                saved.push(change);
            } catch (error) {
                failed.push({ change, error });
            }
        }

        inputs.forEach(input => { input.disabled = false; });
        modal.querySelectorAll(".result-detail-answer-select").forEach(select => {
            select.disabled = !select.dataset.questionId;
        });
        saveButton.disabled = false;
        saveButton.textContent = "บันทึกคะแนน";

        // Update local subject data for every successfully saved score.
        saved.forEach(change => {
            const question = (subject.questions || []).find(q =>
                String(q.questionId) === String(change.questionId)
            );
            if (question) {
                question.awardedScore = change.awardedScore;
                question.selectedAnswer = change.selectedAnswer;
                question.adjustedAnswer = change.selectedAnswer;
            }
        });
        subject.score = calculateSubjectScore(subject);
        subject.maxScore = calculateSubjectMax(subject);
        updateSubjectButton(modal, subject);

        // Refresh the result list so the 9-subject scores reflect the saved values.
        if (saved.length && typeof loadAdminResults === "function") {
            try {
                await loadAdminResults();
            } catch (error) {
                console.warn("[GGN Result Detail] Refresh results failed:", error);
            }
        }

        // Update the visible total even when only some changes succeeded.
        const total = modal.querySelector(".result-detail-subject-total");
        if (total) {
            total.textContent = `คะแนนรวม ${formatNumber(calculateSubjectScore(subject))} / ${formatNumber(calculateSubjectMax(subject))}`;
        }

        if (failed.length) {
            const first = failed[0];
            const msg = `บันทึกสำเร็จ ${saved.length} ข้อ แต่ไม่สำเร็จ ${failed.length} ข้อ (ข้อ ${first.change.questionNo}: ${first.error.message || "เกิดข้อผิดพลาด"})`;
            setSaveMessage(modal, msg, "error");
            if (typeof adminShowAlert === "function") adminShowAlert(msg, "danger");
            return;
        }

        const successMessage = `บันทึกคำตอบและคะแนนเรียบร้อย ${saved.length} ข้อ`;
        setSaveMessage(modal, successMessage, "success");
        if (typeof adminShowAlert === "function") adminShowAlert(successMessage, "success");

        // Rebuild the picker labels using the latest in-memory values.
        renderSubjectPicker(modal, subjects, selected => {
            renderSubjectQuestions(modal, selected);
        });
    }

    async function openDetail(person) {
        if (!person || !person.nationalId || !person.cohortId) {
            if (typeof adminShowAlert === "function") {
                adminShowAlert("ข้อมูลผู้เข้าสอบไม่ครบถ้วน", "danger");
            }
            return;
        }

        ensureStyles();
        const oldModal = document.getElementById(MODAL_ID);
        if (oldModal) oldModal.remove();

        const modal = document.createElement("div");
        modal.id = MODAL_ID;
        modal.className = "modal-overlay";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.innerHTML = `
            <div class="modal modal-lg modal-result-detail">
                <div class="modal-header">
                    <div>
                        <h3 class="modal-title">ตรวจสอบและแก้ไขคะแนนรายบุคคล</h3>
                        <div class="result-detail-person"></div>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" data-result-close>ปิด</button>
                </div>
                <div class="modal-body">
                    <div class="result-detail-loading">กำลังโหลดข้อมูลผลสอบ...</div>
                    <section class="result-detail-picker-view hidden">
                        <div class="result-detail-help" style="margin-bottom:12px;">
                            เลือกวิชาที่ต้องการตรวจสอบหรือแก้ไขคำตอบและคะแนน<br>เมื่อกำหนดคะแนนเต็ม ระบบจะปรับคำตอบที่แสดงให้ตรงกับเฉลยโดยอัตโนมัติ
                        </div>
                        <div class="result-subject-picker"></div>
                    </section>
                    <section class="result-detail-subject-view hidden">
                        <div class="result-detail-subject-heading">
                            <button type="button" class="btn btn-secondary btn-sm" data-result-back>← กลับไปเลือกวิชา</button>
                            <h4 class="result-detail-subject-title"></h4>
                            <div class="result-detail-subject-total"></div>
                        </div>
                        <div class="result-detail-table-wrap">
                            <table class="result-detail-table">
                                <thead>
                                    <tr>
                                        <th style="width:20%;">ข้อ</th>
                                        <th style="width:20%;">เฉลย</th>
                                        <th style="width:20%;">ตอบ</th>
                                        <th style="width:20%;">คะแนน</th>
                                        <th style="width:20%;">เต็ม</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </section>
                    <div class="result-detail-load-error hidden" role="alert"></div>
                </div>
                <div class="result-detail-footer hidden">
                    <div class="result-detail-save-message" aria-live="polite"></div>
                    <button type="button" class="btn btn-primary" data-result-save>บันทึกคะแนน</button>
                </div>
            </div>`;

        document.body.appendChild(modal);
        modal.querySelector(".result-detail-person").textContent =
            `${person.examineeName || "-"} · ${person.nationalId}`;

        const close = () => {
            if (!confirmDiscardChanges(modal)) return;
            modal.remove();
        };
        modal.querySelector("[data-result-close]").addEventListener("click", close);
        modal.addEventListener("click", event => {
            if (event.target === modal) close();
        });
        modal.addEventListener("keydown", event => {
            if (event.key === "Escape") close();
        });

        try {
            const detail = await adminRequest("admin.result.detail", {
                nationalId: person.nationalId,
                cohortId: person.cohortId
            });
            if (!modal.isConnected) return;

            const subjects = Array.isArray(detail?.subjects) ? detail.subjects : [];
            modal.querySelector(".result-detail-loading").classList.add("hidden");
            modal.querySelector(".result-detail-picker-view").classList.remove("hidden");
            modal.querySelector(".result-detail-footer").classList.add("hidden");

            if (!subjects.length) {
                const empty = makeElement("div", "result-detail-empty", "ไม่พบข้อมูลรายวิชา");
                modal.querySelector(".result-detail-picker-view").appendChild(empty);
                return;
            }

            renderSubjectPicker(modal, subjects, subject => {
                renderSubjectQuestions(modal, subject);
                modal.querySelector(".result-detail-footer").classList.remove("hidden");
            });

            modal.querySelector("[data-result-back]").addEventListener("click", () => {
                if (!confirmDiscardChanges(modal)) return;
                modal.querySelector(".result-detail-subject-view").classList.add("hidden");
                modal.querySelector(".result-detail-picker-view").classList.remove("hidden");
                modal.querySelector(".result-detail-footer").classList.add("hidden");
                modal._selectedSubject = null;
            });

            modal.querySelector("[data-result-save]").addEventListener("click", () => {
                saveSubjectScores(modal, subjects, person);
            });
        } catch (error) {
            if (!modal.isConnected) return;
            modal.querySelector(".result-detail-loading").classList.add("hidden");
            const errorBox = modal.querySelector(".result-detail-load-error");
            errorBox.textContent = `โหลดรายละเอียดไม่สำเร็จ: ${error.message || "เกิดข้อผิดพลาด"}`;
            errorBox.classList.remove("hidden");
        }
    }

    // Global entry point called by admin-results.js.
    window.openAdminExamineeResult = openDetail;
})();
