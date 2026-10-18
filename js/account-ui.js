
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const auth = window.MeeadAuth;
  const modal = document.getElementById("account");

  if (!auth || !modal) {
    console.error("Meead: Account interface is not ready.");
    return;
  }

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const bookingsBtn = document.getElementById("myBookingsBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const closeBtn = document.getElementById("closeAccount");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const showLoginBtn = document.getElementById("showLogin");
  const showRegisterBtn = document.getElementById("showRegister");
  const status = document.getElementById("accountStatus");
  const title = document.getElementById("accountTitle");
  const message = document.getElementById("accountMessage");

  function setStatus(text) {
    status.textContent = text;
  }

  function openModal(mode = "login") {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    switchMode(mode);

    const firstInput = mode === "register"
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

    loginForm.hidden = registering;
    registerForm.hidden = !registering;
    title.textContent = registering
      ? "إنشاء حساب جديد"
      : "مرحبًا بك في ميعاد";
    message.textContent = registering
      ? "أنشئ حسابك للبدء في استخدام المنصة."
      : "سجّل دخولك للمتابعة.";
    setStatus("");
  }

  function updateNavigation() {
    const user = auth.getUser();
    const loggedIn = auth.isLoggedIn();

    if (loginBtn) loginBtn.hidden = loggedIn;
    if (registerBtn) registerBtn.hidden = loggedIn;
    if (logoutBtn) logoutBtn.hidden = !loggedIn;

    if (bookingsBtn) {
  console.log("Meead account check:", {
    loggedIn,
    role: user?.role
  });

  bookingsBtn.hidden = !loggedIn || user?.role !== "customer";
    }

    if (loggedIn && user) {
      message.textContent = `مرحبًا ${user.name || ""}، تم تسجيل دخولك.`;
    }
  }

  loginBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    openModal("login");
  });

  registerBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    openModal("register");
  });

  showLoginBtn?.addEventListener("click", () => switchMode("login"));
  showRegisterBtn?.addEventListener("click", () => switchMode("register"));
  closeBtn?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = loginForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    setStatus("جارٍ تسجيل الدخول...");

    try {
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      await auth.login(email, password);
      updateNavigation();
      setStatus("تم تسجيل الدخول بنجاح.");
      closeModal();
    } catch (error) {
      setStatus(error.message || "تعذر تسجيل الدخول. حاول مجددًا.");
    } finally {
      submitButton.disabled = false;
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = registerForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
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
      updateNavigation();
      closeModal();
      alert("تم إنشاء حسابك بنجاح.");
    } catch (error) {
      setStatus(error.message || "تعذر إنشاء الحساب. حاول مجددًا.");
    } finally {
      submitButton.disabled = false;
    }
  });

  logoutBtn?.addEventListener("click", () => {
    auth.logout();
    updateNavigation();
    closeModal();
  });

  window.addEventListener("meead:auth-change", updateNavigation);

  updateNavigation();
});
