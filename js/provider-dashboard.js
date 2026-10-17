
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("providerDashboard");
  const openLink = document.querySelector(
    '.provider-banner a[href="#providerDashboard"]'
  );
  const message = document.getElementById("providerDashboardMessage");
  const list = document.getElementById("providerList");
  const form = document.getElementById("providerForm");
  const formStatus = document.getElementById("providerFormStatus");

  if (!dashboard || !openLink || !message || !list || !form) return;

  const auth = window.MeeadAuth;
  const API_URL = "/.netlify/functions/provider-manage";

  async function request(url, options = {}) {
    const token = auth?.getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("تعذر قراءة استجابة الخادم.");
    }

    if (!response.ok) {
      throw new Error(data.message || "تعذر تنفيذ الطلب.");
    }

    return data;
  }

  function showMessage(text) {
    message.textContent = text;
  }

  function renderProviders(providers) {
    list.replaceChildren();

    if (!providers.length) {
      const empty = document.createElement("p");
      empty.textContent = "لم تضف أي نشاط بعد. يمكنك البدء بالنموذج أدناه.";
      list.appendChild(empty);
      return;
    }

    providers.forEach((provider) => {
      const card = document.createElement("article");
      const title = document.createElement("h3");
      const details = document.createElement("p");
      const status = document.createElement("p");

      title.textContent = provider.business_name;
      details.textContent =
        `${provider.category} — ${provider.city}`;

      status.textContent = Number(provider.is_published) === 1
        ? "حالة النشاط: منشور"
        : "حالة النشاط: غير منشور، ولن يظهر للعملاء بعد";

      card.append(title, details, status);
      list.appendChild(card);
    });
  }

  async function loadProviders() {
    showMessage("جارٍ تحميل أنشطتك...");
    list.replaceChildren();

    try {
      const data = await request(API_URL);
      renderProviders(data.providers || []);
      showMessage("يمكنك إدارة أنشطتك من هذه الصفحة.");
    } catch (error) {
      showMessage(error.message || "تعذر تحميل الأنشطة.");
    }
  }

  async function openDashboard() {
    dashboard.hidden = false;
    dashboard.scrollIntoView({ behavior: "smooth", block: "start" });

    const user = auth?.getUser();

    if (!auth?.isLoggedIn() || !user) {
      form.hidden = true;
      showMessage("سجّل الدخول أولًا، ثم افتح إدارة نشاطي مجددًا.");
      list.replaceChildren();

      document.getElementById("loginBtn")?.click();
      return;
    }

    if (user.role !== "provider") {
      form.hidden = true;
      list.replaceChildren();
      showMessage("هذه الصفحة مخصصة لحساب صاحب نشاط. سجّل الدخول بحساب صاحب نشاط للمتابعة.");
      return;
    }

    form.hidden = false;
    await loadProviders();
  }

  openLink.addEventListener("click", (event) => {
    event.preventDefault();
    openDashboard();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formStatus.textContent = "";

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    formStatus.textContent = "جارٍ حفظ النشاط...";

    const payload = {
      business_name: form.elements.business_name.value.trim(),
      category: form.elements.category.value.trim(),
      city: form.elements.city.value.trim(),
      address: form.elements.address.value.trim(),
      phone: form.elements.phone.value.trim(),
      description: form.elements.description.value.trim()
    };

    try {
      const data = await request(API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      form.reset();
      formStatus.textContent =
        data.message || "تم حفظ النشاط بنجاح.";

      await loadProviders();
    } catch (error) {
      formStatus.textContent =
        error.message || "تعذر حفظ النشاط. حاول مجددًا.";
    } finally {
      submitButton.disabled = false;
    }
  });
});
