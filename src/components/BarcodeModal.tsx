import React, { useState } from 'react';
import { X, Printer, Copy, Check, ScanLine, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import { GymProfile, Member } from '../types/gym';
import { computeSubscriptionState, generateBarcodeBars, getStatusLabelAr } from '../utils/gymLogic';
import { copyTextSafe, showPlatformToast } from '../utils/usePWAInstall';

interface BarcodeSvgProps {
  code: string;
  height?: number;
  className?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({ code, height = 56, className = '' }) => {
  const bars = generateBarcodeBars(code);
  const totalUnits = bars.reduce((acc, w) => acc + w, 0);
  const unitWidth = 2.4;
  const svgWidth = totalUnits * unitWidth + 24;

  let currentX = 12;

  return (
    <div className={`inline-flex flex-col items-center bg-white p-3 border border-slate-200 rounded-lg ${className}`}>
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        role="img"
        aria-label={`باركود العضو ${code}`}
        className="max-w-full h-auto"
      >
        <rect x="0" y="0" width={svgWidth} height={height} fill="#ffffff" />
        {bars.map((units, idx) => {
          const w = units * unitWidth;
          const x = currentX;
          currentX += w;
          // Alternate black bar / white space
          if (idx % 2 === 0) {
            return <rect key={idx} x={x} y={4} width={w} height={height - 8} fill="#0f172a" />;
          }
          return null;
        })}
      </svg>
      <span className="mt-1.5 font-mono text-xs font-semibold tracking-widest text-slate-900 tabular-nums">
        {code}
      </span>
    </div>
  );
};

interface BarcodeModalProps {
  member: Member | null;
  gymProfile: GymProfile;
  todayStr: string;
  onClose: () => void;
  onQuickCheckIn: (barcode: string) => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({
  member,
  gymProfile,
  todayStr,
  onClose,
  onQuickCheckIn,
}) => {
  const [copied, setCopied] = useState(false);

  if (!member) return null;

  const subState = computeSubscriptionState(
    member.subscription.startDate,
    member.subscription.endDate,
    member.subscription.cancelledAt,
    gymProfile.alertThresholdDays,
    todayStr
  );

  const handleCopy = async () => {
    await copyTextSafe(member.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 id="barcode-modal-title" className="text-base font-bold text-slate-900">
              بطاقة عضوية الباركود (Member ID Card)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              امسح الباركود عبر قارئ البوابة لتسجيل حضور العضو فورياً
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الباركود"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Card Container */}
        <div className="p-6">
          <div className="rounded-xl border border-slate-300 bg-slate-900 text-white p-6 relative overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs text-emerald-400 font-semibold">
                  {gymProfile.gymName}
                </p>
                <h3 className="text-lg font-bold mt-0.5 text-white">
                  {member.fullName}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-1 tabular-nums">
                  <span className="font-mono">{member.phone}</span>
                  <span aria-hidden="true">·</span>
                  <span>{member.goal}</span>
                </div>
              </div>

              <div className="text-left shrink-0">
                <span className="text-xs text-slate-400 block">حالة الاشتراك</span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold mt-0.5 ${
                    subState.status === 'active'
                      ? 'text-emerald-400'
                      : subState.status === 'expiring_soon'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {subState.status === 'active' && <ShieldCheck className="w-3.5 h-3.5" />}
                  {subState.status === 'expiring_soon' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {(subState.status === 'expired' || subState.status === 'cancelled') && (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {getStatusLabelAr(subState.status)}
                </span>
              </div>
            </div>

            {/* Subscription Details Row */}
            <div className="grid grid-cols-3 gap-4 py-4 text-xs border-b border-slate-800">
              <div>
                <span className="text-slate-400 block">الخطة المسجلة</span>
                <span className="font-semibold text-slate-100 mt-0.5 block">
                  {member.subscription.planName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">تاريخ الانتهاء</span>
                <span className="font-mono font-semibold text-slate-100 mt-0.5 block tabular-nums">
                  {member.subscription.endDate}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">الأيام المتبقية</span>
                <span className="font-mono font-semibold text-slate-100 mt-0.5 block tabular-nums">
                  {subState.status === 'cancelled'
                    ? 'ملغي'
                    : subState.remainingDays >= 0
                    ? `${subState.remainingDays} يوم`
                    : `منتهي منذ ${Math.abs(subState.remainingDays)} يوم`}
                </span>
              </div>
            </div>

            {/* SVG Barcode Centerpiece */}
            <div className="mt-5 flex flex-col items-center justify-center">
              <BarcodeSvg code={member.barcode} height={60} className="w-full max-w-xs" />
              <p className="text-[11px] text-slate-400 mt-2">
                {gymProfile.branchName} · هاتف الإدارة: <span className="font-mono">{gymProfile.phone}</span>
              </p>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم نسخ الباركود' : 'نسخ كود الباركود'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  showPlatformToast('تم تجهيز بطاقة العضوية والباركود للطباعة');
                  try {
                    window.print();
                  } catch {
                    // ignore print block in iframe
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة البطاقة</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onQuickCheckIn(member.barcode);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>محاكاة مسح الباركود وتسجيل حضور الآن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
