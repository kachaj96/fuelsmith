# Fuelsmith: instrukcja dla Claude Code

Czwarta aplikacja rodziny (dziennik jedzenia ze skanerem EAN, makro, przepisy, waga). Niezależna od Runsmith, Repsmith i Flexsmith: własne repo, `applicationId`, baza, klucze i podpis. Nie zmieniaj rodzeństwa.

## Styl pracy
- Rozmowa po polsku, bezpośrednio, bez wstępów, bez długich myślników. Błędy i ryzyka wprost: obserwacja, przyczyna, skutek.
- Prawda przed wygodą: "działa" tylko po uruchomieniu w tej sesji. Co niesprawdzone, trafia do `docs/NOT-VERIFIED.md`.
- Gałąź `main` jest domyślna. Pracuj na gałęzi sesji, nie pushuj na `main`, nie merguj bez zgody.
- Żadnych obietnic medycznych. Cele i przeliczenia to szacunki i aplikacja tak to mówi.
- Nie ma Android SDK w kontenerze. APK buduje CI.

## Stos i komendy
Capacitor 8 + TypeScript + Vite, bez frameworka UI (HTML jako tekst w `src/ui/views.ts`, delegacja zdarzeń w `src/ui/actions.ts`). `npm test` (kontrast + vitest), `npm run e2e` (buduje, Playwright, Open Food Facts zamockowane), `npm run icons`, `npm run cap:sync`. `SHOTS=<katalog> npm run e2e` zapisuje zrzuty.
- Logika bez DOM: `src/domain/nutrition.ts` (porcje, cele Mifflin-St Jeor, przepisy, średnia wagi, EAN), `src/domain/off.ts` (Open Food Facts, fetch wstrzykiwany). Testy z wartościami liczonymi ręcznie.
- Wpisy w dzienniku zapamiętują wartości z dnia zapisu (`per100`). Zmiana produktu nie zmienia historii.
- Pisanie w polu nie przerysowuje strony: zmieniają się tylko elementy `data-live` (`renderPage(true)`), inaczej klawiatura się zamyka.
- Logo i ekran startowy: `scripts/brand.mjs` to jedyne źródło geometrii, `node scripts/gen-icons.mjs` pisze z niego resztę. Nie edytuj wygenerowanych plików ręcznie.
- Skaner: `@capacitor-mlkit/barcode-scanning`, `scan()` (okno skanera Google, wymaga Usług Google Play). Bez skanera zawsze jest "Wpisz kod".
- Open Food Facts: wysyłany jest tylko kod. `CapacitorHttp` w `capacitor.config.ts` przepuszcza fetch przez natywny HTTP, żeby User-Agent faktycznie dochodził. Dane ODbL: źródło podane w O aplikacji.

## Zasady UI (mierzone w e2e skryptem `tests/e2e/audit.js`)
Akcent malinowy tylko na akcji, najwyżej 3 elementy i 1 główny przycisk na ekran. Cele dotyku 48 px, 8 px między małymi. Jedna rodzina (Barlow 400/700), tekst 11/13/16/23/33, odstępy co 4, promienie 8 i 24, dwa cienie. Brak poziomego przewijania przy 360 i 412 px. Etykiety nigdy ucięte. Stan słowem, nie kolorem. Usuwanie z cofnięciem.

## Izolacja
- `applicationId` `dev.kachaj96.fuelsmith`, IndexedDB `fuelsmith`, localStorage tylko `fuelsmith.*`, pole `app: "fuelsmith"` w kopii JSON (kopia innej aplikacji jest odrzucana).
- Osobny klucz podpisu (`FUELSMITH_*`, `docs/RELEASE.md`). Nigdy kluczy rodzeństwa.
