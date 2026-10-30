import {
  CheckInEvaluation,
  CheckInRecord,
  ComputedSubscriptionState,
  DashboardMetrics,
  GymAlert,
  Member,
  MonthlyRevenuePoint,
  PaymentRecord,
  SubscriptionStatus,
} from '../types/gym';

/**
 * Parses a YYYY-MM-DD date string into UTC midnight timestamp (ms).
 */
export function parseDateUTC(dateStr: string): number {
  const clean = dateStr.trim().slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return Date.UTC(2026, 0, 1);
  }
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Formats a UTC timestamp into YYYY-MM-DD.
 */
export function formatDateUTC(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Adds a specified number of days to a YYYY-MM-DD date string.
 */
export function calculateEndDate(startDateStr: string, durationDays: number): string {
  const startMs = parseDateUTC(startDateStr);
  const safeDays = Math.max(1, Math.round(durationDays));
  const endMs = startMs + safeDays * 86_400_000;
  return formatDateUTC(endMs);
}

/**
 * Computes the current subscription status, remaining days, and progress percentage.
 */
export function computeSubscriptionState(
  startDateStr: string,
  endDateStr: string,
  cancelledAt: string | undefined,
  alertThresholdDays: number,
  referenceDateStr: string
): ComputedSubscriptionState {
  const startMs = parseDateUTC(startDateStr);
  const endMs = parseDateUTC(endDateStr);
  const refMs = parseDateUTC(referenceDateStr);

  const totalDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
  const remainingDays = Math.round((endMs - refMs) / 86_400_000);
  const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - remainingDays));
  const progressPercent = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));

  if (cancelledAt) {
    return {
      status: 'cancelled',
      remainingDays: 0,
      totalDays,
      elapsedDays,
      progressPercent: 100,
    };
  }

  if (remainingDays < 0) {
    return {
      status: 'expired',
      remainingDays,
      totalDays,
      elapsedDays: totalDays,
      progressPercent: 100,
    };
  }

  if (remainingDays <= Math.max(1, alertThresholdDays)) {
    return {
      status: 'expiring_soon',
      remainingDays,
      totalDays,
      elapsedDays,
      progressPercent,
    };
  }

  return {
    status: 'active',
    remainingDays,
    totalDays,
    elapsedDays,
    progressPercent,
  };
}

/**
 * Evaluates a member check-in request by barcode or member code.
 */
export function evaluateCheckInByBarcode(
  barcodeInput: string,
  members: Member[],
  alertThresholdDays: number,
  referenceDateStr: string
): CheckInEvaluation {
  const normalized = barcodeInput.trim().toUpperCase();
  if (!normalized) {
    return {
      found: false,
      allowed: false,
      barcode: '',
      remainingDays: 0,
      messageTitle: 'الرجاء إدخال الباركود',
      messageDetail: 'قم بمسح باركود العضو أو كتابة كود العضوية (مثال: GYM-1001).',
    };
  }

  const member = members.find(
    (m) =>
      m.barcode.toUpperCase() === normalized ||
      m.phone.trim() === normalized ||
      m.id.toUpperCase() === normalized
  );

  if (!member) {
    return {
      found: false,
      allowed: false,
      barcode: normalized,
      remainingDays: 0,
      messageTitle: 'باركود غير مسجل بالنظام',
      messageDetail: `لم يتم العثور على أي عضو يحمل الباركود أو الرقم (${normalized}).`,
    };
  }

  const subState = computeSubscriptionState(
    member.subscription.startDate,
    member.subscription.endDate,
    member.subscription.cancelledAt,
    alertThresholdDays,
    referenceDateStr
  );

  if (subState.status === 'cancelled') {
    return {
      found: true,
      allowed: false,
      barcode: member.barcode,
      member,
      subscriptionState: subState,
      status: 'cancelled',
      remainingDays: 0,
      messageTitle: 'الدخول مرفوض — الاشتراك ملغي',
      messageDetail: `اشتراك العضو ${member.fullName} ملغي (${member.subscription.cancelReason || 'بناءً على طلب الإدارة'}). يرجى تفعيل باقة جديدة.`,
    };
  }

  if (subState.status === 'expired') {
    const overdueDays = Math.abs(subState.remainingDays);
    return {
      found: true,
      allowed: false,
      barcode: member.barcode,
      member,
      subscriptionState: subState,
      status: 'expired',
      remainingDays: subState.remainingDays,
      messageTitle: 'الدخول مرفوض — الاشتراك منتهي',
      messageDetail: `انتهى اشتراك العضو ${member.fullName} منذ ${overdueDays} يوم (${member.subscription.endDate}). يرجى تجديد الاشتراك للسماح بالدخول.`,
    };
  }

  if (subState.status === 'expiring_soon') {
    return {
      found: true,
      allowed: true,
      barcode: member.barcode,
      member,
      subscriptionState: subState,
      status: 'expiring_soon',
      remainingDays: subState.remainingDays,
      messageTitle: 'مسموح بالدخول — تنبيه قرب انتهاء الاشتراك',
      messageDetail: `مرحباً ${member.fullName}! متبقي ${subState.remainingDays === 0 ? 'اليوم فقط' : `${subState.remainingDays} أيام`} على انتهاء باقة (${member.subscription.planName}).`,
    };
  }

  return {
    found: true,
    allowed: true,
    barcode: member.barcode,
    member,
    subscriptionState: subState,
    status: 'active',
    remainingDays: subState.remainingDays,
    messageTitle: 'مسموح بالدخول — اشتراك نشط',
    messageDetail: `مرحباً ${member.fullName}! اشتراكك في (${member.subscription.planName}) ساري ومتبقي ${subState.remainingDays} يوم.`,
  };
}

/**
 * Generates deterministic bar widths (1, 2, or 3 units) for rendering a crisp SVG barcode.
 */
export function generateBarcodeBars(code: string): number[] {
  const clean = (code || 'GYM-0000').trim().toUpperCase();
  // Start pattern
  const bars: number[] = [2, 1, 1, 2, 1, 1];
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const b1 = (charCode % 3) + 1;
    const b2 = ((charCode >> 2) % 2) + 1;
    const b3 = ((charCode >> 4) % 3) + 1;
    const b4 = ((charCode + i) % 2) + 1;
    bars.push(b1, b2, b3, b4);
  }
  // Stop pattern
  bars.push(2, 1, 2, 1, 1, 2);
  return bars;
}

/**
 * Generates the next sequential member barcode (e.g., GYM-1009).
 */
export function generateNextBarcode(members: Member[]): string {
  let maxNum = 1000;
  for (const m of members) {
    const match = m.barcode.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `GYM-${maxNum + 1}`;
}

/**
 * Builds the list of expiry alerts (both expiring_soon and expired subscriptions).
 */
export function buildExpiryAlerts(
  members: Member[],
  alertThresholdDays: number,
  referenceDateStr: string,
  readAlertMemberIds: string[] = [],
  notifiedMemberIds: string[] = []
): GymAlert[] {
  const alerts: GymAlert[] = [];

  for (const member of members) {
    const state = computeSubscriptionState(
      member.subscription.startDate,
      member.subscription.endDate,
      member.subscription.cancelledAt,
      alertThresholdDays,
      referenceDateStr
    );

    if (state.status === 'expiring_soon' || state.status === 'expired') {
      alerts.push({
        id: `alert-${member.id}`,
        memberId: member.id,
        memberName: member.fullName,
        barcode: member.barcode,
        phone: member.phone,
        planName: member.subscription.planName,
        endDate: member.subscription.endDate,
        remainingDays: state.remainingDays,
        alertType: state.status,
        isRead: readAlertMemberIds.includes(member.id),
        notified: notifiedMemberIds.includes(member.id),
      });
    }
  }

  // Sort: expiring_soon with fewest days first, then recently expired
  alerts.sort((a, b) => {
    if (a.alertType !== b.alertType) {
      return a.alertType === 'expiring_soon' ? -1 : 1;
    }
    return a.remainingDays - b.remainingDays;
  });

  return alerts;
}

/**
 * Computes aggregate KPI metrics for the gym dashboard.
 */
export function computeDashboardMetrics(
  members: Member[],
  payments: PaymentRecord[],
  checkIns: CheckInRecord[],
  alertThresholdDays: number,
  referenceDateStr: string
): DashboardMetrics {
  let activeCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  let cancelledCount = 0;

  for (const member of members) {
    const state = computeSubscriptionState(
      member.subscription.startDate,
      member.subscription.endDate,
      member.subscription.cancelledAt,
      alertThresholdDays,
      referenceDateStr
    );
    if (state.status === 'active') activeCount++;
    else if (state.status === 'expiring_soon') expiringSoonCount++;
    else if (state.status === 'expired') expiredCount++;
    else if (state.status === 'cancelled') cancelledCount++;
  }

  const todayCheckInsCount = checkIns.filter(
    (c) => c.date === referenceDateStr && c.allowed
  ).length;
  const todayDeniedCount = checkIns.filter(
    (c) => c.date === referenceDateStr && !c.allowed
  ).length;

  const totalRevenueCollected = payments.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalPendingBalance = payments.reduce((sum, p) => sum + p.remainingAmount, 0);
  const totalBilled = totalRevenueCollected + totalPendingBalance;
  const collectionRatePercent =
    totalBilled > 0 ? Math.round((totalRevenueCollected / totalBilled) * 100) : 100;

  return {
    totalMembers: members.length,
    activeCount,
    expiringSoonCount,
    expiredCount,
    cancelledCount,
    todayCheckInsCount,
    todayDeniedCount,
    totalRevenueCollected,
    totalPendingBalance,
    collectionRatePercent,
  };
}

/**
 * Returns Arabic label for a subscription status.
 */
export function getStatusLabelAr(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'نشط (Active)';
    case 'expiring_soon':
      return 'قارب على الانتهاء';
    case 'expired':
      return 'منتهي (Expired)';
    case 'cancelled':
      return 'ملغي (Cancelled)';
  }
}

const ARABIC_MONTH_NAMES: Record<number, string> = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
};

/**
 * Formats a YYYY-MM key into Arabic month label and short month name.
 */
export function formatMonthKeyAr(monthKey: string): { monthLabel: string; shortMonth: string } {
  const parts = monthKey.split('-');
  const year = Number(parts[0]) || 2026;
  const monthNum = Number(parts[1]) || 1;
  const shortMonth = ARABIC_MONTH_NAMES[monthNum] || monthKey;
  return {
    monthLabel: `${shortMonth} ${year}`,
    shortMonth,
  };
}

/**
 * Aggregates payments from the payments table into a chronological monthly revenue series
 * covering at least `minMonths` leading up to `referenceDateStr` plus any other months present in `payments`.
 */
export function computeMonthlyRevenueSeries(
  payments: PaymentRecord[],
  referenceDateStr: string,
  minMonths: number = 6
): MonthlyRevenuePoint[] {
  const refClean = referenceDateStr.trim().slice(0, 10);
  const [refY, refM] = refClean.split('-').map(Number);
  const baseYear = !isNaN(refY) ? refY : 2026;
  const baseMonth = !isNaN(refM) ? refM : 10;

  const map = new Map<
    string,
    { collectedRevenue: number; pendingRevenue: number; invoicesCount: number }
  >();

  // Seed continuous window of `minMonths` ending at reference month
  for (let i = Math.max(1, minMonths) - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(baseYear, baseMonth - 1 - i, 1));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    map.set(key, { collectedRevenue: 0, pendingRevenue: 0, invoicesCount: 0 });
  }

  // Aggregate actual payments from the payments ledger
  for (const pay of payments) {
    const monthKey = (pay.date || '').trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;

    const existing = map.get(monthKey) || {
      collectedRevenue: 0,
      pendingRevenue: 0,
      invoicesCount: 0,
    };
    existing.collectedRevenue += Number(pay.paidAmount) || 0;
    existing.pendingRevenue += Number(pay.remainingAmount) || 0;
    existing.invoicesCount += 1;
    map.set(monthKey, existing);
  }

  // Sort chronologically by YYYY-MM
  const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));

  return sortedKeys.map((monthKey) => {
    const entry = map.get(monthKey)!;
    const { monthLabel, shortMonth } = formatMonthKeyAr(monthKey);
    return {
      monthKey,
      monthLabel,
      shortMonth,
      collectedRevenue: entry.collectedRevenue,
      pendingRevenue: entry.pendingRevenue,
      totalBilled: entry.collectedRevenue + entry.pendingRevenue,
      invoicesCount: entry.invoicesCount,
    };
  });
}

