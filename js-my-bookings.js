
/* Meead - Customer Bookings Page */
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const API = {
    bookings: "/.netlify/functions/bookings",
    reviews: "/.netlify/functions/reviews"
  };

  const statusElement = document.getElementById("myBookingsStatus");
  const listElement = document.getElementById("myBookingsList");
  const refreshButton = document.getElementById("refreshMyBookings");
  const emptyAction = document.getElementById("bookingsEmptyAction");
  const customerName = document.getElementById("bookingsCustomerName");

  if (!statusElement || !listElement || !refreshButton || !emptyAction) {
    console.error("Meead: عناصر صفحة الحجوزات غير مكتملة.");
    return;
  }

  const auth = window.MeeadAuth;

  function goToLogin() {
    window.location.replace(
      "index.html?auth=required&return=my-bookings.html"
    );
  }

  if (!auth || !auth.isLoggedIn() || !auth.getToken()) {
    goToLogin();
    return;
  }

  const user = auth.getUser();
  const role = String(user?.role || "").toLowerCase();

  if (role !== "customer") {
    if (role === "provider") {
      window.location.replace("provider-dashboard.html");
    } else {
      goToLogin();
    }
    return;
  }

  let loading = false;

  function createElement(tag, text = "", className = "") {
    const node = document.createElement(tag);

    if (text !== "") node.textContent = text;
    if (className) node.className = className;

    return node;
  }

  function formatPrice(amount, currency) {
    const value = Number(amount);

    if (!Number.isFinite(value)) return "السعر غير محدد";

    const currencies = {
      YER: "ر.ي",
      SAR: "ر.س",
      USD: "$"
    };

    return `${value.toLocaleString("ar")} ${currencies[currency] || currency || ""}`;
  }

  function formatDate(date) {
    if (!date) return "التاريخ غير محدد";

    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString("ar", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function statusDetails(status) {
    const statuses = {
      pending: { label: "بانتظار التأكيد", className: "pending" },
      confirmed: { label: "تم تأكيد الحجز", className: "confirmed" },
      cancelled: { label: "تم إلغاء الحجز", className: "cancelled" },
      completed: { label: "مكتمل", className: "completed" }
    };

    return statuses[status] || {
      label: status || "غير محدد",
      className: "unknown"
    };
  }

  function getCustomerName() {
    const currentUser = auth.getUser();

    return (
      currentUser?.name ||
      currentUser?.full_name ||
      currentUser?.username ||
      currentUser?.email ||
      "حجوزاتك في ميعاد"
    );
  }

  function showMessage(message, type = "info") {
    statusElement.textContent = message;
    statusElement.className = `my-bookings-status ${type}`;
    statusElement.hidden = false;
  }

  function clearMessage() {
    statusElement.textContent = "";
    statusElement.className = "my-bookings-status";
    statusElement.hidden = true;
  }

  function createInfoRow(label, value) {
    const row = createElement("div", "", "booking-info-row");

    row.append(
      createElement("span", label, "booking-info-label"),
      createElement("strong", value || "غير محدد", "booking-info-value")
    );

    return row;
  }

  function createReviewForm(booking) {
    const wrapper = createElement("div", "", "booking-review-box");

    wrapper.append(
      createElement("h4", "كيف كانت تجربتك؟"),
      createElement("p", "شاركنا رأيك في الخدمة التي حصلت عليها.")
    );

    const form = document.createElement("form");
    form.className = "booking-review-form";

    const ratingLabel = createElement("label", "تقييمك");
    const rating = document.createElement("select");

    rating.id = `reviewRating-${booking.id}`;
    rating.name = "rating";
    rating.required = true;
    ratingLabel.htmlFor = rating.id;

    [
      ["", "اختر عدد النجوم"],
      ["5", "★★★★★ ممتاز"],
      ["4", "★★★★☆ جيد جدًا"],
      ["3", "★★★☆☆ جيد"],
      ["2", "★★☆☆☆ مقبول"],
      ["1", "★☆☆☆☆ يحتاج إلى تحسين"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      rating.appendChild(option);
    });

    const commentLabel = createElement("label", "تعليقك (اختياري)");
    const comment = document.createElement("textarea");

    comment.name = "comment";
    comment.rows = 3;
    comment.maxLength = 1000;
    comment.placeholder = "اكتب تجربتك مع النشاط...";

    const message = createElement("p", "", "booking-review-message");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");

    const submit = createElement("button", "إرسال التقييم");
    submit.type = "submit";
    submit.className = "booking-review-submit";

    form.append(
      ratingLabel,
      rating,
      commentLabel,
      comment,
      message,
      submit
    );

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!rating.value) {
        message.textContent = "اختر عدد النجوم أولًا.";
        return;
      }

      submit.disabled = true;
      submit.textContent = "جارٍ إرسال التقييم...";
      message.textContent = "";

      try {
        const response = await fetch(API.reviews, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify({
            booking_id: Number(booking.id),
            rating: Number(rating.value),
            comment: comment.value.trim()
          })
        });

        const data = await response.json();

        if (response.status === 401 || response.status === 403) {
          auth.logout();
          goToLogin();
          return;
        }

        if (!response.ok) {
          throw new Error(data.message || "تعذر إرسال التقييم.");
        }

        message.textContent = data.message || "شكرًا لك! تم إرسال تقييمك.";
        message.classList.add("success");

        await loadBookings();
      } catch (error) {
        message.textContent =
          error.message || "حدث خطأ أثناء إرسال التقييم.";
      } finally {
        submit.disabled = false;
        submit.textContent = "إرسال التقييم";
      }
    });

    wrapper.appendChild(form);
    return wrapper;
  }

  function renderBooking(booking) {
    const card = createElement("article", "", "customer-booking-card");
    const header = createElement("div", "", "customer-booking-card-header");
    const titleArea = createElement("div", "", "booking-title-area");

    titleArea.append(
      createElement(
        "h3",
        booking.business_name || "نشاط في ميعاد",
        "booking-business-name"
      ),
      createElement(
        "p",
        booking.category || "خدمات متنوعة",
        "booking-business-category"
      )
    );

    const status = statusDetails(booking.status);
    const badge = createElement(
      "span",
      status.label,
      `booking-status-badge ${status.className}`
    );

    header.append(titleArea, badge);
    card.appendChild(header);

    const details = createElement("div", "", "booking-info-grid");

    details.append(
      createInfoRow("الخدمة", booking.service_name),
      createInfoRow("التاريخ", formatDate(booking.appointment_date)),
      createInfoRow("الوقت", booking.start_time),
      createInfoRow("السعر", formatPrice(booking.price, booking.currency))
    );

    card.appendChild(details);

    if (booking.address || booking.city) {
      card.appendChild(
        createElement(
          "p",
          [booking.city, booking.address].filter(Boolean).join(" - "),
          "booking-location"
        )
      );
    }

    if (booking.customer_notes && booking.customer_notes.includes("[طريقة الدفع:")) {
      const payCard = createElement("div", "", "booking-payment-summary");
      payCard.style.cssText = "background:#fcfbf7;border:1px solid #d8bd7c;border-radius:10px;padding:12px;margin:12px 0;font-size:13px;";

      const isPending = booking.status === "pending";
      const payHeader = createElement("div", "", "payment-summary-header");
      payHeader.style.cssText = "font-weight:bold;color:#123c32;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;";
      payHeader.innerHTML = `<span>💳 بيانات وسداد الحجز</span><span style="font-size:12px;font-weight:bold;color:${isPending ? '#a33c36' : '#28613f'};">${isPending ? '⏳ بانتظار مراجعة وتأكيد الحوالة' : '✅ تم التحقق وتأكيد الحجز'}</span>`;

      const payBody = createElement("div", booking.customer_notes, "payment-summary-body");
      payBody.style.cssText = "white-space:pre-line;color:#333;line-height:1.6;";

      payCard.append(payHeader, payBody);
      card.appendChild(payCard);
    } else if (booking.customer_notes) {
      const notes = createElement("div", "", "booking-customer-notes");
      notes.append(
        createElement("strong", "ملاحظاتك"),
        createElement("p", booking.customer_notes)
      );
      card.appendChild(notes);
    }

    // شريط الإجراءات: التواصل مع النشاط + زر إلغاء الموعد
    const actionsRow = createElement("div", "", "booking-card-actions");
    actionsRow.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #e9e8df;align-items:center;";

    if (booking.provider_phone) {
      const cleanPhone = String(booking.provider_phone).replace(/\D/g, "");
      const waLink = document.createElement("a");
      waLink.href = `https://wa.me/967${cleanPhone}?text=${encodeURIComponent(`مرحباً ${booking.business_name}، أنا العميل بخصوص موعدي المحجوز بتاريخ ${booking.appointment_date} (${booking.service_name}).`)}`;
      waLink.target = "_blank";
      waLink.rel = "noopener noreferrer";
      waLink.style.cssText = "background:#25d366;color:#fff;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;";
      waLink.innerHTML = "<span>💬</span> مراسلة واتساب";
      actionsRow.appendChild(waLink);

      const callLink = document.createElement("a");
      callLink.href = `tel:${booking.provider_phone}`;
      callLink.style.cssText = "background:#f0eee4;color:#123c32;border:1px solid #d5ceba;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;";
      callLink.innerHTML = "<span>📞</span> اتصال";
      actionsRow.appendChild(callLink);
    }

    // زر إلغاء الموعد للعميل للحجوزات المعلقة أو المؤكدة
    if (["pending", "confirmed"].includes(booking.status)) {
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn-cancel-booking";
      cancelBtn.style.cssText = "background:#fff;color:#a33c36;border:1px solid #a33c3650;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;margin-inline-start:auto;";
      cancelBtn.textContent = "إلغاء الموعد";

      cancelBtn.addEventListener("click", async () => {
        if (!confirm(`هل أنت متأكد من رغبتك في إلغاء موعدك لدى "${booking.business_name}"؟`)) {
          return;
        }

        cancelBtn.disabled = true;
        cancelBtn.textContent = "جارٍ الإلغاء...";

        try {
          const res = await fetch(`${API.bookings}?action=cancel`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.getToken()}`
            },
            body: JSON.stringify({ booking_id: booking.id })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "تعذر إلغاء الموعد.");

          alert("تم إلغاء الموعد بنجاح.");
          await loadBookings();
        } catch (err) {
          alert(err.message || "حدث خطأ أثناء محاولة إلغاء الموعد.");
          cancelBtn.disabled = false;
          cancelBtn.textContent = "إلغاء الموعد";
        }
      });

      actionsRow.appendChild(cancelBtn);
    }

    if (actionsRow.children.length > 0) {
      card.appendChild(actionsRow);
    }

    if (booking.status === "completed") {
      if (booking.has_review) {
        card.appendChild(
          createElement(
            "p",
            "✓ سبق أن أرسلت تقييمك لهذا الحجز. شكرًا لمشاركتك!",
            "booking-reviewed-message"
          )
        );
      } else {
        card.appendChild(createReviewForm(booking));
      }
    }

    return card;
  }

  function renderBookings(bookings) {
    listElement.replaceChildren();

    if (!bookings.length) {
      showMessage("لا توجد حجوزات حتى الآن.");
      emptyAction.hidden = false;
      return;
    }

    clearMessage();
    emptyAction.hidden = true;

    bookings.forEach((booking) => {
      listElement.appendChild(renderBooking(booking));
    });
  }

  async function loadBookings() {
    if (loading) return;

    loading = true;
    refreshButton.disabled = true;
    refreshButton.textContent = "جارٍ التحديث...";
    showMessage("جارٍ تحميل حجوزاتك...");

    try {
      const response = await fetch(API.bookings, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        auth.logout();
        goToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "تعذر تحميل الحجوزات.");
      }

      const bookings = Array.isArray(data.bookings)
        ? data.bookings
        : [];

      renderBookings(bookings);
    } catch (error) {
      console.error("Meead bookings error:", error);
      listElement.replaceChildren();
      emptyAction.hidden = true;

      showMessage(
        error.message || "تعذر الاتصال بالخادم. حاول مجددًا.",
        "error"
      );
    } finally {
      loading = false;
      refreshButton.disabled = false;
      refreshButton.textContent = "↻ تحديث";
    }
  }

  if (customerName) {
    customerName.textContent = getCustomerName();
  }

  refreshButton.addEventListener("click", loadBookings);

  window.addEventListener("meead:auth-change", () => {
    const updatedUser = auth.getUser();
    const updatedRole = String(updatedUser?.role || "").toLowerCase();

    if (!auth.isLoggedIn() || !auth.getToken()) {
      goToLogin();
      return;
    }

    if (updatedRole !== "customer") {
      window.location.replace(
        updatedRole === "provider"
          ? "provider-dashboard.html"
          : "index.html"
      );
      return;
    }

    if (customerName) {
      customerName.textContent = getCustomerName();
    }

    loadBookings();
  });

  // ── إدارة نافذة إعدادات الملف الشخصي ──
  const editProfileBtn = document.getElementById("editProfileBtn");
  const profileModal = document.getElementById("profileModal");
  const closeProfileModal = document.getElementById("closeProfileModal");
  const updateProfileForm = document.getElementById("updateProfileForm");
  const changePasswordForm = document.getElementById("changePasswordForm");
  const profName = document.getElementById("profName");
  const profPhone = document.getElementById("profPhone");
  const profStatus = document.getElementById("profStatus");
  const profSubmitBtn = document.getElementById("profSubmitBtn");
  const curPass = document.getElementById("curPass");
  const newPass = document.getElementById("newPass");
  const passStatus = document.getElementById("passStatus");
  const passSubmitBtn = document.getElementById("passSubmitBtn");

  if (editProfileBtn && profileModal) {
    function openProfile() {
      const u = auth.getUser();
      if (profName) profName.value = u?.name || "";
      if (profPhone) profPhone.value = u?.phone || "";
      if (profStatus) profStatus.textContent = "";
      if (passStatus) passStatus.textContent = "";
      profileModal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }

    function closeProfile() {
      profileModal.style.display = "none";
      document.body.style.overflow = "";
    }

    editProfileBtn.addEventListener("click", openProfile);
    closeProfileModal?.addEventListener("click", closeProfile);
    profileModal.addEventListener("click", (e) => {
      if (e.target === profileModal) closeProfile();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && profileModal.style.display === "flex") {
        closeProfile();
      }
    });

    updateProfileForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = profName.value.trim();
      const phone = profPhone.value.trim();
      profSubmitBtn.disabled = true;
      profSubmitBtn.textContent = "جارٍ الحفظ...";
      profStatus.textContent = "";

      try {
        await auth.updateProfile(name, phone);
        profStatus.style.color = "#17633e";
        profStatus.textContent = "تم تحديث البيانات بنجاح!";
        if (customerName) customerName.textContent = getCustomerName();
      } catch (err) {
        profStatus.style.color = "#a32626";
        profStatus.textContent = err.message || "تعذر حفظ البيانات.";
      } finally {
        profSubmitBtn.disabled = false;
        profSubmitBtn.textContent = "حفظ البيانات";
      }
    });

    changePasswordForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentPassword = curPass.value;
      const newPassword = newPass.value;
      passSubmitBtn.disabled = true;
      passSubmitBtn.textContent = "جارٍ التحديث...";
      passStatus.textContent = "";

      try {
        const res = await auth.changePassword(currentPassword, newPassword);
        passStatus.style.color = "#17633e";
        passStatus.textContent = res.message || "تم تغيير كلمة المرور بنجاح!";
        changePasswordForm.reset();
      } catch (err) {
        passStatus.style.color = "#a32626";
        passStatus.textContent = err.message || "تعذر تغيير كلمة المرور.";
      } finally {
        passSubmitBtn.disabled = false;
        passSubmitBtn.textContent = "تحديث كلمة المرور";
      }
    });
  }

  await loadBookings();
});
