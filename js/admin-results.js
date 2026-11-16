
/**
 * ======================================================
 * GGN TEST
 * ADMIN RESULTS
 * ======================================================
 *
 * File: js/admin-results.js
 * Version: 1.0.0
 * Updated: 2026-11-16
 *
 * PURPOSE
 * - Load examinee results by cohort
 * - Optional search by name / national ID
 * - Render one row per examinee
 * - Open individual result detail
 *
 * DEPENDENCIES
 * - js/api.js
 * - js/admin.js
 * - js/admin-result-detail.js
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

    // ต้องเลือกรุ่นสอบก่อนแสดงผล
    if (!cohortId) {
        GGNAdmin.results = [];
        GGNAdmin.resultSubjects = [];

        renderAdminResults();

        adminText("result-count", "0 รายการ");
        adminSetLoading("results-loading", false);

        return false;
    }

    const request = (async () => {
        adminSetLoading("results-loading", true);
        adminShow("results-table-container", false);
        adminShow("results-empty", false);

        try {
            const response = await adminRequest(
                "admin.results",
                {
                    cohortId,
                    search
                }
            );

            // ป้องกันผลตอบกลับเก่าทับข้อมูลจากคำค้นล่าสุด
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
                `${adminFormatNumber(GGNAdmin.results.length)} รายการ`
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
                adminSetLoading("results-loading", false);

                GGNAdmin.sectionRequests.results = null;
            }
        }
    })();

    GGNAdmin.sectionRequests.results = request;

    return request;
}


/* ======================================================
   2. RENDER RESULTS
====================================================== */

function renderAdminResults() {
    const tbody = adminElement("results-table-body");

    if (!tbody) return;

    tbody.replaceChildren();

    const results = Array.isArray(GGNAdmin.results)
        ? GGNAdmin.results
        : [];

    const subjects = Array.isArray(GGNAdmin.resultSubjects)
        ? GGNAdmin.resultSubjects
        : [];

    if (!results.length) {
        adminShow("results-table-container", false);
        adminShow("results-empty", true);
        return;
    }

    adminShow("results-table-container", true);
    adminShow("results-empty", false);

    results.forEach(person => {
        const row = document.createElement("tr");

        row.appendChild(
            adminCreateCell(person.nationalId || "-")
        );

        row.appendChild(
            adminCreateCell(person.examineeName || "-")
        );

        subjects.forEach(subject => {
            const subjectCode =
                subject.subjectCode ||
                subject.subjectId ||
                "";

            const scoreMap =
                person.subjectScores || {};

            const maxScoreMap =
                person.subjectMaxScores || {};

            const score = scoreMap[subjectCode];
            const maxScore = maxScoreMap[subjectCode];

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
