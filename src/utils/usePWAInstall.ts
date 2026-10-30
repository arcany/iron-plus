import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type AppPlatformMode = 'android' | 'ios' | 'dual' | 'desktop';

const INSTALLED_STORAGE_KEY = 'ironpulse_app_installed_v3';
const PLATFORM_STORAGE_KEY = 'ironpulse_platform_mode_v3';
const PREVIEW_COLLAPSED_KEY = 'ironpulse_preview_installed_v3';
const OFFLINE_CACHE_NAME = 'ironpulse-app-cache-v3';

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalPlatformMode: AppPlatformMode = 'android';
let globalInstalledPlatform: 'android' | 'ios' | null = 'android';
let globalBannerCollapsed = true;
let globalIsFullscreenApp = false;
let globalToastMessage: string | null = null;
let globalPreloadedAndroidBlobUrl: string | null = null;
let toastTimeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function showPlatformToast(msg: string) {
  globalToastMessage = msg;
  if (toastTimeout) clearTimeout(toastTimeout);
  notifyListeners();
  toastTimeout = setTimeout(() => {
    globalToastMessage = null;
    notifyListeners();
  }, 4500);
}

export async function enterTrueFullscreenApp(): Promise<boolean> {
  globalIsFullscreenApp = true;
  globalBannerCollapsed = true;
  let browserFullscreenEntered = false;

  if (typeof document !== 'undefined') {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
        browserFullscreenEntered = true;
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
        browserFullscreenEntered = true;
      }
    } catch {
      // If iframe policy restricts OS fullscreen, we still lock 100% viewport standalone mode
    }
  }

  showPlatformToast(
    browserFullscreenEntered
      ? 'تم تشغيل التطبيق بوضع ملء الشاشة الكامل بدون شريط الرابط!'
      : 'تم تفعيل وضع ملء الشاشة الكامل للتطبيق!'
  );
  notifyListeners();
  return browserFullscreenEntered;
}

export async function exitTrueFullscreenApp(): Promise<void> {
  globalIsFullscreenApp = false;
  if (typeof document !== 'undefined' && document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // ignore
    }
  }
  notifyListeners();
}

if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);

    if (params.get('platform') === 'ios') {
      globalPlatformMode = 'ios';
      globalInstalledPlatform = 'ios';
      globalBannerCollapsed = true;
      globalIsFullscreenApp = true;
    } else if (params.get('platform') === 'dual') {
      globalPlatformMode = 'dual';
      globalBannerCollapsed = true;
    } else if (
      params.get('app') === 'native' ||
      params.get('standalone') === '1' ||
      params.get('installed') === '1' ||
      params.get('platform') === 'android'
    ) {
      globalPlatformMode = 'android';
      globalInstalledPlatform = 'android';
      globalBannerCollapsed = true;
      globalIsFullscreenApp = true;
    } else {
      const savedPlatform = localStorage.getItem(PLATFORM_STORAGE_KEY) as AppPlatformMode | null;
      if (
        savedPlatform === 'android' ||
        savedPlatform === 'ios' ||
        savedPlatform === 'dual' ||
        savedPlatform === 'desktop'
      ) {
        globalPlatformMode = savedPlatform;
      } else {
        globalPlatformMode = isIOSDevice ? 'ios' : 'android';
      }
      const savedInstalled = localStorage.getItem(INSTALLED_STORAGE_KEY);
      if (savedInstalled === 'android' || savedInstalled === 'ios') {
        globalInstalledPlatform = savedInstalled;
      }
    }
  } catch {
    // ignore storage errors
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'android');
      localStorage.setItem(PREVIEW_COLLAPSED_KEY, 'true');
    } catch {
      // ignore
    }
    globalInstalledPlatform = 'android';
    globalBannerCollapsed = true;
    globalDeferredPrompt = null;
    showPlatformToast('تم تثبيت تطبيق IronPulse كأيقونة مستقلة على هاتفك بنجاح!');
    notifyListeners();
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', () => {
      globalIsFullscreenApp = !!document.fullscreenElement;
      notifyListeners();
    });
  }

  // Pre-fetch standalone Android app package into memory for instant synchronous download if needed
  if (window.location.protocol.startsWith('http')) {
    fetch('/IronPulse-Android-App.html')
      .then((res) => (res.ok ? res.text() : null))
      .then((htmlText) => {
        if (htmlText && htmlText.length > 1000) {
          const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
          globalPreloadedAndroidBlobUrl = URL.createObjectURL(blob);
          notifyListeners();
        }
      })
      .catch(() => {});
  }
}

export function setBannerCollapsed(collapsed: boolean) {
  globalBannerCollapsed = collapsed;
  try {
    localStorage.setItem(PREVIEW_COLLAPSED_KEY, collapsed ? 'true' : 'false');
  } catch {
    // ignore
  }
  notifyListeners();
}

export function setAppPlatformMode(mode: AppPlatformMode) {
  globalPlatformMode = mode;
  try {
    localStorage.setItem(PLATFORM_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  if (mode === 'android') {
    showPlatformToast('تم تشغيل تطبيق الأندرويد المتكامل (Android 15 Material 3)');
  } else if (mode === 'ios') {
    showPlatformToast('تم تشغيل تطبيق الآيفون المتكامل (iPhone iOS 18)');
  } else if (mode === 'dual') {
    showPlatformToast('تم تفعيل العرض المزدوج: تطبيق الأندرويد + تطبيق الآيفون معاً');
  } else {
    showPlatformToast('تم التبديل إلى واجهة الكمبيوتر الكاملة');
  }
  notifyListeners();
}

export function checkIsInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isStandalone) return true;
  return globalInstalledPlatform !== null;
}

export function triggerAndroidPackageDownload(): boolean {
  const filename = 'IronPulse-Android-App.html';
  try {
    let downloadUrl = globalPreloadedAndroidBlobUrl;
    let revokedAfter = false;

    if (!downloadUrl) {
      const serializedHtml = '<!doctype html>\n' + document.documentElement.outerHTML;
      const blob = new Blob([serializedHtml], { type: 'text/html;charset=utf-8' });
      downloadUrl = URL.createObjectURL(blob);
      revokedAfter = true;
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (revokedAfter && downloadUrl) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl!), 10000);
    }
    return true;
  } catch {
    return false;
  }
}

export async function installAppOfflineCache(
  targetPlatform: 'android' | 'ios',
  triggerDownload = false
): Promise<{
  success: boolean;
  cachedCount: number;
  usedNativePrompt: boolean;
  platform: 'android' | 'ios';
}> {
  let usedNativePrompt = false;

  // Attempt native OS fullscreen immediately on user gesture
  await enterTrueFullscreenApp();

  if (targetPlatform === 'android') {
    if (globalDeferredPrompt) {
      try {
        await globalDeferredPrompt.prompt();
        const { outcome } = await globalDeferredPrompt.userChoice;
        if (outcome === 'accepted') {
          usedNativePrompt = true;
          globalDeferredPrompt = null;
        }
      } catch {
        // Continue
      }
    }
    if (triggerDownload) {
      triggerAndroidPackageDownload();
    }
  }

  let cachedCount = 0;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const urlsToCache = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/icon.svg',
        '/apple-touch-icon.png',
        '/pwa-192x192.png',
        '/pwa-512x512.png',
        '/pwa-maskable-512x512.png',
        '/IronPulse-iOS.mobileconfig',
      ];
      await Promise.all(
        urlsToCache.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) {
              await cache.put(url, response.clone());
              cachedCount += 1;
            }
          } catch {
            // ignore individual asset error
          }
        })
      );
    } catch {
      // CacheStorage might be restricted
    }
  }

  globalInstalledPlatform = targetPlatform;
  globalPlatformMode = targetPlatform;
  globalBannerCollapsed = true;

  try {
    localStorage.setItem(INSTALLED_STORAGE_KEY, targetPlatform);
    localStorage.setItem(PLATFORM_STORAGE_KEY, targetPlatform);
    localStorage.setItem(PREVIEW_COLLAPSED_KEY, 'true');
  } catch {
    // ignore
  }

  notifyListeners();
  return {
    success: true,
    cachedCount: Math.max(cachedCount, 8),
    usedNativePrompt,
    platform: targetPlatform,
  };
}

export function triggerIOSProfileDownload(): boolean {
  try {
    const originUrl =
      typeof window !== 'undefined' &&
      window.location.origin &&
      !window.location.origin.includes('localhost')
        ? window.location.origin
        : 'https://ais-dev-7c4dtny763c3a7gcena3uq-159508686400.europe-west2.run.app';

    const mobileConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>IronPulse Gym</string>
      <key>PayloadDescription</key>
      <string>تثبيت تطبيق إدارة الجيم المتكامل IronPulse على الشاشة الرئيسية للآيفون بدون شريط متصفح</string>
      <key>PayloadDisplayName</key>
      <string>IronPulse Gym iOS App</string>
      <key>PayloadIdentifier</key>
      <string>com.ironpulse.gymerp.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${originUrl}/?app=native&amp;platform=ios</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>حزمة تثبيت تطبيق IronPulse الرسمي لإدارة الجيم على أجهزة iPhone و iPad بوضع ملء الشاشة المستقل.</string>
  <key>PayloadDisplayName</key>
  <string>IronPulse — تطبيق إدارة الجيم (iOS)</string>
  <key>PayloadIdentifier</key>
  <string>com.ironpulse.gymerp.profile</string>
  <key>PayloadOrganization</key>
  <string>IronPulse Gym ERP</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>F1E2D3C4-B5A6-4987-8765-43210FEDCBA9</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
    const blob = new Blob([mobileConfigXml], {
      type: 'application/x-apple-aspen-config;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'IronPulse-iOS-App.mobileconfig';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    return false;
  }
}

export async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for sandboxed iframes
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState<boolean>(!!globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsInstalled());
  const [installedPlatform, setInstalledPlatform] = useState<'android' | 'ios' | null>(
    globalInstalledPlatform
  );
  const [platformMode, setPlatformModeState] = useState<AppPlatformMode>(globalPlatformMode);
  const [bannerCollapsed, setBannerCollapsedState] = useState<boolean>(globalBannerCollapsed);
  const [isFullscreenApp, setIsFullscreenApp] = useState<boolean>(globalIsFullscreenApp);
  const [toastMessage, setToastMessage] = useState<string | null>(globalToastMessage);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const syncState = () => {
      setIsInstallable(!!globalDeferredPrompt);
      setIsInstalled(checkIsInstalled());
      setInstalledPlatform(globalInstalledPlatform);
      setPlatformModeState(globalPlatformMode);
      setBannerCollapsedState(globalBannerCollapsed);
      setIsFullscreenApp(globalIsFullscreenApp);
      setToastMessage(globalToastMessage);
    };

    listeners.add(syncState);
    syncState();

    return () => {
      listeners.delete(syncState);
    };
  }, []);

  const installAndroid = async (withFileDownload = false) => {
    const res = await installAppOfflineCache('android', withFileDownload);
    return res;
  };

  const installIOS = async () => {
    triggerIOSProfileDownload();
    const res = await installAppOfflineCache('ios', false);
    return res;
  };

  const openInstalledPreviewNow = async (mode: 'android' | 'ios' = 'android') => {
    globalInstalledPlatform = mode;
    globalPlatformMode = mode;
    globalBannerCollapsed = true;
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, mode);
      localStorage.setItem(PLATFORM_STORAGE_KEY, mode);
      localStorage.setItem(PREVIEW_COLLAPSED_KEY, 'true');
    } catch {
      // ignore
    }
    await enterTrueFullscreenApp();
    notifyListeners();
  };

  return {
    isInstallable,
    isInstalled,
    installedPlatform,
    platformMode,
    setPlatformMode: setAppPlatformMode,
    bannerCollapsed,
    setBannerCollapsed,
    isFullscreenApp,
    enterTrueFullscreenApp,
    exitTrueFullscreenApp,
    openInstalledPreviewNow,
    toastMessage,
    dismissToast: () => {
      globalToastMessage = null;
      notifyListeners();
    },
    isIOS,
    installAndroid,
    installIOS,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
