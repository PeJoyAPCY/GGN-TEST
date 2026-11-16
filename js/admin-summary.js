
/**
 * ======================================================
 * GGN TEST
 * ADMIN SUMMARY
 * ======================================================
 *
 * File: js/admin-summary.js
 * Version: 1.0.0
 * Updated: 2026-11-16
 *
 * PURPOSE
 * - Load cohort summary
 * - Optional examinee search
 * - Display cohort or individual subject scores
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

let GGNAdminSummaryRequestVersion = 0;


/* ======================================================
   LOAD SUMMARY
====================================================== */

async function loadAdminSummary() {
    const requestVersion = ++GGNAdminSummaryRequestVersion;

    const request = (async () => {
        adminSetLoading("summary-loading", true);

        adminShow("summary-table-container", false);
        adminShow("summary-empty", false);

        try {
            if (!GGNAdmin.cohorts.length) {
                await loadAdminCohorts();
            }

            if (requestVersion !== GGNAdminSummaryRequestVersion) {
                return false;
            }

            const cohortId =
                adminElement("summary-filter-cohort")?.value || "";

            if (!cohortId) {
                clearAdminSummary();

                adminShow("summary-empty", true);

                return false;
            }

            const search =
                adminElement("summary-search")?.value.trim() || "";

            const response = await adminRequest(
                "admin.result.summary",
                {
                    cohortId,
                    search
                }
            );

            if (requestVersion !== GGNAdminSummaryRequestVersion) {
                return false;
            }

            GGNAdmin.summary = response;

            renderAdminSummary(response);

            return true;

        } catch (error) {
            if (requestVersion === GGNAdminSummaryRequestVersion) {
                console.error(
                    "[GGN Admin] Summary:",
                    error
                );

                GGNAdmin.summary = null;

                clearAdminSummary();

                adminShow("summary-empty", true);

                adminShowAlert(
                    `โหลดสรุปผลไม่สำเร็จ: ${error.message}`,
                    "danger"
                );
            }

            return false;

        } finally {
            if (requestVersion === GGNAdminSummaryRequestVersion) {
                adminSetLoading("summary-loading", false);

                GGNAdmin.sectionRequests.summary = null;
            }
        }
    })();

    GGNAdmin.sectionRequests.summary = request;

    return request;
}


/* ======================================================
   CLEAR SUMMARY
====================================================== */

function clearAdminSummary() {
    adminElement("summary-subject-body")?.replaceChildren();

    adminText("summary-count", "0 คน");
}


/* ======================================================
   RENDER SUMMARY
====================================================== */

function renderAdminSummary(response) {
    const body = adminElement("summary-subject-body");

    if (!body) return;

    body.replaceChildren();

    const data = Array.isArray(response?.subjects)
        ? response.subjects
        : [];

    const examineeCount = Number(
        response?.examineeCount ?? 0
    );

    adminText(
        "summary-count",
        `${adminFormatNumber(examineeCount)} คน`
    );

    if (!data.length) {
        adminShow("summary-table-container", false);
        adminShow("summary-empty", true);
        return;
    }

    data.forEach((subject, index) => {
        const row = document.createElement("tr");

        row.appendChild(
            adminCreateCell(index + 1)
        );

        row.appendChild(
            adminCreateCell(
                subject.subjectName ||
                subject.subjectCode ||
                "-"
            )
        );

        row.appendChild(
            adminCreateCell(
                subject.averageScore === null ||
                subject.averageScore === undefined
                    ? "—"
                    : adminFormatNumber(
                        subject.averageScore,
                        2
                    )
            )
        );

        body.appendChild(row);
    });

    adminShow("summary-table-container", true);
    adminShow("summary-empty", false);
}
