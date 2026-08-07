# Data Model: Bean Book & Leaf Book

The pipeline is **generic**. What a field *is* — its type, whitelist, limits and
whether it describes the item or the individual review — is declared once per
product in `products/<product>.js`, and drives parsing, sanitization,
aggregation, validation and both renderers.

## Field schema (`products/<product>.js` → `fields[]`)

| Key | Meaning |
|-----|---------|
| `id` | Key in the raw, sanitized and aggregated objects |
| `label` | The `### heading` in the issue form. **Must match the form verbatim** |
| `type` | See the table below — decides parsing and sanitization |
| `role` | Marks the field the core needs: `name`, `maker`, `rating`, `cost`, `weight`, `flavours`, `website`, `notes` |
| `scope` | `'item'` merges the value into `facts`; omitted keeps it on the Review |
| `required` | A missing/invalid value rejects the whole review |

### Field types

| Type | Sanitized to | Notes |
|------|--------------|-------|
| `text` / `longtext` | `string \| null` | Entity-decoded, tag-stripped, capped (200 / 2000) |
| `choiceOther` | `string \| null` | Dropdown value, or the freeform `otherLabel` field when "Other …" is picked |
| `enum` | one of `options`, or `fallback` | Case-insensitive match; unlisted values drop to `fallback` (default `null`) |
| `checklist` | `string[]` | Ticked options only, de-duplicated, capped by `max` |
| `rating` | `number` | 1.00–5.00 on the 0.25 grid, else `null` |
| `flag` | `boolean` | Any ticked checkbox |
| `number` | `number \| null` | `integer`, `min`, `max` honoured |
| `date` | `string \| null` | `YYYY-MM-DD` only |
| `url` | `string \| null` | `http(s)` only |
| `currency` | `{ code, symbol }` | Defaults to EUR |
| `ratio` | `string \| null` | Normalized to `1:N` |
| `list` | `string[]` | Split on `", "` only when `splitWhen` matches (blends) |

## Review

One published issue → one Review: the metadata below plus one key per field.

| Field | Type | Source / Validation |
|-------|------|---------------------|
| `id` | number | Issue number |
| `url` | string \| null | Issue html_url (`github.com` https only) |
| `submittedAt` | ISO date string | Issue `created_at` |
| `author` | `{ login, avatarUrl, profileUrl }` | Issue user; avatar/profile must be GitHub URLs |
| `name` | string | `role: 'name'`, required |
| `maker` | string | `role: 'maker'`, required — the roaster (coffee) or brand (tea) |
| `rating` | number | `role: 'rating'`, required |
| …fields | per schema | Everything else declared in `products/<product>.js` |

### Coffee fields (`products/coffee.js`)

Item scope: `roastType`, `roastLevel`, `blend`, `decaf`, `organic`, `roastDate`,
`origins`, `process`, `species`, `variety`, `website`.

Review scope: `currency`, `cost`, `weightGrams`, `flavours`, `brewMethod`,
`grindSource`, `grinder`, `grindSetting`, `grindSize`, `ratio`, `notes`,
`buyAgain`.

`postProcess()` forces `grinder` and `grindSetting` to `null` when
`grindSource` is `Pre-ground`.

### Tea fields (`products/tea.js`)

Item scope: `teaType`, `form`, `blend`, `caffeineFree`, `organic`, `harvest`,
`harvestYear`, `origins`, `oxidation`, `cultivar`, `website`.

Review scope: `currency`, `cost`, `weightGrams`, `flavours`, `brewMethod`,
`waterTemp`, `steepTime`, `steeps`, `ratio`, `notes`, `buyAgain`.

## Item (Bean / Tea)

Aggregation of Reviews sharing a normalized identity.

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string | URL-safe id derived from maker+name; unique within the product |
| `key` | string | `normalize(maker)⟟normalize(name)` |
| `name` | string | Display name (from the most recent review) |
| `maker` | string | Display roaster / brand |
| `averageRating` | number | Mean of review ratings, 2 dp |
| `reviewCount` | number | Count of reviews |
| `valuePer100g` | `{ value, currency }` \| null | Cheapest observed price per 100g across reviews (currency of that review; not converted). Only when the product sets `pricePer100g` |
| `facts` | object | Every `scope: 'item'` field, taking the most recent non-empty value |
| `flavours` | string[] | Union of review flavours |
| `reviews` | Review[] | Newest first |

**Normalization**: lowercase → strip diacritics → trim → collapse internal
whitespace. Used only for the identity key, not for display.

**Purchase vs intrinsic data**: `cost`, `weightGrams` and `currency` describe a
specific purchase, so they stay on the Review (shown on each review card). The
Item only exposes the derived `valuePer100g` for comparison.

**Brew vs intrinsic data**: how it was *prepared* — brew method, grind (coffee),
water temperature / steep time / infusions (tea) and ratio — describes one brew
by one reviewer, not the item itself. Two people can prepare the same item very
differently, so these never merge into `facts`; they render on the individual
review card via the product's `reviewMeta()`.

## data/<product>.json (build artifact)

Copied to `dist/<product>/data/items.json` — a product-agnostic path, so the
shared SPA needs no per-product wiring.

```json
{
  "generatedAt": "2026-07-08T00:00:00Z",
  "buildId": "__BUILD_ID__",
  "product": "coffee",
  "itemCount": 2,
  "reviewCount": 3,
  "items": [ { "slug": "…", "name": "…", "maker": "…",
               "averageRating": 3.5, "reviewCount": 2,
               "valuePer100g": null,
               "facts": { }, "flavours": [], "reviews": [ ] } ]
}
```

## Presentation config

| Key | Drives |
|-----|--------|
| `facts[]` | Ordered `<dl>` rows on the detail page. `{ special: 'valuePer100g' }` renders the derived value |
| `badges[]` | Badges on a gallery card; a `flag` field renders its `label` when true |
| `filters[]` | Home controls: `maker`, `enum`, `rating`, `price` (with `bands`), `flags` |
| `reviewMeta(review, fmt)` | The `·`-joined line under each review, shared by the SPA and the prerenderer |
| `theme.light` / `theme.dark` | Generated into `dist/<product>/theme.css` |

Enum-valued facts and badges hide the `Unknown` placeholder; `flag` facts render
as `Yes` and are hidden when false.
