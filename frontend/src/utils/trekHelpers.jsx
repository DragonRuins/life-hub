/**
 * Star Trek Database - Frontend Helpers
 *
 * Mirrors the backend entity_registry.py for frontend display.
 * Provides route helpers, label lookups, and a cross-link component.
 */
import { Link } from 'react-router-dom'

// ── Entity Categories ─────────────────────────────────────────────────
// Frontend mirror of backend CATEGORIES for browse UI grouping.

export const ENTITY_CATEGORIES = {
  personnel: {
    label: 'Personnel',
    lcarsLabel: 'PERSONNEL DATABASE',
    types: ['character', 'performer'],
    icon: 'Users',
    color: 'var(--color-blue)',
    lcarsColor: 'var(--lcars-ice)',
  },
  starships: {
    label: 'Starships',
    lcarsLabel: 'VESSEL REGISTRY',
    types: ['spacecraft', 'spacecraftClass'],
    icon: 'Rocket',
    color: 'var(--color-teal)',
    lcarsColor: 'var(--lcars-sunflower)',
  },
  species: {
    label: 'Species & Cultures',
    lcarsLabel: 'XENOBIOLOGY',
    types: ['species'],
    icon: 'Dna',
    color: 'var(--color-green)',
    lcarsColor: 'var(--lcars-green)',
  },
  worlds: {
    label: 'Worlds & Places',
    lcarsLabel: 'STELLAR CARTOGRAPHY',
    types: ['astronomicalObject', 'location'],
    icon: 'Globe',
    color: 'var(--color-mauve)',
    lcarsColor: 'var(--lcars-african-violet)',
  },
  science: {
    label: 'Science & Tech',
    lcarsLabel: 'TECHNICAL DATABASE',
    types: ['technology', 'weapon', 'material'],
    icon: 'Cpu',
    color: 'var(--color-yellow)',
    lcarsColor: 'var(--lcars-tanoi)',
  },
  media: {
    label: 'Series & Episodes',
    lcarsLabel: 'MEDIA DATABASE',
    types: ['series', 'season', 'episode', 'movie'],
    icon: 'Tv',
    color: 'var(--color-peach)',
    lcarsColor: 'var(--lcars-butterscotch)',
  },
  production: {
    label: 'Production',
    lcarsLabel: 'PRODUCTION FILES',
    types: ['performer', 'staff', 'company', 'book', 'comicSeries', 'videoGame', 'soundtrack'],
    icon: 'Film',
    color: 'var(--color-flamingo)',
    lcarsColor: 'var(--lcars-lilac)',
  },
  organizations: {
    label: 'Organizations',
    lcarsLabel: 'ORGANIZATIONS',
    types: ['organization'],
    icon: 'Building2',
    color: 'var(--color-red)',
    lcarsColor: 'var(--lcars-rust)',
  },
  culture: {
    label: 'Culture',
    lcarsLabel: 'CULTURAL DATABASE',
    types: ['food', 'animal', 'occupation', 'title'],
    icon: 'Utensils',
    color: 'var(--color-sky)',
    lcarsColor: 'var(--lcars-gold)',
  },
}

// ── Entity Type Labels ────────────────────────────────────────────────

const ENTITY_LABELS = {
  character: { display: 'Characters', lcars: 'PERSONNEL FILES' },
  performer: { display: 'Performers', lcars: 'PERFORMER DATABASE' },
  staff: { display: 'Staff', lcars: 'PRODUCTION STAFF' },
  spacecraft: { display: 'Spacecraft', lcars: 'VESSEL REGISTRY' },
  spacecraftClass: { display: 'Spacecraft Classes', lcars: 'VESSEL CLASS DATABASE' },
  species: { display: 'Species', lcars: 'XENOBIOLOGY DATABASE' },
  astronomicalObject: { display: 'Astronomical Objects', lcars: 'STELLAR CARTOGRAPHY' },
  location: { display: 'Locations', lcars: 'LOCATION DATABASE' },
  technology: { display: 'Technology', lcars: 'TECHNICAL DATABASE' },
  weapon: { display: 'Weapons', lcars: 'TACTICAL DATABASE' },
  material: { display: 'Materials', lcars: 'MATERIALS DATABASE' },
  series: { display: 'Series', lcars: 'SERIES DATABASE' },
  season: { display: 'Seasons', lcars: 'SEASON DATABASE' },
  episode: { display: 'Episodes', lcars: 'EPISODE DATABASE' },
  movie: { display: 'Movies', lcars: 'FILM DATABASE' },
  organization: { display: 'Organizations', lcars: 'ORGANIZATIONS DATABASE' },
  food: { display: 'Food & Beverages', lcars: 'REPLICATOR DATABASE' },
  animal: { display: 'Animals', lcars: 'FAUNA DATABASE' },
  occupation: { display: 'Occupations', lcars: 'OCCUPATIONS' },
  title: { display: 'Titles', lcars: 'TITLES & RANKS' },
  company: { display: 'Companies', lcars: 'COMPANIES' },
  book: { display: 'Books', lcars: 'PUBLICATIONS' },
  comicSeries: { display: 'Comic Series', lcars: 'COMIC SERIES' },
  videoGame: { display: 'Video Games', lcars: 'VIDEO GAMES' },
  soundtrack: { display: 'Soundtracks', lcars: 'AUDIO DATABASE' },
}

// ── Helper Functions ──────────────────────────────────────────────────

/**
 * Get the route path for a trek entity.
 * @param {string} entityType - STAPI entity type
 * @param {string} uid - STAPI UID
 * @returns {string} Route path like '/trek/character/CHMA0000215045'
 */
export function getTrekRoute(entityType, uid) {
  return `/trek/${entityType}/${uid}`
}

/**
 * Get the human-readable display name for an entity type.
 * @param {string} entityType - STAPI entity type
 * @returns {string} Display name like 'Characters'
 */
export function getTrekCategoryLabel(entityType) {
  return ENTITY_LABELS[entityType]?.display || entityType
}

/**
 * Get the LCARS-style label for an entity type.
 * @param {string} entityType - STAPI entity type
 * @returns {string} LCARS label like 'PERSONNEL FILES'
 */
export function getTrekLCARSLabel(entityType) {
  return ENTITY_LABELS[entityType]?.lcars || entityType.toUpperCase()
}

/**
 * Find which category an entity type belongs to.
 * @param {string} entityType - STAPI entity type
 * @returns {string|null} Category key like 'personnel'
 */
export function getCategoryForType(entityType) {
  for (const [catKey, cat] of Object.entries(ENTITY_CATEGORIES)) {
    if (cat.types.includes(entityType)) return catKey
  }
  return null
}

/**
 * Format a stardate value for display.
 * @param {number|string} value - Stardate value
 * @returns {string} Formatted stardate
 */
export function formatStardate(value) {
  if (value == null || value === '') return '---'
  return String(value)
}

// ── Field Processing ──────────────────────────────────────────────────
// Processes raw STAPI entity data into clean, logically ordered display rows.
// Combines scattered date fields, merges ranges, handles nested objects,
// and applies human-readable labels for boolean trait flags.

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Fields handled by special logic or rendered elsewhere (related entity arrays).
// Anything in this set is never passed to the generic fallback renderer.
const HANDLED_FIELDS = new Set([
  'uid', 'name', 'title', 'wikiUrl',
  // Related entity arrays — rendered in the Related Entities section
  'characters', 'episodes', 'performers', 'seasons', 'movies',
  'spacecrafts', 'spacecraftClasses', 'staff', 'writers', 'directors',
  'stuntPerformers', 'standInPerformers', 'astronomicalObjects',
  'locations', 'occupations', 'titles', 'organizations', 'foods',
  'animals', 'weapons', 'technology', 'materials', 'books',
  'companies', 'soundtracks', 'comicSeries', 'videoGames',
  'characterRelations', 'characterSpecies',
  // Character date fields — merged into combined rows
  'yearOfBirth', 'monthOfBirth', 'dayOfBirth', 'placeOfBirth',
  'yearOfDeath', 'monthOfDeath', 'dayOfDeath', 'placeOfDeath',
  'stardateOfBirth', 'stardateOfDeath',
  // Performer date fields — single string, handled explicitly
  'dateOfBirth', 'dateOfDeath', 'birthName',
  // Series range fields — merged
  'productionStartYear', 'productionEndYear',
  'originalRunStartDate', 'originalRunEndDate',
  // SpacecraftClass range fields — merged
  'activeFrom', 'activeTo',
  // Episode/Movie range fields — merged
  'stardateFrom', 'stardateTo', 'yearFrom', 'yearTo',
  // Nested objects — extracted by name
  'homeworld', 'quadrant', 'location', 'spacecraftClass', 'owner',
  'operator', 'series', 'season', 'mainDirector',
  'productionCompany', 'originalBroadcaster', 'species',
  // Episode localized titles — combined
  'titleGerman', 'titleItalian', 'titleJapanese', 'titleBulgarian',
  'titleCatalan', 'titleChineseTraditional', 'titlePolish',
  'titleRussian', 'titleSerbian', 'titleSpanish',
  // Handled individually below
  'gender', 'registry', 'status', 'dateStatus', 'affiliation',
  'height', 'weight', 'bloodType', 'maritalStatus', 'serialNumber',
  'seasonNumber', 'episodeNumber', 'usAirDate', 'usReleaseDate',
  'productionSerialNumber', 'finalScriptDate', 'featureLength',
  'abbreviation', 'seasonsCount', 'episodesCount',
  'featureLengthEpisodesCount', 'numberOfEpisodes', 'numberOfDecks',
  'numberOfSeasons', 'crew',
  'astronomicalObjectType',
  'hologramActivationDate', 'hologramStatus', 'hologramDateStatus',
])

function buildDateString(year, month, day) {
  const parts = []
  if (day) parts.push(String(day))
  if (month) parts.push(MONTH_NAMES[month] || String(month))
  if (year) parts.push(String(year))
  return parts.join(' ') || null
}

function addIfPresent(fields, entity, key, label, order) {
  const val = entity[key]
  if (val == null || val === '') return
  if (typeof val === 'object') {
    // Nested objects: extract name or title
    const display = val.name || val.title
    if (display) fields.push({ label, value: display, order })
  } else {
    fields.push({ label, value: String(val), order })
  }
}

// Human-readable labels for boolean trait flags across entity types.
// Only true values are shown. Grouped by entity type for clarity.
const BOOLEAN_LABELS = {
  // Character
  deceased: 'Deceased',
  hologram: 'Hologram',
  fictionalCharacter: 'Fictional Character',
  mirror: 'Mirror Universe',
  alternateReality: 'Alternate Reality',
  // Performer — series appearances
  tngPerformer: 'TNG',
  ds9Performer: 'DS9',
  voyPerformer: 'VOY',
  entPerformer: 'ENT',
  tosPerformer: 'TOS',
  tasPerformer: 'TAS',
  disPerformer: 'DIS',
  filmPerformer: 'Films',
  videoGamePerformer: 'Video Games',
  voicePerformer: 'Voice Actor',
  animalPerformer: 'Animal Performer',
  stuntPerformer: 'Stunt Performer',
  standInPerformer: 'Stand-In',
  // Species
  extinctSpecies: 'Extinct',
  warpCapableSpecies: 'Warp Capable',
  humanoidSpecies: 'Humanoid',
  reptilianSpecies: 'Reptilian',
  nonCorporealSpecies: 'Non-Corporeal',
  shapeshiftingSpecies: 'Shapeshifting',
  spaceborneSpecies: 'Spaceborne',
  telepathicSpecies: 'Telepathic',
  transDimensionalSpecies: 'Trans-Dimensional',
  extraGalacticSpecies: 'Extra-Galactic',
  unnamedSpecies: 'Unnamed',
  // SpacecraftClass
  warpCapable: 'Warp Capable',
  // Technology
  borgTechnology: 'Borg Technology',
  borgComponent: 'Borg Component',
  communicationsTechnology: 'Communications',
  computerTechnology: 'Computer Technology',
  computerProgramming: 'Computer Programming',
  subroutine: 'Subroutine',
  database: 'Database',
  energyTechnology: 'Energy Technology',
  fictionalTechnology: 'Fictional Technology',
  holographicTechnology: 'Holographic',
  identificationTechnology: 'Identification',
  lifeSupportTechnology: 'Life Support',
  sensorTechnology: 'Sensor Technology',
  shieldTechnology: 'Shield Technology',
  tool: 'Tool',
  culinaryTool: 'Culinary Tool',
  engineeringTool: 'Engineering Tool',
  householdTool: 'Household Tool',
  medicalEquipment: 'Medical Equipment',
  transporterTechnology: 'Transporter Technology',
  // Weapon
  handHeldWeapon: 'Hand-Held',
  laserTechnology: 'Laser',
  plasmaTechnology: 'Plasma',
  photonicTechnology: 'Photonic',
  phaserTechnology: 'Phaser',
  // Location
  earthlyLocation: 'Earth',
  fictionalLocation: 'Fictional',
  religiousLocation: 'Religious',
  geographicalLocation: 'Geographical',
  bodyOfWater: 'Body of Water',
  country: 'Country',
  subnationalEntity: 'Region',
  settlement: 'Settlement',
  usSettlement: 'US Settlement',
  bajoranSettlement: 'Bajoran Settlement',
  colony: 'Colony',
  landform: 'Landform',
  landmark: 'Landmark',
  road: 'Road',
  structure: 'Structure',
  shipyard: 'Shipyard',
  buildingInterior: 'Building Interior',
  establishment: 'Establishment',
  medicalEstablishment: 'Medical Establishment',
  ds9Establishment: 'DS9 Establishment',
  school: 'School',
  // Organization
  government: 'Government',
  intergovernmentalOrganization: 'Intergovernmental',
  researchOrganization: 'Research',
  sportOrganization: 'Sports',
  medicalOrganization: 'Medical',
  militaryOrganization: 'Military',
  militaryUnit: 'Military Unit',
  governmentAgency: 'Government Agency',
  lawEnforcementAgency: 'Law Enforcement',
  prisonOrPenalColony: 'Prison / Penal Colony',
  // Food
  earthlyOrigin: 'Earth Origin',
  dessert: 'Dessert',
  fruit: 'Fruit',
  herbOrSpice: 'Herb / Spice',
  sauce: 'Sauce',
  soup: 'Soup',
  beverage: 'Beverage',
  alcoholicBeverage: 'Alcoholic',
  juice: 'Juice',
  tea: 'Tea',
  // Animal
  earthAnimal: 'Earth Animal',
  earthInsect: 'Earth Insect',
  avian: 'Avian',
  canine: 'Canine',
  feline: 'Feline',
  // Material
  chemicalCompound: 'Chemical Compound',
  biochemicalCompound: 'Biochemical',
  drug: 'Drug',
  poisonousSubstance: 'Poisonous',
  explosive: 'Explosive',
  gemstone: 'Gemstone',
  alloyOrComposite: 'Alloy / Composite',
  fuel: 'Fuel',
  mineral: 'Mineral',
  preciousMaterial: 'Precious Material',
  // Occupation
  legalOccupation: 'Legal',
  medicalOccupation: 'Medical',
  scientificOccupation: 'Scientific',
  // Title
  militaryRank: 'Military Rank',
  fleetRank: 'Fleet Rank',
  religiousTitle: 'Religious Title',
  position: 'Position',
}

/**
 * Process raw STAPI entity fields into an ordered array of { label, value } pairs.
 * Combines date fields, merges ranges, extracts nested objects, and sorts logically.
 *
 * @param {object} entity - The raw STAPI entity object
 * @returns {Array<{label: string, value: string}>}
 */
export function processEntityFields(entity) {
  const fields = []

  // ── Identity & classification ──
  addIfPresent(fields, entity, 'gender', 'Gender', 1)
  addIfPresent(fields, entity, 'abbreviation', 'Abbreviation', 2)
  addIfPresent(fields, entity, 'registry', 'Registry', 3)
  addIfPresent(fields, entity, 'status', 'Status', 4)
  addIfPresent(fields, entity, 'dateStatus', 'Status Date', 5)
  addIfPresent(fields, entity, 'astronomicalObjectType', 'Type', 2)

  // Nested objects — extract by name
  addIfPresent(fields, entity, 'species', 'Species', 6)
  addIfPresent(fields, entity, 'homeworld', 'Homeworld', 7)
  addIfPresent(fields, entity, 'quadrant', 'Quadrant', 8)
  addIfPresent(fields, entity, 'location', 'Location', 8)
  addIfPresent(fields, entity, 'spacecraftClass', 'Class', 6)
  addIfPresent(fields, entity, 'owner', 'Owner', 9)
  addIfPresent(fields, entity, 'operator', 'Operator', 10)
  addIfPresent(fields, entity, 'mainDirector', 'Director', 5)
  addIfPresent(fields, entity, 'productionCompany', 'Production Company', 30)
  addIfPresent(fields, entity, 'originalBroadcaster', 'Broadcaster', 31)

  // Episode/Season context
  addIfPresent(fields, entity, 'series', 'Series', 3)
  addIfPresent(fields, entity, 'season', 'Season', 4)
  addIfPresent(fields, entity, 'seasonNumber', 'Season', 11)
  addIfPresent(fields, entity, 'episodeNumber', 'Episode', 12)
  addIfPresent(fields, entity, 'productionSerialNumber', 'Production #', 13)

  // ── Character birth/death — combined from individual fields ──
  const born = buildDateString(entity.yearOfBirth, entity.monthOfBirth, entity.dayOfBirth)
  if (born) fields.push({ label: 'Born', value: born, order: 15 })
  if (entity.placeOfBirth) fields.push({ label: 'Birthplace', value: entity.placeOfBirth, order: 16 })
  if (entity.stardateOfBirth) fields.push({ label: 'Stardate of Birth', value: String(entity.stardateOfBirth), order: 17 })

  const died = buildDateString(entity.yearOfDeath, entity.monthOfDeath, entity.dayOfDeath)
  if (died) fields.push({ label: 'Died', value: died, order: 18 })
  if (entity.placeOfDeath) fields.push({ label: 'Place of Death', value: entity.placeOfDeath, order: 19 })
  if (entity.stardateOfDeath) fields.push({ label: 'Stardate of Death', value: String(entity.stardateOfDeath), order: 20 })

  // ── Performer birth/death — single date strings ──
  if (entity.dateOfBirth) fields.push({ label: 'Born', value: entity.dateOfBirth, order: 15 })
  if (entity.birthName) fields.push({ label: 'Birth Name', value: entity.birthName, order: 14 })
  if (entity.dateOfDeath) fields.push({ label: 'Died', value: entity.dateOfDeath, order: 18 })
  // Reuse placeOfBirth/placeOfDeath (already handled above for characters,
  // also used by performers — no conflict since a record is one or the other)

  // ── Dates & airdates ──
  addIfPresent(fields, entity, 'usAirDate', 'Air Date', 13)
  addIfPresent(fields, entity, 'usReleaseDate', 'US Release Date', 13)
  addIfPresent(fields, entity, 'finalScriptDate', 'Final Script Date', 14)

  // ── Stardates — combined range ──
  if (entity.stardateFrom != null || entity.stardateTo != null) {
    const from = entity.stardateFrom != null ? String(entity.stardateFrom) : '?'
    const to = entity.stardateTo != null ? String(entity.stardateTo) : '?'
    const value = from === to ? from : `${from} – ${to}`
    fields.push({ label: 'Stardate', value, order: 21 })
  }

  // ── Year range (episodes/movies) ──
  if (entity.yearFrom != null || entity.yearTo != null) {
    const from = entity.yearFrom != null ? String(entity.yearFrom) : '?'
    const to = entity.yearTo != null ? String(entity.yearTo) : '?'
    const value = from === to ? from : `${from} – ${to}`
    fields.push({ label: 'Year', value, order: 22 })
  }

  // ── Series production range ──
  if (entity.productionStartYear || entity.productionEndYear) {
    const start = entity.productionStartYear || '?'
    const end = entity.productionEndYear || 'Present'
    fields.push({ label: 'Production', value: `${start} – ${end}`, order: 23 })
  }
  if (entity.originalRunStartDate || entity.originalRunEndDate) {
    const start = entity.originalRunStartDate || '?'
    const end = entity.originalRunEndDate || 'Present'
    fields.push({ label: 'Original Run', value: `${start} – ${end}`, order: 24 })
  }

  // ── SpacecraftClass active range ──
  if (entity.activeFrom || entity.activeTo) {
    const from = entity.activeFrom || '?'
    const to = entity.activeTo || 'Present'
    fields.push({ label: 'Active', value: `${from} – ${to}`, order: 25 })
  }

  // ── Physical / personal details ──
  addIfPresent(fields, entity, 'maritalStatus', 'Marital Status', 26)
  addIfPresent(fields, entity, 'serialNumber', 'Serial Number', 27)
  addIfPresent(fields, entity, 'height', 'Height', 28)
  addIfPresent(fields, entity, 'weight', 'Weight', 29)
  addIfPresent(fields, entity, 'bloodType', 'Blood Type', 30)
  addIfPresent(fields, entity, 'affiliation', 'Affiliation', 26)

  // ── Hologram-specific ──
  addIfPresent(fields, entity, 'hologramActivationDate', 'Activation Date', 27)
  addIfPresent(fields, entity, 'hologramStatus', 'Hologram Status', 28)
  addIfPresent(fields, entity, 'hologramDateStatus', 'Hologram Status Date', 29)

  // ── Counts ──
  addIfPresent(fields, entity, 'seasonsCount', 'Seasons', 32)
  addIfPresent(fields, entity, 'episodesCount', 'Episodes', 33)
  addIfPresent(fields, entity, 'featureLengthEpisodesCount', 'Feature-Length Episodes', 34)
  addIfPresent(fields, entity, 'numberOfEpisodes', 'Episodes', 32)
  addIfPresent(fields, entity, 'numberOfSeasons', 'Seasons', 32)
  addIfPresent(fields, entity, 'numberOfDecks', 'Decks', 35)
  addIfPresent(fields, entity, 'crew', 'Crew', 36)

  if (entity.featureLength === true) fields.push({ label: 'Feature Length', value: 'Yes', order: 34 })

  // ── Localized titles (combine into one row if any exist) ──
  const titleLangs = []
  if (entity.titleGerman) titleLangs.push(`DE: ${entity.titleGerman}`)
  if (entity.titleJapanese) titleLangs.push(`JP: ${entity.titleJapanese}`)
  if (entity.titleItalian) titleLangs.push(`IT: ${entity.titleItalian}`)
  if (entity.titleSpanish) titleLangs.push(`ES: ${entity.titleSpanish}`)
  if (entity.titleRussian) titleLangs.push(`RU: ${entity.titleRussian}`)
  if (entity.titlePolish) titleLangs.push(`PL: ${entity.titlePolish}`)
  if (entity.titleBulgarian) titleLangs.push(`BG: ${entity.titleBulgarian}`)
  if (entity.titleCatalan) titleLangs.push(`CA: ${entity.titleCatalan}`)
  if (entity.titleChineseTraditional) titleLangs.push(`ZH: ${entity.titleChineseTraditional}`)
  if (entity.titleSerbian) titleLangs.push(`SR: ${entity.titleSerbian}`)
  if (titleLangs.length > 0) {
    fields.push({ label: 'Alternate Titles', value: titleLangs.join(' | '), order: 40 })
  }

  // ── Catch-all for any remaining scalar fields we haven't handled ──
  for (const [key, value] of Object.entries(entity)) {
    if (HANDLED_FIELDS.has(key)) continue
    if (typeof value === 'boolean') continue  // booleans handled separately below
    if (value == null || value === '') continue
    if (typeof value === 'object') continue   // arrays/objects handled elsewhere
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
    if (fields.some(f => f.label === label)) continue
    fields.push({ label, value: String(value), order: 45 })
  }

  // Sort by order, then label
  fields.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))

  // ── Boolean indicators — separate from fields for distinct rendering ──
  // Each gets { label, active } so the UI can show lit/unlit indicator lights.
  const indicators = []

  for (const [key, value] of Object.entries(entity)) {
    if (typeof value !== 'boolean') continue
    if (HANDLED_FIELDS.has(key)) continue
    const label = BOOLEAN_LABELS[key]
    if (!label) continue
    indicators.push({ label, active: value, key })
  }

  return { fields, indicators }
}


/**
 * Small React component that renders a clickable cross-link to a trek entity.
 * Used in detail views to link related entities.
 */
export function TrekEntityLink({ entityType, uid, name, style = {} }) {
  if (!uid || !name) return null

  return (
    <Link
      to={getTrekRoute(entityType, uid)}
      style={{
        color: 'var(--color-blue)',
        textDecoration: 'none',
        fontSize: '0.85rem',
        ...style,
      }}
    >
      {name}
    </Link>
  )
}

/**
 * LCARS-styled entity cross-link.
 */
export function LCARSTrekEntityLink({ entityType, uid, name, color = 'var(--lcars-ice)', style = {} }) {
  if (!uid || !name) return null

  return (
    <Link
      to={getTrekRoute(entityType, uid)}
      style={{
        color,
        textDecoration: 'none',
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.82rem',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        ...style,
      }}
    >
      {name}
    </Link>
  )
}
