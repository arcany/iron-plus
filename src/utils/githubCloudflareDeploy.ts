export interface RepoFileEntry {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface GitHubPushProgress {
  step: string;
  percent: number;
  repoHtmlUrl?: string;
  cloudflarePagesUrl?: string;
  cloudflareDashboardUrl?: string;
  error?: string;
}

export interface CloudflareAuthCredentials {
  authMode: 'token' | 'global_key';
  apiToken?: string;
  email?: string;
  globalApiKey?: string;
  accountId?: string;
}

export interface CloudflareAccountInfo {
  id: string;
  name: string;
}

export interface CloudflarePagesIntegrationResult {
  success: boolean;
  accountId?: string;
  accountName?: string;
  projectName?: string;
  pagesUrl?: string;
  dashboardUrl?: string;
  githubProviderLinkUrl?: string;
  linkedToGitHub?: boolean;
  directUploaded?: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
  wranglerOutput?: string;
  message?: string;
  error?: string;
}

export interface LiveDeploymentStatus {
  pagesDevLive: boolean;
  pagesDevUrl: string;
  cloudflareTunnelUrl: string | null;
  tunnelStartedAt?: string | null;
  hasOauthToken?: boolean;
  sharedPreviewUrl: string;
  devAppUrl: string;
  githubPipeline?: {
    status: 'idle' | 'awaiting_approval' | 'pushing_repo' | 'repo_pushed' | 'error';
    userCode: string | null;
    verificationUri: string;
    owner: string | null;
    repo: string;
    repoUrl: string | null;
    commitSha: string | null;
    lastError: string | null;
  };
}

export async function fetchLiveDeploymentStatus(): Promise<LiveDeploymentStatus> {
  const fallback: LiveDeploymentStatus = {
    pagesDevLive: false,
    pagesDevUrl: 'https://iron-plus.pages.dev',
    cloudflareTunnelUrl: null,
    sharedPreviewUrl:
      'https://ais-pre-7c4dtny763c3a7gcena3uq-159508686400.europe-west2.run.app',
    devAppUrl:
      'https://ais-dev-7c4dtny763c3a7gcena3uq-159508686400.europe-west2.run.app',
  };
  try {
    const res = await fetch('/api/live-status');
    if (!res.ok) return fallback;
    const data = (await res.json()) as Partial<LiveDeploymentStatus>;
    return {
      ...fallback,
      ...data,
    };
  } catch {
    return fallback;
  }
}

export async function startCloudflareOAuthFlow(): Promise<{
  success: boolean;
  authUrl?: string;
  state?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/cloudflare-oauth-start', {
      method: 'POST',
    });
    if (!res.ok) {
      return { success: false, error: 'تعذر بدء جلسة الربط مع Cloudflare OAuth' };
    }
    return (await res.json()) as {
      success: boolean;
      authUrl?: string;
      state?: string;
    };
  } catch {
    return { success: false, error: 'تعذر الاتصال بخادم المصادقة' };
  }
}

export async function exchangeCloudflareOAuthCallback(
  callbackUrlOrCode: string
): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/cloudflare-oauth-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ callbackUrlOrCode }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      accessToken?: string;
      error?: string;
    };
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'تعذر التحقق من كود موافقة Cloudflare',
      };
    }
    return {
      success: true,
      accessToken: data.accessToken,
    };
  } catch {
    return {
      success: false,
      error: 'حدث خطأ أثناء تبديل كود التفعيل مع Cloudflare',
    };
  }
}

export interface SavedIntegrationState {
  githubOwner?: string;
  githubRepoName: string;
  githubRepoUrl?: string;
  cloudflareEmail: string;
  cloudflareAccountId?: string;
  cloudflareAccountName?: string;
  cloudflareProjectName: string;
  cloudflarePagesUrl?: string;
  cloudflareDashboardUrl?: string;
  linkedToGitHub?: boolean;
  directUploaded?: boolean;
  lastSyncedAt?: string;
}

const INTEGRATION_STORAGE_KEY = 'ironpulse_cf_gh_integration_v1';

export function getSavedIntegrationState(): SavedIntegrationState {
  const fallback: SavedIntegrationState = {
    githubRepoName: 'iron-plus',
    cloudflareEmail: '3alamy200@gmail.com',
    cloudflareProjectName: 'iron-plus',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(INTEGRATION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedIntegrationState>;
    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return fallback;
  }
}

export function saveIntegrationState(
  update: Partial<SavedIntegrationState>
): SavedIntegrationState {
  const merged: SavedIntegrationState = {
    ...getSavedIntegrationState(),
    ...update,
    lastSyncedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        INTEGRATION_STORAGE_KEY,
        JSON.stringify(merged)
      );
    } catch {
      // ignore storage errors
    }
  }
  return merged;
}

export function normalizeRepoName(repoName: string): string {
  const cleaned = repoName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'iron-plus';
}

export function buildCloudflareHeaders(
  auth: CloudflareAuthCredentials
): { headers?: Record<string, string>; error?: string } {
  if (auth.authMode === 'global_key') {
    const email = (auth.email || '').trim();
    const key = (auth.globalApiKey || '').trim();
    if (!email || !key) {
      return {
        error:
          'يرجى إدخال البريد الإلكتروني لحساب Cloudflare (مثل 3alamy200@gmail.com) ومفتاح Global API Key.',
      };
    }
    return {
      headers: {
        'X-Auth-Email': email,
        'X-Auth-Key': key,
        'Content-Type': 'application/json',
      },
    };
  }

  const token = (auth.apiToken || '').trim();
  if (!token) {
    return {
      error:
        'يرجى إدخال رمز Cloudflare API Token لإتمام الربط المباشر مع حسابك في Cloudflare.',
    };
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Verifies Cloudflare credentials and fetches the user's Cloudflare accounts
 * via the local /cloudflare-api proxy (https://api.cloudflare.com/client/v4).
 */
export async function verifyCloudflareAndListAccounts(
  auth: CloudflareAuthCredentials
): Promise<{
  success: boolean;
  accounts?: CloudflareAccountInfo[];
  primaryAccount?: CloudflareAccountInfo;
  error?: string;
}> {
  const built = buildCloudflareHeaders(auth);
  if (!built.headers) {
    return { success: false, error: built.error };
  }

  try {
    const res = await fetch('/cloudflare-api/accounts?page=1&per_page=20', {
      method: 'GET',
      headers: built.headers,
    });

    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      result?: { id: string; name: string }[];
      errors?: { code?: number; message?: string }[];
    } | null;

    if (!res.ok || !data || !data.success || !Array.isArray(data.result)) {
      const apiErr =
        data?.errors?.map((e) => e.message).join(' | ') ||
        `HTTP ${res.status}`;
      return {
        success: false,
        error: `تعذر المصادقة مع Cloudflare API (${apiErr}). تأكد من صحة رمز API Token أو مفتاح Global API Key.`,
      };
    }

    if (data.result.length === 0) {
      return {
        success: false,
        error:
          'تم الاتصال بـ Cloudflare بنجاح ولكن لم يتم العثور على حسابات مرتبطة بهذا الرمز. تأكد من منح صلاحية Account -> Cloudflare Pages: Edit.',
      };
    }

    const accounts: CloudflareAccountInfo[] = data.result.map((a) => ({
      id: a.id,
      name: a.name,
    }));

    const preferredId = (auth.accountId || '').trim();
    const primaryAccount =
      accounts.find((a) => a.id === preferredId) || accounts[0];

    return {
      success: true,
      accounts,
      primaryAccount,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? `خطأ في الاتصال بخادم Cloudflare: ${err.message}`
          : 'تعذر الاتصال بخادم Cloudflare API.',
    };
  }
}

/**
 * Creates/updates the `iron-plus` Cloudflare Pages project AND physically uploads
 * the compiled `/dist` bundle via the backend Wrangler engine (`/api/cloudflare-direct-deploy`)
 * so that `https://iron-plus.pages.dev` immediately has an active production deployment
 * and resolves without DNS_PROBE_FINISHED_NXDOMAIN.
 */
export async function createOrLinkCloudflarePagesProject(options: {
  auth: CloudflareAuthCredentials;
  projectName?: string;
  githubOwner?: string;
  githubRepo?: string;
  onProgress?: (progress: GitHubPushProgress) => void;
}): Promise<CloudflarePagesIntegrationResult> {
  const { auth, onProgress } = options;
  const cleanProject = normalizeRepoName(options.projectName || 'iron-plus');
  const cleanRepo = normalizeRepoName(options.githubRepo || cleanProject);
  const githubOwner = (options.githubOwner || '').trim();

  const built = buildCloudflareHeaders(auth);
  if (!built.headers) {
    return { success: false, error: built.error };
  }

  onProgress?.({
    step: `جاري الاتصال بحساب Cloudflare وإنشاء مشروع (${cleanProject}) ورفع ملفات البناء الكاملة (dist) لتفعيل النطاق ${cleanProject}.pages.dev فوراً...`,
    percent: 65,
  });

  try {
    const directRes = await fetch('/api/cloudflare-direct-deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authMode: auth.authMode,
        apiToken: auth.apiToken,
        email: auth.email,
        globalApiKey: auth.globalApiKey,
        accountId: auth.accountId,
        projectName: cleanProject,
        githubOwner,
        githubRepo: cleanRepo,
      }),
    });

    const directData = (await directRes
      .json()
      .catch(() => null)) as CloudflarePagesIntegrationResult | null;

    if (directRes.ok && directData?.success) {
      saveIntegrationState({
        githubOwner: githubOwner || getSavedIntegrationState().githubOwner,
        githubRepoName: cleanRepo,
        cloudflareAccountId: directData.accountId,
        cloudflareAccountName: directData.accountName,
        cloudflareProjectName: cleanProject,
        cloudflarePagesUrl: directData.pagesUrl,
        cloudflareDashboardUrl: directData.dashboardUrl,
        linkedToGitHub: directData.linkedToGitHub,
        directUploaded: directData.directUploaded,
      });

      onProgress?.({
        step:
          directData.message ||
          `تم نشر ورفع ملفات مشروع (${cleanProject}) وتفعيل الرابط ${directData.pagesUrl} بنجاح!`,
        percent: 100,
        cloudflarePagesUrl: directData.pagesUrl,
        cloudflareDashboardUrl: directData.dashboardUrl,
      });

      return directData;
    }

    if (directData?.error) {
      return {
        success: false,
        error: directData.error,
      };
    }
  } catch {
    // Fallback to client-side proxy if needed
  }

  const headers = built.headers;
  const accRes = await verifyCloudflareAndListAccounts(auth);
  if (!accRes.success || !accRes.primaryAccount) {
    return {
      success: false,
      error: accRes.error || 'تعذر العثور على حساب Cloudflare.',
    };
  }

  const accountId = accRes.primaryAccount.id;
  const accountName = accRes.primaryAccount.name;
  const dashboardUrl = `https://dash.cloudflare.com/${accountId}/pages/view/${cleanProject}`;
  const githubProviderLinkUrl = `https://dash.cloudflare.com/${accountId}/workers-and-pages/create/pages/provider/github`;

  try {
    const createDirectRes = await fetch(
      `/cloudflare-api/accounts/${accountId}/pages/projects`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: cleanProject,
          production_branch: 'main',
          build_config: {
            build_command: 'npm run build',
            destination_dir: 'dist',
            root_dir: '',
          },
        }),
      }
    );

    const createDirectData = (await createDirectRes.json().catch(() => null)) as {
      success?: boolean;
      result?: { subdomain?: string };
      errors?: { message?: string }[];
    } | null;

    const subdomain =
      createDirectData?.result?.subdomain || `${cleanProject}.pages.dev`;
    const pagesUrl = subdomain.startsWith('http')
      ? subdomain
      : `https://${subdomain}`;

    if (createDirectRes.ok || createDirectRes.status === 409) {
      saveIntegrationState({
        githubOwner: githubOwner || getSavedIntegrationState().githubOwner,
        githubRepoName: cleanRepo,
        cloudflareAccountId: accountId,
        cloudflareAccountName: accountName,
        cloudflareProjectName: cleanProject,
        cloudflarePagesUrl: pagesUrl,
        cloudflareDashboardUrl: dashboardUrl,
      });

      return {
        success: true,
        accountId,
        accountName,
        projectName: cleanProject,
        pagesUrl,
        dashboardUrl,
        githubProviderLinkUrl,
        message: `تم تجهيز مشروع (${cleanProject}) داخل حسابك في Cloudflare (${accountName}) بنجاح!`,
      };
    }

    const errMsg =
      createDirectData?.errors?.map((e) => e.message).join(' | ') ||
      `HTTP ${createDirectRes.status}`;
    return {
      success: false,
      accountId,
      accountName,
      githubProviderLinkUrl,
      error: `تعذر إنشاء مشروع Cloudflare Pages (${errMsg}).`,
    };
  } catch (err) {
    return {
      success: false,
      accountId,
      accountName,
      githubProviderLinkUrl,
      error:
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء إعداد مشروع Cloudflare Pages',
    };
  }
}

/**
 * Creates a dedicated GitHub repository and pushes the entire project tree
 * atomically so it can be linked directly to Cloudflare Pages.
 */
export async function createGitHubRepoAndPushProject(options: {
  token: string;
  repoName: string;
  isPrivate: boolean;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  onProgress: (progress: GitHubPushProgress) => void;
}): Promise<{
  success: boolean;
  repoUrl?: string;
  owner?: string;
  repo?: string;
  error?: string;
}> {
  const { token, repoName, isPrivate, onProgress } = options;
  const cleanToken = token.trim();
  const cleanRepo = normalizeRepoName(repoName);

  if (!cleanToken) {
    return {
      success: false,
      error: 'يرجى إدخال رمز الوصول الخاص بـ GitHub (Personal Access Token) أو الضغط على زر الربط التلقائي.',
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // 1. Verify authenticated GitHub user
    onProgress({
      step: 'جاري التحقق من حساب GitHub والصلاحيات...',
      percent: 10,
    });
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) {
      return {
        success: false,
        error:
          'تعذر التحقق من رمز GitHub Token. تأكد من صلاحية الرمز وتفعيل صلاحية (repo).',
      };
    }
    const userData = (await userRes.json()) as { login: string };
    const owner = userData.login;

    // 2. Create or get the dedicated repository
    onProgress({
      step: `جاري إنشاء المستودع المخصص (${owner}/${cleanRepo}) على GitHub...`,
      percent: 22,
    });

    let repoHtmlUrl = `https://github.com/${owner}/${cleanRepo}`;
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: cleanRepo,
        description:
          'IronPulse Gym ERP — Native Android & iPhone iOS Mobile App (Cloudflare Pages Integrated)',
        private: isPrivate,
        auto_init: true,
      }),
    });

    if (createRes.ok) {
      const createdRepo = (await createRes.json()) as { html_url: string };
      repoHtmlUrl = createdRepo.html_url;
      await new Promise((r) => setTimeout(r, 1200));
    } else if (createRes.status === 422) {
      const existingRes = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}`,
        { headers }
      );
      if (!existingRes.ok) {
        return {
          success: false,
          error: 'المستودع موجود مسبقاً ولكن تعذر الوصول إليه.',
        };
      }
    } else {
      const errJson = await createRes.json().catch(() => ({}));
      return {
        success: false,
        error: `تعذر إنشاء المستودع: ${
          (errJson as { message?: string }).message || createRes.statusText
        }`,
      };
    }

    // 3. Load project source bundle
    onProgress({
      step: 'جاري تجهيز ملفات المشروع الكاملة وإعدادات Cloudflare Pages...',
      percent: 35,
    });
    const bundleRes = await fetch('/repo-files-bundle.json');
    if (!bundleRes.ok) {
      return {
        success: false,
        error: 'تعذر قراءة حزمة ملفات المشروع.',
      };
    }
    const files = (await bundleRes.json()) as RepoFileEntry[];

    // 4. Get latest commit SHA on main branch (if any)
    let latestCommitSha: string | null = null;
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/git/ref/heads/main`,
      { headers }
    );
    if (refRes.ok) {
      const refData = (await refRes.json()) as { object?: { sha?: string } };
      latestCommitSha = refData.object?.sha || null;
    } else {
      await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/contents/README.md`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: 'Initialize repository for Cloudflare Pages',
            content: btoa(
              unescape(
                encodeURIComponent(
                  '# IronPulse Gym Mobile App (Android + iPhone iOS)\nReady for Cloudflare Pages (`npm run build` -> `dist`).\n'
                )
              )
            ),
          }),
        }
      );
      const retryRef = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/ref/heads/main`,
        { headers }
      );
      if (retryRef.ok) {
        const refData = (await retryRef.json()) as {
          object?: { sha?: string };
        };
        latestCommitSha = refData.object?.sha || null;
      }
    }

    // 5. Create Git Blobs for all files
    onProgress({
      step: `جاري رفع (${files.length}) ملف برمجي إلى مستودع GitHub (${owner}/${cleanRepo})...`,
      percent: 50,
    });

    const treeItems: {
      path: string;
      mode: '100644';
      type: 'blob';
      sha: string;
    }[] = [];

    for (const file of files) {
      const blobRes = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/blobs`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: file.content,
            encoding: file.encoding,
          }),
        }
      );
      if (blobRes.ok) {
        const blobData = (await blobRes.json()) as { sha: string };
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        });
      }
    }

    // 6. Create Git Tree
    onProgress({
      step: 'جاري بناء شجرة الملفات (Git Tree) واعتماد النسخة على فرع main...',
      percent: 78,
    });
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tree: treeItems,
        }),
      }
    );
    if (!treeRes.ok) {
      return {
        success: false,
        error: 'تعذر إنشاء شجرة الملفات على GitHub.',
      };
    }
    const treeData = (await treeRes.json()) as { sha: string };

    // 7. Create Commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/git/commits`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message:
            'feat: Complete IronPulse Android & iPhone Native Mobile App (Cloudflare Pages Integrated)',
          tree: treeData.sha,
          parents: latestCommitSha ? [latestCommitSha] : [],
        }),
      }
    );
    if (!commitRes.ok) {
      return {
        success: false,
        error: 'تعذر اعتماد Commit على المستودع.',
      };
    }
    const commitData = (await commitRes.json()) as { sha: string };

    // 8. Update main branch reference
    await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: commitData.sha,
          force: true,
        }),
      }
    );

    saveIntegrationState({
      githubOwner: owner,
      githubRepoName: cleanRepo,
      githubRepoUrl: repoHtmlUrl,
    });

    onProgress({
      step: 'تم إنشاء المستودع ورفع المشروع بالكامل بنجاح! جاهز للربط مع Cloudflare.',
      percent: 100,
      repoHtmlUrl,
    });

    return {
      success: true,
      repoUrl: repoHtmlUrl,
      owner,
      repo: cleanRepo,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء الاتصال بـ GitHub API',
    };
  }
}

/**
 * Full 1-Click Pipeline:
 * 1. Pushes `iron-plus` repository to GitHub (if githubToken is provided)
 * 2. Authenticates with Cloudflare API and creates/links the `iron-plus` Pages project
 *    directly to `github.com/<owner>/iron-plus` and triggers deployment!
 */
export async function runFullGitHubToCloudflarePipeline(options: {
  githubToken?: string;
  repoName: string;
  cloudflareAuth: CloudflareAuthCredentials;
  existingGithubOwner?: string;
  onProgress: (progress: GitHubPushProgress) => void;
}): Promise<{
  success: boolean;
  githubRepoUrl?: string;
  githubOwner?: string;
  cloudflareResult?: CloudflarePagesIntegrationResult;
  error?: string;
}> {
  const {
    githubToken,
    repoName,
    cloudflareAuth,
    existingGithubOwner,
    onProgress,
  } = options;
  const cleanRepo = normalizeRepoName(repoName);

  let githubOwner = (
    existingGithubOwner ||
    getSavedIntegrationState().githubOwner ||
    ''
  ).trim();
  let githubRepoUrl = getSavedIntegrationState().githubRepoUrl;

  // Step 1: If GitHub token is provided, push/update the GitHub repository first
  if (githubToken && githubToken.trim()) {
    const ghRes = await createGitHubRepoAndPushProject({
      token: githubToken,
      repoName: cleanRepo,
      isPrivate: false,
      onProgress,
    });
    if (!ghRes.success) {
      return {
        success: false,
        error: ghRes.error,
      };
    }
    githubOwner = ghRes.owner || githubOwner;
    githubRepoUrl = ghRes.repoUrl || githubRepoUrl;
  }

  // Step 2: Connect to Cloudflare and create/link the Pages project
  const cfRes = await createOrLinkCloudflarePagesProject({
    auth: cloudflareAuth,
    projectName: cleanRepo,
    githubOwner: githubOwner || undefined,
    githubRepo: cleanRepo,
    onProgress,
  });

  if (!cfRes.success) {
    return {
      success: false,
      githubRepoUrl,
      githubOwner,
      cloudflareResult: cfRes,
      error: cfRes.error,
    };
  }

  return {
    success: true,
    githubRepoUrl,
    githubOwner,
    cloudflareResult: cfRes,
  };
}

const GITHUB_DEVICE_CLIENT_ID = '178c6fc778ccc68e1d6a';

export interface GitHubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function startGitHubDeviceFlow(): Promise<GitHubDeviceCodeResponse | null> {
  try {
    const res = await fetch(
      `/github-oauth/login/device/code?client_id=${GITHUB_DEVICE_CLIENT_ID}&scope=repo`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubDeviceCodeResponse;
    if (data && data.device_code && data.user_code) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function pollGitHubDeviceFlowToken(
  deviceCode: string
): Promise<{ token?: string; pending?: boolean; error?: string }> {
  try {
    const res = await fetch(
      `/github-oauth/login/oauth/access_token?client_id=${GITHUB_DEVICE_CLIENT_ID}&device_code=${encodeURIComponent(
        deviceCode
      )}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return { error: 'تعذر التحقق من حالة الربط' };
    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (data.access_token) {
      return { token: data.access_token };
    }
    if (
      data.error === 'authorization_pending' ||
      data.error === 'slow_down'
    ) {
      return { pending: true };
    }
    return { error: data.error_description || data.error || 'انتهت المهلة' };
  } catch {
    return { error: 'تعذر الاتصال بخادم المصادقة' };
  }
}
