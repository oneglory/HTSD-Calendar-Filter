# HTSD Calendar Filter

A Tampermonkey userscript that replaces the Hamilton Township School District calendar's tedious filter UI with a clean floating panel.

## The Problem

The [HTSD calendar](https://www.htsdnj.org/our-district/hamilton-township-school-district-calendar) requires you to:

1. Click a school name to expand it and reveal its checkbox
2. Uncheck the schools you don't want
3. Repeat for every single school
4. Click "Update Calendar"

There are over 20 schools. This script replaces that entire flow with two clicks.

## What It Does

- Injects a floating panel in the top-right corner of the calendar page
- **Step 1** expands all school categories and loads every available calendar into a checklist inside the panel
- **Step 2** applies your selection — the script clicks the site's own checkboxes in sequence and fires Update Calendar automatically
- Selections are adjustable on the fly without reloading the page
- **Reset calendar to default** wipes localStorage, sessionStorage, and site cookies, then reloads — useful when the site holds onto a cached filter state between visits

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser. Remember to ["Allow Userscripts" in the Manage Extension menu](https://www.tampermonkey.net/faq.php?q=Q209#Q209)"
2. Click the raw view of `htsd-calendar-filter-v9.user.js` in this repo or just [Click here](https://raw.githubusercontent.com/oneglory/HTSD-Calendar-Filter/main/htsd-calendar-filter-v9.user.js) to auto install if Tampermonkey is already installed on your browser.
3. Tampermonkey will detect the userscript and prompt you to install it
4. Click **Install**

## Usage

1. Visit the [HTSD calendar page](https://www.htsdnj.org/our-district/hamilton-township-school-district-calendar)
2. **Scroll the school list on the left sidebar up and down once.** The site lazy-loads its checkboxes — they don't exist in the DOM until scrolled into view.
3. Click **Step 1 — Load schools** in the floating panel
4. Check the schools you want to see
5. Click **Step 2 — Apply filter**

The calendar will update to show only your selected schools. You can adjust your selection and click Step 2 again at any time without reloading.

## Pre-selecting Your Schools

If you want specific schools checked by default when the panel loads, edit the `MY_SCHOOLS` array near the top of the script:

```js
const MY_SCHOOLS = ['Grice', 'Sunnybrae'];
```

Add any name fragment that matches the school's calendar name. The match is case-insensitive.

## Troubleshooting

**"No checkboxes found" after clicking Step 1**
Scroll the left sidebar up and down, then click Step 1 again. The site uses lazy loading and the checkboxes won't render until the sidebar has been scrolled.

**Calendar looks blank after applying a filter**
The site may be holding onto a cached filter state. Click **Reset calendar to default** to wipe stored data and start fresh.

**The panel is covering content I need to see**
The panel is draggable — click and drag the blue header to reposition it anywhere on the screen.

## Browser Compatibility

Tested in Chrome with Tampermonkey. Should work in any browser that supports Tampermonkey or Violentmonkey.

## Notes

This script interacts with a Finalsite CMS calendar. If HTSD updates their calendar platform, selectors may need to be updated. The core approach — finding checkboxes by walking the DOM rather than relying on specific class names — is intentionally flexible to survive minor site updates.
