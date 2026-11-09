
/* ======================================================
   GGN TEST
   API SERVICE
   Version: 1.0.1
   Updated: 2026-11-09
   File: js/api.js

   CHANGE:
   - Use one API URL configuration
   - Fix API_URL_NOT_CONFIGURED
   - Improve request error handling
   - Disable retry for write operations
   - Keep existing Admin and Exam API contracts
   - Add connection diagnostics
   ====================================================== */

"use strict";


/**
 * ======================================================
 * 1. API CONFIGURATION
 * ======================================================
 *
 * ใช้ URL ของ Google Apps Script Web App เพียงจุดเดียว
 *
 * หากเปลี่ยน Deployment URL ในอนาคต
 * ให้แก้เฉพาะ API_URL ตรงนี้
 */

const GGN_API_CONFIG = Object.freeze({

  API_URL:
    "https://script.google.com/macros/s/AKfycbxcapkXv-BOhTaKG1CR578V7v9IIUdXQpJiq2bcCyxdYiIV0gumgYBaTE5rFge1L_otBg/exec",

  TIMEOUT: 30000,

  RETRY_COUNT: 1,

  DEBUG: true

});


/**
 * ======================================================
 * 2. API ERROR
 * ======================================================
 */

class GGNApiError extends Error {

  constructor(
    message,
    code = "API_ERROR",
    details = null
  ) {

    super(message);

    this.name = "GGNApiError";
    this.code = code;
    this.details = details;

  }

}


/**
 * ======================================================
 * 3. API URL VALIDATION
 * ======================================================
 */

function validateGGNApiUrl() {

  const url = String(
    GGN_API_CONFIG.API_URL || ""
  ).trim();

  if (!url) {

    throw new GGNApiError(
      "ยังไม่ได้กำหนด URL ของ Google Apps Script",
      "API_URL_NOT_CONFIGURED"
    );

  }

  if (
    !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(url)
  ) {

    throw new GGNApiError(
      "URL ของ Google Apps Script Web App ไม่ถูกต้อง",
      "INVALID_API_URL",
      url
    );

  }

  return url;

}


/**
 * ======================================================
 * 4. DEBUG LOGGER
 * ======================================================
 */

function ggnApiLog(...args) {

  if (!GGN_API_CONFIG.DEBUG) return;

  console.log("[GGN API]", ...args);

}


function ggnApiWarn(...args) {

  if (!GGN_API_CONFIG.DEBUG) return;

  console.warn("[GGN API]", ...args);

}


function ggnApiErrorLog(...args) {

  console.error("[GGN API]", ...args);

}


/**
 * ======================================================
 * 5. REQUEST ID
 * ======================================================
 */

function generateGGNRequestId() {

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {

    return crypto.randomUUID();

  }

  return (
    "REQ-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 10)
  );

}


/**
 * ======================================================
 * 6. REQUEST TIMEOUT
 * ======================================================
 */

function createGGNAbortController(timeout) {

  const controller = new AbortController();

  const timer = setTimeout(() => {

    controller.abort();

  }, timeout);

  return {

    controller,

    clear: () => clearTimeout(timer)

  };

}


/**
 * ======================================================
 * 7. SAFE RETRY POLICY
 * ======================================================
 *
 * Retry เฉพาะคำสั่งอ่านข้อมูล
 *
 * ไม่ Retry คำสั่งที่เปลี่ยนแปลงข้อมูล
 * เพื่อป้องกันการสร้างรายการซ้ำ
 */

function isGGNRetrySafeAction(action) {

  const safeActions = [

    "system.ping",

    "admin.dashboard",
    "admin.subjects",
    "admin.examSets",
    "admin.questions",
    "admin.results",

    "exam.examinees",
    "exam.attempt"

  ];

  return safeActions.includes(action);

}


/**
 * ======================================================
 * 8. PARSE RESPONSE
 * ======================================================
 */

async function parseGGNApiResponse(response) {

  let responseText = "";

  try {

    responseText = await response.text();

  } catch (error) {

    throw new GGNApiError(
      "ไม่สามารถอ่านข้อความตอบกลับจาก Backend ได้",
      "RESPONSE_READ_FAILED",
      error.message
    );

  }

  if (!responseText) {

    throw new GGNApiError(
      "Backend ไม่ได้ส่งข้อมูลตอบกลับ",
      "EMPTY_RESPONSE"
    );

  }

  let result;

  try {

    result = JSON.parse(responseText);

  } catch (error) {

    ggnApiWarn(
      "Invalid JSON response:",
      responseText.substring(0, 500)
    );

    throw new GGNApiError(
      "รูปแบบข้อมูลตอบกลับจาก Backend ไม่ถูกต้อง",
      "INVALID_JSON_RESPONSE",
      responseText.substring(0, 500)
    );

  }

  if (
    result === null ||
    typeof result !== "object" ||
    Array.isArray(result)
  ) {

    throw new GGNApiError(
      "ข้อมูลตอบกลับจาก Backend ไม่ถูกต้อง",
      "INVALID_RESPONSE_FORMAT"
    );

  }

  return result;

}


/**
 * ======================================================
 * 9. CORE API REQUEST
 * ======================================================
 *
 * REQUEST:
 *
 * {
 *   action: "admin.dashboard",
 *   payload: {},
 *   requestId: "...",
 *   clientTimestamp: "..."
 * }
 *
 * RESPONSE:
 *
 * {
 *   success: true,
 *   data: {},
 *   message: ""
 * }
 *
 */

async function ggnApiRequest(
  action,
  payload = {},
  options = {}
) {

  if (
    !action ||
    typeof action !== "string"
  ) {

    throw new GGNApiError(
      "ไม่ได้ระบุ API Action",
      "INVALID_ACTION"
    );

  }

  const apiUrl = validateGGNApiUrl();

  const timeout =
    Number(options.timeout) ||
    GGN_API_CONFIG.TIMEOUT;

  const requestBody = {

    action: action,

    payload: payload,

    requestId: generateGGNRequestId(),

    clientTimestamp: new Date().toISOString()

  };


  /**
   * Retry เฉพาะ Read Action เท่านั้น
   */

  const retryAllowed =
    isGGNRetrySafeAction(action) &&
    options.retry !== false;

  const retryCount = retryAllowed
    ? GGN_API_CONFIG.RETRY_COUNT
    : 0;


  let lastError = null;


  for (
    let attempt = 0;
    attempt <= retryCount;
    attempt++
  ) {

    const {
      controller,
      clear
    } = createGGNAbortController(timeout);


    try {

      ggnApiLog("Request:", {

        action: action,

        requestId: requestBody.requestId,

        attempt: attempt + 1

      });


      const response = await fetch(
        apiUrl,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "text/plain;charset=utf-8"

          },

          body: JSON.stringify(requestBody),

          signal: controller.signal,

          redirect: "follow"

        }
      );


      if (!response.ok) {

        throw new GGNApiError(

          "HTTP Error: " + response.status,

          "HTTP_ERROR",

          {

            status: response.status,

            statusText: response.statusText

          }

        );

      }


      const result =
        await parseGGNApiResponse(response);


      ggnApiLog("Response:", {

        action: action,

        success: result.success,

        requestId: requestBody.requestId

      });


      if (result.success === false) {

        throw new GGNApiError(

          result.message ||
            "Backend ไม่สามารถดำเนินการได้",

          result.code ||
            "BACKEND_ERROR",

          result.details || null

        );

      }


      return result;


    } catch (error) {

      lastError = error;


      if (error.name === "AbortError") {

        lastError = new GGNApiError(

          "การเชื่อมต่อ Backend หมดเวลา",

          "REQUEST_TIMEOUT",

          {
            action: action,
            timeout: timeout
          }

        );

      } else if (
        error instanceof TypeError
      ) {

        lastError = new GGNApiError(

          "ไม่สามารถเชื่อมต่อ Backend ได้ กรุณาตรวจสอบ URL, Deployment และการตั้งค่า CORS",

          "NETWORK_ERROR",

          error.message

        );

      }


      ggnApiWarn(
        "Request failed:",
        action,
        lastError
      );


      if (attempt < retryCount) {

        await new Promise(resolve => {

          setTimeout(resolve, 1000);

        });

      }

    } finally {

      clear();

    }

  }


  throw lastError ||
    new GGNApiError(
      "เกิดข้อผิดพลาดในการเชื่อมต่อ Backend",
      "UNKNOWN_ERROR"
    );

}


/**
 * ======================================================
 * 10. ADMIN API
 * ======================================================
 */

const GGNAdminAPI = {

  getDashboard() {

    return ggnApiRequest(
      "admin.dashboard"
    );

  },


  getSubjects() {

    return ggnApiRequest(
      "admin.subjects"
    );

  },


  getExamSets(payload = {}) {

    return ggnApiRequest(
      "admin.examSets",
      payload
    );

  },


  getQuestions(payload = {}) {

    return ggnApiRequest(
      "admin.questions",
      payload
    );

  },


  createQuestion(payload) {

    return ggnApiRequest(
      "admin.question.create",
      payload,
      { retry: false }
    );

  },


  updateQuestion(payload) {

    return ggnApiRequest(
      "admin.question.update",
      payload,
      { retry: false }
    );

  },


  deactivateQuestion(payload) {

    return ggnApiRequest(
      "admin.question.deactivate",
      payload,
      { retry: false }
    );

  },


  getResults(payload = {}) {

    return ggnApiRequest(
      "admin.results",
      payload
    );

  },


  adjustScore(payload) {

    return ggnApiRequest(
      "admin.result.adjustScore",
      payload,
      { retry: false }
    );

  }

};


/**
 * ======================================================
 * 11. EXAMINEE API
 * ======================================================
 */

const GGNExamAPI = {

  getExaminees(payload = {}) {

    return ggnApiRequest(
      "exam.examinees",
      payload
    );

  },


  startExam(payload) {

    return ggnApiRequest(
      "exam.start",
      payload,
      { retry: false }
    );

  },


  saveAnswer(payload) {

    return ggnApiRequest(
      "exam.saveAnswer",
      payload,
      { retry: false }
    );

  },


  submitExam(payload) {

    return ggnApiRequest(
      "exam.submit",
      payload,
      { retry: false }
    );

  },


  getAttempt(payload) {

    return ggnApiRequest(
      "exam.attempt",
      payload,
      { retry: false }
    );

  }

};


/**
 * ======================================================
 * 12. CONNECTION TEST
 * ======================================================
 *
 * ทดสอบการเชื่อมต่อกับ Backend
 *
 * Backend ต้องมี Action:
 * system.ping
 *
 */

async function testGGNApiConnection() {

  try {

    const result = await ggnApiRequest(

      "system.ping",

      {},

      {

        retry: false,

        timeout: 10000

      }

    );


    ggnApiLog(
      "Backend connection successful",
      result
    );


    return {

      success: true,

      message: "เชื่อมต่อ Backend สำเร็จ",

      data: result.data || null

    };


  } catch (error) {

    ggnApiErrorLog(
      "Backend connection failed",
      error
    );


    return {

      success: false,

      message: error.message,

      code: error.code ||
        "CONNECTION_FAILED",

      details: error.details || null

    };

  }

}


/**
 * ======================================================
 * 13. GLOBAL API EXPORT
 * ======================================================
 *
 * ใช้งานจาก admin.js และไฟล์อื่น
 *
 */

window.GGNApi = {

  request: ggnApiRequest,

  testConnection: testGGNApiConnection,

  Admin: GGNAdminAPI,

  Exam: GGNExamAPI,

  Error: GGNApiError

};


/**
 * ======================================================
 * 14. INITIALIZATION LOG
 * ======================================================
 */

(function initializeGGNApi() {

  try {

    const url = validateGGNApiUrl();

    ggnApiLog(
      "API initialized",
      {
        endpointConfigured: true,
        endpoint: url,
        version: "1.0.1"
      }
    );

  } catch (error) {

    ggnApiErrorLog(
      "API initialization failed",
      error.message,
      error.code
    );

  }

})();
