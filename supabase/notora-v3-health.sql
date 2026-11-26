-- More Google Health (Fitbit) metrics for the Logs page. Safe to run more than once.
alter table notora.health_daily
  add column if not exists weight_kg numeric(5,1),
  add column if not exists kcal_total integer,
  add column if not exists distance_km numeric(6,2),
  add column if not exists azm integer,
  add column if not exists hrv_ms numeric(5,1),
  add column if not exists spo2 numeric(4,1),
  add column if not exists breaths numeric(4,1);
