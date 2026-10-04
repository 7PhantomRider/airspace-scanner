import { NextResponse } from "next/server";
import { normalizeOpenSkyStates } from "@/lib/opensky";

const EPWR = {
  lat: 51.1107,
  lon: 16.8858,
};

const RADIUS_KM = 150;

function kmToLatDegrees(km: number) {
  return km / 111;
}

function kmToLonDegrees(km: number, lat: number) {
  return km / (111 * Math.cos((lat * Math.PI) / 180));
}

export async function GET() {
  const latDelta = kmToLatDegrees(RADIUS_KM);
  const lonDelta = kmToLonDegrees(RADIUS_KM, EPWR.lat);

  const lamin = EPWR.lat - latDelta;
  const lamax = EPWR.lat + latDelta;
  const lomin = EPWR.lon - lonDelta;
  const lomax = EPWR.lon + lonDelta;

  const url =
    `https://opensky-network.org/api/states/all` +
    `?lamin=${lamin}` +
    `&lomin=${lomin}` +
    `&lamax=${lamax}` +
    `&lomax=${lomax}`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "OpenSky request failed",
          status: response.status,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    const aircraft = normalizeOpenSkyStates(data.states ?? []);

    return NextResponse.json({
      source: "OpenSky",
      timestamp: data.time,
      count: aircraft.length,
      aircraft,
    });
  } catch (error) {
    console.error("OpenSky error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch OpenSky data",
      },
      { status: 500 },
    );
  }
}