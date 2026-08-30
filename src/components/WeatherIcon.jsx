// Meteocons fill icons by Bas Milius. MIT License — commercial use allowed.
// Copyright notice is kept in src/assets/weather/METEOCONS-LICENSE.txt
import clearDay from '@meteocons/svg/fill/clear-day.svg?url';
import clearNight from '@meteocons/svg/fill/clear-night.svg?url';
import overcast from '@meteocons/svg/fill/overcast.svg?url';
import fog from '@meteocons/svg/fill/fog.svg?url';
import partlyCloudyDay from '@meteocons/svg/fill/partly-cloudy-day.svg?url';
import overcastRain from '@meteocons/svg/fill/overcast-rain.svg?url';
import thunderstormsRain from '@meteocons/svg/fill/thunderstorms-rain.svg?url';
import snow from '@meteocons/svg/fill/snow.svg?url';
import wind from '@meteocons/svg/fill/wind.svg?url';

export const WEATHER_ICON_KINDS = ['sun', 'moon', 'cloud', 'fog', 'partly', 'rain', 'storm', 'snow', 'wind'];

const ICONS = {
  sun: clearDay,
  moon: clearNight,
  cloud: overcast,
  fog,
  partly: partlyCloudyDay,
  rain: overcastRain,
  storm: thunderstormsRain,
  snow,
  wind,
};

export function resolveWeatherKind(name) {
  return name && ICONS[name] ? name : 'partly';
}

export default function WeatherIcon({ name, size = 28, label }) {
  const kind = resolveWeatherKind(name);
  return (
    <img
      className={`feed-weather-meteo feed-weather-meteo--${kind}`}
      src={ICONS[kind]}
      width={size}
      height={size}
      alt={label || ''}
      draggable="false"
    />
  );
}
