(() => {
  "use strict";

  const API = "/.netlify/functions/provider-images";
  const PROVIDERS_API = "/.netlify/functions/provider-manage";
  const MAX_SIDE = 1600;
  const JPEG_QUALITY = 0.85;

  const gallerySelect = document.getElementById("galleryProviderSelect");
  const serviceSelect = document.getElementById("serviceProviderSelect");
  const section = document.getElementById("providerGallery");
  const input = document.getElementById("galleryInput");
  const list = document.getElementById("galleryList");
  const statusEl = document.getElementById("galleryStatus");
  const countEl = document.getElementById("galleryCount");

  if (!section || !input || !list) return;

  let busy = false;
  let cachedProviders = [];

  function getToken() {
    if (window.MeeadAuth && typeof window.MeeadAuth.getToken === "function") {
      return window.MeeadAuth.getToken() || "";
    }

    try {
      return localStorage.getItem("meead_token") || "";
    } catch {
      return "";
    }
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  }

  function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.style.color = isError ? "#c0392b" : "#123c32";
    statusEl.style.fontWeight = isError ? "bold" : "normal";
  }

  // قراءة رقم النشاط من القائمة المخصصة للمعرض مع الرجوع لقائمة الخدمات
  function currentProviderId() {
    let id = null;
    if (gallerySelect && gallerySelect.value) {
      id = Number(gallerySelect.value);
    }
    if ((!id || !Number.isSafeInteger(id) || id <= 0) && serviceSelect && serviceSelect.value) {
      id = Number(serviceSelect.value);
    }
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  // ملء قائمة أنشطة المعرض
  function populateGallerySelect(providers) {
    if (!gallerySelect) return;
    cachedProviders = providers || [];

    const previousId = gallerySelect.value || (serviceSelect ? serviceSelect.value : "");
    gallerySelect.replaceChildren();

    if (!providers || !providers.length) {
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "لا توجد أنشطة مسجلة بعد";
      gallerySelect.appendChild(emptyOpt);
      section.hidden = true;
      setStatus("يرجى إضافة نشاط تجاري أولاً من تبويب بيانات النشاط.");
      return;
    }

    providers.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = String(p.id);
      opt.textContent = `${p.business_name} — ${p.city || ""}`;
      gallerySelect.appendChild(opt);
    });

    // التحديد الافتراضي: الحفاظ على الاختيار الحالي أو الانتقال لأول نشاط متاح
    if (previousId && providers.some((p) => String(p.id) === String(previousId))) {
      gallerySelect.value = String(previousId);
    } else {
      gallerySelect.value = String(providers[0].id);
    }

    section.hidden = !currentProviderId();
    load();
  }

  // استخراج الأنشطة من قائمة الخدمات إن وُجدت
  function extractProvidersFromServiceSelect() {
    if (!serviceSelect) return [];
    const options = Array.from(serviceSelect.options).filter(
      (o) => o.value && Number(o.value) > 0
    );
    return options.map((o) => {
      const parts = o.textContent.split(" — ");
      return {
        id: Number(o.value),
        business_name: parts[0] ? parts[0].trim() : o.textContent,
        city: parts[1] ? parts[1].trim() : "",
      };
    });
  }

  // جلب الأنشطة من الـ API مباشرة
  async function fetchProviders() {
    try {
      const res = await fetch(PROVIDERS_API, {
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const data = await readJson(res);
      return Array.isArray(data.providers) ? data.providers : null;
    } catch {
      return null;
    }
  }

  async function initProviders() {
    // 1. فحص قائمة الخدمات أولاً كحل فوري وسريع
    const fromSelect = extractProvidersFromServiceSelect();
    if (fromSelect.length) {
      populateGallerySelect(fromSelect);
    }

    // 2. جلب القائمة المؤكدة من السيرفر
    const serverProviders = await fetchProviders();
    if (serverProviders && serverProviders.length) {
      populateGallerySelect(serverProviders);
    }
  }

  // تصغير وضغط الصورة قبل الرفع
  function compress(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);

        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("تعذر معالجة الصورة"));
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          JPEG_QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("الملف ليس صورة صالحة"));
      };

      img.src = url;
    });
  }

  function render(images) {
    list.textContent = "";
    if (!images || !images.length) {
      countEl.textContent = "لم ترفع أي صور بعد لهذا النشاط. أضف صور أعمالك لتزيد ثقة العملاء (تصبح أول صورة هي صورة الغلاف).";
      return;
    }

    countEl.textContent = `عدد الصور المرفوعة: ${images.length} من 12 صورة`;

    images.forEach((image, index) => {
      const item = document.createElement("figure");
      item.className = "gallery-item";
      item.style.position = "relative";
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.borderRadius = "12px";
      item.style.overflow = "hidden";
      item.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      item.style.border = "1px solid #e9e8df";

      // شارة صورة الغلاف لأول صورة
      if (index === 0 || image.is_cover) {
        const badge = document.createElement("span");
        badge.textContent = "⭐ صورة الغلاف";
        badge.style.cssText =
          "position:absolute;top:6px;right:6px;background:rgba(18,60,50,0.9);color:#d8bd7c;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;z-index:2;letter-spacing:0.3px;";
        item.appendChild(badge);
      }

      const img = document.createElement("img");
      img.src = image.url;
      img.alt = `صورة رقم ${index + 1} من أعمال النشاط`;
      img.loading = "lazy";
      img.title = "اضغط لعرض الصورة بالحجم الكامل";
      img.style.cssText =
        "display:block;width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;transition:transform 0.2s;";
      img.addEventListener("mouseenter", () => {
        img.style.transform = "scale(1.03)";
      });
      img.addEventListener("mouseleave", () => {
        img.style.transform = "scale(1)";
      });
      img.addEventListener("click", () => {
        window.open(image.url, "_blank");
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "gallery-delete";
      del.innerHTML = "🗑️ حذف الصورة";
      del.style.cssText =
        "width:100%;border:0;padding:9px;background:#fff5f4;color:#d9534f;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif;font-size:13px;transition:background 0.2s, color 0.2s;";
      del.addEventListener("mouseenter", () => {
        del.style.background = "#ffe5e5";
        del.style.color = "#c0392b";
      });
      del.addEventListener("mouseleave", () => {
        del.style.background = "#fff5f4";
        del.style.color = "#d9534f";
      });
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        removeImage(image.id);
      });

      item.append(img, del);
      list.append(item);
    });
  }

  async function load() {
    const providerId = currentProviderId();
    section.hidden = !providerId;
    if (!providerId) {
      if (gallerySelect && gallerySelect.options.length <= 1) {
        initProviders();
      }
      return;
    }

    setStatus("جارٍ تحميل الصور...");

    try {
      const response = await fetch(`${API}?provider_id=${providerId}`, {
        headers: authHeaders(),
      });
      const data = await readJson(response);

      if (!response.ok) throw new Error(data.message || "تعذر تحميل الصور");

      render(data.images || []);
      setStatus("");
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function upload(files) {
    const providerId = currentProviderId();
    if (!providerId) {
      setStatus("يرجى اختيار النشاط أولاً قبل رفع الصور.", true);
      return;
    }
    if (busy || !files.length) return;

    busy = true;
    input.disabled = true;
    let done = 0;

    try {
      for (const file of files) {
        setStatus(`جارٍ معالجة ورفع الصورة ${done + 1} من ${files.length}...`);

        const imageBase64 = await compress(file);

        const response = await fetch(API, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            provider_id: providerId,
            image_base64: imageBase64,
          }),
        });
        const data = await readJson(response);

        if (!response.ok) throw new Error(data.message || "تعذر رفع الصورة");
        done += 1;
      }

      setStatus(`تم رفع ${done} صورة بنجاح وتم تحديث المعرض.`);
    } catch (error) {
      setStatus(
        done ? `تم رفع ${done} صورة، ثم حدث خطأ: ${error.message}` : error.message,
        true
      );
    } finally {
      busy = false;
      input.disabled = false;
      input.value = "";
      await load();
    }
  }

  async function removeImage(imageId) {
    if (busy || !window.confirm("هل أنت متأكد من رغبتك في حذف هذه الصورة؟")) return;

    busy = true;
    setStatus("جارٍ حذف الصورة...");

    try {
      const response = await fetch(`${API}?image=${imageId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await readJson(response);

      if (!response.ok) throw new Error(data.message || "تعذر حذف الصورة");
      setStatus("تم حذف الصورة بنجاح");
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      busy = false;
      await load();
    }
  }

  input.addEventListener("change", () => upload([...input.files]));

  if (gallerySelect) {
    gallerySelect.addEventListener("change", () => {
      // مزامنة التحديد مع قائمة الخدمات عند الرغبة
      if (serviceSelect && gallerySelect.value) {
        serviceSelect.value = gallerySelect.value;
      }
      load();
    });
  }

  if (serviceSelect) {
    serviceSelect.addEventListener("change", () => {
      if (gallerySelect && serviceSelect.value && gallerySelect.value !== serviceSelect.value) {
        gallerySelect.value = serviceSelect.value;
        load();
      }
    });

    // مراقبة تعبئة الأنشطة من provider-dashboard.js
    new MutationObserver(() => {
      const list = extractProvidersFromServiceSelect();
      if (list.length && (!gallerySelect || gallerySelect.options.length <= 1)) {
        populateGallerySelect(list);
      }
    }).observe(serviceSelect, { childList: true });
  }

  // عند النقر على تبويب معرض الصور، تأكد من تحديث القائمة
  const galleryTabBtn = document.querySelector('[data-target="galleryTabSection"]');
  if (galleryTabBtn) {
    galleryTabBtn.addEventListener("click", () => {
      if (!currentProviderId() || !cachedProviders.length) {
        initProviders();
      } else {
        load();
      }
    });
  }

  // التهيئة الأولية
  initProviders();
})();
