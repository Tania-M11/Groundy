// English (default language, NASA Space Apps rule: public links in English).
// Every figure shown on the landing comes from api.groundy.site (queried 15 Nov 2026) or from the data source docs.
export const en = {
  nav: {
    explore: 'Explore',
    how: 'How it works',
    data: 'NASA data',
    team: 'Team',
    enter: 'Enter my farm',
    menu: 'Open menu',
    close: 'Close menu',
    lang: 'Español',
    langCode: 'ES',
    home: 'Groundy home',
  },
  hero: {
    badge: 'NASA Space Apps 2026 · Field Shift',
    title: 'Your farm, seen from space.',
    lead: 'Groundy brings NASA satellite and climate data down to your plot, keeps the story of every season you farm, and shows where each number comes from.',
    cta1: 'Enter my farm',
    cta2: 'Explore any point',
    aiNote: 'AI-generated illustration',
    pause: 'Pause background video',
    play: 'Play background video',
  },
  challenge: {
    title: 'Farmers read the sky. Space data rarely reaches the ground.',
    lead: 'Satellites observe every field on Earth, yet that knowledge seldom arrives in a form a farmer can use or trust.',
    items: [
      {
        title: 'Few stations nearby',
        text: 'In rural highlands weather stations are far apart, so planting decisions often rest on the memory of past seasons.',
      },
      {
        title: 'Data without context',
        text: 'A climate value usually describes an area tens of kilometres wide, not your plot, and tools rarely say so.',
      },
      {
        title: 'Forecasts or silence',
        text: 'Apps either promise forecasts they cannot back up or show raw numbers nobody explains.',
      },
    ],
  },
  platform: {
    title: 'Your plots, their seasons and the evidence, in one place',
    items: [
      {
        title: 'Mark your plots',
        text: 'Draw on satellite imagery or walk the border with your phone’s GPS. Area is computed geodesically.',
      },
      {
        title: 'Record every season',
        text: 'The plot stays; each season becomes a new crop cycle with its activities and harvest.',
      },
      {
        title: 'See what fits',
        text: 'Suitability for 42 crops and scored rotations for your location, naming the limiting factor.',
      },
      {
        title: 'Evidence behind every number',
        text: 'Source, period, resolution and method are one tap away from any value.',
      },
      {
        title: 'Records you can verify',
        text: 'Each event is chained to the previous one with a hash, so edits to the history become visible.',
      },
      {
        title: 'Works in the field',
        text: 'Everything is saved on your device first and synchronises when there is signal.',
      },
    ],
  },
  scale: {
    title: 'Each dataset sees your farm at a different size',
    lead: 'A 3-hectare plot is about one part in 120,000 of the NASA POWER climate cell that covers it. Groundy draws that footprint instead of hiding it.',
    hint: 'Choose a dataset to see its footprint.',
    note: 'Squares drawn on a logarithmic scale so all of them fit.',
    items: {
      s2: { label: 'Sentinel-2 pixel', size: '10 m', text: 'Fine enough to see differences inside the farm.' },
      plot: { label: 'Your plot', size: '~3 ha', text: 'About 180 × 180 m. This is what you manage.' },
      modis: { label: 'MODIS vegetation pixel', size: '250 m', text: 'One value may mix your plot with its neighbours.' },
      smap: { label: 'SMAP soil moisture', size: '~9 km', text: 'A regional reading of the soil, not your field’s.' },
      imerg: { label: 'GPM IMERG rainfall', size: '~10 km', text: 'Satellite rain estimate for the whole area.' },
      power: { label: 'NASA POWER climate', size: '~55 × 69 km', text: 'Temperature and rain averaged over a large cell.' },
    },
  },
  data: {
    title: 'The space data behind Groundy',
    lead: 'Only sources that run in Groundy today are listed. Each one states what it can tell you and what it cannot.',
    head: { source: 'Source', what: 'What it tells you', res: 'Resolution', cannot: 'What it cannot tell you' },
    partner: 'ESA Copernicus, complements NASA data',
    rows: [
      {
        source: 'NASA POWER',
        what: 'Temperature, rainfall, reference evapotranspiration (ET₀) and aridity',
        res: '0.5° × 0.625° (~55 × 69 km)',
        cannot: 'Frost on a hillside or rain on a single plot',
      },
      {
        source: 'GPM IMERG',
        what: 'Satellite-estimated monthly rainfall',
        res: '~10 km',
        cannot: 'Exact rain in your field; it can differ widely from POWER',
      },
      {
        source: 'MODIS MOD13Q1',
        what: 'Vegetation greenness (NDVI, EVI) month by month',
        res: '250 m',
        cannot: 'Which crop is planted or whether it is sick',
      },
      {
        source: 'MODIS MOD11A2',
        what: 'Land surface temperature',
        res: '1 km',
        cannot: 'Air temperature; the ground is hotter by day',
      },
      {
        source: 'SMAP L4',
        what: 'Surface and root-zone soil moisture',
        res: '~9 km',
        cannot: 'Moisture in your own plot’s soil',
      },
      {
        source: 'SRTM',
        what: 'Elevation and slope inside the farm',
        res: '30 m',
        cannot: 'Soil fertility or drainage',
      },
      {
        source: 'Sentinel-2',
        what: 'Detailed greenness inside the farm',
        res: '10 m',
        cannot: 'Conditions on cloudy dates',
        partner: true,
      },
    ],
    foot: 'Processed by the Groundy API with Google Earth Engine and the NASA POWER service.',
  },
  how: {
    title: 'How a number reaches you',
    steps: [
      { title: 'You mark a point or a plot', text: 'Using your location or drawing on the map.' },
      {
        title: 'Groundy queries space data',
        text: 'The Groundy API asks NASA POWER and Google Earth Engine. A new place takes about a minute and a half; repeated places answer instantly.',
      },
      { title: 'The engine scores crops', text: 'Suitability for 42 crops and rotations, naming what limits them: rain or temperature.' },
      { title: 'Every value becomes a fact', text: 'Each one keeps its source, period, resolution and the engine version that produced it.' },
      {
        title: 'You decide, and it is recorded',
        text: 'Potatonaut explains; you accept, dismiss or adjust, and your decision joins the plot’s history.',
      },
    ],
    example: {
      title: 'A real reading · Ipiales, Nariño, Colombia',
      rows: [
        ['Annual rainfall · NASA POWER', '1,105 mm'],
        ['Annual rainfall · GPM IMERG', '2,078 mm'],
        ['Mean temperature · NASA POWER', '13.2 °C'],
        ['Potato suitability · best month', '0.92 · October'],
      ],
      note: 'The two rain sources disagree, so Groundy shows a range of 1,105 to 2,078 mm instead of choosing one.',
      source: 'api.groundy.site · engine 1.2 · queried 15 Nov 2026',
    },
  },
  potatonaut: {
    title: 'Meet Potatonaut',
    lead: 'A potato astronaut who explains your data in plain words. It only uses values from your own analysis, and it tells you when it does not know.',
    you: 'You',
    chat: [
      {
        q: 'Will it rain next week?',
        a: 'I don’t make weather forecasts. I can show you how this month usually behaves in your area, from past satellite records.',
      },
      {
        q: 'How reliable is this rainfall value for my plot?',
        a: 'It averages a cell of about 55 × 69 km. Your plot is a tiny part of it, so read it as regional, not as your field.',
      },
      {
        q: 'What should I plant?',
        a: 'I can show which crops have suited your area’s climate and why. The decision is yours, and an agronomist can confirm it.',
      },
    ],
  },
  team: {
    title: 'Made by Potatonauts',
    lead: 'A team from Ipiales, Colombia, answering the Field Shift challenge of the NASA Space Apps Challenge 2026.',
  },
  cta: {
    title: 'Start with one plot',
    lead: 'Draw it, tell Groundy what you plant and look at the evidence.',
    button: 'Enter my farm',
  },
  footer: {
    platform: 'Platform',
    resources: 'Resources',
    explore: 'Explore any point',
    farm: 'My farm',
    methods: 'NASA data we use',
    api: 'API documentation',
    ai: 'AI usage statement',
    repo: 'Source code',
    event: 'NASA Space Apps Challenge 2026 · Field Shift',
    disclaimer: 'Groundy is an open project by Potatonauts. It is not an official NASA product.',
  },
  soon: {
    title: 'Coming soon',
    lead: 'Potatonaut is still building this part of Groundy.',
    back: 'Back to home',
  },
  app: {
    nav: {
      home: 'Home',
      map: 'Map',
      crops: 'Crops',
      history: 'History',
      profile: 'Profile',
      main: 'My farm sections',
      site: 'Groundy website',
    },
    farmFallback: 'My farm',
    soonBadge: 'Coming soon',
    sections: {
      home: {
        title: 'Today on my farm',
        lead: 'What deserves your attention today, with the evidence behind it.',
        emptyTitle: 'Your farm starts with one plot',
        emptyText: 'Register your first crop and Groundy will analyse its plot with NASA data.',
        cta: 'Register a crop',
      },
      map: {
        title: 'My farm from space',
        lead: 'Your live location, your plots and the real size of each dataset over them.',
        emptyTitle: 'The satellite map is on its way',
        emptyText: 'You will follow your location in real time, draw or walk the border of each plot and turn on NASA layers.',
      },
      crops: {
        title: 'Crop cycles',
        lead: 'Each plot keeps its seasons: what you planted, when, and what happened.',
        emptyTitle: 'No plots yet',
        emptyText: 'Register a crop to draw its plot on the satellite map and start its first season.',
        cta: 'Register a crop',
      },
      history: {
        title: 'What happened',
        lead: 'Two histories kept apart: what you did on the farm, and how the climate behaved in your area.',
        farmTab: 'My records',
        climateTab: 'Climate memory',
        emptyFarmTitle: 'Nothing recorded yet',
        emptyFarmText: 'Every sowing, activity and harvest you register will appear here in order, sealed so it cannot be changed silently.',
        emptyClimateTitle: 'Your area’s climate, month by month',
        emptyClimateText: 'Once a plot is analysed you will see how rain, soil moisture and greenness usually behave through the year.',
      },
      profile: {
        title: 'Profile',
        lead: 'Your account, your farm and how your data is used.',
        language: 'Language',
        storage: 'Where your data lives',
        storageText: 'For now everything is saved on this device. Syncing with your Groundy account comes next.',
        links: 'About Groundy',
        ai: 'AI usage statement',
        site: 'Groundy website',
        methods: 'NASA data we use',
      },
    },
    potatonaut: {
      open: 'Ask Potatonaut',
      close: 'Close Potatonaut',
      context: 'You are in',
      greeting: 'Hi! I explain your farm’s data in plain words, and I always tell you where each number comes from. Pick a question to start.',
      suggested: 'Suggested questions',
      placeholder: 'Write a question…',
      send: 'Send',
      inputSoon: 'Free questions arrive soon. For now, choose one of the suggestions.',
      learning: 'I’m still learning to answer this with your own data. Soon I’ll reply citing each source, period and resolution.',
      you: 'You',
      suggestions: {
        home: ['What should I check today?', 'Where do your numbers come from?'],
        map: ['How reliable is this data for my plot?', 'Why is the climate cell so big?'],
        crops: ['Why do you suggest this rotation?', 'What changes if my soil is more clayey?'],
        history: ['What is the water balance?', 'How was this chart calculated?'],
        profile: ['Where is my data stored?', 'Which NASA data do you use?'],
      },
    },
  },
}

export type Dict = typeof en
