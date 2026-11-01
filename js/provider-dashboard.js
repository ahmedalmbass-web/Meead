
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.getElementById("providerDashboard");
  const message = document.getElementById("providerDashboardMessage");
  const list = document.getElementById("providerList");
  const providerForm = document.getElementById("providerForm");
  const providerStatus = document.getElementById("providerFormStatus");

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
    !saveServiceBtn || !cancelServiceEdit
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
      chooseButton.textContent = "إدارة خدمات النشاط";

      chooseButton.addEventListener("click", async () => {
        providerSelect.value = String(provider.id);
        serviceManagement.hidden = false;

        resetServiceForm();
        await loadServices();
        await loadAvailability();

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
  // الحجوزات
  // ==========================================

  async function loadProviderBookings() {
    providerBookings.hidden = false;
    providerBookingsStatus.textContent = "جارٍ تحميل الحجوزات...";
    providerBookingsList.replaceChildren();

    if (refreshProviderBookings) {
      refreshProviderBookings.disabled = true;
    }

    try {
      const data = await request(BOOKING_MANAGE_API);

      const bookings = Array.isArray(data.bookings)
        ? data.bookings
        : [];

      if (!bookings.length) {
        providerBookingsStatus.textContent =
          "لا توجد حجوزات واردة حاليًا.";
        return;
      }

      providerBookingsStatus.textContent =
        `عدد الحجوزات: ${bookings.length}`;

      bookings.forEach((booking) => {
        const card = document.createElement("article");

        card.style.cssText =
          "padding:14px;margin:12px 0;border:1px solid #ddd;border-radius:12px";

        const title = document.createElement("h3");
        title.textContent = booking.service_name || "حجز خدمة";

        const details = document.createElement("p");

        details.textContent =
          `النشاط: ${booking.business_name || "—"}\n` +
          `العميل: ${booking.customer_name || "—"}\n` +
          `الهاتف: ${booking.customer_phone || "—"}\n` +
          `التاريخ: ${booking.appointment_date || "—"}\n` +
          `الوقت: ${booking.start_time || "—"} - ${booking.end_time || "—"}\n` +
          `السعر: ${booking.price ?? "—"} ${booking.currency || ""}\n` +
          `ملاحظات: ${booking.customer_notes || "لا توجد"}`;

        details.style.whiteSpace = "pre-line";

        const status = document.createElement("p");

        const labels = {
          pending: "بانتظار تأكيدك",
          confirmed: "تم تأكيد الحجز",
          cancelled: "تم إلغاء الحجز",
          completed: "اكتمل الموعد"
        };

        status.textContent =
          labels[booking.status] || booking.status || "غير محدد";

        card.append(title, details, status);

        if (booking.status === "pending") {
          ["confirmed", "cancelled"].forEach((nextStatus) => {
            const button = document.createElement("button");

            button.type = "button";
            button.textContent =
              nextStatus === "confirmed"
                ? "تأكيد الحجز"
                : "إلغاء الحجز";

            button.style.cssText =
              "margin:5px;padding:9px 12px;border:0;border-radius:8px;cursor:pointer";

            button.addEventListener("click", async () => {
              card.querySelectorAll("button").forEach((b) => {
                b.disabled = true;
              });

              providerBookingsStatus.textContent =
                "جارٍ تحديث الحجز...";

              try {
                const result = await request(BOOKING_MANAGE_API, {
                  method: "POST",
                  body: JSON.stringify({
                    booking_id: Number(booking.id),
                    status: nextStatus
                  })
                });

                providerBookingsStatus.textContent =
                  result.message || "تم تحديث الحجز.";

                await loadProviderBookings();
              } catch (error) {
                providerBookingsStatus.textContent =
                  error.message || "تعذر تحديث الحجز.";

                card.querySelectorAll("button").forEach((b) => {
                  b.disabled = false;
                });
              }
            });

            card.appendChild(button);
          });
        }

        if (booking.status === "confirmed") {
          const completeButton = document.createElement("button");

          completeButton.type = "button";
          completeButton.textContent = "إكمال الموعد";

          completeButton.style.cssText =
            "margin:5px;padding:9px 12px;border:0;border-radius:8px;cursor:pointer";

          completeButton.addEventListener("click", async () => {
            completeButton.disabled = true;

            providerBookingsStatus.textContent =
              "جارٍ إكمال الموعد...";

            try {
              const result = await request(BOOKING_MANAGE_API, {
                method: "POST",
                body: JSON.stringify({
                  booking_id: Number(booking.id),
                  status: "completed"
                })
              });

              providerBookingsStatus.textContent =
                result.message || "تم تسجيل اكتمال الموعد.";

              await loadProviderBookings();
            } catch (error) {
              providerBookingsStatus.textContent =
                error.message || "تعذر إكمال الموعد.";

              completeButton.disabled = false;
            }
          });

          card.appendChild(completeButton);
        }

        providerBookingsList.appendChild(card);
      });
    } catch (error) {
      providerBookingsStatus.textContent =
        error.message || "تعذر تحميل الحجوزات.";
    } finally {
      if (refreshProviderBookings) {
        refreshProviderBookings.disabled = false;
      }
    }
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

    const schedule = dayRows.map((dayRow) => {
      const weekday = Number(dayRow.dataset.weekday);
      const periods = getDayPeriods(dayRow);

      return { weekday, periods };
    });

    for (const day of schedule) {
      const error = validateDayPeriods(day.weekday, day.periods);

      if (error) {
        availabilityStatus.textContent = error;
        return;
      }
    }

    saveAvailabilityBtn.disabled = true;
    availabilityStatus.textContent = "جارٍ حفظ ساعات العمل...";

    try {
      for (const day of schedule) {
        await request(AVAILABILITY_API, {
          method: "POST",
          body: JSON.stringify({
            action: "replace_day",
            provider_id: providerId,
            weekday: day.weekday,
            periods: day.periods
          })
        });
      }

      availabilityStatus.textContent =
        "تم حفظ ساعات العمل بنجاح.";

      await loadAvailability();
    } catch (error) {
      availabilityStatus.textContent =
        error.message || "تعذر حفظ ساعات العمل.";
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

      showMessage("سجّل الدخول بحساب صاحب نشاط للمتابعة.");

      document.getElementById("loginBtn")?.click();
      return;
    }

    if (user.role !== "provider") {
      providerForm.hidden = true;
      serviceManagement.hidden = true;
      providerBookings.hidden = true;

      showMessage("هذه الصفحة مخصصة لحساب صاحب نشاط.");
      return;
    }

    providerForm.hidden = false;
    providerBookings.hidden = false;

    await Promise.all([
      loadProviders(),
      loadProviderBookings()
    ]);

    const providerId = selectedProviderId();

    if (providerId) {
      serviceManagement.hidden = false;

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
    } else {
      openDashboard();
    }
  });

  openDashboard();
});
