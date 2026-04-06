# Forms — Hide Product Variants

GHL order forms with product variants (e.g., Monthly / Yearly plans) default to the first option and let the user switch. This script lets you pre-select a specific plan via URL parameter and optionally hide the Plan dropdown so users can't change it.

If you found this helpful, let me know at eric@uplevelpro.com

You must be an agency owner or have access to the Funnel/Website builder to use this.

If you don't have a GHL agency account yet, click here to get a free trial: https://www.gohighlevel.com/?fp_ref=uplevelpro32

## Installation

### Step 1: Add the Script

1. Open your Funnel or Website in the GHL builder
2. Go to **Settings > Tracking Code > Header**
3. Paste the following (wrapping the script in `<script>` tags):

```html
<script>
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
    setTimeout(function () {
      clearInterval(check);
    }, 5000);
  }
})();
</script>
```

4. Click **Save**

### Step 2: Hide the Plan Dropdown (Optional)

If you want to lock the selection so users can't switch plans:

1. Open the **Order Form** element in the builder
2. Go to the **Custom CSS** field
3. Add:

```css
#product-variant {
  display: none;
}
```

4. Click **Save**

## Usage

Append `?plan=<PlanName>` to your page URL. The value is case-insensitive and must match the option text in the dropdown.

**Examples:**

```
https://yourdomain.com/page?plan=Yearly
https://yourdomain.com/page?plan=Monthly
https://yourdomain.com/page?plan=yearly&coupon=SAVE10
```

## What It Does

- **Reads the `plan` URL parameter** — matches it against the Plan dropdown options (case-insensitive)
- **Auto-selects the matching plan** — clicks the option in the Vue Multiselect dropdown, which updates the displayed price
- **Polls for readiness** — checks every 300ms for up to 5 seconds, so it works regardless of page load timing
- **Optional CSS hides the dropdown** — prevents users from switching back to another plan

## How It Works

GHL order forms use a Vue Multiselect component (`#product-variant`) for the Plan dropdown. The script:

1. Parses `?plan=` from the URL query string
2. Polls until `#product-variant` and its `.multiselect__option` elements are in the DOM
3. Finds the option whose text matches the parameter value
4. Simulates a click on that option, triggering Vue's reactivity to update the selected plan and price

The optional CSS (`#product-variant { display: none; }`) hides the entire Plan row so the user only sees the pre-selected price.

## Compatibility

- Works on GHL Funnel and Website pages with embedded order forms
- Targets the `#product-variant` container used by GHL's Vue Multiselect component
- No external dependencies — pure vanilla JavaScript
- The Custom CSS field on the form element only accepts CSS (not JS), which is why the script goes in the Tracking Code header

## Author

**Eric Langley** | [UpLevelPro.com](https://www.uplevelpro.com)

## License

[MIT](../LICENSE)
