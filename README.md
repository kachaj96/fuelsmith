# Fuelsmith v0.3.0

Dziennik jedzenia na Androida: skanujesz kod EAN, aplikacja pobiera skład z Open Food Facts i liczy kalorie i makro dla zjedzonej ilości. Offline po pierwszym skanie produktu, dane w telefonie, bez konta.

## Co jest w 0.3.0 (etapy 1-3)
- **Cele:** profil (płeć, rok urodzenia, wzrost, waga, aktywność, cel, białko na kg), kalorie z wzoru Mifflin-St Jeor razy aktywność (redukcja −20%, masa +10%), tłuszcze co najmniej 0,8 g/kg, węglowodany to reszta. Każdą liczbę można nadpisać.
- **Dziś:** kalorie, które zostały, paski białka, tłuszczów i węglowodanów, cztery posiłki z „+”, poprzednie dni strzałką.
- **Skanowanie:** skaner Google (ML Kit) albo wpisanie kodu. Kod sprawdzany cyfrą kontrolną przed zapytaniem. Produkt z Open Food Facts zostaje w telefonie, przy pierwszym użyciu jest prośba o porównanie z etykietą. Brak w bazie: formularz z etykiety z kodem wpisanym. Niepełne dane: formularz z tym, co jest (kJ przeliczane na kcal). Bez internetu: kod czeka na liście „Do uzupełnienia”.
- **Produkt z etykiety:** wartości na 100 g, porcja i waga opakowania, sprawdzenie kalorii z makro (ostrzeżenie przy różnicy ponad 15%).
- **Dodawanie:** gramy z gotowymi porcjami (porcja z bazy, ostatnio, 100 g, całość), wybór posiłku, cofnięcie. Wpis można zmienić albo usunąć.
- **Przepisy:** składniki w gramach, waga po ugotowaniu, porcje, makro na 100 g gotowego dania.
- **Ulubione i ostatnie:** zakładki przy dodawaniu, wyszukiwanie.
- **Postęp:** waga dzienna, średnia z 7 dni, zmiana tydzień do tygodnia, wykres 30 dni, średnie kalorie z dni z wpisami. Nowa waga aktualizuje cele.
- **Kopia zapasowa:** plik JSON, wczytanie zastępuje dane (kopia innej aplikacji jest odrzucana).

## Uruchomienie
`npm ci`, `npm test`, `npm run e2e`, `npm run dev`. APK buduje CI (`docs/RELEASE.md`).

## Źródło danych
Open Food Facts (openfoodfacts.org), licencja Open Database License (ODbL). Wysyłany jest tylko numer kodu.
