/* Meead - اختيار وقت الحجز من الأوقات المتاحة
   يعمل فوق نافذة الحجز الموجودة في main.js بدون تعديلها:
   يستبدل حقل الوقت الحر بأزرار أوقات، والمحجوز منها يظهر معطّلًا. */
"use strict";

(() => {
  const API = "/.netlify/functions/slots";
  const MAX_DAYS_AHEAD = 90;

  let requestId = 0;
  let refreshTimer = null;
  let loading = false;

  function setup() {
    const form = document.getElementById("meeadBookingForm");
    const service = document.getElementById("meeadService");
    const date = document.getElementById("meeadDate");
    const time = document.getElementById("meeadTime");
    const bookingStatus = document.getElementById("meeadBookingStatus");

    if (!form || !service || !date || !time) return false;
    if (form.dataset.slotsReady === "1") return true;

    form.dataset.slotsReady = "1";

    // حقل الوقت الحر يصير مخفيًا ويحمل الوقت المختار فقط
    time.type = "hidden";
    time.removeAttribute("required");

    const timeLabel = form.querySelector('label[for="meeadTime"]');
    if (timeLabel) timeLabel.removeAttribute("for");

    // أقصى تاريخ للحجز
    if (date.min) {
      const limit = new Date(`${date.min}T00:00:00Z`);
      limit.setUTCDate(limit.getUTCDate() + MAX_DAYS_AHEAD);
      date.max = limit.toISOString().slice(0, 10);
    }

    const statusEl = document.createElement("p");
    statusEl.id = "meeadSlotsStatus";
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
    statusEl.style.cssText = "margin:0 0 10px;color:#75817b;font-size:13px";
    statusEl.textContent = "اختر الخدمة والتاريخ لتظهر الأوقات المتاحة.";

    const grid = document.createElement("div");
    grid.id = "meeadSlots";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "أوقات الحجز");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin:0 0 15px";

    time.insertAdjacentElement("afterend", statusEl);
    statusEl.insertAdjacentElement("afterend", grid);

    function to12h(value) {
      const [h, m] = value.split(":").map(Number);
      const suffix = h >= 12 ? "م" : "ص";
      const hour = h % 12 === 0 ? 12 : h % 12;
      return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
    }

    function setStatus(text) {
      statusEl.textContent = text || "";
    }

    function clear(message) {
      requestId += 1;
      time.value = "";
      grid.replaceChildren();
      setStatus(
        message || "اختر الخدمة والتاريخ لتظهر الأوقات المتاحة."
      );
    }

    function styleSlot(button, state) {
      const base =
        "padding:10px 6px;border-radius:10px;font:inherit;font-weight:700;font-size:14px;";

      if (state === "selected") {
        button.style.cssText =
          base +
          "background:#173F35;color:#fff;border:1px solid #173F35;cursor:pointer";
      } else if (state === "booked") {
        button.style.cssText =
          base +
          "background:#f1f1ec;color:#a9b0ab;border:1px solid #e8e8df;text-decoration:line-through;cursor:not-allowed";
      } else {
        button.style.cssText =
          base +
          "background:#fff;color:#173F35;border:1px solid #173F35;cursor:pointer";
      }
    }

    function render(slots, previous, message) {
      grid.replaceChildren();

      if (!slots.length) {
        setStatus(message || "لا توجد أوقات في هذا اليوم.");
        return;
      }

      const freeCount = slots.filter((slot) => slot.available).length;

      if (!freeCount) {
        setStatus("كل أوقات هذا اليوم محجوزة، جرّب يومًا آخر.");
      } else {
        setStatus("اختر وقتًا من الأوقات المتاحة. الأوقات المشطوبة محجوزة.");
      }

      const buttons = [];

      slots.forEach((slot) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = to12h(slot.start);
        button.title = `${to12h(slot.start)} - ${to12h(slot.end)}`;
        button.dataset.start = slot.start;

        if (!slot.available) {
          button.disabled = true;
          button.setAttribute("aria-label", `${to12h(slot.start)} محجوز`);
          styleSlot(button, "booked");
        } else {
          styleSlot(button, "free");

          button.addEventListener("click", () => {
            time.value = slot.start;

            buttons.forEach((item) => {
              if (!item.disabled) styleSlot(item, "free");
              item.removeAttribute("aria-pressed");
            });

            styleSlot(button, "selected");
            button.setAttribute("aria-pressed", "true");

            setStatus(
              `الموعد المختار: ${to12h(slot.start)} - ${to12h(slot.end)}`
            );
          });
        }

        buttons.push(button);
        grid.appendChild(button);
      });

      // نحافظ على الاختيار السابق إن كان ما زال متاحًا
      if (previous) {
        const kept = buttons.find(
          (item) => item.dataset.start === previous && !item.disabled
        );

        if (kept) kept.click();
      }
    }

    async function load(keepSelection = false) {
      const serviceId = Number(service.value);
      const day = date.value;

      if (!serviceId || !day) {
        clear();
        return;
      }

      const current = ++requestId;
      const previous = keepSelection ? time.value : "";

      time.value = "";
      grid.replaceChildren();
      setStatus("جارٍ تحميل الأوقات...");
      loading = true;

      try {
        const url = new URL(API, window.location.origin);
        url.searchParams.set("service_id", String(serviceId));
        url.searchParams.set("date", day);

        const response = await fetch(url, {
          headers: { Accept: "application/json" }
        });
        const data = await response.json();

        if (current !== requestId) return;

        if (!response.ok) {
          throw new Error(data.message || "تعذر تحميل الأوقات.");
        }

        render(Array.isArray(data.slots) ? data.slots : [], previous, data.message);
      } catch (error) {
        if (current !== requestId) return;

        grid.replaceChildren();
        setStatus(error.message || "تعذر تحميل الأوقات، حاول مجددًا.");
      } finally {
        if (current === requestId) loading = false;
      }
    }

    service.addEventListener("change", () => load(false));
    date.addEventListener("change", () => load(false));

    // main.js يعيد تعبئة النموذج عند فتح نشاط جديد أو بعد نجاح الحجز
    form.addEventListener("reset", () => {
      window.setTimeout(() => clear(), 0);
    });

    // بعد أي محاولة حجز (نجاح أو "الموعد محجوز") نحدّث الأوقات
    if (bookingStatus) {
      new MutationObserver(() => {
        if (!bookingStatus.textContent.trim()) return;

        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          if (!loading && service.value && date.value) load(true);
        }, 400);
      }).observe(bookingStatus, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    return true;
  }

  function start() {
    if (setup()) return;

    // نافذة الحجز تُنشأ من main.js، فننتظر ظهورها
    const observer = new MutationObserver(() => {
      if (setup()) observer.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
