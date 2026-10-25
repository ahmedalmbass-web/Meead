
/* Meead - Customer Bookings and Reviews */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const bookingsButton = document.getElementById("myBookingsBtn");

  if (!bookingsButton) {
    console.error("Meead: زر حجوزاتي غير موجود.");
    return;
  }

  const API_URL = "/.netlify/functions/bookings";
  const REVIEWS_API_URL = "/.netlify/functions/reviews";
  const auth = window.MeeadAuth;

  const section = document.createElement("section");
  section.id = "bookings";
  section.className = "container";
  section.hidden = true;
  section.style.cssText =
    "padding:30px 0 45px;scroll-margin-top:100px;";

  const heading = document.createElement("h2");
  heading.textContent = "حجوزاتي";
  heading.style.cssText = "color:#173F35;font-size:26px;";

  const description = document.createElement("p");
  description.textContent =
    "تابع طلبات الحجز وحالة كل موعد، وقيّم الخدمات التي استفدت منها.";
  description.style.cssText = "color:#75817b;";

  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const list = document.createElement("div");
  list.style.cssText =
    "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:15px;";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "تحديث الحجوزات";
  refreshButton.style.cssText =
    "background:#173F35;color:white;border:0;border-radius:10px;padding:11px 16px;margin:10px 0 20px;cursor:pointer;";

  section.append(heading, description, status, refreshButton, list);

  const footer = document.querySelector("footer");
  if (footer) {
    footer.insertAdjacentElement("beforebegin", section);
  } else {
    document.body.appendChild(section);
  }

  function makeElement(tag, text, css = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    if (css) node.style.cssText = css;
    return node;
  }

  function statusLabel(value) {
    const labels = {
      pending: "بانتظار تأكيد صاحب النشاط",
      confirmed: "تم تأكيد الحجز",
      cancelled: "تم إلغاء الحجز",
      completed: "اكتمل الموعد"
    };

    return labels[value] || "حالة الحجز: " + (value || "غير معروفة");
  }

  function statusColor(value) {
    if (value === "confirmed" || value === "completed") return "#247447";
    if (value === "cancelled") return "#b42318";
    return "#956515";
  }

  function formatPrice(price, currency) {
    if (price === null || price === undefined || price === "") {
      return "السعر غير محدد";
    }

    const symbols = { YER: "ر.ي", SAR: "ر.س", USD: "$" };
    const amount = Number(price);

    if (!Number.isFinite(amount)) return "السعر غير محدد";

    return `${amount.toLocaleString("ar")} ${symbols[currency] || currency || ""}`;
  }

  function addReviewForm(card, booking) {
    const reviewBox = document.createElement("div");
    reviewBox.style.cssText =
      "margin-top:15px;padding:14px;background:#f6f5f0;border-radius:12px;";

    reviewBox.appendChild(makeElement(
      "h4",
      "قيّم تجربتك",
      "margin:0 0 10px;color:#173F35;font-size:16px;"
    ));

    reviewBox.appendChild(makeElement(
      "p",
      "كيف كانت تجربتك مع هذا النشاط؟",
      "margin:0 0 10px;color:#52645b;"
    ));

    const ratingLabel = makeElement("label", "التقييم من نجمة إلى خمس نجوم");
    ratingLabel.htmlFor = `reviewRating-${booking.id}`;
    ratingLabel.style.cssText = "display:block;margin-bottom:7px;";
    reviewBox.appendChild(ratingLabel);

    const ratingSelect = document.createElement("select");
    ratingSelect.id = `reviewRating-${booking.id}`;
    ratingSelect.required = true;
    ratingSelect.style.cssText =
      "display:block;width:100%;padding:11px;border:1px solid #ddd;border-radius:8px;background:white;";

    [
      ["5", "★★★★★ — ممتاز"],
      ["4", "★★★★☆ — جيد جدًا"],
      ["3", "★★★☆☆ — جيد"],
      ["2", "★★☆☆☆ — مقبول"],
      ["1", "★☆☆☆☆ — يحتاج تحسينًا"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      ratingSelect.appendChild(option);
    });

    reviewBox.appendChild(ratingSelect);

    const commentLabel = makeElement("label", "تعليقك (اختياري)");
    commentLabel.htmlFor = `reviewComment-${booking.id}`;
    commentLabel.style.cssText = "display:block;margin:12px 0 7px;";
    reviewBox.appendChild(commentLabel);

    const commentInput = document.createElement("textarea");
    commentInput.id = `reviewComment-${booking.id}`;
    commentInput.maxLength = 1000;
    commentInput.rows = 3;
    commentInput.placeholder = "شارك رأيك باحترام لمساعدة الآخرين...";
    commentInput.style.cssText =
      "display:block;box-sizing:border-box;width:100%;padding:11px;border:1px solid #ddd;border-radius:8px;resize:vertical;";

    reviewBox.appendChild(commentInput);

    const reviewStatus = makeElement("p", "");
    reviewStatus.setAttribute("role", "status");
    reviewStatus.setAttribute("aria-live", "polite");
    reviewStatus.style.cssText = "margin:10px 0;color:#52645b;";
    reviewBox.appendChild(reviewStatus);

    const submitButton = makeElement("button", "إرسال التقييم");
    submitButton.type = "button";
    submitButton.style.cssText =
      "width:100%;margin-top:5px;background:#173F35;color:white;border:0;border-radius:9px;padding:12px;cursor:pointer;";

    submitButton.addEventListener("click", async () => {
      if (!auth?.isLoggedIn() || !auth.getToken()) {
        reviewStatus.textContent = "سجّل الدخول أولًا.";
        return;
      }

      submitButton.disabled = true;
      reviewStatus.textContent = "جارٍ إرسال تقييمك...";

      try {
        const response = await fetch(REVIEWS_API_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.getToken()}`
          },
          body: JSON.stringify({
            booking_id: Number(booking.id),
            rating: Number(ratingSelect.value),
            comment: commentInput.value.trim()
          })
        });

        let data;
        try {
          data = await response.json();
        } catch {
          throw new Error("تعذر قراءة استجابة الخادم.");
        }

        if (!response.ok) {
          throw new Error(data.message || "تعذر حفظ التقييم.");
        }

        reviewStatus.textContent = data.message || "تم حفظ تقييمك بنجاح.";
        ratingSelect.disabled = true;
        commentInput.disabled = true;
        submitButton.remove();
      } catch (error) {
        reviewStatus.textContent =
          error.message || "تعذر إرسال التقييم. حاول مجددًا.";
        submitButton.disabled = false;
      }
    });

    reviewBox.appendChild(submitButton);
    card.appendChild(reviewBox);
  }

  async function loadBookings() {
    if (!auth?.isLoggedIn() || !auth.getToken()) {
      status.textContent = "سجّل الدخول أولًا لعرض حجوزاتك.";
      list.replaceChildren();
      document.getElementById("loginBtn")?.click();
      return;
    }

    if (auth.getUser()?.role !== "customer") {
      status.textContent = "هذه الصفحة مخصصة لحسابات العملاء.";
      list.replaceChildren();
      return;
    }

    refreshButton.disabled = true;
    status.textContent = "جارٍ تحميل حجوزاتك...";
    list.replaceChildren();

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${auth.getToken()}`
        }
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("تعذر قراءة استجابة الخادم.");
      }

      if (!response.ok) {
        throw new Error(data.message || "تعذر تحميل الحجوزات.");
      }

      const bookings = Array.isArray(data.bookings) ? data.bookings : [];

      if (!bookings.length) {
        status.textContent = "ليس لديك حجوزات حتى الآن.";
        return;
      }

      status.textContent = `إجمالي حجوزاتك: ${bookings.length}`;

      bookings.forEach((booking) => {
        const card = document.createElement("article");
        card.style.cssText =
          "background:white;border:1px solid #e7e7df;border-radius:16px;padding:18px;";

        card.appendChild(makeElement(
          "h3",
          booking.business_name || "نشاط في ميعاد",
          "color:#173F35;margin:0 0 12px;font-size:18px;"
        ));

        card.appendChild(makeElement(
          "p",
          `الخدمة: ${booking.service_name || "غير محددة"}`
        ));

        card.appendChild(makeElement(
          "p",
          `التاريخ: ${booking.appointment_date || "غير محدد"}`
        ));

        card.appendChild(makeElement(
          "p",
          `الوقت: ${booking.start_time || "--:--"}${booking.end_time ? " - " + booking.end_time : ""}`
        ));

        card.appendChild(makeElement(
          "p",
          `السعر: ${formatPrice(booking.price, booking.currency)}`
        ));

        card.appendChild(makeElement(
          "p",
          statusLabel(booking.status),
          `color:${statusColor(booking.status)};font-weight:bold;background:#f6f5f0;padding:10px;border-radius:8px;`
        ));

        if (booking.customer_notes) {
          card.appendChild(makeElement(
            "p",
            `ملاحظاتك: ${booking.customer_notes}`
          ));
        }

        
        if (
          booking.status === "completed" &&
          Number(booking.has_review || 0) === 0
        ) {
          addReviewForm(card, booking);
        } else if (
          booking.status === "completed" &&
          Number(booking.has_review || 0) === 1
        ) {
          card.appendChild(makeElement(
            "p",
            "⭐ شكرًا لك، لقد قيّمت هذا الموعد مسبقًا.",
            "margin-top:12px;padding:10px;background:#f6f5f0;border-radius:8px;color:#247447;font-weight:600"
          ));
        }


        list.appendChild(card);
      });
    } catch (error) {
      console.error("Meead bookings error:", error);
      status.textContent =
        error.message || "تعذر تحميل الحجوزات. حاول مجددًا.";
    } finally {
      refreshButton.disabled = false;
    }
  }

  bookingsButton.addEventListener("click", async (event) => {
    event.preventDefault();
    section.hidden = false;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    await loadBookings();
  });

  refreshButton.addEventListener("click", loadBookings);

  window.addEventListener("meead:auth-change", () => {
    list.replaceChildren();
    status.textContent = "";
    section.hidden = true;
  });
});
