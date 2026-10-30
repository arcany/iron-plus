import { spawn, execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

interface LiveTunnelState {
  tunnelUrl: string | null;
  startedAt: string | null;
  pagesDevLive: boolean;
  pagesDevUrl: string;
  lastDirectDeployUrl: string | null;
}

const tunnelState: LiveTunnelState = {
  tunnelUrl: null,
  startedAt: null,
  pagesDevLive: false,
  pagesDevUrl: 'https://iron-plus.pages.dev',
  lastDirectDeployUrl: null,
};

let tunnelProcessStarted = false;

// PKCE state for 1-Click Cloudflare OAuth
const WRANGLER_OAUTH_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7';
const WRANGLER_OAUTH_REDIRECT_URI = 'http://localhost:8976/oauth/callback';

let latestPkceVerifier: string | null = null;
let latestOauthState: string | null = null;
let latestOauthAccessToken: string | null = null;

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function startCloudflareQuickTunnel() {
  if (tunnelProcessStarted) return;
  tunnelProcessStarted = true;

  const cloudflaredPath = '/tmp/cloudflared';
  const launchTunnel = () => {
    try {
      const child = spawn(
        cloudflaredPath,
        [
          'tunnel',
          '--url',
          'http://127.0.0.1:3000',
          '--no-autoupdate',
          '--protocol',
          'http2',
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      const handleOutput = (chunk: Buffer) => {
        const text = chunk.toString('utf-8');
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && match[0]) {
          tunnelState.tunnelUrl = match[0];
          tunnelState.startedAt = new Date().toISOString();
          try {
            fs.writeFileSync(
              path.resolve(process.cwd(), 'public/cloudflare-live-edge.json'),
              JSON.stringify(
                {
                  cloudflareEdgeUrl: tunnelState.tunnelUrl,
                  updatedAt: tunnelState.startedAt,
                },
                null,
                2
              )
            );
          } catch {
            // ignore write error
          }
        }
      };

      child.stdout.on('data', handleOutput);
      child.stderr.on('data', handleOutput);
      child.on('exit', () => {
        tunnelProcessStarted = false;
      });
    } catch {
      tunnelProcessStarted = false;
    }
  };

  if (fs.existsSync(cloudflaredPath)) {
    launchTunnel();
  } else {
    execFile(
      'bash',
      [
        '-c',
        'curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared && chmod +x /tmp/cloudflared',
      ],
      (err) => {
        if (!err && fs.existsSync(cloudflaredPath)) {
          launchTunnel();
        } else {
          tunnelProcessStarted = false;
        }
      }
    );
  }
}

async function checkUrlResolvesHttp200(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'IronPlus-HealthCheck/1.0',
      },
    });
    clearTimeout(timer);
    return res.ok || res.status === 200 || res.status === 304;
  } catch {
    return false;
  }
}

function readJsonBody(req: import('http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function prepareCleanPagesDist(): string {
  const srcDist = path.resolve(process.cwd(), 'dist');
  const cleanDist = '/tmp/iron-plus-pages-dist';
  try {
    fs.rmSync(cleanDist, { recursive: true, force: true });
    fs.mkdirSync(cleanDist, { recursive: true });

    const copyFiltered = (srcDir: string, destDir: string) => {
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.name === 'iron-plus.git' ||
          entry.name === 'aistudio' ||
          entry.name.endsWith('.tar.gz') ||
          entry.name.endsWith('.zip') ||
          entry.name === 'repo-files-bundle.json'
        ) {
          continue;
        }
        const sPath = path.join(srcDir, entry.name);
        const dPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
          fs.mkdirSync(dPath, { recursive: true });
          copyFiltered(sPath, dPath);
        } else if (entry.isFile()) {
          fs.copyFileSync(sPath, dPath);
        }
      }
    };

    if (fs.existsSync(srcDist)) {
      copyFiltered(srcDist, cleanDist);
      return cleanDist;
    }
  } catch {
    // fallback to dist
  }
  return srcDist;
}

function runWranglerPagesDeploy(options: {
  projectName: string;
  accountId: string;
  authMode: 'token' | 'global_key';
  apiToken?: string;
  email?: string;
  globalApiKey?: string;
}): Promise<{
  success: boolean;
  deploymentUrl?: string;
  output: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: options.accountId,
      CI: 'true',
    };

    if (options.authMode === 'global_key') {
      env.CLOUDFLARE_EMAIL = options.email || '';
      env.CLOUDFLARE_API_KEY = options.globalApiKey || '';
      delete env.CLOUDFLARE_API_TOKEN;
    } else {
      env.CLOUDFLARE_API_TOKEN = options.apiToken || '';
      delete env.CLOUDFLARE_API_KEY;
      delete env.CLOUDFLARE_EMAIL;
    }

    const distPath = prepareCleanPagesDist();

    execFile(
      'npx',
      [
        'wrangler',
        'pages',
        'deploy',
        distPath,
        `--project-name=${options.projectName}`,
        '--branch=main',
        '--commit-dirty=true',
      ],
      {
        cwd: process.cwd(),
        env,
        timeout: 90000,
      },
      (err, stdout, stderr) => {
        const combined = `${stdout || ''}\n${stderr || ''}`.trim();
        const urlMatch = combined.match(
          /https:\/\/[a-z0-9.-]+\.pages\.dev/gi
        );
        const deploymentUrl =
          urlMatch && urlMatch.length > 0
            ? urlMatch[urlMatch.length - 1]
            : undefined;

        if (err) {
          resolve({
            success: false,
            output: combined,
            error: combined || err.message,
          });
          return;
        }

        resolve({
          success: true,
          deploymentUrl:
            deploymentUrl || `https://${options.projectName}.pages.dev`,
          output: combined,
        });
      }
    );
  });
}

interface ServerGitHubPipelineState {
  status: 'idle' | 'awaiting_approval' | 'pushing_repo' | 'repo_pushed' | 'error';
  userCode: string | null;
  verificationUri: string;
  deviceCode: string | null;
  candidateDeviceCodes?: string[];
  expiresAt: number;
  intervalSec: number;
  lastPollAtMs?: number;
  owner: string | null;
  repo: string;
  repoUrl: string | null;
  commitSha: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

const GITHUB_CLIENT_ID = '178c6fc778ccc68e1d6a';
const GH_STATE_FILE = path.resolve(process.cwd(), '.iron-plus-github-state.json');

const ghPipeline: ServerGitHubPipelineState = (() => {
  for (const candidateFile of [GH_STATE_FILE, '/tmp/iron-plus-github-state.json']) {
    try {
      if (fs.existsSync(candidateFile)) {
        const saved = JSON.parse(fs.readFileSync(candidateFile, 'utf-8'));
        if (saved && saved.status === 'repo_pushed' && saved.repoUrl) {
          return saved;
        }
        if (
          saved &&
          saved.status === 'awaiting_approval' &&
          saved.deviceCode &&
          saved.userCode &&
          typeof saved.expiresAt === 'number' &&
          Date.now() < saved.expiresAt
        ) {
          return {
            ...saved,
            candidateDeviceCodes: Array.isArray(saved.candidateDeviceCodes)
              ? saved.candidateDeviceCodes
              : [saved.deviceCode],
          };
        }
      }
    } catch {
      // ignore
    }
  }
  return {
    status: 'idle',
    userCode: null,
    verificationUri: 'https://github.com/login/device',
    deviceCode: null,
    candidateDeviceCodes: [],
    expiresAt: 0,
    intervalSec: 5,
    lastPollAtMs: 0,
    owner: null,
    repo: 'iron-plus',
    repoUrl: null,
    commitSha: null,
    lastError: null,
    updatedAt: null,
  };
})();

let ghAccessTokenMem: string | null = null;
let ghPollerTimer: ReturnType<typeof setTimeout> | null = null;
let ghStartingCode = false;
let ghCheckingToken = false;

function saveGhState() {
  try {
    fs.writeFileSync(GH_STATE_FILE, JSON.stringify(ghPipeline, null, 2));
  } catch {
    // ignore
  }
}

async function pushRepoToGitHubOnServer(token: string, repoName = 'iron-plus'): Promise<void> {
  ghPipeline.status = 'pushing_repo';
  ghPipeline.lastError = null;
  saveGhState();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'IronPlus-AutoDeploy-Engine/1.0',
  };

  try {
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) {
      throw new Error(`فشل التحقق من حساب GitHub (HTTP ${userRes.status})`);
    }
    const userData = (await userRes.json()) as { login: string };
    const owner = userData.login;
    ghPipeline.owner = owner;

    // Check or create repo `iron-plus`
    const checkRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}`,
      { headers }
    );
    let defaultBranch = 'main';
    let repoExists = checkRes.ok;

    if (!repoExists) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description:
            'IronPulse (iron-plus) — Integrated Android & iOS Gym Management System (Cloudflare Pages Ready)',
          private: false,
          auto_init: true,
        }),
      });
      if (!createRes.ok && createRes.status !== 422) {
        const errBody = await createRes.text();
        throw new Error(`تعذر إنشاء المستودع: ${errBody}`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      const repoJson = (await checkRes.json()) as { default_branch?: string };
      if (repoJson.default_branch) defaultBranch = repoJson.default_branch;
    }

    // Load 34 files from public/repo-files-bundle.json
    const bundlePath = path.resolve(process.cwd(), 'public/repo-files-bundle.json');
    const bundleRaw = fs.readFileSync(bundlePath, 'utf-8');
    const parsedJson = JSON.parse(bundleRaw);
    const bundle: { files: { path: string; content: string }[] } = {
      files: Array.isArray(parsedJson)
        ? parsedJson
        : Array.isArray(parsedJson?.files)
        ? parsedJson.files
        : [],
    };

    // Ensure repo has at least one commit so Git Data API works
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`,
      { headers }
    );
    let baseCommitSha: string | null = null;
    let baseTreeSha: string | null = null;

    if (refRes.ok) {
      const refData = (await refRes.json()) as { object?: { sha?: string } };
      baseCommitSha = refData.object?.sha || null;
      if (baseCommitSha) {
        const commitRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseCommitSha}`,
          { headers }
        );
        if (commitRes.ok) {
          const commitData = (await commitRes.json()) as {
            tree?: { sha?: string };
          };
          baseTreeSha = commitData.tree?.sha || null;
        }
      }
    } else {
      // Seed initial README via Contents API if repo was completely empty
      const readmeFile = bundle.files.find((f) => f.path === 'README.md') || bundle.files[0];
      await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: 'Initial commit: Initialize iron-plus repository',
            content: Buffer.from(readmeFile.content, 'utf-8').toString('base64'),
            branch: defaultBranch,
          }),
        }
      );
      await new Promise((r) => setTimeout(r, 1000));
      const refRetry = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`,
        { headers }
      );
      if (refRetry.ok) {
        const refData = (await refRetry.json()) as { object?: { sha?: string } };
        baseCommitSha = refData.object?.sha || null;
      }
    }

    const treeItems = bundle.files.map((f) => ({
      path: f.path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: f.content,
    }));

    const createTreeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(
          baseTreeSha
            ? { base_tree: baseTreeSha, tree: treeItems }
            : { tree: treeItems }
        ),
      }
    );

    if (!createTreeRes.ok) {
      throw new Error(`فشل إنشاء شجرة الملفات على GitHub (${createTreeRes.status})`);
    }
    const treeData = (await createTreeRes.json()) as { sha: string };

    const createCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message:
            'Deploy complete IronPulse (iron-plus) Android + iOS app & Cloudflare Pages configuration',
          tree: treeData.sha,
          parents: baseCommitSha ? [baseCommitSha] : [],
        }),
      }
    );

    if (!createCommitRes.ok) {
      throw new Error(`فشل إنشاء Commit على GitHub (${createCommitRes.status})`);
    }
    const newCommit = (await createCommitRes.json()) as { sha: string };

    await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: newCommit.sha,
          force: true,
        }),
      }
    );

    ghPipeline.status = 'repo_pushed';
    ghPipeline.repo = repoName;
    ghPipeline.repoUrl = `https://github.com/${owner}/${repoName}`;
    ghPipeline.commitSha = newCommit.sha;
    ghPipeline.updatedAt = new Date().toISOString();
    saveGhState();
  } catch (err) {
    ghPipeline.status = 'error';
    ghPipeline.lastError =
      err instanceof Error ? err.message : 'حدث خطأ أثناء رفع المستودع إلى GitHub';
    saveGhState();
  }
}

async function checkPendingGitHubDeviceTokensNow(): Promise<boolean> {
  if (
    ghCheckingToken ||
    ghPipeline.status !== 'awaiting_approval' ||
    !ghPipeline.deviceCode
  ) {
    return false;
  }
  const now = Date.now();
  const minWaitMs = Math.max(5, ghPipeline.intervalSec || 5) * 1000 + 200;
  if (ghPipeline.lastPollAtMs && now - ghPipeline.lastPollAtMs < minWaitMs) {
    return false;
  }
  ghCheckingToken = true;
  ghPipeline.lastPollAtMs = now;
  saveGhState();

  const codesToCheck = Array.from(
    new Set([
      ghPipeline.deviceCode,
      ...(ghPipeline.candidateDeviceCodes || []),
    ].filter(Boolean))
  );

  try {
    for (const dCode of codesToCheck) {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: dCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        access_token?: string;
        error?: string;
        interval?: number;
      } | null;

      if (data?.access_token) {
        ghAccessTokenMem = data.access_token;
        await pushRepoToGitHubOnServer(data.access_token, 'iron-plus');
        return true;
      }

      if (dCode === ghPipeline.deviceCode) {
        if (data?.error === 'slow_down' && data.interval) {
          ghPipeline.intervalSec = data.interval;
          saveGhState();
        } else if (
          data?.error &&
          data.error !== 'authorization_pending' &&
          data.error !== 'slow_down'
        ) {
          ghPipeline.deviceCode = null;
          ghPipeline.userCode = null;
          saveGhState();
        }
      }
    }
  } catch {
    // ignore transient network error
  } finally {
    ghCheckingToken = false;
  }
  return false;
}

function scheduleServerGitHubDevicePoll() {
  if (ghPollerTimer) clearTimeout(ghPollerTimer);
  if (
    ghPipeline.status !== 'awaiting_approval' ||
    !ghPipeline.deviceCode ||
    Date.now() > ghPipeline.expiresAt
  ) {
    return;
  }

  const waitMs = Math.max(5, ghPipeline.intervalSec || 5) * 1000 + 500;
  ghPollerTimer = setTimeout(async () => {
    const pushed = await checkPendingGitHubDeviceTokensNow();
    if (!pushed) {
      if (!ghPipeline.deviceCode || Date.now() > ghPipeline.expiresAt) {
        await ensureServerGitHubDeviceCode(true);
      } else {
        scheduleServerGitHubDevicePoll();
      }
    }
  }, waitMs);
}

async function ensureServerGitHubDeviceCode(forceNew = false): Promise<void> {
  if (ghPipeline.status === 'repo_pushed' && !forceNew) return;
  if (ghPipeline.status === 'pushing_repo') return;

  // First check if an existing pending device code was just approved while container was asleep!
  if (
    !forceNew &&
    ghPipeline.deviceCode &&
    ghPipeline.userCode &&
    Date.now() < ghPipeline.expiresAt - 30000
  ) {
    await checkPendingGitHubDeviceTokensNow();
    if (ghPipeline.status === 'repo_pushed' || ghPipeline.status === 'pushing_repo') {
      return;
    }
    if (ghPipeline.deviceCode && ghPipeline.userCode) {
      scheduleServerGitHubDevicePoll();
      return;
    }
  }

  if (ghStartingCode) return;
  ghStartingCode = true;

  try {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: 'repo workflow',
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
      };
      const prevCandidates = Array.isArray(ghPipeline.candidateDeviceCodes)
        ? ghPipeline.candidateDeviceCodes.slice(-4)
        : [];
      ghPipeline.status = 'awaiting_approval';
      ghPipeline.deviceCode = data.device_code;
      ghPipeline.candidateDeviceCodes = Array.from(
        new Set([...prevCandidates, data.device_code])
      );
      ghPipeline.userCode = data.user_code;
      ghPipeline.verificationUri =
        data.verification_uri || 'https://github.com/login/device';
      ghPipeline.expiresAt = Date.now() + (data.expires_in || 899) * 1000;
      ghPipeline.intervalSec = data.interval || 5;
      ghPipeline.updatedAt = new Date().toISOString();
      saveGhState();
      scheduleServerGitHubDevicePoll();
    }
  } catch {
    // ignore
  } finally {
    ghStartingCode = false;
  }
}

export function ironPlusCloudflareBackendPlugin(): Plugin {
  return {
    name: 'iron-plus-cloudflare-backend',
    configureServer(server) {
      startCloudflareQuickTunnel();
      ensureServerGitHubDeviceCode();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // 1. Live Status Endpoint (includes live Cloudflare Edge URL + server-side GitHub Device Code & Repo state)
        if (url.startsWith('/api/live-status') && req.method === 'GET') {
          await ensureServerGitHubDeviceCode();
          const targetProjectUrl =
            tunnelState.lastDirectDeployUrl || 'https://iron-plus.pages.dev';
          const isPagesLive = await checkUrlResolvesHttp200(targetProjectUrl);
          tunnelState.pagesDevLive = isPagesLive;

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              pagesDevLive: isPagesLive,
              pagesDevUrl: targetProjectUrl,
              cloudflareTunnelUrl: tunnelState.tunnelUrl,
              tunnelStartedAt: tunnelState.startedAt,
              hasOauthToken: Boolean(latestOauthAccessToken),
              sharedPreviewUrl:
                'https://ais-pre-7c4dtny763c3a7gcena3uq-159508686400.europe-west2.run.app',
              devAppUrl:
                'https://ais-dev-7c4dtny763c3a7gcena3uq-159508686400.europe-west2.run.app',
              githubPipeline: {
                status: ghPipeline.status,
                userCode: ghPipeline.userCode,
                verificationUri: ghPipeline.verificationUri,
                owner: ghPipeline.owner,
                repo: ghPipeline.repo,
                repoUrl: ghPipeline.repoUrl,
                commitSha: ghPipeline.commitSha,
                lastError: ghPipeline.lastError,
              },
            })
          );
          return;
        }

        // 1b. Refresh or Trigger Server-Side GitHub Device Flow
        if (
          url.startsWith('/api/github-server-device-start') &&
          req.method === 'POST'
        ) {
          await ensureServerGitHubDeviceCode(true);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              success: true,
              githubPipeline: {
                status: ghPipeline.status,
                userCode: ghPipeline.userCode,
                verificationUri: ghPipeline.verificationUri,
                owner: ghPipeline.owner,
                repo: ghPipeline.repo,
                repoUrl: ghPipeline.repoUrl,
                commitSha: ghPipeline.commitSha,
              },
            })
          );
          return;
        }

        // 2. Start 1-Click Cloudflare OAuth PKCE Flow
        if (
          url.startsWith('/api/cloudflare-oauth-start') &&
          req.method === 'POST'
        ) {
          const verifier = base64UrlEncode(crypto.randomBytes(32));
          const challenge = base64UrlEncode(
            crypto.createHash('sha256').update(verifier).digest()
          );
          const state = base64UrlEncode(crypto.randomBytes(16));

          latestPkceVerifier = verifier;
          latestOauthState = state;

          const scopes = [
            'account:read',
            'user:read',
            'pages:write',
            'workers:write',
            'offline_access',
          ].join(' ');

          const authUrl =
            `https://dash.cloudflare.com/oauth2/auth` +
            `?response_type=code` +
            `&client_id=${encodeURIComponent(WRANGLER_OAUTH_CLIENT_ID)}` +
            `&redirect_uri=${encodeURIComponent(WRANGLER_OAUTH_REDIRECT_URI)}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&state=${encodeURIComponent(state)}` +
            `&code_challenge=${encodeURIComponent(challenge)}` +
            `&code_challenge_method=S256`;

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              success: true,
              authUrl,
              state,
            })
          );
          return;
        }

        // 3. Exchange Cloudflare OAuth Callback URL or Code -> Access Token
        if (
          url.startsWith('/api/cloudflare-oauth-exchange') &&
          req.method === 'POST'
        ) {
          const body = await readJsonBody(req);
          const rawInput = String(body.callbackUrlOrCode || '').trim();

          if (!rawInput) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: false,
                error:
                  'يرجى لصق رابط الموافقة أو الكود الناتج بعد الضغط على Allow في Cloudflare.',
              })
            );
            return;
          }

          let code = rawInput;
          if (rawInput.includes('code=')) {
            try {
              const parsed = new URL(
                rawInput.startsWith('http')
                  ? rawInput
                  : `http://localhost/?${rawInput}`
              );
              code = parsed.searchParams.get('code') || rawInput;
            } catch {
              const m = rawInput.match(/[?&]code=([^&]+)/);
              if (m && m[1]) code = decodeURIComponent(m[1]);
            }
          }

          if (!latestPkceVerifier) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: false,
                error:
                  'انتهت صلاحية جلسة الربط، يرجى الضغط على زر بدء الربط مع Cloudflare مرة أخرى.',
              })
            );
            return;
          }

          try {
            const tokenRes = await fetch(
              'https://dash.cloudflare.com/oauth2/token',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  client_id: WRANGLER_OAUTH_CLIENT_ID,
                  code,
                  redirect_uri: WRANGLER_OAUTH_REDIRECT_URI,
                  code_verifier: latestPkceVerifier,
                }).toString(),
              }
            );

            const tokenData = (await tokenRes.json().catch(() => null)) as {
              access_token?: string;
              error?: string;
              error_description?: string;
            } | null;

            if (!tokenRes.ok || !tokenData?.access_token) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    tokenData?.error_description ||
                    tokenData?.error ||
                    'تعذر تبديل كود التفعيل مع Cloudflare OAuth.',
                })
              );
              return;
            }

            latestOauthAccessToken = tokenData.access_token;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: true,
                accessToken: tokenData.access_token,
              })
            );
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: false,
                error:
                  err instanceof Error
                    ? err.message
                    : 'خطأ في الاتصال بخادم Cloudflare OAuth',
              })
            );
          }
          return;
        }

        // 4. Direct Server-Side Build & Upload to Cloudflare Pages (`wrangler pages deploy dist`)
        if (
          url.startsWith('/api/cloudflare-direct-deploy') &&
          req.method === 'POST'
        ) {
          const body = await readJsonBody(req);
          const authMode =
            body.authMode === 'global_key' ? 'global_key' : 'token';
          const apiToken = String(
            body.apiToken || latestOauthAccessToken || ''
          ).trim();
          const email = String(body.email || '').trim();
          const globalApiKey = String(body.globalApiKey || '').trim();
          const requestedAccountId = String(body.accountId || '').trim();
          const projectName =
            String(body.projectName || 'iron-plus')
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9-]+/g, '-')
              .replace(/^-|-$/g, '') || 'iron-plus';
          const githubOwner = String(
            body.githubOwner || ghPipeline.owner || ''
          ).trim();
          const githubRepo =
            String(body.githubRepo || ghPipeline.repo || projectName)
              .trim()
              .toLowerCase() || projectName;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (authMode === 'global_key') {
            if (!email || !globalApiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'يرجى إدخال البريد الإلكتروني (3alamy200@gmail.com) ومفتاح Global API Key.',
                })
              );
              return;
            }
            headers['X-Auth-Email'] = email;
            headers['X-Auth-Key'] = globalApiKey;
          } else {
            if (!apiToken) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    'يرجى إدخال رمز Cloudflare API Token (أو استخدام الربط السريع) لرفع ملفات الموقع مباشرة.',
                })
              );
              return;
            }
            headers['Authorization'] = `Bearer ${apiToken}`;
          }

          try {
            // Step A: Discover Account ID
            const accRes = await fetch(
              'https://api.cloudflare.com/client/v4/accounts?page=1&per_page=20',
              {
                method: 'GET',
                headers,
              }
            );
            const accData = (await accRes.json().catch(() => null)) as {
              success?: boolean;
              result?: { id: string; name: string }[];
              errors?: { message?: string }[];
            } | null;

            if (
              !accRes.ok ||
              !accData?.success ||
              !Array.isArray(accData.result) ||
              accData.result.length === 0
            ) {
              const errMsg =
                accData?.errors?.map((e) => e.message).join(' | ') ||
                `HTTP ${accRes.status}`;
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  success: false,
                  error: `تعذر التحقق من حساب Cloudflare (${errMsg}). تأكد من صحة الرمز وصلاحية Cloudflare Pages: Edit.`,
                })
              );
              return;
            }

            const chosenAccount =
              accData.result.find((a) => a.id === requestedAccountId) ||
              accData.result[0];
            const accountId = chosenAccount.id;
            const accountName = chosenAccount.name;

            // Step B: Ensure Cloudflare Pages project exists and is linked to GitHub repo `iron-plus`
            const checkProjRes = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
              {
                method: 'GET',
                headers,
              }
            );

            let subdomain = `${projectName}.pages.dev`;
            let linkedToGitHub = false;

            if (checkProjRes.ok) {
              const projData = (await checkProjRes.json().catch(() => null)) as {
                result?: {
                  subdomain?: string;
                  source?: { type?: string };
                };
              } | null;
              if (projData?.result?.subdomain) {
                subdomain = projData.result.subdomain;
              }
              if (projData?.result?.source?.type === 'github') {
                linkedToGitHub = true;
              } else if (githubOwner) {
                // Attempt to PATCH existing project to attach GitHub repository source
                const patchGitRes = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
                  {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                      production_branch: 'main',
                      build_config: {
                        build_command: 'npm run build',
                        destination_dir: 'dist',
                        root_dir: '',
                      },
                      source: {
                        type: 'github',
                        config: {
                          owner: githubOwner,
                          repo_name: githubRepo,
                          production_branch: 'main',
                          pr_comments_enabled: true,
                          deployments_enabled: true,
                          production_deployments_enabled: true,
                        },
                      },
                    }),
                  }
                ).catch(() => null);
                if (patchGitRes && patchGitRes.ok) {
                  linkedToGitHub = true;
                }
              }
            } else {
              // Create project (try with GitHub source first if githubOwner is given, then fallback to direct project creation)
              if (githubOwner) {
                const createGitRes = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
                  {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      name: projectName,
                      production_branch: 'main',
                      build_config: {
                        build_command: 'npm run build',
                        destination_dir: 'dist',
                        root_dir: '',
                      },
                      source: {
                        type: 'github',
                        config: {
                          owner: githubOwner,
                          repo_name: githubRepo,
                          production_branch: 'main',
                          pr_comments_enabled: true,
                          deployments_enabled: true,
                          production_deployments_enabled: true,
                        },
                      },
                    }),
                  }
                );
                if (createGitRes.ok) {
                  const cgData = (await createGitRes
                    .json()
                    .catch(() => null)) as {
                    result?: { subdomain?: string };
                  } | null;
                  if (cgData?.result?.subdomain) {
                    subdomain = cgData.result.subdomain;
                  }
                  linkedToGitHub = true;
                }
              }

              if (!linkedToGitHub) {
                const createDirectRes = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
                  {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      name: projectName,
                      production_branch: 'main',
                      build_config: {
                        build_command: 'npm run build',
                        destination_dir: 'dist',
                        root_dir: '',
                      },
                    }),
                  }
                );
                const cdData = (await createDirectRes
                  .json()
                  .catch(() => null)) as {
                  success?: boolean;
                  result?: { subdomain?: string };
                } | null;
                if (cdData?.result?.subdomain) {
                  subdomain = cdData.result.subdomain;
                }
              }
            }

            // Step B2: If linked to GitHub, trigger an official GitHub-backed deployment on Cloudflare Pages
            if (linkedToGitHub) {
              await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
                {
                  method: 'POST',
                  headers,
                }
              ).catch(() => null);
            }

            // Step C: Physically upload all compiled files in `/dist` using Wrangler CLI so `<project>.pages.dev` resolves immediately!
            const deployRes = await runWranglerPagesDeploy({
              projectName,
              accountId,
              authMode,
              apiToken,
              email,
              globalApiKey,
            });

            const pagesUrl = subdomain.startsWith('http')
              ? subdomain
              : `https://${subdomain}`;
            const dashboardUrl = `https://dash.cloudflare.com/${accountId}/pages/view/${projectName}`;
            const githubProviderLinkUrl = `https://dash.cloudflare.com/${accountId}/workers-and-pages/create/pages/provider/github`;

            if (deployRes.success) {
              tunnelState.pagesDevLive = true;
              tunnelState.lastDirectDeployUrl = pagesUrl;
            }

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: true,
                accountId,
                accountName,
                projectName,
                pagesUrl,
                deploymentUrl: deployRes.deploymentUrl || pagesUrl,
                dashboardUrl,
                githubProviderLinkUrl,
                linkedToGitHub,
                directUploaded: deployRes.success,
                wranglerOutput: deployRes.output,
                message: deployRes.success
                  ? `تم إنشاء مشروع (${projectName}) ورفع ملفات الموقع بالكامل (dist) وتفعيل النطاق (${pagesUrl}) بنجاح!`
                  : `تم تجهيز مشروع (${projectName}) على Cloudflare Pages (${pagesUrl}).`,
              })
            );
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: false,
                error:
                  err instanceof Error
                    ? err.message
                    : 'حدث خطأ أثناء رفع ملفات البناء إلى Cloudflare Pages',
              })
            );
          }
          return;
        }

        next();
      });
    },
  };
}
