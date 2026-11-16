
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
 * - Optional search by name or national ID
 * - Render all subject scores
 * - Open individual result detail
 * - Prevent stale requests from overwriting newer results
 *
 * DEPENDENCIES
 * - js/api.js
 * - js/admin.js
 * ======================================================
 */

"use strict";


/* ======================================================
   REQUEST CONTROL
====================================================== */

let GGNAdminResultsRequestVersion = 0;


/* ======================================================
   LOAD RESULTS
====================================================== */

async function loadAdminResults() {
    const requestVersion = ++GGNAdminResultsRequestVersion;

    const request = (async () => {
        adminSetLoading("result-list-loading", true);
        adminShow("result-table-container", false);
        adminShow("result-list-empty", false);

        try {
            if (!GGNAdmin.cohorts.length) {
                await loadAdminCohorts();
            }

            // Ignore this request if a newer search has started.
            if (requestVersion !== GGNAdminResultsRequestVersion) {
                return false;
            }

            const cohortId =
                adminElement("result-filter-cohort")?.value || "";

            if (!cohortId) {
                GGNAdmin.results = [];
                GGNAdmin.resultSubjects = [];

                renderAdminResults();
                adminShow("result-list-empty", true);

                return false;
            }

            const search =
                adminElement("result-search")?.value.trim() || "";

            const response = await adminRequest("admin.results", {
                cohortId,
                search
            });

            // Do not allow an older response to replace newer search results.
            if (requestVersion !== GGNAdminResultsRequestVersion) {
                return false;
            }

            GGNAdmin.resultSubjects = Array.isArray(response.subjects)
                ? response.subjects
                : [];

            GGNAdmin.results = Array.isArray(response.results)
                ? response.results
                : [];

            renderAdminResults();

            return true;

        } catch (error) {
            if (requestVersion === GGNAdminResultsRequestVersion) {
                console.error("[GGN Admin] Results:", error);

                GGNAdmin.results = [];
                GGNAdmin.resultSubjects = [];

                adminShow("result-table-container", false);
                adminShow("result-list-empty", true);

                adminShowAlert(
                    `โหลดผลสอบไม่สำเร็จ: ${error.message}`,
                    "danger"
                );
            }

            return false;

        } finally {
            if (requestVersion === GGNAdminResultsRequestVersion) {
                adminSetLoading("result-list-loading", false);

                GGNAdmin.sectionRequests.results = null;
            }
        }
    })();

    GGNAdmin.sectionRequests.results = request;

    return request;
}


/* ======================================================
   RENDER RESULTS
====================================================== */

function renderAdminResults() {
    const head = adminElement("result-table-head");
    const tbody = adminElement("result-table-body");

    if (!head || !tbody) return;

    head.replaceChildren();
    tbody.replaceChildren();

    const subjects = GGNAdmin.resultSubjects || [];

    const headerRow = document.createElement("tr");

    [
        "ลำดับ",
        "เลขประจำตัว",
        "ชื่อผู้เข้าสอบ"
    ].forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
    });

    subjects.forEach(subject => {
        const th = document.createElement("th");

        th.textContent =
            subject.subjectName ||
            subject.subjectCode ||
            subject.subjectId ||
            "-";

        th.title = subject.subjectCode || "";

        headerRow.appendChild(th);
    });

    const actionHead = document.createElement("th");
    actionHead.textContent = "รายละเอียด";

    headerRow.appendChild(actionHead);
    head.appendChild(headerRow);

    adminText(
        "result-count",
        `${adminFormatNumber(GGNAdmin.results.length)} รายชื่อ`
    );

    if (!GGNAdmin.results.length) {
        adminShow("result-table-container", false);
        adminShow("result-list-empty", true);
        return;
    }

    adminShow("result-table-container", true);
    adminShow("result-list-empty", false);

    GGNAdmin.results.forEach((person, index) => {
        const row = document.createElement("tr");

        row.appendChild(
            adminCreateCell(index + 1)
        );

        row.appendChild(
            adminCreateCell(person.nationalId || "-")
        );

        row.appendChild(
            adminCreateCell(person.examineeName || "-")
        );

        subjects.forEach(subject => {
            const score =
                person.subjectScores?.[subject.subjectId];

            const max =
                person.subjectMaxScores?.[subject.subjectId];

            const cell = document.createElement("td");

            cell.className = "result-score-cell";

            if (score === null || score === undefined) {
                cell.textContent =
                    `— / ${
                        max === null || max === undefined
                            ? "—"
                            : adminFormatNumber(max, 2)
                    }`;
            } else {
                cell.textContent =
                    `${adminFormatNumber(score, 2)} / ${
                        adminFormatNumber(max ?? 0, 2)
                    }`;
            }

            row.appendChild(cell);
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
