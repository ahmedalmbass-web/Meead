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

  // ───────── شاشات استعادة كلمة المرور (طلب الكود + تعيين كلمة المرور) ─────────
  let pendingResetEmail = "";

  const forgotForm = document.createElement("form");
  forgotForm.id = "forgotForm";
  forgotForm.hidden = true;

  const forgotLabel = document.createElement("label");
  forgotLabel.htmlFor = "forgotEmail";
  forgotLabel.textContent = "البريد الإلكتروني المسجل";

  const forgotInput = document.createElement("input");
  forgotInput.id = "forgotEmail";
  forgotInput.type = "email";
  forgotInput.autocomplete = "email";
  forgotInput.required = true;
  forgotInput.placeholder = "name@example.com";

  const forgotSubmit = document.createElement("button");
  forgotSubmit.type = "submit";
  forgotSubmit.textContent = "إرسال رمز الاستعادة";

  const backFromForgot = document.createElement("button");
  backFromForgot.type = "button";
  backFromForgot.textContent = "← العودة لتسجيل الدخول";
  backFromForgot.style.cssText = "background:#eee;color:#123c32;margin-top:8px;";

  forgotForm.append(forgotLabel, forgotInput, forgotSubmit, backFromForgot);

  const resetPasswordForm = document.createElement("form");
  resetPasswordForm.id = "resetPasswordForm";
  resetPasswordForm.hidden = true;

  const resetCodeLabel = document.createElement("label");
  resetCodeLabel.htmlFor = "resetCodeInput";
  resetCodeLabel.textContent = "كود الاستعادة (6 أرقام)";

  const resetCodeInput = document.createElement("input");
  resetCodeInput.id = "resetCodeInput";
  resetCodeInput.type = "text";
  resetCodeInput.inputMode = "numeric";
  resetCodeInput.maxLength = 6;
  resetCodeInput.pattern = "[0-9]{6}";
  resetCodeInput.required = true;
  resetCodeInput.dir = "ltr";
  resetCodeInput.style.textAlign = "center";
  resetCodeInput.style.letterSpacing = "6px";
  resetCodeInput.style.fontSize = "20px";

  const resetPassLabel = document.createElement("label");
  resetPassLabel.htmlFor = "resetNewPass";
  resetPassLabel.textContent = "كلمة المرور الجديدة";

  const resetPassInput = document.createElement("input");
  resetPassInput.id = "resetNewPass";
  resetPassInput.type = "password";
  resetPassInput.required = true;
  resetPassInput.minLength = 8;
  resetPassInput.autocomplete = "new-password";

  const resetSubmit = document.createElement("button");
  resetSubmit.type = "submit";
  resetSubmit.textContent = "حفظ كلمة المرور الجديدة";

  const backFromReset = document.createElement("button");
  backFromReset.type = "button";
  backFromReset.textContent = "← العودة لتسجيل الدخول";
  backFromReset.style.cssText = "background:#eee;color:#123c32;margin-top:8px;";

  resetPasswordForm.append(resetCodeLabel, resetCodeInput, resetPassLabel, resetPassInput, resetSubmit, backFromReset);

  if (panel) {
    panel.insertBefore(forgotForm, status || null);
    panel.insertBefore(resetPasswordForm, status || null);
  }

  // إضافة زر "نسيت كلمة المرور؟" داخل نموذج تسجيل الدخول
  const forgotBtn = document.createElement("button");
  forgotBtn.type = "button";
  forgotBtn.id = "forgotPasswordBtn";
  forgotBtn.textContent = "نسيت كلمة المرور؟";
  forgotBtn.style.cssText = "display:block;background:none;border:none;color:#123c32;font-size:13px;font-weight:700;cursor:pointer;padding:8px 0;margin:6px 0;text-decoration:underline;text-align:right;width:100%;";
  if (loginForm) {
    const loginSubmitBtn = loginForm.querySelector("button[type='submit']");
    if (loginSubmitBtn) {
      loginForm.insertBefore(forgotBtn, loginSubmitBtn);
    } else {
      loginForm.appendChild(forgotBtn);
    }
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

  // ───────── الدخول عبر Google وApple + شاشة إكمال البيانات ─────────

  let currentMode = "login";
  let socialAvailable = false;
  let googleRendered = false;
  let socialSignupToken = "";

  const socialBox = document.createElement("div");
  socialBox.id = "socialLogin";
  socialBox.style.display = "none";

  const googleHolder = document.createElement("div");
  googleHolder.style.cssText =
    "display:flex;justify-content:center;margin-top:14px;min-height:44px";
  googleHolder.hidden = true;

  const appleButton = document.createElement("button");
  appleButton.type = "button";
  appleButton.textContent = "المتابعة باستخدام Apple";
  appleButton.style.cssText =
    "width:100%;background:#000;color:#fff;border:1px solid #000;border-radius:9px;padding:11px;margin-top:10px;font-weight:700;cursor:pointer";
  appleButton.hidden = true;

  const divider = document.createElement("div");
  divider.style.cssText =
    "display:flex;align-items:center;gap:10px;margin:16px 0 4px;color:#75817b;font-size:13px";

  const line1 = document.createElement("span");
  line1.style.cssText = "flex:1;height:1px;background:#e8e8df";

  const dividerText = document.createElement("span");
  dividerText.textContent = "أو بالبريد الإلكتروني";

  const line2 = document.createElement("span");
  line2.style.cssText = "flex:1;height:1px;background:#e8e8df";

  divider.append(line1, dividerText, line2);
  socialBox.append(googleHolder, appleButton, divider);

  if (panel && loginForm) {
    panel.insertBefore(socialBox, loginForm);
  }

  const profileForm = document.createElement("form");
  profileForm.id = "profileForm";
  profileForm.hidden = true;

  const profileHint = document.createElement("p");

  const profileNameLabel = document.createElement("label");
  profileNameLabel.htmlFor = "profileName";
  profileNameLabel.textContent = "الاسم الكامل";

  const profileName = document.createElement("input");
  profileName.id = "profileName";
  profileName.required = true;
  profileName.minLength = 2;
  profileName.maxLength = 100;
  profileName.autocomplete = "name";

  const profilePhoneLabel = document.createElement("label");
  profilePhoneLabel.htmlFor = "profilePhone";
  profilePhoneLabel.textContent = "رقم الهاتف";

  const profilePhone = document.createElement("input");
  profilePhone.id = "profilePhone";
  profilePhone.type = "tel";
  profilePhone.inputMode = "numeric";
  profilePhone.autocomplete = "tel";
  profilePhone.minLength = 9;
  profilePhone.maxLength = 9;
  profilePhone.pattern = "7[0-9]{8}";
  profilePhone.placeholder = "712345678";
  profilePhone.required = true;

  const profileRoleLabel = document.createElement("label");
  profileRoleLabel.htmlFor = "profileRole";
  profileRoleLabel.textContent = "نوع الحساب";

  const profileRole = document.createElement("select");
  profileRole.id = "profileRole";
  profileRole.required = true;

  [
    ["customer", "عميل — أريد حجز موعد"],
    ["provider", "صاحب نشاط — أريد عرض خدماتي"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    profileRole.appendChild(option);
  });

  const profileSubmit = document.createElement("button");
  profileSubmit.type = "submit";
  profileSubmit.textContent = "إنشاء الحساب";

  profileForm.append(
    profileHint,
    profileNameLabel,
    profileName,
    profilePhoneLabel,
    profilePhone,
    profileRoleLabel,
    profileRole,
    profileSubmit
  );

  if (panel) {
    panel.insertBefore(profileForm, status || null);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function ensureGoogleButton() {
    if (googleRendered || !window.google?.accounts?.id) return;

    googleHolder.hidden = false;

    window.google.accounts.id.renderButton(googleHolder, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      locale: "ar",
      width: Math.min(300, Math.max(200, window.innerWidth - 110))
    });

    googleRendered = true;
  }

  function applySocialVisibility() {
    const visible =
      socialAvailable &&
      (currentMode === "login" || currentMode === "register");

    socialBox.style.display = visible ? "" : "none";

    if (visible && !modal.hidden) ensureGoogleButton();
  }

  function openProfile(result) {
    socialSignupToken = result.signupToken;

    profileHint.textContent = `أهلًا بك! أكمل بياناتك لإنشاء حسابك بالبريد ${result.email}`;
    profileName.value = result.name || "";
    profilePhone.value = "";
    profileRole.value = registerRole?.value === "provider" ? "provider" : "customer";

    switchMode("profile");
    (profileName.value ? profilePhone : profileName).focus();
  }

  async function handleSocialCredential(provider, credential, name = "") {
    setStatus("جارٍ التحقق من حسابك...");

    try {
      const result = await auth.socialLogin(provider, credential, name);

      if (result.needsProfile) {
        openProfile(result);
        return;
      }

      finishAuthentication();
    } catch (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setStatus("فعّل بريدك الإلكتروني أولًا من نموذج الدخول بالبريد.");
        return;
      }

      setStatus(error.message || "تعذر تسجيل الدخول. حاول مجددًا.");
    }
  }

  appleButton.addEventListener("click", async () => {
    if (!window.AppleID?.auth) return;

    try {
      const response = await window.AppleID.auth.signIn();
      const idToken = response?.authorization?.id_token;
      const appleName = response?.user?.name;

      const fullName = appleName
        ? [appleName.firstName, appleName.lastName].filter(Boolean).join(" ")
        : "";

      if (idToken) {
        await handleSocialCredential("apple", idToken, fullName);
      }
    } catch (error) {
      // إغلاق المستخدم للنافذة ليس خطأ
      if (error && error.error === "popup_closed_by_user") return;

      setStatus("تعذر تسجيل الدخول عبر Apple. حاول مجددًا.");
    }
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    profileSubmit.disabled = true;
    setStatus("جارٍ إنشاء الحساب...");

    try {
      await auth.socialSignup(socialSignupToken, {
        name: profileName.value.trim(),
        phone: profilePhone.value.trim(),
        role: profileRole.value
      });

      const redirected = finishAuthentication();

      if (!redirected && auth.getUser()?.role === "customer") {
        alert("تم إنشاء حسابك بنجاح.");
      }
    } catch (error) {
      setStatus(error.message || "تعذر إنشاء الحساب. حاول مجددًا.");
    } finally {
      profileSubmit.disabled = false;
    }
  });

  async function setupSocial() {
    const config = await auth.getSocialConfig();

    if (config.google?.clientId) {
      try {
        await loadScript("https://accounts.google.com/gsi/client");

        window.google.accounts.id.initialize({
          client_id: config.google.clientId,
          callback: (response) =>
            handleSocialCredential("google", response.credential)
        });

        socialAvailable = true;
      } catch (error) {
        console.error("Meead: Google sign-in unavailable.", error);
      }
    }

    if (config.apple?.clientId && config.apple?.redirectUri) {
      try {
        await loadScript(
          "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
        );

        window.AppleID.auth.init({
          clientId: config.apple.clientId,
          scope: "name email",
          redirectURI: config.apple.redirectUri,
          usePopup: true
        });

        appleButton.hidden = false;
        socialAvailable = true;
      } catch (error) {
        console.error("Meead: Apple sign-in unavailable.", error);
      }
    }

    applySocialVisibility();
  }

  setupSocial();

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
    currentMode = mode;

    const registering = mode === "register";
    const verifying = mode === "verify";
    const profiling = mode === "profile";
    const forgotting = mode === "forgot";
    const resetting = mode === "reset";

    if (loginForm) loginForm.hidden = registering || verifying || profiling || forgotting || resetting;
    if (registerForm) registerForm.hidden = !registering;
    verifyForm.hidden = !verifying;
    profileForm.hidden = !profiling;
    forgotForm.hidden = !forgotting;
    resetPasswordForm.hidden = !resetting;

    if (tabs) tabs.style.display = verifying || profiling || forgotting || resetting ? "none" : "";

    if (title) {
      title.textContent = verifying
        ? "تأكيد البريد الإلكتروني"
        : profiling
          ? "إكمال إنشاء الحساب"
          : forgotting
            ? "استعادة كلمة المرور"
            : resetting
              ? "تعيين كلمة المرور الجديدة"
              : registering
                ? "إنشاء حساب جديد"
                : "مرحبًا بك في ميعاد";
    }

    if (message) {
      message.textContent = verifying
        ? "أدخل الكود الذي وصلك على بريدك لتفعيل الحساب."
        : profiling
          ? "بقيت خطوة واحدة."
          : forgotting
            ? "أدخل بريدك الإلكتروني المسجل لنرسل لك رمز الاستعادة."
            : resetting
              ? "أدخل الرمز المكون من 6 أرقام مع كلمة المرور الجديدة."
              : registering
                ? "أنشئ حسابك للبدء في استخدام المنصة."
                : "سجّل دخولك للمتابعة.";
    }

    applySocialVisibility();
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

  // أحداث استعادة كلمة المرور
  forgotBtn.addEventListener("click", () => {
    switchMode("forgot");
    forgotInput.value = document.getElementById("loginEmail")?.value || "";
    forgotInput.focus();
  });

  backFromForgot.addEventListener("click", () => {
    switchMode("login");
  });

  backFromReset.addEventListener("click", () => {
    switchMode("login");
  });

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = forgotInput.value.trim();
    if (!email) return;

    forgotSubmit.disabled = true;
    forgotSubmit.textContent = "جارٍ إرسال الرمز...";
    setStatus("");

    try {
      const res = await auth.forgotPassword(email);
      pendingResetEmail = email;
      switchMode("reset");
      setStatus(res.message || "أرسلنا رمز الاستعادة إلى بريدك.", "success");
      resetCodeInput.focus();
    } catch (err) {
      setStatus(err.message || "تعذر إرسال الرمز.");
    } finally {
      forgotSubmit.disabled = false;
      forgotSubmit.textContent = "إرسال رمز الاستعادة";
    }
  });

  resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = resetCodeInput.value.trim();
    const newPassword = resetPassInput.value;

    if (!pendingResetEmail) {
      setStatus("يرجى إدخال بريدك الإلكتروني أولاً.");
      switchMode("forgot");
      return;
    }

    resetSubmit.disabled = true;
    resetSubmit.textContent = "جارٍ حفظ كلمة المرور...";
    setStatus("");

    try {
      const res = await auth.resetPassword(pendingResetEmail, code, newPassword);
      switchMode("login");
      setStatus(res.message || "تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.", "success");
      resetPasswordForm.reset();
      pendingResetEmail = "";
    } catch (err) {
      setStatus(err.message || "تعذر إعادة تعيين كلمة المرور.");
    } finally {
      resetSubmit.disabled = false;
      resetSubmit.textContent = "حفظ كلمة المرور الجديدة";
    }
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
