
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

    if (booking.customer_notes) {
      const notes = createElement("div", "", "booking-customer-notes");
      notes.append(
        createElement("strong", "ملاحظاتك"),
        createElement("p", booking.customer_notes)
      );
      card.appendChild(notes);
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

  await loadBookings();
});
