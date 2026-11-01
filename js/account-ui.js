"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const auth = window.MeeadAuth;
  const modal = document.getElementById("account");

  if (!auth || !modal) {
    console.error("Meead: Account interface is not ready.");
    return;
  }

  const isProviderDashboard =
    window.location.pathname.endsWith("provider-dashboard.html");

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const providerEntryBtn = document.getElementById("providerEntryBtn");
  const registerRole = document.getElementById("registerRole");
  const bookingsBtn = document.getElementById("myBookingsBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const manageActivityBtn = document.getElementById("manageActivityBtn");

  const closeBtn = document.getElementById("closeAccount");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const showLoginBtn = document.getElementById("showLogin");
  const showRegisterBtn = document.getElementById("showRegister");

  const status = document.getElementById("accountStatus");
  const title = document.getElementById("accountTitle");
  const message = document.getElementById("accountMessage");

  function getReturnPage() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("return");

    // لا نسمح بإعادة التوجيه إلى روابط خارجية.
    if (requested === "my-bookings.html") {
      return "my-bookings.html";
    }

    return "";
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function openModal(mode = "login") {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    switchMode(mode);

    const firstInput =
      mode === "register"
        ? document.getElementById("registerName")
        : document.getElementById("loginEmail");

    firstInput?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    setStatus("");
  }

  function switchMode(mode) {
    const registering = mode === "register";

    if (loginForm) loginForm.hidden = registering;
    if (registerForm) registerForm.hidden = !registering;

    if (title) {
      title.textContent = registering
        ? "إنشاء حساب جديد"
        : "مرحبًا بك في ميعاد";
    }

    if (message) {
      message.textContent = registering
        ? "أنشئ حسابك للبدء في استخدام المنصة."
        : "سجّل دخولك للمتابعة.";
    }

    setStatus("");
  }

  function updateNavigation() {
    const user = auth.getUser();
    const loggedIn = auth.isLoggedIn();

    const isProvider = loggedIn && user?.role === "provider";
    const isCustomer = loggedIn && user?.role === "customer";

    if (loginBtn) loginBtn.hidden = loggedIn;
    if (registerBtn) registerBtn.hidden = loggedIn;
    if (logoutBtn) logoutBtn.hidden = !loggedIn;

    if (providerEntryBtn) {
      providerEntryBtn.hidden = loggedIn;
    }

    if (manageActivityBtn) {
      manageActivityBtn.hidden = !isProvider;
      manageActivityBtn.href = "provider-dashboard.html";
    }

    if (bookingsBtn) {
      bookingsBtn.hidden = !isCustomer;
      bookingsBtn.href = "my-bookings.html";
    }

    if (loggedIn && user && message) {
      message.textContent = `مرحبًا ${user.name || ""}، تم تسجيل دخولك.`;
    }
  }

  function protectProviderDashboard() {
    if (!isProviderDashboard) return;

    if (!auth.isLoggedIn()) {
      window.location.replace("index.html");
      return;
    }

    const user = auth.getUser();

    if (user?.role !== "provider") {
      window.location.replace("index.html");
    }
  }

  function finishAuthentication() {
    updateNavigation();
    closeModal();

    const user = auth.getUser();

    if (user?.role === "provider" && !isProviderDashboard) {
      window.location.replace("provider-dashboard.html");
      return true;
    }

    if (user?.role === "customer" && isProviderDashboard) {
      window.location.replace("index.html");
      return true;
    }

    if (user?.role === "customer") {
      const returnPage = getReturnPage();

      if (returnPage) {
        window.location.replace(returnPage);
        return true;
      }
    }

    window.dispatchEvent(new Event("meead:auth-change"));
    return false;
  }

  loginBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    openModal("login");
  });

  registerBtn?.addEventListener("click", (event) => {
    event.preventDefault();

    if (registerRole) registerRole.value = "customer";

    openModal("register");
  });

  providerEntryBtn?.addEventListener("click", (event) => {
    event.preventDefault();

    if (auth.isLoggedIn()) {
      const user = auth.getUser();

      if (user?.role === "provider") {
        window.location.href = "provider-dashboard.html";
      }

      return;
    }

    if (registerRole) registerRole.value = "provider";

    openModal("register");
  });

  showLoginBtn?.addEventListener("click", () => {
    switchMode("login");
  });

  showRegisterBtn?.addEventListener("click", () => {
    if (registerRole && !auth.isLoggedIn()) {
      registerRole.value = "customer";
    }

    switchMode("register");
  });

  closeBtn?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = loginForm.querySelector('[type="submit"]');

    if (submitButton) submitButton.disabled = true;

    setStatus("جارٍ تسجيل الدخول...");

    try {
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      await auth.login(email, password);

      finishAuthentication();
    } catch (error) {
      setStatus(error.message || "تعذر تسجيل الدخول. حاول مجددًا.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = registerForm.querySelector('[type="submit"]');

    if (submitButton) submitButton.disabled = true;

    setStatus("جارٍ إنشاء الحساب...");

    try {
      const details = {
        name: document.getElementById("registerName").value.trim(),
        email: document.getElementById("registerEmail").value.trim(),
        phone: document.getElementById("registerPhone").value.trim(),
        password: document.getElementById("registerPassword").value,
        role: document.getElementById("registerRole").value
      };

      await auth.register(details);

      const redirected = finishAuthentication();

      if (!redirected && auth.getUser()?.role === "customer") {
        alert("تم إنشاء حسابك بنجاح.");
      }
    } catch (error) {
      setStatus(error.message || "تعذر إنشاء الحساب. حاول مجددًا.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  logoutBtn?.addEventListener("click", () => {
    auth.logout();
    updateNavigation();
    closeModal();

    if (isProviderDashboard) {
      window.location.replace("index.html");
    }
  });

  window.addEventListener("meead:auth-change", updateNavigation);

  updateNavigation();
  protectProviderDashboard();

  // فتح نافذة الدخول تلقائيًا عند العودة من صفحة الحجوزات.
  const params = new URLSearchParams(window.location.search);

  if (params.get("auth") === "required" && !auth.isLoggedIn()) {
    openModal("login");
  }
});
