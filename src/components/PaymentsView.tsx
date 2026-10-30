import React, { useState } from 'react';
import {
  Wallet,
  CreditCard,
  Banknote,
  Building2,
  CheckCircle2,
  Search,
  Printer,
  X,
} from 'lucide-react';
import { GymProfile, PaymentMethod, PaymentRecord } from '../types/gym';
import { showPlatformToast } from '../utils/usePWAInstall';

interface PaymentsViewProps {
  gymProfile: GymProfile;
  payments: PaymentRecord[];
  onCollectRemainingBalance: (paymentId: string) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  gymProfile,
  payments,
  onCollectRemainingBalance,
}) => {
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

  const totalCollected = payments.reduce((s, p) => s + p.paidAmount, 0);
  const totalRemaining = payments.reduce((s, p) => s + p.remainingAmount, 0);
  const cashTotal = payments
    .filter((p) => p.method === 'cash')
    .reduce((s, p) => s + p.paidAmount, 0);
  const cardTotal = payments
    .filter((p) => p.method === 'card')
    .reduce((s, p) => s + p.paidAmount, 0);
  const transferTotal = payments
    .filter((p) => p.method === 'transfer')
    .reduce((s, p) => s + p.paidAmount, 0);

  const filteredPayments = payments.filter((p) => {
    if (methodFilter === 'pending' && p.remainingAmount <= 0) return false;
    if (
      methodFilter !== 'all' &&
      methodFilter !== 'pending' &&
      p.method !== methodFilter
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        p.memberName.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getMethodLabel = (m: PaymentMethod) => {
    if (m === 'cash') return 'نقدي (Cash)';
    if (m === 'card') return 'بطاقة بنكية (Card)';
    return 'تحويل بنكي (Transfer)';
  };

  return (
    <div className="space-y-6">
      {/* Financial KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>إجمالي المدفوعات المحصلة</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {totalCollected.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-slate-500">{gymProfile.currency}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            من إجمالي {payments.length} فاتورة مسجلة
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>مبالغ متبقية قيد التحصيل</span>
            <Banknote className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2 font-mono tabular-nums">
            {totalRemaining.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-slate-500">{gymProfile.currency}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {payments.filter((p) => p.remainingAmount > 0).length} فواتير عليها متأخرات
          </p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>محصل نقدي بالخزينة</span>
            <Banknote className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {cashTotal.toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-slate-500">{gymProfile.currency}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">خزينة الاستقبال اليومية</p>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>بطاقات بنكية وتحويلات</span>
            <CreditCard className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {(cardTotal + transferTotal).toLocaleString('en-US')}{' '}
            <span className="text-xs font-normal text-slate-500">{gymProfile.currency}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            بطاقة: {cardTotal.toLocaleString('en-US')} · تحويل: {transferTotal.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      {/* Ledger Table Card */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              سجل المدفوعات والفواتير المالية (Payments & Billing)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              متابعة فواتير الاشتراكات الجديدة والتجديدات وتحصيل المبالغ المتبقية
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الفاتورة أو العضو..."
                aria-label="بحث في المدفوعات"
                className="pr-8 pl-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMethodFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  methodFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                الكل ({payments.length})
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter('pending')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  methodFilter === 'pending'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                عليها متبقي ({payments.filter((p) => p.remainingAmount > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter('cash')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  methodFilter === 'cash' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                نقدي
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter('card')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  methodFilter === 'card' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                بطاقة بنكية
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">رقم الفاتورة والتاريخ</th>
                <th className="py-3 px-4 font-semibold">العضو والباركود</th>
                <th className="py-3 px-4 font-semibold">الباقة والنوع</th>
                <th className="py-3 px-4 font-semibold">طريقة الدفع</th>
                <th className="py-3 px-4 font-semibold">المدفوع</th>
                <th className="py-3 px-4 font-semibold">المتبقي</th>
                <th className="py-3 px-4 font-semibold text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.map((pay) => (
                <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono tabular-nums">
                    <div className="font-bold text-slate-900">{pay.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-400">{pay.date}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{pay.memberName}</div>
                    <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {pay.barcode}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{pay.planName}</div>
                    <div className="text-[11px] text-slate-500">
                      {pay.type === 'new_subscription'
                        ? 'اشتراك جديد'
                        : pay.type === 'renewal'
                        ? 'تجديد اشتراك'
                        : 'سداد قسط متبقي'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      {pay.method === 'cash' && <Banknote className="w-3.5 h-3.5 text-slate-400" />}
                      {pay.method === 'card' && <CreditCard className="w-3.5 h-3.5 text-slate-400" />}
                      {pay.method === 'transfer' && (
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      {getMethodLabel(pay.method)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-emerald-700 tabular-nums">
                    {pay.paidAmount.toLocaleString('en-US')} {gymProfile.currency}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums">
                    {pay.remainingAmount > 0 ? (
                      <span className="font-bold text-amber-700">
                        {pay.remainingAmount.toLocaleString('en-US')} {gymProfile.currency}
                      </span>
                    ) : (
                      <span className="text-slate-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        خالص
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-left">
                    <div className="inline-flex items-center gap-1.5">
                      {pay.remainingAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => onCollectRemainingBalance(pay.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors whitespace-nowrap"
                        >
                          تحصيل المتبقي ({pay.remainingAmount})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(pay)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <Printer className="w-3 h-3" />
                        <span>إيصال</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Invoice Receipt Modal */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 id="receipt-modal-title" className="text-base font-bold text-slate-900">
                  إيصال سداد اشتراك رسمي
                </h3>
                <p className="text-xs font-mono text-slate-500">{selectedReceipt.invoiceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                aria-label="إغلاق الإيصال"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs border-b border-slate-200 pb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">اسم الجيم:</span>
                <span className="font-bold text-slate-900">{gymProfile.gymName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">اسم العضو:</span>
                <span className="font-bold text-slate-900">{selectedReceipt.memberName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">كود الباركود:</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedReceipt.barcode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الباقة:</span>
                <span className="font-semibold text-slate-900">{selectedReceipt.planName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">تاريخ الفاتورة:</span>
                <span className="font-mono text-slate-900">{selectedReceipt.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">طريقة الدفع:</span>
                <span className="font-semibold text-slate-900">
                  {getMethodLabel(selectedReceipt.method)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-700 font-bold">المبلغ المدفوع:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                  {selectedReceipt.paidAmount.toLocaleString('en-US')} {gymProfile.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">المتبقي:</span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {selectedReceipt.remainingAmount.toLocaleString('en-US')} {gymProfile.currency}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الإيصال</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
