// frontend/src/i18n/messages.ts — bilingual copy (Te reo Māori / English).
// Source: operator-supplied Wai Action onboarding & microcopy. Keep the `en`
// and `mi` trees structurally identical — both must satisfy Messages.

export type Lang = 'en' | 'mi';

const en = {
  onboarding: {
    welcome: {
      title: 'Welcome to Wai Action',
      subtitle: 'A tool to care for Aotearoa’s waters.',
      body: 'By using less water, keeping pollutants out of drains, and having a say in decisions, we can improve the health of our water and our people.',
      button: 'Get started',
    },
    why: {
      title: 'Why this app exists',
      body: 'Aotearoa’s water systems are under pressure from ageing infrastructure, population growth, climate change and funding gaps. These affect drinking water safety, wastewater and stormwater that flows into our rivers and seas.',
      button: 'Continue',
    },
    principles: {
      title: 'Guiding principles',
      bullets: [
        { lead: 'Te Tiriti o Waitangi:', rest: 'Water is a taonga; iwi and hapū must have meaningful input into decisions.' },
        { lead: 'Kaitiakitanga:', rest: 'Protect the life force of water for future generations.' },
        { lead: 'Manaakitanga:', rest: 'Uphold people’s mana and include all cultures.' },
      ],
      button: 'Continue',
    },
    done: 'Start today',
    skip: 'Skip',
  },
  actions: {
    title: 'Wai actions',
    intro:
      'Pick three small actions: one for water use, one for pollutants, one for participation. Together, these small steps add up to big change for our water and our people.',
    modules: [
      {
        title: 'Use less water',
        subtitle: 'Simple ways to reduce your water use.',
        body: 'Reducing household water use eases pressure on treatment plants and pipes.',
        cards: [
          { lead: 'Shorten showers', rest: 'Aim for 4 minutes or less.' },
          { lead: 'Turn off the tap', rest: 'While brushing teeth or shaving.' },
          { lead: 'Full loads only', rest: 'Washing machine and dishwasher.' },
          { lead: 'Fix leaks', rest: 'A dripping tap? Repair it promptly.' },
          { lead: 'Low-flow showerhead', rest: 'Install a water-efficient head.' },
        ],
        cta: 'Start an action',
      },
      {
        title: 'Keep pollutants out',
        subtitle: 'Drains only for rain.',
        body: 'Most stormwater is untreated before reaching streams and harbours.',
        cards: [
          { lead: 'Don’t hose chemicals', rest: 'No paint, oil or cleaners to stormwater.' },
          { lead: 'Wash cars on grass', rest: 'Not on concrete that drains to streams.' },
          { lead: 'Sweep, don’t hose', rest: 'Driveways and paths.' },
          { lead: 'Don’t flush wipes', rest: 'Or nappies and sanitary products.' },
          { lead: 'No fats/oils down the sink', rest: 'Cool and bin them.' },
        ],
        cta: 'Start an action',
      },
      {
        title: 'Get involved',
        subtitle: 'Your voice, your impact.',
        body: 'You can influence council and community decisions about water through submissions, meetings and local projects.',
        cards: [
          { lead: 'Make a submission', rest: 'On Long-Term Plans and water strategies.' },
          { lead: 'Attend a meeting', rest: 'About water, rivers or stormwater.' },
          { lead: 'Join a local group', rest: 'Stream care, planting, wetlands.' },
          { lead: 'Check your water quality', rest: 'LAWA and council websites.' },
        ],
        cta: 'Find an action',
      },
    ],
  },
  settings: {
    title: 'Settings',
    language: { label: 'Language', options: { mi: 'Te reo Māori', en: 'English' } },
    location: {
      label: 'Your location',
      helper: 'So we can show relevant info for your area (council, rivers, projects).',
    },
    notifications: {
      title: 'Notifications',
      options: [
        'Water action reminders',
        'Local meetings and workshops',
        'Drinking water safety alerts (e.g. boil-water notices)',
      ],
    },
  },
  nav: { report: 'Report a leak', map: 'Map', actions: 'Wai actions', settings: 'Settings' },

  labels: {
    location: {
      footpath: 'Footpath',
      berm: 'Berm / verge',
      road: 'Road',
      water_meter: 'Water meter / toby',
      outside_tap: 'Outside tap',
      other_public: 'Other public place',
    },
    status: {
      received: 'Received',
      investigating: 'Investigating',
      contractor_assigned: 'Contractor assigned',
      resolved: 'Fixed',
      closed_private: 'Private property',
    },
    sla: {
      on_track: 'On track',
      due_soon: 'Due soon',
      breached: 'Overdue',
      met: 'Fixed in time',
      missed: 'Fixed late',
      'n/a': '—',
    },
    severity: { major: 'Major', minor: 'Minor' },
    severityHelp: {
      major:
        'Gushing or spraying; flowing across road or footpath; flooding property; a hole or sinking in the road; loss of pressure.',
      minor: 'A steady trickle; damp or boggy berm; pooling water; a dripping meter or tap.',
    },
  },

  time: {
    justNow: 'just now',
    minutesAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n} hour${n === 1 ? '' : 's'} ago`,
    daysAgo: (n: number) => `${n} day${n === 1 ? '' : 's'} ago`,
  },

  common: {
    loading: 'Loading…',
    reported: 'reported',
    verifiedByCouncil: 'Verified by council',
    seenByOthers: (n: number) => `Seen by ${n} other${n === 1 ? '' : 's'}`,
    councilUpdate: 'Council update:',
    slaDue: 'SLA due',
    backToMap: '← Map',
  },

  reportPage: {
    title: 'Report a water leak',
    subtitle: 'Spotted a leak on public land? Tell the council in 30 seconds.',
    privateNote: 'Leak on your own property? That’s the owner’s job — call a plumber.',
  },

  form: {
    step1Title: '1. Where is the leak?',
    step1Help: 'Tap the map to drop a pin, then drag it to the exact spot.',
    checking: 'Checking nearby reports…',
    confirmSpot: 'Confirm this spot',
    dropPin: 'Tap the map to drop a pin',
    step2Title: '2. Where is the water?',
    step3Title: '3. How bad is it?',
    step4Title: '4. Details',
    descPlaceholder: 'e.g. water bubbling up through the berm, running down the gutter',
    photosLabel: 'Photos (up to 3 — helps the crew find it)',
    namePlaceholder: 'Name (optional)',
    contactPlaceholder: 'Email or mobile (optional — for updates)',
    sending: 'Sending…',
    send: 'Send report',
    submitError: 'Could not submit — please try again',
    dupTitle: 'Is this the leak you’re reporting?',
    dupHelp: 'These were reported nearby. Tap one if it’s the same leak — the council already knows.',
    metresAway: 'm away',
    seenBy: (n: number) => `seen by ${n} other${n === 1 ? '' : 's'}`,
    fixedAgain: 'Fixed recently — is it leaking again?',
    leakingAgain: 'It’s leaking again — report it',
    yesThatsIt: 'Yes, that’s it',
    different: 'No, mine’s different — continue',
    alreadyKnown: 'Thanks — the council already knows.',
    trackThatReport: 'Track that report →',
    sent: 'Report sent',
    routedTo: (council: string, zone: string) => `Routed to ${council} (${zone}).`,
    trackYours: 'Track your report →',
    similarNearby: (n: number) =>
      `Note: ${n} similar open report${n === 1 ? '' : 's'} nearby — staff will link them if it’s the same leak.`,
  },

  mapPage: {
    title: 'Leak map',
    all: 'All',
    dropOff: 'Fixed leaks drop off the map after 7 days.',
  },

  statusPage: {
    iveSeenToo: 'I’ve seen this leak too',
    confirmError: 'Could not record that — try again',
    thanks: 'Thanks — noted.',
    openTracking: 'Seen this leak too? Open the tracking page',
    notFound: 'Report not found',
    notFoundBody: 'This report does not exist or may have been removed.',
    viewMap: '← View the map',
    statusHeading: 'Status',
  },

  staff: {
    signIn: 'Staff sign in',
    emailPlaceholder: 'name@council.govt.nz',
    password: 'Password',
    signInButton: 'Sign in',
    loginFailed: 'login failed',
    dashboard: 'Duty dashboard',
    refreshNote: 'refreshes every 30 s',
    signOut: 'Sign out',
    filterOpen: 'Open',
    filterDueSoon: 'Due soon',
    filterBreached: 'Overdue',
    filterAll: 'All',
    refreshFailed: 'Refresh failed — will retry in 30 s',
    confirmations: (n: number) => `+${n} confirmations`,
    possibleDuplicate: 'Possible duplicate',
    verified: 'verified',
    publicPage: 'public page →',
    reporter: 'Reporter:',
    hide: 'hide',
    unverify: 'Unverify',
    verify: 'Verify',
    notePlaceholder: 'Public note (e.g. crew booked Thursday)',
    post: 'Post',
    dupPlaceholder: 'Duplicate of report id (e.g. 1042)',
    markDuplicate: 'Mark duplicate',
    noReports: 'No reports.',
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends (...args: never[]) => string
    ? T
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { [K in keyof T]: Widen<T[K]> };

export type Messages = Widen<typeof en>;

const mi: Messages = {
  onboarding: {
    welcome: {
      title: 'Nau mai ki Wai Action',
      subtitle: 'He taputapu hei tiaki i ngā wai o Aotearoa.',
      body: 'Mā te whakamahi wai kia iti iho, mā te karo i ngā matū ki ngā rere, mā te whai wāhi ki ngā whakatau, ka pakari ake te hauora o te wai, o te tāngata.',
      button: 'Tīmata',
    },
    why: {
      title: 'Te take o tēnei app',
      body: 'Kei te pēhia ngā pūnaha wai o Aotearoa – he pūnaha tawhito, he taupori e tipu ana, he huringa āhuarangi, he iti ngā pūtea. Ka pā ēnei ki te haumaru o te wai inu, ki te wai paruparu, ki te wai ā-āwhina e rere ana ki ō tātou awa, moana.',
      button: 'Kia haere tonu',
    },
    principles: {
      title: 'Ngā mātāpono',
      bullets: [
        { lead: 'Te Tiriti o Waitangi:', rest: 'He taonga te wai; me whai wāhi mai ngā iwi, ngā hapū ki ngā whakatau.' },
        { lead: 'Kaitiakitanga:', rest: 'Tiakina te mauri o te wai mō āpōpō.' },
        { lead: 'Manaakitanga:', rest: 'Hāpai i te mana o te tangata; whakauru i ngā ahurea katoa.' },
      ],
      button: 'Kia haere tonu',
    },
    done: 'Tīmata i tēnei rā',
    skip: 'Tīkape',
  },
  actions: {
    title: 'Ngā mahi wai',
    intro:
      'Kōwhiria tētahi mahi iti e toru: tētahi mō te whakamahi wai, tētahi mō ngā matū, tētahi mō te whai wāhi. Ka huihuia ēnei mahi iti e te hapori, ka nui te hua mō te wai, mō te tāngata.',
    modules: [
      {
        title: 'Whakamahia te wai kia iti iho',
        subtitle: 'Ngā huarahi māmā hei whakaheke i tō whakamahi wai.',
        body: 'Mā te whakaiti i te whakamahi wai ka māmā ake te pēhanga ki ngā pūnaha wai inu, wai paruparu hoki.',
        cards: [
          { lead: 'Whakapoto i ngā kaukau', rest: 'Whāia te 4 meneti, iti iho rānei.' },
          { lead: 'Kati te rīki', rest: 'I te wā o te horoi niho, te kanikani rānei.' },
          { lead: 'Kī katoa ngā mīhini', rest: 'Horoi kākahu, rihi hoki ina kī.' },
          { lead: 'Whakatikatika i ngā rīki', rest: 'He rīki e rere ana? Whakatikatika wawe.' },
          { lead: 'Upoko kaukau e whakaheke ana i te rere', rest: 'Tāutahia he upoko hou.' },
        ],
        cta: 'Tīmata i tētahi mahi',
      },
      {
        title: 'Kaua e tukuna ngā matū ki ngā wai',
        subtitle: 'Ko te ua anake ki ngā rere.',
        body: 'He nui ngā wā, kāore e tātaritia te wai ā-āwhina; ko ngā mea ka horoia ki ngā rori, ki ngā ngongo, ka tae tika ki ngā awa.',
        cards: [
          { lead: 'Kaua e horoia ngā matū', rest: 'Kaua e tukuna ngā tae, hinu, matū ki ngā rere.' },
          { lead: 'Horoia te waka ki runga pātītī', rest: 'Kaua ki runga sima e rere ana.' },
          { lead: 'Harau, kaua e horoia', rest: 'Ngā ara, ngā taraiwa.' },
          { lead: 'Kaua e flushia ngā wīpai', rest: 'Me ngā panana, taonga wahine.' },
          { lead: 'Kaua e ringi hinu ki te ngongo', rest: 'Tukuna kia mātao, kātahi ka maka.' },
        ],
        cta: 'Tīmata i tētahi mahi',
      },
      {
        title: 'Whai wāhi ki ngā whakatau mō te wai',
        subtitle: 'Tō reo, tō pānga.',
        body: 'Ka taea e koe te whai pānga ki ngā whakatau a te kaunihera, a te hapori mō te wai – mā ngā whakaaro, mā ngā hui, mā ngā kaupapa tiaki awa.',
        cards: [
          { lead: 'Tukuna he whakaaro', rest: 'Ki ngā Mahere Roa, ki ngā rautaki wai.' },
          { lead: 'Haere ki tētahi hui', rest: 'Mō te wai, mō ngā awa, mō ngā rere.' },
          { lead: 'Mahi tahi ki tētahi rōpū', rest: 'Tiaki awa, whakatipu rākau, whakatipu repo.' },
          { lead: 'Mātaki i tō kounga wai', rest: 'LAWA, paetukutuku a te kaunihera.' },
        ],
        cta: 'Kitea tētahi mahi',
      },
    ],
  },
  settings: {
    title: 'Tautuhinga',
    language: { label: 'Reo', options: { mi: 'Te reo Māori', en: 'English' } },
    location: {
      label: 'Tō tūwāhi',
      helper: 'Kia tika ai ngā mōhiohio mō tō rohe (kaunihera, awa, kaupapa).',
    },
    notifications: {
      title: 'Ngā panonitanga',
      options: [
        'Whakamaumahara mō ngā mahi wai',
        'Ngā hui me ngā wānanga a-rohe',
        'Ngā mōhiohio haumaru wai inu (pēnei i ngā pānui whakapupū)',
      ],
    },
  },
  nav: { report: 'Pūrongo i tētahi rīki', map: 'Mapi', actions: 'Ngā mahi wai', settings: 'Tautuhinga' },

  labels: {
    location: {
      footpath: 'Ara hīkoi',
      berm: 'Pātītī tapa rori (berm)',
      road: 'Rori',
      water_meter: 'Mīta wai / toby',
      outside_tap: 'Rīki wāwaho',
      other_public: 'Wāhi tūmatanui kē atu',
    },
    status: {
      received: 'Kua tae mai',
      investigating: 'Kei te tūhuratia',
      contractor_assigned: 'Kua tohua he kaitukumahi',
      resolved: 'Kua whakatikatika',
      closed_private: 'Whenua tūmataiti',
    },
    sla: {
      on_track: 'Kei te haere pai',
      due_soon: 'Me oti wawe',
      breached: 'Kua hipa te wā',
      met: 'I oti i te wā',
      missed: 'I takaroa',
      'n/a': '—',
    },
    severity: { major: 'Nui', minor: 'Iti' },
    severityHelp: {
      major:
        'E pupū ana, e pīkari ana rānei; e rere ana puta noa i te rori, i te ara hīkoi rānei; e waipuke ana i te whenua; he rua, he tōngo rānei i te rori; kua ngaro te pēhanga wai.',
      minor: 'He rere iti; he pātītī mākū, poipoi rānei; he wai e tū ana; he mīta, he rīki rānei e tūheke ana.',
    },
  },

  time: {
    justNow: 'nāianei tonu',
    minutesAgo: (n: number) => `${n} meneti ki mua`,
    hoursAgo: (n: number) => `${n} hāora ki mua`,
    daysAgo: (n: number) => `${n} rā ki mua`,
  },

  common: {
    loading: 'E tāuta ana…',
    reported: 'i pūrongohia',
    verifiedByCouncil: 'Kua whakaūngia e te kaunihera',
    seenByOthers: (n: number) => `Kua kitea e ${n} atu`,
    councilUpdate: 'Whakahōu a te kaunihera:',
    slaDue: 'Me oti i mua i te',
    backToMap: '← Mapi',
  },

  reportPage: {
    title: 'Pūrongo i tētahi rīki wai',
    subtitle: 'Kua kitea e koe he rīki i te wāhi tūmatanui? Whakamōhiotia te kaunihera i roto i te 30 hēkona.',
    privateNote: 'He rīki i runga i tō ake whenua? Ko te mahi a te kaikainga tērā — waea atu ki tētahi kaimahi wai (plumber).',
  },

  form: {
    step1Title: '1. Kei hea te rīki?',
    step1Help: 'Pāwhiritia te mapi hei whakatakoto pine, kātahi ka tō kia tika te wāhi.',
    checking: 'E tirotiro ana i ngā pūrongo tata…',
    confirmSpot: 'Whakaūngia tēnei wāhi',
    dropPin: 'Pāwhiritia te mapi hei whakatakoto pine',
    step2Title: '2. Kei hea te wai?',
    step3Title: '3. He pēhea te kaha?',
    step4Title: '4. Ngā taipitopito',
    descPlaceholder: 'hei tauira: he wai e pī ana puta i te pātītī, e rere ana i te tahataha',
    photosLabel: 'Ngā whakaahua (kia 3 rawa — hei āwhina i te kaimahi ki te kimi)',
    namePlaceholder: 'Ingoa (kōwhiringa)',
    contactPlaceholder: 'Īmēra, waea pūkoro rānei (kōwhiringa — mō ngā whakahōu)',
    sending: 'E tuku ana…',
    send: 'Tukuna te pūrongo',
    submitError: 'Kāore i taea te tuku — ngānobarua',
    dupTitle: 'Koia tēnei te rīki e pūrongo ana koe?',
    dupHelp: 'I pūrongohia ēnei i konei tata. Pāwhiritia tētahi mēnā ko te rīki kotahi — kua mōhio kē te kaunihera.',
    metresAway: 'm te tawhiti',
    seenBy: (n: number) => `kua kitea e ${n} atu`,
    fixedAgain: 'I whakatikahia i nā tata — kei te rīki anō?',
    leakingAgain: 'Kei te rīki anō — pūrongo i a ia',
    yesThatsIt: 'Āe, koia tēnā',
    different: 'Kāo, he rerekē tāku — haere tonu',
    alreadyKnown: 'Ngā mihi — kua mōhio kē te kaunihera.',
    trackThatReport: 'Aroturuki i taua pūrongo →',
    sent: 'Kua tukuna te pūrongo',
    routedTo: (council: string, zone: string) => `Kua whakawhiti ki ${council} (${zone}).`,
    trackYours: 'Aroturuki i tō pūrongo →',
    similarNearby: (n: number) =>
      `Kia mōhio: ${n} pūrongo tuārite e tuwhera ana i konei tata — ka honoa e ngā kaimahi mēnā ko te rīki kotahi.`,
  },

  mapPage: {
    title: 'Mapi rīki',
    all: 'Katoa',
    dropOff: 'Ka ngaro ngā rīki kua whakatikahia i te mapi i muri i te 7 rā.',
  },

  statusPage: {
    iveSeenToo: 'Kua kitea e au anō tēnei rīki',
    confirmError: 'Kāore i taea te hopu — ngānobarua',
    thanks: 'Ngā mihi — kua hopukina.',
    openTracking: 'Kua kitea e koe anō tēnei rīki? Whakatuwhera te whārangi aroturuki',
    notFound: 'Kāore i kitea te pūrongo',
    notFoundBody: 'Kāore tēnei pūrongo i te tīariari, kua tangohia rānei.',
    viewMap: '← Tirohia te mapi',
    statusHeading: 'Tūnga',
  },

  staff: {
    signIn: 'Takiuru kaimahi',
    emailPlaceholder: 'ingoa@kaunihera.govt.nz',
    password: 'Kupu huna',
    signInButton: 'Takiuru',
    loginFailed: 'i rahua te takiuru',
    dashboard: 'Papatohu mahi',
    refreshNote: 'ka whakahōu ia 30 hēkona',
    signOut: 'Takiputa',
    filterOpen: 'Tuwhera',
    filterDueSoon: 'Me oti wawe',
    filterBreached: 'Kua hipa te wā',
    filterAll: 'Katoa',
    refreshFailed: 'I rahua te whakahōu — ka ngana anō i roto i te 30 hēkona',
    confirmations: (n: number) => `+${n} whakaū`,
    possibleDuplicate: 'Tāreia pea he tuārite',
    verified: 'kua whakaūngia',
    publicPage: 'whārangi tūmatanui →',
    reporter: 'Kaipūrongo:',
    hide: 'hunaia',
    unverify: 'Whakakore whakaū',
    verify: 'Whakaū',
    notePlaceholder: 'Kōrero tūmatanui (hei tauira: kua waihanga te kaimahi mō te Rāpare)',
    post: 'Tuku',
    dupPlaceholder: 'He tuārite mō te pūrongo id (hei tauira: 1042)',
    markDuplicate: 'Tautohu tuārite',
    noReports: 'Kāore he pūrongo.',
  },
} as const;

export const messages: Record<Lang, Messages> = { en, mi };
