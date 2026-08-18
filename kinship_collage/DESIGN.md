---
name: Kinship Collage
colors:
  surface: '#f8faf6'
  surface-dim: '#d8dbd7'
  surface-bright: '#f8faf6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f0'
  surface-container: '#eceeea'
  surface-container-high: '#e7e9e5'
  surface-container-highest: '#e1e3df'
  on-surface: '#191c1a'
  on-surface-variant: '#404943'
  inverse-surface: '#2e312f'
  inverse-on-surface: '#eff1ed'
  outline: '#707973'
  outline-variant: '#bfc9c1'
  surface-tint: '#2c694e'
  primary: '#0f5238'
  on-primary: '#ffffff'
  primary-container: '#2d6a4f'
  on-primary-container: '#a8e7c5'
  inverse-primary: '#95d4b3'
  secondary: '#a8334e'
  on-secondary: '#ffffff'
  secondary-container: '#fd748e'
  on-secondary-container: '#720429'
  tertiary: '#713638'
  on-tertiary: '#ffffff'
  tertiary-container: '#8d4d4e'
  on-tertiary-container: '#ffcfce'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b1f0ce'
  primary-fixed-dim: '#95d4b3'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#0e5138'
  secondary-fixed: '#ffd9dd'
  secondary-fixed-dim: '#ffb2bc'
  on-secondary-fixed: '#400013'
  on-secondary-fixed-variant: '#881938'
  tertiary-fixed: '#ffdad9'
  tertiary-fixed-dim: '#ffb3b3'
  on-tertiary-fixed: '#390b0e'
  on-tertiary-fixed-variant: '#6f3537'
  background: '#f8faf6'
  on-background: '#191c1a'
  surface-variant: '#e1e3df'
  canvas-cream: '#FDFBF7'
  marker-yellow: '#FFD60A'
  sky-blue: '#4CC9F0'
  washi-tape-gray: '#E5E5E5'
typography:
  display-hand:
    fontFamily: Bricolage Grotesque
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Bricolage Grotesque
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-page: 20px
  gutter-grid: 12px
  stack-overlap: -8px
  section-gap: 32px
---

## Brand & Style

This design system embraces a **Scrapbook / Tactile Collage** aesthetic, moving away from rigid, corporate structures toward a warm, human-centric experience for working parents. The brand personality is encouraging, organized-yet-flexible, and deeply family-oriented.

The visual narrative is built on the idea of a "digital refrigerator door"—a space where important information, child-led achievements, and family schedules are pinned with care. By utilizing hand-drawn elements and overlapping textures, the UI feels less like a tool and more like a shared family memory. 

The aesthetic combines:
- **Hand-drawn markers:** Highlighting key information with "sketchy" circles and underlines.
- **Physicality:** Paper textures and "sticker" effects that give elements a layered, 3D presence.
- **Eclectic Charm:** A mix of clean typography for critical data and handwritten scripts for emotional connection.

## Colors

The palette is anchored by a warm **Canvas Cream** background, mimicking the tone of heavy-weight construction paper or a vintage diary. This low-contrast base reduces eye strain for tired parents.

Vibrant accent colors are used as "digital markers":
- **Primary (Forest Green):** Used for growth-related items, completed tasks, and steady rhythms like "designated outfit" days.
- **Secondary (Pulse Pink):** Reserved for important highlights, family member tags, and emotional "wins."
- **Marker Yellow & Sky Blue:** Used for secondary callouts and differentiating between multiple children’s schedules.
- **Neutral:** A range of soft grays and off-whites that mimic paper shadows and washi tape textures.

## Typography

The typography system balances legibility with personality. 

**Bricolage Grotesque** is chosen for its quirky, variable-style character that feels almost handwritten yet remains structurally sound. It is used for all "emotional" touchpoints: headlines, names, and the language toggle.

**Plus Jakarta Sans** provides a clean, modern contrast for high-utility areas. Its friendly, open counters ensure that recipe instructions and to-do lists are readable at a glance, even during a chaotic morning routine.

**KR/EN Support:** The language toggle is placed prominently in the top right. For Korean text, ensure a font with matching humanist characteristics (like Noto Sans KR) is substituted to maintain the friendly tone.

## Layout & Spacing

The layout follows a **"Compositional Grid"** rather than a strict linear one. While elements align to a standard 12-column structure for functional reliability, visual elements (stickers, icons, highlights) are encouraged to break the grid.

- **Stacking & Overlap:** Components should use negative margins (`stack-overlap`) to layer over one another, mimicking physical clippings.
- **Safe Margins:** A generous 20px outer margin ensures the "scrapbook" doesn't feel cluttered on smaller devices.
- **Reflow:** On mobile, the two-column "Recipe Cards" transition to a single-column vertical stack with staggered offsets to maintain the playful rhythm.

## Elevation & Depth

This system avoids traditional material shadows. Instead, it uses **Tactile Layering**:
- **Paper Stacking:** Subtle, sharp 1px borders in a slightly darker neutral tone create the edge of a "page."
- **Cut-out Effects:** Photos of children or clothing should appear with a "white border" (die-cut sticker style) to separate them from the cream background.
- **Tonal Depth:** Surfaces are differentiated by texture (e.g., a "subtle grain" overlay on the main background) rather than blurs or soft glows.
- **Washi Tape:** Use semi-transparent rectangular overlays (15-20% opacity) to "pin" headers or buttons to the background.

## Shapes

The shape language is defined by **Imperfect Geometry**. 
- **Variable Border Radii:** Cards and containers should not have perfectly uniform corners. Use CSS `border-radius` values like `24px 18px 22px 20px` to create a "hand-cut" feel.
- **Sketchy Strokes:** Borders on active states or inputs should utilize a "hand-drawn" SVG stroke pattern rather than a solid 1px line.
- **Doodle Icons:** All iconography must be thick-stroke, monoline illustrations that look like they were drawn with a felt-tip marker.

## Components

### Buttons
Primary buttons use the Forest Green background with a high-contrast white Bricolage Grotesque label. They should feature a "sketchy" 2px black border offset by 2px to create a faux-3D "sticker" look.

### To-Do Items (Checkboxes)
Checkboxes are replaced by hand-drawn circles. When "checked," a vibrant Pulse Pink "X" or "Check" doodle animates over the top. Items that are completed by a spouse display a small circular photo icon of that person next to the task.

### Recipe & Outfit Cards
These should look like index cards. Include a "ripped paper" edge effect on one side. Use a mix of real photography (the meal, the child's clothes) and playful emoticons scattered on the corners.

### Input Fields
Inputs should look like a simple underline (like a notebook line) with a clean Plus Jakarta Sans placeholder. The "One-Tap Add" for tasks is a prominent yellow sticky-note style button that expands into a simple text field.

### Progress Indicators (Couple Sync)
Instead of a progress bar, use two overlapping sticker icons of the parents. As tasks are completed, the stickers move closer together toward a "Family Goal" star icon.