/**
 * ======================================================
 * GGN TEST
 * ADMIN PANEL
 * ======================================================
 *
 * File: js/admin.js
 * Version: 3.4.0
 * Updated: 2026-11-16
 *
 * Changes:
 * - Populate result and summary cohort selectors after dashboard preload
 * - Add optional person filter to cohort summary
 * - Show examinee count used by the selected summary scope
 * - Compact Dashboard with 9 subject cards
 * - Subject exam open/close switch
 * - Question management with correct API field names
 * - Exam results and score adjustment
 * - Cohort filter
 * - Individual and subject summary
 * - Prevent duplicate initialization and event binding
 * - Prevent overlapping section requests
 * - No Admin login or PIN on frontend
 * - Automatically resolve examSetId from selected subject
 * - Support hidden examSetId field in question form
 * - Fix hidden-class rendering for question table and alerts
 * - Add explicit DRAFT-to-PUBLISHED workflow
 * - Toggle all published sets for a subject safely
 * - Preserve subject context when resetting filters
 * - Display live question count on dashboard
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
    resultSubjects: [],
    cohorts: [],

    summary: null,

    currentSection: "dashboard",
    currentSummaryView: "individual",

    currentQuestion: null,
    currentResult: null,
    selectedSubjectId: "",
    questionRequestVersion: 0,

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
        // Keep the HTML hidden attribute and the project's .hidden CSS class
        // synchronized. Toggling only element.hidden leaves .hidden in place,
        // which keeps tables and empty states invisible even after loading.
        element.hidden = !visible;
        element.classList.toggle("hidden", !visible);
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
    element.classList.toggle("hidden", !message);
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

            const [subjectResponse, examSetResponse, questionResponse, cohortResponse] =
                await Promise.all([
                    adminRequest("admin.subjects"),
                    adminRequest("admin.examSets"),
                    adminRequest("admin.questions", {}),
                    adminRequest("admin.cohorts")
                ]);

            GGNAdmin.subjects = adminGetArray(
                subjectResponse,
                ["subjects", "items"]
            );

            GGNAdmin.examSets = adminGetArray(
                examSetResponse,
                ["examSets", "items"]
            );

            GGNAdmin.cohorts = adminGetArray(
                cohortResponse,
                ["cohorts", "items"]
            );

            // Dashboard preloads the cohort list; populate both result-page
            // selectors here as well. Otherwise later pages see a non-empty
            // in-memory list and skip reloading while their selects stay blank.
            populateCohortFilters();

            adminText(
                "stat-total-subjects",
                adminFormatNumber(GGNAdmin.subjects.length)
            );

            adminText(
                "stat-total-examsets",
                adminFormatNumber(GGNAdmin.examSets.length)
            );

            const dashboardQuestionCount = adminGetArray(
                questionResponse,
                ["questions", "items"]
            ).length;

            const totalQuestions =
                dashboard.totalQuestions ??
                dashboard.questionCount ??
                dashboard.summary?.totalQuestions ??
                dashboardQuestionCount;

            adminText(
                "stat-total-questions",
                adminFormatNumber(totalQuestions)
            );

            adminText("stat-system-status", "พร้อมใช้งาน");

            renderAdminDashboardSubjects();
            populateQuestionFilters();
            renderAdminSubjectManagementOptions();

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

        const publishedSets = subjectExamSets.filter(
            item => String(item.status || "").toUpperCase() === "PUBLISHED"
        );
        const draftSets = subjectExamSets.filter(
            item => String(item.status || "").toUpperCase() === "DRAFT"
        );
        const allPublished =
            subjectExamSets.length > 0 &&
            publishedSets.length === subjectExamSets.length;
        const hasDraft = draftSets.length > 0;
        const isOpen = allPublished && publishedSets.every(item =>
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
        status.textContent = allPublished
            ? (isOpen ? "เปิดสอบ" : "ปิดสอบ")
            : (hasDraft ? "ฉบับร่าง" : "ยังไม่มีชุดสอบ");

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
        // The exam switch is available only after every set for this subject
        // has been published. Publishing is a separate, explicit operation.
        switchInput.disabled = inactive || !allPublished;
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
                switchInput.disabled = inactive || !allPublished;
            }
        });

        // Publish DRAFT sets explicitly before allowing the exam switch.
        if (hasDraft) {
            const publishButton = document.createElement("button");
            publishButton.type = "button";
            publishButton.className = "subject-manage-btn";
            publishButton.textContent = `เผยแพร่ชุดสอบ (${draftSets.length})`;
            publishButton.disabled = inactive;
            publishButton.addEventListener("click", async () => {
                publishButton.disabled = true;
                try {
                    await adminRequest("admin.subject.examPublish", {
                        subjectId
                    });
                    adminShowAlert(
                        `เผยแพร่ชุดสอบ ${name.textContent} เรียบร้อยแล้ว`,
                        "success"
                    );
                    await loadAdminDashboard();
                } catch (error) {
                    adminShowAlert(
                        `เผยแพร่ชุดสอบไม่สำเร็จ: ${error.message}`,
                        "error"
                    );
                } finally {
                    publishButton.disabled = inactive;
                }
            });
            actions.appendChild(publishButton);
        }

        // Manage questions
        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.className = "subject-manage-btn";
        manageButton.textContent = "จัดการข้อสอบ";

        manageButton.addEventListener("click", () => {
            // กำหนดวิชาก่อนเปลี่ยนหน้า เพราะการเปลี่ยนหน้า
            // จะเรียก loadAdminQuestions() ให้อัตโนมัติ
            GGNAdmin.selectedSubjectId = subjectId;

            const filterSubject = adminElement("filter-subject");
            if (filterSubject) filterSubject.value = subjectId;

            const questionSubject = adminElement("question-subject");
            if (questionSubject) {
                questionSubject.value = subjectId;
                updateQuestionExamSetOptions();
            }

            adminText("question-page-subject-name", `จัดการข้อสอบ: ${name.textContent}`);
            adminText("question-subject-context", name.textContent);
            adminText("question-page-description", "แสดงข้อสอบทั้งหมดของรายวิชานี้จากทุกชุดสอบและรุ่น");

            // ทิ้งผลลัพธ์คำขอเก่าทางตรรกะ ป้องกันข้อมูลข้ามวิชา
            GGNAdmin.questionRequestVersion += 1;
            GGNAdmin.sectionRequests.questions = null;

            adminSwitchSection("questions");
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
        "admin.subject.examStatus.manage",
        {
            subjectId,
            isOpen: Boolean(isOpen)
        }
    );
}



/* ======================================================
   SUBJECT MANAGEMENT
====================================================== */

function renderAdminSubjectManagementOptions() {
    const select = adminElement("subject-delete-select");
    if (!select) return;
    const previous = select.value;
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "เลือกรายวิชา";
    select.appendChild(placeholder);
    GGNAdmin.subjects
        .filter(item => String(item.status || "").toUpperCase() === "ACTIVE")
        .forEach(item => {
            const option = document.createElement("option");
            option.value = String(item.subjectId);
            option.textContent = `${item.subjectCode || item.subjectId} - ${item.subjectName || ""}`;
            select.appendChild(option);
        });
    if ([...select.options].some(option => option.value === previous)) {
        select.value = previous;
    }
}

function openSubjectAddModal() {
    adminElement("subject-add-form")?.reset();
    adminShowFormError("subject-add-form-error", "");
    const orderInput = adminElement("subject-add-order");
    if (orderInput) {
        orderInput.value = String(
            GGNAdmin.subjects.reduce((max, item) =>
                Math.max(max, Number(item.displayOrder || 0)), 0
            ) + 1
        );
    }
    adminShow("subject-add-modal", true);
}

function closeSubjectAddModal() {
    adminShow("subject-add-modal", false);
}

function openSubjectDeleteModal() {
    const select = adminElement("subject-delete-select");
    if (!select) return;

    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "เลือกรายวิชา";
    select.appendChild(placeholder);

    GGNAdmin.subjects
        .filter(item => String(item.status || "").toUpperCase() === "ACTIVE")
        .forEach(item => {
            const option = document.createElement("option");
            option.value = String(item.subjectId);
            option.textContent = `${item.subjectCode || item.subjectId} - ${item.subjectName || ""}`;
            select.appendChild(option);
        });

    adminShowFormError("subject-delete-form-error", "");
    adminShow("subject-delete-modal", true);
}

function closeSubjectDeleteModal() {
    adminShow("subject-delete-modal", false);
}

async function saveAdminSubject(event) {
    event.preventDefault();
    adminShowFormError("subject-add-form-error", "");

    const payload = {
        subjectCode: adminElement("subject-add-code")?.value.trim() || "",
        subjectName: adminElement("subject-add-name")?.value.trim() || "",
        displayOrder: Number(adminElement("subject-add-order")?.value || 0)
    };

    if (!payload.subjectCode || !payload.subjectName) {
        adminShowFormError("subject-add-form-error", "กรุณากรอกรหัสวิชาและชื่อวิชา");
        return;
    }

    const button = adminElement("btn-save-subject");
    if (button) {
        button.disabled = true;
        button.textContent = "กำลังบันทึก...";
    }

    try {
        const result = await adminRequest("admin.subject.create", payload);
        closeSubjectAddModal();
        adminShowAlert(
            `เพิ่มวิชาเรียบร้อยแล้ว และสร้างชุดสอบฉบับร่าง ${result.examSetsCreated || 0} รุ่น`,
            "success"
        );
        await loadAdminDashboard();
    } catch (error) {
        adminShowFormError("subject-add-form-error", error.message);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "บันทึกวิชา";
        }
    }
}

async function deleteAdminSubject(event) {
    event.preventDefault();
    adminShowFormError("subject-delete-form-error", "");

    const subjectId = adminElement("subject-delete-select")?.value || "";
    if (!subjectId) {
        adminShowFormError("subject-delete-form-error", "กรุณาเลือกรายวิชา");
        return;
    }

    const subject = GGNAdmin.subjects.find(item =>
        String(item.subjectId) === String(subjectId)
    );
    const confirmed = window.confirm(
        `ยืนยันการลบวิชา "${subject?.subjectName || subjectId}" หรือไม่?\\n\\n` +
        "หากมีประวัติการสอบหรือคะแนน ระบบจะปิดใช้งานแทนการลบ ส่วนชุดสอบ/ข้อสอบที่ยังไม่มีประวัติจะถูกลบไปพร้อมกัน"
    );
    if (!confirmed) return;

    const button = adminElement("btn-confirm-subject-delete");
    if (button) {
        button.disabled = true;
        button.textContent = "กำลังดำเนินการ...";
    }

    try {
        const result = await adminRequest("admin.subject.delete", { subjectId });
        closeSubjectDeleteModal();
        adminShowAlert(
            result.action === "DEACTIVATED"
                ? "วิชานี้มีข้อมูลอ้างอิง จึงปิดใช้งานแทนการลบ"
                : "ลบรายวิชาเรียบร้อยแล้ว",
            "success"
        );
        if (String(GGNAdmin.selectedSubjectId) === String(subjectId)) {
            GGNAdmin.selectedSubjectId = "";
        }
        await loadAdminDashboard();
    } catch (error) {
        adminShowFormError("subject-delete-form-error", error.message);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "ยืนยัน";
        }
    }
}


/* ======================================================
   7. SUBJECT / EXAM SET FILTERS
====================================================== */

function populateQuestionFilters() {
    const subjectSelect = adminElement("filter-subject");
    const examSetSelect = adminElement("filter-examset");

    const questionSubject = adminElement("question-subject");

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
        questionSubject
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
            () => {
                GGNAdmin.selectedSubjectId = subjectSelect.value;
                loadAdminQuestions();
            }
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


function updateQuestionExamSetOptions(preferredExamSetId = "") {
    const subjectSelect = adminElement("question-subject");
    const examSetField = adminElement("question-examset");

    if (!subjectSelect || !examSetField) return "";

    const subjectId = String(subjectSelect.value || "").trim();
    const matchingExamSets = GGNAdmin.examSets.filter(item =>
        String(item.subjectId || "").trim() === subjectId &&
        String(item.examSetId || "").trim() !== ""
    );

    const previousValue = String(
        preferredExamSetId || examSetField.value || ""
    );

    examSetField.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = !subjectId
        ? "เลือกรายวิชาก่อน"
        : matchingExamSets.length
            ? "เลือกชุดข้อสอบ / รุ่น"
            : "วิชานี้ยังไม่มีชุดข้อสอบ";
    examSetField.appendChild(placeholder);

    matchingExamSets.forEach(item => {
        const cohort = GGNAdmin.cohorts.find(row =>
            String(row.cohortId || "") === String(item.cohortId || "")
        );
        const status = String(item.status || "").toUpperCase();
        const option = document.createElement("option");
        option.value = String(item.examSetId);
        option.textContent = [
            item.examSetName || item.examSetId,
            cohort?.cohortName || item.cohortId || "ไม่ระบุรุ่น",
            status === "PUBLISHED" ? "เผยแพร่แล้ว" : "ฉบับร่าง"
        ].filter(Boolean).join(" • ");
        examSetField.appendChild(option);
    });

    const preferred = matchingExamSets.find(item =>
        String(item.examSetId) === previousValue
    );

    if (preferred) {
        examSetField.value = String(preferred.examSetId);
    } else if (matchingExamSets.length === 1) {
        examSetField.value = String(matchingExamSets[0].examSetId);
    } else {
        examSetField.value = "";
    }

    examSetField.disabled = matchingExamSets.length === 0;
    return String(examSetField.value || "");
}


/* ======================================================
   8. QUESTION MANAGEMENT
====================================================== */

async function loadAdminQuestions() {
    const requestVersion = ++GGNAdmin.questionRequestVersion;
    const selectedSubjectId = String(
        GGNAdmin.selectedSubjectId || adminElement("filter-subject")?.value || ""
    );

    const request = (async () => {
        adminSetLoading("question-list-loading", true);
        adminShow("question-table-container", false);
        adminShow("question-list-empty", false);

        try {
            if (!selectedSubjectId) {
                GGNAdmin.questions = [];
                renderAdminQuestions();
                adminShowAlert("กรุณาเลือกรายวิชาจากหน้ารายวิชาก่อน", "warning");
                return false;
            }

            const payload = {
                subjectId: selectedSubjectId,
                // คลังรายวิชาแสดงทุกชุดสอบ จึงไม่จำกัด examSetId
                examSetId: "",
                status: adminElement("filter-question-status")?.value || "",
                keyword: adminElement("question-search")?.value.trim() || ""
            };

            const response = await adminRequest("admin.questions", payload);

            if (requestVersion !== GGNAdmin.questionRequestVersion) return false;

            GGNAdmin.questions = adminGetArray(response, ["questions", "items"]);
            renderAdminQuestions();
            return true;

        } catch (error) {
            if (requestVersion === GGNAdmin.questionRequestVersion) {
                console.error("[GGN Admin] Questions:", error);
                adminShowAlert(`โหลดรายการข้อสอบไม่สำเร็จ: ${error.message}`, "error");
            }
            return false;

        } finally {
            if (requestVersion === GGNAdmin.questionRequestVersion) {
                adminSetLoading("question-list-loading", false);
                GGNAdmin.sectionRequests.questions = null;
            }
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
    adminText("question-count", `${adminFormatNumber(GGNAdmin.questions.length)} ข้อ`);

    if (!GGNAdmin.questions.length) {
        adminShow("question-table-container", false);
        adminShow("question-list-empty", true);
        return;
    }

    adminShow("question-table-container", true);
    adminShow("question-list-empty", false);

    GGNAdmin.questions.forEach((question, index) => {
        const row = document.createElement("tr");
        row.appendChild(adminCreateCell(question.questionNo ?? index + 1));

        // คำถามและตัวเลือก A-D
        const contentCell = document.createElement("td");
        const questionText = document.createElement("div");
        questionText.className = "question-text";
        questionText.textContent = question.questionText || question.question || "(ไม่มีข้อความคำถาม)";
        contentCell.appendChild(questionText);

        const choices = document.createElement("div");
        choices.className = "question-choices";
        ["A", "B", "C", "D"].forEach(letter => {
            const choice = document.createElement("div");
            choice.className = "question-choice" +
                (String(question.correctAnswer || "").toUpperCase() === letter ? " is-correct" : "");
            choice.textContent = `${letter}. ${question[`choice${letter}`] || "(ไม่มีตัวเลือก)"}`;
            choices.appendChild(choice);
        });
        contentCell.appendChild(choices);
        row.appendChild(contentCell);

        row.appendChild(adminCreateCell(getQuestionExamSetName(question.examSetId)));
        row.appendChild(adminCreateCell(question.score ?? "-"));

        const answerCell = document.createElement("td");
        const answer = document.createElement("span");
        answer.className = "question-answer";
        answer.textContent = String(question.correctAnswer || "-").toUpperCase();
        answerCell.appendChild(answer);
        row.appendChild(answerCell);

        row.appendChild(adminCreateCell(question.status || "-"));

        const actionCell = document.createElement("td");
        actionCell.appendChild(adminCreateButton("แก้ไข", "btn btn-sm btn-primary", () => openQuestionModal(question)));

        if (String(question.status || "").toUpperCase() === "ACTIVE") {
            actionCell.appendChild(adminCreateButton(
                "ลบข้อสอบ", "btn btn-sm btn-danger",
                () => deleteAdminQuestion(question.questionId)
            ));
        } else {
            const inactiveLabel = document.createElement("span");
            inactiveLabel.className = "text-muted";
            inactiveLabel.textContent = "ปิดใช้งานแล้ว";
            actionCell.appendChild(inactiveLabel);
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
        question?.subjectId || GGNAdmin.selectedSubjectId || "";

    updateQuestionExamSetOptions(
        question?.examSetId || ""
    );

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
            adminElement("question-examset").value.trim(),

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
        const matchingExamSets = GGNAdmin.examSets.filter(item =>
            String(item.subjectId || "").trim() ===
            String(question.subjectId || "").trim() &&
            String(item.examSetId || "").trim() !== ""
        );

        if (matchingExamSets.length === 0) {
            return "รายวิชานี้ยังไม่มีชุดข้อสอบ กรุณาตรวจสอบข้อมูลชุดข้อสอบก่อนเพิ่มข้อสอบ";
        }

        if (matchingExamSets.length > 1) {
            return "รายวิชานี้มีชุดข้อสอบมากกว่า 1 ชุด ระบบไม่สามารถผูกชุดข้อสอบให้อัตโนมัติได้ กรุณาตรวจสอบรุ่นการทดสอบ";
        }

        return "ไม่สามารถระบุชุดข้อสอบได้ กรุณาลองเลือกวิชาใหม่อีกครั้ง";
    }

    const selectedExamSet = GGNAdmin.examSets.find(item =>
        String(item.examSetId || "") === String(question.examSetId)
    );

    if (!selectedExamSet || String(selectedExamSet.subjectId || "") !== String(question.subjectId)) {
        return "ชุดข้อสอบไม่ตรงกับรายวิชาที่เลือก กรุณาตรวจสอบอีกครั้ง";
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

async function deleteAdminQuestion(questionId) {
    if (!questionId) {
        adminShowAlert(
            "ไม่พบรหัสข้อสอบที่ต้องการลบ",
            "error"
        );

        return;
    }

    const confirmed = window.confirm(
        "ยืนยันการลบข้อสอบข้อนี้หรือไม่?\n\n" +
        "หากข้อสอบมีประวัติการสอบ ระบบจะปิดใช้งานแทนการลบเพื่อรักษาข้อมูลย้อนหลัง"
    );

    if (!confirmed) return;

    try {
        const result = await adminRequest(
            "admin.question.delete",
            { questionId }
        );

        adminShowAlert(
            result.action === "DEACTIVATED"
                ? "ข้อสอบมีประวัติการสอบ จึงปิดใช้งานแทนการลบ"
                : "ลบข้อสอบเรียบร้อยแล้ว",
            "success"
        );

        await loadAdminQuestions();
        await refreshAdminQuestionCount();

    } catch (error) {
        console.error("[GGN Admin] Delete question:", error);

        adminShowAlert(
            `ลบข้อสอบไม่สำเร็จ: ${error.message}`,
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
    if (GGNAdmin.sectionRequests.results) return GGNAdmin.sectionRequests.results;

    const request = (async () => {
        adminSetLoading("result-list-loading", true);
        adminShow("result-table-container", false);
        adminShow("result-list-empty", false);

        try {
            if (!GGNAdmin.cohorts.length) await loadAdminCohorts();

            const cohortId = adminElement("result-filter-cohort")?.value || "";
            if (!cohortId) {
                GGNAdmin.results = [];
                GGNAdmin.resultSubjects = [];
                renderAdminResults();
                adminShow("result-list-empty", true);
                return false;
            }

            const response = await adminRequest("admin.results", {
                cohortId,
                search: adminElement("result-search")?.value.trim() || ""
            });

            GGNAdmin.resultSubjects = Array.isArray(response.subjects) ? response.subjects : [];
            GGNAdmin.results = Array.isArray(response.results) ? response.results : [];
            renderAdminResults();
            return true;
        } catch (error) {
            console.error("[GGN Admin] Results:", error);
            adminShow("result-table-container", false);
            adminShow("result-list-empty", true);
            adminShowAlert(`โหลดผลสอบไม่สำเร็จ: ${error.message}`, "danger");
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
    const head = adminElement("result-table-head");
    const tbody = adminElement("result-table-body");
    if (!head || !tbody) return;

    head.replaceChildren();
    tbody.replaceChildren();

    const subjects = GGNAdmin.resultSubjects || [];
    const headerRow = document.createElement("tr");
    ["ลำดับ", "เลขประจำตัว", "ชื่อผู้เข้าสอบ"].forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
    });

    subjects.forEach(subject => {
        const th = document.createElement("th");
        th.textContent = subject.subjectName || subject.subjectCode || subject.subjectId;
        th.title = subject.subjectCode || "";
        headerRow.appendChild(th);
    });

    const actionHead = document.createElement("th");
    actionHead.textContent = "รายละเอียด";
    headerRow.appendChild(actionHead);
    head.appendChild(headerRow);

    adminText("result-count", `${adminFormatNumber(GGNAdmin.results.length)} รายชื่อ`);

    if (!GGNAdmin.results.length) {
        adminShow("result-table-container", false);
        adminShow("result-list-empty", true);
        return;
    }

    adminShow("result-table-container", true);
    adminShow("result-list-empty", false);

    GGNAdmin.results.forEach((person, index) => {
        const row = document.createElement("tr");
        row.appendChild(adminCreateCell(index + 1));
        row.appendChild(adminCreateCell(person.nationalId || "-"));
        row.appendChild(adminCreateCell(person.examineeName || "-"));

        subjects.forEach(subject => {
            const score = person.subjectScores?.[subject.subjectId];
            const max = person.subjectMaxScores?.[subject.subjectId];
            const cell = document.createElement("td");
            cell.className = "result-score-cell";
            cell.textContent = score === null || score === undefined
                ? `— / ${max === null || max === undefined ? "—" : adminFormatNumber(max, 2)}`
                : `${adminFormatNumber(score, 2)} / ${adminFormatNumber(max ?? 0, 2)}`;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        actionCell.appendChild(adminCreateButton(
            "ดู / แก้ไข",
            "btn btn-sm btn-primary",
            () => openAdminExamineeResult(person)
        ));
        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}


async function openAdminExamineeResult(person) {
    const old = document.getElementById("admin-result-detail-modal");
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = "admin-result-detail-modal";
    modal.className = "modal-overlay";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="modal modal-result-detail">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">ตรวจสอบและแก้ไขคะแนนรายบุคคล</h3>
            <div class="text-muted">${adminEscape(person.examineeName || "-")} · ${adminEscape(person.nationalId || "")}</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" data-result-close>ปิด</button>
        </div>
        <div class="modal-body">
          <div class="result-detail-help">
            แสดง 9 วิชา × 10 ข้อ คะแนนในแต่ละช่องแก้ไขได้ ระบบจะบันทึกทับคะแนนเดิมทันทีเมื่อเปลี่ยนค่า
            <span>คำตอบที่เลือก / เฉลย · คะแนนที่ได้ / คะแนนเต็ม</span>
          </div>
          <div class="result-detail-loading">กำลังโหลดคำตอบทั้ง 9 วิชา...</div>
          <div class="result-detail-content"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector("[data-result-close]").addEventListener("click", close);
    modal.addEventListener("click", event => {
        if (event.target === modal) close();
    });

    try {
        const detail = await adminRequest("admin.result.detail", {
            nationalId: person.nationalId,
            cohortId: person.cohortId
        });
        const subjects = Array.isArray(detail.subjects) ? detail.subjects : [];
        const content = modal.querySelector(".result-detail-content");
        modal.querySelector(".result-detail-loading").remove();

        const table = document.createElement("table");
        table.className = "table result-question-matrix";
        const thead = document.createElement("thead");
        const hr = document.createElement("tr");
        ["รายวิชา", ...Array.from({ length: 10 }, (_, i) => `ข้อ ${i + 1}`)]
            .forEach(label => {
                const th = document.createElement("th");
                th.textContent = label;
                hr.appendChild(th);
            });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        subjects.forEach(subject => {
            const tr = document.createElement("tr");
            const nameCell = document.createElement("th");
            nameCell.className = "result-subject-name";
            nameCell.textContent = subject.subjectName || subject.subjectCode;
            tr.appendChild(nameCell);

            const questionMap = new Map(
                (subject.questions || []).map(q => [Number(q.questionNo), q])
            );

            for (let qNo = 1; qNo <= 10; qNo++) {
                const td = document.createElement("td");
                const q = questionMap.get(qNo);

                if (!subject.attemptId || !q) {
                    td.innerHTML = `<div class="result-question-empty">${subject.attemptId ? "ไม่มีข้อสอบ" : "ยังไม่ได้สอบ"}</div>`;
                } else {
                    const choices = [
                        ["A", q.choiceA], ["B", q.choiceB],
                        ["C", q.choiceC], ["D", q.choiceD]
                    ].filter(x => x[1]).map(x => `${x[0]}. ${x[1]}`).join("\n");

                    const card = document.createElement("div");
                    card.className = "result-question-cell";
                    card.title = `${q.questionText || ""}\n${choices}`;

                    const prompt = document.createElement("div");
                    prompt.className = "result-question-number";
                    prompt.textContent = `ข้อ ${qNo}`;
                    const questionText = document.createElement("div");
                    questionText.className = "result-question-prompt";
                    questionText.textContent = q.questionText || "ไม่มีข้อความคำถาม";
                    const selectedText = q.selectedAnswer
                        ? q[`choice${q.selectedAnswer}`] || ""
                        : "ไม่ได้ตอบ";
                    const correctText = q.correctAnswer
                        ? q[`choice${q.correctAnswer}`] || ""
                        : "";
                    const answers = document.createElement("div");
                    answers.className = "result-question-answers";
                    answers.textContent =
                        `ตอบ ${q.selectedAnswer || "—"}${selectedText ? `: ${selectedText}` : ""} · เฉลย ${q.correctAnswer || "—"}${correctText ? `: ${correctText}` : ""}`;
                    const scoreLabel = document.createElement("label");
                    scoreLabel.className = "result-question-score-label";
                    scoreLabel.textContent = `คะแนน / ${adminFormatNumber(q.maxScore, 2)}`;

                    const input = document.createElement("input");
                    input.type = "number";
                    input.className = "form-control result-question-score";
                    input.min = "0";
                    input.max = String(q.maxScore);
                    input.step = "0.01";
                    input.value = String(q.awardedScore ?? 0);
                    input.dataset.attemptId = subject.attemptId;
                    input.dataset.questionId = q.questionId;
                    input.dataset.maxScore = String(q.maxScore);
                    input.title = q.questionText || `ข้อ ${qNo}`;

                    const status = document.createElement("small");
                    status.className = "result-question-save-status";
                    status.setAttribute("aria-live", "polite");

                    card.append(prompt, questionText, answers, scoreLabel, input, status);
                    td.appendChild(card);
                }
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        const wrapper = document.createElement("div");
        wrapper.className = "table-wrapper result-question-matrix-wrap";
        wrapper.appendChild(table);
        content.appendChild(wrapper);

        content.addEventListener("change", async event => {
            const input = event.target.closest(".result-question-score");
            if (!input) return;

            const value = Number(input.value);
            const max = Number(input.dataset.maxScore);
            const status = input.parentElement.querySelector(".result-question-save-status");

            if (!Number.isFinite(value) || value < 0 || value > max) {
                input.value = String(Math.min(max, Math.max(0, Number(input.defaultValue) || 0)));
                status.textContent = `คะแนนต้องอยู่ระหว่าง 0-${max}`;
                status.className = "result-question-save-status is-error";
                return;
            }

            input.disabled = true;
            status.textContent = "กำลังบันทึก...";
            status.className = "result-question-save-status";

            try {
                await adminRequest("admin.result.adjustScore", {
                    attemptId: input.dataset.attemptId,
                    questionId: input.dataset.questionId,
                    awardedScore: value
                });
                input.defaultValue = String(value);
                status.textContent = "บันทึกแล้ว";
                status.className = "result-question-save-status is-success";
                await loadAdminResults();
            } catch (error) {
                status.textContent = error.message || "บันทึกไม่สำเร็จ";
                status.className = "result-question-save-status is-error";
                adminShowAlert(`บันทึกคะแนนไม่สำเร็จ: ${error.message}`, "danger");
            } finally {
                input.disabled = false;
            }
        });
    } catch (error) {
        modal.querySelector(".result-detail-loading").textContent =
            `โหลดรายละเอียดไม่สำเร็จ: ${error.message}`;
        modal.querySelector(".result-detail-loading").classList.add("is-error");
    }
}


/* ======================================================
   14. COHORT SUMMARY
===================================================== */

async function loadAdminSummary() {
    if (GGNAdmin.sectionRequests.summary) return GGNAdmin.sectionRequests.summary;

    const request = (async () => {
        adminSetLoading("summary-loading", true);
        adminShow("summary-table-container", false);
        adminShow("summary-empty", false);

        try {
            if (!GGNAdmin.cohorts.length) await loadAdminCohorts();
            const cohortId = adminElement("summary-filter-cohort")?.value || "";
            if (!cohortId) {
                clearAdminSummary();
                adminShow("summary-empty", true);
                return false;
            }

            const search = adminElement("summary-search")?.value.trim() || "";
            const response = await adminRequest("admin.result.summary", {
                cohortId,
                search
            });
            renderAdminSummary(response);
            return true;
        } catch (error) {
            console.error("[GGN Admin] Summary:", error);
            clearAdminSummary();
            adminShow("summary-empty", true);
            adminShowAlert(`โหลดสรุปผลไม่สำเร็จ: ${error.message}`, "danger");
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
    adminElement("summary-subject-body")?.replaceChildren();
    adminText("summary-count", "0 คน");
}


function renderAdminSummary(response) {
    const body = adminElement("summary-subject-body");
    if (!body) return;
    body.replaceChildren();

    const data = response?.subjects || response?.data?.subjects || [];
    const examineeCount = Number(response?.examineeCount ?? response?.data?.examineeCount ?? 0);
    adminText("summary-count", `${adminFormatNumber(examineeCount)} คน`);
    if (!Array.isArray(data) || !data.length) {
        adminShow("summary-table-container", false);
        adminShow("summary-empty", true);
        return;
    }

    data.forEach((subject, index) => {
        const row = document.createElement("tr");
        row.appendChild(adminCreateCell(index + 1));
        row.appendChild(adminCreateCell(subject.subjectName || subject.subjectCode || "-"));
        row.appendChild(adminCreateCell(
            subject.averageScore === null || subject.averageScore === undefined
                ? "—"
                : adminFormatNumber(subject.averageScore, 2)
        ));
        body.appendChild(row);
    });

    adminShow("summary-table-container", true);
    adminShow("summary-empty", false);
}


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
            const subjectId = String(GGNAdmin.selectedSubjectId || "");
            const subjectFilter = adminElement("filter-subject");
            const examSetFilter = adminElement("filter-examset");
            const statusFilter = adminElement("filter-question-status");
            const keywordFilter = adminElement("question-search");

            // This page is scoped to the subject selected on the dashboard.
            // Reset optional filters without losing that subject context.
            if (subjectFilter) subjectFilter.value = subjectId;
            if (examSetFilter) examSetFilter.value = "";
            if (statusFilter) statusFilter.value = "";
            if (keywordFilter) keywordFilter.value = "";

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

    adminElement("result-filter-cohort")
        ?.addEventListener("change", loadAdminResults);

    adminElement("result-search")
        ?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                loadAdminResults();
            }
        });

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

    adminElement("summary-search")
        ?.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                loadAdminSummary();
            }
        });

    adminElement("btn-add-subject")
        ?.addEventListener("click", openSubjectAddModal);
    adminElement("btn-delete-subject")
        ?.addEventListener("click", openSubjectDeleteModal);
    adminElement("btn-close-subject-add-modal")
        ?.addEventListener("click", closeSubjectAddModal);
    adminElement("btn-cancel-subject-add")
        ?.addEventListener("click", closeSubjectAddModal);
    adminElement("subject-add-form")
        ?.addEventListener("submit", saveAdminSubject);
    adminElement("btn-close-subject-delete-modal")
        ?.addEventListener("click", closeSubjectDeleteModal);
    adminElement("btn-cancel-subject-delete")
        ?.addEventListener("click", closeSubjectDeleteModal);
    adminElement("subject-delete-form")
        ?.addEventListener("submit", deleteAdminSubject);

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
