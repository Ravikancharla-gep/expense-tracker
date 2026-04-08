import { useCallback, useState, type ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { formatPlainAmountForInput, formatRupeesFull, getCurrencySymbol, parseAmountInput } from '../utils/format';

type Props = {
  maskNumbers?: boolean;
  className?: string;
};

/** End-of-month SIP; monthly installment steps up once per year. */
function computeStepUpSip(
  monthlyBase: number,
  annualStepUpPct: number,
  annualReturnPct: number,
  years: number,
): { totalInvested: number; futureValue: number; gains: number } {
  const months = Math.max(0, Math.round(years * 12));
  if (months === 0 || monthlyBase <= 0) {
    return { totalInvested: 0, futureValue: 0, gains: 0 };
  }
  const step = 1 + annualStepUpPct / 100;
  const i = annualReturnPct / 100 / 12;
  let totalInvested = 0;
  let fv = 0;
  for (let m = 0; m < months; m++) {
    const yearIdx = Math.floor(m / 12);
    const payment = monthlyBase * Math.pow(step, yearIdx);
    totalInvested += payment;
    const monthsLeft = months - 1 - m;
    fv += payment * Math.pow(1 + i, monthsLeft);
  }
  const gains = fv - totalInvested;
  return { totalInvested, futureValue: fv, gains };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const SLIDER_CLASS =
  'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-teal-400 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(15,17,26,0.9)]';

const INPUT_CLASS =
  'w-[7.25rem] min-w-0 rounded-md border border-white/10 bg-teal-500/15 px-2 py-0.5 text-right font-display text-[10px] font-semibold tabular-nums text-teal-300 outline-none ring-teal-400/0 transition placeholder:text-ink-500 focus:border-teal-400/40 focus:ring-2 focus:ring-teal-400/25';

export function StepUpSipCalculator({ maskNumbers = false, className = '' }: Props) {
  const [monthly, setMonthly] = useState(25_000);
  const [stepUp, setStepUp] = useState(10);
  const [returnPct, setReturnPct] = useState(12);
  const [years, setYears] = useState(10);

  const [monthlyFocus, setMonthlyFocus] = useState(false);
  const [monthlyInput, setMonthlyInput] = useState(() => formatPlainAmountForInput(25_000));
  const [stepFocus, setStepFocus] = useState(false);
  const [stepInput, setStepInput] = useState('10');
  const [returnFocus, setReturnFocus] = useState(false);
  const [returnInput, setReturnInput] = useState('12');
  const [yearsFocus, setYearsFocus] = useState(false);
  const [yearsInput, setYearsInput] = useState('10');

  const syncMonthlyFromNumber = useCallback((n: number) => {
    const c = clamp(Math.round(n), 1_000, 200_000);
    setMonthly(c);
    setMonthlyInput(formatPlainAmountForInput(c));
  }, []);

  const onMonthlySlider = useCallback(
    (n: number) => {
      const c = clamp(Math.round(n), 1_000, 200_000);
      setMonthly(c);
      if (!monthlyFocus) setMonthlyInput(formatPlainAmountForInput(c));
    },
    [monthlyFocus],
  );

  const commitMonthly = useCallback(() => {
    const p = parseAmountInput(monthlyInput);
    if (p == null) {
      setMonthlyInput(formatPlainAmountForInput(monthly));
      return;
    }
    syncMonthlyFromNumber(p);
  }, [monthlyInput, monthly, syncMonthlyFromNumber]);

  const syncStepFromNumber = useCallback((n: number) => {
    const c = clamp(Math.round(n * 10) / 10, 0, 30);
    setStepUp(c);
    setStepInput(String(c));
  }, []);

  const onStepSlider = useCallback(
    (n: number) => {
      const c = clamp(Math.round(n * 10) / 10, 0, 30);
      setStepUp(c);
      if (!stepFocus) setStepInput(String(c));
    },
    [stepFocus],
  );

  const commitStep = useCallback(() => {
    const raw = stepInput.replace(/%/g, '').trim();
    const p = parseFloat(raw);
    if (!Number.isFinite(p)) {
      setStepInput(String(stepUp));
      return;
    }
    syncStepFromNumber(p);
  }, [stepInput, stepUp, syncStepFromNumber]);

  const syncReturnFromNumber = useCallback((n: number) => {
    const c = clamp(Math.round(n * 10) / 10, 4, 24);
    setReturnPct(c);
    setReturnInput(String(c));
  }, []);

  const onReturnSlider = useCallback(
    (n: number) => {
      const c = clamp(Math.round(n * 10) / 10, 4, 24);
      setReturnPct(c);
      if (!returnFocus) setReturnInput(String(c));
    },
    [returnFocus],
  );

  const commitReturn = useCallback(() => {
    const raw = returnInput.replace(/%/g, '').trim();
    const p = parseFloat(raw);
    if (!Number.isFinite(p)) {
      setReturnInput(String(returnPct));
      return;
    }
    syncReturnFromNumber(p);
  }, [returnInput, returnPct, syncReturnFromNumber]);

  const syncYearsFromNumber = useCallback((n: number) => {
    const c = clamp(Math.round(n), 1, 35);
    setYears(c);
    setYearsInput(String(c));
  }, []);

  const onYearsSlider = useCallback(
    (n: number) => {
      const c = clamp(Math.round(n), 1, 35);
      setYears(c);
      if (!yearsFocus) setYearsInput(String(c));
    },
    [yearsFocus],
  );

  const commitYears = useCallback(() => {
    const raw = yearsInput.replace(/yr/gi, '').trim();
    const p = parseInt(raw, 10);
    if (!Number.isFinite(p)) {
      setYearsInput(String(years));
      return;
    }
    syncYearsFromNumber(p);
  }, [yearsInput, years, syncYearsFromNumber]);

  const { totalInvested, futureValue, gains } = computeStepUpSip(monthly, stepUp, returnPct, years);

  const chartData = (() => {
    const inv = Math.max(0, totalInvested);
    const g = Math.max(0, gains);
    if (inv + g <= 0) {
      return [
        { name: 'Invested', value: 1, fill: 'rgba(148,163,184,0.35)' },
        { name: 'Returns', value: 0, fill: 'rgba(83,103,255,0.9)' },
      ];
    }
    return [
      { name: 'Invested', value: inv, fill: '#94a3b8' },
      { name: 'Est. returns', value: g, fill: '#5367FF' },
    ];
  })();

  const sym = getCurrencySymbol();

  return (
    <div
      className={`rounded-xl border border-white/5 bg-black/25 p-3 sm:p-4 ${className}`}
      role="region"
      aria-label="Step up SIP calculator"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
        <div className="min-w-0 flex-1 space-y-3">
          <h4 className="font-display text-xs font-semibold text-white">Step up SIP calculator</h4>
          <p className="text-[10px] leading-relaxed text-ink-500">
            Illustrative projection: monthly SIP increases each year; returns use a flat annual rate. Type values or use
            sliders.
          </p>

          <EditableRow
            label="Monthly investment"
            labelHtmlFor="stepup-sip-monthly-input"
            maskNumbers={maskNumbers}
            input={
              maskNumbers ? (
                <span className="rounded-md bg-teal-500/15 px-2 py-0.5 font-display text-[10px] font-semibold text-teal-300">
                  ***
                </span>
              ) : (
                <span className="relative inline-flex items-center">
                  <span className="pointer-events-none absolute left-2 text-[10px] text-teal-400/80">{sym}</span>
                  <input
                    id="stepup-sip-monthly-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="Monthly investment amount"
                    className={`${INPUT_CLASS} pl-6 pr-2`}
                    value={monthlyInput}
                    onChange={(e) => setMonthlyInput(e.target.value)}
                    onFocus={() => setMonthlyFocus(true)}
                    onBlur={() => {
                      setMonthlyFocus(false);
                      commitMonthly();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                </span>
              )
            }
            slider={
              <input
                type="range"
                className={SLIDER_CLASS}
                min={1_000}
                max={200_000}
                step={500}
                value={monthly}
                onChange={(e) => onMonthlySlider(Number(e.target.value))}
                aria-label="Monthly investment slider"
                aria-valuetext={maskNumbers ? 'Masked' : formatRupeesFull(monthly)}
              />
            }
          />

          <EditableRow
            label="Annual step up"
            labelHtmlFor="stepup-sip-step-input"
            maskNumbers={maskNumbers}
            input={
              maskNumbers ? (
                <span className="rounded-md bg-teal-500/15 px-2 py-0.5 font-display text-[10px] font-semibold text-teal-300">
                  **
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  <input
                    id="stepup-sip-step-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="Annual step up percent"
                    className={`${INPUT_CLASS} w-[4.5rem]`}
                    value={stepInput}
                    onChange={(e) => setStepInput(e.target.value)}
                    onFocus={() => setStepFocus(true)}
                    onBlur={() => {
                      setStepFocus(false);
                      commitStep();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="text-[10px] text-teal-400/80">%</span>
                </span>
              )
            }
            slider={
              <input
                type="range"
                className={SLIDER_CLASS}
                min={0}
                max={30}
                step={1}
                value={stepUp}
                onChange={(e) => onStepSlider(Number(e.target.value))}
                aria-label="Annual step up slider"
                aria-valuetext={`${stepUp}%`}
              />
            }
          />

          <EditableRow
            label="Expected return (p.a.)"
            labelHtmlFor="stepup-sip-return-input"
            maskNumbers={maskNumbers}
            input={
              maskNumbers ? (
                <span className="rounded-md bg-teal-500/15 px-2 py-0.5 font-display text-[10px] font-semibold text-teal-300">
                  **
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  <input
                    id="stepup-sip-return-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label="Expected annual return percent"
                    className={`${INPUT_CLASS} w-[4.5rem]`}
                    value={returnInput}
                    onChange={(e) => setReturnInput(e.target.value)}
                    onFocus={() => setReturnFocus(true)}
                    onBlur={() => {
                      setReturnFocus(false);
                      commitReturn();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="text-[10px] text-teal-400/80">%</span>
                </span>
              )
            }
            slider={
              <input
                type="range"
                className={SLIDER_CLASS}
                min={4}
                max={24}
                step={0.5}
                value={returnPct}
                onChange={(e) => onReturnSlider(Number(e.target.value))}
                aria-label="Expected return slider"
                aria-valuetext={`${returnPct}%`}
              />
            }
          />

          <EditableRow
            label="Time period"
            labelHtmlFor="stepup-sip-years-input"
            maskNumbers={maskNumbers}
            input={
              maskNumbers ? (
                <span className="rounded-md bg-teal-500/15 px-2 py-0.5 font-display text-[10px] font-semibold text-teal-300">
                  **
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5">
                  <input
                    id="stepup-sip-years-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Investment period in years"
                    className={`${INPUT_CLASS} w-[4rem]`}
                    value={yearsInput}
                    onChange={(e) => setYearsInput(e.target.value)}
                    onFocus={() => setYearsFocus(true)}
                    onBlur={() => {
                      setYearsFocus(false);
                      commitYears();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <span className="text-[10px] text-teal-400/80">yr</span>
                </span>
              )
            }
            slider={
              <input
                type="range"
                className={SLIDER_CLASS}
                min={1}
                max={35}
                step={1}
                value={years}
                onChange={(e) => onYearsSlider(Number(e.target.value))}
                aria-label="Time period slider"
                aria-valuetext={`${years} years`}
              />
            }
          />
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3 lg:w-[11rem]">
          <div className="flex w-full justify-end gap-3 text-[9px] text-ink-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
              Invested
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#5367FF]" aria-hidden />
              Est. returns
            </span>
          </div>
          <div className="relative h-36 w-36 sm:h-40 sm:w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="rgba(15,17,26,0.95)"
                  strokeWidth={1}
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} style={{ outline: 'none' }} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-white/5 pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-ink-500 sm:text-sm">Total investment</dt>
          <dd className="mt-1 font-display text-lg font-bold tabular-nums text-ink-100 sm:text-xl">
            {maskNumbers ? '***' : formatRupeesFull(Math.round(totalInvested))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-500 sm:text-sm">Wealth gained</dt>
          <dd className="mt-1 font-display text-lg font-bold tabular-nums text-teal-300 sm:text-xl">
            {maskNumbers ? '***' : formatRupeesFull(Math.round(gains))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-500 sm:text-sm">Total value</dt>
          <dd className="mt-1 font-display text-lg font-bold tabular-nums text-white sm:text-xl">
            {maskNumbers ? '***' : formatRupeesFull(Math.round(futureValue))}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function EditableRow({
  label,
  labelHtmlFor,
  maskNumbers,
  input,
  slider,
}: {
  label: string;
  labelHtmlFor: string;
  maskNumbers: boolean;
  input: ReactNode;
  slider: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        {maskNumbers ? (
          <span className="text-[10px] font-medium text-ink-400">{label}</span>
        ) : (
          <label htmlFor={labelHtmlFor} className="text-[10px] font-medium text-ink-400">
            {label}
          </label>
        )}
        {input}
      </div>
      {slider}
    </div>
  );
}
