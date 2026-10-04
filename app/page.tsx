"use client";

import { useEffect, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, {
  NavigationControl,
  Source,
  Layer,
  Marker,
} from "react-map-gl/maplibre";
import type { MapLayer, MapSource } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Aircraft } from "@/lib/opensky";

setWorkerUrl("/maplibre-gl-worker.mjs");

const EPWR = {
  longitude: 16.8858,
  latitude: 51.1107,
};

const REFRESH_INTERVAL = 15_000;

const rangeRing: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [[
      [16.8858, 52.4600],
      [18.7700, 51.1107],
      [16.8858, 49.7600],
      [15.0000, 51.1107],
      [16.8858, 52.4600],
    ]],
  },
};

const ringSource: MapSource = {
  type: "geojson",
  data: rangeRing,
};

const ringLayer: MapLayer = {
  id: "range-ring",
  type: "line",
  source: "range-ring",
  paint: {
    "line-color": "#737373",
    "line-width": 1,
    "line-opacity": 0.22,
    "line-dasharray": [2, 3],
  },
};

function Clock() {
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Warsaw",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };

    update();

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, []);

  return <span>{time} CEST</span>;
}

function TacticalLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[9px] tracking-[0.25em] text-neutral-500">
      <span className="text-red-500">/</span>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="border-l border-neutral-800 pl-3">
      <div className="text-[8px] tracking-[0.2em] text-neutral-600">
        {label}
      </div>

      <div className="mt-1 font-mono text-sm text-neutral-200">
        {value}

        {unit && (
          <span className="ml-1 text-[9px] text-neutral-600">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function CornerMarks() {
  return (
    <>
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l border-t border-neutral-600" />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r border-t border-neutral-600" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b border-l border-neutral-600" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b border-r border-neutral-600" />
    </>
  );
}

function formatAltitude(meters: number | null) {
  if (meters == null) return "—";

  const feet = Math.round(meters * 3.28084);

  return feet.toLocaleString("en-US");
}

function formatSpeed(metersPerSecond: number | null) {
  if (metersPerSecond == null) return "—";

  const knots = Math.round(metersPerSecond * 1.94384);

  return knots.toString();
}

function AircraftContact({
  aircraft,
}: {
  aircraft: Aircraft;
}) {
  const heading = aircraft.heading ?? 0;

  return (
    <Marker
      longitude={aircraft.longitude}
      latitude={aircraft.latitude}
      anchor="center"
    >
      <div className="relative cursor-crosshair">
        {/* direction vector */}

        <div
          className="absolute left-1/2 top-1/2 h-7 w-px origin-bottom bg-[#ef233c]/50"
          style={{
            transform: `translate(-50%, -100%) rotate(${heading}deg)`,
          }}
        />

        {/* aircraft contact */}

        <div
          className="relative h-3 w-3 rotate-45 border border-[#ef233c] bg-[#050505]"
          title={aircraft.callsign ?? aircraft.icao24}
        />

        {/* label */}

        <div className="absolute left-4 top-[-5px] whitespace-nowrap font-mono text-[8px] tracking-[0.12em] text-[#ef233c]">
          {aircraft.callsign ?? aircraft.icao24.toUpperCase()}
        </div>
      </div>
    </Marker>
  );
}

export default function Home() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAircraft = async () => {
      try {
        const response = await fetch("/api/opensky/states", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`OpenSky API error: ${response.status}`);
        }

        const data = await response.json();

        if (!mounted) return;

        setAircraft(data.aircraft ?? []);
        setLastUpdate(new Date());
        setLoading(false);
      } catch (error) {
        console.error("Failed to load aircraft:", error);

        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAircraft();

    const interval = setInterval(
      loadAircraft,
      REFRESH_INTERVAL
    );

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const airborne = aircraft.filter(
    (item) => !item.onGround
  );

  const inbound = aircraft.filter((item) => {
    if (item.heading == null) return false;

    const dx = EPWR.longitude - item.longitude;
    const dy = EPWR.latitude - item.latitude;

    const targetBearing =
      (Math.atan2(dx, dy) * 180) / Math.PI + 360;

    const normalizedBearing = targetBearing % 360;

    const difference = Math.abs(
      normalizedBearing - item.heading
    );

    return Math.min(difference, 360 - difference) < 35;
  });

  const altitudes = airborne
    .map((item) => item.altitude)
    .filter((value): value is number => value != null);

  const maxAltitude =
    altitudes.length > 0
      ? Math.round(
          Math.max(...altitudes) * 3.28084
        )
      : 0;

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] font-mono text-neutral-200 selection:bg-[#ef233c] selection:text-black">

      {/* TOP BAR */}

      <header className="flex h-12 items-center justify-between border-b border-neutral-800 bg-[#080808] px-4">

        <div className="flex items-center gap-4">

          <div className="flex items-center gap-2">

            <span className="h-2 w-2 animate-pulse bg-[#ef233c]" />

            <span className="text-xs font-bold tracking-[0.22em]">
              EPWR // AIRSPACE CONSOLE
            </span>

          </div>

          <span className="hidden text-[9px] tracking-[0.18em] text-neutral-600 md:block">
            TACTICAL TELEMETRY / ADS-B
          </span>

        </div>

        <div className="flex items-center gap-5 text-[9px] tracking-[0.15em]">

          <span className="text-neutral-600">
            AUTO-REF 15S
          </span>

          <span className="text-green-500">
            ● LIVE
          </span>

          <span className="text-neutral-400">
            <Clock />
          </span>

        </div>

      </header>

      {/* MAIN GRID */}

      <div className="grid h-[calc(100vh-48px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* MAP */}

        <section className="relative min-h-[600px] border-r border-neutral-800">

          <Map
            initialViewState={{
              longitude: EPWR.longitude,
              latitude: EPWR.latitude,
              zoom: 8.1,
            }}
            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
            attributionControl={false}
          >

            <NavigationControl
              position="bottom-right"
              showCompass
              showZoom
            />

            <Source
              id="range-ring"
              {...ringSource}
            />

            <Layer {...ringLayer} />

            {/* REAL AIRCRAFT */}

            {aircraft.map((item) => (
              <AircraftContact
                key={item.icao24}
                aircraft={item}
              />
            ))}

          </Map>

          {/* MAP OVERLAY */}

          <div className="pointer-events-none absolute inset-0">

            {/* GRID */}

            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)",
                backgroundSize: "80px 80px",
              }}
            />

            {/* VIGNETTE */}

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.5)_100%)]" />

            {/* CENTER CROSS */}

            <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2">

              <div className="absolute left-1/2 top-0 h-4 w-px bg-neutral-500/50" />

              <div className="absolute bottom-0 left-1/2 h-4 w-px bg-neutral-500/50" />

              <div className="absolute left-0 top-1/2 h-px w-4 bg-neutral-500/50" />

              <div className="absolute right-0 top-1/2 h-px w-4 bg-neutral-500/50" />

              <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 bg-[#ef233c]" />

            </div>

          </div>

          {/* MAP HEADER */}

          <div className="absolute left-4 top-4 w-[250px] border border-neutral-700 bg-[#050505]/90 p-3 backdrop-blur-sm">

            <CornerMarks />

            <TacticalLabel>
              AIRSPACE MONITOR
            </TacticalLabel>

            <div className="flex items-end justify-between">

              <div>

                <div className="text-2xl tracking-[0.15em]">
                  EPWR
                </div>

                <div className="mt-1 text-[9px] tracking-[0.15em] text-neutral-600">
                  WROCLAW / POLAND
                </div>

              </div>

              <div className="text-right text-[9px] text-neutral-500">
                <div>51.1107° N</div>
                <div>16.8858° E</div>
              </div>

            </div>

          </div>

          {/* SENSOR RANGE */}

          <div className="absolute bottom-5 left-5 border border-neutral-800 bg-[#050505]/85 px-3 py-2">

            <div className="text-[8px] tracking-[0.2em] text-neutral-600">
              SENSOR RANGE
            </div>

            <div className="mt-1 text-xs tracking-[0.12em]">
              RADIUS{" "}
              <span className="text-[#ef233c]">
                150 KM
              </span>
            </div>

          </div>

          {/* LIVE MAP STATUS */}

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 border border-neutral-800 bg-[#050505]/85 px-3 py-2">

            <div className="text-[8px] tracking-[0.18em] text-neutral-600">
              ADS-B FEED
            </div>

            <div className="mt-1 text-[9px] tracking-[0.12em]">

              {loading ? (
                <span className="text-neutral-500">
                  ACQUIRING...
                </span>
              ) : (
                <span className="text-green-500">
                  ● CONNECTED
                </span>
              )}

            </div>

          </div>

          {/* COORDINATES */}

          <div className="absolute bottom-5 right-5 text-right text-[8px] leading-4 tracking-[0.16em] text-neutral-600">

            <div>
              CONTACTS{" "}
              <span className="text-neutral-400">
                {aircraft.length.toString().padStart(2, "0")}
              </span>
            </div>

            <div>
              LAT 51.1107
            </div>

            <div>
              LON 16.8858
            </div>

            <div>
              ZOOM 08.1
            </div>

          </div>

        </section>

        {/* RIGHT PANEL */}

        <aside className="overflow-y-auto bg-[#070707]">

          {/* TRAFFIC */}

          <section className="border-b border-neutral-800 p-4">

            <TacticalLabel>
              LIVE TRAFFIC
            </TacticalLabel>

            <div className="relative border border-red-900/70 bg-red-950/10 p-3">

              <CornerMarks />

              <div className="flex items-start justify-between">

                <div>

                  <div className="text-xs text-[#ef233c]">
                    ADS-B CONTACTS
                  </div>

                  <div className="mt-1 text-sm">
                    {loading
                      ? "ACQUIRING..."
                      : "AIRSPACE ACTIVE"}
                  </div>

                </div>

                <div className="text-right">

                  <div className="text-lg text-[#ef233c]">
                    {aircraft.length}
                  </div>

                  <div className="text-[7px] text-neutral-600">
                    TRACKS
                  </div>

                </div>

              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">

                <Stat
                  label="AIRBORNE"
                  value={airborne.length.toString()}
                />

                <Stat
                  label="INBOUND"
                  value={inbound.length.toString()}
                />

                <Stat
                  label="MAX ALT"
                  value={
                    maxAltitude
                      ? maxAltitude.toLocaleString("en-US")
                      : "—"
                  }
                  unit="FT"
                />

              </div>

            </div>

          </section>

          {/* CONTACT LIST */}

          <section className="border-b border-neutral-800 p-4">

            <TacticalLabel>
              CONTACT MATRIX
            </TacticalLabel>

            <div className="space-y-1">

              {aircraft.slice(0, 8).map((item) => (

                <div
                  key={item.icao24}
                  className="border border-neutral-800 bg-[#080808] p-2"
                >

                  <div className="flex items-center justify-between">

                    <div className="flex items-center gap-2">

                      <span className="h-1.5 w-1.5 bg-[#ef233c]" />

                      <span className="text-[10px] tracking-[0.08em]">
                        {item.callsign ?? item.icao24.toUpperCase()}
                      </span>

                    </div>

                    <span className="text-[8px] text-neutral-600">
                      {item.originCountry ?? "UNKNOWN"}
                    </span>

                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-[8px]">

                    <div>
                      <div className="text-neutral-600">
                        ALT
                      </div>

                      <div className="mt-0.5 text-neutral-300">
                        {formatAltitude(item.altitude)}
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-600">
                        SPD
                      </div>

                      <div className="mt-0.5 text-neutral-300">
                        {formatSpeed(item.velocity)}
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-600">
                        HDG
                      </div>

                      <div className="mt-0.5 text-neutral-300">
                        {item.heading != null
                          ? Math.round(item.heading)
                          : "—"}
                        °
                      </div>
                    </div>

                  </div>

                </div>

              ))}

            </div>

            {aircraft.length > 8 && (
              <div className="mt-2 text-[8px] tracking-[0.12em] text-neutral-600">
                + {aircraft.length - 8} ADDITIONAL CONTACTS
              </div>
            )}

          </section>

          {/* AIRSPACE STATUS */}

          <section className="border-b border-neutral-800 p-4">

            <TacticalLabel>
              AIRSPACE STATUS
            </TacticalLabel>

            <div className="grid grid-cols-2 gap-px border border-neutral-800 bg-neutral-800">

              <div className="bg-[#080808] p-3">

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  CONTACTS
                </div>

                <div className="mt-2 text-xl">
                  {aircraft.length}
                </div>

              </div>

              <div className="bg-[#080808] p-3">

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  INBOUND
                </div>

                <div className="mt-2 text-xl text-[#ef233c]">
                  {inbound.length
                    .toString()
                    .padStart(2, "0")}
                </div>

              </div>

              <div className="bg-[#080808] p-3">

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  ALT RANGE
                </div>

                <div className="mt-2 text-sm">
                  {altitudes.length
                    ? `0–${Math.round(
                        maxAltitude / 1000
                      )}K FT`
                    : "—"}
                </div>

              </div>

              <div className="bg-[#080808] p-3">

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  UPDATE
                </div>

                <div className="mt-2 text-sm text-green-500">
                  {lastUpdate
                    ? "LIVE"
                    : "WAIT"}
                </div>

              </div>

            </div>

          </section>

          {/* RUNWAY */}

          <section className="border-b border-neutral-800 p-4">

            <TacticalLabel>
              RUNWAY TREND
            </TacticalLabel>

            <div className="space-y-4">

              <div>

                <div className="mb-2 flex justify-between text-[9px]">
                  <span>RWY 29</span>
                  <span className="text-[#ef233c]">
                    78%
                  </span>
                </div>

                <div className="h-1 bg-neutral-900">
                  <div className="h-full w-[78%] bg-[#ef233c]" />
                </div>

              </div>

              <div>

                <div className="mb-2 flex justify-between text-[9px]">
                  <span>RWY 11</span>

                  <span className="text-neutral-500">
                    22%
                  </span>
                </div>

                <div className="h-1 bg-neutral-900">

                  <div className="h-full w-[22%] bg-neutral-600" />

                </div>

              </div>

              <div className="pt-1 text-[8px] tracking-[0.12em] text-neutral-600">
                DERIVED FROM WIND + RECENT TRACKS
              </div>

            </div>

          </section>

          {/* WEATHER PLACEHOLDER */}

          <section className="border-b border-neutral-800 p-4">

            <TacticalLabel>
              EPWR METEOROLOGY
            </TacticalLabel>

            <div className="grid grid-cols-2 gap-4">

              <Stat
                label="TEMP"
                value="—"
                unit="°C"
              />

              <Stat
                label="WIND"
                value="—"
              />

              <Stat
                label="PRESSURE"
                value="—"
                unit="HPA"
              />

              <Stat
                label="VIS"
                value="—"
                unit="KM"
              />

            </div>

          </section>

          {/* RADIO */}

          <section className="p-4">

            <TacticalLabel>
              RADIO MONITOR
            </TacticalLabel>

            <div className="grid grid-cols-2 gap-2">

              <button
                className="
                  border border-neutral-700
                  bg-[#0a0a0a]
                  px-3 py-3
                  text-left
                  transition
                  hover:border-[#ef233c]
                  hover:text-[#ef233c]
                "
              >

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  CHANNEL
                </div>

                <div className="mt-1 text-xs">
                  TOWER
                </div>

                <div className="mt-2 text-[8px] text-neutral-700">
                  OFFLINE
                </div>

              </button>

              <button
                className="
                  border border-neutral-700
                  bg-[#0a0a0a]
                  px-3 py-3
                  text-left
                  transition
                  hover:border-[#ef233c]
                  hover:text-[#ef233c]
                "
              >

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  CHANNEL
                </div>

                <div className="mt-1 text-xs">
                  APPROACH
                </div>

                <div className="mt-2 text-[8px] text-neutral-700">
                  OFFLINE
                </div>

              </button>

            </div>

          </section>

        </aside>

      </div>
    </main>
  );
}