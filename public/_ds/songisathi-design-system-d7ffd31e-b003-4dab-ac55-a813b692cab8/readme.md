# SongiSathi Design System

**SongiSathi** ("companion for the journey") is a family- and manager-mediated matchmaking platform for the Bangladesh market. Profiles ("biodata") are created and managed by **Matchmakers** (ঘটক/ghotok), **Guardians**, or **Self-Managed** members. Discovery, interest, and contact exchange all route through the profile's manager rather than the member directly — the core trust mechanic of the product.

**Source of this design system:** no codebase, Figma file, or slide deck was attached — this is a from-scratch system built from the product/feature specification only (Phase 1 MVP: auth, biodata profiles, search, interest/connection flow, matchmaker dashboard, moderation, manual bKash/Nagad payments, notifications). If a Figma file, repo, or deck exists for SongiSathi, attach it and this system should be reconciled against it.

No logo was supplied — the wordmark is set in type (Lora) everywhere a mark would go. See `assets/` note.

## Index

- `styles.css` — root stylesheet, `@import`s everything below
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `fonts.css`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Elevation, Brand)
- `components/`
  - `forms/` — Button, IconButton, Input, Select, Checkbox, Radio, Switch
  - `feedback/` — Badge, Tag, Toast, Tooltip, Dialog
  - `data-display/` — Card, Avatar, ProfileCard, StatusPill
  - `navigation/` — Tabs
- `ui_kits/member-app/` — Discover/Search, Profile Detail, Interest Inbox, Chat, Dashboard, Login
- `assets/` — icons (Lucide, see ICONOGRAPHY)
- `SKILL.md` — portable skill wrapper for Claude Code

## Content fundamentals

- **Voice:** formal and respectful — this is a family-witnessed decision, not a swipe app. Copy addresses the reader as "you" but never gets casual or jokey. No slang, no exclamation-heavy hype.
- **Person/tense:** second person for the member ("Your profile is under review"), third person + role label for anyone else acting on a profile ("Sent by the Guardian of PRN-10245").
- **Vocabulary:** "biodata" not "resume"; "profile" not "listing"; "interest" not "like" or "swipe"; "connection" not "match"; "manager" (matchmaker/guardian/self) as the umbrella term. Never "date" or "dating" — this is a marriage-intent platform.
- **Casing:** sentence case everywhere (buttons, labels, headings). No ALL CAPS except tiny eyebrow labels (e.g. status pills), which use letter-spacing instead of size to read as quiet metadata.
- **Numbers/IDs:** profile IDs are always shown in full, monospace-style tabular figures — `PRN-10245`, never abbreviated.
- **Emoji:** never used in UI copy. This is a formal, elder-facing product.
- **Bilingual pattern:** primary UI copy in English; section labels and a handful of warm, high-context words appear in Bengali beneath or beside the English (e.g. "Family details" / পারিবারিক বিবরণ) — Bengali is a companion caption, not a full translation layer, in Phase 1.
- **Tone examples:**
  - Empty state: "No interests yet. When a manager sends interest in one of your profiles, it will appear here."
  - Error: "That phone number is already registered. Try logging in instead."
  - Confirmation before contact release: "You're about to share this profile's phone number with the other family. This can't be undone."
  - Decline copy (never blunt): "Not the right fit at this time" is offered as one of several dropdown reasons, never a bare "Reject."

## Visual foundations

- **Palette:** deep olive-green (`--green-700`) as the primary/trust color, warm terracotta (`--terracotta-600`) as the secondary/warm accent, muted gold (`--gold-600`) reserved for verification and premium badges only. Backgrounds are warm ivory (`--ivory-100`), never stark white or cool grey — the whole system sits on a warm paper-like base. Max two background colors per screen: ivory page + one card surface.
- **Type:** Lora (serif) for display/headings — a considered, editorial, slightly traditional serif that reads as dignified rather than techy. Karla (sans) for UI/body — humanist, warm, quiet workhorse. Tiro Bangla / Hind Siliguri mirror the same display/body split for Bengali captions. No mono family; profile IDs use tabular figures in Karla instead.
- **Spacing:** 4px base scale (4/8/12/16/20/24/32/40/48/64/80/96). Generous vertical rhythm on biodata content — this is read carefully by families, not skimmed.
- **Corners:** soft, not sharp, not pill-heavy. Cards/panels 12–18px radius; buttons 12px (rounded-rectangle, not a full pill — this isn't a playful consumer app); avatars and status dots fully round; photo-lock scrims match the photo's own radius.
- **Shadows:** soft, warm-tinted (brown-based, not pure black) ambient shadows at low opacity — `--shadow-1/2/3`. No hard drop shadows, no neon glows.
- **Borders:** thin 1px warm-brown borders (`--border-subtle/default`) do most of the separation work; shadows are secondary, used mainly for floating surfaces (dialogs, dropdowns, the photo-lock overlay).
- **Backgrounds/imagery:** no illustration style, no patterns, no gradients as decoration — this is a trust-first, content-first product where the biodata and photo carry the visual weight. The one deliberate "image" surface is the **locked/blurred photo** treatment (heavy blur + soft scrim + a small lock glyph and "Request photo access" label) — this is a core, recurring motif, not a generic placeholder.
- **Animation:** minimal and purposeful — 120–200ms ease-out fades/slides for panels, dialogs, and status changes. No bounce, no springy overshoot; motion should feel calm and administrative, matching the formal tone.
- **Hover/press states:** hover darkens a solid surface one step (`--brand-primary` → `--brand-primary-hover`) or tints a transparent/ghost surface with a faint brand wash; press darkens one step further (`--brand-primary-press`), no scale/shrink effects.
- **Transparency/blur:** used in exactly two places — the photo-lock scrim (heavy blur, ~72% opacity brown scrim) and modal/overlay backdrops (`--surface-overlay`). Not used decoratively elsewhere.
- **Imagery color mood:** warm, natural skin tones, soft daylight — no cool/blue-toned or heavily filtered photography. (No real photography is bundled; UI kits use labeled photo placeholders.)
- **Cards:** `--surface-card` fill, 1px `--border-subtle`, `--radius-lg` corners, `--shadow-1` at rest, `--shadow-2` on hover for interactive cards (profile cards). No colored left-border accent strips.
- **Status/semantic color use:** status pills (Pending / Accepted / Declined / Expired, profile status) use a tinted background + solid-color text/dot rather than solid fill chips, keeping the formal, document-like tone.

## Iconography

No icon codebase was provided. The system uses **Lucide** (CDN, `lucide.dev`) as the substitute icon set — chosen for its clean single-weight outline style, which matches the calm, document-like tone better than a filled/rounded set. Icons are always outline style, 1.5–2px stroke, sized 16/20/24px, colored via `currentColor` (never a fixed hex). No emoji, no unicode glyphs as icons — the one exception is the lock glyph on blurred photos, which is a Lucide `lock` icon, not emoji. See `components/forms/`, `ui_kits/member-app/` for usage.

## Intentional additions

Because no source defined a component inventory, a standard primitive set was authored, sized to what Phase 1 screens actually need: Button, IconButton, Input, Select, Checkbox, Radio, Switch, Badge, Tag, Card, Avatar, ProfileCard (a domain-specific composite — the recurring search-result unit), StatusPill (domain-specific — interest/profile status), Tabs, Dialog, Toast, Tooltip.

## Index

- `styles.css` — link this one file to get all tokens + fonts
- `tokens/colors.css` `typography.css` `spacing.css` `elevation.css` `fonts.css`
- `guidelines/` — 14 foundation specimen cards (Colors ×4, Type ×4, Spacing ×4, Brand ×2)
- `components/forms/` — Button, IconButton, Input, Select, Checkbox, Radio, Switch
- `components/feedback/` — Badge, Tag, Toast, Tooltip, Dialog
- `components/data-display/` — Card, Avatar, ProfileCard, StatusPill
- `components/navigation/` — Tabs
- `ui_kits/member-app/` — interactive click-through: signup/login, dashboard, discover/search, profile detail, interest inbox, chat
- `SKILL.md` — portable skill for use in Claude Code

## Caveats

- No brand assets (logo, photography, existing UI) were attached — palette, type, and layout are original interpretations of the brief, not extracted from an existing brand. Please share a logo, brand guide, Figma file, or app screenshots so this can be reconciled against the real thing.
- Fonts are loaded from the Fontsource CDN (jsDelivr) rather than binaries stored in this project — functionally equivalent to self-hosting but relies on that CDN's uptime.
