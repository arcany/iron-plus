import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  Search,
  QrCode,
  RefreshCw,
  Ban,
  ScanLine,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react';
import {
  GymProfile,
  Member,
  PaymentMethod,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../types/gym';
import {
  calculateEndDate,
  computeSubscriptionState,
  generateNextBarcode,
  getStatusLabelAr,
} from '../utils/gymLogic';

interface MembersViewProps {
  gymProfile: GymProfile;
  members: Member[];
  plans: SubscriptionPlan[];
  todayStr: string;
  isMobileShell?: boolean;
  showAddModalExternal: boolean;
  renewTargetMember: Member | null;
  onCloseAddModalExternal: () => void;
  onCloseRenewModal: () => void;
  onAddMemberWithSubscription: (payload: {
    fullName: string;
    phone: string;
    email?: string;
    gender: 'male' | 'female';
    age: number;
    weightKg?: number;
    heightCm?: number;
    goal: string;
    planId: string;
    startDate: string;
    paidAmount: number;
    paymentMethod: PaymentMethod;
    trainerName?: string;
    notes?: string;
  }) => void;
  onRenewSubscription: (payload: {
    memberId: string;
    planId: string;
    startDate: string;
    paidAmount: number;
    paymentMethod: PaymentMethod;
  }) => void;
  onCancelSubscription: (memberId: string, reason: string) => void;
  onOpenBarcodeModal: (member: Member) => void;
  onOpenRenewModalForMember: (member: Member) => void;
  onQuickCheckIn: (barcode: string) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  gymProfile,
  members,
  plans,
  todayStr,
  isMobileShell = false,
  showAddModalExternal,
  renewTargetMember,
  onCloseAddModalExternal,
  onCloseRenewModal,
  onAddMemberWithSubscription,
  onRenewSubscription,
  onCancelSubscription,
  onOpenBarcodeModal,
  onOpenRenewModalForMember,
  onQuickCheckIn,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [cancelTarget, setCancelTarget] = useState<Member | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const activePlans = plans.filter((p) => p.active);
  const defaultPlan = activePlans[0] || plans[0];

  // Add Member Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('25');
  const [weightKg, setWeightKg] = useState('78');
  const [heightCm, setHeightCm] = useState('175');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [goal, setGoal] = useState('بناء عضلات ولياقة شاملة');
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlan?.id || '');
  const [startDate, setStartDate] = useState(todayStr);
  const [paidAmount, setPaidAmount] = useState(String(defaultPlan?.price || 850));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [trainerName, setTrainerName] = useState('كابتن كريم عادل');
  const [formError, setFormError] = useState('');

  // Renew Modal State
  const [renewPlanId, setRenewPlanId] = useState(defaultPlan?.id || '');
  const [renewStartDate, setRenewStartDate] = useState(todayStr);
  const [renewPaidAmount, setRenewPaidAmount] = useState(String(defaultPlan?.price || 850));
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<PaymentMethod>('cash');
  const [renewError, setRenewError] = useState('');

  useEffect(() => {
    if (renewTargetMember) {
      setRenewPlanId(renewTargetMember.subscription.planId);
      const matchedPlan = plans.find((x) => x.id === renewTargetMember.subscription.planId);
      setRenewPaidAmount(
        String(matchedPlan ? matchedPlan.price : renewTargetMember.subscription.price)
      );
      setRenewStartDate(todayStr);
      setRenewError('');
    }
  }, [renewTargetMember, plans, todayStr]);

  const handlePlanSelectChange = (newPlanId: string) => {
    setSelectedPlanId(newPlanId);
    const found = plans.find((p) => p.id === newPlanId);
    if (found) {
      setPaidAmount(String(found.price));
    }
  };

  const handleRenewPlanChange = (newPlanId: string) => {
    setRenewPlanId(newPlanId);
    const found = plans.find((p) => p.id === newPlanId);
    if (found) {
      setRenewPaidAmount(String(found.price));
    }
  };

  const handleCreateMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setFormError('يرجى إدخال اسم العضو بالكامل.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      setFormError('يرجى إدخال رقم جوال صحيح للعضو.');
      return;
    }
    const planObj = plans.find((p) => p.id === selectedPlanId) || defaultPlan;
    if (!planObj) {
      setFormError('يرجى اختيار باقة الاشتراك.');
      return;
    }
    const numericPaid = Number(paidAmount);
    if (isNaN(numericPaid) || numericPaid < 0) {
      setFormError('يرجى إدخال المبلغ المدفوع بشكل صحيح.');
      return;
    }

    setFormError('');
    onAddMemberWithSubscription({
      fullName: fullName.trim(),
      phone: phone.trim(),
      gender,
      age: Number(age) || 25,
      weightKg: Number(weightKg) || undefined,
      heightCm: Number(heightCm) || undefined,
      goal: goal.trim() || 'لياقة عامة',
      planId: planObj.id,
      startDate: startDate || todayStr,
      paidAmount: numericPaid,
      paymentMethod,
      trainerName: trainerName.trim() || undefined,
    });

    // Reset form
    setFullName('');
    setPhone('');
    onCloseAddModalExternal();
  };

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTargetMember) return;
    const planObj = plans.find((p) => p.id === renewPlanId) || defaultPlan;
    if (!planObj) {
      setRenewError('يرجى اختيار خطة الاشتراك للتجديد.');
      return;
    }
    const numericPaid = Number(renewPaidAmount);
    if (isNaN(numericPaid) || numericPaid < 0) {
      setRenewError('يرجى إدخال مبلغ السداد بشكل صحيح.');
      return;
    }
    setRenewError('');
    onRenewSubscription({
      memberId: renewTargetMember.id,
      planId: planObj.id,
      startDate: renewStartDate || todayStr,
      paidAmount: numericPaid,
      paymentMethod: renewPaymentMethod,
    });
    onCloseRenewModal();
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    if (!cancelReason.trim()) return;
    onCancelSubscription(cancelTarget.id, cancelReason.trim());
    setCancelTarget(null);
    setCancelReason('');
  };

  const enrichedMembers = members.map((m) => ({
    member: m,
    state: computeSubscriptionState(
      m.subscription.startDate,
      m.subscription.endDate,
      m.subscription.cancelledAt,
      gymProfile.alertThresholdDays,
      todayStr
    ),
  }));

  const filteredMembers = enrichedMembers.filter(({ member, state }) => {
    if (statusFilter !== 'all' && state.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        member.fullName.toLowerCase().includes(q) ||
        member.barcode.toLowerCase().includes(q) ||
        member.phone.toLowerCase().includes(q) ||
        member.subscription.planName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    all: enrichedMembers.length,
    active: enrichedMembers.filter((x) => x.state.status === 'active').length,
    expiring_soon: enrichedMembers.filter((x) => x.state.status === 'expiring_soon').length,
    expired: enrichedMembers.filter((x) => x.state.status === 'expired').length,
    cancelled: enrichedMembers.filter((x) => x.state.status === 'cancelled').length,
  };

  const selectedPlanForPreview = plans.find((p) => p.id === selectedPlanId) || defaultPlan;
  const previewEndDate = selectedPlanForPreview
    ? calculateEndDate(startDate || todayStr, selectedPlanForPreview.durationDays)
    : todayStr;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              إدارة الأعضاء والاشتراكات (Members & Subscriptions)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              بيانات الأعضاء، توليد الباركود الفردي، وتسجيل أو تجديد أو إلغاء الاشتراكات
            </p>
          </div>
        </div>

        {/* Search & Segmented Status Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Interactive Filter Tabs */}
          <div
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            role="tablist"
            aria-label="تصفية الأعضاء حسب حالة الاشتراك"
          >
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({counts.all})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'active'}
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نشط Active ({counts.active})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'expiring_soon'}
              onClick={() => setStatusFilter('expiring_soon')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'expiring_soon'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              قارب على الانتهاء ({counts.expiring_soon})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'expired'}
              onClick={() => setStatusFilter('expired')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'expired'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              منتهي Expired ({counts.expired})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'cancelled'}
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'cancelled'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ملغي Cancelled ({counts.cancelled})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، رقم الجوال، أو الباركود..."
              aria-label="بحث في قائمة الأعضاء"
              className="w-full min-h-[40px] pr-9 pl-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Members High-Density Data Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              لا توجد نتائج مطابقة لفلتر البحث الحالي
            </p>
            <p className="text-xs text-slate-500">
              جرب تغيير حالة الفلتر أو البحث بكود باركود آخر.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
            >
              إعادة ضبط الفلتر
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Responsive Member Cards */}
            <div className={isMobileShell ? 'divide-y divide-slate-200' : 'md:hidden divide-y divide-slate-200'}>
              {filteredMembers.map(({ member, state }) => (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{member.fullName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {member.phone} · {member.age} سنة · {member.goal}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenBarcodeModal(member)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 font-mono text-xs font-bold whitespace-nowrap shrink-0 tabular-nums"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{member.barcode}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        {member.subscription.planName}
                      </span>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        ينتهي: {member.subscription.endDate} · الحضور: {member.totalCheckIns} زيارة
                      </span>
                    </div>
                    <div className="font-semibold text-xs">
                      {state.status === 'active' && (
                        <span className="text-emerald-700">
                          نشط ({state.remainingDays} يوم)
                        </span>
                      )}
                      {state.status === 'expiring_soon' && (
                        <span className="text-amber-700">
                          قارب الانتهاء ({state.remainingDays} أيام)
                        </span>
                      )}
                      {state.status === 'expired' && (
                        <span className="text-rose-700">
                          منتهي منذ {Math.abs(state.remainingDays)} يوم
                        </span>
                      )}
                      {state.status === 'cancelled' && (
                        <span className="text-slate-600">ملغي</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onQuickCheckIn(member.barcode)}
                      className="min-h-[40px] px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <ScanLine className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>تسجيل حضور</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenewPlanId(member.subscription.planId);
                        const p = plans.find((x) => x.id === member.subscription.planId);
                        setRenewPaidAmount(String(p ? p.price : member.subscription.price));
                        onOpenRenewModalForMember(member);
                      }}
                      className="min-h-[40px] px-2 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span>تجديد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenBarcodeModal(member)}
                      className="min-h-[40px] px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <QrCode className="w-3.5 h-3.5 shrink-0" />
                      <span>البطاقة</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop High-Density Table */}
            <div className={isMobileShell ? 'hidden' : 'hidden md:block overflow-x-auto'}>
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">العضو والبيانات</th>
                    <th className="py-3.5 px-4 font-semibold">كود الباركود</th>
                    <th className="py-3.5 px-4 font-semibold">باقة الاشتراك</th>
                    <th className="py-3.5 px-4 font-semibold">فترة الاشتراك</th>
                    <th className="py-3.5 px-4 font-semibold">حالة الاشتراك</th>
                    <th className="py-3.5 px-4 font-semibold">مرات الحضور</th>
                    <th className="py-3.5 px-4 font-semibold text-left">إجراءات التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map(({ member, state }) => (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{member.fullName}</div>
                        <div className="text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5 tabular-nums">
                          <span className="font-mono">{member.phone}</span>
                          <span aria-hidden="true">·</span>
                          <span>{member.age} سنة</span>
                          {member.weightKg && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{member.weightKg} كجم</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{member.goal}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenBarcodeModal(member)}
                          className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-800 hover:text-emerald-700 underline-offset-4 hover:underline tabular-nums whitespace-nowrap"
                          aria-label={`عرض وطباعة باركود ${member.fullName}`}
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{member.barcode}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {member.subscription.planName}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {member.subscription.price.toLocaleString('en-US')} {gymProfile.currency}
                          {member.subscription.trainerName
                            ? ` · ${member.subscription.trainerName}`
                            : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                        <div>من: {member.subscription.startDate}</div>
                        <div>إلى: {member.subscription.endDate}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
                          {state.status === 'active' && (
                            <>
                              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="text-emerald-700">
                                نشط · متبقي {state.remainingDays} يوم
                              </span>
                            </>
                          )}
                          {state.status === 'expiring_soon' && (
                            <>
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="text-amber-700">
                                قارب على الانتهاء · {state.remainingDays} أيام
                              </span>
                            </>
                          )}
                          {state.status === 'expired' && (
                            <>
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span className="text-rose-700">
                                منتهي · منذ {Math.abs(state.remainingDays)} يوم
                              </span>
                            </>
                          )}
                          {state.status === 'cancelled' && (
                            <>
                              <Ban className="w-4 h-4 text-slate-500 shrink-0" />
                              <span className="text-slate-600">
                                ملغي ({member.subscription.cancelReason || 'إداري'})
                              </span>
                            </>
                          )}
                        </div>
                        <div className="mt-1.5 w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${state.progressPercent}%` }}
                            className={`h-full ${
                              state.status === 'active'
                                ? 'bg-emerald-600'
                                : state.status === 'expiring_soon'
                                ? 'bg-amber-500'
                                : state.status === 'expired'
                                ? 'bg-rose-600'
                                : 'bg-slate-400'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 tabular-nums text-slate-700 whitespace-nowrap">
                        <div className="font-bold">{member.totalCheckIns} زيارة</div>
                        <div className="text-[11px] text-slate-400">
                          {member.lastCheckIn
                            ? `آخر حضور: ${member.lastCheckIn.slice(0, 10)}`
                            : 'لم يحضر بعد'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-left whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onQuickCheckIn(member.barcode)}
                            aria-label={`تسجيل حضور ${member.fullName}`}
                            title="تسجيل حضور (Check-in)"
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
                            <span>حضور</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRenewPlanId(member.subscription.planId);
                              const p = plans.find((x) => x.id === member.subscription.planId);
                              setRenewPaidAmount(String(p ? p.price : member.subscription.price));
                              onOpenRenewModalForMember(member);
                            }}
                            aria-label={`تجديد اشتراك ${member.fullName}`}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>تجديد</span>
                          </button>

                          {state.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTarget(member);
                                setCancelReason('طلب العضو إيقاف الاشتراك');
                              }}
                              aria-label={`إلغاء اشتراك ${member.fullName}`}
                              title="إلغاء الاشتراك"
                              className="min-h-[36px] p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal 1: Add New Member & Subscription */}
      {showAddModalExternal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-modal-title"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 id="add-member-modal-title" className="text-base font-bold text-slate-900">
                  تسجيل عضو جديد وإصدار باركود واشتراك
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  سيتم إصدار الباركود التلقائي{' '}
                  <span className="font-mono font-bold text-emerald-700">
                    {generateNextBarcode(members)}
                  </span>{' '}
                  فور الحفظ
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseAddModalExternal}
                aria-label="إغلاق نافذة تسجيل عضو جديد"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMemberSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="member-fullname-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    الاسم الرباعي للعضو *
                  </label>
                  <input
                    id="member-fullname-input"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: محمود سامي عبد القادر"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="member-phone-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    رقم الجوال (للتنبيهات والبحث) *
                  </label>
                  <input
                    id="member-phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label
                      htmlFor="member-age-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      العمر
                    </label>
                    <input
                      id="member-age-input"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="member-weight-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      الوزن (كجم)
                    </label>
                    <input
                      id="member-weight-input"
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="member-height-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      الطول (سم)
                    </label>
                    <input
                      id="member-height-input"
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="member-goal-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    الهدف الرياضي
                  </label>
                  <input
                    id="member-goal-input"
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="ضخامة عضلية / إنقاص وزن / لياقة"
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Subscription Plan Selection Section */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold text-slate-900 mb-3">
                  بيانات خطة الاشتراك والمدفوعات
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="member-plan-select"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      خطة الاشتراك *
                    </label>
                    <select
                      id="member-plan-select"
                      value={selectedPlanId}
                      onChange={(e) => handlePlanSelectChange(e.target.value)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                    >
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.price} {gymProfile.currency} ({p.durationDays} يوم)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="member-startdate-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      تاريخ بداية الاشتراك
                    </label>
                    <input
                      id="member-startdate-input"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="member-paid-input"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      المبلغ المدفوع الآن ({gymProfile.currency})
                    </label>
                    <input
                      id="member-paid-input"
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="member-paymethod-select"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      طريقة الدفع
                    </label>
                    <select
                      id="member-paymethod-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="cash">نقدي بالخزينة (Cash)</option>
                      <option value="card">بطاقة بنكية / مدى / فيزا</option>
                      <option value="transfer">تحويل بنكي / محفظة إلكترونية</option>
                    </select>
                  </div>
                </div>

                {/* Summary Box */}
                <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">تاريخ الانتهاء المحسوب تلقائياً: </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {previewEndDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">المتبقي بالذمة: </span>
                    <span className="font-mono font-bold text-amber-700 tabular-nums">
                      {Math.max(0, (selectedPlanForPreview?.price || 0) - Number(paidAmount || 0))}{' '}
                      {gymProfile.currency}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onCloseAddModalExternal}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition-colors"
                >
                  حفظ العضو وتفعيل الاشتراك والباركود
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Renew Member Subscription */}
      {renewTargetMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="renew-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 id="renew-modal-title" className="text-base font-bold text-slate-900">
                  تجديد اشتراك العضو
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {renewTargetMember.fullName} ({renewTargetMember.barcode})
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseRenewModal}
                aria-label="إغلاق نافذة التجديد"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="p-6 space-y-4">
              {renewError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {renewError}
                </div>
              )}

              <div>
                <label
                  htmlFor="renew-plan-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  اختر باقة التجديد
                </label>
                <select
                  id="renew-plan-select"
                  value={renewPlanId}
                  onChange={(e) => handleRenewPlanChange(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.price} {gymProfile.currency} ({p.durationDays} يوم)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="renew-start-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    تاريخ بدء التجديد
                  </label>
                  <input
                    id="renew-start-input"
                    type="date"
                    value={renewStartDate}
                    onChange={(e) => setRenewStartDate(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="renew-paid-input"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    المبلغ المدفوع ({gymProfile.currency})
                  </label>
                  <input
                    id="renew-paid-input"
                    type="number"
                    value={renewPaidAmount}
                    onChange={(e) => setRenewPaidAmount(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="renew-method-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  طريقة السداد
                </label>
                <select
                  id="renew-method-select"
                  value={renewPaymentMethod}
                  onChange={(e) => setRenewPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="cash">نقدي (Cash)</option>
                  <option value="card">بطاقة بنكية (Card)</option>
                  <option value="transfer">تحويل بنكي (Transfer)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseRenewModal}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
                >
                  تأكيد التجديد وإصدار الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Cancel Subscription Confirmation */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-sub-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <h3 id="cancel-sub-title" className="text-base font-bold text-slate-900">
              إلغاء اشتراك العضو: {cancelTarget.fullName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              سيتم تحويل حالة الاشتراك إلى «ملغي (Cancelled)» وإيقاف صلاحية الباركود على البوابة حتى يتم التجديد.
            </p>
            <form onSubmit={handleConfirmCancel} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="cancel-reason-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  سبب الإلغاء *
                </label>
                <input
                  id="cancel-reason-input"
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white"
                >
                  تأكيد إلغاء الاشتراك
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
