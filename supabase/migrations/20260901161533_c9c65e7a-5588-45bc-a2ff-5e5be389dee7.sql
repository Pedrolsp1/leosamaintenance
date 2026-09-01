CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  model text NOT NULL,
  line text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.machine_readings (
  id bigserial PRIMARY KEY,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  running boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  tags jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX machine_readings_machine_time_idx ON public.machine_readings (machine_id, recorded_at DESC);

CREATE TABLE public.machine_state_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('run','stop','hold','idle')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX machine_state_periods_machine_idx ON public.machine_state_periods (machine_id, started_at DESC);

CREATE TABLE public.downtime_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  reason text NOT NULL,
  reason_code text,
  category text NOT NULL DEFAULT 'failure' CHECK (category IN ('planned','failure')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX downtime_events_machine_idx ON public.downtime_events (machine_id, started_at DESC);

CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid REFERENCES public.machines(id) ON DELETE CASCADE,
  label text NOT NULL,
  operator_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shifts_machine_idx ON public.shifts (machine_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_readings TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.machine_readings_id_seq TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_state_periods TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downtime_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO anon, authenticated;
GRANT ALL ON public.machines, public.machine_readings, public.machine_state_periods, public.downtime_events, public.shifts TO service_role;
GRANT ALL ON SEQUENCE public.machine_readings_id_seq TO service_role;

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_state_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access to machines" ON public.machines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to readings" ON public.machine_readings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to state periods" ON public.machine_state_periods FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to downtime" ON public.downtime_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to shifts" ON public.shifts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.machines (code, name, model, line, sort_order) VALUES
  ('AK-01', 'Akron 1400 #1', 'Akron 1400', 'LINE A', 1),
  ('AK-02', 'Akron 1400 #2', 'Akron 1400', 'LINE A', 2),
  ('AK-03', 'Akron 1400 #3', 'Akron 1400', 'LINE B', 3),
  ('SK-01', 'Selco SK4 #1', 'Selco SK4', 'LINE B', 4),
  ('SK-02', 'Selco SK4 #2', 'Selco SK4', 'LINE C', 5),
  ('SK-03', 'Selco SK4 #3', 'Selco SK4', 'LINE C', 6);

INSERT INTO public.machine_readings (machine_id, running, recorded_at, tags)
SELECT m.id, (m.code <> 'SK-01'), now(), jsonb_build_object('source', 'seed')
FROM public.machines m;

INSERT INTO public.machine_state_periods (machine_id, state, started_at, ended_at)
SELECT m.id, 'run', now() - interval '8 hours', now() - interval '5 hours' FROM public.machines m
UNION ALL
SELECT m.id, 'stop', now() - interval '5 hours', now() - interval '4 hours 40 minutes' FROM public.machines m
UNION ALL
SELECT m.id, 'run', now() - interval '4 hours 40 minutes', now() - interval '2 hours' FROM public.machines m
UNION ALL
SELECT m.id, 'hold', now() - interval '2 hours', now() - interval '1 hour 45 minutes' FROM public.machines m
UNION ALL
SELECT m.id, CASE WHEN m.code = 'SK-01' THEN 'stop' ELSE 'run' END, now() - interval '1 hour 45 minutes', NULL FROM public.machines m;

INSERT INTO public.downtime_events (machine_id, started_at, ended_at, reason, reason_code, category, notes)
SELECT m.id, now() - interval '5 hours', now() - interval '4 hours 40 minutes', 'Blade change', 'P-201', 'planned', 'Scheduled blade swap'
FROM public.machines m
UNION ALL
SELECT m.id, now() - interval '2 hours', now() - interval '1 hour 45 minutes', 'Panel misfeed on infeed table', 'F-118', 'failure', 'Cleared by operator'
FROM public.machines m
UNION ALL
SELECT m.id, now() - interval '1 hour 45 minutes', NULL, 'Spindle over-temperature trip', 'F-090', 'failure', 'Maintenance called'
FROM public.machines m WHERE m.code = 'SK-01';

INSERT INTO public.shifts (machine_id, label, operator_name, started_at, ended_at, notes)
SELECT m.id, 'Shift A', 'P. Silva', now() - interval '8 hours', now() - interval '2 hours', 'Handover: watch infeed alignment' FROM public.machines m
UNION ALL
SELECT m.id, 'Shift B', 'M. Vance', now() - interval '2 hours', NULL, 'Running to plan' FROM public.machines m;