/**
 * Coffee product configuration — "Bean Book".
 *
 * This module is the single source of truth for everything coffee-specific:
 * site identity, terminology, the review field schema (which drives parsing,
 * sanitization, aggregation and validation) and how a review is presented.
 *
 * IMPORTANT: keep this file dependency-free and DOM-free. It is imported by
 * Node (build scripts, tests) *and* copied verbatim into the deployed site as
 * `src/product.config.js`, where the browser imports it.
 *
 * The `label` of every field must match the label in
 * `.github/ISSUE_TEMPLATE/bean-review.yml` verbatim — that is the contract the
 * issue parser relies on.
 */

const ROASTERS = [
  'Other (not listed)', 'Manhattan Coffee Roasters', 'Friedhats', 'White Label Coffee',
  'Bocca Coffee', 'Lot Sixty One', 'Wakuli', 'Simon Lévelt', 'Fascino Coffee',
  'Stooker Roasting Company', 'Rum Baba', 'Keen Coffee', 'Giraffe Coffee Roasters',
  'Peddlers Coffee', 'Sceneri Coffee', 'The Barn', 'Bonanza Coffee', 'Coffee Collective',
  'La Cabra', 'April Coffee', 'Square Mile', 'Tim Wendelboe', 'Gardelli', 'Sey Coffee',
  'Home / Self-roasted',
];

const ROAST_TYPES = ['Filter', 'Espresso', 'Omni (Filter & Espresso)', 'Unknown'];
const ROAST_LEVELS = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark', 'Unknown'];
const BLENDS = ['Single Origin', 'Blend', 'Unknown'];
const PROCESSES = ['Washed', 'Natural', 'Honey', 'Anaerobic', 'Carbonic Maceration', 'Other', 'Unknown'];
const SPECIES = ['Arabica', 'Robusta', 'Arabica / Robusta blend', 'Liberica', 'Excelsa', 'Other', 'Unknown'];
const BREW_METHODS = [
  'Espresso', 'V60 / Pour-over', 'AeroPress', 'French Press',
  'Moka Pot', 'Filter (batch / drip)', 'Cold Brew', 'Other',
];
const GRIND_SOURCES = ['Ground by me', 'Pre-ground', 'Unknown'];
const GRIND_SIZES = [
  'Extra Fine', 'Fine', 'Medium-Fine', 'Medium',
  'Medium-Coarse', 'Coarse', 'Extra Coarse', 'Unknown',
];
const FLAVOURS = [
  'Chocolate / Cocoa', 'Nutty', 'Caramel / Toffee', 'Fruity (stone / tropical)',
  'Berry', 'Citrus', 'Floral', 'Spicy', 'Sweet / Sugary', 'Earthy / Herbal',
];

const coffee = {
  id: 'coffee',

  site: {
    name: 'Bean Book',
    title: 'Bean Book — Coffee bean reviews',
    tagline: 'A hand-kept log of coffee beans worth remembering — ratings, roasters and tasting notes.',
    description: 'A hand-kept log of coffee beans worth remembering — ratings, roasters and tasting notes. Untappd, but for coffee.',
    schemaDescription: 'Untappd for coffee beans — a hand-kept log of coffee bean reviews.',
    url: 'https://coffee.ravensberg.org',
    repoUrl: 'https://github.com/DevSecNinja/brew-book',
    relatedSite: { name: 'Leaf Book', url: 'https://tea.ravensberg.org' },
    mark: '☕',
    locale: 'en_GB',
    schemaCategory: 'Coffee',
    emptyTitle: 'Nothing brewing yet',
    noScript: 'Bean Book needs JavaScript to display coffee reviews.',
    manifest: {
      shortName: 'Bean Book',
      categories: ['food', 'lifestyle'],
      screenshotLabel: 'Browse the coffee bean gallery',
      hasScreenshots: true,
    },
  },

  /** Wording + routing. `routeBase` is part of the public URL contract. */
  terms: {
    item: 'bean',
    items: 'beans',
    Item: 'Bean',
    Items: 'Beans',
    maker: 'roaster',
    makers: 'roasters',
    Maker: 'Roaster',
    routeBase: 'bean',
    searchPlaceholder: 'Search beans, roasters, origins, flavours…',
    addReview: 'Add a review',
    firstReview: '☕ Add the first review',
    websiteLink: 'Visit bean page ↗',
  },

  theme: {
    light: {
      bg: '#f7f3ee', 'bg-elev': '#ffffff', surface: '#ffffff', text: '#2b2018',
      'text-muted': '#7a6a5c', border: '#e7ddd2', accent: '#b5651d',
      'accent-strong': '#8a4a12', 'accent-contrast': '#ffffff', link: '#8a4a12',
      star: '#e0a326', 'star-empty': '#d9ccbe',
      shadow: '0 1px 2px rgba(43, 32, 24, 0.06), 0 8px 24px rgba(43, 32, 24, 0.08)',
    },
    dark: {
      bg: '#1a1410', 'bg-elev': '#241b15', surface: '#241b15', text: '#f3ebe2',
      'text-muted': '#b3a293', border: '#38291f', accent: '#e0994f',
      'accent-strong': '#f0b878', 'accent-contrast': '#241b15', link: '#e0994f',
      star: '#f0b64a', 'star-empty': '#46372c',
      shadow: '0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.4)',
    },
  },

  issue: {
    template: 'bean-review.yml',
    formLabel: 'bean-review',
    publishLabel: 'published',
  },

  /** Committed data + offline fixture (relative to the repo root). */
  data: {
    file: 'data/coffee.json',
    sample: 'data/coffee.sample.json',
  },

  /** Cheapest observed price per 100g is meaningful for coffee. */
  pricePer100g: true,

  fields: [
    { id: 'name', label: 'Bean name', type: 'text', role: 'name', required: true },
    {
      id: 'maker',
      label: 'Roaster',
      otherLabel: 'Roaster (if not listed)',
      type: 'choiceOther',
      role: 'maker',
      required: true,
      options: ROASTERS,
    },
    { id: 'roastType', label: 'Roast type', type: 'enum', options: ROAST_TYPES, fallback: 'Unknown', scope: 'item' },
    { id: 'roastLevel', label: 'Roast level', type: 'enum', options: ROAST_LEVELS, fallback: 'Unknown', scope: 'item' },
    { id: 'blend', label: 'Single origin or blend?', type: 'enum', options: BLENDS, fallback: 'Unknown', scope: 'item' },
    { id: 'rating', label: 'Rating', type: 'rating', role: 'rating', required: true },
    { id: 'decaf', label: 'Decaffeinated', type: 'flag', scope: 'item' },
    { id: 'organic', label: 'Organic', type: 'flag', scope: 'item' },
    { id: 'roastDate', label: 'Roast date', type: 'date', scope: 'item' },
    { id: 'origins', label: 'Origin', type: 'list', scope: 'item', splitWhen: { field: 'blend', equals: 'Blend' } },
    { id: 'process', label: 'Process', type: 'enum', options: PROCESSES, scope: 'item' },
    { id: 'species', label: 'Species', type: 'enum', options: SPECIES, scope: 'item' },
    { id: 'variety', label: 'Variety / cultivar', type: 'text', scope: 'item' },
    { id: 'currency', label: 'Currency', type: 'currency' },
    { id: 'cost', label: 'Cost', type: 'number', role: 'cost', min: 0 },
    { id: 'weightGrams', label: 'Weight (grams)', type: 'number', role: 'weight', integer: true, min: 1 },
    { id: 'flavours', label: 'Flavour profiles', type: 'checklist', options: FLAVOURS, role: 'flavours', max: 10 },
    { id: 'brewMethod', label: 'How did you brew it?', type: 'enum', options: BREW_METHODS },
    { id: 'grindSource', label: 'Pre-ground or ground yourself?', type: 'enum', options: GRIND_SOURCES },
    { id: 'grinder', label: 'Grinder', type: 'text' },
    { id: 'grindSetting', label: 'Grind setting', type: 'text' },
    { id: 'grindSize', label: 'Grind size', type: 'enum', options: GRIND_SIZES },
    { id: 'ratio', label: 'Brew ratio', type: 'ratio' },
    { id: 'website', label: 'Bean website', type: 'url', role: 'website', scope: 'item' },
    { id: 'notes', label: 'Review notes', type: 'longtext', role: 'notes' },
    { id: 'buyAgain', label: 'Would you buy it again?', type: 'flag' },
  ],

  /** Ordered fact rows on the detail page (both renderers). */
  facts: [
    { field: 'roastType', label: 'Roast type' },
    { field: 'roastLevel', label: 'Roast level' },
    { field: 'blend', label: 'Origin type' },
    { field: 'origins', label: 'Origin' },
    { field: 'process', label: 'Process' },
    { field: 'species', label: 'Species' },
    { field: 'variety', label: 'Variety' },
    { field: 'decaf', label: 'Decaf' },
    { field: 'organic', label: 'Organic' },
    { field: 'roastDate', label: 'Roast date' },
    { special: 'valuePer100g', label: 'Value' },
  ],

  /** Badges on a gallery card. */
  badges: [
    { field: 'roastType' },
    { field: 'roastLevel' },
    { field: 'blend' },
    { field: 'decaf', label: 'Decaf' },
    { field: 'organic', label: 'Organic' },
  ],

  filters: [
    { kind: 'maker', id: 'f-roaster', label: 'Roaster' },
    { kind: 'enum', id: 'f-roast', field: 'roastType', label: 'Roast type', options: ['Filter', 'Espresso', 'Omni (Filter & Espresso)'] },
    { kind: 'enum', id: 'f-blend', field: 'blend', label: 'Origin type', options: ['Single Origin', 'Blend'] },
    { kind: 'rating', id: 'f-rating', label: 'Min rating' },
    {
      kind: 'price',
      id: 'f-price',
      label: 'Price / 100g',
      bands: [
        { id: 'lt5', label: 'Under €5', min: 0, max: 5 },
        { id: '5-7.5', label: '€5 – €7.50', min: 5, max: 7.5 },
        { id: '7.5-10', label: '€7.50 – €10', min: 7.5, max: 10 },
        { id: 'gt10', label: 'Over €10', min: 10, max: Infinity },
      ],
    },
    { kind: 'flags', items: [{ field: 'decaf', label: 'Decaf' }, { field: 'organic', label: 'Organic' }] },
  ],

  /**
   * Coffee-specific clean-up after the generic sanitizer has run.
   * Pre-ground coffee was never ground by the reviewer, so a grinder or setting
   * they typed anyway is contradictory and gets dropped.
   */
  postProcess(review) {
    if (review.grindSource === 'Pre-ground') {
      review.grinder = null;
      review.grindSetting = null;
    }
    return review;
  },

  /**
   * How the beans were ground for this brew, e.g.
   * "Kingrinder K6 @ 100 clicks (Medium)" or "Pre-ground".
   * Returns null when the reviewer told us nothing about the grind.
   */
  grindText(review) {
    if (!review) return null;
    const size = review.grindSize && review.grindSize !== 'Unknown' ? review.grindSize : null;
    if (review.grindSource === 'Pre-ground') return size ? `Pre-ground (${size})` : 'Pre-ground';
    let head = null;
    if (review.grinder) head = review.grindSetting ? `${review.grinder} @ ${review.grindSetting}` : review.grinder;
    else if (review.grindSetting) head = `Ground at ${review.grindSetting}`;
    else if (review.grindSource === 'Ground by me') head = 'Ground by me';
    if (!head) return size ? `${size} grind` : null;
    return size ? `${head} (${size})` : head;
  },

  /**
   * The "·"-joined metadata line under a review, shared by the SPA and the
   * prerenderer so both always agree.
   * @param {object} review
   * @param {{cost:Function, weight:Function}} fmt pure formatters
   */
  reviewMeta(review, fmt) {
    return [
      fmt.cost(review.cost, review.currency),
      fmt.weight(review.weightGrams),
      review.brewMethod,
      coffee.grindText(review),
      review.ratio ? `Ratio ${review.ratio}` : null,
      review.buyAgain ? 'Would buy again' : null,
    ].filter(Boolean);
  },

  /** Extra, product-specific validation warnings. */
  extraWarnings(raw, review) {
    const warnings = [];
    if (review.grindSource === 'Pre-ground' && (raw.grinder || raw.grindSetting)) {
      warnings.push('You marked the coffee as **Pre-ground**, so the **Grinder** and **Grind setting** will be omitted.');
    }
    return warnings;
  },
};

export default coffee;
