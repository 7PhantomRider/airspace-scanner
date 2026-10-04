"use client";

import { useEffect } from "react";
import maplibregl from "maplibre-gl";

export default function MapLibreWorker() {
  useEffect(() => {
    maplibregl.setWorkerUrl(
      "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl-csp-worker.js"
    );
  }, []);

  return null;
}