/**
 * WeatherWidget — displays current weather, hourly strip, and 10-day forecast.
 * Used in the Live Dashboard.
 */

import React from 'react';
import {
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  CloudSun, Wind, Droplets, Thermometer,
} from 'lucide-react';
import './WeatherWidget.css';

const ICON_MAP = {
  'sun':             Sun,
  'cloud-sun':       CloudSun,
  'cloud':           Cloud,
  'cloud-rain':      CloudRain,
  'cloud-drizzle':   CloudDrizzle,
  'cloud-snow':      CloudSnow,
  'cloud-lightning':  CloudLightning,
  'cloud-fog':       CloudFog,
  'snowflake':       CloudSnow,
};

function WeatherIcon({ icon, size = 20, color }) {
  const Icon = ICON_MAP[icon] || Cloud;
  return <Icon size={size} color={color} />;
}

// ─── Current Conditions Card ────────────────────────────────────────────────

function CurrentWeather({ data }) {
  if (!data) return null;

  return (
    <div className="ww-current">
      <div className="ww-current-left">
        <WeatherIcon icon={data.icon} size={36} color="#3b82f6" />
        <div>
          <div className="ww-temp">{Math.round(data.temperature || 0)}°F</div>
          <div className="ww-condition">{data.condition || 'Unknown'}</div>
        </div>
      </div>
      <div className="ww-current-right">
        <div className="ww-stat">
          <Droplets size={13} color="var(--info)" />
          <span>{data.humidity ?? '--'}%</span>
        </div>
        <div className="ww-stat">
          <Wind size={13} color="var(--text-muted)" />
          <span>{Math.round(data.windSpeed || 0)} mph</span>
        </div>
      </div>
    </div>
  );
}

// ─── Hourly Forecast Strip ──────────────────────────────────────────────────

function HourlyStrip({ data }) {
  if (!data?.length) return null;

  const nowHour = new Date().getHours();
  const visible = data.filter(h => h.hour >= nowHour).slice(0, 24);
  if (visible.length < 12) visible.push(...data.filter(h => h.hour < nowHour).slice(0, 24 - visible.length));

  return (
    <div className="ww-hourly-scroll">
      <div className="ww-hourly-row">
        {visible.map((h, i) => (
          <div key={i} className={`ww-hour-cell ${i === 0 ? 'ww-hour-cell--now' : ''}`}>
            <span className="ww-hour-label">
              {h.hour === 0 ? '12a' : h.hour < 12 ? `${h.hour}a` : h.hour === 12 ? '12p' : `${h.hour - 12}p`}
            </span>
            <WeatherIcon icon={h.icon} size={16} color="var(--text-secondary)" />
            <span className="ww-hour-temp">{Math.round(h.temperature || 0)}°</span>
            {h.precipitationChance > 20 && (
              <span className="ww-hour-precip">{h.precipitationChance}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 10-Day Forecast ────────────────────────────────────────────────────────

function TenDayForecast({ data }) {
  if (!data?.length) return null;

  return (
    <div className="ww-ten-day-row">
      {data.map((d, i) => (
        <div key={i} className={`ww-day-cell ${i === 0 ? 'ww-day-cell--today' : 'ww-day-cell--default'}`}>
          <span className={`ww-day-name ${i === 0 ? 'ww-day-name--today' : 'ww-day-name--default'}`}>
            {i === 0 ? 'Today' : d.dayName}
          </span>
          <WeatherIcon icon={d.icon} size={18} color="var(--text-secondary)" />
          <div className="ww-day-temps">
            <span className="ww-day-high">{Math.round(d.tempMax || 0)}°</span>
            <span className="ww-day-low">{Math.round(d.tempMin || 0)}°</span>
          </div>
          {d.precipitationChance > 20 && (
            <span className="ww-day-precip">
              <Droplets size={9} className="ww-precip-icon" />{d.precipitationChance}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Historical Day Weather (for past dates) ────────────────────────────────

function HistoricalWeather({ data }) {
  if (!data) return null;

  return (
    <div className="ww-historical">
      <WeatherIcon icon={data.icon || 'cloud'} size={28} color="#d97706" />
      <div>
        <div className="ww-historical-main">
          {data.condition || 'Unknown'} — High {Math.round(data.temperatureMax || 0)}°F / Low {Math.round(data.temperatureMin || 0)}°F
        </div>
        <div className="ww-historical-detail">
          Precip: {(data.precipitationSum || 0).toFixed(1)} in | Wind: {Math.round(data.windSpeedMax || 0)} mph | Humidity: {data.humidity || '--'}%
        </div>
      </div>
    </div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────────

export default function WeatherWidget({ weather, isToday }) {
  if (!weather) return null;

  if (!isToday && weather.historical) {
    return <HistoricalWeather data={weather.historical} />;
  }

  return (
    <div className="ww-root">
      <CurrentWeather data={weather.current} />
      <HourlyStrip data={weather.hourly} />
      <TenDayForecast data={weather.tenDay} />
    </div>
  );
}

export { CurrentWeather, HourlyStrip, TenDayForecast, HistoricalWeather, WeatherIcon };
