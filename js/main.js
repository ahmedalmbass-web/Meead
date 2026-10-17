
/* Meead - Main JavaScript */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("meeadSearch");
  const searchInput = document.getElementById("searchInput");
  const categoriesSection = document.getElementById("categories");

  const demoActivities = [
    {
      name: "عيادة الأمل الطبية",
      category: "العيادات الطبية",
      city: "صنعاء",
      service: "استشارات طبية",
      icon: "🩺"
    },
    {
      name: "مركز ابتسامة للأسنان",
      category: "عيادات الأسنان",
      city: "صنعاء",
      service: "فحص وتنظيف الأسنان",
      icon: "🦷"
    },
    {
      name: "صالون الأناقة",
      category: "الصالونات والجمال",
      city: "عدن",
      service: "العناية والتجميل",
      icon: "💇‍♀️"
    },
    {
      name: "حلاقة الرجل الأنيق",
      category: "الحلاقة الرجالية",
      city: "صنعاء",
      service: "حلاقة وعناية شخصية",
      icon: "💈"
    },
    {
      name: "نادي النشاط الرياضي",
      category: "الرياضة واللياقة",
      city: "تعز",
      service: "تدريب ولياقة",
      icon: "🏋️"
    },
    {
        {
      name: "عدسة للتصوير",
      category: "التصوير والمناسبات",
      city: "عدن",
      service: "تصوير المناسبات",
      icon: "📸"
    },
    {
      name: "مركز الخدمات المهنية",
      category: "الخدمات المهنية",
      city: "صنعاء",
      service: "خدمات مهنية متنوعة",
      icon: "🛠️"
    },
    {
      name: "مركز الخدمات المتنوعة",
      category: "خدمات أخرى",
      city: "تعز",
      service: "خدمات متنوعة",
      icon: "＋"
    }
  ];

  if (!searchForm || !searchInput || !categoriesSection) {
    console.error("Meead: عناصر البحث غير موجودة.");
    return;
  }

  const results = document.createElement("section");
  results.id = "searchResults";
  results.className = "container";
  results.style.cssText =
    "display:none;padding:25px 0 45px;scroll-margin-top:100px;";

  categoriesSection.insertAdjacentElement("afterend", results);

  function renderResults(items, query) {
    results.style.display = "block";

    const heading = document.createElement("h2");
    heading.textContent = query
      ? `نتائج البحث عن: ${query}`
      : "الأنشطة المتاحة للتجربة";

    heading.style.cssText =
      "font-size:24px;margin:0 0 8px;color:#123c32;";

    const note = document.createElement("p");
    note.textContent =
      "هذه بيانات تجريبية للعرض فقط، وليست أنشطة مسجلة فعليًا.";
    note.style.cssText =
      "color:#75817b;font-size:13px;margin:0 0 20px;";

    const grid = document.createElement("div");
    grid.style.cssText =
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;";

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.textContent =
        "لم نجد نتائج مطابقة. جرّب اسم خدمة أو فئة أو مدينة أخرى.";
      empty.style.cssText =
        "background:white;padding:20px;border-radius:14px;color:#75817b;";
      grid.appendChild(empty);
    }

    items.forEach((activity) => {
      const card = document.createElement("article");
      card.style.cssText =
        "background:white;border:1px solid #e9e8df;border-radius:18px;padding:20px;";

      const icon = document.createElement("div");
      icon.textContent = activity.icon;
      icon.style.cssText =
        "font-size:30px;margin-bottom:10px;";

      const name = document.createElement("h3");
      name.textContent = activity.name;
      name.style.cssText =
        "font-size:17px;margin:0 0 8px;color:#123c32;";

      const category = document.createElement("p");
      category.textContent = activity.category;
      category.style.cssText =
        "margin:4px 0;color:#52645b;font-size:13px;";

      const service = document.createElement("p");
      service.textContent = `الخدمة: ${activity.service}`;
      service.style.cssText =
        "margin:4px 0;color:#52645b;font-size:13px;";

      const city = document.createElement("p");
      city.textContent = `📍 ${activity.city}`;
      city.style.cssText =
        "margin:8px 0 0;color:#75817b;font-size:13px;";

      const badge = document.createElement("p");
      badge.textContent = "بيانات تجريبية";
      badge.style.cssText =
        "display:inline-block;background:#f1efe5;color:#78632f;padding:4px 9px;border-radius:20px;font-size:11px;margin:12px 0 0;";

      card.append(icon, name, category, service, city, badge);
      grid.appendChild(card);
    });

    results.replaceChildren(heading, note, grid);
  }

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

    const terms = query.toLocaleLowerCase("ar").split(/\s+/);

    const matches = demoActivities.filter((activity) => {
      const searchableText = [
        activity.name,
        activity.category,
        activity.city,
        activity.service
      ].join(" ").toLocaleLowerCase("ar");

      return terms.every((term) => searchableText.includes(term));
    });

    renderResults(matches, query);
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  });

    document.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();

      const heading = card.querySelector("h3");
      if (!heading) return;

      const categoryName = heading.textContent.trim();

      searchInput.value = categoryName;
      searchInput.setCustomValidity("");
      searchForm.requestSubmit();
    });
  });

  searchInput.addEventListener("input", () => {
    searchInput.setCustomValidity("");
  });

  console.log("Meead search is ready.");
