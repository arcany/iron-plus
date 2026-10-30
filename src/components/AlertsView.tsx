import React, { useState } from 'react';
import {
  BellRing,
  AlertTriangle,
  XCircle,
  RefreshCw,
  MessageSquare,
  Check,
  QrCode,
} from 'lucide-react';
import { GymAlert, GymProfile, Member } from '../types/gym';

interface AlertsViewProps {
  gymProfile: GymProfile;
  alerts: GymAlert[];
  members: Member[];
  onMarkAlertNotified: (memberId: string) => void;
  onUpdateAlertThreshold: (days: number) => void;
  onOpenRenewMember: (member: Member) => void;
  onOpenBarcodeModal: (member: Member) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  gymProfile,
  alerts,
  members,
  onMarkAlertNotified,
  onUpdateAlertThreshold,
  onOpenRenewMember,
  onOpenBarcodeModal,
}) => {
  const [tab, setTab] = useState<'all' | 'expiring_soon' | 'expired'>('all');
  const [selectedWhatsappAlert, setSelectedWhatsappAlert] = useState<GymAlert | null>(null);

  const expiringAlerts = alerts.filter((a) => a.alertType === 'expiring_soon');
  const expiredAlerts = alerts.filter((a) => a.alertType === 'expired');

  const displayedAlerts = alerts.filter((a) => {
    if (tab === 'expiring_soon') return a.alertType === 'expiring_soon';
    if (tab === 'expired') return a.alertType === 'expired';
    return true;
  });

  const buildReminderMessage = (alert: GymAlert) => {
    if (alert.alertType === 'expiring_soon') {
      return `مرحباً كابتن ${alert.memberName}، نود تذكيرك من إدارة (${gymProfile.gymName}) بأن اشتراكك في (${alert.planName}) سينتهي بتاريخ ${alert.endDate} (متبقي ${alert.remainingDays} أيام). يسعدنا تجديد اشتراكك لاستمرار تمرينك بدون انقطاع!`;
    }
    return `مرحباً كابتن ${alert.memberName}، نود إشعارك من إدارة (${gymProfile.gymName}) بأن اشتراكك في (${alert.planName}) قد انتهى بتاريخ ${alert.endDate}. نرحب بك في الاستقبال لتجديد باقتك والعودة للتمرين!`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Alert Threshold Settings */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-600" />
            <h1 className="text-lg font-bold text-slate-900">
              مركز التنبيهات ومتابعة انتهاء الاشتراكات
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تنبيهات تلقائية للاشتراكات التي قاربت على الانتهاء أو انتهت فعلياً مع إرسال رسائل تذكير وتجديد فوري
          </p>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 shrink-0">
          <label htmlFor="threshold-days-select" className="text-xs font-semibold text-slate-700">
            التنبيه قبل انتهاء الاشتراك بـ:
          </label>
          <select
            id="threshold-days-select"
            value={gymProfile.alertThresholdDays}
            onChange={(e) => onUpdateAlertThreshold(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-900"
          >
            <option value={3}>3 أيام</option>
            <option value={5}>5 أيام</option>
            <option value={7}>7 أيام</option>
            <option value={10}>10 أيام</option>
            <option value={14}>14 يوم</option>
          </select>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            tab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          جميع التنبيهات ({alerts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('expiring_soon')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            tab === 'expiring_soon' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          قاربت على الانتهاء ({expiringAlerts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('expired')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            tab === 'expired' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
          }`}
        >
          اشتراكات منتهية ({expiredAlerts.length})
        </button>
      </div>

      {/* Alerts List */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        {displayedAlerts.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            لا توجد اشتراكات منتهية أو قريبة من الانتهاء ضمن هذا التصنيف حالياً.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedAlerts.map((alert) => {
              const memberObj = members.find((m) => m.id === alert.memberId);
              return (
                <div
                  key={alert.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    {alert.alertType === 'expiring_soon' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{alert.memberName}</h3>
                        <span className="text-xs font-mono text-slate-500 tabular-nums">
                          {alert.barcode} · {alert.phone}
                        </span>
                        {alert.notified && (
                          <span className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                            · <Check className="w-3 h-3" /> تم إرسال التذكير
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 mt-1">
                        الباقة: <strong>{alert.planName}</strong> · تاريخ الانتهاء:{' '}
                        <span className="font-mono font-semibold tabular-nums">{alert.endDate}</span>{' '}
                        ·{' '}
                        {alert.alertType === 'expiring_soon' ? (
                          <span className="font-bold text-amber-700">
                            متبقي {alert.remainingDays} أيام فقط
                          </span>
                        ) : (
                          <span className="font-bold text-rose-700">
                            منتهي منذ {Math.abs(alert.remainingDays)} يوم
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedWhatsappAlert(alert)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>رسالة تذكير للعضو</span>
                    </button>

                    {memberObj && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenBarcodeModal(memberObj)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>الباركود</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenRenewMember(memberObj)}
                          className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>تجديد الاشتراك الآن</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reminder Message Preview & Send Modal */}
      {selectedWhatsappAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <h3 id="reminder-modal-title" className="text-base font-bold text-slate-900">
              إرسال تنبيه تجديد الاشتراك للعضو
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              العضو: {selectedWhatsappAlert.memberName} ({selectedWhatsappAlert.phone})
            </p>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-800">
              {buildReminderMessage(selectedWhatsappAlert)}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedWhatsappAlert(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => {
                  onMarkAlertNotified(selectedWhatsappAlert.memberId);
                  setSelectedWhatsappAlert(null);
                }}
                className="min-h-[40px] px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد إرسال التنبيه للعضو</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
