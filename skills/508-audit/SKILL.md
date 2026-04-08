# SKILL: Section 508 / WCAG 2.1 AA Accessibility Audit

## When to Use This Skill

Read and follow this skill when you are:
- Auditing an existing federal web page for accessibility compliance
- Reviewing a pull request or design implementation for 508 issues
- Remediating accessibility failures found in a report
- Writing an Accessibility Conformance Report (ACR / VPAT)

This skill provides a structured, systematic audit process for federal web content. Work through every section in order. Document failures with the specific WCAG success criterion number.

---

## Audit Scope Reference

| Standard | Requirement |
|---|---|
| Section 508 | WCAG 2.0 Level A and AA (38 success criteria) |
| Federal best practice | WCAG 2.1 Level AA (adds 12 criteria beyond 2.0) |
| USWDS compliance | WCAG 2.1 AA — all USWDS components are designed to this level |

When auditing federal sites, test against **WCAG 2.1 AA** minimum.

---

## Audit Process

### Before You Begin

1. Open the page in a browser with no assistive technology.
2. Disable all browser extensions.
3. Note the page URL, page title, and date of audit.
4. For each finding, record:
   - WCAG Success Criterion (e.g., 1.1.1 Non-text Content)
   - Level (A or AA)
   - Element or location on the page
   - Description of the failure
   - Recommended remediation

---

## Category 1: Perceivable

### 1.1 — Text Alternatives

**WCAG 1.1.1 Non-text Content (Level A)**

Check every `<img>` on the page:

```
For each <img>:
  - Does it have an alt attribute? (Failure if missing entirely)
  - If the image conveys information: is alt descriptive and equivalent?
  - If the image is decorative: is alt="" (empty string, not "image" or "photo")?
  - If the image is a logo: does alt contain the organization name?
  - If the image is a chart/graph: is there a long description linked or adjacent?
```

Check CSS background images used for content (failure if they convey information without a text equivalent).

Check `<input type="image">`: must have `alt` describing the button action.

Check `<svg>`:
- Purely decorative: `aria-hidden="true"`
- Informational: has `<title>` as first child, and `role="img"` on the `<svg>`
- Interactive (icon button): the `<button>` has `aria-label`

### 1.2 — Time-based Media

**WCAG 1.2.1 Audio-only and Video-only (Level A)**
- Pre-recorded audio-only: text transcript must exist on the page or be linked.
- Pre-recorded video-only (no audio): text description or audio description track must exist.

**WCAG 1.2.2 Captions (Pre-recorded) (Level A)**
- All video with audio must have accurate closed captions.
- Auto-generated captions alone are insufficient without review and correction.

**WCAG 1.2.3 Audio Description or Media Alternative (Level A)**
- Pre-recorded video with audio: either an audio description track or a full text alternative must exist.

**WCAG 1.2.4 Captions (Live) (Level AA)**
- Live video must have real-time captions.

**WCAG 1.2.5 Audio Description (Pre-recorded) (Level AA)**
- Pre-recorded video must have an audio description track if the visual content conveys information not present in the audio.

### 1.3 — Adaptable

**WCAG 1.3.1 Info and Relationships (Level A)**

Check semantic structure:
- Is there exactly one `<h1>`?
- Do headings follow logical hierarchy (h1 > h2 > h3, no skipped levels)?
- Are lists marked up as `<ul>`, `<ol>`, or `<dl>` (not paragraphs with bullet characters)?
- Are data tables using `<th>` with `scope` attributes?
- Are form inputs associated with `<label>` elements (not just adjacent text)?
- Are `<fieldset>` and `<legend>` used for radio/checkbox groups?
- Are landmark regions present: `<header>`, `<nav>`, `<main>`, `<footer>`?

**WCAG 1.3.2 Meaningful Sequence (Level A)**
- Does the DOM order match the visual reading order?
- Is CSS being used to visually reorder content that is meaningful in sequence?

**WCAG 1.3.3 Sensory Characteristics (Level A)**
- Are instructions that refer to shape, color, size, or position also accompanied by text labels?
- Example failure: "Click the green button" — no text label on the button itself.

**WCAG 1.3.4 Orientation (Level AA)**
- Does the page work in both portrait and landscape orientation?
- Is orientation locked to one direction without a functional reason?

**WCAG 1.3.5 Identify Input Purpose (Level AA)**
- Do form fields that collect personal information (name, email, phone, address) have appropriate `autocomplete` attributes?

```html
<!-- Correct -->
<input type="email" autocomplete="email" id="email" name="email" />
<input type="text" autocomplete="given-name" id="first-name" name="first-name" />
```

### 1.4 — Distinguishable

**WCAG 1.4.1 Use of Color (Level A)**
- Is color the only means of conveying information?
- Test: print page in grayscale — does all information remain understandable?

**WCAG 1.4.2 Audio Control (Level A)**
- Does any audio play automatically for more than 3 seconds?
- If yes: is there a mechanism to pause, stop, or mute it?

**WCAG 1.4.3 Contrast (Minimum) (Level AA)**
- Normal text (below 18pt regular or 14pt bold): contrast ratio must be at least **4.5:1**.
- Large text (18pt+ regular or 14pt+ bold): contrast ratio must be at least **3:1**.
- Use browser dev tools or the axe extension to measure. Never eyeball contrast.

**WCAG 1.4.4 Resize Text (Level AA)**
- Set browser zoom to 200%. Does text resize without content being cut off or overlapping?

**WCAG 1.4.5 Images of Text (Level AA)**
- Is text rendered as an image? (Logos and essential graphics are excepted.)
- Failure: headings or body copy rendered as PNG/JPEG instead of HTML text.

**WCAG 1.4.10 Reflow (Level AA)**
- At 400% zoom (320px CSS width equivalent): does the page reflow without horizontal scrolling?
- Failure: fixed-width containers that force side-scrolling at 400% zoom.

**WCAG 1.4.11 Non-text Contrast (Level AA)**
- UI component boundaries (input borders, button outlines, focus indicators): at least **3:1** contrast against adjacent colors.
- Informational graphics: at least **3:1** contrast.

**WCAG 1.4.12 Text Spacing (Level AA)**
- Inject the following CSS and verify no content is lost or overlaps:
```css
* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-bottom: 2em !important; }
```

**WCAG 1.4.13 Content on Hover or Focus (Level AA)**
- Tooltip or popover content that appears on hover/focus:
  - Can be dismissed without moving the pointer (Escape key)?
  - Does it remain visible while the pointer is over it?
  - Does it not disappear until the user moves focus away?

---

## Category 2: Operable

### 2.1 — Keyboard Accessible

**WCAG 2.1.1 Keyboard (Level A)**
- Can all interactive elements be reached with the Tab key?
- Can all interactive elements be activated with Enter or Space?
- Can dropdown menus, modals, and accordions be opened and closed with keyboard?
- No mouse-only interactions.

**WCAG 2.1.2 No Keyboard Trap (Level A)**
- Press Tab repeatedly. Is focus ever trapped in a component and unable to continue past it?
- Exception: modal dialogs intentionally trap focus — verify Escape closes the modal.

**WCAG 2.1.4 Character Key Shortcuts (Level A)**
- If single-character keyboard shortcuts exist: is there a way to remap or disable them?

### 2.2 — Enough Time

**WCAG 2.2.1 Timing Adjustable (Level A)**
- If the page has a session timeout: is the user warned and given the option to extend?

**WCAG 2.2.2 Pause, Stop, Hide (Level A)**
- Auto-updating content (carousels, news tickers): can the user pause, stop, or hide it?

### 2.3 — Seizures and Physical Reactions

**WCAG 2.3.1 Three Flashes or Below Threshold (Level A)**
- Does any content flash more than 3 times per second? (Failure — remove or fix.)

### 2.4 — Navigable

**WCAG 2.4.1 Bypass Blocks (Level A)**
- Is there a skip navigation link as the first focusable element on the page?
- Does it link to `#main-content` and does that `id` exist?

**WCAG 2.4.2 Page Titled (Level A)**
- Does the `<title>` element accurately describe the page?
- Does it follow the `[Page Name] | [Site Name] | [Agency]` pattern?

**WCAG 2.4.3 Focus Order (Level A)**
- Tab through the page in order. Does focus move in a logical, predictable sequence?

**WCAG 2.4.4 Link Purpose (In Context) (Level A)**
- Is every link's purpose clear from its text alone or from its context (surrounding paragraph, table cell, list)?
- Failures: "click here," "read more," "learn more," "details," numbered-only links.

**WCAG 2.4.5 Multiple Ways (Level AA)**
- Can users find pages via more than one method (navigation menu + search, or navigation + sitemap)?

**WCAG 2.4.6 Headings and Labels (Level AA)**
- Do headings accurately describe the content that follows?
- Do form labels accurately describe the input they label?

**WCAG 2.4.7 Focus Visible (Level AA)**
- Tab through every interactive element. Is a visible focus indicator present on every one?
- Failure: `outline: none` or `outline: 0` removing the focus ring.

---

## Category 3: Understandable

### 3.1 — Readable

**WCAG 3.1.1 Language of Page (Level A)**
- Does the `<html>` element have `lang="en"` (or the appropriate language code)?

**WCAG 3.1.2 Language of Parts (Level AA)**
- If content in another language appears inline (a phrase, a quote), is it wrapped with `lang="[code]"`?

### 3.2 — Predictable

**WCAG 3.2.1 On Focus (Level A)**
- Does receiving focus on any element trigger an unexpected change of context (navigation, form submission, popup)?

**WCAG 3.2.2 On Input (Level A)**
- Does changing a form control's value automatically trigger navigation or context change?
- Failure: `<select>` with `onchange="window.location = this.value"` without a submit button.

**WCAG 3.2.3 Consistent Navigation (Level AA)**
- Does the navigation appear in the same location on every page?
- Are navigation items in the same relative order on every page?

**WCAG 3.2.4 Consistent Identification (Level AA)**
- Are components that have the same function identified consistently across all pages?
- Failure: the search field is labeled "Search" on some pages and "Find" on others.

### 3.3 — Input Assistance

**WCAG 3.3.1 Error Identification (Level A)**
- When a form error occurs: is the field identified and the error described in text?
- Failure: only a red border to indicate error, no text message.

**WCAG 3.3.2 Labels or Instructions (Level A)**
- Do all form fields have labels or instructions visible before submission?
- Are required fields marked as required before the user submits?

**WCAG 3.3.3 Error Suggestion (Level AA)**
- When a form field has a known valid format: does the error message suggest the correct format?
- Example: "Enter a date in MM/DD/YYYY format."

**WCAG 3.3.4 Error Prevention (Legal, Financial, Data) (Level AA)**
- For pages that cause legal or financial commitments: can the user review, correct, and confirm before final submission?

---

## Category 4: Robust

### 4.1 — Compatible

**WCAG 4.1.1 Parsing (Level A)**
- Validate the HTML using `validator.w3.org`. No duplicate IDs, no unclosed tags, no invalid nesting.

**WCAG 4.1.2 Name, Role, Value (Level A)**
- All UI components: do they expose name, role, and state to assistive technology?
- Custom components (built without native HTML): do they use proper ARIA roles and attributes?
- State changes (expanded, checked, selected, pressed): are they communicated via `aria-*` attributes?

**WCAG 4.1.3 Status Messages (Level AA)**
- Status messages (form submission success, search results count, loading complete) that appear without focus: are they implemented with `aria-live` or `role="status"` or `role="alert"`?

---

## Screen Reader Testing Protocol

Test with at least two combinations:
1. NVDA + Firefox (Windows) — most common federal user combination
2. VoiceOver + Safari (macOS / iOS)
3. JAWS + Chrome (Windows) — widely used in federal agencies

For each page, verify with screen reader:
1. Banner reads "An official website of the United States government"
2. Skip nav link is announced and functional
3. Page heading (`<h1>`) is announced correctly
4. Navigation landmark is announced with its label
5. All images are announced with appropriate alt text (or skipped if decorative)
6. All form labels are read before the input
7. Error messages are announced when triggered
8. Interactive components (accordions, tabs, modals) announce state changes

---

## Automated Testing Tools

Use these tools as a starting point, not a final answer. Automated tools catch approximately 30% of WCAG issues. Manual testing is required.

| Tool | What it finds | How to use |
|---|---|---|
| axe DevTools (browser extension) | ~30% of WCAG issues | Run on each page; fix all critical and serious issues |
| WAVE (browser extension) | Structure, contrast, alt text | Supplement axe findings |
| Lighthouse Accessibility Audit | Subset of axe | Useful for CI pipeline integration |
| Color Contrast Analyzer (desktop) | Precise contrast ratios | Use for images, graphics, and custom UI |
| Pa11y (CLI) | Automated batch testing | Integrate into build pipeline |

---

## Reporting Format

For each finding, use this format:

```
FINDING #[N]
Page: [URL]
WCAG Criterion: [X.X.X] [Criterion Name] (Level [A/AA])
Location: [CSS selector, line number, or plain description]
Failure: [What is wrong]
Impact: [Who is affected and how]
Remediation: [Specific code or content change required]
Priority: Critical / Serious / Moderate / Minor
```

Priority guidance:
- **Critical** — Blocks access completely for some users (e.g., keyboard trap, missing form labels)
- **Serious** — Significant barrier; some users cannot complete a task (e.g., low contrast, missing alt text)
- **Moderate** — Creates difficulty but workaround exists (e.g., redundant alt text)
- **Minor** — Best practice deviation, minimal user impact (e.g., inconsistent heading capitalization)

Fix all Critical and Serious findings before launch. Schedule Moderate and Minor findings in the next sprint.
