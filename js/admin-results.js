
/**
 * ======================================================
 * GGN TEST
 * ADMIN RESULTS
 * ======================================================
 *
 * File: js/admin-results.js
 * Version: 1.0.1
 * Updated: 2026-11-16
 *
 * PURPOSE
 * - Load examinee results by cohort
 * - Optional search by name / national ID
 * - Render one row per examinee
 * - Render dynamic subject columns
 * - Open individual result detail
 * ======================================================
 */

"use strict";

let GGNAdminResultsRequestVersion = 0;


/* ======================================================
   1. LOAD RESULTS
====================================================== */

async function loadAdminResults() {
    const requestVersion = ++GGNAdminResultsRequestVersion;

    const cohortId =
        adminElement("result-filter-cohort")?.value || "";

    const search =
        adminElement("result-search")?.value.trim() || "";

    if (!cohortId) {
        GGNAdmin.results = [];
        GGNAdmin.resultSubjects = [];

        renderAdminResults();

        adminText("result-count", "0 รายชื่อ");
        adminSetLoading("result-list-loading", false);

        return false;
    }

    const request = (async () => {
        adminSetLoading("result-list-loading", true);
        adminShow("result-table-container", false);
        adminShow("result-list-empty", false);

        try {
            const response = await adminRequest(
                "admin.results",
                {
                    cohortId,
                    search
                }
            );

            if (
                requestVersion !==
                GGNAdminResultsRequestVersion
            ) {
                return false;
            }

            GGNAdmin.resultSubjects =
                Array.isArray(response.subjects)
                    ? response.subjects
                    : [];

            GGNAdmin.results =
                Array.isArray(response.results)
                    ? response.results
                    : [];

            renderAdminResults();

            adminText(
                "result-count",
                `${adminFormatNumber(GGNAdmin.results.length)} รายชื่อ`
            );

            return true;

        } catch (error) {
            if (
                requestVersion ===
                GGNAdminResultsRequestVersion
            ) {
                console.error(
                    "[GGN Admin] Results:",
                    error
                );

                GGNAdmin.results = [];
                GGNAdmin.resultSubjects = [];

                renderAdminResults();

                adminShowAlert(
                    `โหลดผลสอบไม่สำเร็จ: ${error.message}`,
                    "error"
                );
            }

            return false;

        } finally {
            if (
                requestVersion ===
                GGNAdminResultsRequestVersion
            ) {
                adminSetLoading("result-list-loading", false);
                GGNAdmin.sectionRequests.results = null;
            }
        }
    })();

    GGNAdmin.sectionRequests.results = request;

    return request;
}


/* ======================================================
   2. RENDER TABLE HEADER
====================================================== */

function renderAdminResultsHeader() {
    const thead = adminElement("result-table-head");

    if (!thead) return;

    thead.replaceChildren();

    const row = document.createElement("tr");

    [
        "เลขประจำตัวประชาชน",
        "ชื่อ - นามสกุล"
    ].forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        row.appendChild(th);
    });

    GGNAdmin.resultSubjects.forEach(subject => {
        const th = document.createElement("th");

        th.textContent =
            subject.subjectCode ||
            subject.subjectName ||
            subject.subjectId ||
            "-";

        th.title = subject.subjectName || "";

        row.appendChild(th);
    });

    const actionHeader = document.createElement("th");
    actionHeader.textContent = "รายละเอียด";

    row.appendChild(actionHeader);

    thead.appendChild(row);
}


/* ======================================================
   3. RENDER RESULTS
====================================================== */

function renderAdminResults() {
    const tbody = adminElement("result-table-body");

    if (!tbody) return;

    tbody.replaceChildren();

    const results = Array.isArray(GGNAdmin.results)
        ? GGNAdmin.results
        : [];

    const subjects = Array.isArray(GGNAdmin.resultSubjects)
        ? GGNAdmin.resultSubjects
        : [];

    renderAdminResultsHeader();

    if (!results.length) {
        adminShow("result-table-container", false);
        adminShow("result-list-empty", true);
        return;
    }

    adminShow("result-table-container", true);
    adminShow("result-list-empty", false);

    results.forEach(person => {
        const row = document.createElement("tr");

        row.appendChild(
            adminCreateCell(person.nationalId || "-")
        );

        row.appendChild(
            adminCreateCell(person.examineeName || "-")
        );

        const scoreMap = person.subjectScores || {};
        const maxScoreMap = person.subjectMaxScores || {};

        subjects.forEach(subject => {
            const subjectCode = String(
                subject.subjectCode ||
                subject.subjectId ||
                ""
            );

            const subjectId = String(
                subject.subjectId || ""
            );

            const score =
                scoreMap[subjectCode] ??
                scoreMap[subjectId];

            const maxScore =
                maxScoreMap[subjectCode] ??
                maxScoreMap[subjectId];

            let display = "-";

            if (
                score !== null &&
                score !== undefined &&
                score !== ""
            ) {
                display =
                    `${adminFormatNumber(score, 2)} / ` +
                    `${adminFormatNumber(maxScore ?? 0, 2)}`;
            }

            row.appendChild(
                adminCreateCell(display, "text-center")
            );
        });

        const actionCell = document.createElement("td");

        actionCell.appendChild(
            adminCreateButton(
                "ดู / แก้ไข",
                "btn btn-sm btn-primary",
                () => openAdminExamineeResult(person)
            )
        );

        row.appendChild(actionCell);

        tbody.appendChild(row);
    });
}
