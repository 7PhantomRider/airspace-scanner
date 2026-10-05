"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import type { MapLayer, MapSource } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import type { Aircraft } from "@/lib/opensky";

if (typeof window !== "undefined") {
  setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);
}

const EPWR = { latitude: 51.1027, longitude: 16.8858 };
const REFRESH_INTERVAL = 15_000;
const EARTH_RADIUS_KM = 6371;

const STREAMS = {
  TOWER: "https://s1.liveatc.net/epwr_twr",
  APPROACH: "https://s1.liveatc.net/epwr_app",
};

function toRadians(value: number) { return (value * Math.PI) / 180; }
function toDegrees(value: number) { return (value * 180) / Math.PI; }

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function bearingTo(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const dLon = toRadians(toLon - fromLon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function headingDifference(a: number, b: number) {
  let diff = Math.abs(a - b);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function calculateEtaMinutes(aircraft: Aircraft) {
  if (aircraft.velocity == null || aircraft.velocity < 40 || aircraft.heading == null || aircraft.onGround) return null;
  const distance = distanceKm(aircraft.latitude, aircraft.longitude, EPWR.latitude, EPWR.longitude);
  const targetBearing = bearingTo(aircraft.latitude, aircraft.longitude, EPWR.latitude, EPWR.longitude);
  if (headingDifference(aircraft.heading, targetBearing) > 45) return null;
  const speedKmH = aircraft.velocity * 3.6;
  if (speedKmH <= 0) return null;
  return Math.max(1, Math.round((distance / speedKmH) * 60));
}

function calculatePriority(aircraft: Aircraft): { score: number, tier: string, tags: string[] } {
  let score = 0;
  let tier = "C";
  const tags: string[] = [];
  const cs = aircraft.callsign?.trim().toUpperCase() || "";

  if (/^(PLF|RCH|IAM|BART|CFC|HAF|NATO|DUKE|FORCE)/.test(cs)) {
    score += 80; tags.push("MIL/GOV");
  } else if (/^(ADB|VDA|CKS|GTI|NCA)/.test(cs)) {
    score += 60; tags.push("HEAVY");
  } else if (/^(UAE|QTR|SIA)/.test(cs)) {
    score += 40; tags.push("WIDEBODY");
  }

  if (aircraft.altitude && aircraft.altitude < 10000 && !aircraft.onGround) score += 15;
  if (aircraft.velocity && aircraft.velocity > 250) score += 5;
  
  if (score >= 80) tier = "S";
  else if (score >= 55) tier = "A";
  else if (score >= 35) tier = "B";

  return { score, tier, tags };
}

const rwy1129Source: MapSource = {
  type: "geojson",
  data: {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [16.8660, 51.1060], // THR 11
        [16.9040, 51.0980]  // THR 29
      ]
    }
  }
};

const rwyLayer: MapLayer = {
  id: "epwr-rwy",
  type: "line",
  source: "epwr-rwy",
  paint: { "line-color": "#ffffff", "line-width": 3, "line-opacity": 0.8 }
};

const rwyCenterlineLayer: MapLayer = {
  id: "epwr-rwy-center",
  type: "line",
  source: "epwr-rwy",
  paint: { "line-color": "#ef233c", "line-width": 1, "line-dasharray": [4, 4] }
};

const citiesSource: MapSource = {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { name: "WARSZAWA" }, geometry: { type: "Point", coordinates: [21.0122, 52.2297] } },
      { type: "Feature", properties: { name: "KRAKÓW" }, geometry: { type: "Point", coordinates: [19.9450, 50.0647] } },
      { type: "Feature", properties: { name: "POZNAŃ" }, geometry: { type: "Point", coordinates: [16.9252, 52.4064] } },
      { type: "Feature", properties: { name: "BERLIN" }, geometry: { type: "Point", coordinates: [13.4050, 52.5200] } },
      { type: "Feature", properties: { name: "PRAGUE" }, geometry: { type: "Point", coordinates: [14.4378, 50.0755] } }
    ]
  }
};

const citiesLayer: MapLayer = {
  id: "regional-cities",
  type: "symbol",
  source: "cities",
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Open Sans Regular"],
    "text-size": 8,
    "text-letter-spacing": 0.2,
    "text-offset": [0, 1]
  },
  paint: { "text-color": "#555555", "text-halo-color": "#050505", "text-halo-width": 2 }
};

const citiesDotLayer: MapLayer = {
  id: "regional-cities-dots",
  type: "circle",
  source: "cities",
  paint: { "circle-radius": 1.5, "circle-color": "#555555" }
};

function createCircle(lat: number, lon: number, radiusKm: number, points = 64) {
  const coords: [number, number][] = [];
  const rLat = toRadians(lat);
  const angDist = radiusKm / EARTH_RADIUS_KM;
  for (let i = 0; i <= points; i++) {
    const bearing = (2 * Math.PI * i) / points;
    const lat2 = Math.asin(Math.sin(rLat) * Math.cos(angDist) + Math.cos(rLat) * Math.sin(angDist) * Math.cos(bearing));
    const lon2 = toRadians(lon) + Math.atan2(Math.sin(bearing) * Math.sin(angDist) * Math.cos(rLat), Math.cos(angDist) - Math.sin(rLat) * Math.sin(lat2));
    coords.push([toDegrees(lon2), toDegrees(lat2)]);
  }
  return coords;
}

const rangeRings: MapSource = {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [25, 50, 100, 150].map((radius) => ({
      type: "Feature" as const,
      properties: { radius },
      geometry: { type: "LineString" as const, coordinates: createCircle(EPWR.latitude, EPWR.longitude, radius) },
    })),
  },
};

const rangeRingLayer: MapLayer = {
  id: "range-rings",
  type: "line",
  source: "range-rings",
  paint: {
    "line-color": "#ef233c",
    "line-opacity": ["interpolate", ["linear"], ["get", "radius"], 25, 0.2, 150, 0.05],
    "line-width": 1,
    "line-dasharray": [2, 4],
  },
};

function formatAltitude(value: number | null) {
  if (value == null) return "-----";
  return `${Math.round(value * 3.28084).toLocaleString("en-US")} FT`;
}
function formatSpeed(value: number | null) {
  if (value == null) return "-----";
  return `${Math.round(value * 1.94384)} KT`;
}
function formatVerticalRate(value: number | null) {
  if (value == null) return "-----";
  const feetPerMinute = value * 196.8504;
  if (Math.abs(feetPerMinute) < 20) return "0 FT/M";
  const sign = feetPerMinute > 0 ? "+" : "";
  return `${sign}${Math.round(feetPerMinute).toLocaleString("en-US")} FT/M`;
}
function formatHeading(value: number | null) {
  if (value == null) return "---°";
  return `${Math.round(value).toString().padStart(3, "0")}°`;
}
function formatDistance(value: number) {
  if (value < 10) return `${value.toFixed(1)} KM`;
  return `${Math.round(value)} KM`;
}
function formatEta(value: number | null) {
  if (value == null) return "--:--";
  if (value < 60) return `${value} M`;
  return `${Math.floor(value / 60)}H ${Math.round(value % 60).toString().padStart(2, "0")}M`;
}

function SidebarClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col">
      <div className="font-mono text-3xl font-medium tracking-widest text-white">
        {time.toLocaleTimeString("pl-PL", { hour12: false, timeZone: "Europe/Warsaw" })}
      </div>
      <div className="mt-1 font-mono text-xs tracking-[0.2em] text-neutral-500 uppercase">
        {time.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: '2-digit' })} · LOCAL
      </div>
    </div>
  );
}

function TacticalLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-mono text-xs uppercase tracking-[0.15em] text-neutral-400 ${className}`}>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1.5 pl-3 border-l border-neutral-800/80">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-500">{label}</div>
      <div className="font-mono text-sm tracking-[0.05em] text-neutral-100">{value}</div>
    </div>
  );
}

function AircraftContact({
  aircraft,
  selected,
  onSelect,
}: {
  aircraft: Aircraft;
  selected: boolean;
  onSelect: (aircraft: Aircraft) => void;
}) {
  const heading = aircraft.heading ?? 0;
  const { tier } = calculatePriority(aircraft);
  const isHighPriority = tier === "S" || tier === "A";

  // Czyste, kontrastowe kolory
  const dotColor = selected ? "bg-white" : isHighPriority ? "bg-orange-500" : "bg-neutral-200";
  const textColor = selected 
    ? "text-black bg-white px-1.5 py-0.5 rounded-sm font-bold" 
    : isHighPriority 
      ? "text-orange-400 font-bold" 
      : "text-neutral-200";
  const lineColor = isHighPriority ? "bg-orange-500/60" : "bg-neutral-400/60";

  return (
    <Marker longitude={aircraft.longitude} latitude={aircraft.latitude} anchor="center">
      <button
        type="button"
        onClick={(e) => { 
          e.stopPropagation(); 
          e.preventDefault();
          onSelect(aircraft); 
        }}
        className="group relative flex cursor-pointer flex-col items-center justify-center outline-none"
      >
        {/* Wektor kursu */}
        <div
          className={`pointer-events-none absolute bottom-[10px] left-1/2 h-8 w-px origin-bottom ${lineColor}`}
          style={{ transform: `translateX(-50%) rotate(${heading}deg)` }}
        />
        
        {/* Kropka i opcjonalnie ramka dla wybranego */}
        <div
          className={`relative flex h-5 w-5 items-center justify-center rounded-full ${
            selected ? "border border-white bg-white/20" : "bg-transparent"
          }`}
        >
          <div className={`h-2 w-2 rounded-full shadow-[0_0_6px_rgba(0,0,0,0.8)] ${dotColor}`} />
        </div>
        
        {/* Etykieta - czysty tekst z cieniem (bez ramek) */}
        <div
          className={`mt-0.5 whitespace-nowrap font-mono text-[11px] tracking-[0.1em] drop-shadow-[0_2px_4px_rgba(0,0,0,1)] ${textColor}`}
        >
          {aircraft.callsign ?? aircraft.icao24.toUpperCase()}
        </div>
      </button>
    </Marker>
  );
}

function AircraftDetail({
  aircraft,
  onClose,
}: {
  aircraft: Aircraft;
  onClose: () => void;
}) {
  const distance = distanceKm(aircraft.latitude, aircraft.longitude, EPWR.latitude, EPWR.longitude);
  const targetBearing = bearingTo(aircraft.latitude, aircraft.longitude, EPWR.latitude, EPWR.longitude);
  const eta = calculateEtaMinutes(aircraft);
  const inbound = aircraft.heading != null && headingDifference(aircraft.heading, targetBearing) < 45;

  return (
    <aside className="absolute right-6 top-6 z-20 w-[340px] rounded-lg border border-neutral-800/80 bg-[#050505]/90 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between border-b border-neutral-800/80 px-5 py-4">
        <div>
          <TacticalLabel className="text-white/80">/ SELECTED CONTACT</TacticalLabel>
          <div className="mt-1 font-mono text-xl tracking-[0.1em] text-white">
            {aircraft.callsign ?? "UNKNOWN"}
          </div>
        </div>
        <button onClick={onClose} className="text-xl text-neutral-500 hover:text-white transition-colors">
          ✕
        </button>
      </div>

      <div className="px-5 py-5 space-y-6">
        <div className="flex items-center justify-between rounded-md bg-white/5 p-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.1em] text-neutral-500">EPWR VECTOR</div>
            <div className="mt-1 font-mono text-sm text-neutral-200">{formatHeading(targetBearing)}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[11px] tracking-[0.1em] text-neutral-500">STATUS</div>
            <div className={`mt-1 font-mono text-sm tracking-[0.1em] ${inbound ? "text-red-400 font-medium" : "text-neutral-400"}`}>
              {inbound ? "▲ INBOUND" : "○ PASSING"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-5">
          <Stat label="ICAO24" value={aircraft.icao24.toUpperCase()} />
          <Stat label="ORIGIN" value={aircraft.originCountry ?? "UNKNOWN"} />
          <Stat label="SQUAWK" value={aircraft.squawk ?? "----"} />
          <Stat label="STATE" value={aircraft.onGround ? "GROUND" : "AIRBORNE"} />
        </div>

        <div>
          <TacticalLabel className="mb-4">/ TELEMETRY</TacticalLabel>
          <div className="grid grid-cols-2 gap-y-5">
            <Stat label="ALTITUDE" value={formatAltitude(aircraft.altitude)} />
            <Stat label="SPEED" value={formatSpeed(aircraft.velocity)} />
            <Stat label="HEADING" value={formatHeading(aircraft.heading)} />
            <Stat label="VERT RATE" value={formatVerticalRate(aircraft.verticalRate)} />
            <Stat label="DIST EPWR" value={formatDistance(distance)} />
            <Stat label="ETA EPWR" value={formatEta(eta)} />
          </div>
        </div>
      </div>
    </aside>
  );
}

type WeatherData = {
  windspeed?: number;
  wind_speed?: number;
  winddirection?: number;
  wind_direction?: number;
  temperature: number;
};

export default function Home() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  const [activeRadio, setActiveRadio] = useState<'NONE' | 'TOWER' | 'APPROACH'>('NONE');
  const towerAudioRef = useRef<HTMLAudioElement | null>(null);
  const approachAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isTrafficExpanded, setIsTrafficExpanded] = useState(false);

  useEffect(() => {
    towerAudioRef.current = new Audio(STREAMS.TOWER);
    approachAudioRef.current = new Audio(STREAMS.APPROACH);
    return () => {
      towerAudioRef.current?.pause();
      approachAudioRef.current?.pause();
    }
  }, []);

  const toggleRadio = (channel: 'TOWER' | 'APPROACH') => {
    if (activeRadio === channel) {
      setActiveRadio('NONE');
      towerAudioRef.current?.pause();
      approachAudioRef.current?.pause();
    } else {
      setActiveRadio(channel);
      if (channel === 'TOWER') {
        approachAudioRef.current?.pause();
        towerAudioRef.current?.play().catch(e => console.log("Audio block:", e));
      } else {
        towerAudioRef.current?.pause();
        approachAudioRef.current?.play().catch(e => console.log("Audio block:", e));
      }
    }
  };

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${EPWR.latitude}&longitude=${EPWR.longitude}&current_weather=true`);
        const data = await res.json();
        setWeather(data.current_weather);
      } catch (e) { console.error(e); }
    }
    fetchWeather();
    const wInterval = setInterval(fetchWeather, 600000); 
    return () => clearInterval(wInterval);
  }, []);

  async function fetchAircraft() {
    try {
      const response = await fetch("/api/opensky/states", { cache: "no-store" });
      const data = await response.json();
      setAircraft(data.aircraft ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAircraft();
    const interval = setInterval(fetchAircraft, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAircraft) return;
    const updated = aircraft.find((item) => item.icao24 === selectedAircraft.icao24);
    if (updated) setSelectedAircraft(updated);
    else setSelectedAircraft(null);
  }, [aircraft]);

  const airborne = useMemo(() => aircraft.filter((a) => !a.onGround), [aircraft]);
  
  const inbound = useMemo(() => airborne.filter((item) => {
    if (item.heading == null || item.altitude == null) return false;
    const targetBearing = bearingTo(item.latitude, item.longitude, EPWR.latitude, EPWR.longitude);
    const isHeading = headingDifference(item.heading, targetBearing) < 45;
    const dist = distanceKm(item.latitude, item.longitude, EPWR.latitude, EPWR.longitude);
    return isHeading && dist < 120 && item.altitude < 6000;
  }), [airborne]);

  const sortedTraffic = useMemo(() => {
    return [...airborne].sort((a, b) => {
      const pA = calculatePriority(a);
      const pB = calculatePriority(b);
      if (pA.score !== pB.score) return pB.score - pA.score;
      return distanceKm(a.latitude, a.longitude, EPWR.latitude, EPWR.longitude) - distanceKm(b.latitude, b.longitude, EPWR.latitude, EPWR.longitude);
    });
  }, [airborne]);

  const rwy29Prob = useMemo(() => {
    if (!weather) return 50;
    const windDir = weather.winddirection ?? weather.wind_direction;
    if (windDir == null) return 50;

    const diff290 = headingDifference(windDir, 290);
    const diff110 = headingDifference(windDir, 110);
    const totalDiff = diff290 + diff110;
    if (totalDiff === 0) return 50;
    return Math.round((diff110 / totalDiff) * 100);
  }, [weather]);

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-[#050505] text-neutral-200">
      <header className="flex-none h-14 flex items-center justify-between border-b border-neutral-900 bg-[#050505] px-6 z-10">
        <div className="flex items-center gap-6">
          <div className="font-mono text-sm font-medium tracking-[0.15em] text-white">
            EPWR <span className="text-neutral-600 font-light">/ AIRSPACE CONSOLE</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="font-mono text-xs tracking-[0.1em] text-neutral-500">
            AUTO-REF 15S
          </div>
          <div className="flex items-center gap-2 font-mono text-xs tracking-[0.1em] text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            LIVE FEED
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] h-full overflow-hidden">
        <section className="relative h-full overflow-hidden border-r border-neutral-900">
          <Map
            initialViewState={{ longitude: EPWR.longitude, latitude: EPWR.latitude, zoom: 8.5 }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            reuseMaps
            attributionControl={false}
          >
            <NavigationControl position="bottom-right" showCompass showZoom />
            
            <Source id="range-rings" type="geojson" data={rangeRings.data}><Layer {...rangeRingLayer} /></Source>
            <Source id="epwr-rwy" type="geojson" data={rwy1129Source.data}>
              <Layer {...rwyLayer} />
              <Layer {...rwyCenterlineLayer} />
            </Source>
            <Source id="cities" type="geojson" data={citiesSource.data}>
              <Layer {...citiesDotLayer} />
              <Layer {...citiesLayer} />
            </Source>

            {aircraft.map((item) => (
              <AircraftContact
                key={item.icao24}
                aircraft={item}
                selected={selectedAircraft?.icao24 === item.icao24}
                onSelect={setSelectedAircraft}
              />
            ))}

            <Marker longitude={EPWR.longitude} latitude={EPWR.latitude} anchor="top">
              <div className="mt-3 font-mono text-[10px] tracking-widest text-white bg-black/50 px-1 rounded">EPWR</div>
            </Marker>
          </Map>

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.7)_100%)]" />
            <div className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
                backgroundSize: "60px 60px",
              }}
            />
            <div className="absolute left-10 top-10">
              <div className="font-mono text-xs tracking-[0.1em] text-neutral-400">/ MAP TELEMETRY</div>
              <div className="mt-1 font-mono text-xs tracking-[0.1em] text-neutral-600">EPWR · WROCŁAW</div>
            </div>
            <div className="absolute right-10 top-10 text-right">
              <div className="font-mono text-xs tracking-[0.1em] text-neutral-500">REF</div>
              <div className="mt-1 font-mono text-xs tracking-[0.1em] text-neutral-600">51°06′N / 016°53′E</div>
            </div>
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2">
              <div className="absolute left-1/2 top-0 h-4 w-[1px] -translate-x-1/2 bg-white/30" />
              <div className="absolute bottom-0 left-1/2 h-4 w-[1px] -translate-x-1/2 bg-white/30" />
              <div className="absolute left-0 top-1/2 h-[1px] w-4 -translate-y-1/2 bg-white/30" />
              <div className="absolute right-0 top-1/2 h-[1px] w-4 -translate-y-1/2 bg-white/30" />
              <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/80" />
            </div>
          </div>

          {selectedAircraft && (
            <AircraftDetail aircraft={selectedAircraft} onClose={() => setSelectedAircraft(null)} />
          )}
        </section>

        <aside className="h-full flex flex-col bg-[#050505] overflow-y-auto">
          <section className="p-6 border-b border-neutral-900 flex justify-between items-center">
            <SidebarClock />
            {weather && (
              <div className="text-right">
                <div className="font-mono text-xl text-white">{weather.temperature}°C</div>
                <div className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase mt-1">
                  WIND {weather.winddirection ?? weather.wind_direction ?? '---'}° / {Math.round(weather.windspeed ?? weather.wind_speed ?? 0)} KPH
                </div>
              </div>
            )}
          </section>

          <section className="p-6 border-b border-neutral-900">
            <TacticalLabel className="mb-4">/ COMMS INTERCEPT</TacticalLabel>
            <div className="flex gap-2">
              <button 
                onClick={() => toggleRadio('TOWER')}
                className={`flex-1 py-2.5 font-mono text-xs font-medium tracking-widest transition-colors rounded border ${
                  activeRadio === 'TOWER' ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-500'
                }`}
              >
                {activeRadio === 'TOWER' ? '■ TWR ON' : '▶ TWR (119.25)'}
              </button>
              <button 
                onClick={() => toggleRadio('APPROACH')}
                className={`flex-1 py-2.5 font-mono text-xs font-medium tracking-widest transition-colors rounded border ${
                  activeRadio === 'APPROACH' ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-500'
                }`}
              >
                {activeRadio === 'APPROACH' ? '■ APP ON' : '▶ APP (126.30)'}
              </button>
            </div>
            {activeRadio !== 'NONE' && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex gap-1 h-2">
                  <div className="w-1 bg-green-500 animate-[bounce_1s_infinite]" />
                  <div className="w-1 bg-green-500 animate-[bounce_1.2s_infinite]" />
                  <div className="w-1 bg-green-500 animate-[bounce_0.8s_infinite]" />
                </div>
                <div className="font-mono text-[10px] tracking-widest text-green-500">RX ACTIVE</div>
              </div>
            )}
          </section>

          <section className="p-6 border-b border-neutral-900">
            <div className="flex items-center justify-between mb-4">
              <TacticalLabel>/ INTELLIGENCE & TRACKS</TacticalLabel>
              <div className="font-mono text-xs text-neutral-500">{sortedTraffic.length} TOTAL</div>
            </div>

            <div className="flex flex-col gap-3">
              {sortedTraffic.slice(0, isTrafficExpanded ? 8 : 1).map((item) => {
                const distance = distanceKm(item.latitude, item.longitude, EPWR.latitude, EPWR.longitude);
                const { tier, tags } = calculatePriority(item);
                const isHighVal = tier === 'S' || tier === 'A';

                return (
                  <button
                    key={item.icao24}
                    onClick={() => setSelectedAircraft(item)}
                    className={`group w-full border p-4 text-left transition rounded-md ${
                      isHighVal ? 'border-orange-900/50 bg-orange-950/10 hover:border-orange-500/50' : 'border-neutral-800/80 bg-white/[0.02] hover:border-neutral-500/50 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`font-mono text-sm tracking-[0.1em] font-medium ${isHighVal ? 'text-orange-400' : 'text-white'}`}>
                          {item.callsign ?? item.icao24.toUpperCase()}
                        </div>
                        {tags.length > 0 && (
                          <div className="px-1.5 py-0.5 border border-orange-500/30 bg-orange-500/10 font-mono text-[9px] text-orange-400 rounded">
                            {tags[0]}
                          </div>
                        )}
                      </div>
                      <div className={`font-mono text-xs font-bold ${tier === 'S' ? 'text-red-500' : tier === 'A' ? 'text-orange-400' : 'text-neutral-500'}`}>
                        TIER {tier}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.1em] text-neutral-600">ALT</div>
                        <div className="mt-1 font-mono text-xs text-neutral-300">{formatAltitude(item.altitude)}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.1em] text-neutral-600">DIST</div>
                        <div className="mt-1 font-mono text-xs text-neutral-300">{formatDistance(distance)}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.1em] text-neutral-600">STATE</div>
                        <div className="mt-1 font-mono text-xs text-neutral-400">
                          {item.altitude && item.altitude < 6000 && distance < 100 ? "APPROACH" : "EN ROUTE"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!loading && sortedTraffic.length === 0 && (
                <div className="p-4 border border-dashed border-neutral-800 rounded font-mono text-xs tracking-[0.1em] text-neutral-600 text-center">
                  NO ACTIVE CONTACTS
                </div>
              )}

              {sortedTraffic.length > 1 && (
                <button 
                  onClick={() => setIsTrafficExpanded(!isTrafficExpanded)}
                  className="mt-2 w-full py-2.5 border border-neutral-800 font-mono text-[11px] tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-colors rounded"
                >
                  {isTrafficExpanded ? "- COLLAPSE LIST" : `+ EXPAND (${sortedTraffic.length - 1} MORE)`}
                </button>
              )}
            </div>
          </section>

          <section className="p-6 border-b border-neutral-900">
            <TacticalLabel className="mb-5">/ ACTIVE RWY PREDICTION</TacticalLabel>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between font-mono text-xs tracking-[0.1em]">
                  <span className={rwy29Prob >= 50 ? "text-white font-medium" : "text-neutral-500"}>RWY 29</span>
                  <span className="text-neutral-300">{rwy29Prob}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                  <div className={`h-full ${rwy29Prob >= 50 ? "bg-red-500" : "bg-neutral-600"}`} style={{ width: `${rwy29Prob}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between font-mono text-xs tracking-[0.1em]">
                  <span className={100 - rwy29Prob > 50 ? "text-white font-medium" : "text-neutral-500"}>RWY 11</span>
                  <span className="text-neutral-300">{100 - rwy29Prob}%</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                  <div className={`h-full ${100 - rwy29Prob > 50 ? "bg-red-500" : "bg-neutral-600"}`} style={{ width: `${100 - rwy29Prob}%` }} />
                </div>
              </div>
              <div className="text-[10px] font-mono tracking-widest text-neutral-600 uppercase pt-2">
                * BASED ON WIND VECTOR ({weather?.winddirection ?? weather?.wind_direction ?? '---'}°)
              </div>
            </div>
          </section>

          <section className="p-6 pb-12">
            <TacticalLabel className="mb-5">/ TELEMETRY STATUS</TacticalLabel>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <Stat label="CONTACTS" value={aircraft.length} />
              <Stat label="AIRBORNE" value={airborne.length} />
              <Stat label="INBOUND APP" value={inbound.length} />
              <Stat label="RADAR" value="ONLINE" />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}