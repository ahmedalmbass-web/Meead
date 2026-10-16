
/* Meead - Main JavaScript */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  console.log("Meead is ready.");

  const searchForm = document.getElementById("meeadSearch");
  const searchInput = document.getElementById("searchInput");

  if (!searchForm || !searchInput) return;

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = searchInput.value.trim();

    if (!query) {
      searchInput.focus();
      searchInput.setCustomValidity("اكتب اسم النشاط أو الخدمة أولًا.");
      searchInput.reportValidity();
      return;
    }

    searchInput.setCustomValidity("");

    const categoriesSection = document.getElementById("categories");

    if (categoriesSection) {
      categoriesSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    const categoryCards = document.querySelectorAll(".category-card");
    let matches = 0;

    categoryCards.forEach((card) => {
      const text = card.textContent
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const searchTerms = query.toLowerCase().split(/\s+/);
      const isMatch = searchTerms.every((term) => text.includes(term));

      card.hidden = !isMatch;

      if (isMatch) matches++;
    });

    let message = document.getElementById("searchMessage");

    if (!message && categoriesSection) {
      message = document.createElement("p");
      message.id = "searchMessage";
      message.setAttribute("role", "status");
      message.style.textAlign = "center";
      message.style.margin = "0 0 20px";
      categoriesSection.querySelector(".section-heading")
        ?.insertAdjacentElement("afterend", message);
    }

    if (message) {
      message.textContent = matches
        ? `عدد الفئات المطابقة: ${matches}`
        : `لم نجد فئة مطابقة لـ "${query}". جرّب كلمة أخرى.`;
    }
  });

  searchInput.addEventListener("input", () => {
    searchInput.setCustomValidity("");
  });
});
