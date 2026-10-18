
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
      empty.textContent =
        "لم تضف أي نشاط بعد. أضف نشاطك من النموذج أدناه.";
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

      const published = Number(provider.is_published) === 1;

      status.textContent = published
        ? "حالة النشاط: منشور ويظهر للعملاء"
        : "حالة النشاط: غير منشور";

      chooseButton.type = "button";
      chooseButton.textContent = "إضافة خدمات لهذا النشاط";
      chooseButton.addEventListener("click", () => {
  providerSelect.value = String(provider.id);
  serviceManagement.hidden = false;

  loadAvailability();

  serviceManagement.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

      card.append(title, details, status, chooseButton);

      if (!published) {
        const publishButton = document.createElement("button");
        const publishStatus = document.createElement("p");

        publishButton.type = "button";
        publishButton.textContent = "نشر النشاط";
        publishButton.addEventListener("click", async () => {
          publishButton.disabled = true;
          publishStatus.textContent = "جارٍ نشر النشاط...";

          try {
            const data = await request(PROVIDER_API, {
              method: "POST",
              body: JSON.stringify({
                action: "publish",
                provider_id: Number(provider.id)
              })
            });

            publishStatus.textContent =
              data.message || "تم نشر النشاط بنجاح.";

            await loadProviders();
          } catch (error) {
            publishStatus.textContent =
              error.message || "تعذر نشر النشاط.";
            publishButton.disabled = false;
          }
        });

        card.append(publishButton, publishStatus);
      }

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
      showMessage("يمكنك إدارة أنشطتك وإضافة خدماتها ونشرها من هنا.");
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

  
  const availabilityManagement =
    document.getElementById("availabilityManagement");
  const availabilityDays =
    document.getElementById("availabilityDays");
  const availabilityStatus =
    document.getElementById("availabilityStatus");
  const saveAvailabilityBtn =
    document.getElementById("saveAvailabilityBtn");
  const AVAILABILITY_API = "/.netlify/functions/availability";

  const weekdays = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت"
  ];

  function renderAvailabilityDays() {
    if (!availabilityDays) return;

    availabilityDays.replaceChildren();

    weekdays.forEach((day, weekday) => {
      const row = document.createElement("div");
      row.className = "availability-day";

      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.weekday = String(weekday);
      checkbox.className = "availability-enabled";

      label.append(checkbox, document.createTextNode(` ${day}`));

      const startLabel = document.createElement("label");
      startLabel.textContent = "من ";
      const start = document.createElement("input");
      start.type = "time";
      start.className = "availability-start";
      start.disabled = true;
      start.setAttribute("aria-label", `${day}: وقت البداية`);
      startLabel.appendChild(start);

      const endLabel = document.createElement("label");
      endLabel.textContent = " إلى ";
      const end = document.createElement("input");
      end.type = "time";
      end.className = "availability-end";
      end.disabled = true;
      end.setAttribute("aria-label", `${day}: وقت النهاية`);
      endLabel.appendChild(end);

      checkbox.addEventListener("change", () => {
        start.disabled = !checkbox.checked;
        end.disabled = !checkbox.checked;
      });

      row.append(label, startLabel, endLabel);
      availabilityDays.appendChild(row);
    });
  }

  async function loadAvailability() {
    if (!availabilityManagement || !availabilityDays) return;

    const providerId = Number(providerSelect.value);
    availabilityManagement.hidden = !providerSelect.value;
    availabilityStatus.textContent = "";

    if (!Number.isSafeInteger(providerId) || providerId < 1) {
      return;
    }

    renderAvailabilityDays();
    availabilityStatus.textContent = "جارٍ تحميل ساعات العمل...";

    try {
      const data = await request(
        `${AVAILABILITY_API}?providerId=${encodeURIComponent(providerId)}`
      );

      const saved = Array.isArray(data.availability)
        ? data.availability
        : Array.isArray(data.hours)
          ? data.hours
          : [];

      saved.forEach((item) => {
        if (Number(item.is_active) !== 1) return;

        const checkbox = availabilityDays.querySelector(
          `.availability-enabled[data-weekday="${Number(item.weekday)}"]`
        );

        if (!checkbox) return;

        checkbox.checked = true;

        const row = checkbox.closest(".availability-day");
        const start = row.querySelector(".availability-start");
        const end = row.querySelector(".availability-end");

        start.disabled = false;
        end.disabled = false;
        start.value = String(item.start_time).slice(0, 5);
        end.value = String(item.end_time).slice(0, 5);
      });

      availabilityStatus.textContent = saved.length
        ? "تم تحميل ساعات العمل المحفوظة."
        : "لم تُحدد ساعات عمل بعد. فعّل الأيام المطلوبة.";
    } catch (error) {
      availabilityStatus.textContent =
        error.message || "تعذر تحميل ساعات العمل.";
    }
  }

  providerSelect.addEventListener("change", () => {
    serviceStatus.textContent = "";
    loadAvailability();
  });

  if (availabilityManagement && availabilityDays && saveAvailabilityBtn) {
    renderAvailabilityDays();

    saveAvailabilityBtn.addEventListener("click", async () => {
      const providerId = Number(providerSelect.value);

      if (!Number.isSafeInteger(providerId) || providerId < 1) {
        availabilityStatus.textContent = "اختر النشاط أولًا.";
        return;
      }

      const rows = [...availabilityDays.querySelectorAll(".availability-day")];
      const schedule = rows.map((row, weekday) => {
        const enabled = row.querySelector(".availability-enabled").checked;
        const start = row.querySelector(".availability-start").value;
        const end = row.querySelector(".availability-end").value;

        return { weekday, enabled, start, end };
      });

      for (const day of schedule) {
        if (day.enabled && (!day.start || !day.end || day.start >= day.end)) {
          availabilityStatus.textContent =
            `تحقق من وقت البداية والنهاية ليوم ${weekdays[day.weekday]}.`;
          return;
        }
      }

      saveAvailabilityBtn.disabled = true;
      availabilityStatus.textContent = "جارٍ حفظ ساعات العمل...";

      try {
        const existingData = await request(
          `${AVAILABILITY_API}?providerId=${encodeURIComponent(providerId)}`
        );

        const existing = Array.isArray(existingData.availability)
          ? existingData.availability
          : Array.isArray(existingData.hours)
            ? existingData.hours
            : [];

        for (const day of schedule) {
          if (day.enabled) {
            await request(AVAILABILITY_API, {
              method: "POST",
              body: JSON.stringify({
                provider_id: providerId,
                weekday: day.weekday,
                start_time: day.start,
                end_time: day.end
              })
            });
          } else if (existing.some(
            (item) =>
              Number(item.weekday) === day.weekday &&
              Number(item.is_active) === 1
          )) {
            await request(AVAILABILITY_API, {
              method: "POST",
              body: JSON.stringify({
                provider_id: providerId,
                action: "disable",
                weekday: day.weekday
              })
            });
          }
        }

        availabilityStatus.textContent = "تم حفظ ساعات العمل بنجاح.";
        await loadAvailability();
      } catch (error) {
        availabilityStatus.textContent =
          error.message || "تعذر حفظ ساعات العمل.";
      } finally {
        saveAvailabilityBtn.disabled = false;
      }
    });
  }


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
      duration_minutes: Number(
        serviceForm.elements.duration_minutes.value
      ),
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
