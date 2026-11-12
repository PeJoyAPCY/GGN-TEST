/**
 * ======================================================
 * GGN TEST
 * ADMIN PANEL
 * ======================================================
 *
 * File: js/admin.js
 * Version: 2.0.0
 * Updated: 2026-11-11
 *
 * Changes:
 * - Compact Dashboard with 9 subject cards
 * - Subject exam open/close switch
 * - Question management with correct API field names
 * - Exam results and score adjustment
 * - Cohort filter
 * - Individual and subject summary
 * - Prevent duplicate initialization and event binding
 * - Prevent overlapping section requests
 * - No Admin login or PIN on frontend
 *
 * Dependencies:
 * - js/api.js
 * - admin.html
 * ======================================================
 */

"use strict";


/* ======================================================
   1. STATE
====================================================== */

const GGNAdmin = {
    admin: null,

    subjects: [],
    examSets: [],
    questions: [],
    results: [],
    cohorts: [],

    summary: null,

    currentSection: "dashboard",
    currentSummaryView: "individual",

    currentQuestion: null,
    currentResult: null,

    initialized: false,
    navigationBound: false,
    eventsBound: false,
    filtersBound: false,

    sectionRequests: {
        dashboard: null,
        questions: null,
        results: null,
        summary: null
    }
};


/* ======================================================
   2. DOM HELPERS
====================================================== */

function adminElement(id) {
    return document.getElementById(id);
}


function adminText(id, value) {
    const element = adminElement(id);

    if (!element) return;

    element.textContent =
        value === null || value === undefined
            ? ""
            : String(value);
}


function adminShow(id, visible = true) {
    const element = adminElement(id);

    if (element) {
        element.hidden = !visible;
    }
}


function adminSetLoading(id, visible) {
    adminShow(id, visible);
}


function adminEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[char];
    });
}


function adminFormatNumber(value, decimals = 0) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("th-TH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}


function adminFormatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("th-TH", {
        dateStyle: "short",
        timeStyle: "short"
    });
}


function adminNormalizeBoolean(value) {
    return (
        value === true ||
        String(value).toUpperCase() === "TRUE" ||
        String(value) === "1"
    );
}


function adminGetData(response) {
    if (
        response &&
        typeof response === "object" &&
        Object.prototype.hasOwnProperty.call(response, "data")
    ) {
        return response.data;
    }

    return response;
}


function adminGetArray(response, keys = []) {
    const data = adminGetData(response);

    if (Array.isArray(data)) {
        return data;
    }

    if (data && typeof data === "object") {
        for (const key of keys) {
            if (Array.isArray(data[key])) {
                return data[key];
            }
        }
    }

    return [];
}


function adminCheckResponse(response) {
    if (!response) {
        throw new Error("ไม่ได้รับข้อมูลตอบกลับจากระบบ");
    }

    if (response.success === false) {
        throw new Error(
            response.message ||
            response.error ||
            "ระบบไม่สามารถดำเนินการได้"
        );
    }

    return adminGetData(response);
}


function adminCreateCell(value, className = "") {
    const cell = document.createElement("td");

    cell.textContent =
        value === null || value === undefined
            ? "-"
            : String(value);

    if (className) {
        cell.className = className;
    }

    return cell;
}


function adminCreateButton(text, className, onClick) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = text;

    button.addEventListener("click", onClick);

    return button;
}


/* ======================================================
   3. API
====================================================== */

async function adminRequest(action, payload = {}) {
    if (
        typeof GGNApi === "undefined" ||
        typeof GGNApi.request !== "function"
    ) {
        throw new Error(
            "ไม่พบ GGNApi กรุณาตรวจสอบไฟล์ js/api.js"
        );
    }

    const response = await GGNApi.request(action, payload);

    return adminCheckResponse(response);
}


/* ======================================================
   4. ALERT / MESSAGE
====================================================== */


function adminShowAlert(message, type = "info") {
    const container =
        adminElement("admin-global-alert") ||
        adminElement("global-alert");

    if (!container) {
        window.alert(message);
        return;
    }

    container.textContent = message;
    container.className = `alert alert-${type}`;
    container.hidden = false;
}

function adminHideAlert() {
    const container =
        adminElement("admin-global-alert") ||
        adminElement("global-alert");

    if (container) {
        container.hidden = true;
        container.textContent = "";
    }
}



function adminShowFormError(id, message) {
    const element = adminElement(id);

    if (!element) return;

    element.textContent = message || "";
    element.hidden = !message;
}


/* ======================================================
   5. NAVIGATION
====================================================== */

function adminSwitchSection(sectionName) {
    const allowedSections = [
        "dashboard",
        "questions",
        "results",
        "summary"
    ];

    if (!allowedSections.includes(sectionName)) {
        return;
    }

    GGNAdmin.currentSection = sectionName;

    allowedSections.forEach(section => {
        const sectionElement = adminElement(
            `${section}-section`
        );

        if (sectionElement) {
            sectionElement.hidden = section !== sectionName;
            sectionElement.classList.toggle(
                "hidden",
                section !== sectionName
            );
        }
    });

    document.querySelectorAll(".sidebar-link[data-section]")
        .forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.section === sectionName
            );
        });

    adminHideAlert();

    if (sectionName === "dashboard") {
        loadAdminDashboard();
    }

    if (sectionName === "questions") {
        loadAdminQuestions();
    }

    if (sectionName === "results") {
        loadAdminResults();
    }

    if (sectionName === "summary") {
        loadAdminSummary();
    }
}


function setupAdminNavigation() {
    if (GGNAdmin.navigationBound) return;

    document.querySelectorAll(".sidebar-link[data-section]")
        .forEach(button => {
            button.addEventListener("click", () => {
                adminSwitchSection(button.dataset.section);
            });
        });

    GGNAdmin.navigationBound = true;
}


/* ======================================================
   6. DASHBOARD
====================================================== */

async function loadAdminDashboard() {
    if (GGNAdmin.sectionRequests.dashboard) {
        return GGNAdmin.sectionRequests.dashboard;
    }

    const request = (async () => {
        adminSetLoading("dashboard-subjects-loading", true);

        try {
            const dashboard = await adminRequest(
                "admin.dashboard"
            );

            GGNAdmin.admin =
                dashboard.admin ||
                dashboard.user ||
                GGNAdmin.admin;

            if (GGNAdmin.admin) {
                adminText(
                    "admin-name",
                    GGNAdmin.admin.fullName ||
                    GGNAdmin.admin.fullname ||
                    GGNAdmin.admin.name ||
                    GGNAdmin.admin.email ||
                    "ผู้ดูแลระบบ"
                );

                adminText(
                    "admin-role",
                    GGNAdmin.admin.role || "ADMIN"
                );
            } else {
                adminText("admin-name", "ผู้ดูแลระบบ");
                adminText("admin-role", "ADMIN");
            }

            const [subjectResponse, examSetResponse] =
                await Promise.all([
                    adminRequest("admin.subjects"),
                    adminRequest("admin.examSets")
                ]);

            GGNAdmin.subjects = adminGetArray(
                subjectResponse,
                ["subjects", "items"]
            );

            GGNAdmin.examSets = adminGetArray(
                examSetResponse,
                ["examSets", "items"]
            );

            adminText(
                "stat-total-subjects",
                adminFormatNumber(GGNAdmin.subjects.length)
            );

            adminText(
                "stat-total-examsets",
                adminFormatNumber(GGNAdmin.examSets.length)
            );

            const totalQuestions =
                dashboard.totalQuestions ??
                dashboard.questionCount ??
                dashboard.summary?.totalQuestions;

            adminText(
                "stat-total-questions",
                totalQuestions === undefined
                    ? "-"
                    : adminFormatNumber(totalQuestions)
            );

            adminText("stat-system-status", "พร้อมใช้งาน");

            renderAdminDashboardSubjects();
            populateQuestionFilters();

            adminText(
                "admin-connection-status",
                "เชื่อมต่อระบบแล้ว"
            );

            return true;

        } catch (error) {
            console.error("[GGN Admin] Dashboard:", error);

            adminShowAlert(
                `โหลด Dashboard ไม่สำเร็จ: ${error.message}`,
                "error"
            );

            adminText(
                "admin-connection-status",
                "เชื่อมต่อไม่สำเร็จ"
            );

            return false;

        } finally {
            adminSetLoading("dashboard-subjects-loading", false);
            GGNAdmin.sectionRequests.dashboard = null;
        }
    })();

    GGNAdmin.sectionRequests.dashboard = request;

    return request;
}



function renderAdminDashboardSubjects() {
    const container = adminElement("dashboard-subject-list");
    if (!container) return;

    container.replaceChildren();

    if (!GGNAdmin.subjects.length) {
        adminShow("dashboard-subjects-empty", true);
        return;
    }

    adminShow("dashboard-subjects-empty", false);

    GGNAdmin.subjects.forEach(subject => {
        const subjectId = String(subject.subjectId || "");

        const subjectExamSets = GGNAdmin.examSets.filter(
            item => String(item.subjectId) === subjectId
        );

        const isOpen = subjectExamSets.length > 0 &&
            subjectExamSets.every(item =>
                adminNormalizeBoolean(item.isOpen)
            );

        const inactive = Boolean(
            subject.status &&
            String(subject.status).toUpperCase() !== "ACTIVE"
        );

        // Card
        const card = document.createElement("article");
        card.className = "subject-card";

        // Top row
        const top = document.createElement("div");
        top.className = "subject-card-top";

        const info = document.createElement("div");
        info.className = "subject-card-info";

        const name = document.createElement("div");
        name.className = "subject-card-name";
        name.textContent =
            subject.subjectName ||
            subject.name ||
            subject.subjectCode ||
            subjectId;

        const meta = document.createElement("div");
        meta.className = "subject-card-meta";
        meta.textContent = subject.subjectCode || subjectId;

        info.append(name, meta);

        const status = document.createElement("span");
        status.className = `subject-status ${
            isOpen ? "is-open" : "is-closed"
        }`;
        status.textContent = isOpen ? "เปิดสอบ" : "ปิดสอบ";

        top.append(info, status);

        // Bottom row
        const actions = document.createElement("div");
        actions.className = "subject-card-actions";

        // Capsule switch
        const switchLabel = document.createElement("label");
        switchLabel.className = "subject-switch";

        const switchInput = document.createElement("input");
        switchInput.type = "checkbox";
        switchInput.checked = isOpen;
        switchInput.disabled = inactive;
        switchInput.setAttribute(
            "aria-label",
            `เปลี่ยนสถานะการสอบ ${name.textContent}`
        );

        const switchSlider = document.createElement("span");
        switchSlider.className = "subject-switch-slider";

        const switchText = document.createElement("span");
        switchText.className = "subject-switch-text";
        switchText.textContent = isOpen ? "เปิดสอบ" : "ปิดสอบ";

        switchLabel.append(
            switchInput,
            switchSlider,
            switchText
        );

        switchInput.addEventListener("change", async () => {
            const nextValue = switchInput.checked;

            switchInput.disabled = true;

            try {
                await setAdminSubjectExamStatus(
                    subjectId,
                    nextValue
                );

                adminShowAlert(
                    `${nextValue ? "เปิด" : "ปิด"}สอบ ${
                        name.textContent
                    } เรียบร้อยแล้ว`,
                    "success"
                );

                await loadAdminDashboard();

            } catch (error) {
                switchInput.checked = !nextValue;

                adminShowAlert(
                    `เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`,
                    "error"
                );

            } finally {
                switchInput.disabled = inactive;
            }
        });

        // Manage questions
        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.className = "subject-manage-btn";
        manageButton.textContent = "จัดการข้อสอบ";

        manageButton.addEventListener("click", () => {
            adminSwitchSection("questions");

            const filterSubject = adminElement("filter-subject");
            if (filterSubject) {
                filterSubject.value = subjectId;
            }

            const questionSubject = adminElement("question-subject");
            if (questionSubject) {
                questionSubject.value = subjectId;
                updateQuestionExamSetOptions();
            }

            loadAdminQuestions();
        });

        actions.append(switchLabel, manageButton);
        card.append(top, actions);
        container.appendChild(card);
    });
}



async function setAdminSubjectExamStatus(subjectId, isOpen) {
    if (!subjectId) {
        throw new Error("ไม่พบรหัสวิชา");
    }

    return adminRequest(
        "admin.subject.examStatus",
        {
            subjectId,
            isOpen: Boolean(isOpen)
        }
    );
}


/* ======================================================
   7. SUBJECT / EXAM SET FILTERS
====================================================== */

function populateQuestionFilters() {
    const subjectSelect = adminElement("filter-subject");
    const examSetSelect = adminElement("filter-examset");

    const questionSubject = adminElement("question-subject");
    const questionExamSet = adminElement("question-examset");

    const resultSubject = adminElement(
        "result-filter-subject"
    );

    const subjectOptions = GGNAdmin.subjects.map(subject => ({
        value: String(subject.subjectId || ""),
        label:
            subject.subjectName ||
            subject.name ||
            subject.subjectCode ||
            subject.subjectId
    }));

    [
        subjectSelect,
        questionSubject,
        resultSubject
    ].forEach(select => {
        if (!select) return;

        const previousValue = select.value;

        select.replaceChildren();

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "ทุกวิชา";

        select.appendChild(defaultOption);

        subjectOptions.forEach(item => {
            const option = document.createElement("option");

            option.value = item.value;
            option.textContent = item.label;

            select.appendChild(option);
        });

        if (
            previousValue &&
            [...select.options].some(
                option => option.value === previousValue
            )
        ) {
            select.value = previousValue;
        }
    });

    if (!GGNAdmin.filtersBound) {
        questionSubject?.addEventListener(
            "change",
            updateQuestionExamSetOptions
        );

        subjectSelect?.addEventListener(
            "change",
            loadAdminQuestions
        );

        examSetSelect?.addEventListener(
            "change",
            loadAdminQuestions
        );

        GGNAdmin.filtersBound = true;
    }

    if (questionSubject) {
        updateQuestionExamSetOptions();
    }
}


function updateQuestionExamSetOptions() {
    const subjectSelect = adminElement("question-subject");
    const examSetSelect = adminElement("question-examset");

    if (!subjectSelect || !examSetSelect) return;

    const subjectId = subjectSelect.value;

    const filtered = GGNAdmin.examSets.filter(item => {
        return (
            !subjectId ||
            String(item.subjectId) === String(subjectId)
        );
    });

    const previousValue = examSetSelect.value;

    examSetSelect.replaceChildren();

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "เลือกชุดข้อสอบ";

    examSetSelect.appendChild(defaultOption);

    filtered.forEach(examSet => {
        const option = document.createElement("option");

        option.value = examSet.examSetId;

        option.textContent =
            examSet.examSetName ||
            examSet.name ||
            examSet.examSetId;

        examSetSelect.appendChild(option);
    });

    if (
        previousValue &&
        [...examSetSelect.options].some(
            option => option.value === previousValue
        )
    ) {
        examSetSelect.value = previousValue;
    }
}


/* ======================================================
   8. QUESTION MANAGEMENT
====================================================== */

async function loadAdminQuestions() {
    if (GGNAdmin.sectionRequests.questions) {
        return GGNAdmin.sectionRequests.questions;
    }

    const request = (async () => {
        adminSetLoading("question-list-loading", true);
        adminShow("question-table-container", false);
        adminShow("question-list-empty", false);

        try {
            const payload = {
                subjectId:
                    adminElement("filter-subject")?.value || "",

                examSetId:
                    adminElement("filter-examset")?.value || "",

                status:
                    adminElement("filter-question-status")?.value || "",

                keyword:
                    adminElement("question-search")?.value.trim() || ""
            };

            const response = await adminRequest(
                "admin.questions",
                payload
            );

            GGNAdmin.questions = adminGetArray(
                response,
                ["questions", "items"]
            );

            renderAdminQuestions();

            return true;

        } catch (error) {
            console.error("[GGN Admin] Questions:", error);

            adminShowAlert(
                `โหลดรายการข้อสอบไม่สำเร็จ: ${error.message}`,
                "error"
            );

            return false;

        } finally {
            adminSetLoading("question-list-loading", false);
            GGNAdmin.sectionRequests.questions = null;
        }
    })();

    GGNAdmin.sectionRequests.questions = request;

    return request;
}


function getQuestionSubjectName(subjectId) {
    const subject = GGNAdmin.subjects.find(
        item => String(item.subjectId) === String(subjectId)
    );

    return subject
        ? (
            subject.subjectName ||
            subject.name ||
            subject.subjectCode
        )
        : subjectId || "-";
}


function getQuestionExamSetName(examSetId) {
    const examSet = GGNAdmin.examSets.find(
        item => String(item.examSetId) === String(examSetId)
    );

    return examSet
        ? (
            examSet.examSetName ||
            examSet.name ||
            examSet.examSetId
        )
        : examSetId || "-";
}


function renderAdminQuestions() {
    const tbody = adminElement("question-table-body");

    if (!tbody) return;

    tbody.replaceChildren();

    adminText(
        "question-count",
        adminFormatNumber(GGNAdmin.questions.length)
    );

    if (!GGNAdmin.questions.length) {
        adminShow("question-table-container", false);
        adminShow("question-list-empty", true);
        return;
    }

    adminShow("question-table-container", true);
    adminShow("question-list-empty", false);

    GGNAdmin.questions.forEach((question, index) => {
        const row = document.createElement("tr");

        const questionText =
            question.questionText ||
            question.question ||
            "";

        const cells = [
            index + 1,
            getQuestionSubjectName(question.subjectId),
            getQuestionExamSetName(question.examSetId),
            questionText,
            question.score ?? "-",
            question.status || "-"
        ];

        cells.forEach(value => {
            row.appendChild(adminCreateCell(value));
        });

        const actionCell = document.createElement("td");

        const editButton = adminCreateButton(
            "แก้ไข",
            "btn btn-sm btn-primary",
            () => openQuestionModal(question)
        );

        actionCell.appendChild(editButton);

        const isActive =
            String(question.status || "").toUpperCase() === "ACTIVE";

        if (isActive) {
            const deactivateButton = adminCreateButton(
                "ปิดใช้งาน",
                "btn btn-sm btn-danger",
                () => deactivateAdminQuestion(
                    question.questionId
                )
            );

            actionCell.appendChild(deactivateButton);
        }

        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}


/* ======================================================
   9. QUESTION MODAL
====================================================== */

function openQuestionModal(question = null) {
    GGNAdmin.currentQuestion = question;

    const form = adminElement("question-form");

    form?.reset();

    adminShowFormError("question-form-error", "");

    const isEditing = Boolean(question);

    adminText(
        "question-modal-title",
        isEditing ? "แก้ไขข้อสอบ" : "เพิ่มข้อสอบ"
    );

    adminElement("question-id").value =
        question?.questionId || "";

    adminElement("question-subject").value =
        question?.subjectId || "";

    updateQuestionExamSetOptions();

    adminElement("question-examset").value =
        question?.examSetId || "";

    // Backend ใช้ questionNo
    adminElement("question-number").value =
        question?.questionNo ?? "";

    adminElement("question-score").value =
        question?.score ?? 1;

    adminElement("question-text").value =
        question?.questionText || "";

    // Backend ใช้ questionImageUrl
    adminElement("question-image-url").value =
        question?.questionImageUrl || "";

    adminElement("choice-a").value =
        question?.choiceA || "";

    adminElement("choice-b").value =
        question?.choiceB || "";

    adminElement("choice-c").value =
        question?.choiceC || "";

    adminElement("choice-d").value =
        question?.choiceD || "";

    adminElement("correct-answer").value =
        question?.correctAnswer || "";

    adminElement("question-explanation").value =
        question?.explanation || "";

    adminElement("question-status").value =
        question?.status || "ACTIVE";

    adminShow("question-modal", true);
}


function closeQuestionModal() {
    adminShow("question-modal", false);
    GGNAdmin.currentQuestion = null;
}


function getQuestionFormData() {
    return {
        questionId:
            adminElement("question-id").value.trim(),

        subjectId:
            adminElement("question-subject").value,

        examSetId:
            adminElement("question-examset").value,

        // ชื่อฟิลด์ตรงกับ Questions sheet
        questionNo:
            Number(adminElement("question-number").value),

        score:
            Number(adminElement("question-score").value),

        questionText:
            adminElement("question-text").value.trim(),

        questionImageUrl:
            adminElement("question-image-url").value.trim(),

        choiceA:
            adminElement("choice-a").value.trim(),

        choiceB:
            adminElement("choice-b").value.trim(),

        choiceC:
            adminElement("choice-c").value.trim(),

        choiceD:
            adminElement("choice-d").value.trim(),

        correctAnswer:
            adminElement("correct-answer").value,

        explanation:
            adminElement("question-explanation").value.trim(),

        status:
            adminElement("question-status").value
    };
}


function validateQuestionForm(question) {
    if (!question.subjectId) {
        return "กรุณาเลือกวิชา";
    }

    if (!question.examSetId) {
        return "กรุณาเลือกชุดข้อสอบ";
    }

    if (
        !Number.isInteger(question.questionNo) ||
        question.questionNo < 1
    ) {
        return "ลำดับข้อสอบต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป";
    }

    if (!question.questionText) {
        return "กรุณากรอกคำถาม";
    }

    if (
        !question.choiceA ||
        !question.choiceB ||
        !question.choiceC ||
        !question.choiceD
    ) {
        return "กรุณากรอกตัวเลือกให้ครบทั้ง 4 ข้อ";
    }

    if (
        !["A", "B", "C", "D"].includes(
            question.correctAnswer
        )
    ) {
        return "กรุณาเลือกคำตอบที่ถูกต้อง";
    }

    if (
        !Number.isFinite(question.score) ||
        question.score <= 0
    ) {
        return "คะแนนต้องมากกว่า 0";
    }

    return "";
}


async function saveAdminQuestion(event) {
    event.preventDefault();

    adminShowFormError("question-form-error", "");

    const question = getQuestionFormData();
    const validationError = validateQuestionForm(question);

    if (validationError) {
        adminShowFormError(
            "question-form-error",
            validationError
        );

        return;
    }

    const isEditing = Boolean(question.questionId);

    const action = isEditing
        ? "admin.question.update"
        : "admin.question.create";

    const saveButton = adminElement("btn-save-question");

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "กำลังบันทึก...";
    }

    try {
        await adminRequest(action, question);

        closeQuestionModal();

        adminShowAlert(
            isEditing
                ? "แก้ไขข้อสอบเรียบร้อยแล้ว"
                : "เพิ่มข้อสอบเรียบร้อยแล้ว",
            "success"
        );

        await loadAdminQuestions();
        await refreshAdminQuestionCount();

    } catch (error) {
        console.error("[GGN Admin] Save question:", error);

        adminShowFormError(
            "question-form-error",
            error.message
        );

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "บันทึก";
        }
    }
}


/* ======================================================
   10. DEACTIVATE QUESTION
====================================================== */

async function deactivateAdminQuestion(questionId) {
    if (!questionId) {
        adminShowAlert(
            "ไม่พบรหัสข้อสอบที่ต้องการปิดใช้งาน",
            "error"
        );

        return;
    }

    const confirmed = window.confirm(
        "ต้องการปิดใช้งานข้อสอบข้อนี้หรือไม่?\n\n" +
        "ข้อสอบจะไม่ถูกลบออกจากฐานข้อมูล"
    );

    if (!confirmed) return;

    try {
        await adminRequest(
            "admin.question.deactivate",
            { questionId }
        );

        adminShowAlert(
            "ปิดใช้งานข้อสอบเรียบร้อยแล้ว",
            "success"
        );

        await loadAdminQuestions();
        await refreshAdminQuestionCount();

    } catch (error) {
        console.error("[GGN Admin] Deactivate question:", error);

        adminShowAlert(
            `ปิดใช้งานไม่สำเร็จ: ${error.message}`,
            "error"
        );
    }
}


/* ======================================================
   11. QUESTION COUNT
====================================================== */

async function refreshAdminQuestionCount() {
    try {
        const response = await adminRequest(
            "admin.questions",
            {}
        );

        const questions = adminGetArray(
            response,
            ["questions", "items"]
        );

        adminText(
            "stat-total-questions",
            adminFormatNumber(questions.length)
        );

    } catch (error) {
        console.warn(
            "[GGN Admin] Refresh question count:",
            error
        );
    }
}


/* ======================================================
   12. COHORTS
====================================================== */

async function loadAdminCohorts() {
    const response = await adminRequest(
        "admin.cohorts"
    );

    GGNAdmin.cohorts = adminGetArray(
        response,
        ["cohorts", "items"]
    );

    populateCohortFilters();

    return GGNAdmin.cohorts;
}


function populateCohortFilters() {
    const selects = [
        adminElement("result-filter-cohort"),
        adminElement("summary-filter-cohort")
    ];

    selects.forEach(select => {
        if (!select) return;

        const previousValue = select.value;

        select.replaceChildren();

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "เลือกรุ่นสอบ";

        select.appendChild(defaultOption);

        GGNAdmin.cohorts.forEach(cohort => {
            const option = document.createElement("option");

            option.value = cohort.cohortId;

            option.textContent =
                cohort.cohortName ||
                cohort.cohortCode ||
                cohort.cohortId;

            select.appendChild(option);
        });

        if (
            previousValue &&
            [...select.options].some(
                option => option.value === previousValue
            )
        ) {
            select.value = previousValue;
        }
    });
}


/* ======================================================
   13. EXAM RESULTS
====================================================== */

async function loadAdminResults() {
    if (GGNAdmin.sectionRequests.results) {
        return GGNAdmin.sectionRequests.results;
    }

    const request = (async () => {
        adminSetLoading("result-list-loading", true);
        adminShow("result-table-container", false);
        adminShow("result-list-empty", false);

        try {
            if (!GGNAdmin.cohorts.length) {
                await loadAdminCohorts();
            }

            const payload = {
                subjectId:
                    adminElement("result-filter-subject")?.value || "",

                cohortId:
                    adminElement("result-filter-cohort")?.value || "",

                search:
                    adminElement("result-search")?.value.trim() || ""
            };

            const response = await adminRequest(
                "admin.results",
                payload
            );

            GGNAdmin.results = adminGetArray(
                response,
                ["results", "items"]
            );

            renderAdminResults();

            return true;

        } catch (error) {
            console.error("[GGN Admin] Results:", error);

            adminShow("result-table-container", false);
            adminShow("result-list-empty", true);

            adminShowAlert(
                `โหลดผลสอบไม่สำเร็จ: ${error.message}`,
                "warning"
            );

            return false;

        } finally {
            adminSetLoading("result-list-loading", false);
            GGNAdmin.sectionRequests.results = null;
        }
    })();

    GGNAdmin.sectionRequests.results = request;

    return request;
}


function renderAdminResults() {
    const tbody = adminElement("result-table-body");

    if (!tbody) return;

    tbody.replaceChildren();

    adminText(
        "result-count",
        adminFormatNumber(GGNAdmin.results.length)
    );

    if (!GGNAdmin.results.length) {
        adminShow("result-table-container", false);
        adminShow("result-list-empty", true);
        return;
    }

    adminShow("result-table-container", true);
    adminShow("result-list-empty", false);

    GGNAdmin.results.forEach((result, index) => {
        const row = document.createElement("tr");

        const cells = [
            index + 1,
            result.examineeName ||
                result.fullName ||
                result.fullname ||
                "-",

            result.subjectName || "-",

            result.cohortName ||
                result.cohortId ||
                "-",

            result.score ?? "-",
            result.maxScore ?? "-",

            result.resultStatus ||
                result.status ||
                "-",

            adminFormatDate(
                result.submittedAt ||
                result.completedAt ||
                result.updatedAt
            )
        ];

        cells.forEach(value => {
            row.appendChild(adminCreateCell(value));
        });

        const actionCell = document.createElement("td");

        const adjustButton = adminCreateButton(
            "ปรับคะแนน",
            "btn btn-sm btn-primary",
            () => openScoreModal(result)
        );

        actionCell.appendChild(adjustButton);

        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}


/* ======================================================
   14. SCORE ADJUSTMENT
====================================================== */

function openScoreModal(result) {
    GGNAdmin.currentResult = result;

    adminShowFormError("score-form-error", "");

    adminText(
        "score-modal-title",
        "ปรับคะแนนผลสอบ"
    );

    adminText(
        "adjust-examinee-name",
        result.examineeName ||
        result.fullName ||
        result.fullname ||
        "-"
    );

    adminText(
        "adjust-subject-name",
        result.subjectName || "-"
    );

    adminElement("adjust-attempt-id").value =
        result.attemptId || "";

    adminElement("adjust-score").value =
        result.score ?? 0;

    adminElement("adjust-reason").value = "";

    adminShow("score-modal", true);
}


function closeScoreModal() {
    adminShow("score-modal", false);
    GGNAdmin.currentResult = null;
}


async function saveAdjustedScore(event) {
    event.preventDefault();

    adminShowFormError("score-form-error", "");

    const attemptId =
        adminElement("adjust-attempt-id").value.trim();

    const score = Number(
        adminElement("adjust-score").value
    );

    const reason =
        adminElement("adjust-reason").value.trim();

    if (!attemptId) {
        adminShowFormError(
            "score-form-error",
            "ไม่พบรหัสการสอบ"
        );

        return;
    }

    if (!Number.isFinite(score) || score < 0) {
        adminShowFormError(
            "score-form-error",
            "กรุณาระบุคะแนนให้ถูกต้อง"
        );

        return;
    }

    if (!reason) {
        adminShowFormError(
            "score-form-error",
            "กรุณาระบุเหตุผลในการปรับคะแนน"
        );

        return;
    }

    const maxScore = Number(
        GGNAdmin.currentResult?.maxScore
    );

    if (
        Number.isFinite(maxScore) &&
        maxScore > 0 &&
        score > maxScore
    ) {
        adminShowFormError(
            "score-form-error",
            `คะแนนต้องไม่เกิน ${maxScore}`
        );

        return;
    }

    const saveButton = adminElement("btn-save-score");

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "กำลังบันทึก...";
    }

    try {
        // API ใน js/api.js ระบุ action นี้
        await adminRequest(
            "admin.result.adjustScore",
            {
                attemptId,
                score,
                reason
            }
        );

        closeScoreModal();

        adminShowAlert(
            "ปรับคะแนนเรียบร้อยแล้ว",
            "success"
        );

        await loadAdminResults();

    } catch (error) {
        console.error("[GGN Admin] Adjust score:", error);

        adminShowFormError(
            "score-form-error",
            error.message
        );

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "บันทึก";
        }
    }
}


/* ======================================================
   15. SUMMARY
====================================================== */

async function loadAdminSummary() {
    if (GGNAdmin.sectionRequests.summary) {
        return GGNAdmin.sectionRequests.summary;
    }

    const request = (async () => {
        adminSetLoading("summary-loading", true);
        adminShow("summary-empty", false);

        try {
            if (!GGNAdmin.cohorts.length) {
                await loadAdminCohorts();
            }

            const cohortId =
                adminElement("summary-filter-cohort")?.value || "";

            if (!cohortId) {
                GGNAdmin.summary = null;

                clearAdminSummary();

                adminShow("summary-empty", true);

                return false;
            }

            const response = await adminRequest(
                "admin.result.summary",
                { cohortId }
            );

            GGNAdmin.summary = response || {};

            renderAdminSummary(GGNAdmin.summary);

            return true;

        } catch (error) {
            console.error("[GGN Admin] Summary:", error);

            adminShowAlert(
                `โหลดสรุปผลไม่สำเร็จ: ${error.message}`,
                "error"
            );

            clearAdminSummary();

            return false;

        } finally {
            adminSetLoading("summary-loading", false);
            GGNAdmin.sectionRequests.summary = null;
        }
    })();

    GGNAdmin.sectionRequests.summary = request;

    return request;
}


function clearAdminSummary() {
    adminText("summary-total-examinees", "0");
    adminText("summary-total-passed", "0");
    adminText("summary-total-failed", "0");
    adminText("summary-average-score", "0");

    const individualBody =
        adminElement("summary-individual-body");

    const subjectBody =
        adminElement("summary-subject-body");

    individualBody?.replaceChildren();
    subjectBody?.replaceChildren();
}


function renderAdminSummary(summary) {
    const data = summary.data || summary;

    const individualRows =
        data.individual ||
        data.individualSummary ||
        data.examinees ||
        data.examineeSummary ||
        [];

    const subjectRows =
        data.subject ||
        data.subjectSummary ||
        data.subjects ||
        [];

    const stats = data.summary || data.statistics || data;

    adminText(
        "summary-total-examinees",
        adminFormatNumber(
            stats.totalExaminees ??
            stats.totalParticipants ??
            individualRows.length
        )
    );

    adminText(
        "summary-total-passed",
        adminFormatNumber(
            stats.totalPassed ??
            stats.passed ??
            0
        )
    );

    adminText(
        "summary-total-failed",
        adminFormatNumber(
            stats.totalFailed ??
            stats.failed ??
            0
        )
    );

    adminText(
        "summary-average-score",
        adminFormatNumber(
            stats.averageScore ??
            stats.avgScore ??
            0,
            2
        )
    );

    renderAdminIndividualSummary(individualRows);
    renderAdminSubjectSummary(subjectRows);

    setAdminSummaryView(GGNAdmin.currentSummaryView);
}


function renderAdminIndividualSummary(rows) {
    const head = adminElement("summary-individual-head");
    const body = adminElement("summary-individual-body");

    if (!head || !body) return;

    head.replaceChildren();
    body.replaceChildren();

    const headerRow = document.createElement("tr");

    [
        "ลำดับ",
        "รหัสพนักงาน",
        "ชื่อผู้เข้าสอบ"
    ].forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
    });

    GGNAdmin.subjects.forEach(subject => {
        const th = document.createElement("th");

        th.textContent =
            subject.subjectCode ||
            subject.subjectName ||
            subject.subjectId;

        headerRow.appendChild(th);
    });

    [
        "คะแนนรวม",
        "ผลสอบ"
    ].forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
    });

    head.appendChild(headerRow);

    if (!Array.isArray(rows) || !rows.length) {
        return;
    }

    rows.forEach((item, index) => {
        const row = document.createElement("tr");

        row.appendChild(adminCreateCell(index + 1));

        row.appendChild(adminCreateCell(
            item.employeeCode || "-"
        ));

        row.appendChild(adminCreateCell(
            item.examineeName ||
            item.fullName ||
            item.fullname ||
            "-"
        ));

        const scores =
            item.subjectScores ||
            item.scoresBySubject ||
            item.scores ||
            {};

        GGNAdmin.subjects.forEach(subject => {
            const subjectId = String(subject.subjectId);

            let score = "-";

            if (Array.isArray(scores)) {
                const found = scores.find(
                    value =>
                        String(value.subjectId) === subjectId
                );

                if (found) {
                    score = found.score ?? "-";
                }
            } else if (scores && typeof scores === "object") {
                score = scores[subjectId] ?? "-";

                if (
                    score &&
                    typeof score === "object"
                ) {
                    score = score.score ?? "-";
                }
            }

            row.appendChild(adminCreateCell(score));
        });

        row.appendChild(adminCreateCell(
            item.totalScore ??
            item.total ??
            "-"
        ));

        row.appendChild(adminCreateCell(
            item.resultStatus ||
            item.passStatus ||
            item.status ||
            "-"
        ));

        body.appendChild(row);
    });
}


function renderAdminSubjectSummary(rows) {
    const body = adminElement("summary-subject-body");

    if (!body) return;

    body.replaceChildren();

    if (!Array.isArray(rows) || !rows.length) {
        return;
    }

    rows.forEach((item, index) => {
        const row = document.createElement("tr");

        const cells = [
            index + 1,

            item.subjectName ||
            item.subjectCode ||
            item.subjectId ||
            "-",

            item.totalExaminees ??
            item.totalParticipants ??
            item.count ??
            0,

            item.averageScore ??
            item.avgScore ??
            0,

            item.totalPassed ??
            item.passed ??
            0,

            item.totalFailed ??
            item.failed ??
            0,

            item.highestScore ?? "-",
            item.lowestScore ?? "-"
        ];

        cells.forEach(value => {
            row.appendChild(adminCreateCell(value));
        });

        body.appendChild(row);
    });
}


function setAdminSummaryView(view) {
    if (!["individual", "subject"].includes(view)) {
        return;
    }

    GGNAdmin.currentSummaryView = view;

    const individualPanel =
        adminElement("summary-individual-panel");

    const subjectPanel =
        adminElement("summary-subject-panel");

    if (individualPanel) {
        individualPanel.hidden = view !== "individual";
    }

    if (subjectPanel) {
        subjectPanel.hidden = view !== "subject";
    }

    document.querySelectorAll("[data-summary-view]")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.summaryView === view
            );
        });
}


/* ======================================================
   16. EVENT BINDINGS
====================================================== */

function setupAdminEvents() {
    if (GGNAdmin.eventsBound) return;

    adminElement("btn-refresh-dashboard")
        ?.addEventListener("click", loadAdminDashboard);

    adminElement("btn-add-question")
        ?.addEventListener("click", () => {
            openQuestionModal();
        });

    adminElement("btn-search-questions")
        ?.addEventListener("click", loadAdminQuestions);

    adminElement("btn-reset-question-filter")
        ?.addEventListener("click", () => {
            adminElement("filter-subject").value = "";
            adminElement("filter-examset").value = "";
            adminElement("filter-question-status").value = "";
            adminElement("question-search").value = "";

            loadAdminQuestions();
        });

    adminElement("question-search")
        ?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                loadAdminQuestions();
            }
        });

    adminElement("filter-question-status")
        ?.addEventListener("change", loadAdminQuestions);

    adminElement("btn-close-question-modal")
        ?.addEventListener("click", closeQuestionModal);

    adminElement("btn-cancel-question")
        ?.addEventListener("click", closeQuestionModal);

    adminElement("question-form")
        ?.addEventListener("submit", saveAdminQuestion);

    adminElement("btn-refresh-results")
        ?.addEventListener("click", loadAdminResults);

    adminElement("btn-search-results")
        ?.addEventListener("click", loadAdminResults);

    adminElement("result-filter-subject")
        ?.addEventListener("change", loadAdminResults);

    adminElement("result-filter-cohort")
        ?.addEventListener("change", loadAdminResults);

    adminElement("result-search")
        ?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                loadAdminResults();
            }
        });

    adminElement("btn-close-score-modal")
        ?.addEventListener("click", closeScoreModal);

    adminElement("btn-cancel-score")
        ?.addEventListener("click", closeScoreModal);

    adminElement("score-form")
        ?.addEventListener("submit", saveAdjustedScore);

    adminElement("btn-admin-confirm-cancel")
        ?.addEventListener("click", () => {
            adminShow("admin-confirm-modal", false);
        });

    adminElement("btn-refresh-summary")
        ?.addEventListener("click", loadAdminSummary);

    adminElement("btn-load-summary")
        ?.addEventListener("click", loadAdminSummary);

    adminElement("summary-filter-cohort")
        ?.addEventListener("change", loadAdminSummary);

    document.querySelectorAll("[data-summary-view]")
        .forEach(button => {
            button.addEventListener("click", () => {
                setAdminSummaryView(
                    button.dataset.summaryView
                );
            });
        });

    GGNAdmin.eventsBound = true;
}


/* ======================================================
   17. INITIALIZATION
====================================================== */

async function initializeGGNAdmin() {
    if (GGNAdmin.initialized) return;

    GGNAdmin.initialized = true;

    try {
        setupAdminNavigation();
        setupAdminEvents();

        adminText(
            "admin-connection-status",
            "กำลังเชื่อมต่อ..."
        );

        GGNAdmin.currentSection = "dashboard";

        document.querySelectorAll(".admin-section").forEach(section => {
            section.classList.add("hidden");
            section.hidden = true;
        });

        const dashboardSection =
            adminElement("dashboard-section");

        if (dashboardSection) {
            dashboardSection.classList.remove("hidden");
            dashboardSection.hidden = false;
        }

        document.querySelectorAll(".sidebar-link").forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.section === "dashboard"
            );
        });

        await loadAdminDashboard();

    } catch (error) {
        console.error(
            "[GGN Admin] Initialization error:",
            error
        );

        GGNAdmin.initialized = false;

        adminShowAlert(
            "ไม่สามารถเริ่มต้นระบบ Admin ได้: " +
            (error.message || error),
            "danger"
        );

    } finally {
        const loading = adminElement("admin-loading");

        if (loading) {
            loading.classList.add("hidden");
            loading.hidden = true;
        }
    }
}


/* ======================================================
   18. START APPLICATION
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initializeGGNAdmin();
});
