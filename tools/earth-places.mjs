// Builds the ground layers of the iconic places (docs/EARTH_PLAN.md, phase 3): for each place two to four square layers, each a WebP image, from a region
// 410 km across down to about 12 km (3 km where aerial photos allow), in exactly the format tools/earth-detail.mjs gives the launch sites (see
// src/objects/e2-earth-detail-data.js): orthographic about the layer's centre onto a 6,371 km sphere, x east, y north, in metres; RGB is the ground seen
// from above; alpha is 1 for water, else 2 + (height above sea level - base)/step.
//   Sources (credits are kept per place in the manifest; see tools/lib/earth-layers.mjs):
//   - Colour: Sentinel-2 L2A true colour (10 m), Copernicus, from Earth Search on AWS, a cloud-free composite of the clearest scenes of a chosen
//     season. "Contains modified Copernicus Sentinel data <years>". In the United States, USGS NAIP aerial photos (public domain) for the finest layers.
//   - Heights: Copernicus DEM GLO-30 (AWS open data; 30 m, from the TanDEM-X mission 2011 to 2015, so it has the dams, islands and canals built after
//     the older SRTM and the Antarctic ice surface), or the AWS Terrain Tiles where a layer says so.
//   - Buildings, the Great Wall's line: OpenStreetMap through Overpass (ODbL, "(c) OpenStreetMap contributors"), only where a place says so. The Giza
//     pyramids are simple models (true base sizes, present heights, aligned to north) rasterised into the heights.
// Writes assets/earth/places/<place>-<layer>-<hash>.webp, src/objects/e8-earth-places-data.js (the manifest, with each place's text for the atlas) and
// review previews in tools/cache/earth-places/preview/. Everything downloaded is cached in tools/cache/earth-places, so a rerun fetches nothing.
//   node tools/earth-places.mjs [place[:layer] ...]   (no names: all places; place:layer rebuilds one layer; --manifest only rewrites the manifest from what was built)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, CACHE, PREVIEW, RE, D2R, clampN, frameAt, bboxLL, planeToLL, llToPlane, s2Source, copSource, depSource, terrainSource, naipSource, overpass, rasterPolys, rasterLines, encodeLayer, previewLayer, previewSheet } from './lib/earth-layers.mjs';

// ---------------------------------------------------------------- the places
// A layer: id, la, lo (centre), size (m), px (1024), src ('s2', or 'naip' for aerial photos with Sentinel-2 where they have no pixel), terr (the heights:
// 'cop' Copernicus DEM, the default; '3dep' USGS, United States only; 'terrarium' AWS Terrain Tiles), q (WebP quality, 76). Settings a layer takes from its
// place when it has none of its own:
//   wins     the seasons Sentinel-2 scenes are taken from, as 'YYYY-MM-DD/YYYY-MM-DD' (a clear season, the snow or the flood wanted)
//   mask     'scl' (the scene classification takes out cloud, its shadow and no data) or 'none'
//   tone     'hdr' keeps the tones of snow and ice (the true-colour product turns every sunlit and shaded snow pixel pure white): read from the three 10 m bands
//   gamma    lifts the dark tones (0.72, or 0.8 with 'hdr')
//   wcloud   a bright white pixel, much brighter than its surroundings, is cloud too (small cumulus in the humid tropics, which the classification misses)
//   dehaze   on layers 100 km and wider, grey bright sea (haze, sun glint over a pass) is drawn back to the deep water's colour; reefs keep theirs
//   wmode, wscl   water from Sentinel-2's water pixels below wscl m (a delta's coast, a canal the 30 m heights cannot resolve) rather than the heights alone
//   cloud, maxPer, tries, tiles, feather   how many scenes are tried, kept, which tiles, how far two scenes blend (m)
// A place's text (fact, readout, aka, views) is for the atlas entry; every number in it has its source in a comment.
const PLACES = [];
const place = p => PLACES.push(p);

// ---- mountains and canyons
place({ key:'everest', name:'Mount Everest and the Himalaya', group:'mountains', la:27.9881, lo:86.9250,
  wins:['2025-10-15/2025-12-15', '2024-10-15/2024-12-15'], mask:'scl', tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:28.0, lo:86.9, size:409600 }, { id:'r51', la:27.99, lo:86.9, size:51200 }, { id:'f13', la:27.985, lo:86.915, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'grandcanyon', name:'Grand Canyon', group:'mountains', la:36.09, lo:-112.11,
  wins:['2025-04-01/2025-06-15', '2025-09-01/2025-11-15', '2026-04-01/2026-06-15'], mask:'scl',
  layers:[ { id:'r410', la:36.1, lo:-112.1, size:409600 }, { id:'r51', la:36.1, lo:-112.1, size:51200 }, { id:'f13', la:36.09, lo:-112.11, size:12800, src:'naip', terr:'3dep' } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'alps', name:'The Alps: Matterhorn and Mont Blanc', group:'mountains', la:45.90, lo:7.26,
  wins:['2025-07-15/2025-09-30', '2024-07-15/2024-09-30'], mask:'scl', tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:45.9, lo:7.26, size:409600 }, { id:'r102', la:45.9, lo:7.26, size:102400 }, { id:'m13', la:45.975, lo:7.66, size:12800 }, { id:'b13', la:45.84, lo:6.87, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'kilimanjaro', name:'Mount Kilimanjaro', group:'mountains', la:-3.0758, lo:37.3533,
  wins:['2026-01-10/2026-03-15', '2025-08-01/2025-10-31'], mask:'scl', tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:-3.07, lo:37.35, size:409600 }, { id:'r51', la:-3.07, lo:37.35, size:51200 }, { id:'f13', la:-3.08, lo:37.39, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'fuji', name:'Mount Fuji', group:'mountains', la:35.3606, lo:138.7274,
  wins:['2025-12-01/2026-03-15', '2024-12-01/2025-03-15'], mask:'scl', tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:35.4, lo:138.8, size:409600 }, { id:'r51', la:35.37, lo:138.75, size:51200 }, { id:'f13', la:35.36, lo:138.73, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'yosemite', name:'Yosemite Valley', group:'mountains', la:37.745, lo:-119.585,
  wins:['2025-05-01/2025-07-15', '2024-05-01/2024-07-15'], mask:'scl',
  layers:[ { id:'r410', la:37.75, lo:-119.6, size:409600 }, { id:'r51', la:37.75, lo:-119.55, size:51200 }, { id:'f13', la:37.745, lo:-119.585, size:12800, terr:'3dep' } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'torresdelpaine', name:'Torres del Paine', group:'mountains', la:-50.95, lo:-73.0,
  wins:['2026-01-05/2026-03-05', '2025-01-05/2025-03-05'], mask:'none', median:5, medianP:0.2, tries:8, tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:-50.95, lo:-73.0, size:409600 }, { id:'r51', la:-50.95, lo:-73.0, size:51200 }, { id:'f13', la:-50.965, lo:-73.02, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'denali', name:'Denali', group:'mountains', la:63.0695, lo:-151.0063,
  wins:['2025-07-15/2025-08-31', '2024-07-15/2024-08-31'], mask:'none', median:5, tries:8, tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:63.07, lo:-151.0, size:409600 }, { id:'r51', la:63.07, lo:-151.0, size:51200 }, { id:'f13', la:63.07, lo:-151.0, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
// ---- deserts, rivers and forests
place({ key:'richat', name:'Richat Structure, Sahara', group:'deserts', la:21.1244, lo:-11.4009,
  wins:['2025-10-01/2026-03-31', '2024-10-01/2025-03-31'], mask:'scl', gamma:0.85,
  layers:[ { id:'r410', la:21.12, lo:-11.4, size:409600 }, { id:'r51', la:21.12, lo:-11.4, size:51200 }, { id:'f13', la:21.12, lo:-11.4, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'amazon', name:'Meeting of Waters, Amazon', group:'deserts', la:-3.14, lo:-59.92,
  wins:['2025-08-01/2025-10-31', '2024-08-01/2024-10-31'], mask:'scl',
  layers:[ { id:'r410', la:-3.1, lo:-60.0, size:409600 }, { id:'r51', la:-3.12, lo:-59.95, size:51200 }, { id:'f13', la:-3.14, lo:-59.93, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'nile', name:'Nile Delta', group:'deserts', la:30.9, lo:31.15,
  dehaze:true, wins:['2025-11-01/2026-03-15', '2024-11-01/2025-03-15'], mask:'scl',
  layers:[ { id:'r410', la:30.8, lo:31.1, size:409600, wmode:'scl', wscl:4 }, { id:'r204', la:30.8, lo:31.1, size:204800, wmode:'scl', wscl:4 }, { id:'r51', la:30.95, lo:31.2, size:51200, wmode:'scl', wscl:4 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'uluru', name:'Uluru and Kata Tjuta', group:'deserts', la:-25.3444, lo:131.0369,
  wins:['2025-04-01/2025-09-30', '2024-04-01/2024-09-30'], mask:'scl',
  layers:[ { id:'r410', la:-25.33, lo:130.95, size:409600 }, { id:'r51', la:-25.32, lo:130.9, size:51200 }, { id:'f13', la:-25.345, lo:131.037, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'okavango', name:'Okavango Delta', group:'deserts', la:-19.3, lo:22.8,
  wins:['2025-06-01/2025-09-15', '2024-06-01/2024-09-15'], mask:'scl',
  layers:[ { id:'r410', la:-19.4, lo:22.8, size:409600 }, { id:'r204', la:-19.3, lo:22.8, size:204800 }, { id:'f13', la:-19.35, lo:22.75, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'sossusvlei', name:'Sossusvlei dunes, Namib', group:'deserts', la:-24.74, lo:15.3,
  wins:['2025-04-01/2025-10-31', '2024-04-01/2024-10-31'], mask:'scl',
  layers:[ { id:'r410', la:-24.75, lo:15.2, size:409600 }, { id:'r51', la:-24.75, lo:15.3, size:51200 }, { id:'f13', la:-24.74, lo:15.3, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
// ---- coasts, islands and ice
place({ key:'gbr', name:'Great Barrier Reef: Whitsundays and Heart Reef', group:'coasts', la:-20.05, lo:149.2,
  dehaze:true, wins:['2025-06-01/2025-10-31', '2026-06-01/2026-09-30'], mask:'scl',
  layers:[ { id:'r410', la:-20.1, lo:149.1, size:409600 }, { id:'r102', la:-20.05, lo:149.2, size:102400 }, { id:'w13', la:-20.28, lo:149.04, size:12800 }, { id:'h13', la:-19.755, lo:149.385, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'hawaii', name:'Hawaii: the Big Island and Kilauea', group:'coasts', la:19.4069, lo:-155.2834,
  dehaze:true, wins:['2025-01-01/2026-09-28'], mask:'scl', cloud:30,
  layers:[ { id:'r410', la:19.55, lo:-155.5, size:409600 }, { id:'r204', la:19.55, lo:-155.5, size:204800 }, { id:'f13', la:19.41, lo:-155.28, size:12800, terr:'3dep' } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'iceland', name:'Iceland: Vatnajokull and Jokulsarlon', group:'coasts', la:64.05, lo:-16.55,
  dehaze:true, wins:['2025-07-01/2025-09-15', '2024-07-01/2024-09-15'], mask:'scl', tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:64.2, lo:-17.8, size:409600 }, { id:'r51', la:64.05, lo:-16.55, size:51200 }, { id:'f13', la:64.05, lo:-16.25, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'antarctic', name:'Antarctica: Ross Island and the Ross Ice Shelf', group:'coasts', la:-77.53, lo:167.17,
  wins:['2025-12-01/2026-02-28', '2024-12-01/2025-02-28'], mask:'scl', tone:'hdr', gamma:0.8, cloud:30,
  layers:[ { id:'r410', la:-77.8, lo:166.7, size:409600 }, { id:'r51', la:-77.7, lo:167.0, size:51200 }, { id:'f13', la:-77.53, lo:167.17, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'greenland', name:'Greenland: Ilulissat Icefjord', group:'coasts', la:69.17, lo:-50.55,
  wins:['2025-07-01/2025-08-31', '2024-07-01/2024-08-31'], mask:'scl', tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:69.2, lo:-50.5, size:409600 }, { id:'r51', la:69.17, lo:-50.55, size:51200 }, { id:'f13', la:69.17, lo:-51.0, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'maldives', name:'The Maldives', group:'coasts', la:4.2, lo:73.5,
  dehaze:true, wins:['2025-12-15/2026-04-30', '2024-12-15/2025-04-30'], mask:'scl',
  layers:[ { id:'r410', la:4.2, lo:73.3, size:409600 }, { id:'r51', la:4.35, lo:73.5, size:51200 }, { id:'f13', la:4.2, lo:73.5, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'borabora', name:'Bora Bora', group:'coasts', la:-16.5, lo:-151.74,
  dehaze:true, wins:['2025-06-01/2025-10-31', '2024-06-01/2024-10-31'], mask:'scl',
  layers:[ { id:'r410', la:-16.7, lo:-151.7, size:409600 }, { id:'r51', la:-16.5, lo:-151.74, size:51200 }, { id:'f13', la:-16.5, lo:-151.74, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'halong', name:'Ha Long Bay', group:'coasts', la:20.85, lo:107.1,
  dehaze:true, wins:['2025-10-01/2025-12-31', '2024-10-01/2024-12-31'], mask:'scl',
  layers:[ { id:'r410', la:20.9, lo:107.0, size:409600 }, { id:'r51', la:20.85, lo:107.1, size:51200 }, { id:'f13', la:20.85, lo:107.12, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'geiranger', name:'Geirangerfjord', group:'coasts', la:62.105, lo:7.15,
  dehaze:true, wins:['2025-07-01/2025-09-15', '2024-07-01/2024-09-15'], mask:'scl', tone:'hdr', gamma:0.8,
  layers:[ { id:'r410', la:62.2, lo:7.0, size:409600 }, { id:'r51', la:62.1, lo:7.1, size:51200 }, { id:'f13', la:62.105, lo:7.15, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
// ---- man-made wonders
place({ key:'palm', name:'Palm Jumeirah, Dubai', group:'wonders', la:25.1124, lo:55.139,
  dehaze:true, wins:['2025-10-01/2026-04-30', '2024-10-01/2025-04-30'], mask:'scl', gamma:0.85,
  layers:[ { id:'r410', la:25.15, lo:55.2, size:409600 }, { id:'r51', la:25.15, lo:55.2, size:51200 }, { id:'f13', la:25.125, lo:55.14, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'panama', name:'Panama Canal', group:'wonders', la:9.12, lo:-79.7,
  dehaze:true, wcloud:true, wins:['2026-01-01/2026-03-31', '2025-01-01/2025-03-31'], mask:'scl', tries:12, maxPer:6,
  layers:[ { id:'r410', la:9.2, lo:-79.7, size:409600 }, { id:'r102', la:9.15, lo:-79.75, size:102400 }, { id:'f13', la:9.01, lo:-79.61, size:12800 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'greatwall', name:'Great Wall at Mutianyu', group:'wonders', la:40.43, lo:116.57,
  wins:['2025-10-01/2025-11-10', '2024-10-01/2024-11-10'], mask:'scl',
  layers:[ { id:'r410', la:40.39, lo:116.29, size:409600 }, { id:'r51', la:40.39, lo:116.29, size:51200 }, { id:'f6', la:40.43, lo:116.57, size:6400 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'giza', name:'Pyramids of Giza', group:'wonders', la:29.9753, lo:31.1308,
  wins:['2025-10-01/2026-03-31', '2024-10-01/2025-03-31'], mask:'scl', gamma:0.85,
  layers:[ { id:'r410', la:30.0, lo:31.15, size:409600 }, { id:'r51', la:29.99, lo:31.13, size:51200 }, { id:'f3', la:29.9753, lo:31.1308, size:3200 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'suez', name:'Suez Canal', group:'wonders', la:30.6, lo:32.3,
  dehaze:true, wins:['2025-10-01/2026-03-31', '2024-10-01/2025-03-31'], mask:'scl', gamma:0.85,
  layers:[ { id:'r410', la:30.4, lo:32.4, size:409600 }, { id:'r51', la:30.58, lo:32.3, size:51200, wscl:12 }, { id:'f13', la:30.62, lo:32.29, size:12800, wscl:12 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'threegorges', name:'Three Gorges Dam', group:'wonders', la:30.8231, lo:111.0033,
  wins:['2025-10-01/2025-12-31', '2024-10-01/2024-12-31'], mask:'scl',
  layers:[ { id:'r410', la:30.9, lo:110.9, size:409600 }, { id:'r51', la:30.82, lo:111.0, size:51200 }, { id:'f6', la:30.822, lo:111.005, size:6400 } ],
  fact:'', readout:'', aka:'', views:[] });
place({ key:'hoover', name:'Hoover Dam and Lake Mead', group:'wonders', la:36.0156, lo:-114.7378,
  wins:['2025-04-01/2025-06-30', '2024-04-01/2024-06-30'], mask:'scl',
  layers:[ { id:'r410', la:36.1, lo:-114.9, size:409600 }, { id:'r51', la:36.05, lo:-114.75, size:51200 }, { id:'f3', la:36.0156, lo:-114.7378, size:3200, src:'naip', terr:'3dep' } ],
  fact:'', readout:'', aka:'', views:[] });

// ---------------------------------------------------------------- the text of each place (for the atlas entry) and its suggested views
// fact: one or two true sentences with a number, in the house style (short, concrete, no em dashes); readout: a short line with a real number; aka: search words
// (lower case, other names and spellings); views: look [lat, lon, height m], az (degrees from north the camera looks toward), tilt (degrees down from the
// horizon), dist (m from the look point to the camera), why. Each place has a wide view, a middle one, and a close, oblique one where the relief stands up.
// Every number has its source in a comment.
const v = (look, az, tilt, dist, why) => ({ look, az, tilt, dist, why });
const TEXT = {
  // Everest: 8,848.86 m, the height China and Nepal announced together on 8 December 2020 (rounded to 8,849 m); the Khumbu icefall and the Western Cwm lie between the
  // peaks in the finest layer; "ten of the 14 peaks over 8,000 m are in the Himalaya" is left out
  everest:{ fact:'Mount Everest, on the border of Nepal and China, is the highest mountain above sea level: 8,849 m. Nepal and China agreed that height in 2020.',
    readout:'summit 8,849 m above sea level', aka:'everest sagarmatha chomolungma qomolangma himalaya himalayas nepal tibet khumbu lhotse nuptse',
    views:[ v([28.0, 86.9, 6000], 20, 9, 180000, 'the Himalayan wall from the south'), v([27.99, 86.92, 7000], 60, 10, 40000, 'Everest, Lhotse and Nuptse from the Khumbu'), v([27.99, 86.93, 8300], 55, 11, 14000, 'close to the summit pyramid') ] },
  // Grand Canyon: 446 km long, up to 29 km wide, over 1,800 m deep (National Park Service: 277 miles, 18 miles, a mile deep; Wikipedia gives a depth of 1,857 m)
  grandcanyon:{ fact:'The Grand Canyon in Arizona is 446 km long, up to 29 km wide and more than 1,800 m deep. The Colorado River cut it through the rock.',
    readout:'446 km long, over 1,800 m deep', aka:'grand canyon arizona colorado river south rim north rim bright angel phantom ranch',
    views:[ v([36.1, -112.1, 1500], 20, 18, 70000, 'the canyon across the plateau'), v([36.09, -112.11, 1200], 300, 25, 25000, 'along the canyon'), v([36.1, -112.09, 900], 190, 20, 9000, 'from the North Rim across to the South Rim') ] },
  // Mont Blanc 4,805.59 m (measured 2021, rounded 4,806 m), the Matterhorn 4,477.54 m (swisstopo, rounded 4,478 m)
  alps:{ fact:'Mont Blanc, at 4,806 m, is the highest peak in the Alps. The Matterhorn, 4,478 m, stands on the border of Switzerland and Italy.',
    readout:'Mont Blanc 4,806 m, Matterhorn 4,478 m', aka:'alps alpen alpes matterhorn cervino mont blanc monte bianco zermatt chamonix switzerland italy france',
    views:[ v([45.9, 7.26, 3000], 20, 8, 160000, 'the Alps from Italy'), v([45.976, 7.659, 4000], 225, 9, 9000, 'the Matterhorn from Zermatt'), v([45.833, 6.865, 4200], 135, 10, 10000, 'Mont Blanc from Chamonix') ] },
  // Uhuru Peak 5,895 m (Wikipedia, Tanzania National Parks)
  kilimanjaro:{ fact:'Kilimanjaro in Tanzania is Africa\'s highest mountain: 5,895 m above sea level. It is a volcano that stands alone, just over 3 degrees south of the equator, with ice on its summit.',
    readout:'Uhuru Peak 5,895 m', aka:'kilimanjaro kibo uhuru peak mawenzi shira tanzania africa volcano moshi',
    views:[ v([-3.07, 37.35, 2500], 0, 4, 100000, 'a lone volcano on the plain'), v([-3.075, 37.355, 5000], 20, 12, 30000, 'Kibo and Mawenzi'), v([-3.07, 37.36, 5800], 350, 15, 7000, 'into the crater of Kibo') ] },
  // Fuji 3,776 m (Geospatial Information Authority of Japan, 3,775.63 m), last eruption 1707 (the Hoei eruption, December 1707)
  fuji:{ fact:'Mount Fuji is Japan\'s highest mountain, a volcano 3,776 m high. It last erupted in 1707.',
    readout:'summit 3,776 m', aka:'fuji fujisan fujiyama japan volcano honshu suruga bay',
    views:[ v([35.36, 138.73, 2000], 320, 5, 100000, 'the cone over Suruga Bay'), v([35.36, 138.73, 2500], 30, 10, 35000, 'the cone and its lakes'), v([35.3606, 138.7274, 3500], 10, 18, 5500, 'into the summit crater') ] },
  // El Capitan rises about 900 m (3,000 ft) from its base to its summit (National Park Service)
  yosemite:{ fact:'El Capitan, in Yosemite Valley, California, is a granite wall that rises about 900 m from the valley floor to its top. Half Dome rises at the other end of the valley.',
    readout:'El Capitan rises 900 m', aka:'yosemite el capitan half dome california sierra nevada valley yosemite falls glacier point',
    views:[ v([37.745, -119.585, 1800], 75, 8, 60000, 'the valley from the west'), v([37.745, -119.585, 1800], 70, 12, 22000, 'El Capitan and Half Dome'), v([37.74, -119.6, 1700], 45, 8, 5000, 'the face of El Capitan') ] },
  // "paine" means blue in the Tehuelche language, "torres" is towers in Spanish (Wikipedia); a UNESCO biosphere reserve since 1978 (UNESCO)
  torresdelpaine:{ fact:'Torres del Paine National Park is in Chilean Patagonia. Torres means towers in Spanish, and paine means blue in the Tehuelche language.',
    readout:'UNESCO biosphere reserve since 1978', aka:'torres del paine patagonia chile cuernos paine grande grey glacier lake pehoe national park',
    views:[ v([-50.95, -73.0, 1500], 0, 7, 90000, 'the massif from the south'), v([-50.95, -73.0, 1500], 355, 12, 28000, 'the towers and the lakes'), v([-50.97, -73.0, 1800], 0, 10, 12000, 'the Cuernos from the south') ] },
  // Denali 6,190 m (20,310 ft), the height USGS gave in 2015
  denali:{ fact:'Denali, in Alaska, is the highest mountain in North America: 6,190 m above sea level. Its name means the high one in the Koyukon language.',
    readout:'summit 6,190 m', aka:'denali mckinley mount mckinley alaska range alaska',
    views:[ v([63.07, -151.0, 3000], 330, 7, 200000, 'the Alaska Range'), v([63.07, -151.0, 3500], 330, 10, 60000, 'Denali and its glaciers'), v([63.07, -151.0, 5500], 320, 14, 16000, 'close to the summit') ] },
  richat:{ fact:'The Richat Structure in Mauritania is a ring of eroded rock about 40 km across. Early space crews used it as a landmark.',
    readout:'about 40 km across', aka:'richat structure eye of the sahara guelb er richat mauritania adrar desert',
    views:[ v([21.12, -11.4, 400], 0, 35, 120000, 'the eye in the Sahara'), v([21.12, -11.4, 400], 0, 50, 50000, 'the rings'), v([21.12, -11.4, 400], 300, 30, 18000, 'across the rings') ] },
  amazon:{ fact:'Near Manaus in Brazil, the dark Rio Negro meets the pale Solimoes. The two run side by side for about 6 km without mixing, and below the meeting the river is the Amazon.',
    readout:'rivers side by side for about 6 km', aka:'amazon manaus meeting of waters encontro das aguas rio negro solimoes brazil rainforest',
    views:[ v([-3.13, -59.92, 0], 90, 15, 100000, 'down the Amazon'), v([-3.13, -59.92, 0], 60, 25, 25000, 'the two rivers meet'), v([-3.13, -59.92, 0], 0, 35, 12000, 'the line between the waters') ] },
  nile:{ fact:'The Nile Delta in Egypt fans out to about 240 km of Mediterranean coast. It is green farmland in a desert.',
    readout:'about 240 km of coast', aka:'nile delta egypt cairo alexandria mediterranean rosetta damietta',
    views:[ v([30.8, 31.1, 0], 180, 18, 200000, 'the delta from the sea'), v([30.9, 31.15, 0], 200, 30, 110000, 'the fan of green'), v([30.04, 31.24, 0], 180, 25, 25000, 'the Nile at Cairo') ] },
  // Uluru 863 m above sea level, 348 m above the plain (Wikipedia, Parks Australia); most of its mass is below ground
  uluru:{ fact:'Uluru, in Australia\'s Northern Territory, rises 348 m above the plain and is 863 m above sea level. Much of the rock lies underground.',
    readout:'348 m above the plain', aka:'uluru ayers rock kata tjuta olgas northern territory australia',
    views:[ v([-25.34, 131.0, 500], 20, 12, 70000, 'Uluru and Kata Tjuta'), v([-25.345, 131.04, 500], 45, 12, 8000, 'the rock from the south-west'), v([-25.345, 131.037, 700], 120, 14, 4500, 'along the flank') ] },
  // the flooded area swells from about 6,000 to 15,000 km2 (Wikipedia, Okavango Delta)
  okavango:{ fact:'The Okavango Delta in Botswana is a river that ends in the Kalahari sand, not the sea. Its seasonal flood spreads over as much as 15,000 km².',
    readout:'floods up to 15,000 km²', aka:'okavango delta botswana moremi maun flood kalahari inland delta',
    views:[ v([-19.3, 22.8, 1000], 340, 14, 200000, 'the delta from the south'), v([-19.3, 22.8, 1000], 340, 22, 110000, 'the fan of channels'), v([-19.35, 22.75, 950], 10, 35, 15000, 'channels and islands') ] },
  // Big Daddy is about 325 m high (Wikipedia, Sossusvlei)
  sossusvlei:{ fact:'Sossusvlei, in the Namib Desert of Namibia, is a clay pan among red dunes. The dune called Big Daddy is about 325 m high.',
    readout:'dunes up to about 325 m', aka:'sossusvlei namib namibia dune 45 big daddy deadvlei desert naukluft',
    views:[ v([-24.74, 15.3, 800], 270, 8, 120000, 'the dune sea toward the Atlantic'), v([-24.74, 15.3, 800], 300, 15, 30000, 'the long red dunes'), v([-24.76, 15.29, 700], 30, 14, 5000, 'dunes around the pan') ] },
  // over 2,900 reefs and 900 islands over 2,300 km (Wikipedia, Great Barrier Reef; GBRMPA)
  gbr:{ fact:'The Great Barrier Reef off Queensland is made of more than 2,900 reefs and 900 islands along 2,300 km. It is the largest coral reef system on Earth.',
    readout:'2,300 km, over 2,900 reefs', aka:'great barrier reef whitsundays whitehaven beach hill inlet heart reef hardy reef queensland australia coral',
    views:[ v([-20.05, 149.2, 0], 10, 20, 200000, 'reefs along the coast'), v([-20.28, 149.04, 0], 340, 35, 25000, 'the Whitsunday islands'), v([-20.285, 149.045, 0], 340, 25, 7000, 'Hill Inlet and Whitehaven Beach') ] },
  // Kilauea summit 1,247 m, Mauna Kea 4,207 m (USGS)
  hawaii:{ fact:'Kilauea, on the Big Island of Hawaii, is one of the most active volcanoes on Earth. Mauna Kea, on the same island, rises 4,207 m above sea level.',
    readout:'Kilauea 1,247 m, Mauna Kea 4,207 m', aka:'hawaii big island kilauea mauna loa mauna kea volcano halemaumau',
    views:[ v([19.55, -155.5, 1000], 300, 15, 130000, 'the island from the sea'), v([19.45, -155.4, 2000], 0, 12, 70000, 'Mauna Loa and Kilauea'), v([19.4069, -155.2834, 1100], 315, 20, 7000, 'the summit caldera of Kilauea') ] },
  // Hvannadalshnukur 2,110 m, Iceland's highest point (National Land Survey of Iceland)
  iceland:{ fact:'Vatnajokull is the biggest ice cap in Iceland. On its southern edge, the volcano Oraefajokull holds the highest point in the country, Hvannadalshnukur: 2,110 m.',
    readout:'Hvannadalshnukur 2,110 m', aka:'iceland vatnajokull jokulsarlon glacier lagoon hvannadalshnukur skaftafell diamond beach oraefajokull',
    views:[ v([64.2, -17.8, 500], 0, 9, 250000, 'the south coast and the ice cap'), v([64.05, -16.55, 1200], 0, 10, 45000, 'Oraefajokull and the glaciers'), v([64.015, -16.675, 1800], 340, 15, 9000, 'the crater and its glaciers') ] },
  // Sermeq Kujalleq (Jakobshavn Isbrae): about 17 km a year, 46 m a day at its peak, in summer 2012 (Joughin and others, 2014; NASA); UNESCO World Heritage listing 2004
  greenland:{ fact:'Sermeq Kujalleq feeds the Ilulissat Icefjord in Greenland. It is one of the fastest glaciers on Earth: in 2012 it moved up to 46 m a day.',
    readout:'up to 46 m a day', aka:'greenland ilulissat icefjord jakobshavn sermeq kujalleq glacier icebergs disko bay',
    views:[ v([69.2, -50.5, 200], 90, 12, 250000, 'the ice sheet from Disko Bay'), v([69.17, -50.6, 100], 70, 20, 50000, 'the icefjord'), v([69.17, -51.0, 0], 90, 25, 11000, 'icebergs in the fjord') ] },
  // 26 atolls; the lowest country on Earth, an average ground level of 1.5 m above sea level (Wikipedia, Maldives)
  maldives:{ fact:'The Maldives are a chain of 26 coral atolls in the Indian Ocean. It is the lowest country on Earth: the ground is about 1.5 m above sea level on average.',
    readout:'ground 1.5 m above the sea on average', aka:'maldives male atoll indian ocean coral islands hulhumale',
    views:[ v([4.2, 73.4, 0], 0, 40, 160000, 'atolls like rings'), v([4.35, 73.5, 0], 0, 35, 60000, 'North Male Atoll'), v([4.19, 73.51, 0], 0, 25, 6000, 'Male and its airport island') ] },
  // Mount Otemanu 727 m (Wikipedia, Bora Bora)
  borabora:{ fact:'Bora Bora, in French Polynesia, is an extinct volcano inside a lagoon. Its peak, Mount Otemanu, is 727 m high.',
    readout:'Mount Otemanu 727 m', aka:'bora bora french polynesia otemanu lagoon society islands tahiti',
    views:[ v([-16.5, -151.74, 0], 20, 18, 120000, 'the Society Islands'), v([-16.5, -151.74, 0], 20, 25, 25000, 'the island in its lagoon'), v([-16.5, -151.74, 300], 330, 14, 6000, 'Mount Otemanu') ] },
  // "some 1,600 islands and islets" in UNESCO's description of the site, listed in 1994
  halong:{ fact:'Ha Long Bay in Vietnam has about 1,600 limestone islands and islets rising from the sea. UNESCO made it a World Heritage Site in 1994.',
    readout:'about 1,600 islands', aka:'ha long bay halong vietnam limestone karst tonkin',
    views:[ v([20.85, 107.1, 0], 0, 20, 90000, 'the bay and the gulf'), v([20.85, 107.1, 0], 0, 30, 30000, 'a field of islands'), v([20.85, 107.12, 0], 20, 22, 9000, 'among the limestone towers') ] },
  // the fjord is about 15 km long (Wikipedia, Geirangerfjord); World Heritage since 2005 (UNESCO, West Norwegian Fjords)
  geiranger:{ fact:'Geirangerfjord in Norway is a narrow fjord about 15 km long, with waterfalls dropping straight into it. UNESCO listed it in 2005.',
    readout:'fjord about 15 km long', aka:'geirangerfjord geiranger norway fjord seven sisters waterfall unesco',
    views:[ v([62.1, 7.1, 500], 30, 10, 130000, 'the fjords of western Norway'), v([62.1, 7.12, 500], 80, 12, 22000, 'along the fjord'), v([62.1, 7.16, 300], 70, 14, 8000, 'the fjord walls') ] },
  // Palm Jumeirah: begun in 2001 (Wikipedia); 17 fronds on the crown; Burj Khalifa 828 m (Emaar), in the wider layer
  palm:{ fact:'Palm Jumeirah in Dubai is an island built from dredged sand and rock, begun in 2001. From above it is a palm tree with 17 fronds.',
    readout:'17 fronds, built from the sea', aka:'palm jumeirah dubai uae island artificial atlantis marina burj khalifa burj al arab',
    views:[ v([25.11, 55.14, 0], 150, 15, 60000, 'Dubai from the Gulf'), v([25.11, 55.14, 0], 150, 30, 18000, 'the Palm and the Marina'), v([25.112, 55.139, 0], 160, 40, 9000, 'the Palm from above') ] },
  // 82 km long; Gatun Lake is 26 m above sea level (Panama Canal Authority; Wikipedia)
  panama:{ fact:'The Panama Canal is 82 km long. Ships are lifted 26 m up to Gatun Lake in locks, and lowered again on the other side.',
    readout:'82 km long, lakes at 26 m', aka:'panama canal gatun lake miraflores locks culebra cut colon panama city pedro miguel',
    views:[ v([9.15, -79.75, 0], 330, 15, 150000, 'the isthmus from the Pacific'), v([9.1, -79.7, 26], 330, 25, 55000, 'the canal and Gatun Lake'), v([8.997, -79.592, 10], 330, 25, 9000, 'the Miraflores locks') ] },
  // all the walls built over the centuries add up to 21,196 km (State Administration of Cultural Heritage of China, survey published in 2012)
  greatwall:{ fact:'The Great Wall of China is 21,196 km long, counting all the walls built over the centuries (China\'s 2012 survey). Mutianyu is a restored stretch north of Beijing.',
    readout:'21,196 km of walls in all', aka:'great wall of china mutianyu badaling beijing ming',
    views:[ v([40.39, 116.29, 500], 0, 12, 120000, 'the mountains north of Beijing'), v([40.43, 116.57, 700], 20, 18, 20000, 'the wall along the ridges'), v([40.43, 116.57, 700], 0, 16, 3500, 'the wall at Mutianyu') ] },
  // the Great Pyramid: 230.3 m square, about 146.6 m high when built, 138.5 m now; built about 4,500 years ago (Wikipedia, Great Pyramid of Giza)
  giza:{ fact:'The Great Pyramid of Giza was built about 4,500 years ago. It was 146.6 m high when new and is 138.5 m high now.',
    readout:'138.5 m high, 230 m wide at the base', aka:'giza pyramids great pyramid khufu cheops khafre menkaure sphinx cairo egypt',
    views:[ v([29.99, 31.13, 0], 270, 12, 60000, 'the plateau over the Nile'), v([29.9753, 31.1308, 60], 315, 18, 5000, 'the three pyramids'), v([29.9792, 31.1342, 100], 320, 14, 1800, 'the Great Pyramid') ] },
  // 193 km long, opened in 1869 (Suez Canal Authority; Wikipedia)
  suez:{ fact:'The Suez Canal in Egypt joins the Mediterranean and the Red Sea. It is 193 km long and opened in 1869.',
    readout:'193 km long, opened 1869', aka:'suez canal egypt ismailia port said red sea mediterranean great bitter lake',
    views:[ v([30.6, 32.3, 0], 180, 18, 250000, 'the canal across the desert'), v([30.5, 32.3, 0], 200, 25, 60000, 'the lakes of the canal'), v([30.6, 32.28, 0], 180, 22, 12000, 'ships in the canal at Ismailia') ] },
  // the dam is 2,335 m long and 181 m high; 22,500 MW (Wikipedia, Three Gorges Dam; China Three Gorges Corporation)
  threegorges:{ fact:'The Three Gorges Dam on China\'s Yangtze River is 2,335 m long and 181 m high. Its power station is the biggest in the world, at 22,500 MW.',
    readout:'dam 2,335 m long, 181 m high', aka:'three gorges dam yangtze china yichang hydropower reservoir',
    views:[ v([30.82, 111.0, 300], 270, 10, 120000, 'up the Yangtze'), v([30.82, 111.0, 300], 280, 18, 25000, 'the dam and the gorge'), v([30.82, 111.0, 150], 300, 18, 5000, 'the dam wall') ] },
  // 221 m high, 379 m long on the crest (US Bureau of Reclamation); Lake Mead is the largest US reservoir by capacity (Wikipedia)
  hoover:{ fact:'Hoover Dam, on the border of Nevada and Arizona, is 221 m high. Lake Mead behind it is the biggest reservoir in the United States by capacity.',
    readout:'dam 221 m high, 379 m long', aka:'hoover dam lake mead colorado river nevada arizona las vegas black canyon',
    views:[ v([36.0, -114.75, 500], 45, 8, 90000, 'Black Canyon and Lake Mead'), v([36.0156, -114.7378, 300], 45, 14, 12000, 'the canyon and the dam'), v([36.0156, -114.7378, 330], 45, 12, 2500, 'the face of the dam') ] },
  // Erebus 3,794 m, the southernmost active volcano on Earth; the Ross Ice Shelf, the largest in Antarctica, about 500,000 km2, about the size of France (Wikipedia, Mount Erebus and Ross Ice Shelf)
  antarctic:{ fact:'The Ross Ice Shelf is the largest floating ice shelf in Antarctica, about 500,000 km\u00b2. Mount Erebus, on Ross Island at its edge, is the southernmost active volcano on Earth: 3,794 m.',
    readout:'Ross Ice Shelf about 500,000 km\u00b2', aka:'antarctica erebus ross island mcmurdo sound ross ice shelf scott base transantarctic ice shelf',
    views:[ v([-77.7, 167.0, 1000], 330, 12, 220000, 'Ross Island and the Ross Ice Shelf'), v([-77.53, 167.17, 2500], 0, 12, 40000, 'Erebus over the ice'), v([-77.53, 167.17, 3500], 330, 18, 8000, 'the crater of Erebus') ] },
};
for (const P of PLACES) if (TEXT[P.key]) Object.assign(P, TEXT[P.key]);

// ---------------------------------------------------------------- what the data lacks at a few man-made places (each takes the layer's arrays and changes them)
const ringOf = el => el.type === 'way' ? [el.geometry] : (el.members || []).filter(m => m.role === 'outer' && m.geometry).map(m => m.geometry);
// the heights a building is drawn with: its tag, else its levels, else a guess by kind (the launch sites' tool does the same)
function bldHeight(t){ let h = parseFloat(t.height || t['building:height']); const lv = parseFloat(t['building:levels']);
  if (!(h > 0) || h > 1000) h = lv > 0 ? lv*3.4 + 1 : 12; return h; }
// footprints of tall buildings (at least levels or height in the query's own filter) in a layer's box, as heights above the ground, added to elev
async function addTallBuildings(ctx, minLevels, minHeight, key){
  const { L, F, elev, N } = ctx, [lo0, la0, lo1, la1] = bboxLL(L), b = `${la0},${lo0},${la1},${lo1}`;
  const hq = minHeight >= 100 ? `"height"~"^[1-9][0-9][0-9]+($|[^0-9])"` : `"height"~"^([${Math.ceil(minHeight/10)}-9][0-9]|[1-9][0-9][0-9]+)($|[^0-9])"`, lq = `"building:levels"~"^([${Math.floor(minLevels/10)}-9][0-9]|[1-9][0-9][0-9]+)$"`;
  const j = await overpass(`[out:json][timeout:180];(way["building"][${hq}](${b});way["building"][${lq}](${b});relation["building"][${hq}](${b});relation["building"][${lq}](${b}););out geom;`, `${key}_${L.id}_tall`);
  const polys = []; for (const el of j.elements || []){ const h = bldHeight(el.tags || {}); if (h < minHeight) continue; const rings = ringOf(el); if (rings.length) polys.push({ h, rings }); }
  const bh = rasterPolys(F, L, polys), e0 = Float32Array.from(elev), k = Math.max(2, Math.round(80/ctx.m));
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){ const i = y*N + x; if (!(bh[i] > 0)) continue;
    let g = e0[i]; for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]){ const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < N && Y < N) g = Math.min(g, e0[Y*N + X]); }
    elev[i] = Math.max(e0[i], g + bh[i]); }
  return polys.length;
}
const EXTRA = {
  // Dubai: the skyline of the Marina, the Palm's hotels, the Burj Al Arab (the layer 'f13'), and the needles of Downtown beyond (the layer 'r51': Burj Khalifa 828 m)
  async palm(ctx){ if (ctx.L.size > 51200) return {}; return { bld:ctx.L.size > 20000 ? await addTallBuildings(ctx, 40, 150, 'palm') : await addTallBuildings(ctx, 12, 40, 'palm') }; },
  // Dubai Marina towers etc. share the Palm's query; nothing else here
  // The Great Wall at Mutianyu: OpenStreetMap's line of the wall (a ribbon 8 m wide, 7 m high, light stone) over the 6 m layer, where the 30 m heights and 10 m photos lose it
  async greatwall(ctx){
    const { L, F, rgb, elev, water, N } = ctx; if (L.size > 20000) return {};
    const [lo0, la0, lo1, la1] = bboxLL(L), b = `${la0},${lo0},${la1},${lo1}`;
    const j = await overpass(`[out:json][timeout:120];way["historic"="citywalls"](${b});out geom;`, `greatwall_${L.id}`);
    const lines = (j.elements || []).filter(e => e.geometry && e.geometry.length > 1).map(e => e.geometry), mk = rasterLines(F, L, lines, 8);
    let n = 0; for (let i=0;i<N*N;i++) if (mk[i] && !water[i]){ n++; elev[i] += 7; for (let c=0;c<3;c++) rgb[i*3 + c] = Math.round(rgb[i*3 + c]*0.35 + [176, 168, 154][c]*0.65); }
    console.log(`  ${lines.length} wall lines, ${n} px`); return { bld:lines.length };
  },
  // The Giza pyramids: OpenStreetMap's footprints (their outlines and squares on the ground) built up as pyramids with their present heights (Wikipedia): the Great
  // Pyramid (Khufu) 138.5 m, Khafre 136.4 m, Menkaure 61 m; the small queens' pyramids by their OpenStreetMap height tag. Each stands on a flat plateau at its own base
  // level (the 30 m heights smear a pyramid into a hill), blended out over 45 m; the photos keep their colours
  async giza(ctx){
    const { L, F, elev, water, terr, N, m } = ctx; if (L.size > 51200) return {};
    const SPEC = { 4420397:{ n:'Khufu', h:138.5 }, 4420396:{ n:'Khafre', h:136.4 }, 4420398:{ n:'Menkaure', h:61 }, 25416060:{ n:'Menkaure queen a' }, 25416067:{ n:'Menkaure queen b' }, 25416093:{ n:'Menkaure queen c' }, 219797724:{ n:'Khufu queen b' }, 219797726:{ n:'Khufu queen c' } };
    const j = await overpass(`[out:json][timeout:60];way(id:${Object.keys(SPEC).join(',')});out geom;`, 'giza_pyramids');
    const e0 = Float32Array.from(elev); let count = 0;
    for (const el of j.elements || []){
      const sp = SPEC[el.id]; if (!sp || !el.geometry) continue; const H = sp.h || parseFloat(el.tags.height);
      const pts = el.geometry.map(g => llToPlane(F, g.lat, g.lon)).map(([x, y]) => [x, y]); if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      let A = 0, P = 0, cx = 0, cy = 0; for (let i=0;i<pts.length;i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; A += (x1*y2 - x2*y1)/2; P += Math.hypot(x2 - x1, y2 - y1); cx += x1; cy += y1; }
      A = Math.abs(A); cx /= pts.length; cy /= pts.length; const inr = 2*A/P, side = P/pts.length;
      console.log(`  ${sp.n}: ${pts.length} points, about ${Math.sqrt(A).toFixed(0)} m square, height ${H} m`);
      // the base level: the plateau round it, from the heights just outside its corners
      const ring = []; for (let k=0;k<12;k++){ const a = k/12*2*Math.PI, r = side*0.75 + 40, x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r, [la, lo] = planeToLL(F, x, y); ring.push(terr(la, lo)); }
      ring.sort((a, b) => a - b); const base = ring[Math.floor(ring.length/2)];
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), R = 45, x0 = Math.min(...xs) - R, x1 = Math.max(...xs) + R, y0 = Math.min(...ys) - R, y1 = Math.max(...ys) + R;
      const ss = Math.max(1, Math.min(4, Math.round(8/m)));   // (samples per pixel side: a coarse layer averages the pyramid over each pixel)
      for (let py=Math.max(0, Math.floor((L.size/2 - y1)/m)); py<=Math.min(N - 1, Math.ceil((L.size/2 - y0)/m)); py++) for (let px=Math.max(0, Math.floor((x0 + L.size/2)/m)); px<=Math.min(N - 1, Math.ceil((x1 + L.size/2)/m)); px++){
        let hs = 0, dout = 1e9;
        for (let sy=0;sy<ss;sy++) for (let sx=0;sx<ss;sx++){
          const x = ((px + (sx + 0.5)/ss)*m - L.size/2), y = (L.size/2 - (py + (sy + 0.5)/ss)*m);
          let ins = false, dm = 1e9;
          for (let i=0, k=pts.length - 1; i<pts.length; k=i++){ const [xi, yi] = pts[i], [xk, yk] = pts[k]; if ((yi > y) !== (yk > y) && x < (xk - xi)*(y - yi)/(yk - yi) + xi) ins = !ins;
            const dx = xk - xi, dy = yk - yi, t = clampN(((x - xi)*dx + (y - yi)*dy)/(dx*dx + dy*dy), 0, 1); dm = Math.min(dm, Math.hypot(x - xi - t*dx, y - yi - t*dy)); }
          if (ins) hs += H*Math.min(1, dm/inr); else dout = Math.min(dout, dm);
        }
        hs /= ss*ss; const i = py*N + px;
        if (hs > 0 || dout < R){ const w = hs > 0 ? 1 : 1 - clampN(dout/R, 0, 1), mod = base + hs; elev[i] = hs > 0 ? mod : e0[i]*(1 - w*w*(3 - 2*w)) + mod*(w*w*(3 - 2*w)); water[i] = 0; }
      }
      count++;
    }
    return { bld:count };
  },
};

// ---------------------------------------------------------------- build
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
// (what each place built last time: one file per place in tools/cache/earth-places/manifest/, so two runs at once do not overwrite each other; the older single file is read first)
const manDir = path.join(CACHE, 'manifest'); fs.mkdirSync(manDir, { recursive:true });
const man = { made:new Date().toISOString().slice(0, 10), built:{} };
try { Object.assign(man.built, JSON.parse(fs.readFileSync(path.join(CACHE, 'manifest.json'), 'utf8')).built); } catch (e) {}
for (const f of fs.readdirSync(manDir)) if (f.endsWith('.json')) man.built[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(manDir, f), 'utf8'));

// the aerial photos, as they are, set a place's colours: the satellite images round them are brightened to match, channel by channel, by the ratio of the two
// over the same land, with a soft shoulder so bright ground does not clip (the launch sites' tool does the same)
async function placeGain(P, s2cache){
  const L = P.layers.find(l => l.src === 'naip'); if (!L) return null;
  const F = frameAt(L.la, L.lo), N = L.px, m = L.size/N, s2 = await getS2(P, L, s2cache), naip = await naipSource(L), terr = await getTerr(L);
  const A = [0, 0, 0], B = [0, 0, 0]; let n = 0;
  for (let y=0;y<N;y+=8) for (let x=0;x<N;x+=8){ const [la, lo] = planeToLL(F, (x + 0.5)*m - L.size/2, L.size/2 - (y + 0.5)*m), a = naip(la, lo), b = s2(la, lo);
    if (a && b && terr(la, lo) > 0.3){ for (let k=0;k<3;k++){ A[k] += a[k]; B[k] += b[k]; } n++; } }
  if (n < 200) return null;
  const g = [0, 1, 2].map(k => clampN(A[k]/Math.max(B[k], 1), 0.6, 1.9));
  console.log(`${P.key}: satellite images x ${g.map(v => v.toFixed(2)).join(', ')} to match the aerial photos`);
  const knee = c => c < 200 ? c : 200 + 55*(1 - Math.exp(-(c - 200)/55));
  return v => v.map((c, k) => k < 3 ? knee(c*g[k]) : c);
}
const getS2 = async (P, L, cache) => { const k = P.key + L.id + (L.wins || P.wins).join(); return cache[k] || (cache[k] = await s2Source(L, { wins:L.wins || P.wins, mask:L.mask ?? P.mask, cloud:L.cloud ?? P.cloud, maxPer:L.maxPer ?? P.maxPer, tiles:L.tiles ?? P.tiles, feather:L.feather ?? P.feather, gamma:L.gamma ?? P.gamma, tone:L.tone ?? P.tone, tries:L.tries ?? P.tries, wcloud:L.wcloud ?? P.wcloud, median:L.median ?? P.median, medianP:L.medianP ?? P.medianP })); };
const getTerr = L => (L.terr === 'terrarium' ? terrainSource(L) : L.terr === '3dep' ? depSource(L) : copSource(L));

// the highest pixel of a layer, as lat, lon (to check a layer is centred where its place says)
function peakOf(F, L, elev, water){
  let b = -1e9, bi = 0; for (let i=0;i<elev.length;i++) if (!water[i] && elev[i] > b){ b = elev[i]; bi = i; }
  if (b < -1e8) return null;   // (all water: a reef under the sea)
  const N = L.px, m = L.size/N, x = bi % N, y = Math.floor(bi/N), [la, lo] = planeToLL(F, (x + 0.5)*m - L.size/2, L.size/2 - (y + 0.5)*m);
  return { la:+la.toFixed(4), lo:+lo.toFixed(4), h:Math.round(b) };
}
async function buildLayer(P, L, ctx){
  const F = frameAt(L.la, L.lo), N = L.px, m = L.size/N;
  process.stdout.write(`${P.key}-${L.id} (${(L.size/1000).toFixed(1)} km, ${m.toFixed(2)} m/px): `);
  const t0 = Date.now();
  const s2 = await getS2(P, L, ctx.s2cache), naip = L.src === 'naip' ? await naipSource(L) : null, terr = await getTerr(L);
  const rgb = new Uint8Array(N*N*3), elev = new Float32Array(N*N), water = new Uint8Array(N*N), gain = ctx.gain;
  let naipN = 0, s2N = 0, missN = 0;
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const px = (x + 0.5)*m - L.size/2, py = L.size/2 - (y + 0.5)*m, [la, lo] = planeToLL(F, px, py), i = y*N + x, t = terr(la, lo);
    let v = naip ? naip(la, lo) : null, sw = 0;
    if (v) naipN++;
    else { const q = s2(la, lo); if (q){ v = [q[0], q[1], q[2]]; sw = q[3]; s2N++; if (gain) v = gain(v); } }
    // water: the heights say sea level (default), or Sentinel-2's water pixels below wscl m (wmode 'scl': only those; canals and atolls and a delta's coast)
    water[i] = L.wmode === 'scl' ? (sw > 0.5 && t < (L.wscl ?? 4) ? 1 : 0) : (t <= 0.2 || (L.wscl && sw > 0.5 && t < L.wscl) ? 1 : 0);
    if (!v){ missN++; v = water[i] ? [14, 36, 58] : [96, 92, 78]; }   // (no image: the sea, or plain ground)
    rgb[i*3] = clampN(Math.round(v[0]), 0, 255); rgb[i*3 + 1] = clampN(Math.round(v[1]), 0, 255); rgb[i*3 + 2] = clampN(Math.round(v[2]), 0, 255);
    elev[i] = water[i] ? 0 : Math.max(t, 0);
  }
  // The open sea: Sentinel-2 only images the coast, and where a pass has sun glint or haze over the water its tile shows as a pale square on the dark sea.
  // On the wide layers of places with a lot of open sea (`dehaze`), grey and bright water (little green over red: a reef is green-blue) is drawn back toward the deep water's own colour (the darkest quarter
  // of the water in the layer); turquoise reefs and lagoons, which are saturated, stay as they are, and the water no image reaches takes that colour too.
  if (P.dehaze && L.size >= 100000){
    const samples = []; for (let i=0;i<N*N;i+=7) if (water[i] && !(rgb[i*3] === 14 && rgb[i*3 + 1] === 36 && rgb[i*3 + 2] === 58)) samples.push([rgb[i*3]*0.3 + rgb[i*3 + 1]*0.59 + rgb[i*3 + 2]*0.11, i]);
    if (samples.length > 500){
      samples.sort((a, b) => a[0] - b[0]); const dark = samples.slice(0, Math.floor(samples.length/4)), B = [0, 1, 2].map(c => dark.reduce((s, [, i]) => s + rgb[i*3 + c], 0)/dark.length), lumB = B[0]*0.3 + B[1]*0.59 + B[2]*0.11;
      for (let i=0;i<N*N;i++) if (water[i]){
        const r = rgb[i*3], g = rgb[i*3 + 1], b = rgb[i*3 + 2], lum = r*0.3 + g*0.59 + b*0.11, mx = Math.max(r, g, b), sat = mx > 0 ? (mx - Math.min(r, g, b))/mx : 0;
        // (bright grey water: toward the deep colour; and the deep water itself loses most of its tile-to-tile differences, which show as pale squares)
        const kg = clampN((lum - lumB - 4)/25, 0, 1)*(1 - clampN((g - r - 25)/35, 0, 1)), kd = (1 - clampN((lum - lumB - 3)/18, 0, 1))*0.75;
        const k = r === 14 && g === 36 && b === 58 ? 1 : Math.max(kg, kd);
        if (k > 0){ rgb[i*3] = Math.round(r + (B[0] - r)*k); rgb[i*3 + 1] = Math.round(g + (B[1] - g)*k); rgb[i*3 + 2] = Math.round(b + (B[2] - b)*k); }
      }
      console.log(`  open sea drawn toward ${B.map(v => v.toFixed(0)).join(', ')}`);
    }
  }
  const extra = EXTRA[P.key] ? await EXTRA[P.key]({ P, L, F, rgb, elev, water, terr, N, m }) || {} : {};
  const pk = peakOf(F, L, elev, water);
  const enc = await encodeLayer(P.key, L, rgb, elev, water, { quality:L.q ?? P.q ?? 76 });
  const prev = await previewLayer(L, enc);
  fs.mkdirSync(path.join(PREVIEW, 'parts'), { recursive:true });
  fs.writeFileSync(path.join(PREVIEW, 'parts', `${P.key}-${L.id}.c.png`), prev[0]); fs.writeFileSync(path.join(PREVIEW, 'parts', `${P.key}-${L.id}.s.png`), prev[1]);
  const srcs = [naipN ? 'naip' : null, s2N ? 's2' : null].filter(Boolean);
  console.log(` ${(enc.bytes/1024).toFixed(0)} KB, ${Math.round(100*naipN/(N*N))}% aerial photo, ${Math.round(100*s2N/(N*N))}% Sentinel-2 (${s2.scenes} scenes, ${s2.tiles} tiles), ${missN ? Math.round(100*missN/(N*N)) + '% no image, ' : ''}ground ${enc.base} to ${enc.top} m in ${enc.step} m steps, ${pk ? `highest ${pk.h} m at ${pk.la}, ${pk.lo}, ` : "all water, "}${((Date.now() - t0)/1000).toFixed(0)} s`);
  return { id:L.id, file:enc.file, la:L.la, lo:L.lo, size:L.size, px:N, base:enc.base, step:enc.step, top:enc.top, src:srcs, s2dates:s2N ? s2.dates : [], naip:naipN > 0, photos:naipN ? ['USGS NAIP aerial photos'] : [], terr:terr.src, bld:extra.bld || 0, peak:pk, bytes:enc.bytes };
}
async function sheetOf(P){
  const ls = P.layers.slice().sort((a, b) => b.size - a.size), parts = [];
  for (const L of ls){ const c = path.join(PREVIEW, 'parts', `${P.key}-${L.id}.c.png`), s = path.join(PREVIEW, 'parts', `${P.key}-${L.id}.s.png`); if (fs.existsSync(c) && fs.existsSync(s)) parts.push([fs.readFileSync(c), fs.readFileSync(s)]); }
  if (parts.length) await previewSheet(P.key, parts, parts.length > 3 ? 384 : 480);
}

// ---------------------------------------------------------------- main: node tools/earth-places.mjs [place[:layer] ...]
for (const P of PLACES){
  const want = only.filter(a => a.split(':')[0] === P.key); if (process.argv.includes('--manifest') || (only.length && !want.length)) continue;
  const lay = want.map(a => a.split(':')[1]).filter(Boolean);
  for (const L of P.layers){ L.px = L.px || 1024; L.src = L.src || 's2'; L.terr = L.terr || P.terr || 'cop'; }
  const ctx = { s2cache:{}, gain:null };
  ctx.gain = await placeGain(P, ctx.s2cache);
  const prev = (man.built[P.key] && man.built[P.key].layers) || [], got = {};
  for (const L of P.layers.slice().sort((a, b) => b.size - a.size)){ if (lay.length && !lay.includes(L.id)) continue; got[L.id] = await buildLayer(P, L, ctx); }
  // (layers not rebuilt now keep their last entry, if their shape is unchanged)
  const layers = P.layers.map(L => got[L.id] || prev.find(p => p.id === L.id && p.size === L.size)).filter(Boolean).sort((a, b) => a.size - b.size);
  await sheetOf(P);
  man.built[P.key] = { layers, top:Math.max(...layers.filter(l => l.size <= 204800).map(l => l.top)), made:man.made };
  fs.writeFileSync(path.join(manDir, P.key + '.json'), JSON.stringify(man.built[P.key]));
}

// ---------------------------------------------------------------- the manifest the page reads: src/objects/e8-earth-places-data.js, from every place built so far
const CREDITS = {
  s2:'Contains modified Copernicus Sentinel data',
  cop:'Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA',
  terrarium:'Terrain Tiles on AWS (SRTM, USGS 3DEP, ArcticDEM, and others; registry.opendata.aws/terrain-tiles)',
  '3dep':'USGS 3DEP elevation (public domain)',
  naip:'USGS NAIP aerial photos (public domain)',
  osm:'© OpenStreetMap contributors (ODbL)',
};
// (a layer used a few dozen scene dates; the page needs only the years for its credit, so the first and the last are kept)
const thin = a => a.length <= 2 ? a : [a[0], a[a.length - 1]];
// the credit lines a place needs, as keys of CREDITS: the page joins them (the Sentinel-2 line is followed by the years of the layers' s2dates)
function creditsOf(ls){
  const out = [];
  if (ls.some(l => l.src.includes('s2'))) out.push('s2');
  if (ls.some(l => l.naip)) out.push('naip');
  for (const t of ['cop', '3dep', 'terrarium']) if (ls.some(l => l.terr === t)) out.push(t);
  if (ls.some(l => l.bld)) out.push('osm');
  return out;
}
{
  const places = [], sizes = {};
  for (const P of PLACES){
    const b = man.built[P.key]; if (!b || !b.layers.length) continue;
    const layers = b.layers.map(l => ({ id:l.id, file:l.file, la:l.la, lo:l.lo, size:l.size, px:l.px, base:l.base, step:l.step, top:l.top, src:l.src, s2dates:thin(l.s2dates), naip:l.naip, terr:l.terr, bld:l.bld, peak:l.peak ? [l.peak.la, l.peak.lo, l.peak.h] : null }));
    places.push({ key:P.key, name:P.name, group:P.group, la:P.la, lo:P.lo, top:Math.max(...layers.filter(l => l.size <= 204800).map(l => l.top)), fact:P.fact, readout:P.readout, aka:P.aka, views:P.views, credits:creditsOf(layers), layers });
    sizes[P.key] = b.layers.map(l => [l.id, l.bytes]);
  }
  const data = { made:man.made, credits:CREDITS, places };
  const js = `// generated by tools/earth-places.mjs on ${man.made}: do not edit by hand. The ground layers of the iconic places (phase 3 of the real Earth, docs/EARTH_PLAN.md).
// Each place has 2 to 4 layers, each assets/earth/places/<file> (served as earth/places/<file>), a square <size> m across centred on <la, lo> in the orthographic
// projection of a 6,371 km sphere (x east, y north); RGB is the ground, alpha 1 water, else 2 + (height above sea level - base)/step (the same as EARTH_DETAIL's).
// A place's top is the highest ground (m) in any of its layers up to 205 km across (the height a ray march should start from); a layer's peak is its highest
// pixel [lat, lon, m]. src says what colours it ('s2' Sentinel-2, 'naip' aerial photos), terr what heights it has ('cop' Copernicus DEM GLO-30, '3dep', 'terrarium'),
// bld how many OpenStreetMap buildings, wall lines or pyramid footprints were added. A place's credits are keys of the top-level credits: the lines the page must show while
// the ground is on the screen (the s2 line is followed by the years in the layers' s2dates, first and last).
// views: look is [lat, lon, height m]; az the direction the camera looks toward (degrees from north), tilt how far it looks down (degrees below the horizon),
// dist the camera's distance from the look point (m).
const EARTH_PLACES = ${'{'}"made":${JSON.stringify(data.made)},"credits":${JSON.stringify(CREDITS)},"places":[
${places.map(p => JSON.stringify(p)).join(',\n')}
]${'}'};
`;
  fs.writeFileSync(path.join(ROOT, 'src', 'objects', 'e8-earth-places-data.js'), js);
  const tot = Object.values(sizes).reduce((a, ls) => a + ls.reduce((s, [, n]) => s + n, 0), 0);
  fs.writeFileSync(path.join(CACHE, 'sizes.json'), JSON.stringify(sizes, null, 1));
  console.log(`manifest: src/objects/e8-earth-places-data.js, ${places.length} places, ${(tot/1048576).toFixed(1)} MB of layers`);
}

