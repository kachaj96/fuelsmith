# Wydanie i podpis APK Fuelsmith

## Stan na teraz

**Fuelsmith nie ma jeszcze własnego klucza podpisu.** CI buduje więc `fuelsmith-<wersja>-debug.apk`. Taki APK instaluje się normalnie, ale każdy kolejny build ma inny podpis, więc **aktualizacja wymaga odinstalowania poprzedniego**, a to kasuje dane aplikacji (dziennik, produkty, przepisy, wagę). Dla prawdziwych danych potrzebny jest stały klucz.

## Jednorazowa konfiguracja (robisz ty)

Klucz jest osobny dla każdej aplikacji. **Nie używaj kluczy Runsmith, Repsmith ani Flexsmith.**

1. Wygeneruj klucz (Java 17+): `keytool -genkeypair -v -keystore fuelsmith.jks -alias fuelsmith -keyalg RSA -keysize 2048 -validity 10000`
   Zrób kopię pliku i haseł poza komputerem. Utrata klucza oznacza brak aktualizacji bez odinstalowania. `.gitignore` blokuje `*.jks`.
2. `base64 -w0 fuelsmith.jks` (macOS: `base64 -i fuelsmith.jks`).
3. W repo: Settings, Secrets and variables, Actions. Cztery sekrety: `FUELSMITH_KEYSTORE_BASE64`, `FUELSMITH_KEYSTORE_PASSWORD`, `FUELSMITH_KEY_ALIAS` (`fuelsmith`), `FUELSMITH_KEY_PASSWORD`.

## Wydanie

Podbij `version` w `package.json` (kod wersji w Gradle liczy się z niej), zielone CI, `git tag v<wersja> && git push origin v<wersja>`. Bez sekretów powstaje tylko APK debug jako artefakt przebiegu.

## Czego nie wolno zmieniać

`applicationId` `dev.kachaj96.fuelsmith`. Zmiana oznacza nową aplikację na telefonie.
