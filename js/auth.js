/* Meead - Account Interface */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "/.netlify/functions/auth";
  const TOKEN_KEY = "meead_token";
  const USER_KEY = "meead_user";

  function getSavedUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveSession(data) {
    if (!data || !data.token || !data.user) {
      throw new Error("استجابة تسجيل الدخول غير مكتملة.");
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function requestAuth(action, payload = {}) {
    const token = localStorage.getItem(TOKEN_KEY);

    const response = await fetch(`${API_URL}?action=${action}`, {
      method: action === "me" ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {})
      },
      ...(action === "me"
        ? {}
        : { body: JSON.stringify(payload) })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("تعذر قراءة استجابة الخادم.");
    }

    if (!response.ok) {
      const error = new Error(
        data.message || "تعذر إكمال الطلب."
      );

      error.status = response.status;
      error.code = data.code || "";
      error.email = data.email || "";
      throw error;
    }

    return data;
  }

  window.MeeadAuth = {
    getToken() {
      return localStorage.getItem(TOKEN_KEY);
    },

    getUser() {
      return getSavedUser();
    },

    isLoggedIn() {
      return Boolean(
        localStorage.getItem(TOKEN_KEY) && getSavedUser()
      );
    },

    // ينشئ حسابًا غير مفعّل ويرسل كود التحقق. لا توجد جلسة قبل التأكيد.
    async register(details) {
      const phone = String(details.phone || "").trim();

      if (!/^7[0-9]{8}$/.test(phone)) {
        throw new Error(
          "رقم الهاتف اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7."
        );
      }

      return requestAuth("register", {
        ...details,
        phone
      });
    },

    // يؤكد البريد بالكود، وإذا نجح يبدأ الجلسة
    async verifyEmail(email, code) {
      const data = await requestAuth("verify-email", {
        email,
        code
      });

      saveSession(data);

      return data.user;
    },

    async resendCode(email) {
      return requestAuth("resend-code", { email });
    },

    async login(email, password) {
      const data = await requestAuth("login", {
        email,
        password
      });

      saveSession(data);

      return data.user;
    },

    async refreshUser() {
      if (!localStorage.getItem(TOKEN_KEY)) {
        clearSession();
        throw new Error("سجّل الدخول أولًا.");
      }

      try {
        const data = await requestAuth("me");

        if (!data.user) {
          throw new Error("تعذر تحديث بيانات الحساب.");
        }

        localStorage.setItem(
          USER_KEY,
          JSON.stringify(data.user)
        );

        window.dispatchEvent(
          new Event("meead:auth-change")
        );

        return data.user;
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          clearSession();

          window.dispatchEvent(
            new Event("meead:auth-change")
          );
        }

        throw error;
      }
    },

    logout() {
      clearSession();

      window.dispatchEvent(
        new Event("meead:auth-change")
      );
    }
  };

  window.dispatchEvent(
    new Event("meead:auth-ready")
  );
});
