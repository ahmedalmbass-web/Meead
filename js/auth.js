
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
    const response = await fetch(`${API_URL}?action=${action}`, {
      method: action === "me" ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(localStorage.getItem(TOKEN_KEY)
          ? {
              Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`
            }
          : {})
      },
      ...(action === "me" ? {} : { body: JSON.stringify(payload) })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("تعذر قراءة استجابة الخادم.");
    }

    if (!response.ok) {
      throw new Error(data.message || "تعذر إكمال الطلب.");
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

    async register(details) {
  const phone = String(details.phone || "").trim();

  if (!/^7[0-9]{8}$/.test(phone)) {
    throw new Error(
      "رقم الهاتف اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7."
    );
  }

  const data = await requestAuth("register", {
    ...details,
    phone
  });

  saveSession(data);
  return data.user;
},

    async login(email, password) {
      const data = await requestAuth("login", { email, password });
      saveSession(data);
      return data.user;
    },

    async refreshUser() {
      const data = await requestAuth("me");
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      return data.user;
    },

    logout() {
      clearSession();
      window.dispatchEvent(new Event("meead:auth-change"));
    }
  };

  window.dispatchEvent(new Event("meead:auth-ready"));
});
