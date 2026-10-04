"use client";

import { useEffect, useState } from "react";
import { setWorkerUrl } from "maplibre-gl";
import Map, {
  NavigationControl,
  Source,
  Layer,
} from "react-map-gl/maplibre";
import type { MapLayer, MapSource } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl("/maplibre-gl-worker.mjs");

const EPWR = {
  longitude: 16.8858,
  latitude: 51.1107,
};

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

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] font-mono text-neutral-200 selection:bg-[#ef233c] selection:text-black">
      {/* bar */}

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
            AUTO-REF
          </span>

          <span className="text-green-500">
            ● LIVE
          </span>

          <span className="text-neutral-400">
            <Clock />
          </span>
        </div>
      </header>

      {/* main grid */}

      <div className="grid h-[calc(100vh-48px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* map */}

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
          </Map>

          {/* overlay but like i might change it */}

          <div className="pointer-events-none absolute inset-0">

            {/* grid */}

            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)",
                backgroundSize: "80px 80px",
              }}
            />

            {/* vignette */}

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.5)_100%)]" />

            {/* center cross */}

            <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2">

              <div className="absolute left-1/2 top-0 h-4 w-px bg-neutral-500/50" />

              <div className="absolute bottom-0 left-1/2 h-4 w-px bg-neutral-500/50" />

              <div className="absolute left-0 top-1/2 h-px w-4 bg-neutral-500/50" />

              <div className="absolute right-0 top-1/2 h-px w-4 bg-neutral-500/50" />

              <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 bg-[#ef233c]" />

            </div>
          </div>

          {/* header of the map */}

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

          {/* sensor range */}

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

          {/* coordinates */}

          <div className="absolute bottom-5 right-5 text-right text-[8px] leading-4 tracking-[0.16em] text-neutral-600">

            <div>LAT 51.1107</div>
            <div>LON 16.8858</div>
            <div>ZOOM 08.1</div>

          </div>

          {/* demo contact 1 */}

          <div className="absolute left-[58%] top-[30%]">

            <div className="relative">

              <div className="h-2 w-2 rotate-45 border border-[#ef233c] bg-[#050505]" />

              <div className="absolute left-3 top-0 whitespace-nowrap text-[8px] tracking-[0.15em] text-[#ef233c]">
                CONTACT / 7F3A
              </div>

            </div>

          </div>

          {/* demo contact 2 */}

          <div className="absolute left-[35%] top-[42%]">

            <div className="relative">

              <div className="h-2 w-2 rotate-45 border border-neutral-400 bg-[#050505]" />

              <div className="absolute left-3 top-0 whitespace-nowrap text-[8px] tracking-[0.15em] text-neutral-500">
                CONTACT / A91C
              </div>

            </div>

          </div>

        </section>

        {/* right panel */}

        <aside className="overflow-y-auto bg-[#070707]">

          {/* traffic scale */}

          <section className="border-b border-neutral-800 p-4">

            <TacticalLabel>
              INTERESTING TRAFFIC
            </TacticalLabel>

            <div className="space-y-2">

              {/* contact 1 */}

              <div className="relative border border-red-900/70 bg-red-950/10 p-3">

                <CornerMarks />

                <div className="flex items-start justify-between">

                  <div>
                    <div className="text-xs text-[#ef233c]">
                      POSSIBLE MILITARY
                    </div>

                    <div className="mt-1 text-sm">
                      UNKNOWN CONTACT
                    </div>
                  </div>

                  <div className="text-right">

                    <div className="text-lg text-[#ef233c]">
                      91
                    </div>

                    <div className="text-[7px] text-neutral-600">
                      VALUE
                    </div>

                  </div>

                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">

                  <Stat
                    label="DIST"
                    value="42.1"
                    unit="KM"
                  />

                  <Stat
                    label="ALT"
                    value="8,400"
                    unit="FT"
                  />

                  <Stat
                    label="HDG"
                    value="287"
                    unit="°"
                  />

                </div>

              </div>

              {/* contact 2 */}

              <div className="border border-neutral-800 p-3">

                <div className="flex items-start justify-between">

                  <div>
                    <div className="text-[9px] text-neutral-500">
                      HEAVY / CARGO
                    </div>

                    <div className="mt-1 text-sm">
                      UNKNOWN HEAVY
                    </div>
                  </div>

                  <div className="text-lg text-neutral-300">
                    84
                  </div>

                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">

                  <Stat
                    label="DIST"
                    value="67.8"
                    unit="KM"
                  />

                  <Stat
                    label="ALT"
                    value="12,200"
                    unit="FT"
                  />

                  <Stat
                    label="HDG"
                    value="104"
                    unit="°"
                  />

                </div>

              </div>

            </div>

          </section>

          {/* status of the airpsace */}

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
                  24
                </div>

              </div>

              <div className="bg-[#080808] p-3">

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  INBOUND
                </div>

                <div className="mt-2 text-xl text-[#ef233c]">
                  07
                </div>

              </div>

              <div className="bg-[#080808] p-3">

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  ALT RANGE
                </div>

                <div className="mt-2 text-sm">
                  0–31K FT
                </div>

              </div>

              <div className="bg-[#080808] p-3">

                <div className="text-[8px] tracking-[0.2em] text-neutral-600">
                  UPDATE
                </div>

                <div className="mt-2 text-sm text-green-500">
                  LIVE
                </div>

              </div>

            </div>

          </section>

          {/* runway trend */}

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

          {/* weather */}

          <section className="border-b border-neutral-800 p-4">

            <TacticalLabel>
              EPWR METEOROLOGY
            </TacticalLabel>

            <div className="grid grid-cols-2 gap-4">

              <Stat
                label="TEMP"
                value="12"
                unit="°C"
              />

              <Stat
                label="WIND"
                value="290"
                unit="° / 12KT"
              />

              <Stat
                label="PRESSURE"
                value="1017"
                unit="HPA"
              />

              <Stat
                label="VIS"
                value="10+"
                unit="KM"
              />

            </div>

          </section>

          {/* radio buttons */}

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