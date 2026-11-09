// The ONE description of the form. The page draws itself from it and the Worker validates with it,
// so the two can never disagree. English labels live here; translations come later as separate files.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SCHEMA = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const CODES = ('AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW').split(' ');

  let _entries, _countries;
  // [{ name: English name (the value stored in the sheet), code }] sorted by English name
  function countryEntries() {
    if (!_entries) {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      _entries = CODES.map(function (c) { return { name: dn.of(c), code: c }; }).filter(function (e) { return e.name; })
        .sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); });
    }
    return _entries;
  }
  function countries() {
    if (!_countries) _countries = countryEntries().map(function (e) { return e.name; });
    return _countries;
  }
  const LANGS = [
    { code: 'en', name: 'English', native: 'English' }, { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'pt', name: 'Portuguese', native: 'Português' }, { code: 'it', name: 'Italian', native: 'Italiano' },
    { code: 'fr', name: 'French', native: 'Français' }, { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'ru', name: 'Russian', native: 'Русский' }, { code: 'nl', name: 'Dutch', native: 'Nederlands' },
    { code: 'pl', name: 'Polish', native: 'Polski' }, { code: 'tr', name: 'Turkish', native: 'Türkçe' },
    { code: 'zh', name: 'Chinese (Simplified)', native: '简体中文' }, { code: 'ja', name: 'Japanese', native: '日本語' },
    { code: 'ko', name: 'Korean', native: '한국어' },
  ];
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN', 'BRL', 'COP', 'ARS', 'CLP', 'PEN', 'CHF', 'JPY', 'CNY', 'INR', 'Other'];
  const nums = function (a, b) { return Array.from({ length: b - a + 1 }, function (_, i) { return String(a + i); }); };
  const YN = ['Yes', 'No'];
  const SERVICES = ['Flights', 'Car', 'Hotel'];
  const SERVICE_LABELS = { Flights: 'Flights', Car: 'Rental car', Hotel: 'Hotel' };
  const TIMES = ['Any', 'Morning', 'Afternoon', 'Evening', 'Overnight OK'];

  // Cities with more than one big airport. Typing one of these in From or To makes the person choose an airport.
  // [city, aliases (lower case, no punctuation), [[code, airport name], ...]]
  const METROS = [
    ['New York', ['new york', 'new york city', 'new york ny', 'nyc', 'ny'], [['JFK', 'John F. Kennedy'], ['LGA', 'LaGuardia'], ['EWR', 'Newark Liberty']]],
    ['Washington, D.C.', ['washington', 'washington dc', 'dc', 'washington d c'], [['DCA', 'Reagan National'], ['IAD', 'Dulles'], ['BWI', 'Baltimore/Washington']]],
    ['Chicago', ['chicago'], [['ORD', "O'Hare"], ['MDW', 'Midway']]],
    ['Los Angeles', ['los angeles', 'la', 'l a'], [['LAX', 'Los Angeles Intl'], ['BUR', 'Burbank'], ['LGB', 'Long Beach'], ['SNA', 'Orange County'], ['ONT', 'Ontario']]],
    ['San Francisco Bay Area', ['san francisco', 'sf', 'bay area', 'san francisco bay area'], [['SFO', 'San Francisco Intl'], ['OAK', 'Oakland'], ['SJC', 'San Jose']]],
    ['Miami', ['miami', 'south florida'], [['MIA', 'Miami Intl'], ['FLL', 'Fort Lauderdale'], ['PBI', 'Palm Beach']]],
    ['Houston', ['houston'], [['IAH', 'George Bush Intercontinental'], ['HOU', 'Hobby']]],
    ['Dallas / Fort Worth', ['dallas', 'fort worth', 'dallas fort worth', 'dallas / fort worth', 'dfw'], [['DFW', 'Dallas/Fort Worth'], ['DAL', 'Love Field']]],
    ['Toronto', ['toronto'], [['YYZ', 'Pearson'], ['YTZ', 'Billy Bishop']]],
    ['Mexico City', ['mexico city', 'ciudad de mexico', 'cdmx'], [['MEX', 'Benito Juarez'], ['NLU', 'Felipe Angeles']]],
    ['Medellin', ['medellin', 'medellin colombia'], [['MDE', 'Jose Maria Cordova'], ['EOH', 'Olaya Herrera']]],
    ['Sao Paulo', ['sao paulo', 'sampa'], [['GRU', 'Guarulhos'], ['CGH', 'Congonhas'], ['VCP', 'Viracopos']]],
    ['Rio de Janeiro', ['rio de janeiro', 'rio'], [['GIG', 'Galeao'], ['SDU', 'Santos Dumont']]],
    ['Buenos Aires', ['buenos aires'], [['EZE', 'Ezeiza'], ['AEP', 'Aeroparque']]],
    ['London', ['london'], [['LHR', 'Heathrow'], ['LGW', 'Gatwick'], ['STN', 'Stansted'], ['LTN', 'Luton'], ['LCY', 'London City']]],
    ['Paris', ['paris'], [['CDG', 'Charles de Gaulle'], ['ORY', 'Orly']]],
    ['Milan', ['milan', 'milano'], [['MXP', 'Malpensa'], ['LIN', 'Linate'], ['BGY', 'Bergamo']]],
    ['Rome', ['rome', 'roma'], [['FCO', 'Fiumicino'], ['CIA', 'Ciampino']]],
    ['Venice', ['venice', 'venezia'], [['VCE', 'Marco Polo'], ['TSF', 'Treviso']]],
    ['Stockholm', ['stockholm'], [['ARN', 'Arlanda'], ['BMA', 'Bromma']]],
    ['Warsaw', ['warsaw', 'warszawa'], [['WAW', 'Chopin'], ['WMI', 'Modlin']]],
    ['Belfast', ['belfast'], [['BFS', 'Belfast Intl'], ['BHD', 'George Best City']]],
    ['Istanbul', ['istanbul'], [['IST', 'Istanbul Airport'], ['SAW', 'Sabiha Gokcen']]],
    ['Moscow', ['moscow', 'moskva'], [['SVO', 'Sheremetyevo'], ['DME', 'Domodedovo'], ['VKO', 'Vnukovo']]],
    ['Dubai', ['dubai'], [['DXB', 'Dubai Intl'], ['DWC', 'Al Maktoum']]],
    ['Tokyo', ['tokyo'], [['HND', 'Haneda'], ['NRT', 'Narita']]],
    ['Osaka', ['osaka'], [['KIX', 'Kansai'], ['ITM', 'Itami']]],
    ['Seoul', ['seoul'], [['ICN', 'Incheon'], ['GMP', 'Gimpo']]],
    ['Beijing', ['beijing'], [['PEK', 'Capital'], ['PKX', 'Daxing']]],
    ['Shanghai', ['shanghai'], [['PVG', 'Pudong'], ['SHA', 'Hongqiao']]],
    ['Bangkok', ['bangkok'], [['BKK', 'Suvarnabhumi'], ['DMK', 'Don Mueang']]],
    // Countries and states people type instead of a city. Full names only (no short codes that could mean something else).
    ['Jamaica', ['jamaica'], [['MBJ', 'Montego Bay'], ['KIN', 'Kingston']]],
    ['Dominican Republic', ['dominican republic', 'republica dominicana'], [['PUJ', 'Punta Cana'], ['SDQ', 'Santo Domingo'], ['STI', 'Santiago'], ['POP', 'Puerto Plata'], ['LRM', 'La Romana']]],
    ['Colombia', ['colombia'], [['BOG', 'Bogota'], ['MDE', 'Medellin'], ['CTG', 'Cartagena'], ['CLO', 'Cali'], ['BAQ', 'Barranquilla']]],
    ['Mexico', ['mexico'], [['CUN', 'Cancun'], ['MEX', 'Mexico City'], ['GDL', 'Guadalajara'], ['SJD', 'Los Cabos'], ['PVR', 'Puerto Vallarta'], ['MTY', 'Monterrey']]],
    ['Bangladesh', ['bangladesh'], [['DAC', 'Dhaka'], ['CGP', 'Chattogram'], ['ZYL', 'Sylhet']]],
    ['Pakistan', ['pakistan'], [['KHI', 'Karachi'], ['LHE', 'Lahore'], ['ISB', 'Islamabad']]],
    ['India', ['india'], [['DEL', 'Delhi'], ['BOM', 'Mumbai'], ['BLR', 'Bengaluru'], ['MAA', 'Chennai'], ['CCU', 'Kolkata'], ['HYD', 'Hyderabad']]],
    ['Costa Rica', ['costa rica'], [['SJO', 'San Jose'], ['LIR', 'Liberia']]],
    ['Peru', ['peru'], [['LIM', 'Lima'], ['CUZ', 'Cusco']]],
    ['Ecuador', ['ecuador'], [['UIO', 'Quito'], ['GYE', 'Guayaquil']]],
    ['Brazil', ['brazil', 'brasil'], [['GRU', 'Sao Paulo'], ['GIG', 'Rio de Janeiro'], ['BSB', 'Brasilia'], ['SSA', 'Salvador'], ['FOR', 'Fortaleza'], ['REC', 'Recife']]],
    ['Cuba', ['cuba'], [['HAV', 'Havana'], ['VRA', 'Varadero'], ['SNU', 'Santa Clara']]],
    ['Bahamas', ['bahamas', 'the bahamas'], [['NAS', 'Nassau'], ['FPO', 'Freeport']]],
    ['Haiti', ['haiti'], [['PAP', 'Port-au-Prince'], ['CAP', 'Cap-Haitien']]],
    ['Puerto Rico', ['puerto rico'], [['SJU', 'San Juan'], ['BQN', 'Aguadilla'], ['PSE', 'Ponce']]],
    ['Florida', ['florida'], [['MCO', 'Orlando'], ['MIA', 'Miami'], ['FLL', 'Fort Lauderdale'], ['TPA', 'Tampa'], ['JAX', 'Jacksonville'], ['RSW', 'Fort Myers']]],
    ['California', ['california'], [['LAX', 'Los Angeles'], ['SFO', 'San Francisco'], ['SAN', 'San Diego'], ['SJC', 'San Jose'], ['SMF', 'Sacramento']]],
    ['Texas', ['texas'], [['DFW', 'Dallas/Fort Worth'], ['IAH', 'Houston'], ['AUS', 'Austin'], ['SAT', 'San Antonio'], ['HOU', 'Houston Hobby']]],
    ['Hawaii', ['hawaii'], [['HNL', 'Honolulu'], ['OGG', 'Maui'], ['KOA', 'Kona'], ['LIH', 'Kauai']]],
  ];
  const metroKey = function (s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  // The metro this text names (and nothing more), or null. "New York (JFK)" or "JFK" return null.
  function metroFor(text) {
    const k = metroKey(text);
    if (!k) return null;
    for (let i = 0; i < METROS.length; i++) {
      if (METROS[i][1].indexOf(k) >= 0) return { city: METROS[i][0], airports: METROS[i][2] };
    }
    return null;
  }

  const c = function (id, op, v) { return { id: id, op: op, v: v }; };
  const F = c('services', 'has', 'Flights'), CAR = c('services', 'has', 'Car'), HOTEL = c('services', 'has', 'Hotel');
  const RT = c('tripType', 'eq', 'Round trip');
  const NOFLIGHT = c('services', 'lacks', 'Flights'), ONEWAY = c('tripType', 'eq', 'One way');
  const DROP_ASKED = { id: '', op: 'any', v: [NOFLIGHT, ONEWAY] }; // return date/time is typed only for car-only or a one-way flight

  // type: text | email | tel | textarea | select | radio | checks | date | time | consent | number | integer
  // col = header in the sheet. free = free text (guarded and checked for suspicious content by the Worker).
  const sections = [
    { id: 'about', title: 'About you', fields: [
      { id: 'name', col: 'Full name (as on passport/ID)', label: 'Full name (as on passport/ID)', type: 'text', req: 1, max: 100, free: 1, autocomplete: 'name' },
      { id: 'phone', col: 'WhatsApp / phone (with country code)', label: 'Phone or WhatsApp', hint: 'Include the country code, for example +1 555 123 4567.', type: 'tel', req: 1, max: 30, autocomplete: 'tel' },
      { id: 'email', col: 'Email', label: 'Email', type: 'email', req: 1, max: 254, autocomplete: 'email' },
      { id: 'email2', label: 'Confirm email', hint: 'Type it again. Pasting is turned off on purpose.', type: 'email', req: 1, max: 254, noPaste: 1, autocomplete: 'off' },
      { id: 'residence', col: 'Country of residence', label: 'Country of residence', type: 'select', options: 'countries', req: 1, autocomplete: 'country-name' },
      { id: 'passport', col: 'Passport country', label: 'Passport country (citizenship)', type: 'select', options: 'countries', req: 1 },
    ] },
    { id: 'trip', title: 'Your trip', fields: [
      { id: 'adults', col: 'Adults (12+)', label: 'Adults (12+)', type: 'select', options: nums(1, 9), req: 1 },
      { id: 'children', col: 'Children (2-11)', label: 'Children (2-11)', type: 'select', options: nums(0, 8), dflt: '0' },
      { id: 'infants', col: 'Infants (under 2)', label: 'Infants (under 2)', type: 'select', options: nums(0, 4), dflt: '0' },
      { id: 'services', label: 'What do you want prices for?', hint: 'Check all that apply.', type: 'checks', options: SERVICES, labels: SERVICE_LABELS, req: 1 },
    ] },
    { id: 'budget', title: 'Budget', fields: [
      { id: 'budget', label: 'Do you have a budget?', type: 'radio', options: YN, req: 1 },
      { id: 'budgetAmount', col: 'Budget amount (optional)', label: 'Amount', type: 'number', req: 1, show: [c('budget', 'eq', 'Yes')], max: 15, inputmode: 'decimal' },
      { id: 'budgetCurrency', col: 'Budget currency', label: 'Currency', type: 'select', options: CURRENCIES, req: 1, show: [c('budget', 'eq', 'Yes')] },
      { id: 'budgetScope', col: 'Budget is', label: 'Is the budget', type: 'radio', options: ['Per traveler', 'Total for all travelers'], req: 1, show: [c('budget', 'eq', 'Yes'), c('travelers', 'gte', 2)] },
      { id: 'budgetCovers', col: 'Budget covers', label: 'The budget covers', type: 'checks', options: SERVICES, labels: SERVICE_LABELS, subsetOf: 'services', req: 1, show: [c('budget', 'eq', 'Yes'), c('services', 'countGte', 2)] },
    ] },
    { id: 'flights', title: 'Flights', show: [F], fields: [
      { id: 'tripType', col: 'Trip type', label: 'Trip type', type: 'radio', options: ['Round trip', 'One way'], req: 1 },
      { id: 'from', col: 'From (city or airport)', label: 'From (city or airport)', type: 'text', req: 1, max: 100, free: 1 },
      { id: 'to', col: 'To (city or airport)', label: 'To (city or airport)', type: 'text', req: 1, max: 100, free: 1 },
      { id: 'depart', col: 'Departure date', label: 'Departure date', type: 'date', req: 1, future: 1 },
      { id: 'return', col: 'Return date (round trip)', label: 'Return date', type: 'date', req: 1, future: 1, after: 'depart', show: [RT] },
      { id: 'flex', col: 'Date flexibility', label: 'How flexible are your dates?', type: 'select', options: ['Exact dates', 'Plus or minus 1 day', 'Plus or minus 2 days', 'Plus or minus 3 days', 'Flexible within the month'], req: 1, dflt: 'Exact dates' },
      { id: 'cabins', col: 'Cabins to compare (check all)', label: 'Cabins to compare', hint: 'Basic Economy is the cheapest fare. It usually leaves out free checked bags, seat choice and changes.', type: 'checks', options: ['Basic Economy', 'Economy', 'Premium Economy', 'Business', 'First'], req: 1 },
      { id: 'bags', col: 'Checked bags per traveler', label: 'Checked bags per traveler', type: 'select', options: nums(0, 4), req: 1 },
      { id: 'stops', col: 'Maximum stops', label: 'Maximum stops', type: 'radio', options: ['Any', 'Nonstop only', 'Up to 1', 'Up to 2'] },
      { id: 'timeGo', col: 'Preferred departure time', label: 'Preferred departure time, going', type: 'radio', options: TIMES },
      { id: 'timeBack', col: 'Preferred departure time (returning)', label: 'Preferred departure time, returning', type: 'radio', options: TIMES, show: [RT] },
      { id: 'nearby', col: 'Open to nearby or alternate airports?', label: 'Open to nearby or alternate airports?', type: 'radio', options: YN, req: 1 },
      { id: 'airlines', col: 'Preferred airlines', label: 'Preferred airlines', type: 'text', max: 200, free: 1 },
      { id: 'avoid', col: 'Airlines to avoid', label: 'Airlines to avoid', type: 'text', max: 200, free: 1 },
    ] },
    { id: 'payment', title: 'Payment and points', fields: [
      { id: 'cardCountry', col: 'Country that issued the card you will pay with (credit or debit)', label: 'Country that issued the card you will pay with', hint: 'Only the country. Never type card numbers.', type: 'select', options: 'countries', req: 1 },
      { id: 'miles', col: 'Airline miles or credit card points?', label: 'Do you want to use airline miles or credit card points?', type: 'radio', options: YN, req: 1 },
      { id: 'programs', col: 'If yes, which programs?', label: 'Which programs?', type: 'text', max: 200, free: 1, show: [c('miles', 'eq', 'Yes')] },
      { id: 'status', col: 'Status level', label: 'Airline or hotel status level (optional)', hint: 'For example Gold or Platinum. Status only, no numbers.', type: 'text', max: 100, free: 1 },
    ] },
    { id: 'car', title: 'Rental car', show: [CAR], fields: [
      { id: 'carNote', type: 'note', label: 'Your car will be at your destination airport and returned there. We estimate the pickup time from your flight arrival and, on a round trip, the return time from your flight home. You choose the exact times with the rental company when you book.', show: [F] },
      { id: 'carNoteOneWay', type: 'note', label: 'Your flight is one way, so please tell us when you will return the car.', show: [F, ONEWAY] },
      { id: 'pickupLoc', col: 'Pickup location', label: 'Pickup city or airport', hint: 'The car is returned to the same place.', type: 'text', req: 1, max: 150, free: 1, show: [NOFLIGHT] },
      { id: 'dropLoc', col: 'Drop-off location', label: 'Drop-off location', hint: 'Leave empty if it is the same as pickup.', type: 'text', max: 150, free: 1, retired: 1 }, // no longer asked; the column stays so the sheet keeps its layout
      { id: 'pickupDate', col: 'Pickup date', label: 'Pickup date', type: 'date', req: 1, future: 1, show: [NOFLIGHT] },
      { id: 'pickupTime', col: 'Pickup time', label: 'Pickup time', type: 'time', req: 1, show: [NOFLIGHT] },
      { id: 'dropDate', col: 'Drop-off date', label: 'Drop-off date', type: 'date', req: 1, future: 1, after: ['pickupDate', 'depart'], sameOk: 1, show: [DROP_ASKED] },
      { id: 'dropTime', col: 'Drop-off time', label: 'Drop-off time', type: 'time', req: 1, show: [DROP_ASKED] },
      { id: 'license', col: "Driver's license country", label: "Driver's license country", type: 'select', options: 'countries' },
      { id: 'driverAge', col: 'Driver age', label: 'Driver age', type: 'integer', min: 16, max: 99, inputmode: 'numeric' },
      { id: 'driverResidence', col: "Driver's country of residence", label: "Driver's country of residence", type: 'select', options: 'countries' },
      { id: 'riders', col: 'People riding in the car', label: 'People riding in the car', type: 'select', options: nums(1, 9) },
      { id: 'carBags', col: 'Bags going in the car', label: 'Bags going in the car', type: 'select', options: nums(0, 9) },
      { id: 'carType', col: 'Car type preference', label: 'Car type', type: 'radio', options: ['Any that fits', 'Compact', 'SUV', '7-seat', 'Van'] },
      { id: 'transmission', col: 'Transmission', label: 'Transmission', type: 'radio', options: ['Automatic', 'Manual'] },
      { id: 'insurance', col: 'Insurance', label: 'Car insurance', type: 'radio', options: ['My own coverage', 'Through my card', 'From the rental company'] },
      { id: 'childSeats', col: 'Child seats', label: 'Child seats needed?', type: 'radio', options: YN, show: [c('kids', 'gte', 1)] },
      { id: 'depositCard', col: "Do you have a credit card in the renter's name for the deposit?", label: "Do you have a credit card in the renter's name for the deposit?", type: 'radio', options: YN },
    ] },
    { id: 'hotel', title: 'Hotel', show: [HOTEL], fields: [
      { id: 'hotelLevel', col: 'Hotel level', label: 'Hotel level', hint: 'Star ratings vary by country, so we use plain levels.', type: 'select', req: 1, options: ['Budget (about 1-2 stars, or a hostel)', 'Mid-range (about 3 stars)', 'Upscale (about 4 stars)', 'Luxury (about 5 stars)', 'No preference (cheapest)'] },
      { id: 'area', col: 'Area or neighborhood in the city (type "anywhere" if no preference)', label: 'Area or neighborhood', hint: 'Type "anywhere" if you have no preference.', type: 'text', req: 1, max: 150, free: 1 },
      { id: 'rooms', col: 'Rooms', label: 'Rooms', type: 'select', options: nums(1, 5), req: 1 },
      { id: 'rooming', col: 'Who sleeps in which room', label: 'Who sleeps in which room', type: 'textarea', max: 500, free: 1, show: [c('rooms', 'gte', 2)] },
      { id: 'guestScore', col: 'Minimum guest score', label: 'Minimum guest score', type: 'select', options: ['Any', '7+', '8+', '9+'], req: 1 },
      { id: 'hotelCity', col: 'Hotel city (only if you are not asking for flights)', label: 'Hotel city', type: 'text', req: 1, max: 100, free: 1, show: [c('services', 'lacks', 'Flights')] },
      { id: 'checkIn', col: 'Hotel check-in date (only if you are not asking for flights)', label: 'Check-in date', type: 'date', req: 1, future: 1, show: [c('services', 'lacks', 'Flights')] },
      { id: 'checkOut', col: 'Hotel check-out date (only if you are not asking for flights)', label: 'Check-out date', type: 'date', req: 1, future: 1, after: 'checkIn', show: [c('services', 'lacks', 'Flights')] },
    ] },
    { id: 'finish', title: 'Almost done', fields: [
      { id: 'notes', col: 'Anything else we should know?', label: 'Anything else we should know?', hint: 'For example mobility needs, dietary needs, pets, special occasions.', type: 'textarea', max: 2000, free: 1 },
      { id: 'heard', col: 'How did you hear about us?', label: 'How did you hear about us? (optional)', type: 'select', options: ['A friend or family', 'Social media', 'Online search', 'Other'] },
      { id: 'consent', col: 'Consent to use my answers', label: 'I agree that my answers are stored and used to prepare my price report. I will not type passport, card or bank numbers.', type: 'consent', req: 1 },
    ] },
  ];

  // Columns of the new Responses sheet, in order. Fields with a col are answers; the rest are filled by the Worker.
  const COLUMNS = ['Timestamp'];
  const fieldList = [];
  const specialAfter = { services: ['Do you want flight prices?', 'Do you need a rental car?', 'Do you want hotel prices?'] };
  sections.forEach(function (s) {
    s.fields.forEach(function (f) {
      f.sec = s;
      fieldList.push(f);
      if (f.col) COLUMNS.push(f.col);
      if (specialAfter[f.id]) specialAfter[f.id].forEach(function (h) { COLUMNS.push(h); });
      if (f.id === 'services') { /* services itself has no column of its own */ }
    });
  });
  COLUMNS.push('Language', 'Looks suspicious?', 'Handled');
  const byId = {};
  fieldList.forEach(function (f) { byId[f.id] = f; });

  function optionsOf(f) {
    return f.options === 'countries' ? countries() : f.options || [];
  }

  function derive(v) {
    const num = function (k) { return Number(v[k]) || 0; };
    return Object.assign({}, v, {
      travelers: num('adults') + num('children') + num('infants'),
      kids: num('children') + num('infants'),
    });
  }
  function testCond(cd, v) {
    const x = v[cd.id];
    switch (cd.op) {
      case 'eq': return x === cd.v;
      case 'has': return Array.isArray(x) && x.indexOf(cd.v) >= 0;
      case 'lacks': return !(Array.isArray(x) && x.indexOf(cd.v) >= 0);
      case 'gte': return Number(x) >= cd.v;
      case 'countGte': return Array.isArray(x) && x.length >= cd.v;
      case 'any': return cd.v.some(function (sub) { return testCond(sub, v); });
    }
    return false;
  }
  function isVisible(f, dv) {
    if (f.retired) return false;
    return (!f.sec.show || f.sec.show.every(function (cd) { return testCond(cd, dv); })) &&
           (!f.show || f.show.every(function (cd) { return testCond(cd, dv); }));
  }

  // Same rules as src/safety.js: trim, ignore capitals, accept accented letters.
  const normEmail = function (s) { return String(s == null ? '' : s).trim().toLowerCase(); };
  const emailShape = function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(s); };

  function validDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
  }

  const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

  // values: { fieldId: string | string[] }. today: 'YYYY-MM-DD' in the business time zone (or '' to skip past-date checks).
  // Returns { errors: {id: code}, clean: {id: string} }. clean holds only visible, valid answers (others are dropped).
  function validate(values, today) {
    const errors = {}, clean = {}, raw = {};
    fieldList.forEach(function (f) {
      let x = values ? values[f.id] : undefined;
      if (f.type === 'checks') x = Array.isArray(x) ? x.filter(function (i) { return typeof i === 'string'; }) : [];
      else x = typeof x === 'string' ? x.replace(CTRL, '').trim() : '';
      raw[f.id] = x;
    });
    const dv = derive(raw);
    fieldList.forEach(function (f) {
      if (!isVisible(f, dv)) return;
      const x = raw[f.id];
      const empty = f.type === 'checks' ? x.length === 0 : (f.type === 'consent' ? x !== 'yes' : x === '');
      if (empty) { if (f.req) errors[f.id] = f.type === 'consent' ? 'consent' : 'required'; return; }
      if (f.type === 'checks') {
        const ok = optionsOf(f);
        if (!x.every(function (i) { return ok.indexOf(i) >= 0; })) { errors[f.id] = 'badValue'; return; }
        if (f.subsetOf && !x.every(function (i) { return raw[f.subsetOf].indexOf(i) >= 0; })) { errors[f.id] = 'badValue'; return; }
        clean[f.id] = Array.from(new Set(x)).join(', ');
        return;
      }
      if (f.type === 'consent') { clean[f.id] = 'Yes'; return; }
      if (x.length > (f.max || 200)) { errors[f.id] = 'tooLong'; return; }
      if (f.type === 'select' || f.type === 'radio') {
        if (optionsOf(f).indexOf(x) < 0) { errors[f.id] = 'badValue'; return; }
      } else if (f.type === 'email') {
        if (!emailShape(normEmail(x))) { errors[f.id] = 'emailShape'; return; }
      } else if (f.type === 'tel') {
        if (!/^[+(]?\d[\d\s().\-]{4,28}$/.test(x)) { errors[f.id] = 'phoneShape'; return; }
      } else if (f.type === 'date') {
        if (!validDate(x)) { errors[f.id] = 'badDate'; return; }
        if (today && f.future && x < today) { errors[f.id] = 'datePast'; return; }
        if (today && x > addDays(today, 800)) { errors[f.id] = 'badDate'; return; }
      } else if (f.type === 'time') {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) { errors[f.id] = 'badTime'; return; }
      } else if (f.type === 'number') {
        const n = x.replace(/[,\s]/g, '');
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(n) || Number(n) <= 0) { errors[f.id] = 'number'; return; }
        clean[f.id] = n; return;
      } else if (f.type === 'integer') {
        if (!/^\d{1,3}$/.test(x) || +x < f.min || +x > f.max) { errors[f.id] = 'number'; return; }
      }
      clean[f.id] = x;
    });
    if (!errors.email && !errors.email2 && clean.email !== undefined && clean.email2 !== undefined &&
        normEmail(clean.email) !== normEmail(clean.email2)) errors.email2 = 'emailMismatch';
    // From and To can not be the same place (ignoring capitals and extra spaces)
    if (!errors.to && clean.from !== undefined && clean.to !== undefined) {
      const norm = function (s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); };
      if (norm(clean.from) === norm(clean.to)) errors.to = 'samePlace';
    }
    // A big city with several airports must be narrowed to an airport (or "all airports") in From and To.
    ['from', 'to'].forEach(function (id) {
      if (!errors[id] && clean[id] !== undefined && metroFor(clean[id])) errors[id] = 'pickAirport';
    });
    // "All airports" is not allowed at the destination when a rental car is asked (the car needs one airport).
    if (!errors.to && clean.to !== undefined && /, all airports \(/.test(clean.to) && raw.services.indexOf('Car') >= 0) errors.to = 'pickAirport';
    fieldList.forEach(function (f) {
      if (!f.after || errors[f.id] || !clean[f.id]) return;
      const strict = f.id === 'checkOut';
      [].concat(f.after).forEach(function (a) {
        if (errors[f.id] || !clean[a]) return;
        if (strict ? clean[f.id] <= clean[a] : clean[f.id] < clean[a]) errors[f.id] = 'dateOrder';
      });
    });
    // Not asked in these cases, so fill the obvious answer.
    if (clean.budget === 'Yes' && !errors.services) {
      if (clean.budgetScope === undefined && dv.travelers < 2) clean.budgetScope = 'Per traveler';
      if (clean.budgetCovers === undefined && raw.services.length === 1) clean.budgetCovers = raw.services[0];
    }
    return { errors: errors, clean: clean };
  }

  return { sections: sections, COLUMNS: COLUMNS, SERVICES: SERVICES, fieldList: fieldList, byId: byId, countries: countries, countryEntries: countryEntries, LANGS: LANGS, optionsOf: optionsOf, derive: derive, isVisible: isVisible, METROS: METROS, metroFor: metroFor, validate: validate, normEmail: normEmail, emailShape: emailShape, addDays: addDays };
});
