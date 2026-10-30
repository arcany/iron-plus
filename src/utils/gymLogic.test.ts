import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEndDate,
  computeSubscriptionState,
  evaluateCheckInByBarcode,
  generateBarcodeBars,
  generateNextBarcode,
  buildExpiryAlerts,
  computeDashboardMetrics,
  computeMonthlyRevenueSeries,
} from './gymLogic';
import { Member, PaymentRecord, CheckInRecord } from '../types/gym';

const REF_DATE = '2026-10-29';

const sampleMembers: Member[] = [
  {
    id: 'm1',
    barcode: 'GYM-1001',
    fullName: 'أحمد محمود العتيبي',
    phone: '0501234567',
    gender: 'male',
    age: 28,
    goal: 'بناء عضلات',
    joinDate: '2026-10-01',
    subscription: {
      planId: 'p2',
      planName: 'باقة 3 شهور - شامل',
      price: 950,
      startDate: '2026-10-01',
      endDate: '2026-12-30',
    },
    totalCheckIns: 18,
  },
  {
    id: 'm2',
    barcode: 'GYM-1002',
    fullName: 'خالد سامي الدوسري',
    phone: '0559876543',
    gender: 'male',
    age: 32,
    goal: 'إنقاص وزن',
    joinDate: '2026-10-01',
    subscription: {
      planId: 'p1',
      planName: 'باقة شهر واحد - حديد وكارديو',
      price: 400,
      startDate: '2026-10-01',
      endDate: '2026-10-31', // 2 days left from 2026-10-29
    },
    totalCheckIns: 22,
  },
  {
    id: 'm3',
    barcode: 'GYM-1003',
    fullName: 'عمر فاروق الزهراني',
    phone: '0541112233',
    gender: 'male',
    age: 24,
    goal: 'لياقة بدنية',
    joinDate: '2026-09-15',
    subscription: {
      planId: 'p1',
      planName: 'باقة شهر واحد - حديد وكارديو',
      price: 400,
      startDate: '2026-09-15',
      endDate: '2026-10-15', // Expired 14 days ago
    },
    totalCheckIns: 12,
  },
  {
    id: 'm4',
    barcode: 'GYM-1004',
    fullName: 'يوسف طارق المنصور',
    phone: '0564445566',
    gender: 'male',
    age: 35,
    goal: 'تأهيل رياضي',
    joinDate: '2026-10-10',
    subscription: {
      planId: 'p3',
      planName: 'باقة 6 شهور VIP',
      price: 1600,
      startDate: '2026-10-10',
      endDate: '2027-04-08',
      cancelledAt: '2026-10-20',
      cancelReason: 'سفر خارج البلاد',
    },
    totalCheckIns: 4,
  },
];

test('calculateEndDate adds exact duration days in UTC', () => {
  assert.equal(calculateEndDate('2026-10-01', 30), '2026-10-31');
  assert.equal(calculateEndDate('2026-10-29', 90), '2027-01-27');
});

test('computeSubscriptionState distinguishes active, expiring_soon, expired, and cancelled', () => {
  // Active (> 7 days left)
  const activeState = computeSubscriptionState('2026-10-01', '2026-12-30', undefined, 7, REF_DATE);
  assert.equal(activeState.status, 'active');
  assert.equal(activeState.remainingDays, 62);

  // Expiring soon (2 days left, threshold = 7)
  const expiringState = computeSubscriptionState('2026-10-01', '2026-10-31', undefined, 7, REF_DATE);
  assert.equal(expiringState.status, 'expiring_soon');
  assert.equal(expiringState.remainingDays, 2);

  // Expired (-14 days)
  const expiredState = computeSubscriptionState('2026-09-15', '2026-10-15', undefined, 7, REF_DATE);
  assert.equal(expiredState.status, 'expired');
  assert.equal(expiredState.remainingDays, -14);

  // Cancelled overrides dates
  const cancelledState = computeSubscriptionState('2026-10-10', '2027-04-08', '2026-10-20', 7, REF_DATE);
  assert.equal(cancelledState.status, 'cancelled');
  assert.equal(cancelledState.remainingDays, 0);
});

test('evaluateCheckInByBarcode allows active & expiring_soon and denies expired, cancelled & unknown', () => {
  // Active member
  const resActive = evaluateCheckInByBarcode('gym-1001', sampleMembers, 7, REF_DATE);
  assert.equal(resActive.found, true);
  assert.equal(resActive.allowed, true);
  assert.equal(resActive.status, 'active');

  // Expiring soon member (allowed with warning)
  const resExpiring = evaluateCheckInByBarcode('GYM-1002', sampleMembers, 7, REF_DATE);
  assert.equal(resExpiring.found, true);
  assert.equal(resExpiring.allowed, true);
  assert.equal(resExpiring.status, 'expiring_soon');
  assert.equal(resExpiring.remainingDays, 2);

  // Expired member (denied)
  const resExpired = evaluateCheckInByBarcode('GYM-1003', sampleMembers, 7, REF_DATE);
  assert.equal(resExpired.found, true);
  assert.equal(resExpired.allowed, false);
  assert.equal(resExpired.status, 'expired');

  // Cancelled member (denied)
  const resCancelled = evaluateCheckInByBarcode('GYM-1004', sampleMembers, 7, REF_DATE);
  assert.equal(resCancelled.found, true);
  assert.equal(resCancelled.allowed, false);
  assert.equal(resCancelled.status, 'cancelled');

  // Unknown barcode
  const resUnknown = evaluateCheckInByBarcode('GYM-9999', sampleMembers, 7, REF_DATE);
  assert.equal(resUnknown.found, false);
  assert.equal(resUnknown.allowed, false);
});

test('generateBarcodeBars and generateNextBarcode produce deterministic outputs', () => {
  const bars = generateBarcodeBars('GYM-1001');
  assert.ok(bars.length > 20);
  assert.ok(bars.every((b) => b >= 1 && b <= 3));

  const nextCode = generateNextBarcode(sampleMembers);
  assert.equal(nextCode, 'GYM-1005');
});

test('buildExpiryAlerts and computeDashboardMetrics aggregate gym state accurately', () => {
  const alerts = buildExpiryAlerts(sampleMembers, 7, REF_DATE);
  assert.equal(alerts.length, 2); // m2 (expiring_soon) and m3 (expired)
  assert.equal(alerts[0].memberId, 'm2');
  assert.equal(alerts[1].memberId, 'm3');

  const payments: PaymentRecord[] = [
    {
      id: 'pay1',
      invoiceNumber: 'INV-101',
      memberId: 'm1',
      memberName: 'أحمد محمود العتيبي',
      barcode: 'GYM-1001',
      planName: 'باقة 3 شهور - شامل',
      amount: 1000,
      paidAmount: 900,
      remainingAmount: 100,
      method: 'card',
      date: REF_DATE,
      type: 'new_subscription',
    },
  ];

  const checkIns: CheckInRecord[] = [
    {
      id: 'chk1',
      memberId: 'm1',
      memberName: 'أحمد محمود العتيبي',
      barcode: 'GYM-1001',
      planName: 'باقة 3 شهور - شامل',
      timestamp: `${REF_DATE} 14:10`,
      date: REF_DATE,
      statusAtEntry: 'active',
      allowed: true,
      remainingDays: 62,
      reason: 'دخول ناجح',
    },
    {
      id: 'chk2',
      memberId: 'm3',
      memberName: 'عمر فاروق الزهراني',
      barcode: 'GYM-1003',
      planName: 'باقة شهر واحد - حديد وكارديو',
      timestamp: `${REF_DATE} 14:25`,
      date: REF_DATE,
      statusAtEntry: 'expired',
      allowed: false,
      remainingDays: -14,
      reason: 'الاشتراك منتهي',
    },
  ];

  const metrics = computeDashboardMetrics(sampleMembers, payments, checkIns, 7, REF_DATE);
  assert.equal(metrics.totalMembers, 4);
  assert.equal(metrics.activeCount, 1);
  assert.equal(metrics.expiringSoonCount, 1);
  assert.equal(metrics.expiredCount, 1);
  assert.equal(metrics.cancelledCount, 1);
  assert.equal(metrics.todayCheckInsCount, 1);
  assert.equal(metrics.todayDeniedCount, 1);
  assert.equal(metrics.totalRevenueCollected, 900);
  assert.equal(metrics.totalPendingBalance, 100);
  assert.equal(metrics.collectionRatePercent, 90);
});

test('computeMonthlyRevenueSeries aggregates payments by YYYY-MM chronologically', () => {
  const multiMonthPayments: PaymentRecord[] = [
    {
      id: 'p-aug-1',
      invoiceNumber: 'INV-801',
      memberId: 'm1',
      memberName: 'أحمد محمود العتيبي',
      barcode: 'GYM-1001',
      planName: 'باقة شهر واحد - حديد وكارديو',
      amount: 850,
      paidAmount: 850,
      remainingAmount: 0,
      method: 'cash',
      date: '2026-08-12',
      type: 'new_subscription',
    },
    {
      id: 'p-oct-1',
      invoiceNumber: 'INV-901',
      memberId: 'm1',
      memberName: 'أحمد محمود العتيبي',
      barcode: 'GYM-1001',
      planName: 'باقة 3 شهور - شامل',
      amount: 2200,
      paidAmount: 2000,
      remainingAmount: 200,
      method: 'card',
      date: '2026-10-05',
      type: 'renewal',
    },
    {
      id: 'p-oct-2',
      invoiceNumber: 'INV-902',
      memberId: 'm2',
      memberName: 'خالد سامي الدوسري',
      barcode: 'GYM-1002',
      planName: 'باقة شهر واحد - حديد وكارديو',
      amount: 850,
      paidAmount: 850,
      remainingAmount: 0,
      method: 'cash',
      date: '2026-10-20',
      type: 'new_subscription',
    },
  ];

  const series = computeMonthlyRevenueSeries(multiMonthPayments, REF_DATE, 6);
  assert.equal(series.length, 6);
  assert.equal(series[0].monthKey, '2026-05');
  assert.equal(series[3].monthKey, '2026-08');
  assert.equal(series[3].collectedRevenue, 850);
  assert.equal(series[3].invoicesCount, 1);

  assert.equal(series[5].monthKey, '2026-10');
  assert.equal(series[5].shortMonth, 'أكتوبر');
  assert.equal(series[5].collectedRevenue, 2850);
  assert.equal(series[5].pendingRevenue, 200);
  assert.equal(series[5].totalBilled, 3050);
  assert.equal(series[5].invoicesCount, 2);
});

import {
  buildCloudflareHeaders,
  normalizeRepoName,
} from './githubCloudflareDeploy';

test('normalizeRepoName converts "iron plus" and empty strings to "iron-plus"', () => {
  assert.equal(normalizeRepoName('iron plus'), 'iron-plus');
  assert.equal(normalizeRepoName('  Iron Plus  '), 'iron-plus');
  assert.equal(normalizeRepoName(''), 'iron-plus');
  assert.equal(normalizeRepoName('iron-plus'), 'iron-plus');
});

test('buildCloudflareHeaders supports both Bearer API Token and Email + Global API Key', () => {
  const tokenRes = buildCloudflareHeaders({
    authMode: 'token',
    apiToken: 'cf_test_token_123',
  });
  assert.equal(tokenRes.error, undefined);
  assert.equal(tokenRes.headers?.Authorization, 'Bearer cf_test_token_123');

  const globalRes = buildCloudflareHeaders({
    authMode: 'global_key',
    email: '3alamy200@gmail.com',
    globalApiKey: 'global_key_xyz',
  });
  assert.equal(globalRes.error, undefined);
  assert.equal(globalRes.headers?.['X-Auth-Email'], '3alamy200@gmail.com');
  assert.equal(globalRes.headers?.['X-Auth-Key'], 'global_key_xyz');

  const emptyRes = buildCloudflareHeaders({
    authMode: 'token',
    apiToken: '   ',
  });
  assert.ok(emptyRes.error);
});



