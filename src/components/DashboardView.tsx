import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  ScanLine,
  Wallet,
  CalendarClock,
  ArrowUpLeft,
  RefreshCw,
  QrCode,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';
import {
  CheckInEvaluation,
  CheckInRecord,
  DashboardMetrics,
  GymAlert,
  GymProfile,
  Member,
} from '../types/gym';
import { getStatusLabelAr } from '../utils/gymLogic';

interface DashboardViewProps {
  gymProfile: GymProfile;
  metrics: DashboardMetrics;
  members: Member[];
  alerts: GymAlert[];
  checkIns: CheckInRecord[];
  lastCheckInResult: CheckInEvaluation | null;
  onPerformCheckIn: (barcode: string) => void;
  onOpenAddMember: () => void;
  onOpenRenewMember: (member: Member) => void;
  onOpenBarcodeModal: (member: Member) => void;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  gymProfile,
  metrics,
  members,
  alerts,
  checkIns,
  lastCheckInResult,
  onPerformCheckIn,
  onOpenAddMember,
  onOpenRenewMember,
  onOpenBarcodeModal,
  onNavigate,
}) => {
  const [quickBarcode, setQuickBarcode] = useState('');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBarcode.trim()) return;
    onPerformCheckIn(quickBarcode.trim());
    setQuickBarcode('');
  };

  const activePercent =
    metrics.totalMembers > 0
      ? Math.round(((metrics.activeCount + metrics.expiringSoonCount) / metrics.totalMembers) * 100)
      : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Compact Native App Summary & Quick Actions Strip */}
      <div className="rounded-xl bg-white border border-slate-200 p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
            <span className="font-semibold text-emerald-700">{gymProfile.branchName}</span>
            <span aria-hidden="true">·</span>
            <span>المدير: {gymProfile.managerName}</span>
          </div>
          <h1 className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5">
            لوحة متابعة حالة الجيم والاشتراكات
          </h1>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('checkin')}
            className="inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[42px] px-3 sm:px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ScanLine className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>بوابة الباركود</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddMember}
            className="inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[42px] px-3 sm:px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>تسجيل عضو جديد</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Metric Grid (Compact on Mobile so all 6 fit above the fold) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>إجمالي الأعضاء</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 font-mono tabular-nums">
            {metrics.totalMembers}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 tabular-nums">
            نسبة التفعيل {activePercent}%
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>اشتراكات نشطة</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1.5 font-mono tabular-nums">
            {metrics.activeCount}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">سارية بالكامل</p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>قاربت على الانتهاء</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1.5 font-mono tabular-nums">
            {metrics.expiringSoonCount}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 tabular-nums">
            خلال {gymProfile.alertThresholdDays} أيام أو أقل
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>منتهية / ملغاة</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-rose-600 mt-1.5 font-mono tabular-nums">
            {metrics.expiredCount}{' '}
            <span className="text-xs text-slate-400 font-normal">/ {metrics.cancelledCount}</span>
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 tabular-nums">
            {metrics.expiredCount} منتهي · {metrics.cancelledCount} ملغي
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>حضور اليوم</span>
            <ScanLine className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 font-mono tabular-nums">
            {metrics.todayCheckInsCount}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 tabular-nums">
            مرفوض اليوم: {metrics.todayDeniedCount}
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>إجمالي المدفوعات</span>
            <Wallet className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1.5 font-mono tabular-nums">
            {metrics.totalRevenueCollected.toLocaleString('en-US')}{' '}
            <span className="text-[11px] font-normal text-slate-500">{gymProfile.currency}</span>
          </p>
          <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5 tabular-nums">
            متبقي: {metrics.totalPendingBalance.toLocaleString('en-US')} {gymProfile.currency}
          </p>
        </div>
      </div>

      {/* Main Two-Column Grid: Quick Barcode Check-In + Subscription Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Quick Barcode Check-In Widget (7 cols) */}
        <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  تسجيل حضور سريع بالباركود (Quick Check-in)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  امسح باركود العضو أو أدخل كود العضوية للتحقق الفوري من صلاحية الاشتراك
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('checkin')}
                className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>فتح شاشة البوابة الكاملة</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleQuickSubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <label htmlFor="dashboard-barcode-input" className="sr-only">
                  كود الباركود أو رقم هاتف العضو
                </label>
                <input
                  id="dashboard-barcode-input"
                  type="text"
                  value={quickBarcode}
                  onChange={(e) => setQuickBarcode(e.target.value)}
                  placeholder="أدخل الباركود (مثال: GYM-1001 أو GYM-1004) أو رقم الجوال..."
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                تسجيل الدخول (Check-in)
              </button>
            </form>

            {/* Quick Test Barcode Buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 ml-1">تجربة فورية:</span>
              {members.slice(0, 4).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPerformCheckIn(m.barcode)}
                  className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono text-[11px] transition-colors whitespace-nowrap"
                >
                  {m.barcode} ({m.fullName.split(' ')[0]})
                </button>
              ))}
            </div>
          </div>

          {/* Last Check-In Result Banner */}
          {lastCheckInResult ? (
            <div
              className={`mt-4 rounded-lg border p-4 ${
                !lastCheckInResult.allowed
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : lastCheckInResult.status === 'expiring_soon'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}
              role="region"
              aria-label="نتيجة فحص الباركود"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {lastCheckInResult.allowed ? (
                    <CheckCircle2
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        lastCheckInResult.status === 'expiring_soon'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold">{lastCheckInResult.messageTitle}</h3>
                    <p className="text-xs mt-0.5 opacity-90">{lastCheckInResult.messageDetail}</p>
                  </div>
                </div>
                {lastCheckInResult.member && !lastCheckInResult.allowed && (
                  <button
                    type="button"
                    onClick={() => onOpenRenewMember(lastCheckInResult.member!)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    تجديد الآن
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-3.5 text-xs text-slate-500 flex items-center justify-between">
              <span>بوابة الباركود جاهزة لاستقبال الأعضاء وتسجيل الحضور تلقائياً.</span>
              <span className="font-mono text-slate-400 tabular-nums">USB / Camera Ready</span>
            </div>
          )}
        </div>

        {/* Subscription Status Distribution (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-white border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                توزيع حالات الاشتراكات
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('members')}
                className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap"
              >
                عرض سجل الأعضاء
              </button>
            </div>

            {/* Segmented Progress Bar */}
            <div className="mt-4 h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
              {metrics.totalMembers > 0 && (
                <>
                  <div
                    style={{ width: `${(metrics.activeCount / metrics.totalMembers) * 100}%` }}
                    className="bg-emerald-600 h-full"
                    title="نشط"
                  />
                  <div
                    style={{ width: `${(metrics.expiringSoonCount / metrics.totalMembers) * 100}%` }}
                    className="bg-amber-500 h-full"
                    title="قارب على الانتهاء"
                  />
                  <div
                    style={{ width: `${(metrics.expiredCount / metrics.totalMembers) * 100}%` }}
                    className="bg-rose-600 h-full"
                    title="منتهي"
                  />
                  <div
                    style={{ width: `${(metrics.cancelledCount / metrics.totalMembers) * 100}%` }}
                    className="bg-slate-400 h-full"
                    title="ملغي"
                  />
                </>
              )}
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="font-semibold text-emerald-700">نشط (Active)</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {metrics.activeCount} عضو
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="font-semibold text-amber-700">
                  قارب على الانتهاء (خلال {gymProfile.alertThresholdDays} أيام)
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {metrics.expiringSoonCount} عضو
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="font-semibold text-rose-700">منتهي (Expired)</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {metrics.expiredCount} عضو
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="font-semibold text-slate-500">ملغي (Cancelled)</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {metrics.cancelledCount} عضو
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>نسبة تحصيل الاشتراكات</span>
            <span className="font-mono font-bold text-emerald-700 tabular-nums">
              {metrics.collectionRatePercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Two-Column Section: Expiring / Expired Subscriptions Alert Table + Today's Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Expiring & Expired Subscriptions Watchlist (7 cols) */}
        <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                متابعة الاشتراكات التي انتهت أو قاربت على الانتهاء
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                قائمة الأعضاء المطلوب التواصل معهم لتجديد الاشتراك
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('alerts')}
              className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
            >
              كل التنبيهات ({alerts.length})
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              جميع اشتراكات الأعضاء سارية ولا توجد اشتراكات منتهية أو على وشك الانتهاء حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">العضو والباركود</th>
                    <th className="py-3 px-4 font-semibold">الباقة</th>
                    <th className="py-3 px-4 font-semibold">الحالة والمدة</th>
                    <th className="py-3 px-4 font-semibold text-left">إجراء سريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alerts.slice(0, 5).map((alert) => {
                    const memberObj = members.find((m) => m.id === alert.memberId);
                    return (
                      <tr key={alert.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{alert.memberName}</div>
                          <div className="text-slate-500 font-mono text-[11px] mt-0.5 tabular-nums">
                            {alert.barcode} · {alert.phone}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div>{alert.planName}</div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            ينتهي: {alert.endDate}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {alert.alertType === 'expiring_soon' ? (
                            <span className="font-semibold text-amber-700 tabular-nums">
                              قارب على الانتهاء · متبقي {alert.remainingDays} أيام
                            </span>
                          ) : (
                            <span className="font-semibold text-rose-700 tabular-nums">
                              منتهي · منذ {Math.abs(alert.remainingDays)} يوم
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-left">
                          {memberObj && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenRenewMember(memberObj)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors whitespace-nowrap"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>تجديد</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenBarcodeModal(memberObj)}
                                aria-label={`عرض باركود ${memberObj.fullName}`}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Check-Ins Log (5 cols) */}
        <div className="lg:col-span-5 rounded-xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">سجل الحضور الأخير (Check-ins)</h2>
              <p className="text-xs text-slate-500 mt-0.5">آخر حركات الدخول عبر بوابة الباركود</p>
            </div>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>

          <div className="divide-y divide-slate-100">
            {checkIns.slice(0, 5).map((chk) => (
              <div
                key={chk.id}
                className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{chk.memberName}</span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {chk.barcode}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {chk.planName} ·{' '}
                    <span
                      className={
                        chk.allowed
                          ? chk.statusAtEntry === 'expiring_soon'
                            ? 'text-amber-700 font-semibold'
                            : 'text-emerald-700 font-semibold'
                          : 'text-rose-700 font-semibold'
                      }
                    >
                      {chk.allowed ? 'مسموح بالدخول' : 'دخول مرفوض'} ({getStatusLabelAr(chk.statusAtEntry)})
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0">
                  {chk.timestamp.slice(11)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
