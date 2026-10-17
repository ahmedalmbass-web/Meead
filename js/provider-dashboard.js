
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("providerDashboard");
  const openLink = document.querySelector(
    '.provider-banner a[href="#providerDashboard"]'
  );
  const message = document.getElementById("providerDashboardMessage");
  const list = document.getElementById("providerList");
  const providerForm = document.getElementById("providerForm");
  const providerStatus = document.getElementById("providerFormStatus");

  const serviceManagement = document.getElementById("serviceManagement");
  const providerSelect = document.getElementById("serviceProviderSelect");
  const serviceForm = document.getElementById("serviceForm");
  const serviceStatus = document.getElementById("serviceFormStatus");

  if (
    !dashboard || !openLink || !message || !list ||
    !providerForm || !serviceManagement || !providerSelect ||
    !serviceForm || !serviceStatus
  ) {
    console.error("Meead: بعض عناصر إدارة النشاط أو الخدمات غير موجودة.");
    return;
  }

  const auth = window.MeeadAuth;
  const PROVIDER_API = "/.netlify/functions/provider-manage";
  const SERVICE_API = "/.netlify/functions/services";

  let providers = [];

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

  function renderProviders() {
    list.replaceChildren();
    providerSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "اختر النشاط";
    providerSelect.appendChild(placeholder);

    if (!providers.length) {
      const empty = document.createElement("p");
      empty.textContent = "لم تضف أي نشاط بعد. أضف نشاطك من النموذج أدناه.";
      list.appendChild(empty);
      serviceManagement.hidden = true;
      return;
    }

    providers.forEach((provider) => {
      const card = document.createElement("article");
      const title = document.createElement("h3");
      const details = document.createElement("p");
      const status = document.createElement("p");
      const chooseButton = document.createElement("button");

      title.textContent = provider.business_name;
      details.textContent = `${provider.category} — ${provider.city}`;

      status.textContent = Number(provider.is_published) === 1
        ? "حالة النشاط: منشور"
        : "حالة النشاط: غير منشور، ولن يظهر للعملاء بعد";

      chooseButton.type = "button";
      chooseButton.textContent = "إضافة خدمات لهذا النشاط";
      chooseButton.addEventListener("click", () => {
        providerSelect.value = String(provider.id);
        serviceManagement.hidden = false;
        serviceManagement.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      card.append(title, details, status, chooseButton);
      list.appendChild(card);

      const option = document.createElement("option");
      option.value = String(provider.id);
      option.textContent = `${provider.business_name} — ${provider.city}`;
      providerSelect.appendChild(option);
    });

    serviceManagement.hidden = false;
  }

  async function loadProviders() {
    showMessage("جارٍ تحميل أنشطتك...");
    list.replaceChildren();

    try {
      const data = await request(PROVIDER_API);
      providers = Array.isArray(data.providers) ? data.providers : [];
      renderProviders();
      showMessage("يمكنك إدارة أنشطتك وإضافة خدماتها من هنا.");
    } catch (error) {
      showMessage(error.message || "تعذر تحميل الأنشطة.");
    }
  }

  async function openDashboard() {
    dashboard.hidden = false;
    dashboard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    const user = auth?.getUser();

    if (!auth?.isLoggedIn() || !user) {
      providerForm.hidden = true;
      serviceManagement.hidden = true;
      list.replaceChildren();
      showMessage("سجّل الدخول أولًا، ثم افتح إدارة نشاطي مجددًا.");
      document.getElementById("loginBtn")?.click();
      return;
    }

    if (user.role !== "provider") {
      providerForm.hidden = true;
      serviceManagement.hidden = true;
      list.replaceChildren();
      showMessage("هذه الصفحة مخصصة لحساب صاحب نشاط.");
      return;
    }

    providerForm.hidden = false;
    await loadProviders();
  }

  openLink.addEventListener("click", (event) => {
    event.preventDefault();
    openDashboard();
  });

  providerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = providerForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    providerStatus.textContent = "جارٍ حفظ النشاط...";

    const payload = {
      business_name: providerForm.elements.business_name.value.trim(),
      category: providerForm.elements.category.value.trim(),
      city: providerForm.elements.city.value.trim(),
      address: providerForm.elements.address.value.trim(),
      phone: providerForm.elements.phone.value.trim(),
      description: providerForm.elements.description.value.trim()
    };

    try {
      const data = await request(PROVIDER_API, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      providerForm.reset();
      providerStatus.textContent =
        data.message || "تم حفظ النشاط بنجاح.";

      await loadProviders();

      if (data.provider?.id) {
        providerSelect.value = String(data.provider.id);
      }
    } catch (error) {
      providerStatus.textContent =
        error.message || "تعذر حفظ النشاط.";
    } finally {
      submitButton.disabled = false;
    }
  });

  providerSelect.addEventListener("change", () => {
    serviceStatus.textContent = "";
  });

  serviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const providerId = Number(providerSelect.value);

    if (!Number.isSafeInteger(providerId) || providerId < 1) {
      serviceStatus.textContent = "اختر النشاط أولًا.";
      return;
    }

    const submitButton = serviceForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    serviceStatus.textContent = "جارٍ حفظ الخدمة...";

    const payload = {
      provider_id: providerId,
      name: serviceForm.elements.name.value.trim(),
      description: serviceForm.elements.description.value.trim(),
      duration_minutes: Number(serviceForm.elements.duration_minutes.value),
      price: Number(serviceForm.elements.price.value),
      currency: serviceForm.elements.currency.value
    };

    try {
      const data = await request(SERVICE_API, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      serviceForm.reset();
      serviceStatus.textContent =
        data.message || "تمت إضافة الخدمة بنجاح.";
    } catch (error) {
      serviceStatus.textContent =
        error.message || "تعذر حفظ الخدمة.";
    } finally {
      submitButton.disabled = false;
    }
  });

  window.addEventListener("meead:auth-change", () => {
    if (auth?.getUser()?.role !== "provider") {
      dashboard.hidden = true;
      providers = [];
      list.replaceChildren();
      serviceManagement.hidden = true;
    }
  });
});
