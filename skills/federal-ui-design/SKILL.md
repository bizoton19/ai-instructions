# SKILL: Federal Web UI Design with USWDS

## When to Use This Skill

Read and follow this skill whenever you are:
- Building a new federal government web page or site from scratch
- Redesigning or modernizing an existing federal web page
- Implementing a new feature or section on a federal site
- Creating reusable UI components for federal use

This skill walks you through the complete, ordered workflow for producing a 508-compliant, USWDS-conformant, professional federal web interface.

---

## Prerequisites — Confirm Before Starting

Before writing any markup:

1. **Confirm the managing agency.** The identifier component, footer, and page titles all require the official agency name and URL.
2. **Confirm the site name.** Used in `<title>`, header logo text, and breadcrumbs.
3. **Confirm USWDS delivery method:**
   - CDN (static prototypes): `https://unpkg.com/@uswds/uswds@3.13.0/dist/`
   - npm + Sass pipeline (production): `@uswds/uswds` package with `uswds-compile`
4. **Confirm page purpose.** Every page must have a single, clear purpose. Name it before building it.
5. **Confirm the content inventory.** Real copy only. No lorem ipsum, no placeholder headings.

---

## Step 1: Set Up the HTML Shell

Every page starts with this exact shell. Do not modify the order of these elements.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="[Plain-language description of this page's purpose]" />
  <title>[Page Name] | [Site Name] | [Agency Full Name]</title>

  <!-- USWDS CSS -->
  <link rel="stylesheet" href="/assets/css/uswds.min.css" />
</head>
<body>

  <!-- REQUIRED: Skip navigation — must be the very first interactive element -->
  <a class="usa-skipnav" href="#main-content">Skip to main content</a>

  <!-- REQUIRED: Official government banner -->
  <section class="usa-banner" aria-label="Official website of the United States government">
    <div class="usa-accordion">
      <header class="usa-banner__header">
        <div class="usa-banner__inner">
          <div class="grid-col-auto">
            <img
              aria-hidden="true"
              class="usa-banner__header-flag"
              src="/assets/img/us_flag_small.png"
              alt=""
            />
          </div>
          <div class="grid-col-fill tablet:grid-col-auto" aria-hidden="true">
            <p class="usa-banner__header-text">
              An official website of the United States government
            </p>
            <p class="usa-banner__header-action">Here's how you know</p>
          </div>
          <button
            type="button"
            class="usa-accordion__button usa-banner__button"
            aria-expanded="false"
            aria-controls="gov-banner-default-default"
          >
            <span class="usa-banner__button-text">Here's how you know</span>
          </button>
        </div>
      </header>
      <div
        class="usa-banner__content usa-accordion__content"
        id="gov-banner-default-default"
        hidden
      >
        <div class="grid-row grid-gap-lg">
          <div class="usa-banner__guidance tablet:grid-col-6">
            <img
              class="usa-banner__icon usa-media-block__img"
              src="/assets/img/icon-dot-gov.svg"
              role="img"
              alt=""
              aria-hidden="true"
            />
            <div class="usa-media-block__body">
              <p>
                <strong>Official websites use .gov</strong><br />
                A <strong>.gov</strong> website belongs to an official government
                organization in the United States.
              </p>
            </div>
          </div>
          <div class="usa-banner__guidance tablet:grid-col-6">
            <img
              class="usa-banner__icon usa-media-block__img"
              src="/assets/img/icon-https.svg"
              role="img"
              alt=""
              aria-hidden="true"
            />
            <div class="usa-media-block__body">
              <p>
                <strong>Secure .gov websites use HTTPS</strong><br />
                A <strong>lock</strong> or <strong>https://</strong> means you've
                safely connected to the .gov website. Share sensitive information
                only on official, secure websites.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- REQUIRED: Site header -->
  <header class="usa-header usa-header--extended" role="banner">
    <!-- See Step 2 -->
  </header>

  <!-- REQUIRED: Main content landmark with matching id -->
  <main id="main-content">
    <!-- See Step 3 -->
  </main>

  <!-- REQUIRED: Footer -->
  <footer class="usa-footer usa-footer--slim">
    <!-- See Step 4 -->
  </footer>

  <!-- REQUIRED: Identifier -->
  <div class="usa-identifier">
    <!-- See Step 4 -->
  </div>

  <!-- USWDS JS -->
  <script src="/assets/js/uswds-init.min.js"></script>
  <script src="/assets/js/uswds.min.js"></script>
</body>
</html>
```

---

## Step 2: Build the Header

Choose the appropriate header variant:

| Variant | When to use |
|---|---|
| `usa-header--basic` | Simple sites with 5 or fewer nav items that fit on one line |
| `usa-header--extended` | Sites with a logo, site name, and primary navigation |
| `usa-header--basic` with megamenu | Large sites with many sub-pages per section |

**Extended header structure:**

```html
<header class="usa-header usa-header--extended" role="banner">
  <div class="usa-navbar">
    <div class="usa-logo">
      <em class="usa-logo__text">
        <a href="/" title="Home" aria-label="[Site Name] - Home">
          [Site Name]
        </a>
      </em>
    </div>
    <button type="button" class="usa-menu-btn">Menu</button>
  </div>
  <nav aria-label="Primary navigation" class="usa-nav">
    <div class="usa-nav__inner">
      <button type="button" class="usa-nav__close">
        <img src="/assets/img/usa-icons/close.svg" role="img" alt="Close" />
      </button>
      <ul class="usa-nav__primary usa-accordion">
        <li class="usa-nav__primary-item">
          <a href="/consumer-products.html" class="usa-nav__link">
            <span>Consumer Products</span>
          </a>
        </li>
        <!-- additional nav items -->
      </ul>
      <div class="usa-nav__secondary">
        <form class="usa-search usa-search--small" method="get" action="/search">
          <label class="usa-sr-only" for="extended-search-field-small">Search</label>
          <input
            class="usa-input"
            id="extended-search-field-small"
            type="search"
            name="query"
            placeholder="Search..."
          />
          <button class="usa-button" type="submit">
            <img
              src="/assets/img/usa-icons-bg/search--white.svg"
              class="usa-search__submit-icon"
              alt="Search"
            />
          </button>
        </form>
      </div>
    </div>
  </nav>
</header>
```

**Rules:**
- The site logo area uses `<em>`, not `<h1>`. Reserve `<h1>` for the page's main heading inside `<main>`.
- If the agency seal or wordmark appears as an image, include descriptive `alt` text.
- The mobile menu button requires no additional JavaScript; USWDS JS handles it.

---

## Step 3: Build the Main Content

### Breadcrumbs (interior pages only, not the homepage)

```html
<nav class="usa-breadcrumb" aria-label="Breadcrumbs">
  <ol class="usa-breadcrumb__list">
    <li class="usa-breadcrumb__list-item">
      <a href="/" class="usa-breadcrumb__link">Home</a>
    </li>
    <li class="usa-breadcrumb__list-item usa-current" aria-current="page">
      [Current Page Name]
    </li>
  </ol>
</nav>
```

### Page Heading

```html
<div class="usa-section usa-section--dark">
  <div class="grid-container">
    <h1 class="usa-hero__heading">[Page Main Heading]</h1>
    <p class="usa-intro">[One or two sentences describing the page's purpose in plain language.]</p>
  </div>
</div>
```

### Content Sections

Use the USWDS grid. Always mobile-first:

```html
<section class="usa-section" aria-labelledby="section-heading-id">
  <div class="grid-container">
    <h2 id="section-heading-id">Section Title</h2>
    <div class="grid-row grid-gap">
      <div class="grid-col-12 tablet:grid-col-6 desktop:grid-col-4">
        <!-- card or content block -->
      </div>
    </div>
  </div>
</section>
```

### Agency Cards (for directory / portal pages)

```html
<ul class="usa-card-group">
  <li class="usa-card tablet:grid-col-4">
    <div class="usa-card__container">
      <div class="usa-card__header">
        <h3 class="usa-card__heading">[Agency Name]</h3>
      </div>
      <div class="usa-card__media usa-card__media--inset">
        <div class="usa-card__img">
          <img src="/assets/logos/[agency]-logo.svg" alt="[Agency Full Name] logo" />
        </div>
      </div>
      <div class="usa-card__body">
        <p>[Plain-language description of what this agency recalls and who to contact.]</p>
      </div>
      <div class="usa-card__footer">
        <a
          href="[agency-recalls-url]"
          class="usa-button"
          target="_blank"
          rel="noopener"
          aria-label="View [Agency Name] recalls (opens in a new tab)"
        >
          View Recalls
        </a>
      </div>
    </div>
  </li>
</ul>
```

### Alerts and Site Notices

Use `usa-alert` for important notices. Choose the correct variant:

```html
<!-- Informational -->
<div class="usa-alert usa-alert--info" role="status">
  <div class="usa-alert__body">
    <h4 class="usa-alert__heading">Information</h4>
    <p class="usa-alert__text">[Message text.]</p>
  </div>
</div>

<!-- Emergency / warning -->
<div class="usa-site-alert usa-site-alert--emergency" role="alert" aria-live="assertive">
  <div class="usa-alert">
    <div class="usa-alert__body">
      <h4 class="usa-alert__heading">Emergency alert</h4>
      <p class="usa-alert__text">[Urgent notice text.]</p>
    </div>
  </div>
</div>
```

---

## Step 4: Build the Footer and Identifier

### Slim Footer

```html
<footer class="usa-footer usa-footer--slim">
  <div class="grid-container usa-footer__return-to-top">
    <a href="#">Return to top</a>
  </div>
  <div class="usa-footer__primary-section">
    <div class="grid-container">
      <div class="usa-footer__primary-content grid-row grid-gap">
        <nav class="usa-footer__nav mobile-lg:grid-col-8 desktop:grid-col-10" aria-label="Footer navigation">
          <ul class="grid-row grid-gap usa-list usa-list--unstyled">
            <li class="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
              <a class="usa-footer__primary-link" href="/accessibility.html">Accessibility Statement</a>
            </li>
            <li class="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
              <a class="usa-footer__primary-link" href="/privacy.html">Privacy Policy</a>
            </li>
            <li class="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
              <a class="usa-footer__primary-link" href="/vulnerability-disclosure.html">Vulnerability Disclosure Policy</a>
            </li>
            <li class="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
              <a class="usa-footer__primary-link" href="/foia.html">FOIA</a>
            </li>
            <li class="mobile-lg:grid-col-6 desktop:grid-col-auto usa-footer__primary-content">
              <a class="usa-footer__primary-link" href="/no-fear-act.html">No FEAR Act Data</a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</footer>
```

### Identifier (Required on all federal sites)

```html
<div class="usa-identifier">
  <section
    class="usa-identifier__section usa-identifier__section--masthead"
    aria-label="Agency identifier"
  >
    <div class="usa-identifier__container">
      <div class="usa-identifier__logos">
        <a href="[agency-homepage-url]" class="usa-identifier__logo" aria-label="[Agency Full Name] logo">
          <img
            class="usa-identifier__logo-img"
            src="/assets/logos/[agency]-logo.svg"
            alt="[Agency Full Name]"
          />
        </a>
      </div>
      <section class="usa-identifier__identity" aria-label="Agency description">
        <p class="usa-identifier__identity-domain">[site-domain.gov]</p>
        <p class="usa-identifier__identity-disclaimer">
          An official website of the
          <a href="[agency-homepage-url]">[Agency Full Name]</a>
        </p>
      </section>
    </div>
  </section>
  <nav
    class="usa-identifier__section usa-identifier__section--required-links"
    aria-label="Important links"
  >
    <div class="usa-identifier__container">
      <ul class="usa-identifier__required-links-list">
        <li class="usa-identifier__required-links-item">
          <a href="/about.html" class="usa-identifier__required-link usa-link">About [Site Name]</a>
        </li>
        <li class="usa-identifier__required-links-item">
          <a href="/accessibility.html" class="usa-identifier__required-link usa-link">Accessibility Statement</a>
        </li>
        <li class="usa-identifier__required-links-item">
          <a href="/foia.html" class="usa-identifier__required-link usa-link">FOIA Requests</a>
        </li>
        <li class="usa-identifier__required-links-item">
          <a href="/no-fear-act.html" class="usa-identifier__required-link usa-link">No FEAR Act Data</a>
        </li>
        <li class="usa-identifier__required-links-item">
          <a href="https://oig.[agency].gov" class="usa-identifier__required-link usa-link">Office of the Inspector General</a>
        </li>
        <li class="usa-identifier__required-links-item">
          <a href="/performance.html" class="usa-identifier__required-link usa-link">Performance Reports</a>
        </li>
        <li class="usa-identifier__required-links-item">
          <a href="/privacy.html" class="usa-identifier__required-link usa-link">Privacy Policy</a>
        </li>
      </ul>
    </div>
  </nav>
  <section class="usa-identifier__section usa-identifier__section--usagov" aria-label="U.S. government information and services">
    <div class="usa-identifier__container">
      <div class="usa-identifier__usagov-description">Looking for U.S. government information and services?</div>
      <a href="https://www.usa.gov/" class="usa-link">Visit USA.gov</a>
    </div>
  </section>
</div>
```

---

## Step 5: Self-Check Before Finishing

Run through this checklist. Do not submit work that fails any item.

### Structure
- [ ] Single `<h1>` on the page
- [ ] Heading hierarchy is logical (h1 > h2 > h3, no skipped levels)
- [ ] `<a class="usa-skipnav">` is the first element in `<body>`
- [ ] `<section class="usa-banner">` appears before the header
- [ ] `<main id="main-content">` is present
- [ ] Interior pages have `<nav class="usa-breadcrumb">`
- [ ] `<footer>` and `<div class="usa-identifier">` are present

### Accessibility
- [ ] Every `<img>` has an `alt` attribute (descriptive or empty `""` for decorative)
- [ ] Every form input has a matching `<label>` (not just placeholder)
- [ ] Required fields are marked with asterisk and a legend
- [ ] All links have descriptive text (no "click here")
- [ ] External links opening in new tabs have `aria-label` indicating this
- [ ] No `outline: none` or `outline: 0` in CSS

### Content
- [ ] No lorem ipsum or filler copy
- [ ] No emojis anywhere in the page
- [ ] No placeholder image URLs (unsplash, picsum, etc.)
- [ ] Page `<title>` follows the `[Page] | [Site] | [Agency]` pattern
- [ ] `<meta name="description">` is present and descriptive

### Code Quality
- [ ] No inline event handlers (`onclick`, `onload`, etc.)
- [ ] No hardcoded credentials or API keys
- [ ] No commented-out code blocks
- [ ] All CSS uses USWDS tokens, not hardcoded hex values or px margins
- [ ] USWDS JS loaded at the bottom of `<body>` (`uswds-init.min.js` first, then `uswds.min.js`)

---

## Common Mistakes to Avoid

| Wrong | Correct |
|---|---|
| `<h1>` in the header logo | `<em class="usa-logo__text">` |
| `placeholder="Your name"` as the label | `<label for="name">Your name</label>` |
| `onclick="doSomething()"` | Event listener in external JS |
| `color: #003366` in CSS | `color: color('primary-darker')` |
| `font-family: Arial, sans-serif` | USWDS font tokens via `$theme-font-body` |
| Gradient hero background | Flat USWDS color token background |
| "Click here to learn more" link text | "View consumer product recalls" |
| `target="_blank"` without aria-label | `target="_blank" rel="noopener" aria-label="...(opens in a new tab)"` |
| Icons from Font Awesome | `<usa-icon>` from USWDS icon set |
| `lorem ipsum dolor sit amet` | Real, plain-language content |
