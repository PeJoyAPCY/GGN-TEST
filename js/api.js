
/* ======================================================
   GGN TEST
   API SERVICE
   Version: 1.0.0
   File: js/api.js
   ====================================================== */

    const GGN_CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbxcapkXv-BOhTaKG1CR578V7v9IIUdXQpJiq2bcCyxdYiIV0gumgYBaTE5rFge1L_otBg/exec"
    };

/**
 * ======================================================
 * 1. API CONFIGURATION
 * ======================================================
 *
 * หลังจากตั้งค่า Backend เสร็จแล้ว
 * ให้นำ URL ของ Google Apps Script Web App
 * มาใส่ใน API_URL
 *
 */

const GGN_API_CONFIG = {
  API_URL: "",

  TIMEOUT: 30000,

  RETRY_COUNT: 1,

  DEBUG: true
};


/**
 * ======================================================
 * 2. API ERROR
 * ======================================================
 */

class GGNApiError extends Error {
  constructor(message, code = "API_ERROR", details = null) {
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
  const url = GGN_API_CONFIG.API_URL;

  if (!url) {
    throw new GGNApiError(
      "ยังไม่ได้กำหนด URL ของ Google Apps Script",
      "API_URL_NOT_CONFIGURED"
    );
  }

  if (
    !url.startsWith("https://script.google.com/") &&
    !url.startsWith("https://script.googleusercontent.com/")
  ) {
    throw new GGNApiError(
      "URL ของ Backend ไม่ถูกต้อง",
      "INVALID_API_URL"
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
 * 7. PARSE RESPONSE
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
      "INVALID_JSON_RESPONSE"
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
 * 8. CORE API REQUEST
 * ======================================================
 *
 * รูปแบบ Request:
 *
 * {
 *   action: "admin.dashboard",
 *   payload: {}
 * }
 *
 * รูปแบบ Response มาตรฐาน:
 *
 * {
 *   success: true,
 *   data: {},
 *   message: ""
 * }
 *
 */

async function ggnApiRequest(action, payload = {}, options = {}) {

  if (!action || typeof action !== "string") {
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
    action,
    payload,
    requestId: generateGGNRequestId(),
    clientTimestamp: new Date().toISOString()
  };

  const retryCount =
    options.retry === false
      ? 0
      : GGN_API_CONFIG.RETRY_COUNT;

  let lastError = null;

  for (
    let attempt = 0;
    attempt <= retryCount;
    attempt++
  ) {

    const { controller, clear } =
      createGGNAbortController(timeout);

    try {

      ggnApiLog("Request:", {
        action,
        attempt: attempt + 1
      });

      const response = await fetch(apiUrl, {
        method: "POST",

        /**
         * ใช้ text/plain เพื่อลดปัญหา
         * CORS preflight request
         *
         * Backend ต้องอ่านข้อมูลจาก
         * e.postData.contents
         */

        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },

        body: JSON.stringify(requestBody),

        signal: controller.signal,

        redirect: "follow"
      });

      if (!response.ok) {
        throw new GGNApiError(
          `HTTP Error: ${response.status}`,
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
        action,
        success: result.success
      });

      if (result.success === false) {

        throw new GGNApiError(
          result.message ||
            "Backend ไม่สามารถดำเนินการได้",

          result.code || "BACKEND_ERROR",

          result.details || null
        );
      }

      return result;

    } catch (error) {

      lastError = error;

      if (error.name === "AbortError") {

        lastError = new GGNApiError(
          "การเชื่อมต่อ Backend หมดเวลา",
          "REQUEST_TIMEOUT"
        );

      } else if (
        error instanceof TypeError
      ) {

        lastError = new GGNApiError(
          "ไม่สามารถเชื่อมต่อ Backend ได้ กรุณาตรวจสอบ URL และการตั้งค่าการเชื่อมต่อ",
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
        await new Promise(resolve =>
          setTimeout(resolve, 1000)
        );
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
 * 9. ADMIN API
 * ======================================================
 */

const GGNAdminAPI = {

  /**
   * Dashboard
   */
  getDashboard() {
    return ggnApiRequest(
      "admin.dashboard"
    );
  },


  /**
   * Subject List
   */
  getSubjects() {
    return ggnApiRequest(
      "admin.subjects"
    );
  },


  /**
   * Exam Set List
   */
  getExamSets(payload = {}) {
    return ggnApiRequest(
      "admin.examSets",
      payload
    );
  },


  /**
   * Question List
   */
  getQuestions(payload = {}) {
    return ggnApiRequest(
      "admin.questions",
      payload
    );
  },


  /**
   * Create Question
   */
  createQuestion(payload) {
    return ggnApiRequest(
      "admin.question.create",
      payload
    );
  },


  /**
   * Update Question
   */
  updateQuestion(payload) {
    return ggnApiRequest(
      "admin.question.update",
      payload
    );
  },


  /**
   * Deactivate Question
   */
  deactivateQuestion(payload) {
    return ggnApiRequest(
      "admin.question.deactivate",
      payload
    );
  },


  /**
   * Exam Results
   *
   * Endpoint will be connected
   * when ResultService API is integrated.
   */
  getResults(payload = {}) {
    return ggnApiRequest(
      "admin.results",
      payload
    );
  },


  /**
   * Adjust Exam Score
   *
   * Endpoint will be connected
   * when ResultService API is integrated.
   */
  adjustScore(payload) {
    return ggnApiRequest(
      "admin.result.adjustScore",
      payload
    );
  }

};


/**
 * ======================================================
 * 10. EXAMINEE API
 * ======================================================
 *
 * These endpoints will be connected
 * when the Examinee API Router is completed.
 *
 */

const GGNExamAPI = {

  /**
   * Get Examinee List
   */
  getExaminees(payload = {}) {
    return ggnApiRequest(
      "exam.examinees",
      payload
    );
  },


  /**
   * Start or Resume Exam
   */
  startExam(payload) {
    return ggnApiRequest(
      "exam.start",
      payload
    );
  },


  /**
   * Save Answer
   */
  saveAnswer(payload) {
    return ggnApiRequest(
      "exam.saveAnswer",
      payload
    );
  },


  /**
   * Submit Exam
   */
  submitExam(payload) {
    return ggnApiRequest(
      "exam.submit",
      payload
    );
  },


  /**
   * Get Attempt Status
   */
  getAttempt(payload) {
    return ggnApiRequest(
      "exam.attempt",
      payload
    );
  }

};


/**
 * ======================================================
 * 11. CONNECTION TEST
 * ======================================================
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

    ggnApiWarn(
      "Backend connection failed",
      error
    );

    return {
      success: false,
      message: error.message,
      code: error.code || "CONNECTION_FAILED"
    };
  }
}


/**
 * ======================================================
 * 12. EXPORT GLOBAL API
 * ======================================================
 *
 * ทำให้ไฟล์ app.js และ admin.js
 * เรียกใช้ API ได้
 *
 */

window.GGNApi = {
  request: ggnApiRequest,
  testConnection: testGGNApiConnection,
  Admin: GGNAdminAPI,
  Exam: GGNExamAPI,
  Error: GGNApiError
};
