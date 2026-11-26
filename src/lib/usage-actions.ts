'use server';

import { requireUser } from '@/lib/session';
import { getUsageReport as report, type Granularity, type UsageRange, type UsageReport } from '@/lib/usage-report';

export async function getUsageReport(range: UsageRange = '30d', granularity?: Granularity): Promise<UsageReport> {
  // Each account sees only its own AI usage.
  return report(await requireUser(), range, granularity);
}
