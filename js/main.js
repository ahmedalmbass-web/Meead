
/* Meead - Main JavaScript */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("meeadSearch");
  const searchInput = document.getElementById("searchInput");
  const categoriesSection = document.getElementById("categories");

  if (!searchForm || !searchInput || !categoriesSection) {
    console.error("Meead: عناصر البحث غير موجودة.");
    return;
  }

  const categoryIcons = {
    "العيادات الطبية": "🩺",
    "عيادات الأسنان": "🦷",
    "الحلاقة الرجالية": "💈",
    "الصالونات والجمال": "💇‍♀️",
    "الرياضة واللياقة": "🏋️",
    "التصوير والمناسبات": "📸",
    "الخدمات المهنية": "🛠️",
    "خدمات أخرى": "＋"
  };

  const results = document.createElement("section");
  results.id = "searchResults";
  results.className = "container";
  results.style.cssText =
    "display:none;padding:25px 0 45px;scroll-margin-top:100px;";

  categoriesSection.insertAdjacentElement("afterend", results);

  function renderResults(items, query, errorMessage = "") {
    results.style.display = "block";

    const heading = document.createElement("h2");
    heading.textContent = query
      ? `نتائج البحث عن: ${query}`
      : "الأنشطة المتاحة";

    heading.style.cssText =
      "font-size:24px;margin:0 0 8px;color:#123c32;";

    const note = document.createElement("p");
    note.textContent = errorMessage ||
      "الأنشطة المعروضة مسجلة في منصة ميعاد.";
    note.style.cssText =
      "color:#75817b;font-size:13px;margin:0 0 20px;";

    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;";

    if (errorMessage) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "إعادة المحاولة";
      retry.style.cssText =
        "background:#123c32;color:white;border:0;border-radius:10px;padding:11px 18px;cursor:pointer;";
      retry.addEventListener("click", () => searchForm.requestSubmit());

      results.replaceChildren(heading, note, retry);
      return;
    }

    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent =
        "لم نجد أنشطة مطابقة. جرّب اسم خدمة أو فئة أو مدينة أخرى.";
      empty.style.cssText =
        "background:white;padding:20px;border-radius:14px;color:#75817b;";
      grid.appendChild(empty);
    }

    items.forEach((activity) => {
      const card = document.createElement("article");
      card.style.cssText =
        "background:white;border:1px solid #e9e8df;border-radius:18px;padding:20px;";

      const icon = document.createElement("div");
      icon.textContent =
        categoryIcons[activity.category] || "📍";
      icon.style.cssText = "font-size:30px;margin-bottom:10px;";

      const name = document.createElement("h3");
      name.textContent = activity.business_name || "نشاط في ميعاد";
      name.style.cssText =
        "font-size:17px;margin:0 0 8px;color:#123c32;";

      const category = document.createElement("p");
      category.textContent = activity.category || "خدمات متنوعة";
      category.style.cssText =
        "margin:4px 0;color:#52645b;font-size:13px;";

      const description = document.createElement("p");
      description.textContent =
        activity.description || "تعرّف على الخدمات المتاحة لدى هذا النشاط.";
      description.style.cssText =
        "margin:8px 0;color:#52645b;font-size:13px;";

      const city = document.createElement("p");
      city.textContent = activity.city
        ? `📍 ${activity.city}`
        : "الموقع غير محدد";
      city.style.cssText =
        "margin:8px 0 0;color:#75817b;font-size:13px;";

      const services = document.createElement("p");
      services.textContent = activity.services
        ? `الخدمات: ${activity.services}`
        : "يمكن الاستفسار عن الخدمات المتاحة.";
      services.style.cssText =
        "margin:8px 0;color:#52645b;font-size:13px;";

      card.append(name, category, description, services, city);
      grid.appendChild(card);
    });

    results.replaceChildren(heading, note, grid);
  }

  async function searchProviders(query) {
    results.style.display = "block";

    const loading = document.createElement("p");
    loading.textContent = "جارٍ البحث عن الأنشطة...";
    loading.style.cssText =
      "padding:20px;color:#75817b;";
    results.replaceChildren(loading);

    try {
      const url = new URL(
        "/.netlify/functions/providers",
        window.location.origin
      );
      url.searchParams.set("q", query);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("تعذر قراءة استجابة الخادم.");
      }

      if (!response.ok) {
        throw new Error(data.message || "تعذر إكمال البحث.");
      }

      renderResults(data.providers || [], query);
    } catch (error) {
      console.error("Meead search error:", error);
      renderResults(
        [],
        query,
        "تعذر الاتصال بخدمة البحث. تأكد من نشر الموقع وإعداد الخادم، ثم حاول مجددًا."
      );
    }

    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = searchInput.value.trim();

    if (!query) {
      searchInput.setCustomValidity(
        "اكتب اسم النشاط أو الخدمة أولًا."
      );
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

      searchInput.value = heading.textContent.trim();
      searchInput.setCustomValidity("");
      searchForm.requestSubmit();
    });
  });

  searchInput.addEventListener("input", () => {
    searchInput.setCustomValidity("");
  });

  console.log("Meead API search is ready.");
});
