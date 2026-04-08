# Federal Web UI — AI Agent Standards

You are building a U.S. federal government web interface. These rules are non-negotiable. Read every rule before writing a single line of markup, CSS, or JavaScript.

---

## 1. Design System — USWDS 3.x

- Use **USWDS 3.x** exclusively. Load via the project's configured Sass/npm pipeline or via `unpkg.com/@uswds/uswds@latest` for static prototypes.
- Never invent utility classes that parallel or override USWDS tokens. Use `$theme-*` settings and USWDS design tokens only.
- Never use Tailwind, Bootstrap, Material, or any other CSS framework alongside USWDS. One system only.
- Spacing, color, typography, and layout must be expressed with USWDS tokens (`units()`, `color()`, `font()`, `typeset()`).
- Component markup must match USWDS component HTML exactly — class names, element order, ARIA attributes, and data attributes.

## 2. Required Page Shell — Every Page

Every HTML page must include these elements in this order:

```html
<!-- 1. Skip navigation (before everything) -->
<a class="usa-skipnav" href="#main-content">Skip to main content</a>

<!-- 2. Official government banner -->
<section class="usa-banner" aria-label="Official website of the United States government">
  <!-- usa-banner component markup -->
</section>

<!-- 3. Site header -->
<header class="usa-header usa-header--extended" role="banner">
  <!-- usa-header component markup -->
</header>

<!-- 4. Main content landmark -->
<main id="main-content">
  <!-- page content -->
</main>

<!-- 5. Footer -->
<footer class="usa-footer">
  <!-- usa-footer component markup -->
</footer>

<!-- 6. Identifier (parent agency attribution) -->
<div class="usa-identifier">
  <!-- usa-identifier component markup -->
</div>
```

Never omit the banner, skip-nav, `id="main-content"`, or identifier. These are federal compliance requirements, not suggestions.

## 3. Accessibility — Section 508 / WCAG 2.1 AA

### Semantic Structure
- One `<h1>` per page. Headings must be hierarchically ordered: `h1` → `h2` → `h3`. No skipping levels.
- Use HTML5 landmark elements: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `<section aria-label="...">`.
- Every `<nav>` must have a unique `aria-label` if more than one nav exists on the page.
- Use `<ul>` or `<ol>` for navigation lists; screen readers announce list item counts.

### Images and Media
- Every `<img>` requires an `alt` attribute. Descriptive alt text for informational images. `alt=""` only for purely decorative images.
- Never use CSS `background-image` for informational images; use `<img>` with alt text.
- All video requires closed captions. All audio requires a transcript.
- SVG icons used as UI controls require `aria-label` or `<title>` inside the SVG.

### Forms
- Every `<input>`, `<select>`, and `<textarea>` must have a programmatically associated `<label>` (using `for`/`id` pairing). Never use `placeholder` as a label substitute.
- Required fields: mark with an asterisk (*) in the label AND `required` attribute on the input. Include a legend at the top of the form: "Required fields are marked with an asterisk (*)."
- Every form field should have a `hint` element using `aria-describedby` for format guidance (e.g., "Enter date as MM/DD/YYYY").
- Use `<fieldset>` and `<legend>` for groups of related controls (radio buttons, checkboxes).
- Validation error messages must be injected adjacent to the field and announced via `aria-live="polite"` or `role="alert"`.
- Use the USWDS `usa-form`, `usa-label`, `usa-input`, `usa-hint`, `usa-error-message` classes exactly as documented.

### Keyboard and Focus
- All interactive elements must be reachable and operable via keyboard alone (Tab, Shift+Tab, Enter, Space, arrow keys).
- Never remove the focus outline. USWDS provides focus styles; do not override with `outline: none` or `outline: 0`.
- Modal dialogs must trap focus within the modal while open and return focus to the trigger element on close.
- Custom components (dropdowns, accordions, tabs) must implement the ARIA authoring patterns from `www.w3.org/WAI/ARIA/apg`.

### Color and Contrast
- Text contrast ratio: minimum 4.5:1 for normal text, 3:1 for large text (18pt / 14pt bold).
- Never convey information by color alone. Always pair color with text, icon, or pattern.
- Test all color combinations using USWDS color tokens only; do not hardcode hex values.
- Do not use `color-scheme: dark` or automatic dark mode without explicit design review.

### Interaction
- Link text must be descriptive on its own — never "click here," "read more," or "learn more" without context.
- External links must indicate they open in a new tab if `target="_blank"` is used, with `aria-label` or visible text.
- Avoid `target="_blank"` unless the link opens a document or tool where navigation context loss is harmful.

## 4. Typography

- **Body font:** Source Sans Pro (loaded via USWDS). Set `$theme-font-body: 'source-sans-pro'`.
- **Heading font:** Merriweather (loaded via USWDS). Set `$theme-font-heading: 'merriweather'`.
- **UI / label font:** Source Sans Pro. Set `$theme-font-ui: 'source-sans-pro'`.
- Never use `system-ui`, `Arial`, `Helvetica`, or any generic sans-serif as the primary font.
- Never import fonts from Google Fonts, Adobe Fonts, or any non-federal CDN without explicit security approval. USWDS self-hosts all approved fonts.
- Font size: minimum 16px (1rem) for body copy. Never set body text below 16px.
- Line height: minimum 1.5 for body paragraphs.

## 5. Visual Design Discipline

- **No AI slop.** Do not generate: gradient mesh backgrounds, glassmorphism panels, floating card shadows with colored blurs, stock photo heroes, or any visual pattern that signals generic AI-generated aesthetics.
- **No emojis.** Not in UI text, button labels, headings, alt text, tooltips, placeholder text, code comments, or commit messages. Use real icons instead.
- **No filler content.** Do not use lorem ipsum or placeholder copy in any output that will be reviewed. Every text block must be real, purposeful, and reviewed for plain language (8th grade reading level target per federal plain language guidelines).
- Photography and illustration: use only agency-approved imagery. Never use stock photo URLs or unsplash/pexels links.
- Animations: USWDS transitions only. Respect `prefers-reduced-motion`. No auto-playing carousels.

## 5a. Icons — USWDS Icon Library

Use the **USWDS icon set** exclusively. USWDS provides 200+ icons from the Material Symbols and Font Awesome libraries, pre-approved for federal use.

### How to Use USWDS Icons

```html
<svg class="usa-icon" aria-hidden="true" focusable="false" role="img">
  <use xlink:href="/assets/img/sprite.svg#arrow_forward"></use>
</svg>
```

For icons that convey meaning (not purely decorative), add accessible text:

```html
<a href="/search" class="usa-button">
  <svg class="usa-icon" aria-hidden="true" focusable="false" role="img">
    <use xlink:href="/assets/img/sprite.svg#search"></use>
  </svg>
  Search recalls
</a>
```

### Icon Sizing

Use USWDS size tokens:
- `usa-icon--size-3` (24px) — default, inline with text
- `usa-icon--size-4` (32px) — buttons, navigation
- `usa-icon--size-5` (40px) — feature icons, cards
- `usa-icon--size-6` (48px) — hero icons, large callouts
- `usa-icon--size-7` to `usa-icon--size-9` — decorative feature blocks

### Common Federal UI Icons

| Purpose | Icon name |
|---------|-----------|
| External link | `launch` |
| Search | `search` |
| Warning/alert | `warning` |
| Info | `info` |
| Success | `check_circle` |
| Error | `error` |
| Close | `close` |
| Menu | `menu` |
| Arrow forward | `arrow_forward` |
| Arrow back | `arrow_back` |
| Download | `file_download` |
| Print | `print` |
| Email | `mail` |
| Phone | `phone` |
| Location | `location_on` |
| Calendar | `event` |
| Person/account | `account_circle` |
| Settings | `settings` |
| Help | `help` |
| Home | `home` |
| Lock (secure) | `lock` |
| Accessibility | `accessibility_new` |
| Government | `account_balance` |
| Vehicle | `directions_car` |
| Medical | `medical_services` |
| Food | `restaurant` |
| Report problem | `report` |

### Icon Rules

- Never use emoji as a substitute for icons.
- Never import Font Awesome, Material Icons, Heroicons, or other third-party icon libraries.
- Always include `aria-hidden="true"` on decorative icons.
- Always pair icons with visible text labels for actions — icon-only buttons are not accessible without `aria-label`.
- For CDN usage, load the sprite from `https://unpkg.com/@uswds/uswds@3.13.0/dist/img/sprite.svg`.
- **Verify icons exist** before using them. The USWDS sprite contains ~245 icons. Not all Material Icons are included. Check the sprite file or USWDS documentation if unsure.
- Common icons that do **NOT** exist in USWDS sprite: `inventory_2`, `spa`, `directions_boat`, `sailing`, `anchor`. Use alternatives like `shopping_basket`, `science`, `flag`, `public`.

## 5b. Design Excellence — Beyond Compliance

USWDS compliance is the floor, not the ceiling. Federal sites should be **distinctive, modern, and delightful to use** — not generic or institutional-looking.

### Visual Hierarchy

- **Establish clear focal points.** Every page should have one primary action or message that draws the eye first.
- **Use whitespace generously.** Crowded layouts feel bureaucratic. Give content room to breathe with USWDS spacing tokens (`margin-top-4`, `padding-y-6`, etc.).
- **Create visual rhythm.** Alternate section backgrounds (light/dark) to break up long pages. Use `usa-section--light` and `usa-section--dark` variants.
- **Size matters.** Make primary headings large and confident. Use USWDS `display` type scale for hero headings.

### Color Strategy

- **Use the full USWDS palette.** Don't default to just blue and white. USWDS provides vivid, accessible accent colors: gold, green, cyan, orange, and red. Use them intentionally for:
  - Category differentiation
  - Status indicators
  - Call-to-action accents
  - Interactive state changes
- **Dark sections add drama.** A dark (`primary-darker` or `ink`) section with white text creates visual impact and signals importance.
- **Accent borders and highlights.** A bold left border (`border-left-1`, `border-left-05`) in an accent color draws attention to key information.

### Card and Component Design

- **Consistent card heights.** In a card grid, all cards in a row should have equal height (use CSS Grid or Flexbox with `align-items: stretch`).
- **Clear card anatomy.** Every card should have: a visual anchor (icon, logo, or image), a heading, body text, and a clear action.
- **Icon-led cards.** For category navigation, use a large icon (size-7 or larger) as the visual anchor instead of or in addition to text.
- **Hover and focus states.** Add subtle transitions on interactive cards — background color shift, slight shadow increase, or border accent.

### Layout Patterns

- **Asymmetric layouts.** Don't default to equal-width columns. A 2/3 + 1/3 split or 3/4 + 1/4 creates more dynamic compositions.
- **Feature blocks.** For key messages, use a full-width section with large icon + heading + description + CTA button.
- **Icon grids.** For navigation hubs, use a grid of icon-led cards (3-up or 4-up) with consistent sizing.
- **Sidebar patterns.** On informational pages, use a sticky sidebar for navigation or key contact info.

### Micro-interactions

- **Button feedback.** Buttons should have visible hover/focus/active states. USWDS provides these by default — do not flatten them.
- **Link underlines.** Keep underlines on text links (USWDS default). This is an accessibility requirement.
- **Smooth transitions.** Use `transition: all 0.2s ease` for hover effects. Keep it subtle — no bouncing or dramatic animations.

### What Makes a Federal Site Feel Modern (Not Dated)

| Dated pattern | Modern alternative |
|---------------|-------------------|
| Tiny body text (14px) | 16-18px body, generous line height |
| Cramped spacing | USWDS `padding-y-6` or more between sections |
| Blue-only color scheme | Accent colors for differentiation |
| Icon-free layouts | Strategic icon use for wayfinding |
| Centered everything | Left-aligned text with intentional whitespace |
| Walls of text | Scannable headings, bullets, cards |
| Generic stock photos | Iconography, data viz, or no imagery |
| Dropdown mega-menus | Simple, focused navigation |

## 6. Layout and Responsiveness

- Use the USWDS 12-column grid: `usa-grid`, `usa-grid-container`, `grid-col-*`, `tablet:grid-col-*`, `desktop:grid-col-*`.
- Mobile-first. Write styles for 320px viewport first, then add `tablet:` and `desktop:` prefixes.
- Never use fixed pixel widths on containers. Use `grid-container` (max 1200px) or `grid-container--widescreen`.
- Test at 320px, 480px, 640px (mobile-lg), 768px (tablet), 1024px (desktop), and 1400px (widescreen).
- Touch targets must be at least 44x44px.

## 7. Security

- No inline event handlers (`onclick="..."`, `onload="..."`, `onerror="..."`). Attach all event listeners in external JS files.
- No `eval()`, `innerHTML` assignments with untrusted data, or `document.write()`.
- All markup must be compatible with a strict Content Security Policy (`default-src 'self'`). Do not embed base64 data URIs in HTML.
- No third-party analytics, tracking pixels, or tag manager scripts without explicit agency IT security approval.
- External links to non-.gov or non-.mil domains must not use `rel="noreferrer"` removal unless intentional.
- Forms must include CSRF protection tokens when submitting to a server.
- Never hardcode API keys, credentials, or sensitive configuration values in source files.

## 8. Page Title Convention

Every page `<title>` must follow this exact pattern:

```
[Page Name] | [Site Name] | [Agency Full Name]
```

Examples:
- `Consumer Product Recalls | Recalls.gov | U.S. Consumer Product Safety Commission`
- `Contact Us | Agency Portal | U.S. Department of Homeland Security`

## 9. Navigation and Wayfinding

- Interior pages must include `usa-breadcrumb` immediately inside `<main>` before the page heading.
- Active navigation item must be marked with `aria-current="page"`.
- Primary nav items must not exceed 7 items (cognitive load limit).
- Navigation labels must be plain English nouns or short noun phrases — no jargon, acronyms-without-expansion, or verbs-as-menu-items.

## 10. Content and Plain Language

- Reading level: target 8th grade (Flesch-Kincaid). Use short sentences, active voice, and common words.
- Headings must describe the content that follows. No heading should be "Overview" or "Introduction" without context.
- Do not use "utilize" when "use" suffices. Do not use "leverage" as a verb. Do not use "synergy" anywhere.
- Dates: spell out month names (`April 8, 2026`). Never use ambiguous formats (`04/08/26`).
- Phone numbers: format as `(800) 555-0100`. Always provide a TTY alternative where voice phone is listed.
- Addresses: follow USPS standard format.

## 10a. GSA Content Standards (per OMB M-23-22)

Follow GSA's content standards for all federal web content. Reference: https://www.gsa.gov/reference/gsa-web-style-guide/content-standards

### Timeliness
- Review all content **at least once every three years** from initial publication or last review date.
- Consolidate or remove outdated content per OMB Memo M-23-22.

### Usefulness
- Write so anyone who needs the content can **find, understand, and use it the first time**.
- Use clear, intentional calls to action.
- Use clear page titles and headings — skip acronyms and government jargon.
- Use files and formats accessible to all users.
- Use short sentences and words for easy scanning.

### Readability
- There is no mandated grade level, but work to **incrementally lower** the reading level from where it started.
- Use readability tools (e.g., Siteimprove, Hemingway) to assess and improve.

### Free of Duplication
- **Never publish the same or similar content in multiple places.** Duplication creates confusion, inconsistency, and extra maintenance cost.
- Duplication is prohibited under OMB M-23-22.
- Continually de-duplicate existing content.

### Accuracy
- When experts request content updates for accuracy, aim to complete revisions within **three business days**.
- Have a subject matter expert review revisions before publishing.

### Consistency
- Follow the agency's written style guide when adding or editing text.
- Follow the agency's visual style (USWDS components, imagery) for all graphic elements.

### OMB-Approved Content
- **Do not modify OMB-approved content text** without proper review and re-approval.
- If content must be removed, do so without altering the remaining approved text.
- Mark any content that has been officially reviewed/approved so it is not inadvertently changed.

## 11. Reusable Components

- Any markup block repeated more than once must be extracted to an include, partial, component, or template file.
- Name component files with a `usa-` prefix for USWDS wrappers, or an agency-specific prefix for custom components.
- Document every custom component with: purpose, props/inputs, accessibility notes, and usage example.
- Do not build a custom component if a USWDS component already satisfies the need.

## 12. File and Code Organization

- HTML files: lowercase, hyphenated filenames (`consumer-products.html`, not `ConsumerProducts.html`).
- CSS: custom overrides go in a single `_theme-settings.scss` file using USWDS tokens. Never edit USWDS source files directly.
- JavaScript: one purpose per file. Filename describes the behavior (`accordion-init.js`, not `scripts.js`).
- No commented-out code blocks in committed files. Remove dead code; use version control for history.
- No `TODO` comments in production-bound files.

## 13. Federal Footer Requirements

The footer must contain (at minimum):
- Link to **Privacy Policy**
- Link to **Accessibility Statement**
- Link to **Vulnerability Disclosure Policy**
- Link to **No FEAR Act Data** (if required by agency)
- Link to agency **FOIA** page
- The `usa-identifier` component listing the parent agency

## 14. What to Do When Uncertain

- If a design decision is ambiguous, choose the USWDS default. Do not invent custom patterns.
- If a component does not exist in USWDS, check `designsystem.digital.gov/patterns` for a documented pattern before building from scratch.
- If a security question arises, err on the side of restriction and document the decision.
- If accessibility guidance conflicts with a visual design request, accessibility wins.
