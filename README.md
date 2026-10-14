# Šlomo Surayt (ܫܠܳܡܐ ܣܽܘܪܰܝܬ) 🕊️

> **De moderne, offline-first taalapplicatie voor het leren van Surayt (Turoyo / Neo-Aramees / Suryoyo uit Tur Abdin).**

---

## 📖 Inhoudsopgave

1. [Over het Project](#-over-het-project)
2. [Kernfuncties](#-kernfuncties)
3. [Projectstructuur](#-projectstructuur)
4. [Snelstart: Lokaal Draaien (Localhost)](#-snelstart-lokaal-draaien-localhost)
   - [Vereisten](#vereisten)
   - [Stap 1: Repository & dependencies](#stap-1-dependencies-installeren)
   - [Stap 2: Expo Dev Server starten](#stap-2-de-app-lokaal-starten)
   - [Stap 3: Bekijken op toestel of simulator](#stap-3-de-app-bekijken)
5. [Scraper & Data Pipeline (Python)](#-scraper--data-pipeline-python)
6. [Tech Stack & Architectuur](#-tech-stack--architectuur)
7. [Database & Datamodel](#-database--datamodel)
8. [Veelgestelde Vragen & Troubleshooting](#-veelgestelde-vragen--troubleshooting)

---

## 🏛️ Over het Project

**Šlomo Surayt** is ontworpen om de historische en bedreigde Surayt-taal (Syrisch / Neo-Aramees) interactief toegankelijk te maken voor een nieuwe generatie sprekers en geïnteresseerden. De app combineert modern taalonderwijs (geïnspireerd op methodes zoals Duolingo en Spaced Repetition) met een diepe waardering voor het Suryoye-erfgoed.

### Erfgoed & Design Filosofie
- **Kleurpalet:** Geïnspireerd op de kalksteen-architectuur van **Midyat**, perkamentkleuren uit eeuwenoude kloosters zoals **Mor Gabriel**, aangevuld met manuscript-crimson (`#8C1D24`) en saffraangoud (`#D4AF37`).
- **Suryoye UI:** Traditionele Qantre-bogen (*ܩܰܢܛܪܶܐ*), gevlochten Syrische randen en historische dorpsmotieven.

---

## ✨ Kernfuncties

- 🔤 **Dual-Script Engine:**
  - Schakel met één tik tussen **Latijnse fonetische transliteratie** (met diakrieten zoals *š, ḥ, ṭ, ṣ, ḏ, ṯ*), **West-Syrisch Serto-schrift** (*ܟܬ݂ܳܒ݂ܐ ܣܶܪܛܳܝܐ*), of beide gelijktijdig.
  - Dynamische toggle voor **Zow'e klinkers** (gevocaliseerd vs. ongevocaliseerd, met behoud van meervoudspunten/Seyome).
  - Automatische RTL-ondersteuning en veilige line-height schaling voor Syrische klinkerpunten op Android en iOS.
- 📱 **100% Offline-First met SQLite & Drizzle ORM:**
  - Geen internetverbinding vereist tijdens het leren.
  - Voorgevulde lokale SQLite database (`surayt.db`) met meer dan **1.345 woorden**, **96 voorbeeldzinnen** en **20 gestructureerde lessen**.
  - Slimme **UPSERT-synchronisatie**: nieuwe lessen of woorden kunnen worden bijgewerkt zonder dat de persoonlijke leervoortgang of SRS-intervallen verloren gaan.
- 🧠 **Spaced Repetition System (SRS):**
  - Geoptimaliseerd herhalingsalgoritme (SM-2 / FSRS principes) voor maximale langetermijnretentie van woordenschat.
- 🔍 **Diakriet-vrij Zoeken:**
  - Vind woorden direct zonder speciale toetsenborden (bijv. typ `slomo` voor `šlomo` / `ܫܠܳܡܐ`, of `kthowo` voor `kṯowo` / `ܟܬ݂ܳܘܐ`).
- 📊 **Voortgang & Gamification:**
  - Dagelijkse XP-doelen, streaks, leerniveaus (van *Malfono* titels tot ervaringsgraden) en interactieve SVG-radardiagrammen voor vaardigheidsmetingen.

---

## 📂 Projectstructuur

```text
suryat-learning/
├── mobile/                        # 📱 React Native / Expo Mobile App
│   ├── assets/
│   │   ├── database/surayt.db     # Lokale offline SQLite database
│   │   └── fonts/                 # Noto Sans & Noto Sans Syriac Western TTF
│   ├── src/
│   │   ├── app/                   # Expo Router v4 pagina's & layouts
│   │   │   ├── (tabs)/            # Tabbar: Midyat (Home), Learn, Review, Dict, Stats
│   │   │   │   ├── index.tsx      # Dashboard (Midyat hub, streak, woord vd dag)
│   │   │   │   ├── learn.tsx      # CEFR A1/A2/B1 leerpad
│   │   │   │   ├── review.tsx     # Spaced Repetition Flashcard deck
│   │   │   │   ├── dictionary.tsx # Offline woordenboek
│   │   │   │   └── stats.tsx      # Analytics & Mastery Radar Chart
│   │   │   ├── lesson/[id].tsx    # Dynamische lesroute
│   │   │   └── _layout.tsx        # Root layout, database loader & font initializer
│   │   ├── components/            # Herbruikbare componenten (DualScriptText, QantreCard)
│   │   ├── db/                    # Drizzle schema, client & query helpers
│   │   ├── engine/                # Audio controller, SRS planner & XP tracker
│   │   ├── store/                 # Zustand state met MMKV persist adapter
│   │   └── theme/                 # Kleurenpalet (SuryoyePalette) & Typografie
│   ├── app.json                   # Expo configuratie
│   ├── metro.config.js            # Metro bundler config (.db, .mp3, .ttf assets)
│   ├── package.json               # NPM scripts & dependencies
│   └── tailwind.config.js         # NativeWind configuratie
│
├── scraper/                       # 🐍 Python Data Pipeline & Scraper
│   ├── processors/
│   │   ├── unicode_normalizer.py  # NFC & Serto Zow'e klinker-normalisatie
│   │   └── db_builder.py          # Bouwt surayt.db vanuit surayt_seed.json
│   ├── scrapers/                  # Web scrapers voor lessen, audio & woordenboek
│   ├── surayt_seed.json           # Ruwe brondata van surayt.com
│   ├── validate_pipeline.py       # Uitgebreide integriteitstesten
│   └── requirements.txt           # Python dependencies
└── README.md
```

---

## 🚀 Snelstart: Lokaal Draaien (Localhost)

Volg onderstaande stappen om de mobiele app direct op je eigen computer of telefoon te starten.

### Vereisten
- **Node.js**: versie 18 of hoger (Node 20+ aanbevolen)
- **NPM** of **PNPM**
- *(Optioneel)* **Expo Go app** op je smartphone ([iOS App Store](https://apps.apple.com/app/expo-go/id982107779) of [Android Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)) of een werkende Android Emulator / iOS Simulator.

---

### Stap 1: Dependencies installeren

Open een terminal (PowerShell of Bash) in de projectmap en navigeer naar de `mobile` folder:

```bash
cd mobile
npm install
```

---

### Stap 2: De app lokaal starten

Start de lokale Expo / Metro ontwikkelserver:

```bash
npm start
```
*(of via `npx expo start`)*

Zodra de bundler gestart is, zie je in je terminal:
- Een interactieve **QR-code**.
- De lokale server draait standaard op: **`http://localhost:8081`**.
- Sneltoetsen om de app te openen op verschillende platforms.

---

### Stap 3: De app bekijken

Je kunt de app op verschillende manieren lokaal testen:

#### A. Op je eigen telefoon via Expo Go (Aanbevolen & Snelst)
1. Installeer de gratis **Expo Go** app op je iPhone of Android-toestel.
2. Zorg dat je telefoon verbonden is met **hetzelfde Wi-Fi netwerk** als je computer.
3. **Android:** Open Expo Go en scan de QR-code direct in de app.
4. **iOS:** Open de standaard Camera-app en scan de QR-code; tik op de gele melding om te openen in Expo Go.
> 💡 *Zit je op een beveiligd netwerk of hotspot waarbij de poort geblokkeerd wordt?* Start Expo dan met een tunnel:
> ```bash
> npx expo start --tunnel
> ```

#### B. Op een Android Emulator
1. Start je Android Studio Emulator.
2. Druk in de terminal op de toets **`a`**. Expo installeert en opent de app automatisch op de emulator.

#### C. Op een iOS Simulator (macOS)
1. Start Xcode Simulator.
2. Druk in de terminal op de toets **`i`**.

#### D. Typechecking uitvoeren
Wil je de TypeScript code verifiëren zonder de server te starten?
```bash
npm run typecheck
```

---

## 🐍 Scraper & Data Pipeline (Python)

De `scraper/` map bevat de data-pipeline die lesmateriaal, woordenschat, uitspraak-audio en voorbeeldzinnen verwerkt van *surayt.com* naar de geoptimaliseerde SQLite database.

### Scraper opzetten & testen

1. Navigeer naar de `scraper` map:
   ```bash
   cd scraper
   ```

2. Activeer de virtuele omgeving:
   - **Windows (PowerShell):**
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux:**
     ```bash
     source .venv/bin/activate
     ```

3. Installeer de vereisten (indien nog niet gedaan):
   ```bash
   pip install -r requirements.txt
   ```

4. Voer de validatietests uit:
   ```bash
   python validate_pipeline.py
   ```
   *Hiermee worden de Unicode normalizer, de dekking per les, Serto karakters, diakriet-vrije zoekindex en veilige UPSERT-logica gecontroleerd.*

5. Database opnieuw genereren / seeden naar de mobile app:
   ```bash
   python processors/db_builder.py
   ```
   *Dit genereert `surayt.db` direct in `mobile/assets/database/surayt.db` met het nieuwste versienummer.*

---

## 🛠️ Tech Stack & Architectuur

| Onderdeel | Technologie | Doel |
|---|---|---|
| **Framework** | [React Native](https://reactnative.dev/) met [Expo SDK 52](https://expo.dev/) | Cross-platform mobiele app |
| **Routing** | [Expo Router v4](https://docs.expo.dev/router/introduction/) | File-based typed routing |
| **Styling** | [NativeWind v4](https://www.nativewind.dev/) (Tailwind CSS) | Snelle, consistente responsive UI |
| **Database** | [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) & [Drizzle ORM](https://orm.drizzle.team/) | Snelle offline database queries |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) + MMKV / In-Memory Adapter | Reactive state & instellingen |
| **Iconen & Graphics** | [Lucide React Native](https://lucide.dev/) & [React Native SVG](https://github.com/software-mansion/react-native-svg) | Vector iconen & grafieken |
| **Audio** | [Expo AV](https://docs.expo.dev/versions/latest/sdk/av/) | Lokale en streaming uitspraak audio |
| **Data Engine** | Python 3.12 (Playwright, BeautifulSoup4, Pandas) | Web scraping & normalisatie |

---

## 🗄️ Database & Datamodel

De SQLite database (`surayt.db`) is opgebouwd uit de volgende tabellen:

```text
├── lessons             (id, slug, title_nl, title_surayt_lat, title_surayt_serto, cefr_level, order_index)
├── words               (id, lesson_id, surayt_lat, surayt_lat_search, surayt_serto, surayt_serto_unvocalized,
│                        part_of_speech, gender, plural_lat, plural_serto, translation_nl, cefr_level, category)
├── verb_conjugations   (word_id, tense, person, surayt_lat, surayt_serto)
├── sentences           (id, lesson_id, surayt_lat, surayt_serto, translation_nl, word_tokens_json)
├── srs_cards           (item_id, item_type, ease_factor, interval_days, repetitions, status, next_review_at)
├── study_logs          (id, item_id, item_type, rating, timestamp_iso)
└── app_meta            (key, value - bewaart schema_version en content_version)
```

---

## ❓ Veelgestelde Vragen & Troubleshooting

<details>
<summary><strong>1. Wat moet ik doen als Expo Go geen verbinding maakt met localhost?</strong></summary>

- Zorg dat je computer en telefoon met hetzelfde Wi-Fi netwerk verbonden zijn.
- Controleer of Windows Firewall inkomende verbindingen op poort 8081 toestaat.
- Gebruik als alternatief tunnel-modus: `npx expo start --tunnel`.
</details>

<details>
<summary><strong>2. Hoe werkt de weergave van het Syrische Serto-schrift?</strong></summary>

De app bevat de officiële `NotoSansSyriacWestern` fonts in `mobile/assets/fonts/`. Teksten in het Syrisch worden automatisch gerenderd met `writingDirection: "rtl"` en krijgen extra line-height om te voorkomen dat de Zow'e klinkers boven of onder de letters afgesneden worden.
</details>

<details>
<summary><strong>3. Kan ik nieuwe data toevoegen zonder de voortgang van gebruikers te wissen?</strong></summary>

Ja! De app bevat in `client.ts` een geautomatiseerde migratiefunctie (`syncBundledContentIfNeeded`). Wanneer het versienummer in de nieuwe bundel hoger is, voert SQLite een `INSERT ... ON CONFLICT DO UPDATE` uit op lessen en woorden, terwijl alle rijen in `srs_cards` en `study_logs` onaangetast blijven.
</details>

---

## 📜 Licentie & Bronvermelding

- **Taalmateriaal:** Gebaseerd op het openbare educatieve materiaal van [Surayt-Aramaic Online (surayt.com)](https://surayt.com).
- **Lettertypes:** [Google Noto Sans Syriac Western](https://fonts.google.com/noto/specimen/Noto+Sans+Syriac+Western) (SIL Open Font License).

---

*Tawdi sagi! (Hartelijk dank!)* 🕊️
