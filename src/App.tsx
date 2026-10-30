import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ScanLine,
  Users,
  Layers,
  Wallet,
  BellRing,
  BarChart3,
  UserPlus,
  Dumbbell,
} from 'lucide-react';
import {
  CheckInEvaluation,
  CheckInRecord,
  GymProfile,
  Member,
  PaymentMethod,
  PaymentRecord,
  SubscriptionPlan,
} from './types/gym';
import { createInitialSeedData, getTodayDateStr } from './data/seedData';
import {
  buildExpiryAlerts,
  calculateEndDate,
  computeDashboardMetrics,
  evaluateCheckInByBarcode,
  generateNextBarcode,
} from './utils/gymLogic';
import { DashboardView } from './components/DashboardView';
import { CheckInTerminalView } from './components/CheckInTerminalView';
import { MembersView } from './components/MembersView';
import { PlansView } from './components/PlansView';
import { PaymentsView } from './components/PaymentsView';
import { AlertsView } from './components/AlertsView';
import { ReportsAndSettingsView } from './components/ReportsAndSettingsView';
import { BarcodeModal } from './components/BarcodeModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import {
  NativeMobileAppShell,
  NativeAppTab,
} from './components/NativeMobileAppShell';
import { IronPlusRepoPortal } from './components/IronPlusRepoPortal';
import { usePWAInstall } from './utils/usePWAInstall';
import {
  Smartphone,
  Maximize2,
  Columns2,
  Monitor,
  FolderGit2,
} from 'lucide-react';

type ActiveTab =
  | 'dashboard'
  | 'checkin'
  | 'members'
  | 'plans'
  | 'payments'
  | 'alerts'
  | 'reports';

const STORAGE_KEY = 'ironpulse_gym_erp_v3';

export default function App() {
  const todayStr = useMemo(() => getTodayDateStr(), []);
  const seed = useMemo(() => createInitialSeedData(todayStr), [todayStr]);

  const [gymProfile, setGymProfile] = useState<GymProfile>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.gymProfile) return parsed.gymProfile;
      }
    } catch {
      // ignore storage errors
    }
    return seed.gymProfile;
  });

  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.plans) && parsed.plans.length > 0) return parsed.plans;
      }
    } catch {
      // ignore
    }
    return seed.plans;
  });

  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.members) && parsed.members.length > 0) return parsed.members;
      }
    } catch {
      // ignore
    }
    return seed.members;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.payments)) return parsed.payments;
      }
    } catch {
      // ignore
    }
    return seed.payments;
  });

  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.checkIns)) return parsed.checkIns;
      }
    } catch {
      // ignore
    }
    return seed.checkIns;
  });

  const [notifiedMemberIds, setNotifiedMemberIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [lastCheckInResult, setLastCheckInResult] = useState<CheckInEvaluation | null>(null);
  const [barcodeModalMember, setBarcodeModalMember] = useState<Member | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [renewTargetMember, setRenewTargetMember] = useState<Member | null>(null);

  // Sync state to localStorage for offline PWA persistence
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          gymProfile,
          plans,
          members,
          payments,
          checkIns,
        })
      );
    } catch {
      // ignore quota errors
    }
  }, [gymProfile, plans, members, payments, checkIns]);

  const alerts = useMemo(
    () =>
      buildExpiryAlerts(
        members,
        gymProfile.alertThresholdDays,
        todayStr,
        [],
        notifiedMemberIds
      ),
    [members, gymProfile.alertThresholdDays, todayStr, notifiedMemberIds]
  );

  const metrics = useMemo(
    () =>
      computeDashboardMetrics(
        members,
        payments,
        checkIns,
        gymProfile.alertThresholdDays,
        todayStr
      ),
    [members, payments, checkIns, gymProfile.alertThresholdDays, todayStr]
  );

  // Handler: Perform Barcode Check-in
  const handlePerformCheckIn = (barcodeInput: string) => {
    const evaluation = evaluateCheckInByBarcode(
      barcodeInput,
      members,
      gymProfile.alertThresholdDays,
      todayStr
    );
    setLastCheckInResult(evaluation);

    if (evaluation.found && evaluation.member && evaluation.status) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const timestamp = `${todayStr} ${hh}:${mm}`;

      const newRecord: CheckInRecord = {
        id: `chk-${Date.now()}`,
        memberId: evaluation.member.id,
        memberName: evaluation.member.fullName,
        barcode: evaluation.member.barcode,
        planName: evaluation.member.subscription.planName,
        timestamp,
        date: todayStr,
        statusAtEntry: evaluation.status,
        allowed: evaluation.allowed,
        remainingDays: evaluation.remainingDays,
        reason: evaluation.messageTitle,
      };

      setCheckIns((prev) => [newRecord, ...prev]);

      if (evaluation.allowed) {
        setMembers((prev) =>
          prev.map((m) =>
            m.id === evaluation.member!.id
              ? {
                  ...m,
                  totalCheckIns: m.totalCheckIns + 1,
                  lastCheckIn: timestamp,
                }
              : m
          )
        );
      }
    }
  };

  // Handler: Add New Member + Subscription + Generate Barcode + Log Payment
  const handleAddMemberWithSubscription = (payload: {
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
  }) => {
    const plan = plans.find((p) => p.id === payload.planId) || plans[0];
    const barcode = generateNextBarcode(members);
    const endDate = calculateEndDate(payload.startDate, plan.durationDays);
    const newMemberId = `mem-${Date.now()}`;

    const newMember: Member = {
      id: newMemberId,
      barcode,
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      gender: payload.gender,
      age: payload.age,
      weightKg: payload.weightKg,
      heightCm: payload.heightCm,
      goal: payload.goal,
      joinDate: payload.startDate,
      notes: payload.notes,
      subscription: {
        planId: plan.id,
        planName: plan.name,
        price: plan.price,
        startDate: payload.startDate,
        endDate,
        trainerName: payload.trainerName,
      },
      totalCheckIns: 0,
    };

    const remainingAmount = Math.max(0, plan.price - payload.paidAmount);
    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      invoiceNumber: `INV-2026-${100 + payments.length + 1}`,
      memberId: newMemberId,
      memberName: payload.fullName,
      barcode,
      planName: plan.name,
      amount: plan.price,
      paidAmount: payload.paidAmount,
      remainingAmount,
      method: payload.paymentMethod,
      date: todayStr,
      type: 'new_subscription',
    };

    setMembers((prev) => [newMember, ...prev]);
    setPayments((prev) => [newPayment, ...prev]);
  };

  // Handler: Renew Member Subscription
  const handleRenewSubscription = (payload: {
    memberId: string;
    planId: string;
    startDate: string;
    paidAmount: number;
    paymentMethod: PaymentMethod;
  }) => {
    const plan = plans.find((p) => p.id === payload.planId) || plans[0];
    const member = members.find((m) => m.id === payload.memberId);
    if (!plan || !member) return;

    const endDate = calculateEndDate(payload.startDate, plan.durationDays);

    setMembers((prev) =>
      prev.map((m) =>
        m.id === payload.memberId
          ? {
              ...m,
              subscription: {
                planId: plan.id,
                planName: plan.name,
                price: plan.price,
                startDate: payload.startDate,
                endDate,
                cancelledAt: undefined,
                cancelReason: undefined,
                trainerName: m.subscription.trainerName,
              },
            }
          : m
      )
    );

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      invoiceNumber: `INV-2026-${100 + payments.length + 1}`,
      memberId: member.id,
      memberName: member.fullName,
      barcode: member.barcode,
      planName: plan.name,
      amount: plan.price,
      paidAmount: payload.paidAmount,
      remainingAmount: Math.max(0, plan.price - payload.paidAmount),
      method: payload.paymentMethod,
      date: todayStr,
      type: 'renewal',
    };

    setPayments((prev) => [newPayment, ...prev]);
  };

  // Handler: Cancel Member Subscription
  const handleCancelSubscription = (memberId: string, reason: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              subscription: {
                ...m.subscription,
                cancelledAt: todayStr,
                cancelReason: reason,
              },
            }
          : m
      )
    );
  };

  // Handler: Plans Management
  const handleAddPlan = (newPlan: Omit<SubscriptionPlan, 'id'>) => {
    const created: SubscriptionPlan = {
      ...newPlan,
      id: `plan-${Date.now()}`,
    };
    setPlans((prev) => [...prev, created]);
  };

  const handleTogglePlanActive = (planId: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, active: !p.active } : p))
    );
  };

  const handleDeletePlan = (planId: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  };

  // Handler: Collect Remaining Payment Balance
  const handleCollectRemainingBalance = (paymentId: string) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === paymentId
          ? {
              ...p,
              paidAmount: p.paidAmount + p.remainingAmount,
              remainingAmount: 0,
            }
          : p
      )
    );
  };

  // Handler: Mark Alert Notified
  const handleMarkAlertNotified = (memberId: string) => {
    setNotifiedMemberIds((prev) =>
      prev.includes(memberId) ? prev : [...prev, memberId]
    );
  };

  // Handler: Reset Demo Data
  const handleResetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGymProfile(seed.gymProfile);
    setPlans(seed.plans);
    setMembers(seed.members);
    setPayments(seed.payments);
    setCheckIns(seed.checkIns);
    setLastCheckInResult(null);
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'dashboard', label: 'لوحة التحكم (Dashboard)', shortLabel: 'الرئيسية', icon: LayoutDashboard },
    { id: 'checkin', label: 'تسجيل الحضور والباركود', shortLabel: 'البوابة', icon: ScanLine },
    { id: 'members', label: 'الأعضاء والاشتراكات', shortLabel: 'الأعضاء', icon: Users, count: members.length },
    { id: 'plans', label: 'خطط الاشتراك والأسعار', shortLabel: 'الباقات', icon: Layers, count: plans.length },
    { id: 'payments', label: 'المدفوعات والفواتير', shortLabel: 'المدفوعات', icon: Wallet },
    { id: 'alerts', label: 'تنبيهات انتهاء الاشتراك', shortLabel: 'التنبيهات', icon: BellRing, count: alerts.length },
    { id: 'reports', label: 'التقارير وبيانات الجيم', shortLabel: 'التقارير', icon: BarChart3 },
  ];

  const [nativeAppTab, setNativeAppTab] = useState<NativeAppTab>('home');
  const [liveEdgeUrl, setLiveEdgeUrl] = useState<string | null>(null);
  const [showRepoPortal, setShowRepoPortal] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('repo') === 'iron-plus' ||
      params.get('repo') === 'iron plus' ||
      window.location.pathname.includes('iron-plus')
    );
  });

  useEffect(() => {
    let active = true;
    fetch('/api/live-status')
      .then((r) => r.json())
      .then((data) => {
        if (!active || !data) return;
        if (data.pagesDevLive && data.pagesDevUrl) {
          setLiveEdgeUrl(data.pagesDevUrl);
        } else if (data.cloudflareTunnelUrl) {
          setLiveEdgeUrl(data.cloudflareTunnelUrl);
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      active = false;
    };
  }, [showRepoPortal]);

  const {
    platformMode,
    setPlatformMode,
    isFullscreenApp,
    enterTrueFullscreenApp,
    toastMessage,
    dismissToast,
  } = usePWAInstall();

  const isNativeMobileOS =
    platformMode === 'android' ||
    platformMode === 'ios' ||
    platformMode === 'dual';

  if (showRepoPortal) {
    return (
      <>
        <OfflineIndicator />
        {toastMessage && (
          <div
            role="status"
            data-testid="platform-toast-banner"
            onClick={dismissToast}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-2xl flex items-center justify-between gap-2 cursor-pointer"
          >
            <span>{toastMessage}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/15">
              إغلاق
            </span>
          </div>
        )}
        <IronPlusRepoPortal
          onCloseRepoView={() => setShowRepoPortal(false)}
          onOpenAndroidApp={() => {
            setShowRepoPortal(false);
            setPlatformMode('android');
          }}
          onOpenIOSApp={() => {
            setShowRepoPortal(false);
            setPlatformMode('ios');
          }}
          onOpenDualMode={() => {
            setShowRepoPortal(false);
            setPlatformMode('dual');
          }}
        />
      </>
    );
  }

  return (
    <div
      data-testid={`app-root-mode-${platformMode}`}
      className={`min-h-screen flex flex-col ${
        isNativeMobileOS
          ? 'bg-[#060911] text-slate-100 items-center'
          : 'bg-slate-50 text-slate-900 lg:flex-row'
      }`}
    >
      <OfflineIndicator />

      {/* Floating Native OS Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          data-testid="platform-toast-banner"
          onClick={dismissToast}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-2xl flex items-center justify-between gap-2 cursor-pointer"
        >
          <span>{toastMessage}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/15">
            إغلاق
          </span>
        </div>
      )}

      {/* =====================================================================
          NATIVE ANDROID & iPHONE OS SWITCHER BAR (MOBILE + DESKTOP TOOLBAR)
         ===================================================================== */}
      {isNativeMobileOS && !isFullscreenApp && (
        <div
          data-testid="native-os-top-switcher"
          className="flex w-full bg-[#0B111E] border-b border-slate-800 px-3 sm:px-4 py-2 flex-wrap items-center justify-between gap-2 z-30 no-print"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5 sm:pb-0">
            <button
              type="button"
              data-testid="mode-btn-android"
              onClick={() => setPlatformMode('android')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                platformMode === 'android'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>تطبيق أندرويد (Android)</span>
            </button>

            <button
              type="button"
              data-testid="mode-btn-ios"
              onClick={() => setPlatformMode('ios')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                platformMode === 'ios'
                  ? 'bg-[#007AFF] text-white shadow-md shadow-blue-500/25'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>تطبيق آيفون (iPhone iOS)</span>
            </button>

            <button
              type="button"
              data-testid="mode-btn-dual"
              onClick={() => setPlatformMode('dual')}
              className={`hidden lg:inline-flex px-3 py-1.5 rounded-xl text-xs font-extrabold items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                platformMode === 'dual'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/25'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5 shrink-0" />
              <span>عرض التطبيقين معاً (Android + iPhone)</span>
            </button>

            <button
              type="button"
              data-testid="mode-btn-repo"
              onClick={() => setShowRepoPortal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
            >
              <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
              <span>ربط Cloudflare + GitHub (iron-plus)</span>
            </button>

            {liveEdgeUrl && (
              <a
                href={liveEdgeUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="top-bar-live-edge-link"
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25 whitespace-nowrap"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>رابط Cloudflare الحي الشغال</span>
              </a>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              data-testid="top-bar-fullscreen-btn"
              onClick={() => enterTrueFullscreenApp()}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>ملء الشاشة</span>
            </button>

            <button
              type="button"
              data-testid="mode-btn-desktop"
              onClick={() => setPlatformMode('desktop')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">لوحة الكمبيوتر</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODE A: INTEGRATED ANDROID APP, iPHONE APP, OR DUAL SIDE-BY-SIDE APPS
         ===================================================================== */}
      {isNativeMobileOS ? (
        <div
          className={`w-full flex-1 flex justify-center ${
            platformMode === 'dual'
              ? 'items-start gap-6 p-4 lg:p-6 overflow-x-auto'
              : isFullscreenApp
              ? 'p-0'
              : 'p-0 sm:py-3 sm:px-4'
          }`}
        >
          {/* Single Phone Frame (Android OR iOS) */}
          {platformMode !== 'dual' && (
            <div
              data-testid={`phone-frame-${platformMode}`}
              className={`w-full flex flex-col overflow-hidden ${
                isFullscreenApp
                  ? 'h-dvh max-w-none'
                  : 'h-dvh sm:h-[830px] max-w-[460px] sm:rounded-[38px] sm:border-[7px] sm:border-slate-800 sm:shadow-[0_25px_70px_rgba(0,0,0,0.75)]'
              }`}
            >
              <NativeMobileAppShell
                osType={platformMode === 'ios' ? 'ios' : 'android'}
                activeTab={nativeAppTab}
                onChangeTab={setNativeAppTab}
                gymProfile={gymProfile}
                metrics={metrics}
                members={members}
                plans={plans}
                payments={payments}
                checkIns={checkIns}
                alerts={alerts}
                todayStr={todayStr}
                lastCheckInResult={lastCheckInResult}
                onPerformCheckIn={handlePerformCheckIn}
                onAddMemberWithSubscription={handleAddMemberWithSubscription}
                onRenewSubscription={handleRenewSubscription}
                onCancelSubscription={handleCancelSubscription}
                onAddPlan={handleAddPlan}
                onTogglePlanActive={handleTogglePlanActive}
                onDeletePlan={handleDeletePlan}
                onCollectRemainingBalance={handleCollectRemainingBalance}
                onMarkAlertNotified={handleMarkAlertNotified}
                onSaveGymProfile={setGymProfile}
                onResetDemoData={handleResetDemoData}
                onOpenBarcodeModal={(m) => setBarcodeModalMember(m)}
                onOpenRepoPortal={() => setShowRepoPortal(true)}
              />
            </div>
          )}

          {/* Dual Side-by-Side Phone Frames (Android 15 + iPhone iOS 18 Together) */}
          {platformMode === 'dual' && (
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-start justify-items-center">
              <div className="w-full max-w-[460px] flex flex-col rounded-[38px] border-[7px] border-slate-800 shadow-2xl overflow-hidden min-h-[820px] max-h-[880px]">
                <NativeMobileAppShell
                  osType="android"
                  activeTab={nativeAppTab}
                  onChangeTab={setNativeAppTab}
                  gymProfile={gymProfile}
                  metrics={metrics}
                  members={members}
                  plans={plans}
                  payments={payments}
                  checkIns={checkIns}
                  alerts={alerts}
                  todayStr={todayStr}
                  lastCheckInResult={lastCheckInResult}
                  onPerformCheckIn={handlePerformCheckIn}
                  onAddMemberWithSubscription={handleAddMemberWithSubscription}
                  onRenewSubscription={handleRenewSubscription}
                  onCancelSubscription={handleCancelSubscription}
                  onAddPlan={handleAddPlan}
                  onTogglePlanActive={handleTogglePlanActive}
                  onDeletePlan={handleDeletePlan}
                  onCollectRemainingBalance={handleCollectRemainingBalance}
                  onMarkAlertNotified={handleMarkAlertNotified}
                  onSaveGymProfile={setGymProfile}
                  onResetDemoData={handleResetDemoData}
                  onOpenBarcodeModal={(m) => setBarcodeModalMember(m)}
                  onOpenRepoPortal={() => setShowRepoPortal(true)}
                />
              </div>

              <div className="w-full max-w-[460px] flex flex-col rounded-[38px] border-[7px] border-slate-300 shadow-2xl overflow-hidden min-h-[820px] max-h-[880px]">
                <NativeMobileAppShell
                  osType="ios"
                  activeTab={nativeAppTab}
                  onChangeTab={setNativeAppTab}
                  gymProfile={gymProfile}
                  metrics={metrics}
                  members={members}
                  plans={plans}
                  payments={payments}
                  checkIns={checkIns}
                  alerts={alerts}
                  todayStr={todayStr}
                  lastCheckInResult={lastCheckInResult}
                  onPerformCheckIn={handlePerformCheckIn}
                  onAddMemberWithSubscription={handleAddMemberWithSubscription}
                  onRenewSubscription={handleRenewSubscription}
                  onCancelSubscription={handleCancelSubscription}
                  onAddPlan={handleAddPlan}
                  onTogglePlanActive={handleTogglePlanActive}
                  onDeletePlan={handleDeletePlan}
                  onCollectRemainingBalance={handleCollectRemainingBalance}
                  onMarkAlertNotified={handleMarkAlertNotified}
                  onSaveGymProfile={setGymProfile}
                  onResetDemoData={handleResetDemoData}
                  onOpenBarcodeModal={(m) => setBarcodeModalMember(m)}
                  onOpenRepoPortal={() => setShowRepoPortal(true)}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =====================================================================
            MODE B: DESKTOP ERP VIEW (AVAILABLE ON DEMAND)
           ===================================================================== */
        <>
          <aside
            aria-label="القائمة الرئيسية للنظام"
            className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 bg-slate-900 text-slate-100 border-l border-slate-800 z-30 no-print"
          >
            <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-bold tracking-tight text-white block truncate">
                  IronPulse ERP
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  نظام إدارة الجيم المتكامل
                </span>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isActive ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800 space-y-3">
              <PWAInstallButton variant="sidebar" />
              <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono tabular-nums">
                <span>تاريخ النظام</span>
                <span>{todayStr}</span>
              </div>
            </div>
          </aside>

          <div className="flex-1 lg:mr-64 flex flex-col min-w-0 pb-20 lg:pb-8">
            <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 no-print">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 truncate"
              >
                {gymProfile.gymName}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPlatformMode('android')}
                  className="px-3 py-1.5 text-xs font-extrabold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg cursor-pointer"
                >
                  تطبيق الأندرويد
                </button>
                <button
                  type="button"
                  onClick={() => setPlatformMode('ios')}
                  className="px-3 py-1.5 text-xs font-extrabold text-white bg-[#007AFF] hover:bg-blue-600 rounded-lg cursor-pointer"
                >
                  تطبيق الآيفون
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('members');
                    setShowAddMemberModal(true);
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إضافة عضو جديد</span>
                </button>
              </div>
            </header>

            <main className="flex-1 w-full mx-auto space-y-5 p-4 sm:p-6 lg:p-8 max-w-7xl">
              <PWAInstallButton variant="banner" />

              {activeTab === 'dashboard' && (
                <DashboardView
                  gymProfile={gymProfile}
                  metrics={metrics}
                  members={members}
                  alerts={alerts}
                  checkIns={checkIns}
                  lastCheckInResult={lastCheckInResult}
                  onPerformCheckIn={handlePerformCheckIn}
                  onOpenAddMember={() => {
                    setActiveTab('members');
                    setShowAddMemberModal(true);
                  }}
                  onOpenRenewMember={(m) => {
                    setActiveTab('members');
                    setRenewTargetMember(m);
                  }}
                  onOpenBarcodeModal={(m) => setBarcodeModalMember(m)}
                  onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
                />
              )}

              {activeTab === 'checkin' && (
                <CheckInTerminalView
                  gymProfile={gymProfile}
                  members={members}
                  checkIns={checkIns}
                  todayStr={todayStr}
                  lastEvaluation={lastCheckInResult}
                  onScanBarcode={handlePerformCheckIn}
                  onOpenRenewMember={(m) => {
                    setActiveTab('members');
                    setRenewTargetMember(m);
                  }}
                  onOpenBarcodeModal={(m) => setBarcodeModalMember(m)}
                />
              )}

              {activeTab === 'members' && (
                <MembersView
                  gymProfile={gymProfile}
                  members={members}
                  plans={plans}
                  todayStr={todayStr}
                  isMobileShell={false}
                  showAddModalExternal={showAddMemberModal}
                  renewTargetMember={renewTargetMember}
                  onCloseAddModalExternal={() => setShowAddMemberModal(false)}
                  onCloseRenewModal={() => setRenewTargetMember(null)}
                  onAddMemberWithSubscription={handleAddMemberWithSubscription}
                  onRenewSubscription={handleRenewSubscription}
                  onCancelSubscription={handleCancelSubscription}
                  onOpenBarcodeModal={(m) => setBarcodeModalMember(m)}
                  onOpenRenewModalForMember={(m) => setRenewTargetMember(m)}
                  onQuickCheckIn={handlePerformCheckIn}
                />
              )}

              {activeTab === 'plans' && (
                <PlansView
                  gymProfile={gymProfile}
                  plans={plans}
                  members={members}
                  onAddPlan={handleAddPlan}
                  onTogglePlanActive={handleTogglePlanActive}
                  onDeletePlan={handleDeletePlan}
                />
              )}

              {activeTab === 'payments' && (
                <PaymentsView
                  gymProfile={gymProfile}
                  payments={payments}
                  onCollectRemainingBalance={handleCollectRemainingBalance}
                />
              )}

              {activeTab === 'alerts' && (
                <AlertsView
                  gymProfile={gymProfile}
                  alerts={alerts}
                  members={members}
                  onMarkAlertNotified={handleMarkAlertNotified}
                  onUpdateAlertThreshold={(days) =>
                    setGymProfile((prev) => ({
                      ...prev,
                      alertThresholdDays: days,
                    }))
                  }
                  onOpenRenewMember={(m) => {
                    setActiveTab('members');
                    setRenewTargetMember(m);
                  }}
                  onOpenBarcodeModal={(m) => setBarcodeModalMember(m)}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsAndSettingsView
                  gymProfile={gymProfile}
                  metrics={metrics}
                  members={members}
                  plans={plans}
                  payments={payments}
                  checkIns={checkIns}
                  todayStr={todayStr}
                  onSaveGymProfile={setGymProfile}
                  onResetDemoData={handleResetDemoData}
                />
              )}
            </main>
          </div>
        </>
      )}

      {/* Member Barcode & Printable ID Card Modal */}
      <BarcodeModal
        member={barcodeModalMember}
        gymProfile={gymProfile}
        todayStr={todayStr}
        onClose={() => setBarcodeModalMember(null)}
        onQuickCheckIn={handlePerformCheckIn}
      />
    </div>
  );
}
