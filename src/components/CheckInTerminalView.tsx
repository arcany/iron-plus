import React, { useState } from 'react';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  QrCode,
  Search,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { CheckInEvaluation, CheckInRecord, GymProfile, Member } from '../types/gym';
import { BarcodeSvg } from './BarcodeModal';
import { computeSubscriptionState, getStatusLabelAr } from '../utils/gymLogic';

interface CheckInTerminalViewProps {
  gymProfile: GymProfile;
  members: Member[];
  checkIns: CheckInRecord[];
  todayStr: string;
  lastEvaluation: CheckInEvaluation | null;
  onScanBarcode: (barcode: string) => void;
  onOpenRenewMember: (member: Member) => void;
  onOpenBarcodeModal: (member: Member) => void;
}

export const CheckInTerminalView: React.FC<CheckInTerminalViewProps> = ({
  gymProfile,
  members,
  checkIns,
  todayStr,
  lastEvaluation,
  onScanBarcode,
  onOpenRenewMember,
  onOpenBarcodeModal,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'allowed' | 'denied'>('all');
  const [searchLog, setSearchLog] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    onScanBarcode(barcodeInput.trim());
    setBarcodeInput('');
  };

  const filteredCheckIns = checkIns.filter((c) => {
    if (filterMode === 'allowed' && !c.allowed) return false;
    if (filterMode === 'denied' && c.allowed) return false;
    if (searchLog.trim()) {
      const q = searchLog.trim().toLowerCase();
      return (
        c.memberName.toLowerCase().includes(q) ||
        c.barcode.toLowerCase().includes(q) ||
        c.planName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Gate Scanner Terminal Header & Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left/Right Scanner Form (6 cols) */}
        <div className="lg:col-span-6 rounded-xl bg-white border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  بوابة تسجيل الحضور والباركود (Check-in Terminal)
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  متوافق مع قارئ الباركود الليزري (USB Scanner) أو البحث بكود العضوية ورقم الجوال
                </p>
              </div>
              <ScanLine className="w-6 h-6 text-emerald-600 shrink-0" />
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <label
                htmlFor="gate-barcode-input"
                className="block text-xs font-semibold text-slate-700"
              >
                امسح باركود العضو أو اكتب الكود ثم اضغط إدخال (Enter):
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  id="gate-barcode-input"
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="مثال: GYM-1001 أو 01012345678"
                  autoFocus
                  className="flex-1 min-h-[46px] rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-mono text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  تحقق وتسجيل حضور
                </button>
              </div>
            </form>

            {/* Quick Barcode Simulator Buttons for all statuses */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2.5">
                أزرار محاكاة قارئ الباركود السريعة (اضغط لمحاكاة مسح البطاقة على البوابة):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {members.slice(0, 6).map((m) => {
                  const st = computeSubscriptionState(
                    m.subscription.startDate,
                    m.subscription.endDate,
                    m.subscription.cancelledAt,
                    gymProfile.alertThresholdDays,
                    todayStr
                  );
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onScanBarcode(m.barcode)}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-right transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {m.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {m.barcode} ·{' '}
                          <span
                            className={
                              st.status === 'active'
                                ? 'text-emerald-700 font-semibold'
                                : st.status === 'expiring_soon'
                                ? 'text-amber-700 font-semibold'
                                : 'text-rose-700 font-semibold'
                            }
                          >
                            {getStatusLabelAr(st.status)}
                          </span>
                        </div>
                      </div>
                      <ScanLine className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Live Gate Verification Display Card (6 cols) */}
        <div className="lg:col-span-6 rounded-xl bg-white border border-slate-200 p-6 flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              شاشة نتيجة التحقق من العضو (Gate Status)
            </h2>
            <span className="text-xs font-mono text-slate-400 tabular-nums">{todayStr}</span>
          </div>

          {lastEvaluation ? (
            <div className="my-auto py-4">
              <div
                className={`rounded-xl border p-5 ${
                  !lastEvaluation.allowed
                    ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                    : lastEvaluation.status === 'expiring_soon'
                    ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                    : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {lastEvaluation.allowed ? (
                      lastEvaluation.status === 'expiring_soon' ? (
                        <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
                      )
                    ) : (
                      <XCircle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h3 className="text-base font-bold">{lastEvaluation.messageTitle}</h3>
                      <p className="text-xs mt-1 leading-relaxed">{lastEvaluation.messageDetail}</p>
                    </div>
                  </div>
                </div>

                {lastEvaluation.member && lastEvaluation.subscriptionState && (
                  <div className="mt-4 pt-4 border-t border-black/10 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="opacity-70 block">اسم العضو</span>
                      <span className="font-bold block mt-0.5">
                        {lastEvaluation.member.fullName}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">باقة الاشتراك</span>
                      <span className="font-bold block mt-0.5">
                        {lastEvaluation.member.subscription.planName}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">تاريخ الانتهاء</span>
                      <span className="font-mono font-bold block mt-0.5 tabular-nums">
                        {lastEvaluation.member.subscription.endDate}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">إجمالي مرات الحضور</span>
                      <span className="font-mono font-bold block mt-0.5 tabular-nums">
                        {lastEvaluation.member.totalCheckIns} زيارة
                      </span>
                    </div>
                    <div>
                      <span className="opacity-70 block">المدرب المتابع</span>
                      <span className="font-bold block mt-0.5">
                        {lastEvaluation.member.subscription.trainerName || 'إشراف عام'}
                      </span>
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenBarcodeModal(lastEvaluation.member!)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-900 font-semibold text-xs border border-black/10 inline-flex items-center gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>البطاقة</span>
                      </button>
                      {!lastEvaluation.allowed && (
                        <button
                          type="button"
                          onClick={() => onOpenRenewMember(lastEvaluation.member!)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>تجديد</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {lastEvaluation.member && (
                <div className="mt-4 flex justify-center">
                  <BarcodeSvg code={lastEvaluation.member.barcode} height={44} />
                </div>
              )}
            </div>
          ) : (
            <div className="my-auto py-12 text-center space-y-2">
              <ScanLine className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                في انتظار مسح باركود العضو...
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                قم بمسح البطاقة أو اختر أحد الأعضاء من أزرار المحاكاة لعرض حالة الاشتراك وتاريخ الانتهاء وعدد الأيام المتبقية.
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              دخول مسموح اليوم: {checkIns.filter((c) => c.date === todayStr && c.allowed).length}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              دخول مرفوض اليوم: {checkIns.filter((c) => c.date === todayStr && !c.allowed).length}
            </span>
          </div>
        </div>
      </div>

      {/* Attendance Log Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              سجل حركة الدخول والحضور (Attendance Log)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              توثيق كامل لجميع عمليات مسح الباركود المقبولة والمرفوضة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="بحث بالاسم أو الباركود..."
                aria-label="بحث في سجل الحضور"
                className="pr-8 pl-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({checkIns.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('allowed')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  filterMode === 'allowed'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مسموح ({checkIns.filter((c) => c.allowed).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('denied')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  filterMode === 'denied'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                مرفوض ({checkIns.filter((c) => !c.allowed).length})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">التوقيت</th>
                <th className="py-3 px-4 font-semibold">العضو</th>
                <th className="py-3 px-4 font-semibold">الباركود</th>
                <th className="py-3 px-4 font-semibold">الباقة</th>
                <th className="py-3 px-4 font-semibold">قرار البوابة</th>
                <th className="py-3 px-4 font-semibold">ملاحظة النظام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCheckIns.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                    {rec.timestamp}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{rec.memberName}</td>
                  <td className="py-3 px-4 font-mono text-slate-700 tabular-nums">{rec.barcode}</td>
                  <td className="py-3 px-4 text-slate-600">{rec.planName}</td>
                  <td className="py-3 px-4">
                    {rec.allowed ? (
                      <span
                        className={`font-semibold ${
                          rec.statusAtEntry === 'expiring_soon'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        مسموح بالدخول · {getStatusLabelAr(rec.statusAtEntry)}
                      </span>
                    ) : (
                      <span className="font-semibold text-rose-700">
                        دخول مرفوض · {getStatusLabelAr(rec.statusAtEntry)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{rec.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
