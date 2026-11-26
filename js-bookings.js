/* Meead - Customer Bookings Page Loader */
"use strict";

/*
 * واجهة حجوزات العميل أصبحت في:
 * my-bookings.html
 * js/my-bookings.js
 *
 * هذا الملف لم يعد ينشئ قسم حجوزاتي داخل الصفحة الرئيسية.
 * نحتفظ به مؤقتًا لتجنب كسر أي صفحة أخرى ما زالت تستدعيه.
 */

document.addEventListener("DOMContentLoaded", () => {
  const isCustomerBookingsPage =
    window.location.pathname.endsWith("my-bookings.html");

  if (isCustomerBookingsPage) {
    console.warn(
      "Meead: حمّل my-bookings.js بدلًا من js/bookings.js في صفحة حجوزاتي."
    );
  }
});
