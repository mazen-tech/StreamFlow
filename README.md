# StreamFlow – Platforma streamingowa

> Projekt zaliczeniowy – Programowanie Warstwy Interfejsu 2025/2026  
> Studia II stopnia, I rok

---

## Opis projektu

**StreamFlow** to responsywna strona internetowa platformy streamingowej (VOD), wzorowana na serwisach takich jak Netflix czy PLAY NOW. Projekt prezentuje ofertę usługi: popularne filmy i seriale, kategorie treści, plany cenowe i FAQ. Strona zaprojektowana jest z myślą o przyszłej integracji z backendem (API, baza danych, autentykacja).

---

## Struktura projektu

```
streamflow/
├── index.html              # Główny plik HTML (one-page)
├── README.md               # Ten plik
│
├── css/
│   ├── reset.css           # Normalizacja stylów (CSS reset)
│   ├── variables.css       # Zmienne CSS (design tokens)
│   ├── base.css            # Style globalne, kontenery, przyciski, tagi
│   ├── nav.css             # Nawigacja (desktop + hamburger mobilny)
│   ├── hero.css            # Sekcja hero (baner główny)
│   ├── sections.css        # FAQ i style sekcji
│   ├── cards.css           # Karty filmowe + siatka kategorii
│   ├── pricing.css         # Karty cenowe
│   ├── footer.css          # Stopka
│   └── responsive.css      # Media queries (xs, sm, md, lg, xl)
│
└── js/
    ├── nav.js              # Nawigacja: hamburger, scroll, highlight
    ├── faq.js              # Accordion FAQ
    └── animations.js       # Animacje scroll reveal (IntersectionObserver)
```

---

## Sekcje strony

| Sekcja          | ID           | Opis                                              |
|-----------------|--------------|---------------------------------------------------|
| Nawigacja       | —            | Sticky nav z hamburgerem mobilnym                 |
| Hero            | `#hero`      | Baner główny z CTA                                |
| Statystyki      | —            | Liczby: tytuły, jakość, profile, wsparcie         |
| Trendy          | `#trending`  | Top 5 popularnych tytułów                         |
| Kategorie       | `#categories`| Siatka 3 kolumn (6 kategorii)                     |
| Nowości         | `#new`       | Premiery i nowości                                |
| Urządzenia      | —            | Sekcja promocyjna                                 |
| Cennik          | `#pricing`   | 3 plany: Podstawowy, Standard, Premium            |
| FAQ             | `#faq`       | Accordion z 5 pytaniami                           |
| Stopka          | —            | Linki, social media, informacje prawne            |

---

## Uruchomienie projektu

Strona jest statyczna – nie wymaga serwera ani instalacji paczek.

### Metoda 1 – bezpośrednio
Otwórz plik `index.html` w przeglądarce (Chrome, Firefox, Edge, Safari).

### Metoda 2 – lokalny serwer (zalecane dla testów Lighthouse)
```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code: rozszerzenie "Live Server" → kliknij "Go Live"
```
Następnie otwórz: `http://localhost:8080`

---

## Wymagania techniczne – realizacja

| Wymaganie                        | Status | Szczegóły                                      |
|----------------------------------|--------|------------------------------------------------|
| Semantyczny HTML5                | ✅     | `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<article>` |
| CSS3 + Media Queries             | ✅     | 5 breakpointów: xs, sm, md, lg, xl             |
| Flexbox / CSS Grid               | ✅     | Grid dla kart, pricing, kategorii; Flex dla nav |
| Menu nawigacyjne                 | ✅     | One-page, scroll-highlight                     |
| Min. 3–4 sekcje treści           | ✅     | 7 sekcji treści                                |
| Stopka                           | ✅     | 4 kolumny linków                               |
| Układ 3 kolumn                   | ✅     | Sekcja Kategorie (`categories-grid`)           |
| Hamburger menu mobilne           | ✅     | Animowany, z obsługą klawiatury                |
| Zmienne CSS                      | ✅     | `variables.css` – kolory, fonty, spacing       |
| Optymalizacja obrazów            | ✅     | Brak zewn. obrazów → gradienty CSS (0 żądań)   |
| Atrybuty ALT dla grafik          | ✅     | `aria-label` na wszystkich elementach          |
| Dostępność WCAG AA               | ✅     | Focus, kontrast, role ARIA, skip-link          |
| One-page nawigacja               | ✅     | Anchor links + `scroll-behavior: smooth`       |

---

## Technologie

- **HTML5** – semantyczne znaczniki
- **CSS3** – zmienne, flexbox, grid, animacje, media queries
- **JavaScript (ES6, vanilla)** – brak zewnętrznych bibliotek
- **Google Fonts** – Bebas Neue (display) + Outfit (body)

---

## Przygotowanie pod integrację z backendem

Strona zaprojektowana tak, aby łatwo podłączyć API:

- **Karty filmowe** (`.card`) – generowane przez `fetch('/api/movies')` i pętlę `forEach`
- **Sekcja cen** – dane cenowe z `/api/plans` (JSON)
- **Formularz logowania** – przycisk „Zaloguj się" prowadzi do `#pricing`; docelowo modal z `fetch('/api/auth/login')`
- **FAQ** – treści z `/api/faq`
- Struktura plików HTML/CSS/JS jest rozdzielona – łatwe zastąpienie statycznych danych dynamicznymi

---

## Analiza UX

Plik: `UX_analiza.md` (dołączony osobno lub poniżej)

### Problem użytkownika
Użytkownicy szukają prostej, przejrzystej platformy VOD po polsku, bez zbędnych kroków do znalezienia interesującego tytułu.

### Grupa docelowa
Dorośli 18–45 lat, aktywni użytkownicy internetu, korzystający ze smartfonów i telewizorów.

### Uzasadnienie struktury
- Hero → natychmiastowe CTA (konwersja)
- Trendy → dowód społeczny (social proof)
- Kategorie → discovery (odkrywanie treści)
- Cennik → decyzja zakupowa

### Kolorystyka
- **Czerwień (#E50914)** – energia, akcja, nawiązanie do znanych platform VOD
- **Ciemne tło (#0A0A0F)** – kinowe doświadczenie, redukcja zmęczenia oczu
- **Biały tekst** – wysoki kontrast (WCAG AA ≥ 4.5:1)

---

## Autor

- **Imię i nazwisko:** Mazen Abdelaziz
- **Nr albumu:** 160319
