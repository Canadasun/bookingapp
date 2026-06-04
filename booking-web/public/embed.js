/* BookingApp embeddable booking widget.
 * Usage on any website:
 *   <script src="https://YOUR-WEB-URL/embed.js" data-business-id="public-business-id" async></script>
 * Backward compatible: data-slug="your-business-slug" still works.
 * Optional: data-target="#css-selector" to mount into a specific element.
 */
(function () {
  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName("script");
    script = all[all.length - 1];
  }
  var businessId = script.getAttribute("data-business-id");
  var slug = script.getAttribute("data-slug");
  if (!businessId && !slug) { console.error("[BookingApp] embed.js: missing data-business-id"); return; }

  // Origin = where this script was served from.
  var origin = new URL(script.src, location.href).origin;

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/book/" + encodeURIComponent(businessId || slug) + "?embed=1" + (businessId ? "&ref=business-id" : "");
  iframe.title = "Book an appointment";
  iframe.loading = "lazy";
  iframe.style.cssText = "width:100%;border:0;min-height:680px;background:transparent;";
  iframe.setAttribute("allow", "payment");

  var target = script.getAttribute("data-target");
  var mount = target ? document.querySelector(target) : null;
  if (mount) mount.appendChild(iframe);
  else script.parentNode.insertBefore(iframe, script.nextSibling);

  // Auto-resize: the booking page posts its height in embed mode.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin) return;
    var d = e.data;
    if (d && d.type === "bookingapp:height" && typeof d.height === "number") {
      iframe.style.height = Math.max(420, d.height) + "px";
    }
  });
})();
