
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
 * - Load cohort score summary
 * - Optional search by name / national ID
 * - Display average score by subject
 * - Display examinee count in selected scope
 * - Read-only
 *
 * DEPENDENCIES
 * - js/api.js
 * - js/admin.js
 * ======================================================
 */

"use strict";

let GGNAdminSummaryRequestVersion = 0;


/* ======================================================
   1. LOAD SUMMARY
====================================================== */

async function loadAdminSummary() {
    const requestVersion = ++GGNAdminSummaryRequestVersion;

    const cohortId =
        adminElement("summary-filter-cohort")?.value || "";

    const search =
        adminElement("summary-search")?.value.trim() || "";

    if (!cohortId) {
        clearAdminSummary();

        adminSetLoading("summary-loading", false);

        return false;
    }

    const request = (async () => {
        adminSetLoading("summary-loading", true);
        adminShow("summary-content", false);
        adminShow("summary-empty", false);

        try {
            const response = await adminRequest(
                "admin.result.summary",
                {
                    cohortId,
                    search
                }
            );

            if (
                requestVersion !==
                GGNAdminSummaryRequestVersion
            ) {
                return false;
            }

            GGNAdmin.summary = response;

            renderAdminSummary(response);

            return true;

        } catch (error) {
            if (
                requestVersion ===
                GGNAdminSummaryRequestVersion
            ) {
                console.error(
                    "[GGN Admin] Summary:",
                    error
                );

                clearAdminSummary();

                adminShowAlert(
                    `โหลดสรุปผลไม่สำเร็จ: ${error.message}`,
                    "error"
                );
            }

            return false;

        } finally {
            if (
                requestVersion ===
                GGNAdminSummaryRequestVersion
            ) {
                adminSetLoading("summary-loading", false);

                GGNAdmin.sectionRequests.summary = null;
            }
        }
    })();

    GGNAdmin.sectionRequests.summary = request;

    return request;
}


/* ======================================================
   2. CLEAR SUMMARY
====================================================== */

function clearAdminSummary() {
    GGNAdmin.summary = null;

    const tbody = adminElement("summary-table-body");

    if (tbody) {
        tbody.replaceChildren();
    }

    adminText("summary-count", "0 คน");

    adminShow("summary-content", false);
    adminShow("summary-empty", true);
}


/* ======================================================
   3. RENDER SUMMARY
====================================================== */

function renderAdminSummary(response) {
    const tbody = adminElement("summary-table-body");

    if (!tbody) return;

    tbody.replaceChildren();

    const subjects = Array.isArray(response?.subjects)
        ? response.subjects
        : [];

    const examineeCount = Number(
        response?.examineeCount ?? 0
    );

    adminText(
        "summary-count",
        `${adminFormatNumber(examineeCount)} คน`
    );

    if (!subjects.length) {
        adminShow("summary-content", false);
        adminShow("summary-empty", true);
        return;
    }

    adminShow("summary-content", true);
    adminShow("summary-empty", false);

    subjects.forEach(subject => {
        const row = document.createElement("tr");

        row.appendChild(
            adminCreateCell(
                subject.subjectCode || "-"
            )
        );

        row.appendChild(
            adminCreateCell(
                subject.subjectName || "-"
            )
        );

        const average = subject.averageScore;

        row.appendChild(
            adminCreateCell(
                average === null ||
                average === undefined ||
                average === ""
                    ? "-"
                    : adminFormatNumber(average, 2),
                "text-center"
            )
        );

        tbody.appendChild(row);
    });
}
