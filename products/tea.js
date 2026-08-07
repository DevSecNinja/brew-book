/**
 * Tea product configuration — "Leaf Book".
 *
 * Same shape (and the same generic pipeline) as products/coffee.js — only the
 * vocabulary, the field schema and the presentation differ. Keep this file
 * dependency-free and DOM-free: it runs in Node during the build and is copied
 * into the deployed site as `src/product.config.js` for the browser.
 *
 * Every `label` must match `.github/ISSUE_TEMPLATE/tea-review.yml` verbatim.
 */

const BRANDS = [
  'Other (not listed)', 'Simon Lévelt', 'Or Tea?', 'Pickwick', 'Zenzo Tea',
  'Betjeman & Barton', 'Mariage Frères', 'Dammann Frères', 'Kusmi Tea',
  'Ronnefeldt', 'Teekanne', 'Whittard of Chelsea', 'Twinings', 'Fortnum & Mason',
  'Rare Tea Company', 'Postcard Teas', 'Yunomi', 'Ippodo Tea', 'Marukyu Koyamaen',
  'What-Cha', 'Bitterleaf Teas', 'white2tea', 'Yunnan Sourcing', 'Teasenz',
  'Home / Self-blended',
];

const TEA_TYPES = [
  'White', 'Green', 'Yellow', 'Oolong', 'Black', 'Dark (Pu-erh / Hei Cha)',
  'Herbal / Tisane', 'Rooibos', 'Matcha', 'Unknown',
];
const FORMS = [
  'Loose leaf', 'Tea bag', 'Sachet', 'Compressed (cake / tuo / brick)',
  'Powder', 'Unknown',
];
const BLENDS = ['Single Origin', 'Blend', 'Unknown'];
const OXIDATIONS = [
  'Unoxidised', 'Lightly oxidised', 'Semi-oxidised', 'Fully oxidised',
  'Post-fermented', 'Roasted', 'Smoked', 'Other', 'Unknown',
];
const HARVESTS = [
  'First flush (spring)', 'Second flush (summer)', 'Autumn flush',
  'Monsoon', 'Winter', 'Unknown',
];
const BREW_METHODS = [
  'Gongfu (gaiwan / small pot)', 'Western (mug / teapot)', 'Grandpa style',
  'Whisked (matcha)', 'Cold brew', 'Iced', 'Other',
];
const FLAVOURS = [
  'Floral', 'Fruity (stone / tropical)', 'Citrus', 'Berry', 'Grassy / Vegetal',
  'Nutty', 'Malty', 'Honey / Sweet', 'Chocolate / Cocoa', 'Spicy', 'Smoky',
  'Earthy / Woody', 'Creamy / Buttery', 'Mineral', 'Umami', 'Astringent',
];

const tea = {
  id: 'tea',

  site: {
    name: 'Leaf Book',
    title: 'Leaf Book — Tea reviews',
    tagline: 'A hand-kept log of teas worth remembering — ratings, growers and tasting notes.',
    description: 'A hand-kept log of teas worth remembering — ratings, brands and tasting notes. Untappd, but for tea.',
    schemaDescription: 'Untappd for tea — a hand-kept log of tea reviews.',
    url: 'https://tea.ravensberg.org',
    repoUrl: 'https://github.com/DevSecNinja/bean-book',
    mark: '🍃',
    locale: 'en_GB',
    schemaCategory: 'Tea',
    emptyTitle: 'Nothing steeping yet',
    noScript: 'Leaf Book needs JavaScript to display tea reviews.',
    manifest: {
      shortName: 'Leaf Book',
      categories: ['food', 'lifestyle'],
      screenshotLabel: 'Browse the tea gallery',
      hasScreenshots: false,
    },
  },

  terms: {
    item: 'tea',
    items: 'teas',
    Item: 'Tea',
    Items: 'Teas',
    maker: 'brand',
    makers: 'brands',
    Maker: 'Brand',
    routeBase: 'tea',
    searchPlaceholder: 'Search teas, brands, origins, flavours…',
    addReview: 'Add a review',
    firstReview: '🍃 Add the first review',
    websiteLink: 'Visit tea page ↗',
  },

  theme: {
    light: {
      bg: '#f4f7f1', 'bg-elev': '#ffffff', surface: '#ffffff', text: '#1e2b1f',
      'text-muted': '#5f6f5e', border: '#dbe6d6', accent: '#3f7d3f',
      'accent-strong': '#2c5c2c', 'accent-contrast': '#ffffff', link: '#2c5c2c',
      star: '#c8961f', 'star-empty': '#c9d6c4',
      shadow: '0 1px 2px rgba(24, 40, 26, 0.06), 0 8px 24px rgba(24, 40, 26, 0.08)',
    },
    dark: {
      bg: '#111a12', 'bg-elev': '#18251a', surface: '#18251a', text: '#e8f1e6',
      'text-muted': '#9bb098', border: '#243626', accent: '#79c07a',
      'accent-strong': '#a2d9a2', 'accent-contrast': '#18251a', link: '#79c07a',
      star: '#e5b95a', 'star-empty': '#31462f',
      shadow: '0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.4)',
    },
  },

  issue: {
    template: 'tea-review.yml',
    formLabel: 'tea-review',
    publishLabel: 'published',
  },

  data: {
    file: 'data/tea.json',
    sample: 'data/tea.sample.json',
  },

  pricePer100g: true,

  fields: [
    { id: 'name', label: 'Tea name', type: 'text', role: 'name', required: true },
    {
      id: 'maker',
      label: 'Brand',
      otherLabel: 'Brand (if not listed)',
      type: 'choiceOther',
      role: 'maker',
      required: true,
      options: BRANDS,
    },
    { id: 'teaType', label: 'Tea type', type: 'enum', options: TEA_TYPES, fallback: 'Unknown', scope: 'item' },
    { id: 'form', label: 'Leaf form', type: 'enum', options: FORMS, fallback: 'Unknown', scope: 'item' },
    { id: 'blend', label: 'Single origin or blend?', type: 'enum', options: BLENDS, fallback: 'Unknown', scope: 'item' },
    { id: 'rating', label: 'Rating', type: 'rating', role: 'rating', required: true },
    { id: 'caffeineFree', label: 'Caffeine free', type: 'flag', scope: 'item' },
    { id: 'organic', label: 'Organic', type: 'flag', scope: 'item' },
    { id: 'harvest', label: 'Harvest', type: 'enum', options: HARVESTS, scope: 'item' },
    { id: 'harvestYear', label: 'Harvest year', type: 'number', integer: true, min: 1900, max: 2200, scope: 'item' },
    { id: 'origins', label: 'Origin', type: 'list', scope: 'item', splitWhen: { field: 'blend', equals: 'Blend' } },
    { id: 'oxidation', label: 'Oxidation / processing', type: 'enum', options: OXIDATIONS, scope: 'item' },
    { id: 'cultivar', label: 'Cultivar', type: 'text', scope: 'item' },
    { id: 'currency', label: 'Currency', type: 'currency' },
    { id: 'cost', label: 'Cost', type: 'number', role: 'cost', min: 0 },
    { id: 'weightGrams', label: 'Weight (grams)', type: 'number', role: 'weight', integer: true, min: 1 },
    { id: 'flavours', label: 'Flavour profiles', type: 'checklist', options: FLAVOURS, role: 'flavours', max: 10 },
    { id: 'brewMethod', label: 'How did you brew it?', type: 'enum', options: BREW_METHODS },
    { id: 'waterTemp', label: 'Water temperature (°C)', type: 'number', integer: true, min: 1, max: 100 },
    { id: 'steepTime', label: 'Steep time', type: 'text' },
    { id: 'steeps', label: 'Number of infusions', type: 'number', integer: true, min: 1, max: 99 },
    { id: 'ratio', label: 'Brew ratio', type: 'ratio' },
    { id: 'website', label: 'Tea website', type: 'url', role: 'website', scope: 'item' },
    { id: 'notes', label: 'Review notes', type: 'longtext', role: 'notes' },
    { id: 'buyAgain', label: 'Would you buy it again?', type: 'flag' },
  ],

  facts: [
    { field: 'teaType', label: 'Tea type' },
    { field: 'form', label: 'Leaf form' },
    { field: 'blend', label: 'Origin type' },
    { field: 'origins', label: 'Origin' },
    { field: 'oxidation', label: 'Oxidation' },
    { field: 'cultivar', label: 'Cultivar' },
    { field: 'harvest', label: 'Harvest' },
    { field: 'harvestYear', label: 'Harvest year' },
    { field: 'caffeineFree', label: 'Caffeine free' },
    { field: 'organic', label: 'Organic' },
    { special: 'valuePer100g', label: 'Value' },
  ],

  badges: [
    { field: 'teaType' },
    { field: 'form' },
    { field: 'blend' },
    { field: 'caffeineFree', label: 'Caffeine free' },
    { field: 'organic', label: 'Organic' },
  ],

  filters: [
    { kind: 'maker', id: 'f-brand', label: 'Brand' },
    {
      kind: 'enum',
      id: 'f-type',
      field: 'teaType',
      label: 'Tea type',
      options: TEA_TYPES.filter((t) => t !== 'Unknown'),
    },
    {
      kind: 'enum',
      id: 'f-form',
      field: 'form',
      label: 'Leaf form',
      options: FORMS.filter((t) => t !== 'Unknown'),
    },
    { kind: 'rating', id: 'f-rating', label: 'Min rating' },
    {
      kind: 'price',
      id: 'f-price',
      label: 'Price / 100g',
      bands: [
        { id: 'lt5', label: 'Under €5', min: 0, max: 5 },
        { id: '5-10', label: '€5 – €10', min: 5, max: 10 },
        { id: '10-20', label: '€10 – €20', min: 10, max: 20 },
        { id: 'gt20', label: 'Over €20', min: 20, max: Infinity },
      ],
    },
    { kind: 'flags', items: [{ field: 'caffeineFree', label: 'Caffeine free' }, { field: 'organic', label: 'Organic' }] },
  ],

  /** Nothing tea-specific to clean up beyond the generic sanitizer. */
  postProcess(review) {
    return review;
  },

  /** "95 °C · 3 min · 5 infusions" — how this cup was actually made. */
  steepText(review) {
    return [
      review.waterTemp != null ? `${review.waterTemp} °C` : null,
      review.steepTime,
      review.steeps != null ? `${review.steeps} infusion${review.steeps === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ') || null;
  },

  reviewMeta(review, fmt) {
    return [
      fmt.cost(review.cost, review.currency),
      fmt.weight(review.weightGrams),
      review.brewMethod,
      tea.steepText(review),
      review.ratio ? `Ratio ${review.ratio}` : null,
      review.buyAgain ? 'Would buy again' : null,
    ].filter(Boolean);
  },

  extraWarnings() {
    return [];
  },
};

export default tea;
