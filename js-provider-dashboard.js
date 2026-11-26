"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("providerDashboard");
  const message = document.getElementById("providerDashboardMessage");
  const list = document.getElementById("providerList");
  const providerForm = document.getElementById("providerForm");
  const providerStatus = document.getElementById("providerFormStatus");

  const editProviderSection = document.getElementById("editProviderSection");
  const editProviderForm = document.getElementById("editProviderForm");
  const editProviderId = document.getElementById("editProviderId");
  const editProviderStatus = document.getElementById("editProviderStatus");
  const saveProviderChanges = document.getElementById("saveProviderChanges");
  const cancelProviderEdit = document.getElementById("cancelProviderEdit");

  const serviceManagement = document.getElementById("serviceManagement");
  const providerSelect = document.getElementById("serviceProviderSelect");
  const serviceForm = document.getElementById("serviceForm");
  const serviceStatus = document.getElementById("serviceFormStatus");

  const providerServices = document.getElementById("providerServices");
  const providerServicesList = document.getElementById("providerServicesList");
  const providerServicesStatus = document.getElementById("providerServicesStatus");
  const serviceFormHeading = document.getElementById("serviceFormHeading");
  const saveServiceBtn = document.getElementById("saveServiceBtn");
  const cancelServiceEdit = document.getElementById("cancelServiceEdit");

  const providerBookings = document.getElementById("providerBookings");
  const providerBookingsStatus = document.getElementById("providerBookingsStatus");
  const providerBookingsList = document.getElementById("providerBookingsList");
  const refreshProviderBookings = document.getElementById("refreshProviderBookings");

  const availabilityManagement = document.getElementById("availabilityManagement");
  const availabilityDays = document.getElementById("availabilityDays");
  const availabilityStatus = document.getElementById("availabilityStatus");
  const saveAvailabilityBtn = document.getElementById("saveAvailabilityBtn");

  const providerTabsNav = document.getElementById("providerTabsNav");
  const tabProfileSection = document.getElementById("tabProfileSection");
  const paymentManagement = document.getElementById("paymentManagement");
  const providerPaymentForm = document.getElementById("providerPaymentForm");
  const paymentStatus = document.getElementById("paymentStatus");
  const payKuraimi = document.getElementById("payKuraimi");
  const payJawali = document.getElementById("payJawali");
  const payOnecash = document.getElementById("payOnecash");
  const payFloosak = document.getElementById("payFloosak");
  const payTransfer = document.getElementById("payTransfer");
  const payCashEnabled = document.getElementById("payCashEnabled");
  const savePaymentBtn = document.getElementById("savePaymentBtn");

  const statTodayBookings = document.getElementById("statTodayBookings");
  const statPendingBookings = document.getElementById("statPendingBookings");
  const statConfirmedBookings = document.getElementById("statConfirmedBookings");
  const statRevenue = document.getElementById("statRevenue");
  const providerBookingFilters = document.getElementById("providerBookingFilters");

  let loadedBookings = [];
  let currentBookingFilter = "all";
  let tabsInitialized = false;

  const auth = window.MeeadAuth;

  const PROVIDER_API = "/.netlify/functions/provider-manage";
  const SERVICE_API = "/.netlify/functions/services";
  const BOOKING_MANAGE_API = "/.netlify/functions/booking-manage";
  const AVAILABILITY_API = "/.netlify/functions/availability";

  let providers = [];
  let services = [];
  let editingServiceId = null;

  const weekdays = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت"
  ];

  if (
    !dashboard || !message || !list || !providerForm ||
    !providerStatus || !serviceManagement || !providerSelect ||
    !serviceForm || !serviceStatus || !providerBookings ||
    !providerBookingsStatus || !providerBookingsList ||
    !availabilityManagement || !availabilityDays ||
    !availabilityStatus || !saveAvailabilityBtn ||
    !providerServices || !providerServicesList ||
    !providerServicesStatus || !serviceFormHeading ||
    !saveServiceBtn || !cancelServiceEdit ||
    !editProviderSection || !editProviderForm ||
    !editProviderId || !editProviderStatus ||
    !saveProviderChanges || !cancelProviderEdit
  ) {
    console.error("Meead: بعض عناصر لوحة إدارة النشاط غير موجودة.");
    return;
  }

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

  function selectedProviderId() {
    const id = Number(providerSelect.value);

    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  // ==========================================
  // تعديل بيانات النشاط
  // ==========================================

  function closeProviderEdit() {
    editProviderForm.reset();
    editProviderId.value = "";
    editProviderStatus.textContent = "";
    editProviderSection.hidden = true;
    saveProviderChanges.disabled = false;
    cancelProviderEdit.disabled = false;
  }

  function startEditProvider(provider) {
    editProviderId.value = String(provider.id);

    editProviderForm.elements.business_name.value =
      provider.business_name || "";

    editProviderForm.elements.category.value =
      provider.category || "";

    editProviderForm.elements.city.value =
      provider.city || "";

    editProviderForm.elements.address.value =
      provider.address || "";

    editProviderForm.elements.phone.value =
      provider.phone || "";

    editProviderForm.elements.description.value =
      provider.description || "";

    editProviderStatus.textContent =
      `تعديل بيانات: ${provider.business_name}`;

    editProviderSection.hidden = false;

    editProviderSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    editProviderForm.elements.business_name.focus();
  }

  cancelProviderEdit.addEventListener("click", closeProviderEdit);

  editProviderForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const providerId = Number(editProviderId.value);

    if (!Number.isSafeInteger(providerId) || providerId < 1) {
      editProviderStatus.textContent = "معرّف النشاط غير صالح.";
      return;
    }

    const phone = editProviderForm.elements.phone.value.trim();

    if (!/^7[0-9]{8}$/.test(phone)) {
      editProviderStatus.textContent =
        "رقم التواصل اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7.";

      editProviderForm.elements.phone.focus();
      return;
    }

    const payload = {
      action: "update",
      provider_id: providerId,
      business_name: editProviderForm.elements.business_name.value.trim(),
      category: editProviderForm.elements.category.value.trim(),
      city: editProviderForm.elements.city.value.trim(),
      address: editProviderForm.elements.address.value.trim(),
      phone,
      description: editProviderForm.elements.description.value.trim()
    };

    saveProviderChanges.disabled = true;
    cancelProviderEdit.disabled = true;

    editProviderStatus.textContent = "جارٍ حفظ تعديلات النشاط...";

    try {
      const data = await request(PROVIDER_API, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      editProviderStatus.textContent =
        data.message || "تم تحديث بيانات النشاط بنجاح.";

      await loadProviders();

      closeProviderEdit();

      showMessage("تم تحديث بيانات النشاط بنجاح.");
    } catch (error) {
      editProviderStatus.textContent =
        error.message || "تعذر تحديث بيانات النشاط.";
    } finally {
      saveProviderChanges.disabled = false;
      cancelProviderEdit.disabled = false;
    }
  });

  // ==========================================
  // عرض الأنشطة
  // ==========================================

  function renderProviders() {
    const previousId = providerSelect.value;

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
      providerBookings.hidden = false;
      availabilityManagement.hidden = true;
      closeProviderEdit();
      return;
    }

    providers.forEach((provider) => {
      const card = document.createElement("article");
      const title = document.createElement("h3");
      const details = document.createElement("p");
      const status = document.createElement("p");
      const chooseButton = document.createElement("button");
      const editButton = document.createElement("button");

      title.textContent = provider.business_name;
      details.textContent = `${provider.category} — ${provider.city}`;

      const published = Number(provider.is_published) === 1;

      status.textContent = published
        ? "حالة النشاط: منشور ويظهر للعملاء"
        : "حالة النشاط: غير منشور";

      chooseButton.type = "button";
      chooseButton.textContent = "إدارة خدمات النشاط";

      chooseButton.addEventListener("click", async () => {
        providerSelect.value = String(provider.id);
        serviceManagement.hidden = false;
        closeProviderEdit();
        populatePaymentForm();

        resetServiceForm();
        await loadServices();
        await loadAvailability();

        const serviceTabBtn = providerTabsNav?.querySelector('[data-target="serviceManagement"]');
        if (serviceTabBtn) {
          serviceTabBtn.click();
        }

        serviceManagement.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      editButton.type = "button";
      editButton.textContent = "تعديل بيانات النشاط";

      editButton.addEventListener("click", () => {
        startEditProvider(provider);
      });

      card.append(title, details, status, chooseButton, editButton);

      if (published) {
        const shareBox = document.createElement("div");
        shareBox.style.cssText = "margin-top:12px;padding:12px;background:#f0eee4;border-radius:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;";

        const shareLabel = document.createElement("span");
        shareLabel.style.cssText = "font-size:13px;font-weight:700;color:#123c32;";
        shareLabel.textContent = "رابط الحجز المباشر (للبايو):";

        const shareLink = `${window.location.origin}/?provider=${provider.id}`;

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.textContent = "📋 نسخ رابط البايو";
        copyBtn.style.cssText = "background:#123c32;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:bold;cursor:pointer;";
        copyBtn.addEventListener("click", () => {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareLink).then(() => {
              copyBtn.textContent = "✓ تم النسخ!";
              setTimeout(() => { copyBtn.textContent = "📋 نسخ رابط البايو"; }, 2000);
            }).catch(() => prompt("رابط الحجز المباشر:", shareLink));
          } else {
            prompt("رابط الحجز المباشر:", shareLink);
          }
        });

        const waShare = document.createElement("a");
        waShare.href = `https://wa.me/?text=${encodeURIComponent(`احجز موعدك الآن لدى ${provider.business_name} عبر منصة ميعاد:\n${shareLink}`)}`;
        waShare.target = "_blank";
        waShare.rel = "noopener noreferrer";
        waShare.textContent = "مشاركة على واتساب";
        waShare.style.cssText = "background:#25d366;color:#fff;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:bold;text-decoration:none;";

        shareBox.append(shareLabel, copyBtn, waShare);
        card.appendChild(shareBox);
      }

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
      option.textContent =
        `${provider.business_name} — ${provider.city}`;

      providerSelect.appendChild(option);
    });

    if (providers.some((provider) => String(provider.id) === previousId)) {
      providerSelect.value = previousId;
    }

    serviceManagement.hidden = !providerSelect.value;
  }

  async function loadProviders() {
    showMessage("جارٍ تحميل أنشطتك...");
    list.replaceChildren();

    try {
      const data = await request(PROVIDER_API);
      providers = Array.isArray(data.providers) ? data.providers : [];

      renderProviders();

      showMessage(
        "يمكنك إدارة أنشطتك وإضافة خدماتها ونشرها من هنا."
      );
    } catch (error) {
      showMessage(error.message || "تعذر تحميل الأنشطة.");
    }
  }

  // ==========================================
  // إدارة الخدمات
  // ==========================================

  function resetServiceForm() {
    editingServiceId = null;
    serviceForm.reset();

    serviceFormHeading.textContent = "إضافة خدمة جديدة";
    saveServiceBtn.textContent = "حفظ الخدمة";
    cancelServiceEdit.hidden = true;
    serviceStatus.textContent = "";

    const durationInput = serviceForm.elements.duration_minutes;

    if (durationInput) {
      durationInput.value = "30";
    }
  }

  function renderServices() {
    providerServicesList.replaceChildren();

    if (!services.length) {
      const empty = document.createElement("div");
      empty.className = "service-empty";
      empty.textContent = "لا توجد خدمات مسجلة لهذا النشاط حتى الآن.";
      providerServicesList.appendChild(empty);
      return;
    }

    services.forEach((service) => {
      const card = document.createElement("article");
      card.className = "service-item";

      const active = Number(service.is_active) === 1;

      if (!active) {
        card.classList.add("is-inactive");
      }

      const state = document.createElement("span");
      state.className = `service-state ${active ? "active" : "inactive"}`;
      state.textContent = active ? "خدمة نشطة" : "خدمة معطّلة";

      const title = document.createElement("h4");
      title.textContent = service.name || "خدمة بدون اسم";

      const description = document.createElement("p");
      description.textContent =
        service.description || "لا يوجد وصف لهذه الخدمة.";

      const meta = document.createElement("div");
      meta.className = "service-item-meta";

      const duration = document.createElement("span");
      duration.textContent =
        `${Number(service.duration_minutes) || 0} دقيقة`;

      const price = document.createElement("span");
      price.textContent =
        `${service.price ?? 0} ${service.currency || "YER"}`;

      meta.append(duration, price);

      const actions = document.createElement("div");
      actions.className = "service-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className =
        "service-action-btn service-edit-btn";
      editButton.textContent = "تعديل";

      editButton.addEventListener("click", () => {
        startEditService(service);
      });

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className =
        "service-action-btn service-toggle-btn";

      if (active) {
        toggleButton.textContent = "تعطيل الخدمة";
      } else {
        toggleButton.textContent = "تفعيل الخدمة";
        toggleButton.classList.add("activate");
      }

      toggleButton.addEventListener("click", async () => {
        await changeServiceStatus(service, toggleButton);
      });

      actions.append(editButton, toggleButton);
      card.append(state, title, description, meta, actions);

      providerServicesList.appendChild(card);
    });
  }

  async function loadServices() {
    const providerId = selectedProviderId();

    services = [];
    providerServicesList.replaceChildren();

    if (!providerId) {
      providerServicesStatus.textContent = "";
      const empty = document.createElement("div");
      empty.className = "service-empty";
      empty.textContent = "اختر نشاطًا لعرض خدماته.";
      providerServicesList.appendChild(empty);
      return;
    }

    providerServicesStatus.textContent =
      "جارٍ تحميل الخدمات المسجلة...";

    try {
      const data = await request(
        `${SERVICE_API}?providerId=${encodeURIComponent(providerId)}&manage=1`
      );

      services = Array.isArray(data.services) ? data.services : [];

      renderServices();

      providerServicesStatus.textContent = services.length
        ? `عدد الخدمات المسجلة: ${services.length}`
        : "لم تضف خدمات لهذا النشاط بعد.";
    } catch (error) {
      providerServicesStatus.textContent =
        error.message || "تعذر تحميل الخدمات.";

      const empty = document.createElement("div");
      empty.className = "service-empty";
      empty.textContent = "تعذر عرض الخدمات. حاول تحديث القائمة.";
      providerServicesList.appendChild(empty);
    }
  }

  function startEditService(service) {
    editingServiceId = Number(service.id);

    serviceForm.elements.name.value = service.name || "";
    serviceForm.elements.description.value =
      service.description || "";
    serviceForm.elements.duration_minutes.value =
      Number(service.duration_minutes) || 30;
    serviceForm.elements.price.value = service.price ?? 0;
    serviceForm.elements.currency.value =
      service.currency || "YER";

    serviceFormHeading.textContent = "تعديل بيانات الخدمة";
    saveServiceBtn.textContent = "حفظ التعديلات";
    cancelServiceEdit.hidden = false;

    serviceStatus.textContent =
      `أنت تعدّل خدمة: ${service.name}`;

    serviceForm.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    serviceForm.elements.name.focus();
  }

  async function changeServiceStatus(service, button) {
    const providerId = selectedProviderId();

    if (!providerId) {
      providerServicesStatus.textContent = "اختر النشاط أولًا.";
      return;
    }

    const currentlyActive = Number(service.is_active) === 1;
    const nextStatus = currentlyActive ? 0 : 1;

    button.disabled = true;
    providerServicesStatus.textContent = currentlyActive
      ? "جارٍ تعطيل الخدمة..."
      : "جارٍ تفعيل الخدمة...";

    try {
      const data = await request(SERVICE_API, {
        method: "POST",
        body: JSON.stringify({
          action: "set_status",
          provider_id: providerId,
          service_id: Number(service.id),
          is_active: nextStatus
        })
      });

      providerServicesStatus.textContent =
        data.message ||
        (nextStatus
          ? "تم تفعيل الخدمة بنجاح."
          : "تم تعطيل الخدمة بنجاح.");

      if (editingServiceId === Number(service.id)) {
        resetServiceForm();
      }

      await loadServices();
    } catch (error) {
      providerServicesStatus.textContent =
        error.message || "تعذر تغيير حالة الخدمة.";

      button.disabled = false;
    }
  }

  cancelServiceEdit.addEventListener("click", () => {
    resetServiceForm();
  });

  // ==========================================
  // تبويبات لوحة التحكم وفلاتر الحجوزات
  // ==========================================

  function initTabs() {
    if (!providerTabsNav) return;
    const tabButtons = providerTabsNav.querySelectorAll(".tab-btn");
    const tabContents = [
      providerBookings,
      tabProfileSection,
      serviceManagement,
      availabilityManagement,
      paymentManagement
    ].filter(Boolean);

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        tabButtons.forEach((b) => {
          b.classList.remove("active");
          b.style.background = "#e8e8df";
          b.style.color = "#123c32";
        });
        btn.classList.add("active");
        btn.style.background = "#123c32";
        btn.style.color = "#fff";

        tabContents.forEach((section) => {
          if (section) section.style.display = "none";
        });

        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          targetSection.style.display = "block";
          targetSection.hidden = false;
        }

        if (targetId === "paymentManagement") {
          populatePaymentForm();
        }
      });
    });
  }

  function initBookingFilters() {
    if (!providerBookingFilters) return;
    const filterBtns = providerBookingFilters.querySelectorAll(".btn-filter");
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => {
          b.classList.remove("active");
          b.style.background = "#fff";
          const filter = b.dataset.filter;
          b.style.color = filter === "pending" ? "#a33c36" : filter === "confirmed" ? "#28613f" : "#123c32";
        });
        btn.classList.add("active");
        btn.style.background = "#123c32";
        btn.style.color = "#fff";

        currentBookingFilter = btn.dataset.filter || "all";
        renderBookingsList();
      });
    });
  }

  function updateKPIs(bookings) {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = bookings.filter((b) => b.appointment_date === today).length;
    const pendingCount = bookings.filter((b) => b.status === "pending").length;
    const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
    const revenue = bookings
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    if (statTodayBookings) statTodayBookings.textContent = String(todayCount);
    if (statPendingBookings) statPendingBookings.textContent = String(pendingCount);
    if (statConfirmedBookings) statConfirmedBookings.textContent = String(confirmedCount);
    if (statRevenue) statRevenue.textContent = `${revenue.toLocaleString("ar-YE")} ر.ي`;
  }

  function renderBookingsList() {
    providerBookingsList.replaceChildren();

    const today = new Date().toISOString().slice(0, 10);
    let filtered = loadedBookings;

    if (currentBookingFilter === "today") {
      filtered = loadedBookings.filter((b) => b.appointment_date === today);
    } else if (currentBookingFilter === "pending") {
      filtered = loadedBookings.filter((b) => b.status === "pending");
    } else if (currentBookingFilter === "confirmed") {
      filtered = loadedBookings.filter((b) => b.status === "confirmed");
    } else if (currentBookingFilter === "completed") {
      filtered = loadedBookings.filter((b) => b.status === "completed");
    }

    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.style.cssText = "padding:20px;text-align:center;color:#75817b;background:#f8f8f4;border-radius:10px;margin-top:15px;";
      empty.textContent = currentBookingFilter === "all"
        ? "لا توجد حجوزات مسجلة حاليًا."
        : "لا توجد حجوزات مطابقة لهذا التصنيف.";
      providerBookingsList.appendChild(empty);
      return;
    }

    filtered.forEach((booking) => {
      const card = document.createElement("article");
      card.style.cssText = "padding:16px;margin:14px 0;border:1px solid #e2e1d7;border-radius:14px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.03);";

      const topRow = document.createElement("div");
      topRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;border-bottom:1px solid #f0eee4;padding-bottom:10px;";

      const title = document.createElement("h3");
      title.style.cssText = "margin:0;color:#123c32;font-size:17px;";
      title.textContent = booking.service_name || "حجز خدمة";

      const labels = {
        pending: "⏳ بانتظار التأكيد والدفع",
        confirmed: "✅ موعد مؤكد",
        cancelled: "❌ موعد ملغي",
        completed: "🏁 موعد مكتمل"
      };

      const colors = {
        pending: { bg: "#fef8e7", color: "#a33c36", border: "#f2d184" },
        confirmed: { bg: "#eef7f0", color: "#28613f", border: "#a6d7b2" },
        cancelled: { bg: "#fdf2f2", color: "#a33c36", border: "#f3b8b8" },
        completed: { bg: "#f3f5f4", color: "#55645f", border: "#c5d1cb" }
      };

      const stStyle = colors[booking.status] || { bg: "#f0f0f0", color: "#333", border: "#ccc" };
      const statusBadge = document.createElement("span");
      statusBadge.style.cssText = `background:${stStyle.bg};color:${stStyle.color};border:1px solid ${stStyle.border};border-radius:8px;padding:4px 10px;font-size:12px;font-weight:bold;`;
      statusBadge.textContent = labels[booking.status] || booking.status || "غير محدد";

      topRow.append(title, statusBadge);
      card.appendChild(topRow);

      const infoGrid = document.createElement("div");
      infoGrid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;font-size:13px;color:#333;margin-bottom:12px;";

      infoGrid.innerHTML = `
        <div><strong>العميل:</strong> ${booking.customer_name || "—"}</div>
        <div><strong>الهاتف:</strong> ${booking.customer_phone || "—"}</div>
        <div><strong>التاريخ:</strong> ${booking.appointment_date || "—"}</div>
        <div><strong>الوقت:</strong> ${booking.start_time || "—"} إلى ${booking.end_time || "—"}</div>
        <div><strong>السعر:</strong> <span style="color:#123c32;font-weight:bold;">${booking.price ?? "—"} ${booking.currency || "YER"}</span></div>
        <div><strong>النشاط:</strong> ${booking.business_name || "—"}</div>
      `;
      card.appendChild(infoGrid);

      // تفاصيل الحوالة والدفع إن وجدت في customer_notes
      if (booking.customer_notes) {
        const isPaymentNote = booking.customer_notes.includes("[طريقة الدفع:");
        const notesBox = document.createElement("div");
        notesBox.style.cssText = isPaymentNote
          ? "background:#fcfbf7;border:1px solid #d8bd7c;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:13px;line-height:1.6;"
          : "background:#f7f6f0;border:1px solid #e8e8df;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:13px;";

        const notesHeader = document.createElement("strong");
        notesHeader.style.cssText = "display:block;margin-bottom:4px;color:#123c32;";
        notesHeader.textContent = isPaymentNote ? "💳 إشعار الدفع والحوالة من العميل:" : "ملاحظات العميل:";

        const notesText = document.createElement("div");
        notesText.style.whiteSpace = "pre-line";
        notesText.textContent = booking.customer_notes;

        notesBox.append(notesHeader, notesText);
        card.appendChild(notesBox);
      }

      // أزرار التواصل (واتساب واتصال)
      if (booking.customer_phone) {
        const contactBar = document.createElement("div");
        contactBar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;";

        const cleanPhone = String(booking.customer_phone).replace(/\D/g, "");
        const waLink = document.createElement("a");
        waLink.href = `https://wa.me/967${cleanPhone}?text=${encodeURIComponent(`مرحباً ${booking.customer_name}، نتواصل معك من ${booking.business_name} بخصوص حجزك (${booking.service_name}) بتاريخ ${booking.appointment_date} الساعة ${booking.start_time}.`)}`;
        waLink.target = "_blank";
        waLink.rel = "noopener noreferrer";
        waLink.style.cssText = "background:#25d366;color:#fff;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:bold;text-decoration:none;display:inline-flex;align-items:center;gap:4px;";
        waLink.innerHTML = "<span>💬</span> مراسلة واتساب";

        const callLink = document.createElement("a");
        callLink.href = `tel:${booking.customer_phone}`;
        callLink.style.cssText = "background:#123c32;color:#fff;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:bold;text-decoration:none;display:inline-flex;align-items:center;gap:4px;";
        callLink.innerHTML = "<span>📞</span> اتصال";

        contactBar.append(waLink, callLink);
        card.appendChild(contactBar);
      }

      // أزرار اتخاذ القرار للحجز
      const actionsBar = document.createElement("div");
      actionsBar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid #f0eee4;";

      if (booking.status === "pending") {
        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.textContent = "✅ تأكيد استلام الحوالة وتأكيد الموعد";
        confirmBtn.style.cssText = "background:#28613f;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:bold;cursor:pointer;";

        confirmBtn.addEventListener("click", async () => {
          card.querySelectorAll("button").forEach((b) => { b.disabled = true; });
          providerBookingsStatus.textContent = "جارٍ تأكيد الحجز...";
          try {
            const res = await request(BOOKING_MANAGE_API, {
              method: "POST",
              body: JSON.stringify({ booking_id: Number(booking.id), status: "confirmed" })
            });
            providerBookingsStatus.textContent = res.message || "تم تأكيد الحجز بنجاح.";
            await loadProviderBookings();
          } catch (err) {
            providerBookingsStatus.textContent = err.message || "تعذر تأكيد الحجز.";
            card.querySelectorAll("button").forEach((b) => { b.disabled = false; });
          }
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "❌ رفض / إلغاء الحجز";
        cancelBtn.style.cssText = "background:#fff;color:#a33c36;border:1px solid #a33c3660;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:bold;cursor:pointer;";

        cancelBtn.addEventListener("click", async () => {
          if (!confirm("هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟")) return;
          card.querySelectorAll("button").forEach((b) => { b.disabled = true; });
          providerBookingsStatus.textContent = "جارٍ إلغاء الحجز...";
          try {
            const res = await request(BOOKING_MANAGE_API, {
              method: "POST",
              body: JSON.stringify({ booking_id: Number(booking.id), status: "cancelled" })
            });
            providerBookingsStatus.textContent = res.message || "تم إلغاء الحجز.";
            await loadProviderBookings();
          } catch (err) {
            providerBookingsStatus.textContent = err.message || "تعذر إلغاء الحجز.";
            card.querySelectorAll("button").forEach((b) => { b.disabled = false; });
          }
        });

        actionsBar.append(confirmBtn, cancelBtn);
      } else if (booking.status === "confirmed") {
        const completeBtn = document.createElement("button");
        completeBtn.type = "button";
        completeBtn.textContent = "🏁 تسجيل اكتمال الموعد";
        completeBtn.style.cssText = "background:#123c32;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:bold;cursor:pointer;";

        completeBtn.addEventListener("click", async () => {
          completeBtn.disabled = true;
          providerBookingsStatus.textContent = "جارٍ إكمال الموعد...";
          try {
            const res = await request(BOOKING_MANAGE_API, {
              method: "POST",
              body: JSON.stringify({ booking_id: Number(booking.id), status: "completed" })
            });
            providerBookingsStatus.textContent = res.message || "تم تسجيل اكتمال الموعد.";
            await loadProviderBookings();
          } catch (err) {
            providerBookingsStatus.textContent = err.message || "تعذر إكمال الموعد.";
            completeBtn.disabled = false;
          }
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = "إلغاء الموعد";
        cancelBtn.style.cssText = "background:#fff;color:#a33c36;border:1px solid #a33c3660;border-radius:8px;padding:9px 14px;font-size:13px;font-weight:bold;cursor:pointer;";

        cancelBtn.addEventListener("click", async () => {
          if (!confirm("هل أنت متأكد من إلغاء هذا الموعد المؤكد؟")) return;
          card.querySelectorAll("button").forEach((b) => { b.disabled = true; });
          providerBookingsStatus.textContent = "جارٍ إلغاء الحجز...";
          try {
            const res = await request(BOOKING_MANAGE_API, {
              method: "POST",
              body: JSON.stringify({ booking_id: Number(booking.id), status: "cancelled" })
            });
            providerBookingsStatus.textContent = res.message || "تم إلغاء الحجز.";
            await loadProviderBookings();
          } catch (err) {
            providerBookingsStatus.textContent = err.message || "تعذر إلغاء الحجز.";
            card.querySelectorAll("button").forEach((b) => { b.disabled = false; });
          }
        });

        actionsBar.append(completeBtn, cancelBtn);
      }

      if (actionsBar.children.length > 0) {
        card.appendChild(actionsBar);
      }

      providerBookingsList.appendChild(card);
    });
  }

  async function loadProviderBookings() {
    providerBookings.hidden = false;
    providerBookingsStatus.textContent = "جارٍ تحميل الحجوزات...";
    if (refreshProviderBookings) {
      refreshProviderBookings.disabled = true;
    }

    try {
      const data = await request(BOOKING_MANAGE_API);
      loadedBookings = Array.isArray(data.bookings) ? data.bookings : [];

      updateKPIs(loadedBookings);

      if (!loadedBookings.length) {
        providerBookingsStatus.textContent = "لا توجد حجوزات واردة حاليًا.";
      } else {
        providerBookingsStatus.textContent = `إجمالي الحجوزات: ${loadedBookings.length}`;
      }

      renderBookingsList();
    } catch (error) {
      providerBookingsStatus.textContent = error.message || "تعذر تحميل الحجوزات.";
    } finally {
      if (refreshProviderBookings) {
        refreshProviderBookings.disabled = false;
      }
    }
  }

  // ==========================================
  // إعدادات وحسابات الدفع المحلية (اليمن)
  // ==========================================

  function populatePaymentForm() {
    const providerId = selectedProviderId();
    if (!providerId) return;
    const provider = providers.find((p) => Number(p.id) === providerId);
    if (!provider) return;

    let pInfo = {};
    if (typeof provider.payment_info === "string") {
      try {
        pInfo = JSON.parse(provider.payment_info);
      } catch {}
    } else if (typeof provider.payment_info === "object" && provider.payment_info) {
      pInfo = provider.payment_info;
    }

    if (payKuraimi) payKuraimi.value = pInfo.kuraimi || "";
    if (payJawali) payJawali.value = pInfo.jawali || "";
    if (payOnecash) payOnecash.value = pInfo.onecash || "";
    if (payFloosak) payFloosak.value = pInfo.floosak || "";
    if (payTransfer) payTransfer.value = pInfo.transfer || "";
    if (payCashEnabled) payCashEnabled.checked = pInfo.cash_enabled !== false;
    if (paymentStatus) paymentStatus.textContent = "";
  }

  if (providerPaymentForm) {
    providerPaymentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const providerId = selectedProviderId();

      if (!providerId) {
        if (paymentStatus) {
          paymentStatus.textContent = "يرجى اختيار النشاط أولًا لتحديد حساباته.";
        }
        return;
      }

      if (savePaymentBtn) savePaymentBtn.disabled = true;
      if (paymentStatus) paymentStatus.textContent = "جارٍ حفظ بيانات الدفع...";

      const paymentInfo = {
        kuraimi: payKuraimi?.value.trim() || "",
        jawali: payJawali?.value.trim() || "",
        onecash: payOnecash?.value.trim() || "",
        floosak: payFloosak?.value.trim() || "",
        transfer: payTransfer?.value.trim() || "",
        cash_enabled: payCashEnabled ? payCashEnabled.checked : true
      };

      try {
        const data = await request(PROVIDER_API, {
          method: "POST",
          body: JSON.stringify({
            action: "save-payment-info",
            provider_id: providerId,
            payment_info: paymentInfo
          })
        });

        const pObj = providers.find((p) => Number(p.id) === providerId);
        if (pObj) {
          pObj.payment_info = paymentInfo;
        }

        if (paymentStatus) {
          paymentStatus.textContent = data.message || "تم حفظ بيانات الدفع بنجاح.";
        }
      } catch (err) {
        if (paymentStatus) {
          paymentStatus.textContent = err.message || "تعذر حفظ بيانات الدفع.";
        }
      } finally {
        if (savePaymentBtn) savePaymentBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // ساعات العمل والفترات المتعددة
  // ==========================================

  function createPeriodRow(dayName, period = {}) {
    const row = document.createElement("div");
    row.className = "availability-period";

    const startWrapper = document.createElement("div");
    const startLabel = document.createElement("label");
    const startInput = document.createElement("input");

    startLabel.textContent = "وقت البداية";
    startInput.type = "time";
    startInput.className = "availability-start";
    startInput.required = true;
    startInput.value = period.start_time
      ? String(period.start_time).slice(0, 5)
      : "08:00";
    startInput.setAttribute(
      "aria-label",
      `${dayName}: وقت بداية الفترة`
    );

    startWrapper.append(startLabel, startInput);

    const endWrapper = document.createElement("div");
    const endLabel = document.createElement("label");
    const endInput = document.createElement("input");

    endLabel.textContent = "وقت النهاية";
    endInput.type = "time";
    endInput.className = "availability-end";
    endInput.required = true;
    endInput.value = period.end_time
      ? String(period.end_time).slice(0, 5)
      : "12:00";
    endInput.setAttribute(
      "aria-label",
      `${dayName}: وقت نهاية الفترة`
    );

    endWrapper.append(endLabel, endInput);

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.className = "remove-period-btn";
    removeButton.textContent = "حذف الفترة";
    removeButton.setAttribute(
      "aria-label",
      `حذف فترة من يوم ${dayName}`
    );

    removeButton.addEventListener("click", () => {
      row.remove();

      const dayRow = row.closest(".availability-day");
      updateDayState(dayRow);
    });

    row.append(startWrapper, endWrapper, removeButton);

    return row;
  }

  function updateDayState(dayRow) {
    if (!dayRow) return;

    const checkbox = dayRow.querySelector(".availability-enabled");
    const periods = dayRow.querySelector(".availability-periods");
    const state = dayRow.querySelector(".availability-day-state");
    const addButton = dayRow.querySelector(".add-period-btn");

    const hasPeriods = periods.children.length > 0;

    checkbox.checked = hasPeriods;
    state.textContent = hasPeriods
      ? `عدد الفترات: ${periods.children.length}`
      : "يوم إجازة";

    periods.hidden = !hasPeriods;
    addButton.textContent = hasPeriods
      ? "＋ إضافة فترة أخرى"
      : "＋ إضافة فترة عمل";
  }

  function addPeriod(dayRow, period = {}) {
    const weekday = Number(dayRow.dataset.weekday);
    const dayName = weekdays[weekday];

    const periods = dayRow.querySelector(".availability-periods");

    const row = createPeriodRow(dayName, period);

    periods.appendChild(row);
    updateDayState(dayRow);

    return row;
  }

  function renderAvailabilityDays() {
    availabilityDays.replaceChildren();

    weekdays.forEach((day, weekday) => {
      const dayRow = document.createElement("div");

      dayRow.className = "availability-day";
      dayRow.dataset.weekday = String(weekday);

      const header = document.createElement("div");
      header.className = "availability-day-header";

      const title = document.createElement("label");
      title.className = "availability-day-title";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "availability-enabled";
      checkbox.dataset.weekday = String(weekday);
      checkbox.setAttribute(
        "aria-label",
        `تفعيل يوم ${day}`
      );

      checkbox.addEventListener("change", () => {
        const periods = dayRow.querySelector(".availability-periods");

        if (checkbox.checked && periods.children.length === 0) {
          addPeriod(dayRow);
        }

        if (!checkbox.checked) {
          periods.replaceChildren();
        }

        updateDayState(dayRow);
      });

      title.append(checkbox, document.createTextNode(day));

      const state = document.createElement("span");
      state.className = "availability-day-state";
      state.textContent = "يوم إجازة";

      header.append(title, state);

      const periods = document.createElement("div");
      periods.className = "availability-periods";
      periods.hidden = true;

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "add-period-btn";
      addButton.textContent = "＋ إضافة فترة عمل";

      addButton.addEventListener("click", () => {
        addPeriod(dayRow);
      });

      dayRow.append(header, periods, addButton);

      availabilityDays.appendChild(dayRow);
      updateDayState(dayRow);
    });
  }

  async function loadAvailability() {
    const providerId = selectedProviderId();

    availabilityManagement.hidden = !providerId;
    availabilityStatus.textContent = "";

    if (!providerId) {
      availabilityDays.replaceChildren();
      return;
    }

    renderAvailabilityDays();

    availabilityStatus.textContent =
      "جارٍ تحميل ساعات العمل...";

    try {
      const data = await request(
        `${AVAILABILITY_API}?providerId=${encodeURIComponent(providerId)}`
      );

      const saved = Array.isArray(data.availability)
        ? data.availability
        : Array.isArray(data.hours)
          ? data.hours
          : [];

      saved
        .filter((item) => Number(item.is_active) === 1)
        .forEach((item) => {
          const weekday = Number(item.weekday);

          if (
            !Number.isInteger(weekday) ||
            weekday < 0 ||
            weekday > 6
          ) {
            return;
          }

          const dayRow = availabilityDays.querySelector(
            `.availability-day[data-weekday="${weekday}"]`
          );

          if (!dayRow) return;

          addPeriod(dayRow, {
            start_time: item.start_time,
            end_time: item.end_time
          });
        });

      availabilityStatus.textContent = saved.some(
        (item) => Number(item.is_active) === 1
      )
        ? "تم تحميل فترات العمل المحفوظة."
        : "لم تُحدد ساعات عمل بعد. أضف الفترات للأيام المطلوبة.";
    } catch (error) {
      availabilityStatus.textContent =
        error.message || "تعذر تحميل ساعات العمل.";
    }
  }

  function getDayPeriods(dayRow) {
    return [
      ...dayRow.querySelectorAll(".availability-period")
    ].map((periodRow) => ({
      start_time: periodRow.querySelector(".availability-start").value,
      end_time: periodRow.querySelector(".availability-end").value
    }));
  }

  function validateDayPeriods(weekday, periods) {
    for (const period of periods) {
      if (!period.start_time || !period.end_time) {
        return `أكمل وقت البداية والنهاية ليوم ${weekdays[weekday]}.`;
      }

      if (period.start_time >= period.end_time) {
        return `وقت النهاية يجب أن يكون بعد البداية ليوم ${weekdays[weekday]}.`;
      }
    }

    const sorted = [...periods].sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start_time < sorted[i - 1].end_time) {
        return `توجد فترات متداخلة في يوم ${weekdays[weekday]}. عدّل الأوقات أو احذف إحدى الفترات.`;
      }
    }

    return null;
  }

  async function saveAvailability() {
    const providerId = selectedProviderId();

    if (!providerId) {
      availabilityStatus.textContent = "اختر النشاط أولًا.";
      return;
    }

    const dayRows = [
      ...availabilityDays.querySelectorAll(".availability-day")
    ];

    if (dayRows.length !== 7) {
      availabilityStatus.textContent =
        "تعذر قراءة أيام الأسبوع كاملة. أعد تحميل ساعات العمل.";
      return;
    }

    const schedule = dayRows.map((dayRow) => {
      const weekday = Number(dayRow.dataset.weekday);
      const periods = getDayPeriods(dayRow);

      return { weekday, periods };
    });

    for (const day of schedule) {
      if (
        !Number.isInteger(day.weekday) ||
        day.weekday < 0 ||
        day.weekday > 6
      ) {
        availabilityStatus.textContent =
          "يوجد يوم غير صالح في جدول العمل.";
        return;
      }

      const error = validateDayPeriods(day.weekday, day.periods);

      if (error) {
        availabilityStatus.textContent = error;
        return;
      }
    }

    saveAvailabilityBtn.disabled = true;
    availabilityStatus.textContent =
      "جارٍ حفظ ساعات العمل للأسبوع كاملًا...";

    try {
      const data = await request(AVAILABILITY_API, {
        method: "POST",
        body: JSON.stringify({
          action: "replace_week",
          provider_id: providerId,
          days: schedule
        })
      });

      availabilityStatus.textContent =
        data.message || "تم حفظ ساعات العمل للأسبوع كاملًا بنجاح.";

      await loadAvailability();
    } catch (error) {
      availabilityStatus.textContent =
        error.message || "تعذر حفظ ساعات العمل. لم يتم اعتماد التغييرات.";
    } finally {
      saveAvailabilityBtn.disabled = false;
    }
  }

  // ==========================================
  // إضافة نشاط
  // ==========================================

  providerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const phone = providerForm.elements.phone.value.trim();

    if (!/^7[0-9]{8}$/.test(phone)) {
      providerStatus.textContent =
        "رقم التواصل اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7.";

      providerForm.elements.phone.focus();
      return;
    }

    const submitButton =
      providerForm.querySelector('[type="submit"]');

    submitButton.disabled = true;
    providerStatus.textContent = "جارٍ حفظ النشاط...";

    const payload = {
      business_name: providerForm.elements.business_name.value.trim(),
      category: providerForm.elements.category.value.trim(),
      city: providerForm.elements.city.value.trim(),
      address: providerForm.elements.address.value.trim(),
      phone,
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
        serviceManagement.hidden = false;

        await loadServices();
        await loadAvailability();
      }
    } catch (error) {
      providerStatus.textContent =
        error.message || "تعذر حفظ النشاط.";
    } finally {
      submitButton.disabled = false;
    }
  });

  // ==========================================
  // اختيار النشاط
  // ==========================================

  providerSelect.addEventListener("change", async () => {
    serviceStatus.textContent = "";
    providerServicesStatus.textContent = "";

    resetServiceForm();
    populatePaymentForm();

    await loadServices();
    await loadAvailability();
  });

  saveAvailabilityBtn.addEventListener("click", saveAvailability);

  // ==========================================
  // إضافة خدمة أو تعديلها
  // ==========================================

  serviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const providerId = selectedProviderId();

    if (!providerId) {
      serviceStatus.textContent = "اختر النشاط أولًا.";
      return;
    }

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

    if (
      !payload.name ||
      !Number.isInteger(payload.duration_minutes) ||
      payload.duration_minutes < 5 ||
      payload.duration_minutes > 1440 ||
      !Number.isFinite(payload.price) ||
      payload.price < 0
    ) {
      serviceStatus.textContent =
        "راجع اسم الخدمة ومدتها وسعرها.";
      return;
    }

    const isEditing = editingServiceId !== null;

    if (isEditing) {
      payload.action = "update";
      payload.service_id = editingServiceId;
    } else {
      payload.action = "create";
    }

    saveServiceBtn.disabled = true;
    cancelServiceEdit.disabled = true;

    serviceStatus.textContent = isEditing
      ? "جارٍ حفظ تعديلات الخدمة..."
      : "جارٍ إضافة الخدمة...";

    try {
      const data = await request(SERVICE_API, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      resetServiceForm();

      serviceStatus.textContent =
        data.message ||
        (isEditing
          ? "تم تحديث الخدمة بنجاح."
          : "تمت إضافة الخدمة بنجاح.");

      await loadServices();
    } catch (error) {
      serviceStatus.textContent =
        error.message || "تعذر حفظ الخدمة.";
    } finally {
      saveServiceBtn.disabled = false;
      cancelServiceEdit.disabled = false;
    }
  });

  // ==========================================
  // الحجوزات
  // ==========================================

  refreshProviderBookings.addEventListener(
    "click",
    loadProviderBookings
  );

  // ==========================================
  // فتح لوحة الإدارة
  // ==========================================

  async function openDashboard() {
    dashboard.hidden = false;

    const user = auth?.getUser();

    if (!auth?.isLoggedIn() || !user) {
      providerForm.hidden = true;
      serviceManagement.hidden = true;
      providerBookings.hidden = true;
      editProviderSection.hidden = true;

      showMessage("سجّل الدخول بحساب صاحب نشاط للمتابعة.");

      document.getElementById("loginBtn")?.click();
      return;
    }

    if (user.role !== "provider") {
      providerForm.hidden = true;
      serviceManagement.hidden = true;
      providerBookings.hidden = true;
      editProviderSection.hidden = true;

      showMessage("هذه الصفحة مخصصة لحساب صاحب نشاط.");
      return;
    }

    if (!tabsInitialized) {
      initTabs();
      initBookingFilters();
      tabsInitialized = true;
    }

    providerForm.hidden = false;
    providerBookings.hidden = false;

    await Promise.all([
      loadProviders(),
      loadProviderBookings()
    ]);

    const providerId = selectedProviderId();

    if (providerId) {
      populatePaymentForm();

      await Promise.all([
        loadServices(),
        loadAvailability()
      ]);
    }
  }

  window.addEventListener("meead:auth-change", () => {
    const user = auth?.getUser();

    if (!auth?.isLoggedIn() || user?.role !== "provider") {
      dashboard.hidden = true;
      providers = [];
      services = [];
      editingServiceId = null;

      list.replaceChildren();
      providerServicesList.replaceChildren();

      serviceManagement.hidden = true;
      providerBookings.hidden = true;
      availabilityManagement.hidden = true;
      availabilityDays.replaceChildren();
      closeProviderEdit();
    } else {
      openDashboard();
    }
  });

  openDashboard();
});
