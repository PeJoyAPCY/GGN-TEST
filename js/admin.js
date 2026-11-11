
/**
 * ======================================================
 * GGN TEST
 * ADMIN PANEL
 * ======================================================
 *
 * File: js/admin.js
 * Version: 1.1.0
 * Updated: 2026-11-11
 *
 * Changes:
 * - Remove duplicate Dashboard initialization
 * - Prevent duplicate initialization
 * - Prevent overlapping section loading
 * - Bind filter events only once
 * - Improve loading and error handling
 * - Keep existing Admin features and API actions
 *
 * Dependencies:
 * - css/style.css
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

    currentSection: "dashboard",

    currentQuestion: null,
    currentResult: null,

    isLoading: false,
    initialized: false,
    navigationBound: false,
    eventsBound: false,
    filtersBound: false,

    sectionRequests: {
        dashboard: null,
        questions: null,
        results: null
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

    if (element) {
        element.textContent =
            value === null || value === undefined
                ? ""
                : String(value);
    }
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

function adminFormatNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number.toLocaleString("th-TH")
        : "0";
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
    const container = adminElement("global-alert");

    if (!container) {
        window.alert(message);
        return;
    }

    container.textContent = message;
    container.className = `alert alert-${type}`;
    container.hidden = false;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function adminHideAlert() {
    const container = adminElement("global-alert");

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
        "results"
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
}

function setupAdminNavigation() {
    if (GGNAdmin.navigationBound) return;

    document.querySelectorAll("[data-section]")
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
            const dashboardResponse = await adminRequest(
                "admin.dashboard"
            );

            const dashboard = dashboardResponse || {};

            GGNAdmin.admin =
                dashboard.admin ||
                dashboard.user ||
                GGNAdmin.admin;

            if (GGNAdmin.admin) {
                adminText(
                    "admin-name",
                    GGNAdmin.admin.fullname ||
                    GGNAdmin.admin.name ||
                    GGNAdmin.admin.email ||
                    GGNAdmin.admin.displayName ||
                    "ผู้ดูแลระบบ"
                );

                adminText(
                    "admin-role",
                    GGNAdmin.admin.role || "SUPER_ADMIN"
                );
            } else {
                adminText("admin-name", "ผู้ดูแลระบบ");
                adminText("admin-role", "SUPER_ADMIN");
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

            const totalQuestions =
                dashboard.totalQuestions ??
                dashboard.questionCount ??
                "-";

            adminText(
                "stat-total-subjects",
                adminFormatNumber(GGNAdmin.subjects.length)
            );

            adminText(
                "stat-total-examsets",
                adminFormatNumber(GGNAdmin.examSets.length)
            );

            adminText(
                "stat-total-questions",
                totalQuestions === "-"
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
            console.error("Dashboard error:", error);

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
        const row = document.createElement("div");

        row.className = "dashboard-subject-item";

        const name = document.createElement("div");
        name.className = "dashboard-subject-name";
        name.textContent =
            subject.subjectName ||
            subject.name ||
            subject.subjectCode ||
            subject.subjectId ||
            "-";

        const code = document.createElement("div");
        code.className = "dashboard-subject-code";
        code.textContent =
            subject.subjectCode ||
            subject.subjectId ||
            "-";

        const status = document.createElement("div");
        status.className = "dashboard-subject-status";
        status.textContent = subject.status || "-";

        row.append(name, code, status);
        container.appendChild(row);
    });
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
        value: subject.subjectId,
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

    if (questionSubject && !GGNAdmin.filtersBound) {
        questionSubject.addEventListener(
            "change",
            updateQuestionExamSetOptions
        );
    }

    if (subjectSelect && !GGNAdmin.filtersBound) {
        subjectSelect.addEventListener(
            "change",
            loadAdminQuestions
        );
    }

    if (examSetSelect && !GGNAdmin.filtersBound) {
        examSetSelect.addEventListener(
            "change",
            loadAdminQuestions
        );
    }

    if (questionSubject) {
        updateQuestionExamSetOptions();
    }

    GGNAdmin.filtersBound = true;
}

function updateQuestionExamSetOptions() {
    const subjectSelect = adminElement("question-subject");
    const examSetSelect = adminElement("question-examset");

    if (!subjectSelect || !examSetSelect) return;

    const subjectId = subjectSelect.value;

    const filtered = GGNAdmin.examSets.filter(item => {
        return !subjectId || item.subjectId === subjectId;
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

                search:
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
            console.error("Question loading error:", error);

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
        item => item.subjectId === subjectId
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
        item => item.examSetId === examSetId
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

        const questionId =
            question.questionId ||
            question.id ||
            "";

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
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "btn btn-sm btn-primary";
        editButton.textContent = "แก้ไข";

        editButton.addEventListener("click", () => {
            openQuestionModal(question);
        });

        actionCell.appendChild(editButton);

        const isActive =
            String(question.status || "").toUpperCase() === "ACTIVE";

        if (isActive) {
            const deactivateButton = document.createElement("button");

            deactivateButton.type = "button";
            deactivateButton.className = "btn btn-sm btn-danger";
            deactivateButton.textContent = "ปิดใช้งาน";

            deactivateButton.addEventListener("click", () => {
                deactivateAdminQuestion(questionId);
            });

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

    if (form) {
        form.reset();
    }

    adminShowFormError("question-form-error", "");

    const isEditing = Boolean(question);

    adminText(
        "question-modal-title",
        isEditing ? "แก้ไขข้อสอบ" : "เพิ่มข้อสอบ"
    );

    adminElement("question-id").value =
        question?.questionId || question?.id || "";

    adminElement("question-subject").value =
        question?.subjectId || "";

    updateQuestionExamSetOptions();

    adminElement("question-examset").value =
        question?.examSetId || "";

    adminElement("question-number").value =
        question?.questionNumber ?? "";

    adminElement("question-score").value =
        question?.score ?? 1;

    adminElement("question-text").value =
        question?.questionText ||
        question?.question ||
        "";

    adminElement("question-image-url").value =
        question?.imageUrl || "";

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

        questionNumber:
            Number(adminElement("question-number").value),

        score:
            Number(adminElement("question-score").value),

        questionText:
            adminElement("question-text").value.trim(),

        imageUrl:
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
        await adminRequest(action, {
            ...question,
            question
        });

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
        console.error("Save question error:", error);

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
        console.error("Deactivate question error:", error);

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
            "Could not refresh question count:",
            error
        );
    }
}


/* ======================================================
   12. EXAM RESULTS
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
            console.error("Result loading error:", error);

            adminShow("result-list-empty", true);

            adminShowAlert(
                "ยังไม่สามารถโหลดผลสอบได้: " + error.message,
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
            result.examineeName || result.fullname || "-",
            result.subjectName || "-",
            result.cohortName || result.cohortId || "-",
            result.score ?? "-",
            result.maxScore ?? "-",
            result.resultStatus || result.status || "-",
            adminFormatDate(
                result.submittedAt ||
                result.completedAt ||
                result.updatedAt
            )
        ];

        cells.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        const adjustButton = document.createElement("button");

        adjustButton.type = "button";
        adjustButton.className = "btn btn-sm btn-primary";
        adjustButton.textContent = "ปรับคะแนน";

        adjustButton.addEventListener("click", () => {
            openScoreModal(result);
        });

        actionCell.appendChild(adjustButton);

        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}


/* ======================================================
   13. SCORE ADJUSTMENT
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
        result.examineeName || result.fullname || "-"
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

    const saveButton = adminElement("btn-save-score");

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "กำลังบันทึก...";
    }

    try {
        await adminRequest(
            "admin.result.adjust",
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
        console.error("Adjust score error:", error);

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
   14. EVENT BINDINGS
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

    GGNAdmin.eventsBound = true;
}


/* ======================================================
   15. INITIALIZATION
====================================================== */

async function initializeGGNAdmin() {
    if (GGNAdmin.initialized) {
        return;
    }

    GGNAdmin.initialized = true;

    try {
        setupAdminNavigation();
        setupAdminEvents();

        adminText(
            "admin-connection-status",
            "กำลังเชื่อมต่อ..."
        );

        // Set initial section without calling navigation loader.
        GGNAdmin.currentSection = "dashboard";

        [
            "dashboard",
            "questions",
            "results"
        ].forEach(section => {
            const sectionElement = adminElement(
                `${section}-section`
            );

            if (sectionElement) {
                sectionElement.hidden = section !== "dashboard";
            }
        });

        document.querySelectorAll(".sidebar-link[data-section]")
            .forEach(link => {
                link.classList.toggle(
                    "active",
                    link.dataset.section === "dashboard"
                );
            });

        // Load Dashboard only once.
        await loadAdminDashboard();

    } catch (error) {
        GGNAdmin.initialized = false;

        console.error(
            "GGN Admin initialization error:",
            error
        );

        adminShowAlert(
            "ไม่สามารถเริ่มต้นระบบ Admin ได้: " +
            error.message,
            "error"
        );
    }
}


/* ======================================================
   16. START APPLICATION
====================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initializeGGNAdmin();
});
