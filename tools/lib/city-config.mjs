// The five cities: where their layers are, which photos, which airports. Facts and framings are in city-facts.mjs.
//   la, lo      the city's centre point (the origin of the roads' and lines' coordinates, and where the city's sun, clock and weather are taken)
//   drive       the side the cars drive on
//   photo       the aerial photo source for the 12.8 km and finer layers ('s2' where there is no open aerial photo)
//   layers      square layers (size in m, px) in the launch sites' format; r51 is always Sentinel-2 (matched in colour to the photos)
//   airports    IATA code, the size of the airport's own layer (m, 1,024 px) and an optional centre when the OpenStreetMap one is off
export const CITIES = [
  { key:'newyork', name:'New York', la:40.7580, lo:-73.9855, drive:'right', photo:'fpac', nyc:true,
    layers:[
      { id:'r51', name:'The region', la:40.72, lo:-73.98, size:51200, px:1024, bld:false },
      { id:'r12', name:'Manhattan and the harbour', la:40.745, lo:-73.985, size:12800, px:1536, bld:true },
      { id:'midtown', name:'Midtown', la:40.752, lo:-73.982, size:3200, px:2048, bld:true },
      { id:'fidi', name:'Lower Manhattan', la:40.711, lo:-74.010, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'JFK', size:6400 }, { iata:'LGA', size:3200 }, { iata:'EWR', size:5120 } ] },
  { key:'tokyo', name:'Tokyo', la:35.6812, lo:139.7671, drive:'left', photo:'gsi', bldKm:1.6, seaSkip:/Disney|Splash Mountain|Jungle Cruise|Gondola|Mark Twain|Canoe|Lost River|Mediterranean Harbor|American Waterfront|Venetian|Beaver Brothers|Port Discovery|Explorer/i,   // (the boats and landings of the theme parks)
 thin:[{ la:35.65855, lo:139.74543, r:90 }, { la:35.71007, lo:139.81071, r:110 }],   // (Tokyo Tower and Tokyo Skytree)

    layers:[
      { id:'r51', name:'The region', la:35.64, lo:139.76, size:51200, px:1024, bld:false },
      { id:'r12', name:'Central Tokyo', la:35.67, lo:139.76, size:12800, px:1536, bld:true },
      { id:'chiyoda', name:'Chiyoda and Marunouchi', la:35.6745, lo:139.758, size:3200, px:2048, bld:true },
      { id:'shinjuku', name:'Shinjuku', la:35.690, lo:139.700, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'HND', size:6400 }, { iata:'NRT', size:6400 } ] },
  { key:'dubai', name:'Dubai', la:25.1972, lo:55.2744, drive:'right', photo:'s2',
    layers:[
      { id:'r51', name:'The region', la:25.08, lo:55.18, size:51200, px:1024, bld:false },
      { id:'r12', name:'Dubai', la:25.17, lo:55.24, size:12800, px:1536, bld:true },
      { id:'downtown', name:'Downtown Dubai', la:25.1972, lo:55.2744, size:3200, px:2048, bld:true },
      { id:'marina', name:'Dubai Marina and the Palm', la:25.100, lo:55.140, size:6400, px:1536, bld:true } ],
    airports:[ { iata:'DXB', size:6400 }, { iata:'DWC', size:6400 } ] },
  { key:'london', name:'London', la:51.5074, lo:-0.1278, drive:'left', photo:'s2',
    layers:[
      { id:'r51', name:'The region', la:51.50, lo:-0.15, size:51200, px:1024, bld:false },
      { id:'r12', name:'Central London', la:51.51, lo:-0.09, size:12800, px:1536, bld:true },
      { id:'centre', name:'Westminster and the City', la:51.508, lo:-0.1005, size:6400, px:2048, bld:true },
      { id:'canary', name:'Canary Wharf', la:51.505, lo:-0.022, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'LHR', size:8000 }, { iata:'LGW', size:4800 }, { iata:'LCY', size:3200 }, { iata:'STN', size:4800 }, { iata:'LTN', size:3200 } ] },
  { key:'paris', name:'Paris', la:48.8566, lo:2.3522, drive:'right', photo:'ign', bdtopo:true, thin:[{ la:48.8583, lo:2.2945, r:100 }],   // (the Eiffel Tower: BD TOPO has it as a solid block 286 m tall)

    layers:[
      { id:'r51', name:'The region', la:48.86, lo:2.35, size:51200, px:1024, bld:false },
      { id:'r12', name:'Paris', la:48.865, lo:2.31, size:12800, px:1536, bld:true },
      { id:'cite', name:'Île de la Cité and the Louvre', la:48.8566, lo:2.34, size:3200, px:2048, bld:true },
      { id:'eiffel', name:'The Eiffel Tower', la:48.8584, lo:2.2945, size:3200, px:1536, bld:true },
      { id:'defense', name:'La Défense', la:48.892, lo:2.238, size:3200, px:1536, bld:true } ],
    airports:[ { iata:'CDG', size:9600 }, { iata:'ORY', size:6400 } ] },
];
// airports' known elevations, to check OpenStreetMap's (m above sea level; official figures, aeronautical charts): JFK 4, LGA 6, EWR 5, HND 6, NRT 43, DXB 19, DWC 33, LHR 25, LGW 62, LCY 6, STN 106, LTN 160, CDG 119, ORY 89
export const ELE_CHECK = { JFK:4, LGA:6, EWR:5, HND:6, NRT:43, DXB:19, DWC:33, LHR:25, LGW:62, LCY:6, STN:106, LTN:160, CDG:119, ORY:89 };
