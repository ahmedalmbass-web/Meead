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

  const panel = modal.querySelector(".account-panel");
  const tabs = modal.querySelector(".account-tabs");

  // ───────── شاشة إدخال كود التحقق (تُبنى هنا حتى لا نعدّل كل صفحة) ─────────

  let pendingEmail = "";
  let cooldownTimer = null;

  const verifyForm = document.createElement("form");
  verifyForm.id = "verifyForm";
  verifyForm.hidden = true;

  const verifyHint = document.createElement("p");
  verifyHint.id = "verifyHint";

  const verifyLabel = document.createElement("label");
  verifyLabel.htmlFor = "verifyCode";
  verifyLabel.textContent = "كود التحقق (6 أرقام)";

  const verifyInput = document.createElement("input");
  verifyInput.id = "verifyCode";
  verifyInput.type = "text";
  verifyInput.inputMode = "numeric";
  verifyInput.maxLength = 6;
  verifyInput.pattern = "[0-9]{6}";
  verifyInput.autocomplete = "one-time-code";
  verifyInput.required = true;
  verifyInput.dir = "ltr";
  verifyInput.style.textAlign = "center";
  verifyInput.style.letterSpacing = "6px";
  verifyInput.style.fontSize = "20px";

  const verifySubmit = document.createElement("button");
  verifySubmit.type = "submit";
  verifySubmit.textContent = "تأكيد الحساب";

  const resendButton = document.createElement("button");
  resendButton.type = "button";
  resendButton.textContent = "إعادة إرسال الكود";
  resendButton.style.background = "#eee";
  resendButton.style.color = "#123c32";

  verifyForm.append(
    verifyHint,
    verifyLabel,
    verifyInput,
    verifySubmit,
    resendButton
  );

  if (panel) {
    panel.insertBefore(verifyForm, status || null);
  }

  verifyInput.addEventListener("input", () => {
    verifyInput.value = verifyInput.value.replace(/\D/g, "").slice(0, 6);
  });

  function stopCooldown() {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }

    resendButton.disabled = false;
    resendButton.textContent = "إعادة إرسال الكود";
  }

  function startCooldown(seconds) {
    stopCooldown();

    let remaining = seconds;
    resendButton.disabled = true;
    resendButton.textContent = `إعادة الإرسال بعد ${remaining} ثانية`;

    cooldownTimer = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        stopCooldown();
        return;
      }

      resendButton.textContent = `إعادة الإرسال بعد ${remaining} ثانية`;
    }, 1000);
  }

  function openVerify(email, emailSent) {
    pendingEmail = email;
    switchMode("verify");

    verifyHint.textContent = emailSent
      ? `أرسلنا كودًا من 6 أرقام إلى ${email}. صلاحيته 10 دقائق.`
      : `تعذر إرسال الكود إلى ${email}. اضغط إعادة الإرسال.`;

    verifyInput.value = "";
    verifyInput.focus();

    if (emailSent) {
      startCooldown(60);
    } else {
      stopCooldown();
    }
  }

  // ───────── الواجهة العامة ─────────

  function getReturnPage() {
    const params = new URLSearchParams(window.location.search);

    return params.get("return") === "my-bookings.html"
      ? "my-bookings.html"
      : "";
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
    const verifying = mode === "verify";

    if (loginForm) loginForm.hidden = registering || verifying;
    if (registerForm) registerForm.hidden = !registering;
    verifyForm.hidden = !verifying;
    if (tabs) tabs.style.display = verifying ? "none" : "";

    if (title) {
      title.textContent = verifying
        ? "تأكيد البريد الإلكتروني"
        : registering
          ? "إنشاء حساب جديد"
          : "مرحبًا بك في ميعاد";
    }

    if (message) {
      message.textContent = verifying
        ? "أدخل الكود الذي وصلك على بريدك لتفعيل الحساب."
        : registering
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

    const email = document.getElementById("loginEmail").value.trim();

    try {
      const password = document.getElementById("loginPassword").value;

      await auth.login(email, password);

      finishAuthentication();
    } catch (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        // الحساب موجود لكن البريد غير مؤكد: نرسل كودًا جديدًا ونفتح شاشة الإدخال
        const targetEmail = error.email || email;

        try {
          await auth.resendCode(targetEmail);
          openVerify(targetEmail, true);
          setStatus("لحماية حسابك، يجب تأكيد بريدك الإلكتروني قبل المتابعة.");
        } catch (resendError) {
          openVerify(targetEmail, false);
          setStatus(resendError.message || "تعذر إرسال الكود.");
        }
      } else {
        setStatus(error.message || "تعذر تسجيل الدخول. حاول مجددًا.");
      }
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

      const result = await auth.register(details);

      const emailSent = result.email_sent !== false;

      openVerify(result.email || details.email, emailSent);

      if (!emailSent && result.message) {
        setStatus(result.message);
      }
    } catch (error) {
      setStatus(error.message || "تعذر إنشاء الحساب. حاول مجددًا.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    verifySubmit.disabled = true;
    setStatus("جارٍ التحقق من الكود...");

    try {
      await auth.verifyEmail(pendingEmail, verifyInput.value.trim());

      stopCooldown();

      const redirected = finishAuthentication();

      if (!redirected && auth.getUser()?.role === "customer") {
        alert("تم تفعيل حسابك بنجاح.");
      }
    } catch (error) {
      setStatus(error.message || "تعذر تأكيد الكود. حاول مجددًا.");
    } finally {
      verifySubmit.disabled = false;
    }
  });

  resendButton.addEventListener("click", async () => {
    if (!pendingEmail) return;

    resendButton.disabled = true;
    setStatus("جارٍ إرسال الكود...");

    try {
      await auth.resendCode(pendingEmail);
      setStatus("أرسلنا كودًا جديدًا إلى بريدك.");
      startCooldown(60);
    } catch (error) {
      setStatus(error.message || "تعذر إرسال الكود. حاول لاحقًا.");
      startCooldown(30);
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

  const params = new URLSearchParams(window.location.search);
  const requiresAuthentication = params.get("auth") === "required";

  if (requiresAuthentication) {
    // نمسح الجلسة القديمة عند العودة بسبب رفض الخادم لها.
    auth.logout();
    openModal("login");
  }
});
