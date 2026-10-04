export type Aircraft = {
  icao24: string;
  callsign: string | null;
  originCountry: string | null;

  lastContact: number;
  lastPositionUpdate: number;

  longitude: number;
  latitude: number;

  altitude: number | null;
  onGround: boolean;

  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;

  geoAltitude: number | null;
  squawk: string | null;
};

type OpenSkyState = [
  string,
  string | null,
  string | null,
  number,
  number,
  number | null,
  number | null,
  number | null,
  boolean,
  number | null,
  number | null,
  number | null,
  string | null,
  number | null,
  string | null,
  boolean,
  number | null,
];

export function normalizeAircraft(state: OpenSkyState): Aircraft | null {
  const [
    icao24,
    callsign,
    originCountry,
    lastContact,
    lastPositionUpdate,
    longitude,
    latitude,
    altitude,
    onGround,
    velocity,
    heading,
    verticalRate,
    _baroRate,
    geoAltitude,
    squawk,
  ] = state;

  if (longitude == null || latitude == null) {
    return null;
  }

  return {
    icao24,
    callsign: callsign?.trim() || null,
    originCountry: originCountry || null,

    lastContact,
    lastPositionUpdate,

    longitude,
    latitude,

    altitude,
    onGround,

    velocity,
    heading,
    verticalRate,

    geoAltitude,
    squawk,
  };
}

export function normalizeOpenSkyStates(
  states: OpenSkyState[] = [],
): Aircraft[] {
  return states
    .map(normalizeAircraft)
    .filter((aircraft): aircraft is Aircraft => aircraft !== null);
}