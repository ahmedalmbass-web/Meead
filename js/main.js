
/* Meead - Search, Provider Details and Booking */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("meeadSearch");
  const searchInput = document.getElementById("searchInput");
  const categoriesSection = document.getElementById("categories");

  if (!searchForm || !searchInput || !categoriesSection) {
    console.error("Meead: عناصر البحث غير موجودة.");
    return;
  }

  const API = {
    providers: "/.netlify/functions/providers",
    services: "/.netlify/functions/services",
    bookings: "/.netlify/functions/bookings"
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
  "الصالونات والجمال": "💇",
  "الرياضة واللياقة": "🏋️",
  "التصوير والمناسبات": "📸",
  "الخدمات المهنية": "💼",
  "خدمات أخرى": "📍",

  "عيادة": "🩺",
  "حلاقة": "💈",
  "صالون": "💇",
  "أخرى": "📍"
};

  const results = document.createElement("section");
  results.id = "searchResults";
  results.className = "container";
  results.style.cssText =
    "display:none;padding:25px 0 45px;scroll-margin-top:100px;";
  categoriesSection.insertAdjacentElement("afterend", results);

  const modal = document.createElement("section");
  modal.id = "meeadBookingModal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "meeadBookingTitle");
  modal.style.cssText = [
    "position:fixed", "inset:0", "z-index:9999",
    "background:rgba(0,0,0,.65)", "overflow-y:auto",
    "padding:20px", "align-items:center",
    "justify-content:center"
  ].join(";");

  modal.innerHTML = `
    <div style="background:#fff;color:#202923;max-width:560px;width:100%;margin:20px auto;padding:24px;border-radius:18px;box-sizing:border-box">
      <button type="button" id="meeadCloseDetails" aria-label="إغلاق"
        style="float:left;border:0;background:#eee;border-radius:8px;padding:8px 12px;cursor:pointer">إغلاق ✕</button>
      <h2 id="meeadBookingTitle" style="color:#173F35;margin:12px 0">تفاصيل النشاط</h2>
      <div id="meeadDetailsContent">جارٍ تحميل التفاصيل...</div>
      <form id="meeadBookingForm" hidden style="margin-top:20px">
        <h3 style="color:#173F35">احجز موعدك</h3>
        <label for="meeadService">الخدمة</label>
        <select id="meeadService" name="service_id" required
          style="display:block;width:100%;padding:12px;margin:7px 0 15px;border:1px solid #ddd;border-radius:9px"></select>
        <label for="meeadDate">تاريخ الموعد</label>
        <input id="meeadDate" name="appointment_date" type="date" required
          style="display:block;width:100%;padding:12px;margin:7px 0 15px;border:1px solid #ddd;border-radius:9px">
        <label for="meeadTime">وقت الموعد</label>
        <input id="meeadTime" name="start_time" type="time" required
          style="display:block;width:100%;padding:12px;margin:7px 0 15px;border:1px solid #ddd;border-radius:9px">
        <label for="meeadNotes">ملاحظات (اختياري)</label>
        <textarea id="meeadNotes" name="notes" maxlength="1000" rows="3"
          style="display:block;width:100%;padding:12px;margin:7px 0 15px;border:1px solid #ddd;border-radius:9px;box-sizing:border-box"></textarea>
        <p id="meeadBookingStatus" role="status" aria-live="polite"></p>
        <button type="submit" id="meeadSubmitBooking"
          style="width:100%;background:#173F35;color:white;border:0;border-radius:10px;padding:14px;font-weight:bold;cursor:pointer">
          إرسال طلب الحجز
        </button>
      </form>
    </div>`;

  document.body.appendChild(modal);

  const detailsContent = modal.querySelector("#meeadDetailsContent");
  const bookingForm = modal.querySelector("#meeadBookingForm");
  const serviceSelect = modal.querySelector("#meeadService");
  const bookingStatus = modal.querySelector("#meeadBookingStatus");
  const dateInput = modal.querySelector("#meeadDate");
  const timeInput = modal.querySelector("#meeadTime");

  let selectedProvider = null;
  let activeServices = [];

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
  dateInput.min = localToday;

  function element(tag, text, style = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
  }

  function closeModal() {
    modal.hidden = true;
    modal.style.display = "none";
    document.body.style.overflow = "";
  }

  function openModal() {
    modal.hidden = false;
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
    modal.querySelector("#meeadCloseDetails").focus();
  }

  modal.querySelector("#meeadCloseDetails")
    .addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  function formatPrice(service) {
    const amount = Number(service.price);
    if (!Number.isFinite(amount)) return "السعر غير محدد";
    const currencies = { YER: "ر.ي", SAR: "ر.س", USD: "$" };
    return `${amount.toLocaleString("ar")} ${currencies[service.currency] || service.currency || ""}`;
  }

  
let currentSort = "default";


  function renderResults(items, query, errorMessage = "") {
    results.style.display = "block";
    results.replaceChildren();

    results.appendChild(element(
      "h2",
      query ? `نتائج البحث عن: ${query}` : "الأنشطة المتاحة",
      "font-size:24px;margin:0 0 8px;color:#123c32"
    ));

    results.appendChild(element(
      "p",
      errorMessage || "الأنشطة المعروضة مسجلة في منصة ميعاد.",
      "color:#75817b;font-size:13px;margin:0 0 20px"
    ));

    
    if (errorMessage) {
      const retry = element("button", "إعادة المحاولة");
      retry.type = "button";
      retry.style.cssText =
        "background:#123c32;color:white;border:0;border-radius:10px;padding:11px 18px";
      retry.addEventListener("click", () => searchProviders(query));
      results.appendChild(retry);
      return;
    }

    const sortBox = document.createElement("div");
    sortBox.style.cssText =
      "display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 20px";

    const sortLabel = element("label", "ترتيب الأنشطة:");
    sortLabel.htmlFor = "providerSort";
    sortLabel.style.cssText = "color:#123c32;font-weight:600";

    const sortSelect = document.createElement("select");
    sortSelect.id = "providerSort";
    sortSelect.style.cssText =
      "max-width:100%;padding:11px;border:1px solid #d9ded8;border-radius:10px;background:white;color:#123c32";

    const sortOptions = [
      ["default", "الترتيب الافتراضي"],
      ["rating", "الأعلى تقييمًا"],
      ["popular", "الأكثر حجزًا"],
      ["most_reviewed", "الأكثر مراجعة"]
    ];

    sortOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sortSelect.appendChild(option);
    });

    sortSelect.value = currentSort;

    sortSelect.addEventListener("change", () => {
      currentSort = sortSelect.value;
      searchProviders(query);
    });

    sortBox.append(sortLabel, sortSelect);
    results.appendChild(sortBox);


    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:15px";

    if (!items.length) {
      grid.appendChild(element(
        "p",
        "لم نجد أنشطة مطابقة. جرّب اسم خدمة أو فئة أو مدينة أخرى.",
        "background:white;padding:20px;border-radius:14px;color:#75817b"
      ));
    }

    items.forEach((provider) => {
      const card = document.createElement("article");
      card.style.cssText =
        "background:white;border:1px solid #e9e8df;border-radius:18px;padding:20px";

      card.appendChild(element(
        "div", categoryIcons[provider.category] || "📍",
        "font-size:30px;margin-bottom:10px"
      ));
      card.appendChild(element(
        "h3", provider.business_name || "نشاط في ميعاد",
        "font-size:18px;margin:0 0 8px;color:#123c32"
      ));
      card.appendChild(element(
        "p", provider.category || "خدمات متنوعة",
        "margin:5px 0;color:#52645b"
      ));
      card.appendChild(element(
        "p", provider.description || "تعرّف على الخدمات المتاحة لدى هذا النشاط.",
        "margin:8px 0;color:#52645b"
      ));
      card.appendChild(element(
        "p", provider.city ? `📍 ${provider.city}` : "الموقع غير محدد",
        "margin:8px 0;color:#75817b"
      ));
      card.appendChild(element(
        "p", provider.services ? `الخدمات: ${provider.services}` : "اضغط للتعرف على الخدمات.",
        "margin:8px 0;color:#52645b;font-size:13px"
      ));

      const button = element("button", "عرض التفاصيل والحجز");
      button.type = "button";
      button.style.cssText =
        "width:100%;margin-top:12px;background:#173F35;color:#fff;border:0;border-radius:10px;padding:12px;cursor:pointer";
      button.addEventListener("click", () => openProvider(provider));
      card.appendChild(button);
      grid.appendChild(card);
    });

    results.appendChild(grid);
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  




async function searchProviders(query) {
  results.style.display = "block";
  results.replaceChildren(
    element("p", "جارٍ البحث عن الأنشطة...", "padding:20px")
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

    const categories = categoryFilters[query];

    if (categories) {
      const uniqueProviders = new Map();

      for (const category of categories) {
        const url = new URL(API.providers, window.location.origin);
        url.searchParams.set("category", category);
        url.searchParams.set("sort", currentSort);

        const response = await fetch(url, {
          headers: { Accept: "application/json" }
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "تعذر إكمال البحث.");
        }

        for (const provider of data.providers || []) {
          uniqueProviders.set(String(provider.id), provider);
        }
      }

      const providers = [...uniqueProviders.values()];

      if (currentSort === "rating") {
        providers.sort((a, b) =>
          Number(b.average_rating || 0) - Number(a.average_rating || 0) ||
          Number(b.review_count || 0) - Number(a.review_count || 0)
        );
      } else if (currentSort === "popular") {
        providers.sort((a, b) =>
          Number(b.booking_count || 0) - Number(a.booking_count || 0) ||
          Number(b.average_rating || 0) - Number(a.average_rating || 0)
        );
      } else if (currentSort === "most_reviewed") {
        providers.sort((a, b) =>
          Number(b.review_count || 0) - Number(a.review_count || 0) ||
          Number(b.average_rating || 0) - Number(a.average_rating || 0)
        );
      }

      renderResults(providers, query);
      return;
    }

    const url = new URL(API.providers, window.location.origin);
    url.searchParams.set("q", query);
    url.searchParams.set("sort", currentSort);

    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "تعذر إكمال البحث.");
    }

    renderResults(data.providers || [], query);
  } catch (error) {
    console.error("Meead search error:", error);
    renderResults(
      [],
      query,
      error.message || "تعذر الاتصال بخدمة البحث."
    );
  }
}





  async function openProvider(provider) {
    selectedProvider = provider;
    activeServices = [];
    bookingForm.hidden = true;
    bookingForm.reset();
    bookingStatus.textContent = "";
    detailsContent.replaceChildren(
      element("p", "جارٍ تحميل تفاصيل النشاط وخدماته...")
    );
    openModal();

    try {
      const url = new URL(API.services, window.location.origin);
      url.searchParams.set("providerId", String(provider.id));

      const response = await fetch(url, {
        headers: { Accept: "application/json" }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "تعذر تحميل الخدمات.");
      }

      activeServices = Array.isArray(data.services) ? data.services : [];
      detailsContent.replaceChildren();

      detailsContent.appendChild(element(
        "p", provider.category || "خدمات متنوعة",
        "color:#52645b"
      ));
      detailsContent.appendChild(element(
        "p", provider.description || "لا يوجد وصف إضافي للنشاط."
      ));
      detailsContent.appendChild(element(
        "p", provider.city ? `المدينة: ${provider.city}` : "المدينة غير محددة"
      ));
      detailsContent.appendChild(element(
        "p", provider.address ? `العنوان: ${provider.address}` : "العنوان غير محدد"
      ));

      detailsContent.appendChild(element(
        "h3", "الخدمات والأسعار",
        "color:#173F35;margin-top:20px"
      ));

      if (!activeServices.length) {
        detailsContent.appendChild(element(
          "p", "لم يضف هذا النشاط خدمات متاحة للحجز بعد."
        ));
        return;
      }

      activeServices.forEach((service) => {
        const row = document.createElement("div");
        row.style.cssText =
          "border:1px solid #e8e8e0;border-radius:10px;padding:12px;margin:8px 0";
        row.appendChild(element("strong", service.name));
        row.appendChild(element(
          "p", formatPrice(service),
          "margin:5px 0"
        ));
        row.appendChild(element(
          "p", `المدة: ${service.duration_minutes} دقيقة`,
          "margin:5px 0;color:#75817b;font-size:13px"
        ));
        if (service.description) {
          row.appendChild(element("p", service.description));
        }
        detailsContent.appendChild(row);
      });

      serviceSelect.replaceChildren();
      activeServices.forEach((service) => {
        const option = document.createElement("option");
        option.value = String(service.id);
        option.textContent = `${service.name} — ${formatPrice(service)}`;
        serviceSelect.appendChild(option);
      });

      bookingForm.hidden = false;
    } catch (error) {
      detailsContent.replaceChildren(element(
        "p", error.message || "تعذر تحميل تفاصيل النشاط."
      ));
    }
  }

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    bookingStatus.textContent = "";

    const auth = window.MeeadAuth;
    if (!auth?.isLoggedIn() || !auth.getToken()) {
      closeModal();
      document.getElementById("loginBtn")?.click();
      return;
    }

    if (!selectedProvider || !serviceSelect.value) {
      bookingStatus.textContent = "اختر خدمة أولًا.";
      return;
    }

    const appointmentDate = dateInput.value;
    const startTime = timeInput.value;

    if (!appointmentDate || appointmentDate < localToday || !startTime) {
      bookingStatus.textContent = "اختر تاريخًا ووقتًا صحيحين.";
      return;
    }

    const button = modal.querySelector("#meeadSubmitBooking");
    button.disabled = true;
    button.textContent = "جارٍ إرسال طلب الحجز...";

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
          service_id: Number(serviceSelect.value),
          appointment_date: appointmentDate,
          start_time: startTime,
          customer_notes: modal.querySelector("#meeadNotes").value.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "تعذر إرسال الحجز.");
      }

      bookingStatus.textContent =
        data.message || "تم إرسال طلب الحجز بنجاح. انتظر تأكيد صاحب النشاط.";
      bookingForm.reset();
    } catch (error) {
      bookingStatus.textContent =
        error.message || "تعذر الاتصال بالخادم. حاول مجددًا.";
    } finally {
      button.disabled = false;
      button.textContent = "إرسال طلب الحجز";
    }
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();

    if (!query) {
      searchInput.setCustomValidity("اكتب اسم النشاط أو الخدمة أولًا.");
      searchInput.reportValidity();
      searchInput.focus();
      return;
    }

    searchInput.setCustomValidity("");
    searchProviders(query);
  });

  document.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();
      const heading = card.querySelector("h3");
      if (!heading) return;

      const category = heading.textContent.trim();
      searchInput.value = categorySearchTerms[category] || category;
      searchInput.setCustomValidity("");
      searchProviders(searchInput.value);
    });
  });
});
