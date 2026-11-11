(() => {
  "use strict";

  const API = "/.netlify/functions/provider-images";
  const MAX_SIDE = 1600;
  const JPEG_QUALITY = 0.85;

  const select = document.getElementById("serviceProviderSelect");
  const section = document.getElementById("providerGallery");
  const input = document.getElementById("galleryInput");
  const list = document.getElementById("galleryList");
  const statusEl = document.getElementById("galleryStatus");
  const countEl = document.getElementById("galleryCount");

  if (!select || !section || !input || !list) return;

  let busy = false;

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

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function currentProviderId() {
    const id = Number(select.value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  // تصغير وضغط الصورة قبل الرفع (أسرع وأخف وأضمن للحد الأقصى)
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
    countEl.textContent = images.length
      ? `عدد الصور: ${images.length}`
      : "لم ترفع أي صور بعد. أضف صور أعمالك لتزيد ثقة العملاء.";

    for (const image of images) {
      const item = document.createElement("figure");
      item.className = "gallery-item";

      const img = document.createElement("img");
      img.src = image.url;
      img.alt = "صورة من أعمال النشاط";
      img.loading = "lazy";

      const del = document.createElement("button");
      del.type = "button";
      del.className = "gallery-delete";
      del.textContent = "حذف";
      del.addEventListener("click", () => removeImage(image.id));

      item.append(img, del);
      list.append(item);
    }
  }

  async function load() {
    const providerId = currentProviderId();
    section.hidden = !providerId;
    if (!providerId) return;

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
      setStatus(error.message);
    }
  }

  async function upload(files) {
    const providerId = currentProviderId();
    if (!providerId || busy || !files.length) return;

    busy = true;
    input.disabled = true;
    let done = 0;

    try {
      for (const file of files) {
        setStatus(`جارٍ رفع الصورة ${done + 1} من ${files.length}...`);

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

      setStatus(`تم رفع ${done} صورة بنجاح`);
    } catch (error) {
      setStatus(
        done ? `تم رفع ${done} صورة، ثم توقف: ${error.message}` : error.message
      );
    } finally {
      busy = false;
      input.disabled = false;
      input.value = "";
      await load();
    }
  }

  async function removeImage(imageId) {
    if (busy || !window.confirm("هل تريد حذف هذه الصورة؟")) return;

    busy = true;

    try {
      const response = await fetch(`${API}?image=${imageId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await readJson(response);

      if (!response.ok) throw new Error(data.message || "تعذر حذف الصورة");
      setStatus("تم حذف الصورة");
    } catch (error) {
      setStatus(error.message);
    } finally {
      busy = false;
      await load();
    }
  }

  input.addEventListener("change", () => upload([...input.files]));
  select.addEventListener("change", load);

  // الاختيار قد يتغير برمجيًا من provider-dashboard.js
  new MutationObserver(load).observe(select, { childList: true });

  load();
})();
