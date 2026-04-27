/**
 * Sales Analytics Controller
 * Handles all /api/sales/* routes.
 */

import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/postgres.js';

import {
  getDailySales,
  getWeeklySales,
  getMonthlySales,
  getMonthlySalesComparison,
  getDepartmentSales,
  getDepartmentComparison,
  getTopProducts,
  getProductsGrouped,
  getProductMovement,
  getDailyProductMovement,
  getProduct52WeekStats,
} from '../services/salesService.js';

import {
  holtwinters,
  applyDOWFactors,
  buildPredictionTimeline,
  calculateVelocity,
  computeWeatherImpact,
  applyWeatherToPredictions,
  applyHolidayFactors,
  computeHourlyDistribution,
  breakIntoHourly,
  aggregateToMonthly,
} from '../utils/predictions.js';

import {
  fetchWeatherRange,
  mergeSalesAndWeather,
  aggregateWeatherWeekly,
  aggregateWeatherMonthly,
  aggregateWeatherYearly,
} from '../services/weatherService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toISO = (d: Date): string => d.toISOString().slice(0, 10);
const r2    = (n: unknown): number => Math.round((Number(n) || 0) * 100) / 100;

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
};

const weeksAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return toISO(d);
};

const monthsAgo = (n: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return toISO(d);
};

const today = (): string => toISO(new Date());

// Wide-as-permissive — sales-service typing accepts SalesUserContext which is
// `{ orgId?, [key: string]: unknown }`. The req.user shape satisfies this since
// every controller injects `orgId` via scopeToTenant (or it's undefined for
// unauthenticated routes).
type SalesUser = { orgId?: string | null; [k: string]: unknown };

// req.user has the rich AuthedUser shape but the legacy salesController treats
// it as opaque + reads optional storeLatitude/Longitude/Timezone fields that
// were previously on a flatter "POSUser" object. Cast through unknown to a
// permissive shape that exposes those fields without fighting Prisma's User type.
type WithLatLng = SalesUser & {
  storeLatitude?: number | null;
  storeLongitude?: number | null;
  storeTimezone?: string | null;
};

const userFor = (req: Request): SalesUser => (req.posUser ?? req.user) as unknown as SalesUser;
const userWithLatLng = (req: Request): WithLatLng => (req.user ?? {}) as unknown as WithLatLng;

interface ErrorWithResponse {
  message?: string;
  response?: {
    data?: { message?: string; Message?: string } | unknown;
  };
}

const detailedErrorMessage = (err: unknown): string => {
  const e = err as ErrorWithResponse;
  const data = e.response?.data as { message?: string; Message?: string } | undefined;
  return data?.message || data?.Message || e.message || String(err);
};

// ─── Sales Summary ────────────────────────────────────────────────────────────

export const daily = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || daysAgo(30);
    const to = q.to || today();
    const data = await getDailySales(userFor(req), req.storeId, from, to);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const weekly = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || weeksAgo(12);
    const to = q.to || today();
    const data = await getWeeklySales(userFor(req), req.storeId, from, to);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const monthly = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || monthsAgo(24);
    const to = q.to || today();
    const data = await getMonthlySales(userFor(req), req.storeId, from, to);
    res.json(data);
  } catch (err) {
    console.error('❌ Sales Controller Error [monthly]:', (err as ErrorWithResponse).response?.data || (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch monthly sales data' });
  }
};

export const monthlyComparison = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await getMonthlySalesComparison(userFor(req), req.storeId);
    res.json(data);
  } catch (err) {
    console.error('❌ Sales Controller Error [monthlyComparison]:', (err as ErrorWithResponse).response?.data || (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch monthly comparison data' });
  }
};

// ─── Departments ──────────────────────────────────────────────────────────────

export const departments = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || daysAgo(30);
    const to = q.to || today();
    const data = await getDepartmentSales(userFor(req), req.storeId, from, to);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const departmentComparison = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string; from2?: string; to2?: string };
    const from = q.from || daysAgo(30);
    const to = q.to || today();
    const from2 = q.from2 || daysAgo(60);
    const to2 = q.to2 || daysAgo(31);
    const data = await getDepartmentComparison(userFor(req), req.storeId, from, to, from2, to2);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const topProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // B8 fix: default to today, not yesterday. If today has no data,
    // callers can pass ?date=... explicitly.
    const q = req.query as { date?: string };
    const date = q.date || today();
    const data = await getTopProducts(userFor(req), req.storeId, date);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const productsGrouped = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as {
      from?: string; to?: string; orderBy?: string;
      pageSize?: string; skip?: string;
    };
    const from = q.from || daysAgo(30);
    const to = q.to || today();
    const orderBy = q.orderBy || 'NetSales';
    const pageSize = Number(q.pageSize) || 20;
    const skip = Number(q.skip) || 0;
    const data = await getProductsGrouped(userFor(req), req.storeId, from, to, orderBy, pageSize, skip);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const productMovement = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { upc?: string; dateStart?: string; dateFinish?: string; weekly?: string };
    const upc = q.upc;
    const dateStart = q.dateStart || daysAgo(365);
    const dateFinish = q.dateFinish || today();
    const weekly = q.weekly;
    if (!upc) { res.status(400).json({ error: 'upc is required' }); return; }
    const data = await getProductMovement(userFor(req), req.storeId, upc, dateStart, dateFinish, weekly === 'true');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const dailyProductMovement = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { startDate?: string; endDate?: string };
    const startDate = q.startDate || daysAgo(30);
    const endDate = q.endDate || today();
    const data = await getDailyProductMovement(userFor(req), req.storeId, startDate, endDate);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const product52WeekStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { upc?: string };
    const { upc } = q;
    if (!upc) { res.status(400).json({ error: 'upc is required' }); return; }
    const data = await getProduct52WeekStats(userFor(req), req.storeId, upc);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
};

// ─── Predictions ──────────────────────────────────────────────────────────────

interface SalesEnvelopeRow {
  Date?: string;
  TotalNetSales?: number;
  tempMean?: number | null;
  precipitation?: number | null;
  weatherCode?: number | null;
  [k: string]: unknown;
}

interface SalesEnvelope {
  value?: SalesEnvelopeRow[];
  [k: string]: unknown;
}

export const predictionsDaily = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Number((req.query as { days?: string }).days) || 30;

    // Fetch last 90 days of daily sales history
    const from = daysAgo(90);
    const to = today();
    const rawData = (await getDailySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;
    const series = (rawData.value || []).map((r) => Number(r.TotalNetSales) || 0);

    if (series.length < 7) {
      res.status(422).json({ error: 'Not enough historical data for prediction (need >= 7 days)' });
      return;
    }

    // Run Holt-Winters with weekly seasonality
    const rawForecast = holtwinters(series, 7, 0.3, 0.1, 0.2, days);

    // Apply day-of-week factors
    const startForecastDate = new Date();
    startForecastDate.setDate(startForecastDate.getDate() + 1);
    const adjustedForecast = applyDOWFactors(rawForecast, startForecastDate);

    // Build annotated timeline
    const timeline = buildPredictionTimeline(adjustedForecast, startForecastDate, 'daily');

    // Calculate MAPE on last 14 days if available
    let mape: number | null = null;
    if (series.length >= 14) {
      const last14 = series.slice(-14);
      const validateForecast = holtwinters(series.slice(0, -14), 7, 0.3, 0.1, 0.2, 14) as number[];
      const errors = last14.map((actual: number, i: number) =>
        actual !== 0 ? Math.abs((actual - validateForecast[i]) / actual) : 0,
      );
      mape = Math.round((errors.reduce((a: number, b: number) => a + b, 0) / errors.length) * 10000) / 100;
    }

    res.json({
      forecast: timeline,
      historicalSeries: rawData.value || [],
      mape,
      modelInfo: {
        type: 'Holt-Winters Triple Exponential Smoothing',
        period: 7,
        alpha: 0.3,
        beta: 0.1,
        gamma: 0.2,
        dowFactorsApplied: true,
      },
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

// ─── Residual Analysis ────────────────────────────────────────────────────────
/**
 * GET /api/sales/predictions/residuals
 * Walk-forward validation: for the last N test days, compare Holt-Winters
 * prediction (trained on all prior data) vs actual sales.
 * Returns per-day residuals + MAE, RMSE, MAPE, Bias summary stats.
 */
interface ResidualRow {
  date: string | undefined;
  dayOfWeek: string;
  actual: number;
  predicted: number;
  residual: number;
  pctError: number;
}

export const predictionsResiduals = async (req: Request, res: Response): Promise<void> => {
  try {
    const testDays = Math.min(Number((req.query as { testDays?: string }).testDays) || 30, 60);

    // Fetch enough history: test window + training buffer (min 90 days training)
    const totalDays = testDays + 90;
    const rawData = (await getDailySales(userFor(req), req.storeId, daysAgo(totalDays), today())) as unknown as SalesEnvelope;
    const rows: SalesEnvelopeRow[] = (rawData.value || []).filter((r) => r.Date && r.TotalNetSales != null);

    if (rows.length < testDays + 14) {
      res.status(422).json({
        error: `Not enough data — need at least ${testDays + 14} days of history.`,
      });
      return;
    }

    // Split: training = everything before the last testDays rows
    const trainRows = rows.slice(0, rows.length - testDays);
    const testRows  = rows.slice(-testDays);
    const trainSeries = trainRows.map((r) => Number(r.TotalNetSales) || 0);

    // Predict exactly testDays periods from end of training
    const raw = holtwinters(trainSeries, 7, 0.3, 0.1, 0.2, testDays) as number[];

    // Apply DOW factors — start date = date of first test row
    const startDate = (testRows[0].Date as string);
    const adjusted  = applyDOWFactors(raw, startDate + 'T00:00:00') as number[];

    // Build residuals array
    const residuals: ResidualRow[] = testRows.map((row, i) => {
      const actual    = Number(row.TotalNetSales) || 0;
      const predicted = Math.round(adjusted[i] * 100) / 100;
      const residual  = actual - predicted;                          // + = under-forecast
      const pctError  = actual !== 0 ? (Math.abs(residual) / actual) * 100 : 0;
      return {
        date:      row.Date,
        dayOfWeek: new Date((row.Date as string) + 'T12:00:00')
          .toLocaleDateString('en-US', { weekday: 'short' }),
        actual:    Math.round(actual * 100) / 100,
        predicted,
        residual:  Math.round(residual * 100) / 100,
        pctError:  Math.round(pctError * 100) / 100,
      };
    });

    // Summary statistics
    const n    = residuals.length;
    const mae  = residuals.reduce((s, r) => s + Math.abs(r.residual), 0) / n;
    const mape = residuals.reduce((s, r) => s + r.pctError, 0) / n;
    const rmse = Math.sqrt(residuals.reduce((s, r) => s + r.residual ** 2, 0) / n);
    const bias = residuals.reduce((s, r) => s + r.residual, 0) / n; // + = we under-forecast

    // Error distribution buckets
    const within5  = residuals.filter((r) => r.pctError <= 5).length;
    const within10 = residuals.filter((r) => r.pctError <= 10).length;
    const within15 = residuals.filter((r) => r.pctError <= 15).length;
    const within20 = residuals.filter((r) => r.pctError <= 20).length;

    res.json({
      residuals,
      stats: {
        mae:   Math.round(mae * 100) / 100,
        mape:  Math.round(mape * 100) / 100,
        rmse:  Math.round(rmse * 100) / 100,
        bias:  Math.round(bias * 100) / 100,
        n,
        trainSize: trainRows.length,
        testSize:  testRows.length,
      },
      errorDistribution: {
        within5:  Math.round((within5  / n) * 100),
        within10: Math.round((within10 / n) * 100),
        within15: Math.round((within15 / n) * 100),
        within20: Math.round((within20 / n) * 100),
      },
      modelInfo: { alpha: 0.3, beta: 0.1, gamma: 0.2, period: 7, dowFactorsApplied: true },
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

export const predictionsWeekly = async (req: Request, res: Response): Promise<void> => {
  try {
    const weeks = Number((req.query as { weeks?: string }).weeks) || 12;

    // Fetch last 52 weeks
    const from = weeksAgo(52);
    const to = today();
    const rawData = (await getWeeklySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;
    const series = (rawData.value || []).map((r) => Number(r.TotalNetSales) || 0);

    if (series.length < 8) {
      res.status(422).json({ error: 'Not enough historical data for weekly prediction (need >= 8 weeks)' });
      return;
    }

    const rawForecast = holtwinters(series, 4, 0.3, 0.1, 0.2, weeks);

    const startForecastDate = new Date();
    startForecastDate.setDate(startForecastDate.getDate() + 7);
    const timeline = buildPredictionTimeline(rawForecast, startForecastDate, 'weekly');

    res.json({
      forecast: timeline,
      historicalSeries: rawData.value || [],
      modelInfo: {
        type: 'Holt-Winters Triple Exponential Smoothing',
        period: 4,
        alpha: 0.3,
        beta: 0.1,
        gamma: 0.2,
      },
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

// ─── Enhanced Predictions: Hourly ────────────────────────────────────────────

export const predictionsHourly = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetDate = (req.query as { date?: string }).date || (() => {
      const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
    })();
    const orgId = req.orgId;
    const storeId = req.storeId || null;

    // Get daily prediction for that date first (reuse daily prediction logic)
    const from90 = daysAgo(90);
    const toStr = today();
    const rawData = (await getDailySales(userFor(req), req.storeId, from90, toStr)) as unknown as SalesEnvelope;
    const series = (rawData.value || []).map((r) => Number(r.TotalNetSales) || 0);

    if (series.length < 7) {
      res.status(422).json({ error: 'Not enough data for hourly prediction (need >= 7 days)' });
      return;
    }

    // Predict enough days to cover the target date
    const daysFromNow = Math.max(1, Math.ceil((new Date(targetDate).getTime() - new Date().getTime()) / 86400000) + 1);
    const rawForecast = holtwinters(series, 7, 0.3, 0.1, 0.2, Math.max(daysFromNow, 1)) as number[];
    const startDate = new Date(); startDate.setDate(startDate.getDate() + 1);
    const adjusted = applyDOWFactors(rawForecast, startDate) as number[];
    const dailyPrediction = adjusted[daysFromNow - 1] || adjusted[adjusted.length - 1] || 0;

    // Compute hourly distribution from recent 30 days of transactions
    const txWhere: Prisma.TransactionWhereInput = { orgId: orgId ?? undefined, status: 'complete', createdAt: { gte: new Date(from90 + 'T00:00:00') } };
    if (storeId) txWhere.storeId = storeId;
    const recentTxns = await prisma.transaction.findMany({
      where: txWhere,
      select: { createdAt: true, grandTotal: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const distribution = computeHourlyDistribution(recentTxns);
    const hourly = breakIntoHourly(dailyPrediction, distribution);

    res.json({
      date: targetDate,
      dayOfWeek: new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      dailyPrediction: Math.round(dailyPrediction * 100) / 100,
      hourly,
      distribution,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
};

// ─── Enhanced Predictions: Monthly ───────────────────────────────────────────

export const predictionsMonthly = async (req: Request, res: Response): Promise<void> => {
  try {
    const months = Number((req.query as { months?: string }).months) || 6;
    const daysNeeded = months * 31;

    const from = daysAgo(180);
    const to = today();
    const rawData = (await getDailySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;
    const series = (rawData.value || []).map((r) => Number(r.TotalNetSales) || 0);

    if (series.length < 14) {
      res.status(422).json({ error: 'Not enough data for monthly prediction (need >= 14 days)' });
      return;
    }

    const rawForecast = holtwinters(series, 7, 0.3, 0.1, 0.2, daysNeeded);
    const startDate = new Date(); startDate.setDate(startDate.getDate() + 1);
    const adjusted = applyDOWFactors(rawForecast, startDate);
    let timeline = buildPredictionTimeline(adjusted, startDate, 'daily');
    timeline = applyHolidayFactors(timeline);

    // Weather: try to get 10-day forecast for near-term adjustments
    const store = req.storeId ? await prisma.store.findUnique({ where: { id: req.storeId }, select: { latitude: true, longitude: true, timezone: true } }) : null;
    if (store?.latitude && store?.longitude) {
      try {
        const { getTenDayForecast } = await import('../services/weatherService.js');
        const tenDay = await getTenDayForecast(store.latitude as unknown as number, store.longitude as unknown as number, store.timezone || 'America/New_York');

        // Build sales+weather history for regression
        const salesWithWeather = (rawData.value || []).map((r) => ({
          date: r.Date, sales: Number(r.TotalNetSales) || 0,
          tempMean: r.tempMean ?? null, precipitation: r.precipitation ?? null, weatherCode: r.weatherCode ?? null,
        }));
        const impact = computeWeatherImpact(salesWithWeather as unknown as Parameters<typeof computeWeatherImpact>[0]);
        timeline = applyWeatherToPredictions(timeline, tenDay, impact);
      } catch { /* weather enhancement failed, continue without */ }
    }

    const monthly = aggregateToMonthly(timeline);

    res.json({
      monthly,
      dailyDetail: (timeline as unknown[]).slice(0, 60), // first 60 days detail
      modelInfo: { type: 'Holt-Winters + Weather + Holiday', monthsForecasted: months },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
};

// ─── Enhanced Predictions: Factors (what's influencing each day) ─────────────

interface ForecastEntry {
  date: string;
  forecast?: number;
  factors?: Record<string, unknown>;
  [k: string]: unknown;
}

export const predictionsFactors = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Number((req.query as { days?: string }).days) || 30;
    const from = daysAgo(90);
    const to = today();
    const rawData = (await getDailySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;
    const series = (rawData.value || []).map((r) => Number(r.TotalNetSales) || 0);

    if (series.length < 7) {
      res.status(422).json({ error: 'Not enough data' });
      return;
    }

    const rawForecast = holtwinters(series, 7, 0.3, 0.1, 0.2, days);
    const startDate = new Date(); startDate.setDate(startDate.getDate() + 1);
    const adjusted = applyDOWFactors(rawForecast, startDate);
    let timeline = buildPredictionTimeline(adjusted, startDate, 'daily') as unknown as ForecastEntry[];

    // Add factors
    timeline = timeline.map((p) => ({ ...p, factors: {} }));

    // Day-of-week factors
    const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const DOW_FACTORS = [1.15, 0.90, 0.88, 0.92, 1.00, 1.20, 1.30];
    timeline = timeline.map((p) => {
      const dow = new Date((p.date) + 'T12:00:00').getDay();
      return { ...p, factors: { ...(p.factors || {}), dayOfWeek: { label: DOW_NAMES[dow], impact: DOW_FACTORS[dow] - 1 } } };
    });

    // Holiday factors
    timeline = applyHolidayFactors(timeline) as unknown as ForecastEntry[];

    // Weather factors
    const store = req.storeId ? await prisma.store.findUnique({ where: { id: req.storeId }, select: { latitude: true, longitude: true, timezone: true } }) : null;
    if (store?.latitude && store?.longitude) {
      try {
        const { getTenDayForecast } = await import('../services/weatherService.js');
        const tenDay = await getTenDayForecast(store.latitude as unknown as number, store.longitude as unknown as number, store.timezone || 'America/New_York');

        const salesWithWeather = (rawData.value || []).map((r) => ({
          date: r.Date, sales: Number(r.TotalNetSales) || 0,
          tempMean: r.tempMean ?? null, precipitation: r.precipitation ?? null, weatherCode: r.weatherCode ?? null,
        }));
        const impact = computeWeatherImpact(salesWithWeather as unknown as Parameters<typeof computeWeatherImpact>[0]);
        timeline = applyWeatherToPredictions(timeline, tenDay, impact) as unknown as ForecastEntry[];
      } catch { /* non-fatal */ }
    }

    res.json({ forecast: timeline, days });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
};

// ─── Sales + Weather Combined ────────────────────────────────────────────────

export const dailyWithWeather = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || daysAgo(30);
    const to = q.to || today();
    const salesData = (await getDailySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;
    const salesRows = salesData.value || [];

    // Fetch weather if user has location set
    const u = userWithLatLng(req);
    let weather: unknown[] = [];
    if (u.storeLatitude && u.storeLongitude) {
      weather = await fetchWeatherRange(
        u.storeLatitude,
        u.storeLongitude,
        from,
        to,
        u.storeTimezone || 'America/New_York',
      );
    }

    const merged = mergeSalesAndWeather(salesRows, weather as Parameters<typeof mergeSalesAndWeather>[1]);

    res.json({
      ...salesData,                         // preserves @odata.aggregation + @odata.count
      value: merged,
      weather,
      weatherEnabled: !!(u.storeLatitude && u.storeLongitude),
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

interface WeeklyWeatherBucket {
  weekStart?: string;
  weekEnd?: string;
  avgTempMax?: number | null;
  avgTempMin?: number | null;
  avgTempMean?: number | null;
  totalPrecipitation?: number | null;
  dominantCondition?: string | null;
  dailyBreakdown?: unknown[];
}

export const weeklyWithWeather = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || weeksAgo(12);
    const to = q.to || today();
    const salesData = (await getWeeklySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;

    const u = userWithLatLng(req);
    let weather: unknown[] = [];
    let weeklyWeather: WeeklyWeatherBucket[] = [];
    if (u.storeLatitude && u.storeLongitude) {
      weather = await fetchWeatherRange(
        u.storeLatitude,
        u.storeLongitude,
        from,
        to,
        u.storeTimezone || 'America/New_York',
      );
      weeklyWeather = aggregateWeatherWeekly(weather as Parameters<typeof aggregateWeatherWeekly>[0]) as unknown as WeeklyWeatherBucket[];
    }

    // Merge weekly sales with weekly weather by matching week start dates
    const salesRows = salesData.value || [];
    const mergedRows = salesRows.map((sale) => {
      const saleDate = sale.Date ? sale.Date.slice(0, 10) : '';
      // Find the closest weekly weather bucket
      const ww = weeklyWeather.find((w) => {
        return saleDate >= (w.weekStart || '') && saleDate <= (w.weekEnd || '');
      });
      return {
        ...sale,
        tempHigh:      ww?.avgTempMax    ?? null,
        tempLow:       ww?.avgTempMin    ?? null,
        tempMean:      ww?.avgTempMean   ?? null,
        precipitation: ww?.totalPrecipitation ?? null,
        condition:     ww?.dominantCondition  ?? null,
        weekStart:     ww?.weekStart     ?? null,
        weekEnd:       ww?.weekEnd       ?? null,
        dailyWeather:  ww?.dailyBreakdown ?? [],
      };
    });

    res.json({
      ...salesData,
      value: mergedRows,
      weeklyWeather,
      weatherEnabled: !!(u.storeLatitude && u.storeLongitude),
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

interface MonthlyWeatherBucket {
  month?: string;
  avgTempMax?: number | null;
  avgTempMin?: number | null;
  avgTempMean?: number | null;
  totalPrecipitation?: number | null;
  dominantCondition?: string | null;
}

export const monthlyWithWeather = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || monthsAgo(24);
    const to = q.to || today();
    const salesData = (await getMonthlySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;

    const u = userWithLatLng(req);
    let weather: unknown[] = [];
    let monthlyWeather: MonthlyWeatherBucket[] = [];
    if (u.storeLatitude && u.storeLongitude) {
      weather = await fetchWeatherRange(
        u.storeLatitude,
        u.storeLongitude,
        from,
        to,
        u.storeTimezone || 'America/New_York',
      );
      monthlyWeather = aggregateWeatherMonthly(weather as Parameters<typeof aggregateWeatherMonthly>[0]) as unknown as MonthlyWeatherBucket[];
    }

    const salesRows = salesData.value || [];
    const mergedRows = salesRows.map((sale) => {
      const saleMonth = sale.Date ? sale.Date.slice(0, 7) : '';
      const mw = monthlyWeather.find((m) => m.month === saleMonth);
      return {
        ...sale,
        tempHigh:      mw?.avgTempMax         ?? null,
        tempLow:       mw?.avgTempMin         ?? null,
        tempMean:      mw?.avgTempMean        ?? null,
        precipitation: mw?.totalPrecipitation ?? null,
        condition:     mw?.dominantCondition  ?? null,
      };
    });

    res.json({
      ...salesData,
      value: mergedRows,
      monthlyWeather,
      weatherEnabled: !!(u.storeLatitude && u.storeLongitude),
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

interface YearlyMapEntry {
  Date: string;
  Year: string;
  TotalGrossSales: number;
  TotalNetSales: number;
  TotalTransactionsCount: number;
  TotalDiscounts: number;
  TotalRefunds: number;
  TotalTaxes: number;
  TotalTotalCollected: number;
  monthCount: number;
}

interface YearlyWeatherBucket {
  year?: string;
  avgTempMax?: number | null;
  avgTempMin?: number | null;
  avgTempMean?: number | null;
  totalPrecipitation?: number | null;
  dominantCondition?: string | null;
}

export const yearlyWithWeather = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query as { from?: string; to?: string };
    const from = q.from || monthsAgo(60);
    const to = q.to || today();
    // Use monthly data and aggregate to yearly
    const salesData = (await getMonthlySales(userFor(req), req.storeId, from, to)) as unknown as SalesEnvelope;
    const monthlyRows = salesData.value || [];

    // Aggregate monthly sales into yearly
    const yearlyMap: Record<string, YearlyMapEntry> = {};
    for (const row of monthlyRows) {
      const year = row.Date ? row.Date.slice(0, 4) : '';
      if (!year) continue;
      if (!yearlyMap[year]) {
        yearlyMap[year] = {
          Date: `${year}-01-01`,
          Year: year,
          TotalGrossSales: 0,
          TotalNetSales: 0,
          TotalTransactionsCount: 0,
          TotalDiscounts: 0,
          TotalRefunds: 0,
          TotalTaxes: 0,
          TotalTotalCollected: 0,
          monthCount: 0,
        };
      }
      const y = yearlyMap[year];
      y.TotalGrossSales += Number(row.TotalGrossSales) || 0;
      y.TotalNetSales += Number(row.TotalNetSales) || 0;
      y.TotalTransactionsCount += Number(row.TotalTransactionsCount) || 0;
      y.TotalDiscounts += Number(row.TotalDiscounts) || 0;
      y.TotalRefunds += Number(row.TotalRefunds) || 0;
      y.TotalTaxes += Number(row.TotalTaxes) || 0;
      y.TotalTotalCollected += Number(row.TotalTotalCollected) || 0;
      y.monthCount++;
    }

    const yearlySales = Object.values(yearlyMap).sort((a, b) => a.Year.localeCompare(b.Year));

    // Yearly weather
    const u = userWithLatLng(req);
    let yearlyWeather: YearlyWeatherBucket[] = [];
    if (u.storeLatitude && u.storeLongitude) {
      const weather = await fetchWeatherRange(
        u.storeLatitude,
        u.storeLongitude,
        from,
        to,
        u.storeTimezone || 'America/New_York',
      );
      yearlyWeather = aggregateWeatherYearly(weather as Parameters<typeof aggregateWeatherYearly>[0]) as unknown as YearlyWeatherBucket[];
    }

    const mergedRows = yearlySales.map((sale) => {
      const yw = yearlyWeather.find((y) => y.year === sale.Year);
      return {
        ...sale,
        tempHigh:      yw?.avgTempMax         ?? null,
        tempLow:       yw?.avgTempMin         ?? null,
        tempMean:      yw?.avgTempMean        ?? null,
        precipitation: yw?.totalPrecipitation ?? null,
        condition:     yw?.dominantCondition  ?? null,
      };
    });

    // Compute aggregation
    const agg = {
      TotalGrossSales: yearlySales.reduce((s, r) => s + r.TotalGrossSales, 0),
      TotalNetSales: yearlySales.reduce((s, r) => s + r.TotalNetSales, 0),
      TotalTransactionsCount: yearlySales.reduce((s, r) => s + r.TotalTransactionsCount, 0),
      TotalDiscounts: yearlySales.reduce((s, r) => s + r.TotalDiscounts, 0),
      TotalRefunds: yearlySales.reduce((s, r) => s + r.TotalRefunds, 0),
      TotalTaxes: yearlySales.reduce((s, r) => s + r.TotalTaxes, 0),
      TotalTotalCollected: yearlySales.reduce((s, r) => s + r.TotalTotalCollected, 0),
    };

    res.json({
      value: mergedRows,
      '@odata.aggregation': agg,
      yearlyWeather,
      weatherEnabled: !!(u.storeLatitude && u.storeLongitude),
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};

// ─── Live Dashboard ──────────────────────────────────────────────────────────

interface TenderLineLite {
  method?: string;
  amount?: number | string | null;
}

interface LineItemLite {
  name?: string;
  productId?: string | number | null;
  upc?: string | null;
  qty?: number | string | null;
  totalPrice?: number | string | null;
  lineTotal?: number | string | null;
  costPrice?: number | string | null;
  isLottery?: boolean;
  isBottleReturn?: boolean;
  isBagFee?: boolean;
}

interface ProductMapEntry {
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  productId: string | number | null;
  upc: string | null;
  hasLineCost: boolean;
}

export const realtimeSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId   = req.orgId;
    const storeId = req.storeId || null;

    // ── Date: support ?date=YYYY-MM-DD for historical, default to today ─────
    const now      = new Date();
    const nowStr   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayStr = (req.query as { date?: string }).date || nowStr;
    const isToday  = todayStr === nowStr;
    const todayStart = new Date(`${todayStr}T00:00:00`);
    const todayEnd   = new Date(`${todayStr}T23:59:59.999`);

    // ── Fetch today's completed transactions + refunds ────────────────────────
    const todayWhere: Prisma.TransactionWhereInput = {
      orgId: orgId ?? undefined,
      status: { in: ['complete', 'refund'] },
      createdAt: { gte: todayStart, lte: todayEnd },
    };
    if (storeId) todayWhere.storeId = storeId;

    const txns = await prisma.transaction.findMany({
      where: todayWhere,
      select: {
        id: true,
        txNumber: true,
        grandTotal: true,
        subtotal: true,
        taxTotal: true,
        depositTotal: true,
        ebtTotal: true,
        tenderLines: true,
        lineItems: true,
        status: true,
        createdAt: true,
        stationId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    type TxnRow = (typeof txns)[number];

    // ── Aggregate totals ──────────────────────────────────────────────────────
    let netSales = 0, grossSales = 0, taxTotal = 0, depositTotal = 0, ebtTotal = 0;
    let cashTotal = 0, cardTotal = 0, ebtTender = 0;
    let totalCost = 0, totalRevenue = 0, knownCostItems = 0, totalItems = 0;
    let bagFeeTotal = 0, bagFeeCount = 0;
    const productMap: Record<string, ProductMapEntry> = {};
    const hourlyMap: Record<number, { sales: number; count: number }> = {};

    const seenProductIds = new Set<number>();
    const seenUpcs       = new Set<string>();

    for (const tx of txns as TxnRow[]) {
      const isRefund = tx.status === 'refund';
      const gt = isRefund ? -Math.abs(Number(tx.grandTotal)   || 0) : (Number(tx.grandTotal)   || 0);
      const st = isRefund ? -Math.abs(Number(tx.subtotal)     || 0) : (Number(tx.subtotal)     || 0);
      const tt = isRefund ? -Math.abs(Number(tx.taxTotal)     || 0) : (Number(tx.taxTotal)     || 0);
      const dt = isRefund ? -Math.abs(Number(tx.depositTotal) || 0) : (Number(tx.depositTotal) || 0);
      const et = isRefund ? -Math.abs(Number(tx.ebtTotal)     || 0) : (Number(tx.ebtTotal)     || 0);

      netSales     += st;
      grossSales   += gt;
      taxTotal     += tt;
      depositTotal += dt;
      ebtTotal     += et;

      // Tender breakdown
      const tenders: TenderLineLite[] = Array.isArray(tx.tenderLines) ? (tx.tenderLines as unknown as TenderLineLite[]) : [];
      for (const t of tenders) {
        const amt = (isRefund ? -1 : 1) * Math.abs(Number(t.amount) || 0);
        const m   = String(t.method || '').toLowerCase();
        if (m === 'cash')                          cashTotal  += amt;
        else if (['card', 'credit', 'debit'].includes(m)) cardTotal  += amt;
        else if (m === 'ebt' || m === 'ebt_cash' || m === 'efs') ebtTender  += amt;
      }

      // Bag fees tally — sweep across complete AND refund so refund qty subtracts
      const liAll: LineItemLite[] = Array.isArray(tx.lineItems) ? (tx.lineItems as unknown as LineItemLite[]) : [];
      for (const li of liAll) {
        if (li.isBagFee) {
          const amt = Number(li.lineTotal) || 0;
          const q   = Number(li.qty) || 1;
          if (isRefund) { bagFeeTotal -= Math.abs(amt); bagFeeCount -= Math.abs(q); }
          else           { bagFeeTotal += amt;          bagFeeCount += q; }
        }
      }

      // Top products from lineItems. Skip refunds (returns shouldn't appear as
      // top products).
      const items: LineItemLite[] = (tx.status === 'refund') ? [] : (Array.isArray(tx.lineItems) ? (tx.lineItems as unknown as LineItemLite[]) : []);
      for (const li of items) {
        if (!li.name || li.isLottery || li.isBottleReturn || li.isBagFee) continue;
        const key = li.name;
        const qty = Number(li.qty) || 1;
        const rev = Number(li.totalPrice ?? li.lineTotal ?? 0);
        const perLineCost = Number(li.costPrice);
        const hasLineCost = Number.isFinite(perLineCost) && perLineCost > 0;

        if (!productMap[key]) productMap[key] = {
          name: key, qty: 0, revenue: 0, cost: 0,
          productId: li.productId ?? null, upc: li.upc ?? null,
          hasLineCost: false,
        };
        productMap[key].qty     += qty;
        productMap[key].revenue += rev;
        totalRevenue += rev;
        totalItems   += qty;

        if (hasLineCost) {
          const lineCost = perLineCost * qty;
          productMap[key].cost += lineCost;
          productMap[key].hasLineCost = true;
          totalCost      += lineCost;
          knownCostItems += qty;
        } else {
          if (li.productId) seenProductIds.add(parseInt(String(li.productId), 10));
          if (li.upc)       seenUpcs.add(String(li.upc));
        }
      }

      // Hourly buckets — use gross (grandTotal) for "money through register per hour"
      const h = new Date(tx.createdAt).getHours();
      if (!hourlyMap[h]) hourlyMap[h] = { sales: 0, count: 0 };
      hourlyMap[h].sales += gt;
      hourlyMap[h].count += 1;
    }

    // Batch MasterProduct cost lookup for items without per-line cost
    if (seenProductIds.size || seenUpcs.size) {
      try {
        const orFilters: Prisma.MasterProductWhereInput[] = [];
        if (seenProductIds.size) orFilters.push({ id: { in: [...seenProductIds] } });
        if (seenUpcs.size)       orFilters.push({ upc: { in: [...seenUpcs] } });
        const mps = await prisma.masterProduct.findMany({
          where: {
            orgId: orgId ?? undefined,
            OR: orFilters,
          },
          select: { id: true, upc: true, defaultCostPrice: true },
        });
        type MpRow = (typeof mps)[number];
        const costById  = new Map<string, number>();
        const costByUpc = new Map<string, number>();
        for (const m of mps as MpRow[]) {
          const c = m.defaultCostPrice != null ? Number(m.defaultCostPrice) : null;
          if (!Number.isFinite(c) || (c as number) <= 0) continue;
          costById.set(String(m.id), c as number);
          if (m.upc) costByUpc.set(String(m.upc), c as number);
        }
        for (const p of Object.values(productMap)) {
          if (p.hasLineCost) continue;
          const mc = costById.get(String(p.productId)) ?? costByUpc.get(String(p.upc)) ?? null;
          if (mc != null) {
            const addCost = mc * p.qty;
            p.cost += addCost;
            totalCost      += addCost;
            knownCostItems += p.qty;
          }
        }
      } catch (err) {
        console.warn('⚠ B3 live dashboard cost lookup failed:', (err as Error).message);
      }
    }

    // txCount = completed sales only (refunds reported separately)
    const completedTxns = (txns as TxnRow[]).filter((t) => t.status !== 'refund');
    const refundedTxns  = (txns as TxnRow[]).filter((t) => t.status === 'refund');
    const txCount       = completedTxns.length;
    const refundCount   = refundedTxns.length;
    const grossPreRefund = grossSales + refundedTxns.reduce((s, t) => s + Math.abs(Number(t.grandTotal) || 0), 0);
    const avgTx          = (txCount + refundCount) ? grossPreRefund / (txCount + refundCount) : 0;

    // Hourly array (full 24)
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      return { hour: h, label, sales: hourlyMap[h]?.sales ?? 0, count: hourlyMap[h]?.count ?? 0 };
    });

    // Top 8 products by revenue
    const topProductsList = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Recent 15 transactions for live feed
    const recentTx = (txns as TxnRow[]).slice(0, 15).map((tx) => ({
      id:         tx.id,
      txNumber:   tx.txNumber,
      grandTotal: Number(tx.grandTotal),
      createdAt:  tx.createdAt,
      tenderLines: tx.tenderLines,
      stationId:  tx.stationId,
    }));

    // ── Today's lottery ───────────────────────────────────────────────────────
    const lotteryWhere: Prisma.LotteryTransactionWhereInput = {
      orgId: orgId ?? undefined,
      createdAt: { gte: todayStart, lte: todayEnd },
    };
    if (storeId) lotteryWhere.storeId = storeId;

    const [lotteryTxns, lotterySettings, activeBoxes] = await Promise.all([
      prisma.lotteryTransaction.findMany({
        where: lotteryWhere,
        select: { type: true, amount: true, ticketCount: true, gameId: true },
      }),
      storeId
        ? prisma.lotterySettings.findUnique({ where: { storeId } }).catch(() => null)
        : Promise.resolve(null),
      prisma.lotteryBox.count({
        where: { orgId: orgId ?? undefined, ...(storeId ? { storeId } : {}), status: 'active' },
      }),
    ]);
    type LotRow = (typeof lotteryTxns)[number];

    let lotterySales = 0, lotteryPayouts = 0, lotteryTickets = 0;
    interface GameAgg { gameId: string; sales: number; payouts: number }
    const gameMap: Record<string, GameAgg> = {};
    for (const lt of lotteryTxns as LotRow[]) {
      const amt = Number(lt.amount) || 0;
      if (lt.type === 'sale') {
        lotterySales   += amt;
        lotteryTickets += lt.ticketCount || 0;
        if (lt.gameId) {
          if (!gameMap[lt.gameId]) gameMap[lt.gameId] = { gameId: lt.gameId, sales: 0, payouts: 0 };
          gameMap[lt.gameId].sales += amt;
        }
      } else if (lt.type === 'payout') {
        lotteryPayouts += amt;
        if (lt.gameId) {
          if (!gameMap[lt.gameId]) gameMap[lt.gameId] = { gameId: lt.gameId, sales: 0, payouts: 0 };
          gameMap[lt.gameId].payouts += amt;
        }
      }
    }

    const commissionRate = lotterySettings?.commissionRate ? Number(lotterySettings.commissionRate) : 0.05;
    const lotteryNet        = lotterySales - lotteryPayouts;
    const lotteryCommission = lotterySales * commissionRate;

    const lottery = {
      sales:      lotterySales,
      payouts:    lotteryPayouts,
      net:        lotteryNet,
      tickets:    lotteryTickets,
      commission: lotteryCommission,
      commissionRate,
      activeBoxes,
      txCount:    (lotteryTxns as LotRow[]).filter((t) => t.type === 'sale').length,
      payoutCount: (lotteryTxns as LotRow[]).filter((t) => t.type === 'payout').length,
    };

    // ── 14-day trend ──────────────────────────────────────────────────────────
    const from14 = new Date();
    from14.setDate(from14.getDate() - 13);
    const from14Str = toISO(from14);

    const trendWhere: Prisma.TransactionWhereInput = {
      orgId: orgId ?? undefined,
      status: 'complete',
      createdAt: { gte: new Date(`${from14Str}T00:00:00`) },
    };
    if (storeId) trendWhere.storeId = storeId;

    const allTxns = await prisma.transaction.findMany({
      where: trendWhere,
      select: { grandTotal: true, createdAt: true },
    });
    type AllTxnRow = (typeof allTxns)[number];

    // Group by local date
    const dateMap: Record<string, { date: string; netSales: number; txCount: number }> = {};
    for (const tx of allTxns as AllTxnRow[]) {
      const d = new Date(tx.createdAt);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMap[ds]) dateMap[ds] = { date: ds, netSales: 0, txCount: 0 };
      dateMap[ds].netSales += Number(tx.grandTotal) || 0;
      dateMap[ds].txCount  += 1;
    }

    const trend: Array<{ date: string; netSales: number; txCount: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      trend.push(dateMap[ds] || { date: ds, netSales: 0, txCount: 0 });
    }

    // ── Margin calculation ──────────────────────────────────────────────────────
    const costCoverage = totalItems > 0 ? Math.round((knownCostItems / totalItems) * 100) : 0;
    const hasCostData  = knownCostItems > 0;
    const grossProfit  = hasCostData ? totalRevenue - totalCost : null;
    const avgMargin    = (hasCostData && totalRevenue > 0)
      ? Math.round(((totalRevenue - totalCost) / totalRevenue) * 10000) / 100
      : null;

    // ── Inventory grade (non-blocking) ───────────────────────────────────────
    let inventoryGrade: { grade: string; fillRate: number; inStock: number; outOfStock: number; totalTracked: number } | null = null;
    try {
      const invWhere: Prisma.MasterProductWhereInput = { orgId: orgId ?? undefined, active: true, deleted: false, trackInventory: true };
      const [, storeProducts] = await Promise.all([
        prisma.masterProduct.count({ where: invWhere }),
        prisma.storeProduct.findMany({
          where: { orgId: orgId ?? undefined, ...(storeId ? { storeId } : {}) },
          select: { quantityOnHand: true },
        }),
      ]);
      type SpRow = (typeof storeProducts)[number];
      const inStock = (storeProducts as SpRow[]).filter((sp) => Number(sp.quantityOnHand) > 0).length;
      const outOfStock = (storeProducts as SpRow[]).filter((sp) => Number(sp.quantityOnHand) <= 0).length;
      const fillRate = storeProducts.length > 0 ? Math.round((inStock / storeProducts.length) * 100) : 0;
      const grade = fillRate >= 95 ? 'A' : fillRate >= 85 ? 'B' : fillRate >= 70 ? 'C' : fillRate >= 50 ? 'D' : 'F';
      inventoryGrade = { grade, fillRate, inStock, outOfStock, totalTracked: storeProducts.length };
    } catch { /* non-fatal */ }

    // ── Weather data (non-blocking) ──────────────────────────────────────────
    let weather: unknown = null;
    try {
      const store = storeId ? await prisma.store.findUnique({ where: { id: storeId }, select: { latitude: true, longitude: true, timezone: true } }) : null;
      if (store?.latitude && store?.longitude) {
        const tz = store.timezone || 'America/New_York';
        const { getCurrentWeather, getHourlyForecast, getTenDayForecast, fetchWeatherRange: fetchWR } = await import('../services/weatherService.js');

        if (isToday) {
          const [current, hourlyForecast, tenDay] = await Promise.all([
            getCurrentWeather(store.latitude as unknown as number, store.longitude as unknown as number, tz),
            getHourlyForecast(store.latitude as unknown as number, store.longitude as unknown as number, tz),
            getTenDayForecast(store.latitude as unknown as number, store.longitude as unknown as number, tz),
          ]);
          weather = { current: (current as { current?: unknown } | null)?.current || null, hourly: hourlyForecast, tenDay, historical: null };
        } else {
          const dayWeather = await fetchWR(store.latitude as unknown as number, store.longitude as unknown as number, todayStr, todayStr, tz);
          weather = { current: null, hourly: [], tenDay: [], historical: (dayWeather as unknown[])?.[0] || null };
        }
      }
    } catch (wErr) {
      console.warn('⚠ Weather fetch for dashboard failed (non-fatal):', (wErr as Error).message);
    }

    res.json({
      todaySales: {
        netSales:     r2(netSales),
        grossSales:   r2(grossSales),
        txCount,
        refundCount,
        avgTx:        r2(avgTx),
        taxTotal:     r2(taxTotal),
        depositTotal: r2(depositTotal),
        bagFeeTotal:  r2(bagFeeTotal),
        bagFeeCount,
        ebtTotal:     r2(ebtTotal),
        cashTotal:    r2(cashTotal),
        cardTotal:    r2(cardTotal),
        ebtTender:    r2(ebtTender),
        avgMargin,
        grossProfit:  grossProfit != null ? Math.round(grossProfit * 100) / 100 : null,
        costCoverage,
        hasCostData,
      },
      inventoryGrade,
      lottery,
      hourly,
      topProducts: topProductsList,
      recentTx,
      trend,
      weather,
      weatherError: weather === null ? 'unavailable' : null,
      isToday,
      dataDate: todayStr,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[realtimeSales]', err);
    res.status(500).json({ error: (err as Error).message });
  }
};

// ─── Vendor Orders ────────────────────────────────────────────────────────────

interface MovementRow {
  Upc?: string;
  Description?: string;
  Department?: string;
  QuantityOnHand?: number | null;
  QuantitySold?: number;
  Revenue?: number;
}

interface ByUpcEntry {
  upc: string;
  description: string;
  department: string;
  dailyQty: number[];
  dailyRevenue: number[];
  qtyOnHand: number | null;
}

export const vendorOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = daysAgo(60);
    const endDate = today();

    const rawMovement = (await getDailyProductMovement(userFor(req), req.storeId, startDate, endDate)) as unknown as MovementRow[];

    // Group by UPC
    const byUpc: Record<string, ByUpcEntry> = {};
    for (const row of rawMovement) {
      const upc = row.Upc || '';
      if (!upc) continue;
      if (!byUpc[upc]) {
        byUpc[upc] = {
          upc,
          description: row.Description || upc,
          department: row.Department || '',
          dailyQty: [],
          dailyRevenue: [],
          qtyOnHand: row.QuantityOnHand ?? null,
        };
      }
      byUpc[upc].dailyQty.push(row.QuantitySold || 0);
      byUpc[upc].dailyRevenue.push(row.Revenue || 0);
      // keep most recent QoH
      if (row.QuantityOnHand !== undefined && row.QuantityOnHand !== null) {
        byUpc[upc].qtyOnHand = row.QuantityOnHand;
      }
    }

    interface VelocityResult {
      avgWeekly: number;
      trend: string;
      recommendation: 'reorder' | 'ok' | 'overstock' | string;
    }

    // Aggregate into weekly buckets and compute velocity
    const results = Object.values(byUpc).map((item) => {
      const { dailyQty, dailyRevenue } = item;

      // Sum last 30 days
      const last30days = dailyQty.slice(-30);
      const sales30 = last30days.reduce((a: number, b: number) => a + b, 0);
      const revenue30 = dailyRevenue.slice(-30).reduce((a: number, b: number) => a + b, 0);

      // Build weekly buckets (7-day chunks from the end)
      const weeklyQty: number[] = [];
      for (let w = 0; w < Math.min(8, Math.floor(dailyQty.length / 7)); w++) {
        const start = dailyQty.length - (w + 1) * 7;
        const end = dailyQty.length - w * 7;
        weeklyQty.unshift(dailyQty.slice(start, end).reduce((a: number, b: number) => a + b, 0));
      }

      const velocity = calculateVelocity(weeklyQty) as unknown as VelocityResult;

      return {
        upc: item.upc,
        description: item.description,
        department: item.department,
        qtyOnHand: item.qtyOnHand,
        sales30,
        revenue30: Math.round(revenue30 * 100) / 100,
        avgWeeklySales: velocity.avgWeekly,
        velocityTrend: velocity.trend,
        recommendation: velocity.recommendation,
        weeklyHistory: weeklyQty,
      };
    });

    // Sort: reorder first, then ok, then overstock
    const priority: Record<string, number> = { reorder: 0, ok: 1, overstock: 2 };
    results.sort((a, b) => (priority[a.recommendation] ?? 1) - (priority[b.recommendation] ?? 1));

    res.json({
      analysisWindow: { startDate, endDate },
      products: results,
      summary: {
        total: results.length,
        reorder: results.filter((r) => r.recommendation === 'reorder').length,
        ok: results.filter((r) => r.recommendation === 'ok').length,
        overstock: results.filter((r) => r.recommendation === 'overstock').length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: detailedErrorMessage(err) });
  }
};
