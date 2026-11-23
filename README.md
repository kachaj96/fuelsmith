# Fuelsmith v0.4.0

Dziennik jedzenia na Androida: skanujesz kod EAN, aplikacja pobiera skład z Open Food Facts i liczy kalorie i makro dla zjedzonej ilości. Offline po pierwszym skanie produktu, dane w telefonie, bez konta.

## Co nowego w 0.4.0
- **Własne posiłki:** układ dnia w Więcej → Posiłki (dodawanie, nazwa, kolejność, usuwanie, gotowe układy, najwyżej 8). W ciągu dnia „Dodaj posiłek” z propozycjami nazw, pusty posiłek można usunąć z jednego dnia (z cofnięciem). Dzień z wpisami zachowuje swój układ, gdy zmienisz plan.
- **Kalendarz** (Postęp → Kalendarz): kcal w każdym dniu, dzień bez wpisów to „?”, nie zero. Średnia liczy tylko uzupełnione dni. Wybrany dzień: makro, błonnik, woda, różnica do celu, „Otwórz dzień”, „Powtórz dziś”.
- **Waga** (Postęp → Waga): wykres średniej z 7 dni z pomiarami, linią celu i prognozą, zakres 30 / 90 dni / całość.
- **Cel wagi:** cel w kg i tempo (0,25 / 0,5 / 1% masy tygodniowo), kalorie liczone z tempa. Prognoza z trendu ostatnich 4 tygodni jako zakres dat, przeliczana po każdym pomiarze, plan obok rzeczywistości.
- **Podpowiedzi o tempie:** za szybko, za wolno, stoi, za mało danych. Z liczbami i propozycją. Nic nie dzieje się samo: „Zastosuj” zmienia tylko cel kalorii i da się cofnąć, „Nie teraz” ukrywa na tydzień.
- **Woda:** +250 / +500 ml na Dziś, +330 ml i własna ilość w Postęp → Woda, cel (propozycja 30 ml na kg), historia 14 dni („brak” zamiast zera).
- **Powtórz z wczoraj:** pusty posiłek proponuje skopiowanie tego samego posiłku z wczoraj. W kalendarzu „Powtórz dziś” kopiuje cały dzień.
- **Szybkie kalorie:** wpis bez produktu (np. obiad na mieście), makro opcjonalne.
- **Rzeczywiste zapotrzebowanie:** po 21 dniach (co najmniej 14 uzupełnionych) z wpisów i zmiany wagi, obok wyniku ze wzoru.
- **Błonnik** jako czwarty pasek (14 g na 1000 kcal) i **bilans tygodnia** na Dziś (tylko uzupełnione dni).

## Co jest od 0.3.0 (etapy 1-3)
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
