import React, { useState } from 'react';
import {
  Smartphone,
  Monitor,
  X,
  WifiOff,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  QrCode,
  Download,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react';
import {
  usePWAInstall,
  useOnlineStatus,
  copyTextSafe,
  triggerAndroidPackageDownload,
} from '../utils/usePWAInstall';

export const DEV_APP_URL =
  'https://ais-dev-7c4dtny763c3a7gcena3uq-159508686400.europe-west2.run.app';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { toastMessage, dismissToast } = usePWAInstall();

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          data-testid="platform-toast-banner"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold shadow-2xl border border-emerald-400 flex items-center justify-between gap-3 no-print"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="إغلاق الإشعار"
            className="p-1 rounded-md hover:bg-emerald-700 text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>وضع عدم الاتصال (Offline) — يعمل التطبيق بالبيانات المحفوظة محلياً</span>
        </div>
      )}
    </>
  );
};

// Deterministic SVG QR-like Matrix for the Mobile App Install URL
const AppQrMatrix: React.FC<{ value: string }> = ({ value }) => {
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) ||
        (r < 8 && c >= size - 8) ||
        (r >= size - 8 && c < 8);
      if (inFinder) continue;
      if (r === 6 || c === 6) {
        cells[r][c] = (r + c) % 2 === 0;
        continue;
      }
      const bit = ((hash >>> ((r * size + c) % 24)) ^ (r * 31 + c * 17)) & 1;
      cells[r][c] = bit === 1;
    }
  }

  return (
    <svg
      width={104}
      height={104}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-lg border border-slate-200 bg-white p-2 shrink-0"
      role="img"
      aria-label="رمز QR لتثبيت تطبيق الجوال"
    >
      {cells.map((row, rIdx) =>
        row.map((filled, cIdx) =>
          filled ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx}
              y={rIdx}
              width={1}
              height={1}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
};

export const PWAInstallButton: React.FC<{
  variant?: 'sidebar' | 'compact' | 'banner' | 'header';
}> = ({ variant = 'sidebar' }) => {
  const {
    platformMode,
    setPlatformMode,
    bannerCollapsed,
    setBannerCollapsed,
    isFullscreenApp,
    enterTrueFullscreenApp,
    exitTrueFullscreenApp,
    installAndroid,
    installIOS,
  } = usePWAInstall();

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [busyPlatform, setBusyPlatform] = useState<'android' | 'ios' | null>(null);

  const activeAppUrl =
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.origin.includes('localhost')
      ? window.location.origin
      : DEV_APP_URL;

  const standaloneLaunchUrl = `${activeAppUrl}/?app=native`;

  const handleFullscreenLaunch = async () => {
    setBusyPlatform('android');
    try {
      await installAndroid(false);
    } finally {
      setBusyPlatform(null);
    }
  };

  const handleAndroidOfflineDownload = async () => {
    setBusyPlatform('android');
    try {
      triggerAndroidPackageDownload();
      await installAndroid(false);
      setShowGuideModal(false);
    } finally {
      setBusyPlatform(null);
    }
  };

  const handleIOSDownloadAndPreview = async () => {
    setBusyPlatform('ios');
    try {
      await installIOS();
      setShowGuideModal(false);
    } finally {
      setBusyPlatform(null);
    }
  };

  const handleCopyUrl = async () => {
    await copyTextSafe(standaloneLaunchUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <>
      {variant === 'banner' && (
        <>
          {bannerCollapsed ? (
            /* Sleek Native App Launch & Fullscreen Bar (Does NOT block the Gym App!) */
            <div
              role="region"
              aria-label="شريط تشغيل التطبيق الفعلي"
              data-testid="pwa-collapsed-preview-bar"
              className="rounded-xl bg-slate-900 text-white border border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs no-print"
            >
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-emerald-400">
                  وضع التطبيق الفعلي (Native App)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* 1. True Fullscreen Launch (Hides Browser URL Bar immediately!) */}
                <button
                  type="button"
                  data-testid="fullscreen-app-btn"
                  onClick={() =>
                    isFullscreenApp ? exitTrueFullscreenApp() : enterTrueFullscreenApp()
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  {isFullscreenApp ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                      <span>إنهاء ملء الشاشة</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                      <span>فتح بملء الشاشة (بدون رابط)</span>
                    </>
                  )}
                </button>

                {/* 2. Break out of AI Studio Editor Frame into Standalone App Server */}
                <a
                  href={standaloneLaunchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="open-standalone-app-link"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>فتح كتطبيق مستقل</span>
                </a>

                {/* 3. Open Native Installer Sheet */}
                <button
                  type="button"
                  data-testid="install-android-app-btn"
                  onClick={() => setShowGuideModal(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>تثبيت الأيقونة</span>
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Native App Mode Card (Only if manually expanded) */
            <div
              role="region"
              aria-label="منصة تشغيل وتثبيت التطبيق الفعلي"
              data-testid="pwa-download-banner"
              className="rounded-xl bg-slate-900 text-white border border-slate-800 p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5 no-print"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    تشغيل وتثبيت تطبيق IronPulse الفعلي (بدون شريط الرابط)
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    افتح التطبيق بملء الشاشة الكامل أو افتحه خارج محرر AI Studio لتثبيت الأيقونة على شاشة هاتفك
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="fullscreen-launch-banner-btn"
                  onClick={handleFullscreenLaunch}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4 shrink-0" />
                  <span>فتح بملء الشاشة الكامل (بدون رابط)</span>
                </button>
                <a
                  href={standaloneLaunchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>فتح التطبيق المستقل ↗</span>
                </a>
                <button
                  type="button"
                  onClick={() => setBannerCollapsed(true)}
                  className="min-h-[40px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  إخفاء الشريط
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {variant === 'sidebar' && (
        <div className="space-y-2">
          <button
            type="button"
            data-testid="pwa-sidebar-install-btn"
            onClick={() => setShowGuideModal(true)}
            className="w-full flex items-center justify-between gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Smartphone className="w-4 h-4 text-white shrink-0" />
              <span>فتح وتثبيت تطبيق الهاتف</span>
            </span>
            <Maximize2 className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
          </button>
        </div>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          data-testid="pwa-compact-download-btn"
          onClick={() => enterTrueFullscreenApp()}
          aria-label="فتح التطبيق بملء الشاشة"
          className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>وضع ملء الشاشة</span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          data-testid="pwa-install-modal"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-2xl text-slate-900 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <h3 id="pwa-guide-title" className="text-base font-bold">
                  تشغيل وتثبيت التطبيق الفعلي (بدون شريط رابط)
                </h3>
              </div>
              <button
                type="button"
                data-testid="pwa-modal-close-btn"
                onClick={() => setShowGuideModal(false)}
                aria-label="إغلاق نافذة تثبيت التطبيق"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs leading-relaxed text-slate-600">
              {/* Option 1: Immediate Fullscreen Native App Mode */}
              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
                <div className="font-bold text-emerald-950 text-sm">
                  1. التشغيل الفوري بملء الشاشة الكامل (إخفاء شريط الرابط الآن):
                </div>
                <p className="text-slate-700">
                  يخفي شريط عنوان المتصفح العلوي ويفتح تطبيق الجيم بملء شاشة الهاتف بالكامل فوراً:
                </p>
                <button
                  type="button"
                  data-testid="modal-fullscreen-btn"
                  onClick={async () => {
                    await enterTrueFullscreenApp();
                    setShowGuideModal(false);
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4 shrink-0" />
                  <span>تشغيل التطبيق بملء الشاشة الكامل الآن ⛶</span>
                </button>
              </div>

              {/* Option 2: Install Standalone WebAPK Icon on Phone Home Screen */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2.5">
                <div className="font-bold text-emerald-400 text-sm">
                  2. تثبيت أيقونة التطبيق على شاشة الهاتف الرئيسية (WebAPK):
                </div>
                <p className="text-slate-300">
                  لإزالة شريط <span className="font-mono text-white">aistudio.google.com</span> السفلي والعلوي نهائياً وتثبيت أيقونة <strong>IronPulse</strong> على شاشة هاتفك مثل تطبيقات المتجر:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-200 font-medium">
                  <li>اضغط على الزر بالأسفل لفتح التطبيق المستقل خارج محرر AI Studio.</li>
                  <li>من قائمة متصفح كروم <span className="font-mono">(⋮)</span> اختر <strong>«تثبيت التطبيق / الإضافة إلى الشاشة الرئيسية»</strong>.</li>
                </ol>
                <a
                  href={standaloneLaunchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="modal-open-standalone-link"
                  onClick={() => setShowGuideModal(false)}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer mt-1"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>فتح التطبيق المستقل لتثبيت الأيقونة ↗</span>
                </a>
              </div>

              {/* Option 3: Offline Package & iOS Profile */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="font-bold text-slate-900">
                  3. حزم التثبيت المباشر (Android Offline + iPhone iOS Profile):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="modal-install-android-btn"
                    onClick={handleAndroidOfflineDownload}
                    disabled={busyPlatform !== null}
                    className="min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer px-3"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>حزمة أندرويد (Offline ↓)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="modal-install-ios-btn"
                    onClick={handleIOSDownloadAndPreview}
                    disabled={busyPlatform !== null}
                    className="min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer px-3"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>ملف تعريف الآيفون (iOS ↓)</span>
                  </button>
                </div>
              </div>

              {/* QR & Direct URL */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
                <AppQrMatrix value={standaloneLaunchUrl} />
                <div className="space-y-1.5 flex-1 w-full">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    <span>الرابط المباشر للتطبيق المستقل:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={standaloneLaunchUrl}
                      aria-label="رابط التطبيق المستقل"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-mono text-slate-700 select-all"
                    />
                    <button
                      type="button"
                      data-testid="modal-copy-url-btn"
                      onClick={handleCopyUrl}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedLink ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedLink ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlatformMode(platformMode === 'desktop' ? 'android' : 'desktop');
                  setShowGuideModal(false);
                }}
                className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                <span>
                  {platformMode === 'desktop' ? 'عرض كواجهة هاتف' : 'عرض كواجهة كمبيوتر'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="flex-1 min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
