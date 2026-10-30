import React, { useState } from 'react';
import {
  Dumbbell,
  ScanLine,
  Users,
  Layers,
  Wallet,
  Download,
  UserPlus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  QrCode,
  MessageCircle,
  Plus,
  Maximize2,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  Clock,
  CreditCard,
  TrendingUp,
  BellRing,
  Settings,
  Trash2,
  Copy,
  Check,
  Wifi,
  BatteryCharging,
  Sparkles,
  Ban,
  RotateCcw,
} from 'lucide-react';
import {
  GymProfile,
  SubscriptionPlan,
  Member,
  PaymentRecord,
  CheckInRecord,
  GymAlert,
  DashboardMetrics,
  CheckInEvaluation,
  PaymentMethod,
  SubscriptionStatus,
} from '../types/gym';
import { computeSubscriptionState } from '../utils/gymLogic';
import {
  usePWAInstall,
  triggerAndroidPackageDownload,
  copyTextSafe,
  showPlatformToast,
} from '../utils/usePWAInstall';
import {
  createGitHubRepoAndPushProject,
  GitHubDeviceCodeResponse,
  GitHubPushProgress,
  pollGitHubDeviceFlowToken,
  startGitHubDeviceFlow,
} from '../utils/githubCloudflareDeploy';

export type NativeAppTab =
  | 'home'
  | 'gate'
  | 'members'
  | 'plans'
  | 'finance'
  | 'install';

interface NativeMobileAppShellProps {
  osType: 'android' | 'ios';
  activeTab: NativeAppTab;
  onChangeTab: (tab: NativeAppTab) => void;
  gymProfile: GymProfile;
  metrics: DashboardMetrics;
  members: Member[];
  plans: SubscriptionPlan[];
  payments: PaymentRecord[];
  checkIns: CheckInRecord[];
  alerts: GymAlert[];
  todayStr: string;
  lastCheckInResult: CheckInEvaluation | null;
  onPerformCheckIn: (barcode: string) => void;
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
  onAddPlan: (newPlan: Omit<SubscriptionPlan, 'id'>) => void;
  onTogglePlanActive: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
  onCollectRemainingBalance: (paymentId: string) => void;
  onMarkAlertNotified: (memberId: string) => void;
  onSaveGymProfile: (profile: GymProfile) => void;
  onResetDemoData: () => void;
  onOpenBarcodeModal: (member: Member) => void;
  onOpenRepoPortal?: () => void;
}

const DEV_APP_URL =
  'https://ais-dev-7c4dtny763c3a7gcena3uq-159508686400.europe-west2.run.app';

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US')} ${currency}`;
}

function buildWhatsAppLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('05')
    ? `966${digits.slice(1)}`
    : digits.startsWith('01')
    ? `20${digits}`
    : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export const NativeMobileAppShell: React.FC<NativeMobileAppShellProps> = ({
  osType,
  activeTab,
  onChangeTab,
  gymProfile,
  metrics,
  members,
  plans,
  payments,
  checkIns,
  alerts,
  todayStr,
  lastCheckInResult,
  onPerformCheckIn,
  onAddMemberWithSubscription,
  onRenewSubscription,
  onCancelSubscription,
  onAddPlan,
  onTogglePlanActive,
  onDeletePlan,
  onCollectRemainingBalance,
  onMarkAlertNotified,
  onSaveGymProfile,
  onResetDemoData,
  onOpenBarcodeModal,
  onOpenRepoPortal,
}) => {
  const isAndroid = osType === 'android';
  const {
    platformMode,
    setPlatformMode,
    enterTrueFullscreenApp,
    installAndroid,
    installIOS,
  } = usePWAInstall();

  // Gate Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [gateLaserActive, setGateLaserActive] = useState(true);

  // Members Filter & Search State
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<
    'all' | SubscriptionStatus
  >('all');

  // Finance Sub-tab State
  const [financeSubTab, setFinanceSubTab] = useState<
    'invoices' | 'reports' | 'settings'
  >('invoices');
  const [onlyPendingPayments, setOnlyPendingPayments] = useState(false);

  // Native Bottom Sheets State
  const [showAddMemberSheet, setShowAddMemberSheet] = useState(false);
  const [renewMemberTarget, setRenewMemberTarget] = useState<Member | null>(
    null
  );
  const [cancelMemberTarget, setCancelMemberTarget] = useState<Member | null>(
    null
  );
  const [showAddPlanSheet, setShowAddPlanSheet] = useState(false);

  // Add Member Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberGender, setNewMemberGender] = useState<'male' | 'female'>(
    'male'
  );
  const [newMemberTrainer, setNewMemberTrainer] = useState('');
  const [newMemberPlanId, setNewMemberPlanId] = useState(
    plans[0]?.id || 'plan-1m'
  );
  const [newMemberPaidAmount, setNewMemberPaidAmount] = useState<string>(
    String(plans[0]?.price || 250)
  );
  const [newMemberPaymentMethod, setNewMemberPaymentMethod] =
    useState<PaymentMethod>('cash');
  const [addMemberError, setAddMemberError] = useState('');

  // Renew Form State
  const [renewPlanId, setRenewPlanId] = useState(plans[0]?.id || 'plan-1m');
  const [renewPaidAmount, setRenewPaidAmount] = useState<string>(
    String(plans[0]?.price || 250)
  );
  const [renewMethod, setRenewMethod] = useState<PaymentMethod>('cash');

  // Cancel Form State
  const [cancelReason, setCancelReason] = useState('طلب المشترك إيقاف الاشتراك');

  // Add Plan Form State
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDays, setNewPlanDays] = useState('30');
  const [newPlanPrice, setNewPlanPrice] = useState('250');
  const [newPlanDesc, setNewPlanDesc] = useState(
    'دخول شامل لجميع صالات الحديد والكارديو'
  );
  const [planFormError, setPlanFormError] = useState('');

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<GymProfile>(gymProfile);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // GitHub & Cloudflare Repository Creation State
  const [ghToken, setGhToken] = useState('');
  const [ghRepoName, setGhRepoName] = useState('iron-plus');
  const [ghProgress, setGhProgress] = useState<GitHubPushProgress | null>(null);
  const [ghCreatedRepoUrl, setGhCreatedRepoUrl] = useState<string | null>(null);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [deviceAuth, setDeviceAuth] =
    useState<GitHubDeviceCodeResponse | null>(null);
  const [devicePolling, setDevicePolling] = useState(false);

  const liveOrigin =
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.origin.includes('localhost')
      ? window.location.origin
      : DEV_APP_URL;

  const standaloneLaunchUrl = `${liveOrigin}/?app=native&platform=${osType}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
    standaloneLaunchUrl
  )}`;

  // Enrich members with computed state
  const enrichedMembers = members.map((m) => {
    const state = computeSubscriptionState(
      m.subscription.startDate,
      m.subscription.endDate,
      m.subscription.cancelledAt,
      gymProfile.alertThresholdDays,
      todayStr
    );
    const initials = m.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('');
    return {
      member: m,
      state,
      initials: initials || 'IP',
    };
  });

  // Filtered Members
  const filteredMembers = enrichedMembers.filter(({ member, state }) => {
    const matchesStatus =
      memberStatusFilter === 'all' || state.status === memberStatusFilter;
    const q = memberSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      member.fullName.toLowerCase().includes(q) ||
      member.barcode.toLowerCase().includes(q) ||
      member.phone.includes(q);
    return matchesStatus && matchesQuery;
  });

  // Filtered Payments
  const filteredPayments = payments.filter((p) =>
    onlyPendingPayments ? p.remainingAmount > 0 : true
  );

  const handleGateScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    onPerformCheckIn(barcodeInput.trim());
    setBarcodeInput('');
  };

  const handleOpenAddMember = () => {
    const defaultPlan = plans.find((p) => p.active) || plans[0];
    setNewMemberPlanId(defaultPlan?.id || '');
    setNewMemberPaidAmount(String(defaultPlan?.price || 250));
    setAddMemberError('');
    setShowAddMemberSheet(true);
  };

  const handleSubmitNewMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setAddMemberError('يرجى إدخال اسم المشترك الكامل');
      return;
    }
    if (!newMemberPhone.trim()) {
      setAddMemberError('يرجى إدخال رقم الجوال');
      return;
    }
    onAddMemberWithSubscription({
      fullName: newMemberName.trim(),
      phone: newMemberPhone.trim(),
      gender: newMemberGender,
      age: 26,
      goal: 'بناء عضلات ولياقة شاملة',
      planId: newMemberPlanId,
      startDate: todayStr,
      paidAmount: Math.max(0, Number(newMemberPaidAmount) || 0),
      paymentMethod: newMemberPaymentMethod,
      trainerName: newMemberTrainer.trim() || undefined,
    });
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberTrainer('');
    setShowAddMemberSheet(false);
    showPlatformToast('تم تسجيل المشترك وإصدار بطاقة الباركود بنجاح!');
  };

  const handleOpenRenewSheet = (member: Member) => {
    const currentPlan =
      plans.find((p) => p.id === member.subscription.planId) || plans[0];
    setRenewMemberTarget(member);
    setRenewPlanId(currentPlan?.id || '');
    setRenewPaidAmount(String(currentPlan?.price || 250));
    setRenewMethod('cash');
  };

  const handleSubmitRenew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewMemberTarget) return;
    onRenewSubscription({
      memberId: renewMemberTarget.id,
      planId: renewPlanId,
      startDate: todayStr,
      paidAmount: Math.max(0, Number(renewPaidAmount) || 0),
      paymentMethod: renewMethod,
    });
    setRenewMemberTarget(null);
    showPlatformToast(`تم تجديد اشتراك ${renewMemberTarget.fullName} بنجاح!`);
  };

  const handleSubmitCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelMemberTarget) return;
    onCancelSubscription(
      cancelMemberTarget.id,
      cancelReason.trim() || 'إيقاف بناءً على طلب المشترك'
    );
    setCancelMemberTarget(null);
    showPlatformToast('تم إيقاف الاشتراك وتحديث حالة البوابة');
  };

  const handleSubmitNewPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) {
      setPlanFormError('يرجى إدخال اسم الباقة');
      return;
    }
    onAddPlan({
      name: newPlanName.trim(),
      category: 'شامل',
      durationDays: Math.max(1, Number(newPlanDays) || 30),
      price: Math.max(1, Number(newPlanPrice) || 250),
      description: newPlanDesc.trim(),
      features: [
        'دخول بوابة الباركود الذكية',
        'صالة الحديد والكارديو الكاملة',
        'متابعة اللياقة البدنية',
      ],
      freezeDaysAllowed: 7,
      invitationsCount: 2,
      active: true,
    });
    setNewPlanName('');
    setPlanFormError('');
    setShowAddPlanSheet(false);
    showPlatformToast('تمت إضافة باقة الاشتراك الجديدة بنجاح!');
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'active':
        return {
          label: 'نشط',
          cls: isAndroid
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-emerald-100 text-emerald-800',
        };
      case 'expiring_soon':
        return {
          label: 'ينتهي قريباً',
          cls: isAndroid
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'bg-amber-100 text-amber-800',
        };
      case 'expired':
        return {
          label: 'منتهي',
          cls: isAndroid
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            : 'bg-rose-100 text-rose-800',
        };
      case 'cancelled':
        return {
          label: 'ملغي',
          cls: isAndroid
            ? 'bg-slate-700 text-slate-300 border border-slate-600'
            : 'bg-slate-200 text-slate-700',
        };
    }
  };

  const navTabs: {
    id: NativeAppTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'الرئيسية', icon: Dumbbell },
    { id: 'gate', label: 'البوابة', icon: ScanLine },
    { id: 'members', label: 'الأعضاء', icon: Users },
    { id: 'plans', label: 'الباقات', icon: Layers },
    { id: 'finance', label: 'المالية', icon: Wallet },
    { id: 'install', label: 'التثبيت', icon: Download },
  ];

  return (
    <div
      data-testid={`native-app-shell-${osType}`}
      className={`w-full flex-1 flex flex-col select-none relative overflow-hidden transition-colors ${
        isAndroid
          ? 'bg-[#0B111E] text-slate-100 font-sans'
          : 'bg-[#F2F2F7] text-slate-900 font-sans'
      }`}
    >
      {/* =====================================================================
          1. NATIVE OS STATUS BAR (ANDROID 15 vs iPHONE iOS 18 DYNAMIC ISLAND)
         ===================================================================== */}
      {isAndroid ? (
        <div
          data-testid="android-status-bar"
          className="bg-[#070B14] text-slate-300 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono border-b border-slate-800/80"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">9:41</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-sans font-bold">
              Android 15 · Material 3
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-[10px] text-emerald-400 font-bold">5G</span>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <div className="flex items-center gap-0.5 text-emerald-400 font-bold">
              <BatteryCharging className="w-3.5 h-3.5" />
              <span>100%</span>
            </div>
          </div>
        </div>
      ) : (
        <div
          data-testid="ios-status-bar"
          className="bg-white/90 backdrop-blur-xl text-slate-900 px-5 pt-2 pb-1.5 flex items-center justify-between text-xs font-semibold border-b border-slate-200/50"
        >
          <span className="font-mono font-bold text-[13px] tracking-tight">
            9:41
          </span>

          {/* Authentic iPhone 16 Pro Dynamic Island */}
          <button
            type="button"
            data-testid="ios-dynamic-island"
            onClick={() => onChangeTab('gate')}
            className="bg-black text-white px-3.5 py-1 rounded-full flex items-center gap-2 shadow-md cursor-pointer hover:scale-105 transition-transform"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-tight text-slate-200">
              IronPulse iOS 18
            </span>
            <QrCode className="w-3 h-3 text-sky-400" />
          </button>

          <div className="flex items-center gap-1.5 text-slate-800 text-[11px] font-mono font-bold">
            <span>5G</span>
            <Wifi className="w-3.5 h-3.5" />
            <BatteryCharging className="w-4 h-4 text-emerald-600" />
          </div>
        </div>
      )}

      {/* =====================================================================
          2. NATIVE TOP APP BAR (Material 3 App Bar vs Cupertino Nav Bar)
         ===================================================================== */}
      <header
        className={`sticky top-0 z-20 px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
          isAndroid
            ? 'bg-[#101828]/95 backdrop-blur-md border-b border-slate-800'
            : 'bg-white/85 backdrop-blur-xl border-b border-slate-200/80'
        }`}
      >
        {/* App Brand & Active OS Label */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 flex items-center justify-center shrink-0 shadow-md ${
              isAndroid
                ? 'rounded-2xl bg-emerald-500 text-slate-950'
                : 'rounded-[12px] bg-[#007AFF] text-white'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1
              className={`text-sm font-extrabold truncate ${
                isAndroid ? 'text-white' : 'text-slate-900'
              }`}
            >
              {gymProfile.gymName}
            </h1>
            <p
              className={`text-[11px] font-semibold truncate ${
                isAndroid ? 'text-emerald-400' : 'text-[#007AFF]'
              }`}
            >
              {isAndroid
                ? 'تطبيق أندرويد متكامل (Android 15)'
                : 'تطبيق آيفون متكامل (iPhone iOS 18)'}
            </p>
          </div>
        </div>

        {/* Native Top Bar Action Buttons (Switch OS + Fullscreen + Alerts) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {platformMode !== 'dual' && (
            <button
              type="button"
              data-testid={`switch-to-${isAndroid ? 'ios' : 'android'}-btn`}
              onClick={() => setPlatformMode(isAndroid ? 'ios' : 'android')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isAndroid
                  ? 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700'
                  : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 shadow-2xs'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{isAndroid ? 'نسخة الآيفون' : 'نسخة الأندرويد'}</span>
            </button>
          )}

          <button
            type="button"
            data-testid={`fullscreen-app-btn-${osType}`}
            onClick={() => enterTrueFullscreenApp()}
            aria-label="ملء الشاشة الكامل"
            title="تشغيل التطبيق بملء الشاشة الكامل"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isAndroid
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                : 'bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF]'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('home')}
            aria-label="التنبيهات"
            className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
              isAndroid
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BellRing className="w-4 h-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* =====================================================================
          3. SCROLLABLE NATIVE APP SCREEN BODY
         ===================================================================== */}
      <main className="flex-1 overflow-y-auto px-3.5 pt-3.5 pb-24 space-y-4">
        {/* -----------------------------------------------------------------
            TAB 1: الرئيسية (NATIVE HOME & DIGITAL WALLET SCREEN)
           ----------------------------------------------------------------- */}
        {activeTab === 'home' && (
          <div className="space-y-4" data-testid={`home-screen-${osType}`}>
            {/* Native Wallet Hero Pass */}
            <div
              className={`p-4 rounded-3xl relative overflow-hidden shadow-lg ${
                isAndroid
                  ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-900 text-white border border-emerald-400/30'
                  : 'bg-gradient-to-br from-[#007AFF] via-[#0051D5] to-slate-900 text-white shadow-blue-500/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/25 text-[11px] font-bold text-white/95 mb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>
                      {isAndroid
                        ? 'Google Wallet · محفظة الجيم'
                        : 'Apple Wallet · محفظة الجيم'}
                    </span>
                  </span>
                  <h2 className="text-lg font-extrabold tracking-tight">
                    الإيراد المحصل:{' '}
                    {formatMoney(
                      metrics.totalRevenueCollected,
                      gymProfile.currency
                    )}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeTab('install')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-[11px] font-extrabold text-white flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>التثبيت</span>
                </button>
              </div>

              {/* 4 KPI Mini Pills inside Wallet Pass */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/15 text-center">
                <div className="bg-black/20 rounded-2xl p-2">
                  <span className="text-[10px] text-white/75 block">
                    الأعضاء
                  </span>
                  <span className="text-sm font-extrabold font-mono">
                    {metrics.totalMembers}
                  </span>
                </div>
                <div className="bg-black/20 rounded-2xl p-2">
                  <span className="text-[10px] text-white/75 block">نشط</span>
                  <span className="text-sm font-extrabold font-mono text-emerald-300">
                    {metrics.activeCount}
                  </span>
                </div>
                <div className="bg-black/20 rounded-2xl p-2">
                  <span className="text-[10px] text-white/75 block">
                    ينتهي قريباً
                  </span>
                  <span className="text-sm font-extrabold font-mono text-amber-300">
                    {metrics.expiringSoonCount}
                  </span>
                </div>
                <div className="bg-black/20 rounded-2xl p-2">
                  <span className="text-[10px] text-white/75 block">
                    حضور اليوم
                  </span>
                  <span className="text-sm font-extrabold font-mono text-sky-200">
                    {metrics.todayCheckInsCount}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Native Mobile Quick Action Squircle Launchers */}
            <div className="grid grid-cols-4 gap-2.5">
              <button
                type="button"
                data-testid={`quick-add-member-${osType}`}
                onClick={handleOpenAddMember}
                className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                  isAndroid
                    ? 'bg-[#162033] hover:bg-[#1E2B44] text-emerald-400 border border-slate-800'
                    : 'bg-white hover:bg-slate-50 text-[#007AFF] shadow-xs border border-slate-200/60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isAndroid
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[#007AFF]/10 text-[#007AFF]'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-bold ${
                    isAndroid ? 'text-slate-100' : 'text-slate-800'
                  }`}
                >
                  عضو جديد
                </span>
              </button>

              <button
                type="button"
                onClick={() => onChangeTab('gate')}
                className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                  isAndroid
                    ? 'bg-[#162033] hover:bg-[#1E2B44] text-sky-400 border border-slate-800'
                    : 'bg-white hover:bg-slate-50 text-emerald-600 shadow-xs border border-slate-200/60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isAndroid
                      ? 'bg-sky-500/15 text-sky-400'
                      : 'bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  <ScanLine className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-bold ${
                    isAndroid ? 'text-slate-100' : 'text-slate-800'
                  }`}
                >
                  مسح باركود
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFinanceSubTab('invoices');
                  onChangeTab('finance');
                }}
                className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                  isAndroid
                    ? 'bg-[#162033] hover:bg-[#1E2B44] text-amber-400 border border-slate-800'
                    : 'bg-white hover:bg-slate-50 text-amber-600 shadow-xs border border-slate-200/60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isAndroid
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-bold ${
                    isAndroid ? 'text-slate-100' : 'text-slate-800'
                  }`}
                >
                  المدفوعات
                </span>
              </button>

              <button
                type="button"
                onClick={() => onChangeTab('install')}
                className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                  isAndroid
                    ? 'bg-[#162033] hover:bg-[#1E2B44] text-purple-400 border border-slate-800'
                    : 'bg-white hover:bg-slate-50 text-purple-600 shadow-xs border border-slate-200/60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    isAndroid
                      ? 'bg-purple-500/15 text-purple-400'
                      : 'bg-purple-500/10 text-purple-600'
                  }`}
                >
                  <Download className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] font-bold ${
                    isAndroid ? 'text-slate-100' : 'text-slate-800'
                  }`}
                >
                  تثبيت التطبيق
                </span>
              </button>
            </div>

            {/* 1-Tap Cloudflare Edge + GitHub (iron-plus) Live Deployment Banner */}
            {onOpenRepoPortal && (
              <button
                type="button"
                data-testid={`open-cloudflare-portal-card-${osType}`}
                onClick={onOpenRepoPortal}
                className={`w-full p-3.5 rounded-3xl flex items-center justify-between gap-3 text-right transition-all cursor-pointer ${
                  isAndroid
                    ? 'bg-gradient-to-l from-amber-500/20 via-emerald-500/15 to-[#141E30] border border-amber-500/40 text-white hover:border-amber-400'
                    : 'bg-gradient-to-l from-amber-50 via-emerald-50 to-white border border-amber-300 text-slate-900 shadow-2xs hover:border-amber-400'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-extrabold shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="truncate">
                        مركز نشر Cloudflare Pages + GitHub (iron-plus)
                      </span>
                    </div>
                    <p
                      className={`text-[11px] truncate ${
                        isAndroid ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      رابط Cloudflare Edge الحي الشغال الآن + تفعيل iron-plus.pages.dev
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-extrabold shrink-0">
                  فتح البوابة
                </span>
              </button>
            )}

            {/* Instant Gate Barcode Check-In Widget right inside Home */}
            <div
              className={`p-4 rounded-3xl ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-white border border-slate-200/70 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <ScanLine
                    className={`w-4 h-4 ${
                      isAndroid ? 'text-emerald-400' : 'text-[#007AFF]'
                    }`}
                  />
                  <h3 className="text-xs font-extrabold">
                    فحص الباركود السريع (بوابة الدخول)
                  </h3>
                </div>
                <span className="text-[10px] font-mono opacity-70">
                  مباشر 24/7
                </span>
              </div>

              <form onSubmit={handleGateScanSubmit} className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="امسح أو أدخل الباركود (مثال GYM-1001)..."
                  aria-label="إدخال الباركود السريع"
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono focus:outline-none ${
                    isAndroid
                      ? 'bg-[#0B111E] text-white border border-slate-700 focus:border-emerald-400'
                      : 'bg-[#F2F2F7] text-slate-900 border border-slate-200 focus:border-[#007AFF]'
                  }`}
                />
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer shrink-0 ${
                    isAndroid
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-[#007AFF] text-white hover:bg-blue-600'
                  }`}
                >
                  دخول
                </button>
              </form>

              {/* Quick 1-Tap Member Barcode Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {enrichedMembers.slice(0, 4).map(({ member, state }) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onPerformCheckIn(member.barcode)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                      isAndroid
                        ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        : 'bg-[#F2F2F7] hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        state.status === 'active'
                          ? 'bg-emerald-500'
                          : state.status === 'expiring_soon'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span>{member.fullName.split(' ')[0]}</span>
                    <span className="font-mono opacity-60">
                      ({member.barcode})
                    </span>
                  </button>
                ))}
              </div>

              {/* Last Check-in Result Card */}
              {lastCheckInResult && (
                <div
                  data-testid={`last-checkin-card-${osType}`}
                  className={`mt-3 p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                    lastCheckInResult.allowed
                      ? isAndroid
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : isAndroid
                      ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {lastCheckInResult.allowed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">
                        {lastCheckInResult.member?.fullName ||
                          lastCheckInResult.barcode}
                      </p>
                      <p className="text-[11px] opacity-90 truncate">
                        {lastCheckInResult.messageTitle} —{' '}
                        {lastCheckInResult.messageDetail}
                      </p>
                    </div>
                  </div>
                  {!lastCheckInResult.allowed && lastCheckInResult.member && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenRenewSheet(lastCheckInResult.member!)
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      تجديد فوري
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Urgent Expiry Alerts List */}
            <div
              className={`p-4 rounded-3xl ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-white border border-slate-200/70 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-extrabold">
                    تنبيهات انتهاء الاشتراك ({alerts.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeTab('members')}
                  className={`text-[11px] font-bold cursor-pointer ${
                    isAndroid ? 'text-emerald-400' : 'text-[#007AFF]'
                  }`}
                >
                  عرض الكل
                </button>
              </div>

              <div className="space-y-2.5">
                {alerts.slice(0, 3).map((alert) => {
                  const memberObj = members.find(
                    (m) => m.id === alert.memberId
                  );
                  const waUrl = buildWhatsAppLink(
                    alert.phone,
                    `مرحباً ${alert.memberName}، نود تذكيرك بأن اشتراكك (${alert.planName}) في ${gymProfile.gymName} ينتهي بتاريخ ${alert.endDate}. يسعدنا تجديد اشتراكك!`
                  );

                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-2xl flex items-center justify-between gap-2 ${
                        isAndroid
                          ? 'bg-[#0B111E] border border-slate-800'
                          : 'bg-[#F2F2F7]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">
                          {alert.memberName}
                        </p>
                        <p
                          className={`text-[11px] font-semibold ${
                            alert.remainingDays < 0
                              ? 'text-rose-500'
                              : 'text-amber-500'
                          }`}
                        >
                          {alert.remainingDays < 0
                            ? `منتهي منذ ${Math.abs(alert.remainingDays)} يوم`
                            : `متبقي ${alert.remainingDays} أيام (${alert.endDate})`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {memberObj && (
                          <button
                            type="button"
                            onClick={() => handleOpenRenewSheet(memberObj)}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-white cursor-pointer ${
                              isAndroid ? 'bg-emerald-600' : 'bg-[#007AFF]'
                            }`}
                          >
                            تجديد
                          </button>
                        )}
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => onMarkAlertNotified(alert.memberId)}
                          className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                          title="تنبيه عبر واتساب"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            TAB 2: البوابة (SMART LASER BARCODE SCANNER & GATE LOG)
           ----------------------------------------------------------------- */}
        {activeTab === 'gate' && (
          <div className="space-y-4" data-testid={`gate-screen-${osType}`}>
            {/* Native Camera / Laser Scanner Viewfinder */}
            <div
              className={`p-4 rounded-3xl relative overflow-hidden ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-white border border-slate-200/70 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-extrabold">
                    ماسح باركود البوابة الذكية
                  </h2>
                  <p className="text-[11px] opacity-70">
                    وجه كاميرا الموبايل أو القارئ نحو بطاقة المشترك
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGateLaserActive(!gateLaserActive)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                    gateLaserActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {gateLaserActive ? 'الليزر نشط ●' : 'تشغيل الليزر'}
                </button>
              </div>

              {/* Simulated Native Camera Viewfinder Box */}
              <div className="relative h-36 rounded-2xl bg-slate-950 border-2 border-dashed border-emerald-500/50 flex flex-col items-center justify-center overflow-hidden mb-3">
                <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />

                {gateLaserActive && (
                  <div className="w-4/5 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-pulse mb-2" />
                )}
                <QrCode className="w-9 h-9 text-emerald-400/70 mb-1" />
                <span className="text-[11px] font-mono text-slate-300">
                  CODE-128 / QR GYM PASS SCANNER
                </span>
              </div>

              <form onSubmit={handleGateScanSubmit} className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="أدخل رقم الباركود مثل GYM-1001..."
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono focus:outline-none ${
                    isAndroid
                      ? 'bg-[#0B111E] text-white border border-slate-700'
                      : 'bg-[#F2F2F7] text-slate-900 border border-slate-200'
                  }`}
                />
                <button
                  type="submit"
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                    isAndroid
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-[#007AFF] text-white'
                  }`}
                >
                  فحص الدخول
                </button>
              </form>

              {/* Quick Simulation Chips for All Member States */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold opacity-75 block">
                  تجربة مسح فوري لبطاقات الأعضاء:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {enrichedMembers.slice(0, 4).map(({ member, state }) => {
                    const badge = getStatusBadge(state.status);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => onPerformCheckIn(member.barcode)}
                        className={`p-2 rounded-xl text-right flex items-center justify-between cursor-pointer transition-transform active:scale-98 ${
                          isAndroid
                            ? 'bg-[#0B111E] hover:bg-slate-900 border border-slate-800'
                            : 'bg-[#F2F2F7] hover:bg-slate-200/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold truncate">
                            {member.fullName}
                          </p>
                          <p className="text-[10px] font-mono opacity-70">
                            {member.barcode}
                          </p>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Gate Decision Card */}
            {lastCheckInResult && (
              <div
                className={`p-4 rounded-3xl border-2 ${
                  lastCheckInResult.allowed
                    ? isAndroid
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                      : 'bg-emerald-50 border-emerald-400 text-slate-900'
                    : isAndroid
                    ? 'bg-rose-950/40 border-rose-500/60 text-white'
                    : 'bg-rose-50 border-rose-400 text-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {lastCheckInResult.allowed ? (
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                        <XCircle className="w-7 h-7" />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider opacity-75 block">
                        {lastCheckInResult.allowed
                          ? 'ACCESS GRANTED · مسموح بالدخول'
                          : 'ACCESS DENIED · دخول مرفوض'}
                      </span>
                      <h3 className="text-base font-extrabold">
                        {lastCheckInResult.member?.fullName ||
                          `باركود: ${lastCheckInResult.barcode}`}
                      </h3>
                      <p className="text-xs font-semibold mt-0.5">
                        {lastCheckInResult.messageTitle} —{' '}
                        {lastCheckInResult.messageDetail}
                      </p>
                    </div>
                  </div>
                </div>

                {lastCheckInResult.member && (
                  <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono">
                      الباقة: {lastCheckInResult.member.subscription.planName} |
                      الانتهاء: {lastCheckInResult.member.subscription.endDate}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenBarcodeModal(lastCheckInResult.member!)
                        }
                        className="px-2.5 py-1 rounded-xl bg-black/20 text-[11px] font-bold cursor-pointer"
                      >
                        بطاقة Wallet
                      </button>
                      {!lastCheckInResult.allowed && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenRenewSheet(lastCheckInResult.member!)
                          }
                          className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 text-[11px] font-extrabold cursor-pointer"
                        >
                          تجديد الآن
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Today's Gate Check-in Log */}
            <div
              className={`p-4 rounded-3xl ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-white border border-slate-200/70 shadow-2xs'
              }`}
            >
              <h3 className="text-xs font-extrabold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>سجل حركة البوابة اليوم ({checkIns.length})</span>
              </h3>
              <div className="space-y-2">
                {checkIns.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-2xl flex items-center justify-between text-xs ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-800'
                        : 'bg-[#F2F2F7]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {log.allowed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold truncate">{log.memberName}</p>
                        <p className="text-[10px] opacity-70 truncate">
                          {log.reason}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono opacity-75 shrink-0">
                      {log.timestamp.split(' ')[1] || log.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            TAB 3: الأعضاء (NATIVE MOBILE MEMBERS CARDS & SUBSCRIPTIONS)
           ----------------------------------------------------------------- */}
        {activeTab === 'members' && (
          <div className="space-y-3.5" data-testid={`members-screen-${osType}`}>
            {/* Search & Add Header */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="ابحث بالاسم، الجوال، أو الباركود..."
                  className={`w-full pr-9 pl-3 py-2.5 rounded-2xl text-xs focus:outline-none ${
                    isAndroid
                      ? 'bg-[#141E30] text-white border border-slate-800 focus:border-emerald-400'
                      : 'bg-white text-slate-900 border border-slate-200/80 shadow-2xs'
                  }`}
                />
              </div>
              <button
                type="button"
                data-testid={`open-add-member-btn-${osType}`}
                onClick={handleOpenAddMember}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isAndroid
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'bg-[#007AFF] text-white shadow-sm'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>عضو جديد</span>
              </button>
            </div>

            {/* Native Filter Chips / iOS Segmented Control */}
            <div
              className={`flex items-center gap-1 overflow-x-auto p-1 rounded-2xl ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-[#E5E5EA]'
              }`}
            >
              {(
                [
                  { id: 'all', label: `الكل (${members.length})` },
                  { id: 'active', label: `نشط (${metrics.activeCount})` },
                  {
                    id: 'expiring_soon',
                    label: `قريباً (${metrics.expiringSoonCount})`,
                  },
                  { id: 'expired', label: `منتهي (${metrics.expiredCount})` },
                ] as const
              ).map((tab) => {
                const active = memberStatusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMemberStatusFilter(tab.id)}
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      active
                        ? isAndroid
                          ? 'bg-emerald-500 text-slate-950 shadow-xs'
                          : 'bg-white text-slate-900 shadow-xs'
                        : isAndroid
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Mobile Member Cards */}
            <div className="space-y-3">
              {filteredMembers.map(({ member, state, initials }) => {
                const badge = getStatusBadge(state.status);
                const progressPct = Math.max(
                  0,
                  Math.min(100, Math.round(100 - state.progressPercent))
                );

                return (
                  <div
                    key={member.id}
                    data-testid={`member-card-${member.barcode}`}
                    className={`p-4 rounded-3xl transition-all ${
                      isAndroid
                        ? 'bg-[#141E30] border border-slate-800'
                        : 'bg-white border border-slate-200/70 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0 ${
                            isAndroid
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-[#007AFF]/10 text-[#007AFF]'
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold truncate">
                            {member.fullName}
                          </h3>
                          <div className="flex items-center gap-2 text-[11px] opacity-75 font-mono">
                            <span>{member.barcode}</span>
                            <span>•</span>
                            <span>{member.phone}</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Plan & Remaining Days Progress Bar */}
                    <div
                      className={`p-2.5 rounded-2xl mb-3 text-xs ${
                        isAndroid ? 'bg-[#0B111E]' : 'bg-[#F2F2F7]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold">
                          {member.subscription.planName}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            state.remainingDays < 0
                              ? 'text-rose-500'
                              : state.remainingDays <= 5
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        >
                          {state.status === 'cancelled'
                            ? 'اشتراك ملغي'
                            : state.remainingDays < 0
                            ? `منتهي منذ ${Math.abs(state.remainingDays)} يوم`
                            : `متبقي ${state.remainingDays} يوم`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-700/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            state.status === 'active'
                              ? 'bg-emerald-500'
                              : state.status === 'expiring_soon'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{
                            width: `${
                              state.status === 'expired' ||
                              state.status === 'cancelled'
                                ? 100
                                : progressPct
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] opacity-70 mt-1.5 font-mono">
                        <span>البداية: {member.subscription.startDate}</span>
                        <span>النهاية: {member.subscription.endDate}</span>
                      </div>
                    </div>

                    {/* Native Action Row */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPerformCheckIn(member.barcode)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          isAndroid
                            ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                            : 'bg-[#F2F2F7] hover:bg-slate-200 text-slate-900'
                        }`}
                      >
                        <ScanLine className="w-3.5 h-3.5" />
                        <span>تحضير</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenBarcodeModal(member)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                          isAndroid
                            ? 'bg-slate-800 hover:bg-slate-700 text-sky-400'
                            : 'bg-[#F2F2F7] hover:bg-slate-200 text-[#007AFF]'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>الباركود</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenRenewSheet(member)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer text-white ${
                          isAndroid
                            ? 'bg-emerald-600 hover:bg-emerald-500'
                            : 'bg-[#007AFF] hover:bg-blue-600'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>تجديد</span>
                      </button>

                      {state.status !== 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => setCancelMemberTarget(member)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                            isAndroid
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                              : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>إيقاف</span>
                        </button>
                      ) : (
                        <a
                          href={buildWhatsAppLink(
                            member.phone,
                            `مرحباً ${member.fullName}، نود تذكيرك بتجديد اشتراكك في ${gymProfile.gymName}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 bg-emerald-500/20 text-emerald-500"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            TAB 4: الباقات (NATIVE SUBSCRIPTION PLANS SCREEN)
           ----------------------------------------------------------------- */}
        {activeTab === 'plans' && (
          <div className="space-y-3.5" data-testid={`plans-screen-${osType}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold">
                  باقات وأسعار الاشتراكات
                </h2>
                <p className="text-[11px] opacity-70">
                  إدارة خطط العضوية المتاحة للتسجيل والتجديد
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPlanSheet(true)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                  isAndroid
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#007AFF] text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>باقة جديدة</span>
              </button>
            </div>

            <div className="space-y-3">
              {plans.map((plan) => {
                const subCount = members.filter(
                  (m) => m.subscription.planId === plan.id
                ).length;

                return (
                  <div
                    key={plan.id}
                    className={`p-4 rounded-3xl relative overflow-hidden ${
                      isAndroid
                        ? 'bg-[#141E30] border border-slate-800'
                        : 'bg-white border border-slate-200/70 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold">{plan.name}</h3>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                            {plan.category}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-75 mt-0.5">
                          {plan.description}
                        </p>
                      </div>
                      <div className="text-left shrink-0">
                        <span
                          className={`text-base font-extrabold font-mono block ${
                            isAndroid ? 'text-emerald-400' : 'text-[#007AFF]'
                          }`}
                        >
                          {formatMoney(plan.price, gymProfile.currency)}
                        </span>
                        <span className="text-[10px] font-mono opacity-70">
                          {plan.durationDays} يوم
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 my-2.5">
                      {plan.features.map((f, idx) => (
                        <span
                          key={idx}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold ${
                            isAndroid
                              ? 'bg-[#0B111E] text-slate-300'
                              : 'bg-[#F2F2F7] text-slate-700'
                          }`}
                        >
                          ✓ {f}
                        </span>
                      ))}
                    </div>

                    <div className="pt-2.5 border-t border-current/10 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold opacity-80">
                        المشتركون الحاليون: {subCount} عضو
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onTogglePlanActive(plan.id)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer ${
                            plan.active
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {plan.active ? 'مفعلة' : 'موقوفة'}
                        </button>
                        {subCount === 0 && (
                          <button
                            type="button"
                            onClick={() => onDeletePlan(plan.id)}
                            className="p-1.5 rounded-xl bg-rose-500/15 text-rose-400 cursor-pointer"
                            aria-label={`حذف ${plan.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            TAB 5: المالية (PAYMENTS, REPORTS & GYM SETTINGS)
           ----------------------------------------------------------------- */}
        {activeTab === 'finance' && (
          <div className="space-y-3.5" data-testid={`finance-screen-${osType}`}>
            {/* Segmented Control for Finance Sections */}
            <div
              className={`grid grid-cols-3 gap-1 p-1 rounded-2xl ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-[#E5E5EA]'
              }`}
            >
              {(
                [
                  { id: 'invoices', label: 'الفواتير والتحصيل' },
                  { id: 'reports', label: 'التقارير والأرباح' },
                  { id: 'settings', label: 'إعدادات الجيم' },
                ] as const
              ).map((sec) => {
                const active = financeSubTab === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setFinanceSubTab(sec.id)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                      active
                        ? isAndroid
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-white text-slate-900 shadow-xs'
                        : isAndroid
                        ? 'text-slate-400'
                        : 'text-slate-600'
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}
            </div>

            {financeSubTab === 'invoices' && (
              <div className="space-y-3">
                {/* Summary Strip */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    className={`p-3.5 rounded-3xl ${
                      isAndroid
                        ? 'bg-[#141E30] border border-slate-800'
                        : 'bg-white border border-slate-200/70 shadow-2xs'
                    }`}
                  >
                    <span className="text-[11px] opacity-70 block">
                      إجمالي المحصل
                    </span>
                    <span className="text-base font-extrabold font-mono text-emerald-500">
                      {formatMoney(
                        metrics.totalRevenueCollected,
                        gymProfile.currency
                      )}
                    </span>
                  </div>
                  <div
                    className={`p-3.5 rounded-3xl ${
                      isAndroid
                        ? 'bg-[#141E30] border border-slate-800'
                        : 'bg-white border border-slate-200/70 shadow-2xs'
                    }`}
                  >
                    <span className="text-[11px] opacity-70 block">
                      مستحقات متبقية
                    </span>
                    <span className="text-base font-extrabold font-mono text-amber-500">
                      {formatMoney(
                        metrics.totalPendingBalance,
                        gymProfile.currency
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold">
                    سجل الفواتير ({filteredPayments.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOnlyPendingPayments(!onlyPendingPayments)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                      onlyPendingPayments
                        ? 'bg-amber-500 text-slate-950'
                        : isAndroid
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {onlyPendingPayments
                      ? 'عرض كل الفواتير'
                      : 'الفواتير المتبقية فقط'}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {filteredPayments.map((pay) => (
                    <div
                      key={pay.id}
                      className={`p-3.5 rounded-3xl ${
                        isAndroid
                          ? 'bg-[#141E30] border border-slate-800'
                          : 'bg-white border border-slate-200/70 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-mono opacity-70 block">
                            {pay.invoiceNumber} • {pay.date}
                          </span>
                          <h4 className="text-xs font-extrabold">
                            {pay.memberName}
                          </h4>
                          <span className="text-[11px] opacity-80">
                            {pay.planName}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-extrabold font-mono text-emerald-500 block">
                            مدفوع:{' '}
                            {formatMoney(pay.paidAmount, gymProfile.currency)}
                          </span>
                          {pay.remainingAmount > 0 ? (
                            <span className="text-[11px] font-bold font-mono text-amber-500 block">
                              متبقي:{' '}
                              {formatMoney(
                                pay.remainingAmount,
                                gymProfile.currency
                              )}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-500">
                              خالص بالكامل ✓
                            </span>
                          )}
                        </div>
                      </div>

                      {pay.remainingAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            onCollectRemainingBalance(pay.id);
                            showPlatformToast(
                              `تم تحصيل المتبقي من ${pay.memberName} بنجاح!`
                            );
                          }}
                          className={`w-full py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer ${
                            isAndroid ? 'bg-amber-600' : 'bg-[#007AFF]'
                          }`}
                        >
                          تحصيل المبلغ المتبقي (
                          {formatMoney(
                            pay.remainingAmount,
                            gymProfile.currency
                          )}
                          )
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {financeSubTab === 'reports' && (
              <div className="space-y-3">
                <div
                  className={`p-4 rounded-3xl space-y-3 ${
                    isAndroid
                      ? 'bg-[#141E30] border border-slate-800'
                      : 'bg-white border border-slate-200/70 shadow-2xs'
                  }`}
                >
                  <h3 className="text-xs font-extrabold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span>توزيع الأعضاء حسب الباقات</span>
                  </h3>
                  {plans.map((p) => {
                    const count = members.filter(
                      (m) => m.subscription.planId === p.id
                    ).length;
                    const pct =
                      members.length > 0
                        ? Math.round((count / members.length) * 100)
                        : 0;
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold">{p.name}</span>
                          <span className="font-mono">
                            {count} مشترك ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-700/20 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isAndroid ? 'bg-emerald-500' : 'bg-[#007AFF]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {financeSubTab === 'settings' && (
              <div
                className={`p-4 rounded-3xl space-y-3 ${
                  isAndroid
                    ? 'bg-[#141E30] border border-slate-800'
                    : 'bg-white border border-slate-200/70 shadow-2xs'
                }`}
              >
                <h3 className="text-xs font-extrabold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-500" />
                  <span>بيانات النادي وإعدادات النظام</span>
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">
                      اسم الجيم
                    </label>
                    <input
                      type="text"
                      value={settingsForm.gymName}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          gymName: e.target.value,
                        })
                      }
                      className={`w-full px-3 py-2 rounded-xl ${
                        isAndroid
                          ? 'bg-[#0B111E] border border-slate-700 text-white'
                          : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        العملة
                      </label>
                      <input
                        type="text"
                        value={settingsForm.currency}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            currency: e.target.value,
                          })
                        }
                        className={`w-full px-3 py-2 rounded-xl ${
                          isAndroid
                            ? 'bg-[#0B111E] border border-slate-700 text-white'
                            : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        تنبيه قبل الانتهاء (أيام)
                      </label>
                      <input
                        type="number"
                        value={settingsForm.alertThresholdDays}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            alertThresholdDays: Number(e.target.value) || 5,
                          })
                        }
                        className={`w-full px-3 py-2 rounded-xl font-mono ${
                          isAndroid
                            ? 'bg-[#0B111E] border border-slate-700 text-white'
                            : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSaveGymProfile(settingsForm);
                        showPlatformToast('تم حفظ إعدادات الجيم بنجاح!');
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-extrabold cursor-pointer ${
                        isAndroid
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#007AFF] text-white'
                      }`}
                    >
                      حفظ التعديلات
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onResetDemoData();
                        showPlatformToast('تمت استعادة البيانات الافتراضية');
                      }}
                      className="px-3 py-2.5 rounded-xl bg-rose-500/15 text-rose-400 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة ضبط</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -----------------------------------------------------------------
            TAB 6: التثبيت 📲 (DEDICATED NATIVE ANDROID & iPHONE INSTALLER)
           ----------------------------------------------------------------- */}
        {activeTab === 'install' && (
          <div className="space-y-4" data-testid={`install-screen-${osType}`}>
            {/* Card 1: 1-Tap True Fullscreen Mode + Standalone Window */}
            <div
              className={`p-4 rounded-3xl ${
                isAndroid
                  ? 'bg-gradient-to-br from-emerald-950 via-[#141E30] to-[#0B111E] border border-emerald-500/40'
                  : 'bg-white border border-slate-200/80 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold">
                    مركز تشغيل وتثبيت تطبيق الموبايل المتكامل
                  </h2>
                  <p className="text-[11px] opacity-75">
                    تطبيق أندرويد متكامل (WebAPK) + تطبيق آيفون متكامل (iOS 18)
                  </p>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                <button
                  type="button"
                  data-testid="launch-true-fullscreen-btn"
                  onClick={() => enterTrueFullscreenApp()}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>
                    تشغيل التطبيق بملء الشاشة الكامل الآن (بدون شريط متصفح)
                  </span>
                </button>

                <a
                  href={standaloneLaunchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border ${
                    isAndroid
                      ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
                      : 'bg-slate-900 text-white border-slate-900'
                  }`}
                >
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                  <span>فتح التطبيق في نافذة مستقلة خارج المعاينة</span>
                </a>
              </div>
            </div>

            {/* Card 2: Dedicated GitHub Repository & Cloudflare Pages Deployment Hub */}
            <div
              data-testid={`cloudflare-github-card-${osType}`}
              className={`p-4 rounded-3xl space-y-3 border-2 ${
                isAndroid
                  ? 'bg-[#11192A] border-amber-500/40 text-white'
                  : 'bg-white border-amber-500/50 text-slate-900 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-extrabold mb-1">
                    Cloudflare Pages & GitHub Ready · iron-plus
                  </span>
                  <h3 className="text-xs font-extrabold">
                    مستودع المشروع الرسمي المرفوع: iron-plus (iron plus)
                  </h3>
                </div>
              </div>

              <p className="text-[11px] opacity-80 leading-relaxed">
                تم إنشاء مستودع <code className="font-mono text-emerald-400 font-bold">iron-plus</code> ورفع جميع ملفات المشروع بالكامل مع إعدادات{' '}
                <code className="font-mono text-amber-500">wrangler.toml</code>{' '}
                وملفات التوجيه{' '}
                <code className="font-mono text-amber-500">_redirects</code> و{' '}
                <code className="font-mono text-amber-500">_headers</code>:
              </p>

              {onOpenRepoPortal && (
                <button
                  type="button"
                  data-testid={`open-iron-plus-repo-portal-btn-${osType}`}
                  onClick={onOpenRepoPortal}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>فتح مستودع (iron-plus) المرفوع بالكامل ومعاينة الملفات</span>
                </button>
              )}

              {/* Direct Download of Git Repo & Cloudflare Build Zip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href="/iron-plus.tar.gz"
                  download="iron-plus.tar.gz"
                  onClick={() =>
                    showPlatformToast(
                      'جاري تنزيل مستودع iron-plus الكامل للمشروع (شامل إعدادات Cloudflare)!'
                    )
                  }
                  className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 text-center"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>تنزيل مستودع iron-plus الكامل</span>
                </a>

                <a
                  href="/iron-plus-cloudflare-dist.tar.gz"
                  download="iron-plus-cloudflare-dist.tar.gz"
                  onClick={() =>
                    showPlatformToast(
                      'جاري تنزيل حزمة البناء الجاهزة للرفع المباشر على Cloudflare Pages!'
                    )
                  }
                  className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 text-center border ${
                    isAndroid
                      ? 'bg-[#0B111E] text-amber-300 border-amber-500/40'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>حزمة الرفع لـ Cloudflare (dist)</span>
                </a>
              </div>

              {/* Automatic 1-Click GitHub Repository Creator & Pusher */}
              <div
                className={`p-3 rounded-2xl space-y-2.5 ${
                  isAndroid
                    ? 'bg-[#0B111E] border border-slate-800'
                    : 'bg-[#F2F2F7]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold block">
                    🚀 ربط حسابك في GitHub ورفع مستودع (iron-plus) بضغطة واحدة:
                  </span>
                  <button
                    type="button"
                    disabled={devicePolling || ghLoading}
                    onClick={async () => {
                      setGhError(null);
                      const codeData = await startGitHubDeviceFlow();
                      if (!codeData) {
                        setGhError('يرجى إدخال رمز GitHub Token بالأسفل');
                        return;
                      }
                      setDeviceAuth(codeData);
                      await copyTextSafe(codeData.user_code);
                      showPlatformToast(
                        `تم نسخ كود التفعيل (${codeData.user_code})! الصقه في صفحة GitHub للموافقة.`
                      );
                      setDevicePolling(true);
                      const intervalMs = Math.max(5, codeData.interval || 5) * 1000;
                      for (let i = 0; i < 60; i++) {
                        await new Promise((r) => setTimeout(r, intervalMs));
                        const pollRes = await pollGitHubDeviceFlowToken(
                          codeData.device_code
                        );
                        if (pollRes.token) {
                          setDevicePolling(false);
                          setGhToken(pollRes.token);
                          setGhLoading(true);
                          const res = await createGitHubRepoAndPushProject({
                            token: pollRes.token,
                            repoName: ghRepoName,
                            isPrivate: false,
                            onProgress: (p) => setGhProgress(p),
                          });
                          setGhLoading(false);
                          if (res.success && res.repoUrl) {
                            setGhCreatedRepoUrl(res.repoUrl);
                            showPlatformToast(
                              `تم إنشاء مستودع ${res.repo} ورفع المشروع بالكامل!`
                            );
                          } else {
                            setGhError(res.error || 'تعذر رفع المستودع');
                          }
                          return;
                        }
                        if (!pollRes.pending && pollRes.error) {
                          setDevicePolling(false);
                          setGhError(pollRes.error);
                          return;
                        }
                      }
                      setDevicePolling(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-extrabold cursor-pointer"
                  >
                    {devicePolling
                      ? 'بانتظار موافقة GitHub...'
                      : 'ربط حساب GitHub تلقائياً'}
                  </button>
                </div>

                {deviceAuth && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] opacity-80 block">
                        كود التفعيل (تم نسخه):
                      </span>
                      <code className="text-sm font-mono font-black text-emerald-400">
                        {deviceAuth.user_code}
                      </code>
                    </div>
                    <a
                      href={deviceAuth.verification_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-extrabold"
                    >
                      افتح صفحة التفعيل
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold mb-1 opacity-75">
                      اسم المستودع على GitHub
                    </label>
                    <input
                      type="text"
                      value={ghRepoName}
                      onChange={(e) => setGhRepoName(e.target.value)}
                      placeholder="iron-plus"
                      className={`w-full px-3 py-2 rounded-xl font-mono text-[11px] ${
                        isAndroid
                          ? 'bg-[#141E30] border border-slate-700 text-white'
                          : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1 opacity-75">
                      رمز GitHub Token (صلاحية repo)
                    </label>
                    <input
                      type="password"
                      value={ghToken}
                      onChange={(e) => setGhToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className={`w-full px-3 py-2 rounded-xl font-mono text-[11px] ${
                        isAndroid
                          ? 'bg-[#141E30] border border-slate-700 text-white'
                          : 'bg-white border border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                {ghError && (
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 text-[11px] font-bold">
                    {ghError}
                  </div>
                )}

                {ghProgress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-emerald-400">
                      <span>{ghProgress.step}</span>
                      <span>{ghProgress.percent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${ghProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {ghCreatedRepoUrl && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 space-y-1.5">
                    <p className="text-[11px] font-extrabold text-emerald-400">
                      ✓ تم إنشاء المستودع ورفع المشروع بالكامل بنجاح!
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={ghCreatedRepoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>فتح المستودع على GitHub</span>
                      </a>
                      <a
                        href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages/provider/github"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>ربط المستودع مع Cloudflare الآن</span>
                      </a>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={ghLoading}
                  onClick={async () => {
                    setGhError(null);
                    setGhCreatedRepoUrl(null);
                    setGhLoading(true);
                    const res = await createGitHubRepoAndPushProject({
                      token: ghToken,
                      repoName: ghRepoName,
                      isPrivate: false,
                      onProgress: (p) => setGhProgress(p),
                    });
                    setGhLoading(false);
                    if (res.success && res.repoUrl) {
                      setGhCreatedRepoUrl(res.repoUrl);
                      showPlatformToast(
                        'تم إنشاء المستودع ورفع المشروع بالكامل على GitHub!'
                      );
                    } else {
                      setGhError(res.error || 'تعذر رفع المشروع');
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
                >
                  {ghLoading
                    ? 'جاري إنشاء المستودع ورفع الملفات...'
                    : 'إنشاء مستودع GitHub ورفع المشروع تلقائياً للربط مع Cloudflare'}
                </button>
              </div>
            </div>

            {/* Card 3: Android Native App Package */}
            <div
              className={`p-4 rounded-3xl space-y-2.5 ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-white border border-slate-200/80 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-500">
                  🤖 تطبيق الأندرويد المتكامل (Android 15)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                  WebAPK + Offline
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                يعمل بتصميم Material Design 3 مع دعم كامل للعمل بدون إنترنت وحفظ
                قاعدة البيانات محلياً على الهاتف.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    installAndroid(false);
                    setPlatformMode('android');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>تفعيل وتثبيت تطبيق الأندرويد</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerAndroidPackageDownload();
                    showPlatformToast(
                      'تم بدء تنزيل حزمة تطبيق الأندرويد المستقلة!'
                    );
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isAndroid
                      ? 'bg-[#0B111E] text-emerald-300 border-slate-700'
                      : 'bg-[#F2F2F7] text-slate-800 border-slate-200'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف تطبيق الأندرويد</span>
                </button>
              </div>
            </div>

            {/* Card 4: iPhone iOS 18 Native App Package */}
            <div
              className={`p-4 rounded-3xl space-y-2.5 ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-white border border-slate-200/80 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#007AFF]">
                  🍎 تطبيق الآيفون المتكامل (iPhone iOS 18)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-sky-400">
                  Apple WebClip Profile
                </span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                مصمم وفق معايير Apple Cupertino مع الجزيرة التفاعلية (Dynamic
                Island) وملف تعريف رسمي يضيف أيقونة التطبيق على شاشة الآيفون.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPlatformMode('ios')}
                  className="py-2.5 px-3 rounded-xl bg-[#007AFF] hover:bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>تشغيل تطبيق الآيفون الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    installIOS();
                    showPlatformToast(
                      'تم تنزيل ملف تعريف تطبيق الآيفون (iOS Profile)!'
                    );
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isAndroid
                      ? 'bg-[#0B111E] text-sky-300 border-slate-700'
                      : 'bg-[#F2F2F7] text-slate-800 border-slate-200'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف تثبيت الآيفون</span>
                </button>
              </div>
            </div>

            {/* Card 5: QR Code & Direct Link */}
            <div
              className={`p-4 rounded-3xl flex flex-col items-center text-center space-y-2.5 ${
                isAndroid
                  ? 'bg-[#141E30] border border-slate-800'
                  : 'bg-white border border-slate-200/80 shadow-2xs'
              }`}
            >
              <h3 className="text-xs font-extrabold">
                امسح رمز QR بكاميرا هاتفك لفتح التطبيق مباشرة
              </h3>
              <div className="p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                <img
                  src={qrImageUrl}
                  alt="QR Code"
                  className="w-36 h-36 rounded-lg"
                />
              </div>
              <div className="w-full flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={standaloneLaunchUrl}
                  className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-mono ${
                    isAndroid
                      ? 'bg-[#0B111E] text-slate-300 border border-slate-800'
                      : 'bg-[#F2F2F7] text-slate-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={async () => {
                    await copyTextSafe(standaloneLaunchUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2500);
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          4. MATERIAL 3 FLOATING ACTION BUTTON (FAB) ON ANDROID
         ===================================================================== */}
      {isAndroid && activeTab !== 'install' && (
        <button
          type="button"
          data-testid="android-fab-button"
          onClick={handleOpenAddMember}
          aria-label="تسجيل مشترك جديد"
          className="fixed sm:absolute bottom-20 left-4 z-20 h-12 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-xl shadow-emerald-500/30 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>مشترك جديد</span>
        </button>
      )}

      {/* =====================================================================
          5. NATIVE BOTTOM NAVIGATION BAR (Material 3 Pill Bar vs iOS Tab Bar)
         ===================================================================== */}
      <nav
        aria-label={`شريط تنقل ${isAndroid ? 'أندرويد' : 'آيفون'}`}
        data-testid={`bottom-nav-${osType}`}
        className={`sticky bottom-0 z-20 pt-1.5 pb-2 px-2 border-t transition-colors ${
          isAndroid
            ? 'bg-[#0F172A]/95 backdrop-blur-lg border-slate-800'
            : 'bg-white/90 backdrop-blur-xl border-slate-200/80'
        }`}
      >
        <div className="grid grid-cols-6 items-center">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`nav-tab-${osType}-${tab.id}`}
                onClick={() => onChangeTab(tab.id)}
                className="flex flex-col items-center justify-center py-1 cursor-pointer group"
              >
                {isAndroid ? (
                  /* Material Design 3 Pill Indicator */
                  <div
                    className={`w-12 h-7 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                ) : (
                  /* iOS Cupertino Tab Icon */
                  <div
                    className={`h-7 flex items-center justify-center transition-colors ${
                      isActive
                        ? 'text-[#007AFF]'
                        : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <span
                  className={`text-[10px] mt-0.5 whitespace-nowrap ${
                    isActive
                      ? isAndroid
                        ? 'font-extrabold text-emerald-400'
                        : 'font-bold text-[#007AFF]'
                      : isAndroid
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Native Home Indicator Pill at Bottom of Screen */}
        <div className="mt-1.5 flex justify-center">
          <div
            className={`w-28 h-1 rounded-full ${
              isAndroid ? 'bg-slate-700' : 'bg-slate-900/30'
            }`}
          />
        </div>
      </nav>

      {/* =====================================================================
          6. NATIVE SLIDE-UP BOTTOM SHEETS (ADD MEMBER, RENEW, CANCEL, ADD PLAN)
         ===================================================================== */}

      {/* Sheet A: Add New Member + Subscription */}
      {showAddMemberSheet && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 max-h-[90vh] overflow-y-auto ${
              isAndroid
                ? 'bg-[#141E30] text-white border border-slate-700'
                : 'bg-white text-slate-900'
            }`}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-500/40 mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                تسجيل مشترك جديد وإصدار باركود
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMemberSheet(false)}
                className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>

            {addMemberError && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 text-xs font-bold">
                {addMemberError}
              </div>
            )}

            <form onSubmit={handleSubmitNewMember} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">
                  اسم المشترك الكامل *
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="مثال: فهد عبد الله العتيبي"
                  className={`w-full px-3.5 py-2.5 rounded-xl ${
                    isAndroid
                      ? 'bg-[#0B111E] border border-slate-700 text-white'
                      : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">رقم الجوال *</label>
                  <input
                    type="tel"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    placeholder="05XXXXXXXX"
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">المدرب المسؤول</label>
                  <input
                    type="text"
                    value={newMemberTrainer}
                    onChange={(e) => setNewMemberTrainer(e.target.value)}
                    placeholder="كابتن طارق"
                    className={`w-full px-3.5 py-2.5 rounded-xl ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">الجنس</label>
                  <select
                    value={newMemberGender}
                    onChange={(e) =>
                      setNewMemberGender(e.target.value as 'male' | 'female')
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl font-bold ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">باقة الاشتراك *</label>
                  <select
                    value={newMemberPlanId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setNewMemberPlanId(pid);
                      const found = plans.find((p) => p.id === pid);
                      if (found) setNewMemberPaidAmount(String(found.price));
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl font-bold ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatMoney(p.price, gymProfile.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">المبلغ المدفوع</label>
                  <input
                    type="number"
                    value={newMemberPaidAmount}
                    onChange={(e) => setNewMemberPaidAmount(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">طريقة الدفع</label>
                  <select
                    value={newMemberPaymentMethod}
                    onChange={(e) =>
                      setNewMemberPaymentMethod(e.target.value as PaymentMethod)
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl font-bold ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="cash">نقدي (Cash)</option>
                    <option value="card">شبكة / مدى</option>
                    <option value="transfer">تحويل بنكي</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-3 rounded-2xl font-extrabold text-sm cursor-pointer mt-2 ${
                  isAndroid
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#007AFF] text-white'
                }`}
              >
                حفظ المشترك وإصدار بطاقة الباركود
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sheet B: Renew Subscription */}
      {renewMemberTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 ${
              isAndroid
                ? 'bg-[#141E30] text-white border border-slate-700'
                : 'bg-white text-slate-900'
            }`}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-500/40 mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                تجديد اشتراك: {renewMemberTarget.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setRenewMemberTarget(null)}
                className="text-xs font-bold opacity-70 cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRenew} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">اختر باقة التجديد</label>
                <select
                  value={renewPlanId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setRenewPlanId(pid);
                    const found = plans.find((p) => p.id === pid);
                    if (found) setRenewPaidAmount(String(found.price));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl font-bold ${
                    isAndroid
                      ? 'bg-[#0B111E] border border-slate-700 text-white'
                      : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                  }`}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(p.price, gymProfile.currency)} (
                      {p.durationDays} يوم)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">المبلغ المدفوع</label>
                  <input
                    type="number"
                    value={renewPaidAmount}
                    onChange={(e) => setRenewPaidAmount(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">طريقة الدفع</label>
                  <select
                    value={renewMethod}
                    onChange={(e) =>
                      setRenewMethod(e.target.value as PaymentMethod)
                    }
                    className={`w-full px-3.5 py-2.5 rounded-xl font-bold ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="cash">نقدي</option>
                    <option value="card">شبكة / مدى</option>
                    <option value="transfer">تحويل بنكي</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-3 rounded-2xl font-extrabold text-sm cursor-pointer ${
                  isAndroid
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#007AFF] text-white'
                }`}
              >
                تأكيد التجديد وتفعيل الباركود فوراً
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sheet C: Cancel Subscription */}
      {cancelMemberTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 ${
              isAndroid
                ? 'bg-[#141E30] text-white border border-slate-700'
                : 'bg-white text-slate-900'
            }`}
          >
            <h3 className="text-base font-extrabold text-rose-500">
              إيقاف اشتراك: {cancelMemberTarget.fullName}
            </h3>
            <form onSubmit={handleSubmitCancel} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">سبب الإيقاف</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl ${
                    isAndroid
                      ? 'bg-[#0B111E] border border-slate-700 text-white'
                      : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                  }`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold cursor-pointer"
                >
                  تأكيد الإيقاف
                </button>
                <button
                  type="button"
                  onClick={() => setCancelMemberTarget(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-700 text-white font-bold cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sheet D: Add New Plan */}
      {showAddPlanSheet && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 ${
              isAndroid
                ? 'bg-[#141E30] text-white border border-slate-700'
                : 'bg-white text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold">
                إضافة باقة اشتراك جديدة
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPlanSheet(false)}
                className="text-xs font-bold opacity-70 cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>
            {planFormError && (
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 text-xs font-bold">
                {planFormError}
              </div>
            )}
            <form onSubmit={handleSubmitNewPlan} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">اسم الباقة *</label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="مثال: باقة 4 أشهر VIP"
                  className={`w-full px-3.5 py-2.5 rounded-xl ${
                    isAndroid
                      ? 'bg-[#0B111E] border border-slate-700 text-white'
                      : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">المدة (بالأيام)</label>
                  <input
                    type="number"
                    value={newPlanDays}
                    onChange={(e) => setNewPlanDays(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">السعر</label>
                  <input
                    type="number"
                    value={newPlanPrice}
                    onChange={(e) => setNewPlanPrice(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl font-mono ${
                      isAndroid
                        ? 'bg-[#0B111E] border border-slate-700 text-white'
                        : 'bg-[#F2F2F7] border border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
              <button
                type="submit"
                className={`w-full py-3 rounded-2xl font-extrabold text-sm cursor-pointer ${
                  isAndroid
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#007AFF] text-white'
                }`}
              >
                حفظ الباقة الجديدة
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
