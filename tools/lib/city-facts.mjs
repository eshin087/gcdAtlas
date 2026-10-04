// What a visitor reads about the cities, and the corrections to the tower lists. House style: short, concrete, true sentences; no em dashes; numbers with units.
// Every number has its source in a comment next to it.

export const SOURCES = {
  osm:{ what:'Roads, buildings, water, airports, ferries, ports, tall buildings', credit:'© OpenStreetMap contributors (ODbL)', url:'https://www.openstreetmap.org/copyright', licence:'ODbL 1.0' },
  s2:{ what:'Satellite colour (the 51 km layers everywhere; London and Dubai down to the finest)', credit:'Contains modified Copernicus Sentinel data 2025 and 2026', url:'https://sentinel.esa.int', licence:'Copernicus Sentinel data terms (free, full and open, with credit)' },
  fpac:{ what:'New York aerial photos', credit:'USDA NAIP aerial photos (2024 and 2025)', url:'https://naip-usdaonline.hub.arcgis.com', licence:'public domain (US government work)' },
  nyc:{ what:'New York building footprints and heights', credit:'NYC Open Data, Building Footprints (NYC Office of Technology and Innovation)', url:'https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue', licence:'NYC Open Data terms of use (free to use)' },
  gsi:{ what:'Tokyo aerial photos', credit:'Aerial photos: GSI Japan (国土地理院), seamless photographs, edited', url:'https://maps.gsi.go.jp/development/ichiran.html', licence:'GSI terms of use, Public Data License 1.0 (compatible with CC BY 4.0)' },
  ign:{ what:'Paris aerial photos', credit:'Aerial photos: IGN, BD ORTHO (Licence Ouverte 2.0)', url:'https://geoservices.ign.fr/bdortho', licence:'Licence Ouverte / Open Licence 2.0 (Etalab)' },
  bdtopo:{ what:'Paris building footprints and heights', credit:'IGN, BD TOPO (Licence Ouverte 2.0)', url:'https://geoservices.ign.fr/bdtopo', licence:'Licence Ouverte / Open Licence 2.0 (Etalab)' },
  terrain:{ what:'Ground height', credit:'Terrain: Mapzen Terrain Tiles on AWS (SRTM, USGS 3DEP and others)', url:'https://registry.opendata.aws/terrain-tiles/', licence:'free with credit' },
  population:{ what:'Population', credit:'US Census Bureau 2020; Statistics Bureau of Japan, Tokyo Metropolitan Government 2020 census; Dubai Statistics Center; ONS Census 2021; INSEE', licence:'official statistics' },
};

// framings: look [la, lo, height m above the sea], az degrees from north the camera looks toward, tilt degrees down from the horizon, dist metres from the look point
export const FACTS = {
  newyork:{
    country:'United States', tz:'America/New_York',
    // 2020 United States Census, 1 April 2020: 8,804,190 (the city, five boroughs)
    population:{ n:8804190, year:2020, of:'the city', source:'2020 United States Census' },
    facts:['About 8.8 million people live in New York City.', 'Manhattan is 21.6 km long and at most 3.7 km wide.'],
    aka:'new york nyc new york city manhattan brooklyn queens bronx staten island big apple',
    views:[
      { look:[40.7415, -73.995, 120], az:25, tilt:9, dist:13000, why:'the skyline from the harbour' },
      { look:[40.7527, -73.9772, 200], az:300, tilt:16, dist:1100, why:'among the Midtown towers' },
      { look:[40.7127, -74.0134, 250], az:350, tilt:20, dist:1300, why:'One World Trade Center and Lower Manhattan' } ],
  },
  tokyo:{
    country:'Japan', tz:'Asia/Tokyo',
    // 2020 census (1 October 2020), Tokyo Metropolis: 14,047,594
    population:{ n:14047594, year:2020, of:'Tokyo Metropolis', source:'2020 census of Japan' },
    facts:['About 14 million people live in the Tokyo Metropolis.', 'Tokyo Skytree is 634 m tall, the tallest tower in Japan.'],
    aka:'tokyo tokio edo shinjuku shibuya chiyoda ginza marunouchi skytree',
    views:[
      { look:[35.665, 139.76, 80], az:15, tilt:8, dist:15000, why:'central Tokyo from the bay' },
      { look:[35.6896, 139.6921, 150], az:60, tilt:18, dist:1300, why:'the Shinjuku towers' },
      { look:[35.6812, 139.7671, 60], az:320, tilt:22, dist:1000, why:'Tokyo Station and the palace grounds' } ],
  },
  dubai:{
    country:'United Arab Emirates', tz:'Asia/Dubai',
    // Dubai Statistics Center, 2025 (as recorded on Wikidata): 3,944,751 in the emirate
    population:{ n:3944751, year:2025, of:'the emirate', source:'Dubai Statistics Center' },
    facts:['Burj Khalifa is 828 m tall and has been the tallest building in the world since 2009.', 'About 3.9 million people live in Dubai.'],
    aka:'dubai uae emirates burj khalifa marina palm jumeirah downtown',
    views:[
      { look:[25.15, 55.2, 100], az:125, tilt:7, dist:17000, why:'the coast from the Gulf' },
      { look:[25.1972, 55.2744, 400], az:320, tilt:10, dist:1500, why:'Burj Khalifa' },
      { look:[25.0875, 55.1465, 150], az:335, tilt:14, dist:1200, why:'the Marina towers' } ],
  },
  london:{
    country:'United Kingdom', tz:'Europe/London',
    // Census 2021 (21 March 2021), Greater London: 8,799,728 (ONS)
    population:{ n:8799728, year:2021, of:'Greater London', source:'ONS, Census 2021' },
    facts:['About 8.8 million people live in Greater London.', 'The City of London, its old centre, covers only 2.9 km2.'],
    aka:'london england uk britain thames westminster canary wharf shard city of london big ben',
    views:[
      { look:[51.505, -0.09, 80], az:325, tilt:8, dist:11000, why:'central London from the south-east' },
      { look:[51.5045, -0.0865, 150], az:345, tilt:20, dist:800, why:'the Shard and the City' },
      { look:[51.5049, -0.0195, 130], az:260, tilt:15, dist:1200, why:'Canary Wharf' } ],
  },
  paris:{
    country:'France', tz:'Europe/Paris',
    // INSEE legal population of the commune of Paris, 1 January 2023: 2,103,778; area 105.4 km2
    population:{ n:2103778, year:2023, of:'the city', source:'INSEE' },
    facts:['About 2.1 million people live in Paris, in only 105 km2.', 'The Eiffel Tower is 330 m tall and was the tallest structure in the world from 1889 to 1930.'],
    aka:'paris france seine eiffel louvre notre dame la defense',
    views:[
      { look:[48.857, 2.33, 60], az:300, tilt:9, dist:9000, why:'Paris and the Seine' },
      { look:[48.8584, 2.2945, 120], az:35, tilt:12, dist:800, why:'the Eiffel Tower and the Champ de Mars' },
      { look:[48.8905, 2.2405, 120], az:95, tilt:14, dist:1100, why:'the towers of La Défense' } ],
  },
};

// Corrections to OpenStreetMap's tower heights and names where they differ from the official ones; { re: matches the OSM name, h, name, kind, thin, la, lo, src }
export const TOWER_FIX = { newyork:[], tokyo:[], dubai:[], london:[], paris:[
  { re:/^Tour Eiffel$/, h:330, thin:true, src:'Wikipedia (330 m since the antenna of 2022)' },
  { re:/^Tour First$/, h:231, src:'Wikipedia (OpenStreetMap has 259 m)' },
  { re:/^Hyatt Regency Paris/, h:137, src:'Wikipedia (OpenStreetMap has 174 m)' } ] };
// Landmarks OpenStreetMap does not tag with a height (or not as a building): { name, la, lo, h, kind, thin, src }
export const TOWER_ADD = { newyork:[], tokyo:[], dubai:[], london:[], paris:[] };
// Names to leave out (mapped twice, or not towers)
export const TOWER_SKIP = { newyork:[], tokyo:[], dubai:[], london:[], paris:[ /^Pullman Paris Montparnasse$/ ] };   // (a mast on a hotel)
