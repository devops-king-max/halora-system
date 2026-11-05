import 'reflect-metadata';
import { resolveReportPeriod, currentReportYear } from '../src/reports/reports.service';

describe('report period resolution (Asia/Ho_Chi_Minh)',()=>{
  it('defaults to the whole current year when no range is supplied',()=>{
    const period=resolveReportPeriod({},2026);
    expect(period.year).toBe(2026);
    expect(period.from).toBe('2026-01-01T00:00:00+07:00');
    expect(period.to).toBe('2027-01-01T00:00:00+07:00');
  });
  it('maps each quarter to a half-open range inside the year',()=>{
    expect(resolveReportPeriod({year:2025,quarter:1},2026)).toMatchObject({from:'2025-01-01T00:00:00+07:00',to:'2025-04-01T00:00:00+07:00'});
    expect(resolveReportPeriod({year:2025,quarter:2},2026)).toMatchObject({from:'2025-04-01T00:00:00+07:00',to:'2025-07-01T00:00:00+07:00'});
    expect(resolveReportPeriod({year:2025,quarter:3},2026)).toMatchObject({from:'2025-07-01T00:00:00+07:00',to:'2025-10-01T00:00:00+07:00'});
    expect(resolveReportPeriod({year:2025,quarter:4},2026)).toMatchObject({from:'2025-10-01T00:00:00+07:00',to:'2026-01-01T00:00:00+07:00'});
  });
  it('uses the default year for a lone quarter and keeps explicit from/to ranges',()=>{
    expect(resolveReportPeriod({quarter:2},2026)).toMatchObject({year:2026,quarter:2,from:'2026-04-01T00:00:00+07:00',to:'2026-07-01T00:00:00+07:00'});
    expect(resolveReportPeriod({from:'2026-10-01T00:00:00Z',to:'2026-10-31T00:00:00Z'},2026)).toMatchObject({from:'2026-10-01T00:00:00Z',to:'2026-10-31T00:00:00Z'});
  });
  it('rejects years and quarters outside the supported bounds',()=>{
    expect(()=>resolveReportPeriod({year:1999})).toThrow();
    expect(()=>resolveReportPeriod({year:2101})).toThrow();
    expect(()=>resolveReportPeriod({quarter:0})).toThrow();
    expect(()=>resolveReportPeriod({quarter:5})).toThrow();
    expect(()=>resolveReportPeriod({year:2026.5})).toThrow();
  });
  it('reports a plausible current year in the business time zone',()=>{
    const year=currentReportYear();
    expect(Number.isInteger(year)).toBe(true);
    expect(year).toBeGreaterThanOrEqual(2020);
  });
});
