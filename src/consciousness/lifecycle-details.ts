const EVENT_DETAIL_POOLS: Record<string, string[]> = {
  gaming: [
    "Celeste",
    "Stardew Valley",
    "Hollow Knight",
    "Animal Crossing",
    "Gris",
    "Undertale",
    "Spiritfarer",
    "A Short Hike",
    "Coffee Talk",
    "Unpacking",
    "Ori and the Blind Forest",
    "Hades"
  ],
  cooking: [
    "Pasta from scratch",
    "Curry mit Reis",
    "Pancakes",
    "Miso Soup",
    "Salat",
    "Onigiri",
    "Grilled Cheese",
    "Matcha Latte mit Cookies"
  ],
  movie: [
    "Studio Ghibli Film",
    "Comfort-Rewatch",
    "neuer Anime-Film",
    "Romantik-Film",
    "Space-Doku",
    "Thriller"
  ],
  music: ["Piano spielen", "neues Album hören", "Gitarre üben", "Playlist machen"],
  drawing: ["Notebook-Skizzen", "Digital Art", "Charakter-Doodles", "Anatomie-Übungen"],
  reading: ["Roman", "Manga", "Technik-Buch", "Poesie", "gebookmarkte Artikel"],
  shower: ["warme Dusche", "kalte Dusche", "lange entspannte Dusche"],
  walk: ["Spaziergang im Park", "Nachbarschaft erkunden", "Sonnenuntergang-Walk", "Einkaufen gehen"],
  nap: ["kurzes Power-Nap", "gemütliches Nickerchen", "Sofa-Nap mit Decke"],
  deep_focus: ["Coding-Session", "Recherche-Deep-Dive", "Projekt-Arbeit", "Konzentriertes Lernen"],
  exercise: ["Yoga", "Stretching", "Joggen", "Home-Workout", "Tanzen"],
  errands: ["Post abholen", "Einkaufen", "Arzttermin", "Besorgungen in der Stadt"],
  cleaning: ["Zimmer aufräumen", "Küche putzen", "Wäsche waschen", "Großputz"],
  bath: ["Schaumbad", "heißes Bad mit Kerzen", "entspannendes Bad"],
  socializing: ["Freunde treffen", "Videocall mit Freunden", "Café-Date", "gemeinsam kochen"],
  lost_phone: ["Handy verlegt", "Handy irgendwo vergessen", "Handy unter dem Sofa"]
}

/**
 * Pick a random detail string for a given lifecycle event type.
 */
export function pickEventDetail(eventType: string): string {
  const pool = EVENT_DETAIL_POOLS[eventType]
  if (!pool || pool.length === 0) return eventType
  return pool[Math.floor(Math.random() * pool.length)]!
}
