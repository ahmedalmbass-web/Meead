/* Meead - Search, Provider Details, and Fresha-style Stepped Booking Flow */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("meeadSearch");
  const searchInput = document.getElementById("searchInput");
  const locationInput = document.getElementById("locationInput");
  const categoriesSection = document.getElementById("categories");

  if (!searchForm || !searchInput || !categoriesSection) {
    console.error("Meead: عناصر البحث غير موجودة.");
    return;
  }

  const API = {
    providers: "/.netlify/functions/providers",
    services: "/.netlify/functions/services",
    bookings: "/.netlify/functions/bookings",
    gallery: "/.netlify/functions/provider-images",
    slots: "/.netlify/functions/slots",
    searchLog: "/.netlify/functions/search-log"
  };

  const categorySearchTerms = {
    "العيادات الطبية": "العيادات الطبية",
    "الحلاقة الرجالية": "الحلاقة الرجالية",
    "الصالونات والجمال": "الصالونات والجمال",
    "عيادات الأسنان": "عيادات الأسنان",
    "الرياضة واللياقة": "الرياضة واللياقة",
    "التصوير والمناسبات": "التصوير والمناسبات",
    "الخدمات المهنية": "الخدمات المهنية",
    "خدمات أخرى": "خدمات أخرى"
  };

  const categoryIcons = {
    "العيادات الطبية": "🩺",
    "عيادات الأسنان": "🦷",
    "الحلاقة الرجالية": "💈",
    "الصالونات والجمال": "💇‍♀️",
    "الرياضة واللياقة": "🏋️",
    "التصوير والمناسبات": "📸",
    "الخدمات المهنية": "🛠️",
    "خدمات أخرى": "📍",
    "عيادة": "🩺",
    "حلاقة": "💈",
    "صالون": "💇‍♀️",
    "أخرى": "📍"
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Results Section
  // ──────────────────────────────────────────────────────────────────────────
  const results = document.createElement("section");
  results.id = "searchResults";
  results.className = "container";
  results.style.cssText = "display:none;padding:30px 0 55px;scroll-margin-top:100px;";
  categoriesSection.insertAdjacentElement("afterend", results);

  // ──────────────────────────────────────────────────────────────────────────
  // Fresha Stepped Booking Modal
  // ──────────────────────────────────────────────────────────────────────────
  const modal = document.createElement("section");
  modal.id = "meeadBookingModal";
  modal.hidden = true;
  modal.className = "fresha-modal-backdrop";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "meeadBookingTitle");

  modal.innerHTML = `
    <div class="fresha-modal-card">
      <!-- Modal Header -->
      <div class="fresha-modal-header">
        <button type="button" id="meeadCloseDetails" class="fresha-modal-close-btn" aria-label="إغلاق">✕</button>
        <h2 id="meeadBookingTitle" class="fresha-modal-title">تفاصيل النشاط</h2>
        <div id="meeadBookingSubtitle" class="fresha-modal-subtitle"></div>
      </div>

      <!-- Stepper Indicator -->
      <nav class="fresha-stepper" aria-label="خطوات الحجز">
        <div class="fresha-step-indicator active" data-step="1" id="stepIndicator1">
          <span class="fresha-step-badge">١</span>
          <span class="fresha-step-name">الخدمات</span>
        </div>
        <div class="fresha-step-line" id="stepLine1"></div>
        <div class="fresha-step-indicator" data-step="2" id="stepIndicator2">
          <span class="fresha-step-badge">٢</span>
          <span class="fresha-step-name">الموعد والوقت</span>
        </div>
        <div class="fresha-step-line" id="stepLine2"></div>
        <div class="fresha-step-indicator" data-step="3" id="stepIndicator3">
          <span class="fresha-step-badge">٣</span>
          <span class="fresha-step-name">التأكيد والدفع</span>
        </div>
      </nav>

      <!-- Modal Body -->
      <div class="fresha-modal-body">
        <!-- Step 1: Provider Info & Services List -->
        <div id="freshaStep1" class="fresha-step-pane">
          <div id="meeadDetailsContent">جارٍ تحميل تفاصيل النشاط وخدماته...</div>
          <div id="freshaServicesListWrap" style="margin-top:20px;"></div>
        </div>

        <!-- Step 2: Date & Available Times -->
        <div id="freshaStep2" class="fresha-step-pane" hidden>
          <div class="fresha-selected-service-banner">
            <div>
              <div style="font-size:11px;color:#75817b;font-weight:700;">الخدمة المحددة:</div>
              <div id="freshaStep2ServiceTitle" class="fresha-selected-service-text">-</div>
            </div>
            <button type="button" id="freshaChangeServiceBtn" class="fresha-change-service-link">تغيير الخدمة</button>
          </div>

          <label style="display:block;font-size:13px;font-weight:800;color:#123c32;margin-bottom:8px;">اختر تاريخ الموعد:</label>
          <div class="fresha-quick-dates" id="freshaQuickDates"></div>

          <input id="meeadDate" name="appointment_date" type="date" class="fresha-date-input-field" required>

          <label style="display:block;font-size:13px;font-weight:800;color:#123c32;margin:12px 0 6px;">الأوقات المتاحة لهذا اليوم:</label>
          <p id="meeadSlotsStatus" style="font-size:12.5px;color:#75817b;margin:0 0 10px;">اختر وقتاً مناسباً من الأوقات المتاحة.</p>
          <div id="meeadSlots" role="group" aria-label="أوقات الحجز"></div>
          <input id="meeadTime" name="start_time" type="hidden">

          <div class="fresha-modal-nav-bar">
            <button type="button" id="btnBackToStep1" class="fresha-btn-nav-prev">← السابق: الخدمات</button>
            <button type="button" id="btnGoToStep3" class="fresha-btn-nav-next" disabled>التالي: التأكيد والدفع ←</button>
          </div>
        </div>

        <!-- Step 3: Review Summary & Payment & Deferred Auth -->
        <div id="freshaStep3" class="fresha-step-pane" hidden>
          <!-- Summary Review Card -->
          <div class="fresha-review-summary-card">
            <h4 style="margin:0 0 12px;color:#123c32;font-size:15px;display:flex;align-items:center;gap:6px;">
              <span>📋</span> ملخص تفاصيل الحجز
            </h4>
            <div class="fresha-review-row">
              <span>النشاط:</span>
              <span id="reviewProviderName" class="fresha-review-value">-</span>
            </div>
            <div class="fresha-review-row">
              <span>الخدمة:</span>
              <span id="reviewServiceName" class="fresha-review-value">-</span>
            </div>
            <div class="fresha-review-row">
              <span>مدة الخدمة:</span>
              <span id="reviewServiceDuration" class="fresha-review-value">-</span>
            </div>
            <div class="fresha-review-row">
              <span>تاريخ ووقت الموعد:</span>
              <span id="reviewDateTime" class="fresha-review-value">-</span>
            </div>
            <div class="fresha-review-row">
              <span>السعر الإجمالي:</span>
              <span id="reviewPrice" class="fresha-review-value" style="color:#123c32;font-size:15px;">-</span>
            </div>
          </div>

          <!-- Form elements for payment & submission -->
          <form id="meeadBookingForm">
            <select id="meeadService" name="service_id" hidden></select>

            <div id="meeadPaymentSection" style="margin:14px 0;padding:16px;background:#fbfbf8;border:1px solid #d5ceba;border-radius:14px;">
              <h4 style="margin:0 0 8px;color:#123c32;font-size:15px;display:flex;align-items:center;gap:6px;">
                <span>💳</span> وسيلة الدفع وتأكيد الحجز في اليمن
              </h4>
              <p style="font-size:12px;color:#666;margin:0 0 12px;">اختر طريقة الدفع المناسبة وأدخل بيانات الإشعار لتأكيد موعدك:</p>

              <label for="meeadPaymentMethod" style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">طريقة الدفع أو التحويل</label>
              <select id="meeadPaymentMethod" name="payment_method" class="fresha-date-input-field" style="margin-bottom:10px;"></select>

              <div id="meeadPaymentBox" class="fresha-payment-box"></div>

              <div id="meeadPaymentInputs">
                <label for="meeadPaymentRef" style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">رقم العملية / رقم الإشعار</label>
                <input id="meeadPaymentRef" type="text" placeholder="مثلاً: 83921045" class="fresha-date-input-field" style="margin-bottom:10px;">

                <label for="meeadSenderName" style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">اسم المحوّل (صاحب الحساب/الحوالة)</label>
                <input id="meeadSenderName" type="text" placeholder="الاسم كما يظهر في إشعار التحويل" class="fresha-date-input-field" style="margin-bottom:10px;">
              </div>
            </div>

            <label for="meeadNotes" style="display:block;font-size:13px;font-weight:700;margin-bottom:4px;">ملاحظات إضافية (اختياري)</label>
            <textarea id="meeadNotes" name="notes" maxlength="1000" rows="2" placeholder="أي تفاصيل أو طلبات تود إبلاغ صاحب النشاط بها..." class="fresha-date-input-field" style="resize:vertical;margin-bottom:14px;"></textarea>

            <!-- Deferred Authentication Inline Card (Fresha Point 5) -->
            <div id="freshaDeferredAuth" class="fresha-deferred-auth" hidden>
              <div class="deferred-auth-header">
                <h4>🔒 تسجيل الدخول مطلوب لتأكيد الحجز</h4>
                <p>سجّل دخولك أو أنشئ حساباً سريعاً لمتابعة حجزك وتأكيده دون فقدان اختياراتك:</p>
              </div>

              <div class="deferred-auth-tabs">
                <button type="button" id="deferredTabLogin" class="deferred-auth-tab active">تسجيل الدخول</button>
                <button type="button" id="deferredTabRegister" class="deferred-auth-tab">إنشاء حساب جديد</button>
              </div>

              <!-- Quick Login Form -->
              <div id="deferredLoginForm" class="deferred-auth-form">
                <input type="email" id="deferredLoginEmail" class="deferred-auth-input" placeholder="البريد الإلكتروني" autocomplete="email" required>
                <input type="password" id="deferredLoginPassword" class="deferred-auth-input" placeholder="كلمة المرور" autocomplete="current-password" required>
                <button type="button" id="btnDeferredLoginSubmit" class="deferred-auth-submit-btn">دخول وتأكيد الحجز فوراً</button>
              </div>

              <!-- Quick Register Form -->
              <div id="deferredRegisterForm" class="deferred-auth-form" hidden>
                <input type="text" id="deferredRegName" class="deferred-auth-input" placeholder="الاسم الكامل" autocomplete="name" required maxlength="100">
                <input type="email" id="deferredRegEmail" class="deferred-auth-input" placeholder="البريد الإلكتروني" autocomplete="email" required>
                <input type="tel" id="deferredRegPhone" class="deferred-auth-input" placeholder="رقم الهاتف (مثال: 771234567)" autocomplete="tel" minlength="9" maxlength="9" pattern="7[0-9]{8}" required>
                <input type="password" id="deferredRegPassword" class="deferred-auth-input" placeholder="كلمة المرور (8 أحرف على الأقل)" autocomplete="new-password" minlength="8" required>
                <button type="button" id="btnDeferredRegisterSubmit" class="deferred-auth-submit-btn">إنشاء حساب وتأكيد الحجز</button>
              </div>

              <!-- Quick Verify Code Form -->
              <div id="deferredVerifyForm" class="deferred-auth-form" hidden>
                <p style="font-size:12px;color:#123c32;margin:0 0 8px;">تم إرسال كود التحقق (6 أرقام) إلى بريدك الإلكتروني. أدخل الكود لتأكيد الحساب وإكمال الحجز:</p>
                <input type="text" id="deferredVerifyCode" class="deferred-auth-input" placeholder="123456" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" style="letter-spacing:4px;text-align:center;font-size:16px;">
                <button type="button" id="btnDeferredVerifySubmit" class="deferred-auth-submit-btn">تأكيد الكود وإكمال الحجز</button>
              </div>

              <p id="deferredAuthStatus" class="deferred-auth-status" role="status"></p>
            </div>

            <p id="meeadBookingStatus" role="status" aria-live="polite" style="margin:10px 0;font-weight:700;font-size:13px;"></p>

            <div class="fresha-modal-nav-bar">
              <button type="button" id="btnBackToStep2" class="fresha-btn-nav-prev">← السابق: تعديل الموعد</button>
              <button type="submit" id="meeadSubmitBooking" class="fresha-btn-nav-next">
                تأكيد طلب الحجز <span>✓</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Success Screen -->
        <div id="freshaSuccessScreen" class="fresha-success-screen" hidden>
          <div class="fresha-success-icon">✓</div>
          <h3 class="fresha-success-title">تم إرسال طلب الحجز بنجاح!</h3>
          <p class="fresha-success-desc">تم استلام طلب حجزك وسيتم إشعار صاحب النشاط لتأكيده. يمكنك متابعة حالة الحجز في صفحة حجوزاتي.</p>
          <div id="freshaSuccessDetails" class="fresha-success-card"></div>
          <div class="fresha-success-actions">
            <a href="my-bookings.html" class="btn btn-primary">عرض تفاصيل حجوزاتي ←</a>
            <button type="button" id="btnCloseSuccessModal" class="btn btn-outline">إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // References to modal elements
  const detailsContent = modal.querySelector("#meeadDetailsContent");
  const servicesListWrap = modal.querySelector("#freshaServicesListWrap");
  const bookingForm = modal.querySelector("#meeadBookingForm");
  bookingForm.dataset.slotsReady = "1";
  const serviceSelect = modal.querySelector("#meeadService");
  const bookingStatus = modal.querySelector("#meeadBookingStatus");
  const dateInput = modal.querySelector("#meeadDate");
  const timeInput = modal.querySelector("#meeadTime");
  const slotsGrid = modal.querySelector("#meeadSlots");
  const slotsStatus = modal.querySelector("#meeadSlotsStatus");
  const quickDatesWrap = modal.querySelector("#freshaQuickDates");

  const step1 = modal.querySelector("#freshaStep1");
  const step2 = modal.querySelector("#freshaStep2");
  const step3 = modal.querySelector("#freshaStep3");
  const successScreen = modal.querySelector("#freshaSuccessScreen");

  const stepIndicator1 = modal.querySelector("#stepIndicator1");
  const stepIndicator2 = modal.querySelector("#stepIndicator2");
  const stepIndicator3 = modal.querySelector("#stepIndicator3");
  const stepLine1 = modal.querySelector("#stepLine1");
  const stepLine2 = modal.querySelector("#stepLine2");

  const btnBackToStep1 = modal.querySelector("#btnBackToStep1");
  const btnGoToStep3 = modal.querySelector("#btnGoToStep3");
  const btnBackToStep2 = modal.querySelector("#btnBackToStep2");
  const freshaChangeServiceBtn = modal.querySelector("#freshaChangeServiceBtn");
  const btnCloseSuccessModal = modal.querySelector("#btnCloseSuccessModal");

  // Deferred auth elements
  const deferredAuthBox = modal.querySelector("#freshaDeferredAuth");
  const deferredTabLogin = modal.querySelector("#deferredTabLogin");
  const deferredTabRegister = modal.querySelector("#deferredTabRegister");
  const deferredLoginForm = modal.querySelector("#deferredLoginForm");
  const deferredRegisterForm = modal.querySelector("#deferredRegisterForm");
  const deferredVerifyForm = modal.querySelector("#deferredVerifyForm");
  const deferredAuthStatus = modal.querySelector("#deferredAuthStatus");
  const btnDeferredLoginSubmit = modal.querySelector("#btnDeferredLoginSubmit");
  const btnDeferredRegisterSubmit = modal.querySelector("#btnDeferredRegisterSubmit");
  const btnDeferredVerifySubmit = modal.querySelector("#btnDeferredVerifySubmit");

  let selectedProvider = null;
  let activeServices = [];
  let selectedService = null;
  let currentStep = 1;
  let pendingVerifyEmail = "";
  let slotRequestId = 0;

  // Set min/max date
  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
  dateInput.min = localToday;

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  dateInput.max = [
    maxDate.getFullYear(),
    String(maxDate.getMonth() + 1).padStart(2, "0"),
    String(maxDate.getDate()).padStart(2, "0")
  ].join("-");

  function element(tag, text, style = "") {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
  }

  function formatPrice(service) {
    if (!service) return "";
    const amount = Number(service.price);
    if (!Number.isFinite(amount)) return "السعر غير محدد";
    const currencies = { YER: "ر.ي", SAR: "ر.س", USD: "$" };
    return `${amount.toLocaleString("ar")} ${currencies[service.currency] || service.currency || "ر.ي"}`;
  }

  function to12h(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const suffix = h >= 12 ? "م" : "ص";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function openModal() {
    modal.hidden = false;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    modal.querySelector("#meeadCloseDetails").focus();
  }

  function closeModal() {
    modal.hidden = true;
    modal.style.display = "none";
    document.body.style.overflow = "";
    if (deferredAuthBox) deferredAuthBox.hidden = true;
  }

  modal.querySelector("#meeadCloseDetails").addEventListener("click", closeModal);
  btnCloseSuccessModal?.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Stepper Transition Manager
  // ──────────────────────────────────────────────────────────────────────────
  function goToStep(stepNum) {
    currentStep = stepNum;

    // Hide all panes
    step1.hidden = true;
    step2.hidden = true;
    step3.hidden = true;
    successScreen.hidden = true;

    // Reset stepper indicators
    stepIndicator1.className = "fresha-step-indicator";
    stepIndicator2.className = "fresha-step-indicator";
    stepIndicator3.className = "fresha-step-indicator";
    stepLine1.className = "fresha-step-line";
    stepLine2.className = "fresha-step-line";

    if (stepNum === 1) {
      step1.hidden = false;
      stepIndicator1.classList.add("active");
    } else if (stepNum === 2) {
      step2.hidden = false;
      stepIndicator1.classList.add("completed");
      stepLine1.classList.add("completed");
      stepIndicator2.classList.add("active");

      // Update Step 2 Service title
      if (selectedService) {
        modal.querySelector("#freshaStep2ServiceTitle").textContent =
          `${selectedService.name} • ${selectedService.duration_minutes || 30} د • ${formatPrice(selectedService)}`;
      }

      // Default date to today if empty
      if (!dateInput.value) {
        dateInput.value = localToday;
      }
      renderQuickDateChips();
      loadAvailableSlots();
      btnGoToStep3.disabled = !timeInput.value;
    } else if (stepNum === 3) {
      step3.hidden = false;
      stepIndicator1.classList.add("completed");
      stepLine1.classList.add("completed");
      stepIndicator2.classList.add("completed");
      stepLine2.classList.add("completed");
      stepIndicator3.classList.add("active");

      // Populate review card
      modal.querySelector("#reviewProviderName").textContent =
        selectedProvider?.business_name || "-";
      modal.querySelector("#reviewServiceName").textContent =
        selectedService?.name || "-";
      modal.querySelector("#reviewServiceDuration").textContent =
        `${selectedService?.duration_minutes || 30} دقيقة`;
      modal.querySelector("#reviewDateTime").textContent =
        `${formatArabicDate(dateInput.value)} — الساعة ${to12h(timeInput.value)}`;
      modal.querySelector("#reviewPrice").textContent =
        formatPrice(selectedService);

      // Hide deferred auth initially
      if (deferredAuthBox) deferredAuthBox.hidden = true;
      bookingStatus.textContent = "";
    }
  }

  // Stepper Header Click Navigation (allow going back)
  stepIndicator1.addEventListener("click", () => goToStep(1));
  stepIndicator2.addEventListener("click", () => {
    if (selectedService) goToStep(2);
  });

  btnBackToStep1.addEventListener("click", () => goToStep(1));
  freshaChangeServiceBtn.addEventListener("click", () => goToStep(1));
  btnGoToStep3.addEventListener("click", () => {
    if (!timeInput.value) {
      slotsStatus.textContent = "يرجى اختيار وقت محدد أولاً.";
      return;
    }
    goToStep(3);
  });
  btnBackToStep2.addEventListener("click", () => goToStep(2));

  function formatArabicDate(dateStr) {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("ar-YE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  }

  // Quick Date Chips
  function renderQuickDateChips() {
    quickDatesWrap.replaceChildren();

    const dates = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const val = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
      ].join("-");

      let label = "";
      if (i === 0) label = "اليوم";
      else if (i === 1) label = "غداً";
      else if (i === 2) label = "بعد غد";
      else {
        label = d.toLocaleDateString("ar-YE", { weekday: "short", day: "numeric", month: "short" });
      }

      dates.push({ label, val });
    }

    dates.forEach(({ label, val }) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `fresha-date-chip ${dateInput.value === val ? "active" : ""}`;
      chip.textContent = label;
      chip.addEventListener("click", () => {
        dateInput.value = val;
        dateInput.dispatchEvent(new Event("change"));
        quickDatesWrap.querySelectorAll(".fresha-date-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
      });
      quickDatesWrap.appendChild(chip);
    });
  }

  dateInput.addEventListener("change", () => {
    quickDatesWrap.querySelectorAll(".fresha-date-chip").forEach(c => c.classList.remove("active"));
    const matchingChip = Array.from(quickDatesWrap.children).find(c => {
      const d = new Date();
      return false; // let quick chips highlight if exact match
    });
    timeInput.value = "";
    btnGoToStep3.disabled = true;
    loadAvailableSlots();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Slots Fetching & Rendering (Step 2)
  // ──────────────────────────────────────────────────────────────────────────
  async function loadAvailableSlots() {
    if (!selectedService || !dateInput.value) return;

    const reqId = ++slotRequestId;
    slotsGrid.replaceChildren();
    slotsStatus.textContent = "جارٍ تحميل الأوقات المتاحة...";
    btnGoToStep3.disabled = true;

    try {
      const url = new URL(API.slots, window.location.origin);
      url.searchParams.set("service_id", String(selectedService.id));
      url.searchParams.set("date", dateInput.value);

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();

      if (reqId !== slotRequestId) return;

      if (!res.ok) {
        throw new Error(data.message || "تعذر تحميل الأوقات.");
      }

      const slots = Array.isArray(data.slots) ? data.slots : [];
      slotsGrid.replaceChildren();

      if (!slots.length) {
        slotsStatus.textContent = data.message || "لا توجد أوقات عمل محددة في هذا اليوم.";
        return;
      }

      const availableCount = slots.filter(s => s.available).length;
      if (availableCount === 0) {
        slotsStatus.textContent = "جميع أوقات هذا اليوم محجوزة، جرّب اختيار يوم آخر.";
      } else {
        slotsStatus.textContent = `يتوفر ${availableCount.toLocaleString("ar")} وقتاً متاحاً. اختر الوقت المناسب:`;
      }

      slots.forEach(slot => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = to12h(slot.start);
        btn.title = `${to12h(slot.start)} - ${to12h(slot.end)}`;
        btn.dataset.start = slot.start;

        if (!slot.available) {
          btn.disabled = true;
          btn.style.cssText =
            "background:#f1f1ec;color:#a9b0ab;border:1px solid #e8e8df;text-decoration:line-through;cursor:not-allowed;";
        } else {
          btn.style.cssText =
            "background:#fff;color:#123c32;border:1px solid #123c32;cursor:pointer;";

          btn.addEventListener("click", () => {
            timeInput.value = slot.start;
            slotsGrid.querySelectorAll("button").forEach(b => {
              if (!b.disabled) {
                b.style.background = "#fff";
                b.style.color = "#123c32";
                b.style.borderColor = "#123c32";
                b.style.boxShadow = "none";
              }
            });

            btn.style.background = "#123c32";
            btn.style.color = "#ffffff";
            btn.style.borderColor = "#d8bd7c";
            btn.style.boxShadow = "0 0 0 2px #d8bd7c";

            slotsStatus.textContent = `الوقت المختار: ${to12h(slot.start)} - ${to12h(slot.end)}`;
            btnGoToStep3.disabled = false;
          });
        }

        slotsGrid.appendChild(btn);
      });
    } catch (err) {
      if (reqId !== slotRequestId) return;
      slotsStatus.textContent = err.message || "تعذر تحميل الأوقات، حاول مجدداً.";
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Search & Results Rendering
  // ──────────────────────────────────────────────────────────────────────────
  let currentSort = "default";
  let searchRequestId = 0;

  function renderResults(items, query, locationQuery, errorMessage = "") {
    results.style.display = "block";
    results.replaceChildren();

    // Results Header
    const headerTitle = query
      ? `نتائج البحث عن: ${query}${locationQuery ? ` في ${locationQuery}` : ""}`
      : locationQuery
      ? `الأنشطة المتاحة في: ${locationQuery}`
      : "الأنشطة المتاحة في ميعاد";

    results.appendChild(element("h2", headerTitle, "font-size:24px;margin:0 0 8px;color:#123c32;font-weight:900"));
    results.appendChild(element(
      "p",
      errorMessage || `تم العثور على ${items.length.toLocaleString("ar")} نشاط مسجل يمكنك حجز مواعيدك لديهم فوراً.`,
      "color:#75817b;font-size:13px;margin:0 0 20px"
    ));

    if (errorMessage) {
      const retry = element("button", "إعادة المحاولة");
      retry.type = "button";
      retry.className = "btn btn-primary";
      retry.addEventListener("click", () => searchProviders(query, locationQuery));
      results.appendChild(retry);
      return;
    }

    // Sort control
    const sortBox = document.createElement("div");
    sortBox.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 24px";

    const sortLabel = element("label", "ترتيب الأنشطة:");
    sortLabel.htmlFor = "providerSort";
    sortLabel.style.cssText = "color:#123c32;font-weight:700;font-size:13px;";

    const sortSelect = document.createElement("select");
    sortSelect.id = "providerSort";
    sortSelect.className = "fresha-date-input-field";
    sortSelect.style.cssText = "width:auto;margin:0;padding:8px 12px;background:#fff;";

    const sortOptions = [
      ["default", "الترتيب الافتراضي"],
      ["rating", "الأعلى تقييماً ⭐"],
      ["popular", "الأكثر حجزاً 🔥"],
      ["most_reviewed", "الأكثر مراجعة 💬"]
    ];

    sortOptions.forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      sortSelect.appendChild(opt);
    });

    sortSelect.value = currentSort;
    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value;
      searchProviders(query, locationQuery);
    });

    sortBox.append(sortLabel, sortSelect);
    results.appendChild(sortBox);

    // Provider Cards Grid (Fresha Point 2)
    const grid = document.createElement("div");
    grid.className = "fresha-provider-grid";

    if (!items.length) {
      grid.appendChild(element(
        "p",
        "لم نجد أنشطة مطابقة لبحثك. جرّب البحث عن تصنيف آخر أو مدينة مختلفة.",
        "grid-column:1/-1;background:#fff;padding:26px;border-radius:16px;color:#75817b;text-align:center;border:1px solid #e9e8df;"
      ));
    }

    items.forEach((provider) => {
      const card = document.createElement("article");
      card.className = "fresha-provider-card";

      // 1. Cover Image or Elegant Placeholder
      const mediaWrap = document.createElement("div");
      mediaWrap.className = "fresha-card-media";

      const hasCover =
        typeof provider.image_url === "string" &&
        provider.image_url.trim().length > 0;

      if (hasCover) {
        const cover = document.createElement("img");
        cover.className = "fresha-card-cover";
        cover.src = provider.image_url;
        cover.alt = provider.business_name || "صورة النشاط";
        cover.loading = "lazy";
        mediaWrap.appendChild(cover);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "fresha-card-placeholder";
        const iconSpan = element("span", categoryIcons[provider.category] || "📍", "font-size:42px");
        placeholder.appendChild(iconSpan);
        mediaWrap.appendChild(placeholder);
      }

      // Category badge over image
      const catBadge = document.createElement("span");
      catBadge.className = "fresha-card-badge";
      catBadge.textContent = provider.category || "خدمات عامة";
      mediaWrap.appendChild(catBadge);
      card.appendChild(mediaWrap);

      // 2. Card Body
      const body = document.createElement("div");
      body.className = "fresha-card-body";

      const title = document.createElement("h3");
      title.className = "fresha-card-title";
      title.textContent = provider.business_name || "نشاط في ميعاد";
      body.appendChild(title);

      const locationEl = document.createElement("div");
      locationEl.className = "fresha-card-location";
      locationEl.innerHTML = `<span>📍</span> <span>${provider.city || "اليمن"}${provider.address ? ` • ${provider.address}` : ""}</span>`;
      body.appendChild(locationEl);

      // Rating stars & review count
      const ratingEl = document.createElement("div");
      ratingEl.className = "fresha-card-rating";
      const avgRating = Number(provider.average_rating || 0);
      const revCount = Number(provider.review_count || 0);

      if (revCount > 0) {
        ratingEl.innerHTML = `⭐ <span>${avgRating.toLocaleString("ar", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> <span class="review-count">(${revCount.toLocaleString("ar")} تقييم)</span>`;
      } else {
        ratingEl.innerHTML = `⭐ <span>جديد في ميعاد</span>`;
      }
      body.appendChild(ratingEl);

      // 3. Sample Services List on Card (up to 3 services with duration & price)
      const servicesPreviewBox = document.createElement("div");
      servicesPreviewBox.className = "fresha-card-services-preview";

      let previewServices = [];

      if (Array.isArray(provider.services_preview) && provider.services_preview.length > 0) {
        previewServices = provider.services_preview.slice(0, 3);
      } else if (provider.services && typeof provider.services === "string") {
        // Fallback: parse comma separated service names
        const names = provider.services.split("،").map(s => s.trim()).filter(Boolean).slice(0, 3);
        previewServices = names.map(name => ({
          name,
          duration_minutes: null,
          price: null,
          currency: "YER"
        }));
      }

      if (previewServices.length > 0) {
        previewServices.forEach(srv => {
          const row = document.createElement("div");
          row.className = "fresha-card-service-row";

          const nameSpan = document.createElement("span");
          nameSpan.className = "fresha-service-row-name";
          nameSpan.textContent = srv.name;
          row.appendChild(nameSpan);

          const metaSpan = document.createElement("span");
          metaSpan.className = "fresha-service-row-meta";

          const metaParts = [];
          if (srv.duration_minutes) metaParts.push(`${srv.duration_minutes} د`);
          if (srv.price != null) {
            metaParts.push(formatPrice(srv));
          }
          metaSpan.textContent = metaParts.length > 0 ? metaParts.join(" • ") : "متاح للحجز";

          row.appendChild(metaSpan);
          servicesPreviewBox.appendChild(row);
        });
      } else {
        const row = document.createElement("div");
        row.className = "fresha-card-service-row";
        row.innerHTML = `<span class="fresha-service-row-name">خدمات متعددة متاحة للحجز</span> <span class="fresha-service-row-meta">عرض الخدمات</span>`;
        servicesPreviewBox.appendChild(row);
      }

      body.appendChild(servicesPreviewBox);

      // 4. Card Footer: "احجز الآن" (Book Now) Button
      const footer = document.createElement("div");
      footer.className = "fresha-card-footer";

      const bookBtn = document.createElement("button");
      bookBtn.type = "button";
      bookBtn.className = "fresha-btn-book";
      bookBtn.innerHTML = `<span>احجز الآن</span> <span style="font-size:16px;">←</span>`;
      bookBtn.addEventListener("click", () => openProvider(provider));
      footer.appendChild(bookBtn);

      body.appendChild(footer);
      card.appendChild(body);
      grid.appendChild(card);
    });

    results.appendChild(grid);
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Instant Debounced Filtering
  let filterDebounceTimer = null;

  async function searchProviders(query = "", locationQuery = "") {
    const q = (query || "").trim();
    const loc = (locationQuery || "").trim();
    const requestId = ++searchRequestId;

    results.style.display = "block";
    results.replaceChildren(
      element("p", "جارٍ البحث عن الأنشطة والخدمات...", "padding:24px;color:#123c32;font-weight:700;")
    );

    try {
      const categoryFilters = {
        "العيادات الطبية": ["العيادات الطبية", "عيادة"],
        "عيادات الأسنان": ["عيادات الأسنان"],
        "الحلاقة الرجالية": ["الحلاقة الرجالية", "حلاقة"],
        "الصالونات والجمال": ["الصالونات والجمال", "صالون"],
        "الرياضة واللياقة": ["الرياضة واللياقة"],
        "التصوير والمناسبات": ["التصوير والمناسبات"],
        "الخدمات المهنية": ["الخدمات المهنية"],
        "خدمات أخرى": ["خدمات أخرى", "أخرى"]
      };

      const categories = categoryFilters[q];
      const url = new URL(API.providers, window.location.origin);

      if (categories) {
        url.searchParams.set("categories", JSON.stringify(categories));
      } else if (q) {
        url.searchParams.set("q", q);
      }

      if (loc) {
        url.searchParams.set("city", loc);
      }

      url.searchParams.set("sort", currentSort);

      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await response.json();

      if (requestId !== searchRequestId) return;

      if (!response.ok) {
        throw new Error(data.message || "تعذر إكمال البحث.");
      }

      const providers = data.providers || [];

      if (q || loc) {
        fetch(API.searchLog, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            search_term: q || loc,
            category: categories ? q : undefined,
            results_count: providers.length
          })
        }).catch(() => {});
      }

      renderResults(providers, q, loc);
    } catch (error) {
      if (requestId !== searchRequestId) return;
      console.error("Meead search error:", error);
      renderResults([], q, loc, error.message || "تعذر الاتصال بخدمة البحث.");
    }
  }

  // Trigger search with debounce
  function triggerInstantSearch() {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      searchProviders(searchInput.value, locationInput?.value || "");
    }, 280);
  }

  searchInput.addEventListener("input", triggerInstantSearch);
  locationInput?.addEventListener("input", triggerInstantSearch);

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(filterDebounceTimer);
    searchProviders(searchInput.value, locationInput?.value || "");
  });

  // Quick Tags Click
  document.querySelectorAll(".quick-tag-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query || btn.textContent.trim();
      searchInput.value = categorySearchTerms[q] || q;
      searchProviders(searchInput.value, locationInput?.value || "");
    });
  });

  // Category Cards Click in Explore Section
  document.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();
      const heading = card.querySelector("h3");
      if (!heading) return;

      const category = heading.textContent.trim();
      searchInput.value = categorySearchTerms[category] || category;
      searchProviders(searchInput.value, locationInput?.value || "");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Gallery Loader
  // ──────────────────────────────────────────────────────────────────────────
  async function loadGallery(provider) {
    try {
      const url = new URL(API.gallery, window.location.origin);
      url.searchParams.set("provider_id", String(provider.id));

      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await response.json();

      if (!response.ok || !Array.isArray(data.images) || !data.images.length) {
        return null;
      }

      const wrap = document.createElement("div");
      wrap.style.margin = "16px 0";
      wrap.appendChild(element("h4", "معرض صور وأعمال النشاط", "color:#123c32;font-size:14px;margin:0 0 10px;font-weight:800"));

      const grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px";

      data.images.forEach((imgObj) => {
        const link = document.createElement("a");
        link.href = imgObj.url;
        link.target = "_blank";
        link.rel = "noopener";

        const img = document.createElement("img");
        img.src = imgObj.url;
        img.alt = `صورة من أعمال ${provider.business_name || "النشاط"}`;
        img.loading = "lazy";
        img.style.cssText = "width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block;border:1px solid #e8e8df;";

        link.appendChild(img);
        grid.appendChild(link);
      });

      wrap.appendChild(grid);
      return wrap;
    } catch {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Open Provider & Services List in Modal (Point 3)
  // ──────────────────────────────────────────────────────────────────────────
  async function openProvider(provider, preselectServiceId = null) {
    selectedProvider = provider;
    activeServices = [];
    selectedService = null;

    modal.querySelector("#meeadBookingTitle").textContent = provider.business_name || "تفاصيل النشاط";
    modal.querySelector("#meeadBookingSubtitle").textContent =
      `${provider.category || "خدمات"} • 📍 ${provider.city || "اليمن"}`;

    detailsContent.replaceChildren(element("p", "جارٍ تحميل تفاصيل النشاط والخدمات المتاحة..."));
    servicesListWrap.replaceChildren();
    goToStep(1);
    openModal();

    try {
      const url = new URL(API.services, window.location.origin);
      url.searchParams.set("providerId", String(provider.id));

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "تعذر تحميل الخدمات.");
      }

      activeServices = Array.isArray(data.services) ? data.services : [];

      // Render Provider Top Info & Direct Contact Actions
      detailsContent.replaceChildren();

      if (provider.description) {
        detailsContent.appendChild(element("p", provider.description, "font-size:13px;color:#52645b;line-height:1.7;margin:0 0 12px;"));
      }

      // Actions bar (WhatsApp, Call, Share)
      const actionsBar = document.createElement("div");
      actionsBar.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px;";

      // Share Link
      const shareBtn = document.createElement("button");
      shareBtn.type = "button";
      shareBtn.style.cssText =
        "background:#f0eee4;color:#123c32;border:1px solid #d5ceba;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:'Cairo';";
      shareBtn.innerHTML = "<span>🔗</span> مشاركة رابط النشاط";
      shareBtn.addEventListener("click", () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?provider=${provider.id}`;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            shareBtn.textContent = "✓ تم نسخ الرابط!";
            setTimeout(() => { shareBtn.innerHTML = "<span>🔗</span> مشاركة رابط النشاط"; }, 2500);
          }).catch(() => prompt("انسخ رابط الحجز المباشر:", shareUrl));
        } else {
          prompt("انسخ رابط الحجز المباشر:", shareUrl);
        }
      });
      actionsBar.appendChild(shareBtn);

      if (provider.phone) {
        const cleanPhone = String(provider.phone).replace(/\D/g, "");
        const waBtn = document.createElement("a");
        waBtn.href = `https://wa.me/967${cleanPhone}?text=${encodeURIComponent(`مرحباً ${provider.business_name}، أود الاستفسار عن حجز موعد عبر منصة ميعاد.`)}`;
        waBtn.target = "_blank";
        waBtn.rel = "noopener noreferrer";
        waBtn.style.cssText =
          "background:#25d366;color:#fff;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;";
        waBtn.innerHTML = "<span>💬</span> تواصل واتساب";
        actionsBar.appendChild(waBtn);

        const callBtn = document.createElement("a");
        callBtn.href = `tel:${provider.phone}`;
        callBtn.style.cssText =
          "background:#123c32;color:#fff;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;";
        callBtn.innerHTML = "<span>📞</span> اتصال";
        actionsBar.appendChild(callBtn);
      }
      detailsContent.appendChild(actionsBar);

      // Gallery preview
      const gallery = await loadGallery(provider);
      if (selectedProvider === provider && gallery) {
        detailsContent.appendChild(gallery);
      }

      // Render Services List (Fresha Point 3)
      servicesListWrap.replaceChildren();
      servicesListWrap.appendChild(element(
        "h3",
        "الخدمات والأسعار المتاحة",
        "font-size:16px;font-weight:800;color:#123c32;margin:0 0 12px;display:flex;align-items:center;gap:6px;"
      ));

      if (!activeServices.length) {
        servicesListWrap.appendChild(element("p", "لم يضف هذا النشاط خدمات متاحة للحجز حالياً.", "color:#75817b;"));
        return;
      }

      // Populate serviceSelect hidden options
      serviceSelect.replaceChildren();

      activeServices.forEach((service) => {
        // Add to hidden select for form submission
        const opt = document.createElement("option");
        opt.value = String(service.id);
        opt.textContent = `${service.name} — ${formatPrice(service)}`;
        serviceSelect.appendChild(opt);

        // Render Service Card with direct "احجز هذه الخدمة" button
        const card = document.createElement("div");
        card.className = "fresha-service-card";

        const info = document.createElement("div");
        info.className = "fresha-service-info";

        const nameEl = document.createElement("h4");
        nameEl.className = "fresha-service-name";
        nameEl.textContent = service.name;
        info.appendChild(nameEl);

        if (service.description) {
          const descEl = document.createElement("p");
          descEl.className = "fresha-service-desc";
          descEl.textContent = service.description;
          info.appendChild(descEl);
        }

        const metaTags = document.createElement("div");
        metaTags.className = "fresha-service-meta-tags";

        const durationSpan = document.createElement("span");
        durationSpan.className = "fresha-service-duration";
        durationSpan.innerHTML = `⏱️ ${service.duration_minutes || 30} دقيقة`;
        metaTags.appendChild(durationSpan);

        const priceSpan = document.createElement("span");
        priceSpan.className = "fresha-service-price";
        priceSpan.textContent = formatPrice(service);
        metaTags.appendChild(priceSpan);

        info.appendChild(metaTags);
        card.appendChild(info);

        // Direct "احجز هذه الخدمة" Button
        const bookBtn = document.createElement("button");
        bookBtn.type = "button";
        bookBtn.className = "fresha-btn-book-service";
        bookBtn.textContent = "احجز هذه الخدمة ←";
        bookBtn.addEventListener("click", () => {
          selectServiceAndProceed(service);
        });

        card.appendChild(bookBtn);
        servicesListWrap.appendChild(card);
      });

      // Prepare Yemen Payment Options (Step 3)
      setupPaymentMethods(provider);

      // If preselectServiceId was requested, jump to step 2
      if (preselectServiceId) {
        const found = activeServices.find(s => s.id === Number(preselectServiceId));
        if (found) selectServiceAndProceed(found);
      }
    } catch (err) {
      detailsContent.replaceChildren(element("p", err.message || "تعذر تحميل تفاصيل النشاط.", "color:#a33c36;"));
    }
  }

  function selectServiceAndProceed(service) {
    selectedService = service;
    serviceSelect.value = String(service.id);
    timeInput.value = "";
    goToStep(2);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Yemen Payment Methods Configuration (Step 3)
  // ──────────────────────────────────────────────────────────────────────────
  function setupPaymentMethods(provider) {
    const paySelect = modal.querySelector("#meeadPaymentMethod");
    const payBox = modal.querySelector("#meeadPaymentBox");
    const payInputs = modal.querySelector("#meeadPaymentInputs");
    const pInfo = provider.payment_info || {};

    if (!paySelect || !payBox || !payInputs) return;

    paySelect.replaceChildren();
    const payOptions = [];

    if (pInfo.kuraimi) payOptions.push({ val: "kuraimi", text: "🏦 بنك الكريمي (حاسب / إيداع)", desc: `حساب الكريمي المعتمد: <strong style="color:#123c32">${pInfo.kuraimi}</strong>` });
    if (pInfo.jawali) payOptions.push({ val: "jawali", text: "📱 محفظة جوالي (Jawali)", desc: `رقم محفظة جوالي: <strong style="color:#123c32">${pInfo.jawali}</strong>` });
    if (pInfo.onecash) payOptions.push({ val: "onecash", text: "📱 محفظة ون كاش (OneCash)", desc: `رقم محفظة ون كاش: <strong style="color:#123c32">${pInfo.onecash}</strong>` });
    if (pInfo.floosak) payOptions.push({ val: "floosak", text: "📱 محفظة فلوسك (Floosak)", desc: `رقم محفظة فلوسك: <strong style="color:#123c32">${pInfo.floosak}</strong>` });
    if (pInfo.transfer) payOptions.push({ val: "transfer", text: "🏢 حوالة صرافة (النجم / العمقي / الامتياز)", desc: `بيانات الحوالة: <strong style="color:#123c32">${pInfo.transfer}</strong>` });

    if (payOptions.length === 0) {
      payOptions.push(
        { val: "kuraimi", text: "🏦 بنك الكريمي (حاسب)", desc: "حساب الكريمي: تواصل مع المنشأة برقم الهاتف أو واتساب لإرسال رقم الحساب." },
        { val: "jawali", text: "📱 محفظة جوالي / ون كاش", desc: `رقم المحفظة للتواصل: <strong>${provider.phone || 'موضح في بيانات النشاط'}</strong>` },
        { val: "transfer", text: "🏢 حوالة صرافة محلية", desc: `حوالة باسم: <strong>${provider.business_name}</strong> - ${provider.city || 'اليمن'}` }
      );
    }

    if (pInfo.cash_enabled !== false) {
      payOptions.push({ val: "cash", text: "💵 الدفع نقداً عند الحضور للنشاط", desc: "سيتم سداد قيمة الخدمة نقداً عند وصولك في موعدك المحدد لدى النشاط." });
    }

    payOptions.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.val;
      o.textContent = opt.text;
      paySelect.appendChild(o);
    });

    const updatePayDisplay = () => {
      const selected = payOptions.find(o => o.val === paySelect.value) || payOptions[0];
      if (selected) {
        payBox.innerHTML = selected.desc;
        payInputs.style.display = selected.val === "cash" ? "none" : "block";
      }
    };

    paySelect.onchange = updatePayDisplay;
    updatePayDisplay();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Booking Submission & Deferred Authentication (Points 4 & 5)
  // ──────────────────────────────────────────────────────────────────────────
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    bookingStatus.textContent = "";

    if (!selectedProvider || !selectedService) {
      bookingStatus.textContent = "يرجى اختيار خدمة أولاً.";
      goToStep(1);
      return;
    }

    const appointmentDate = dateInput.value;
    const startTime = timeInput.value;

    if (!appointmentDate || appointmentDate < localToday || !startTime) {
      bookingStatus.textContent = "يرجى تحديد تاريخ ووقت متاحين للحجز.";
      goToStep(2);
      return;
    }

    const paySelect = modal.querySelector("#meeadPaymentMethod");
    const payRefInput = modal.querySelector("#meeadPaymentRef");
    const senderNameInput = modal.querySelector("#meeadSenderName");
    const paymentMethod = paySelect?.value || "cash";
    const paymentRef = payRefInput?.value.trim() || "";
    const senderName = senderNameInput?.value.trim() || "";

    if (paymentMethod !== "cash" && (!paymentRef || !senderName)) {
      bookingStatus.textContent = "يرجى إدخال رقم العملية/الحوالة واسم المحول لتأكيد حجزك.";
      return;
    }

    // Deferred Authentication Check (Fresha Point 5)
    const auth = window.MeeadAuth;
    if (!auth || !auth.isLoggedIn() || !auth.getToken()) {
      showDeferredAuthPrompt();
      return;
    }

    // Authenticated: Proceed with booking
    await executeBookingSubmission();
  });

  function showDeferredAuthPrompt() {
    deferredAuthBox.hidden = false;
    deferredAuthStatus.textContent = "";
    deferredAuthBox.scrollIntoView({ behavior: "smooth", block: "center" });
    modal.querySelector("#deferredLoginEmail").focus();
  }

  // Deferred Auth Tabs toggle
  deferredTabLogin.addEventListener("click", () => {
    deferredTabLogin.classList.add("active");
    deferredTabRegister.classList.remove("active");
    deferredLoginForm.hidden = false;
    deferredRegisterForm.hidden = true;
    deferredVerifyForm.hidden = true;
    deferredAuthStatus.textContent = "";
  });

  deferredTabRegister.addEventListener("click", () => {
    deferredTabRegister.classList.add("active");
    deferredTabLogin.classList.remove("active");
    deferredLoginForm.hidden = true;
    deferredRegisterForm.hidden = false;
    deferredVerifyForm.hidden = true;
    deferredAuthStatus.textContent = "";
  });

  // Quick Inline Login
  btnDeferredLoginSubmit.addEventListener("click", async () => {
    const auth = window.MeeadAuth;
    const email = modal.querySelector("#deferredLoginEmail").value.trim();
    const pass = modal.querySelector("#deferredLoginPassword").value;

    if (!email || !pass) {
      deferredAuthStatus.textContent = "يرجى إدخال البريد الإلكتروني وكلمة المرور.";
      return;
    }

    btnDeferredLoginSubmit.disabled = true;
    btnDeferredLoginSubmit.textContent = "جارٍ الدخول وتأكيد الحجز...";
    deferredAuthStatus.textContent = "";

    try {
      await auth.login(email, pass);
      window.dispatchEvent(new Event("meead:auth-change"));
      deferredAuthBox.hidden = true;
      await executeBookingSubmission();
    } catch (err) {
      if (err.code === "EMAIL_NOT_VERIFIED") {
        pendingVerifyEmail = err.email || email;
        try { await auth.resendCode(pendingVerifyEmail); } catch (_) {}
        deferredLoginForm.hidden = true;
        deferredRegisterForm.hidden = true;
        deferredVerifyForm.hidden = false;
        deferredAuthStatus.textContent = "يرجى إدخال كود التحقق المرسل إلى بريدك للمتابعة.";
      } else {
        deferredAuthStatus.textContent = err.message || "تعذر تسجيل الدخول. تأكد من صحة البيانات.";
      }
    } finally {
      btnDeferredLoginSubmit.disabled = false;
      btnDeferredLoginSubmit.textContent = "دخول وتأكيد الحجز فوراً";
    }
  });

  // Quick Inline Register
  btnDeferredRegisterSubmit.addEventListener("click", async () => {
    const auth = window.MeeadAuth;
    const name = modal.querySelector("#deferredRegName").value.trim();
    const email = modal.querySelector("#deferredRegEmail").value.trim();
    const phone = modal.querySelector("#deferredRegPhone").value.trim();
    const password = modal.querySelector("#deferredRegPassword").value;

    if (!name || !email || !phone || !password) {
      deferredAuthStatus.textContent = "يرجى ملء جميع الحقول المطلوبة.";
      return;
    }

    if (!/^7[0-9]{8}$/.test(phone)) {
      deferredAuthStatus.textContent = "رقم الهاتف اليمني يجب أن يتكون من 9 أرقام ويبدأ بالرقم 7.";
      return;
    }

    if (password.length < 8) {
      deferredAuthStatus.textContent = "كلمة المرور يجب أن لا تقل عن 8 أحرف.";
      return;
    }

    btnDeferredRegisterSubmit.disabled = true;
    btnDeferredRegisterSubmit.textContent = "جارٍ إنشاء الحساب...";
    deferredAuthStatus.textContent = "";

    try {
      await auth.register({ name, email, phone, password, role: "customer" });
      pendingVerifyEmail = email;
      deferredLoginForm.hidden = true;
      deferredRegisterForm.hidden = true;
      deferredVerifyForm.hidden = false;
      deferredAuthStatus.textContent = "تم إرسال كود التحقق إلى بريدك. أدخل الرمز أدناه لتأكيد حجزك:";
      modal.querySelector("#deferredVerifyCode").focus();
    } catch (err) {
      deferredAuthStatus.textContent = err.message || "تعذر إنشاء الحساب. حاول مجدداً.";
    } finally {
      btnDeferredRegisterSubmit.disabled = false;
      btnDeferredRegisterSubmit.textContent = "إنشاء حساب وتأكيد الحجز";
    }
  });

  // Quick Inline Verify
  btnDeferredVerifySubmit.addEventListener("click", async () => {
    const auth = window.MeeadAuth;
    const code = modal.querySelector("#deferredVerifyCode").value.trim();

    if (!code || code.length !== 6) {
      deferredAuthStatus.textContent = "أدخل كود التحقق المكون من 6 أرقام.";
      return;
    }

    btnDeferredVerifySubmit.disabled = true;
    btnDeferredVerifySubmit.textContent = "جارٍ تأكيد الكود...";
    deferredAuthStatus.textContent = "";

    try {
      await auth.verifyEmail(pendingVerifyEmail, code);
      window.dispatchEvent(new Event("meead:auth-change"));
      deferredAuthBox.hidden = true;
      await executeBookingSubmission();
    } catch (err) {
      deferredAuthStatus.textContent = err.message || "كود التحقق غير صحيح أو انتهت صلاحيته.";
    } finally {
      btnDeferredVerifySubmit.disabled = false;
      btnDeferredVerifySubmit.textContent = "تأكيد الكود وإكمال الحجز";
    }
  });

  // Actual Booking Network Call
  async function executeBookingSubmission() {
    const auth = window.MeeadAuth;
    const submitBtn = modal.querySelector("#meeadSubmitBooking");
    const paySelect = modal.querySelector("#meeadPaymentMethod");
    const payRefInput = modal.querySelector("#meeadPaymentRef");
    const senderNameInput = modal.querySelector("#meeadSenderName");
    const notesInput = modal.querySelector("#meeadNotes");

    const paymentMethod = paySelect?.value || "cash";
    const paymentRef = payRefInput?.value.trim() || "";
    const senderName = senderNameInput?.value.trim() || "";
    const userNotes = notesInput?.value.trim() || "";

    const payLabels = {
      kuraimi: "بنك الكريمي",
      jawali: "محفظة جوالي",
      onecash: "محفظة ون كاش",
      floosak: "محفظة فلوسك",
      transfer: "حوالة صرافة",
      cash: "نقداً عند الحضور"
    };

    const finalNotes = [
      `[طريقة الدفع: ${payLabels[paymentMethod] || paymentMethod}]`,
      paymentRef ? `[رقم العملية/الحوالة: ${paymentRef}]` : "",
      senderName ? `[اسم المحوّل: ${senderName}]` : "",
      userNotes ? `ملاحظات: ${userNotes}` : ""
    ].filter(Boolean).join("\n");

    submitBtn.disabled = true;
    submitBtn.textContent = "جارٍ إرسال طلب الحجز...";
    bookingStatus.textContent = "";

    try {
      const response = await fetch(API.bookings, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          provider_id: Number(selectedProvider.id),
          service_id: Number(selectedService.id),
          appointment_date: dateInput.value,
          start_time: timeInput.value,
          customer_notes: finalNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "تعذر إرسال الحجز.");
      }

      // Show Success Confirmation View
      step1.hidden = true;
      step2.hidden = true;
      step3.hidden = true;
      successScreen.hidden = false;

      modal.querySelector("#freshaSuccessDetails").innerHTML = `
        <div style="font-size:14px;font-weight:800;color:#123c32;margin-bottom:8px;">تفاصيل الموعد المحجوز:</div>
        <div style="font-size:13px;line-height:1.9;color:#2b3a33;">
          <div>🏢 <strong>النشاط:</strong> ${selectedProvider.business_name}</div>
          <div>✂️ <strong>الخدمة:</strong> ${selectedService.name} (${formatPrice(selectedService)})</div>
          <div>📅 <strong>التاريخ:</strong> ${formatArabicDate(dateInput.value)}</div>
          <div>⏰ <strong>الوقت:</strong> الساعة ${to12h(timeInput.value)}</div>
          <div>💳 <strong>الدفع:</strong> ${payLabels[paymentMethod] || paymentMethod}</div>
        </div>
      `;

      bookingForm.reset();
    } catch (error) {
      bookingStatus.textContent = error.message || "تعذر إرسال الحجز. حاول مجدداً.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `تأكيد طلب الحجز <span>✓</span>`;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Deep Link Provider Opening (?provider=ID or ?p=ID or ?book=ID)
  // ──────────────────────────────────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const directId = urlParams.get("provider") || urlParams.get("p") || urlParams.get("book");
  const directServiceId = urlParams.get("service") || urlParams.get("service_id");

  if (directId) {
    fetch(`${API.providers}?id=${encodeURIComponent(directId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.providers && data.providers.length > 0) {
          openProvider(data.providers[0], directServiceId);
        }
      })
      .catch((err) => console.error("Error opening direct provider:", err));
  }
});
