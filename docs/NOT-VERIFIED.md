# Nie sprawdzone na prawdziwym urządzeniu

Testy (vitest, Playwright Chromium 360 i 412 px, jasny i ciemny motyw) przeszły w kontenerze bez telefonu i bez Android SDK. Wiersz znika po sprawdzeniu na telefonie, z datą.

| Obszar | Czego nie sprawdzono | Od |
|---|---|---|
| Skaner | Okno skanera Google na telefonie: pobranie modułu przez Usługi Google Play przy pierwszym użyciu, zgoda na kamerę, odczyt EAN-13/EAN-8 w słabym świetle i na zagiętych opakowaniach. Telefon bez Usług Google Play: tylko wpisywanie kodu. | 0.3 |
| Open Food Facts | Prawdziwe zapytania z telefonu przez CapacitorHttp (nagłówek User-Agent, czas odpowiedzi, brak sieci w trybie samolotowym). W testach odpowiedzi są zamockowane, raz sprawdzone ręcznie z kontenera (kod 5900259128546, 2026-11-23). | 0.3 |
| Budowa APK | `assembleRelease` z kluczem (sekrety `FUELSMITH_*` jeszcze nie istnieją), więc CI zbuduje APK debug. | 0.3 |
| Dane | Że IndexedDB przetrwa zamknięcie aplikacji, restart telefonu i aktualizację APK. | 0.3 |
| Kopia | Okno „Udostępnij” przy zapisie i wybór pliku przy wczytywaniu w WebView Androida. | 0.3 |
| Ekran | Krawędzie ekranu (wycięcie, pasek gestów), klawiatura numeryczna przy polach gramów, przycisk wstecz Androida. | 0.3 |
| Prognoza i podpowiedzi | Zachowanie na prawdziwych, nieregularnych pomiarach przez kilka tygodni. W testach tylko dane modelowe (stałe tempo, codzienne wpisy). | 0.4 |
| Kalendarz i posiłki | Przewijanie miesięcy i edycja nazw posiłków na telefonie z klawiaturą Androida. | 0.4 |
| Ikona | Maski launcherów i ikona monochromatyczna Androida 13+. | 0.3 |
