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
} as const;

type Widen<T> = T extends string
  ? string
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
} as const;

export const messages: Record<Lang, Messages> = { en, mi };
