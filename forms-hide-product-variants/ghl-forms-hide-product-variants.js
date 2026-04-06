// GHL Forms — Hide Product Variants & Pre-Select Plan via URL Parameter
// Author: Eric Langley | UpLevelPro.com
// License: MIT
//
// Usage: Add this script to the Funnel/Website Tracking Code (Header).
// Then append ?plan=Yearly (or ?plan=Monthly) to the page URL.
// Combine with Custom CSS to hide the Plan dropdown entirely.

(function () {
  var params = new URLSearchParams(window.location.search);
  var plan = params.get("plan");
  if (plan) {
    var check = setInterval(function () {
      var container = document.getElementById("product-variant");
      if (!container) return;
      var options = container.querySelectorAll(
        ".multiselect__element .multiselect__option"
      );
      for (var i = 0; i < options.length; i++) {
        var span = options[i].querySelector("span");
        if (
          span &&
          span.textContent.trim().toLowerCase() === plan.toLowerCase()
        ) {
          options[i].click();
          clearInterval(check);
          break;
        }
      }
    }, 300);
    // Stop polling after 5 seconds as a safety net
    setTimeout(function () {
      clearInterval(check);
    }, 5000);
  }
})();
