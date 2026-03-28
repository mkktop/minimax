import * as vscode from 'vscode';
import * as https from 'https';

// ─── API 1: Model Quota ───────────────────────────────────────────────

interface MiniMaxModelRemain {
    model_name: string;
    start_time: string;
    end_time: string;
    remains_time: number;
    current_interval_total_count: number;
    current_interval_usage_count: number;
    current_weekly_total_count: number;
    current_weekly_usage_count: number;
    weekly_remains_time: number;
}

interface QuotaResponse {
    model_remains: MiniMaxModelRemain[];
    base_resp?: { status_code: number; status_msg: string };
}

// ─── API 2: Subscription ──────────────────────────────────────────────

interface SubscriptionResponse {
    current_subscribe?: {
        current_subscribe_end_time: string;
        current_credit_reload_time: string;
    };
    base_resp?: { status_code: number; status_msg: string };
}

// ─── API 3: Billing Records ───────────────────────────────────────────

interface ChargeRecord {
    consume_token: number;
    created_at: number;
}

interface BillingResponse {
    charge_records: ChargeRecord[];
}

// ─── Aggregated Data ──────────────────────────────────────────────────

interface QuotaData {
    mainModel: MiniMaxModelRemain;
    dailyModels: MiniMaxModelRemain[];
    subscription?: {
        endTime: Date;
        creditReloadTime: Date;
    };
    stats?: {
        yesterdayTokens: number;
        sevenDayTokens: number;
        periodTokens: number;
    };
}

// ─── State ────────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem;
let refreshTimer: NodeJS.Timeout | undefined;

// ─── Helpers ──────────────────────────────────────────────────────────

function httpsGet(url: string, headers: Record<string, string>, timeout = 10000): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname,
            port: 443,
            path: parsed.pathname + parsed.search,
            method: 'GET',
            headers,
            timeout,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.end();
    });
}

function formatTokensCN(tokens: number): string {
    if (tokens >= 100_000_000) return `${(tokens / 100_000_000).toFixed(1)}亿`;
    if (tokens >= 10_000) return `${(tokens / 10_000).toFixed(1)}万`;
    return tokens.toString();
}

function formatResetCountdown(resetTime: Date): string {
    const diff = resetTime.getTime() - Date.now();
    if (diff <= 0) return '即将重置';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return m > 0 ? `${h} 小时 ${m} 分钟后重置` : `${h} 小时后重置`;
    return `${m} 分钟后重置`;
}

function daysUntil(d: Date): number {
    return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

// ─── API Fetchers ─────────────────────────────────────────────────────

async function fetchQuota(apiKey: string): Promise<MiniMaxModelRemain[]> {
    const { statusCode, body } = await httpsGet(
        'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains',
        { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    );
    if (statusCode === 401) throw new Error('Invalid API Key');
    if (statusCode === 429) throw new Error('Rate limited');
    if (statusCode < 200 || statusCode >= 300) throw new Error(`HTTP ${statusCode}`);
    const json: QuotaResponse = JSON.parse(body);
    if (json.base_resp?.status_code !== 0) {
        throw new Error(json.base_resp?.status_msg || 'API error');
    }
    return json.model_remains || [];
}

async function fetchSubscription(apiKey: string): Promise<SubscriptionResponse['current_subscribe'] | undefined> {
    try {
        const { statusCode, body } = await httpsGet(
            'https://www.minimaxi.com/v1/api/openplatform/charge/combo/cycle_audio_resource_package?biz_line=2&cycle_type=1&resource_package_type=7',
            { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        );
        if (statusCode < 200 || statusCode >= 300) return undefined;
        const json: SubscriptionResponse = JSON.parse(body);
        return json.current_subscribe;
    } catch {
        return undefined;
    }
}

async function fetchAllBillingRecords(apiKey: string, minStartTime?: number): Promise<ChargeRecord[]> {
    const allRecords: ChargeRecord[] = [];
    let page = 1;
    const limit = 100;

    while (true) {
        const url = `https://www.minimaxi.com/account/amount?page=${page}&limit=${limit}&aggregate=false`;
        const { statusCode, body } = await httpsGet(url, { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' });
        if (statusCode < 200 || statusCode >= 300) break;

        const json: BillingResponse = JSON.parse(body);
        const records = json.charge_records || [];
        if (records.length === 0) break;

        for (const r of records) {
            if (minStartTime && r.created_at * 1000 < minStartTime) return allRecords;
            allRecords.push(r);
        }
        if (records.length < limit) break;
        page++;
    }
    return allRecords;
}

function calculateStats(records: ChargeRecord[]): QuotaData['stats'] {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 86400000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let yesterdayTokens = 0;
    let sevenDayTokens = 0;
    let monthTokens = 0;

    for (const r of records) {
        const ts = r.created_at * 1000;
        const token = Number(r.consume_token);
        if (ts >= todayStart - 86400000 && ts < todayStart) yesterdayTokens += token;
        if (ts >= sevenDaysAgo) sevenDayTokens += token;
        if (ts >= monthStart) monthTokens += token;
    }
    return { yesterdayTokens, sevenDayTokens, periodTokens: monthTokens };
}

// ─── Extension Lifecycle ──────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'minimaxQuota.refreshQuota';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    context.subscriptions.push(
        vscode.commands.registerCommand('minimaxQuota.setApiKey', setApiKey),
        vscode.commands.registerCommand('minimaxQuota.refreshQuota', () => refreshQuota(true)),
        vscode.commands.registerCommand('minimaxQuota.setRefreshInterval', setRefreshInterval)
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('minimaxQuotaMonitor.refreshInterval')) setupRefreshTimer();
            if (e.affectsConfiguration('minimaxQuotaMonitor.apiKey')) refreshQuota();
        })
    );

    updateStatusBarDefault();
    setupRefreshTimer();
    refreshQuota();
}

export function deactivate() {
    if (refreshTimer) clearInterval(refreshTimer);
    if (statusBarItem) statusBarItem.dispose();
}

// ─── UI Helpers ───────────────────────────────────────────────────────

function updateStatusBarDefault() {
    const apiKey = vscode.workspace.getConfiguration('minimaxQuotaMonitor').get<string>('apiKey', '');
    if (!apiKey) {
        statusBarItem.text = '$(key) MiniMax: Set Key';
        statusBarItem.tooltip = new vscode.MarkdownString('**MiniMax Quota Monitor**\n\nClick to set your API key');
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(sync~spin) MiniMax: Loading...';
    }
}

function setupRefreshTimer() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = undefined; }
    const interval = Math.max(10, vscode.workspace.getConfiguration('minimaxQuotaMonitor').get<number>('refreshInterval', 300));
    refreshTimer = setInterval(() => refreshQuota(), interval * 1000);
}

async function setApiKey() {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your MiniMax API Key',
        password: true,
        placeHolder: 'sk-...'
    });
    if (apiKey !== undefined) {
        await vscode.workspace.getConfiguration('minimaxQuotaMonitor').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('MiniMax API Key saved successfully!');
        refreshQuota();
    }
}

async function setRefreshInterval() {
    const config = vscode.workspace.getConfiguration('minimaxQuotaMonitor');
    const current = config.get<number>('refreshInterval', 300);
    const input = await vscode.window.showInputBox({
        prompt: 'Enter refresh interval in seconds',
        value: current.toString(),
        placeHolder: '300',
        validateInput: (v) => { const n = parseInt(v, 10); return (isNaN(n) || n < 10) ? 'Please enter a number >= 10' : null; }
    });
    if (input !== undefined) {
        const interval = parseInt(input, 10);
        await config.update('refreshInterval', interval, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Refresh interval set to ${interval} seconds`);
    }
}

// ─── Main Refresh ─────────────────────────────────────────────────────

async function refreshQuota(showMessage = false) {
    const apiKey = vscode.workspace.getConfiguration('minimaxQuotaMonitor').get<string>('apiKey', '');
    if (!apiKey) {
        updateStatusBarDefault();
        if (showMessage) await setApiKey();
        return;
    }

    try {
        const [models, subscription] = await Promise.all([
            fetchQuota(apiKey),
            fetchSubscription(apiKey),
        ]);

        if (!models.length) throw new Error('No quota data available');

        // Separate main model (MiniMax-M*) from daily-limit models
        const mainModel = models.find(m => m.model_name.startsWith('MiniMax-M'))
            || models.find(m => m.current_interval_total_count > 0)
            || models[0];
        const dailyModels = models.filter(m => m.model_name !== mainModel.model_name);

        // Billing stats (always fetch for yesterday & 7-day; period needs subscription)
        let stats: QuotaData['stats'] | undefined;
        try {
            const minStart = Date.now() - 30 * 86400000; // look back 30 days max
            const records = await fetchAllBillingRecords(apiKey, minStart);
            stats = calculateStats(records);
        } catch {
            // billing fetch failure is non-fatal
        }

        updateStatusBar({
            mainModel,
            dailyModels,
            subscription: subscription ? {
                endTime: new Date(subscription.current_subscribe_end_time),
                creditReloadTime: new Date(subscription.current_credit_reload_time),
            } : undefined,
            stats,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        statusBarItem.text = '$(error) MiniMax: Error';
        statusBarItem.tooltip = new vscode.MarkdownString(`**MiniMax Error**\n\n${msg}`);
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        if (showMessage) vscode.window.showErrorMessage(`Failed to fetch MiniMax quota: ${msg}`);
    }
}

// ─── Status Bar & Tooltip ─────────────────────────────────────────────

function updateStatusBar(data: QuotaData) {
    const { mainModel } = data;
    const remaining = mainModel.current_interval_usage_count || 0;
    const total = mainModel.current_interval_total_count || 1;
    const used = total - remaining;
    const pct = total > 0 ? (used / total) * 100 : 0;

    // Status bar text & color
    const icon = pct < 50 ? '$(check)' : pct < 75 ? '$(info)' : pct < 90 ? '$(warning)' : '$(error)';
    statusBarItem.text = `${icon} MiniMax: ${pct.toFixed(0)}%`;

    if (pct >= 90) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (pct >= 75) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.backgroundColor = undefined;
    }

    // Build tooltip
    statusBarItem.tooltip = buildTooltip(data);
}

function buildTooltip(data: QuotaData): vscode.MarkdownString {
    const { mainModel, subscription, stats } = data;

    const remaining = mainModel.current_interval_usage_count || 0;
    const total = mainModel.current_interval_total_count || 1;
    const used = total - remaining;
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;

    const weeklyTotal = mainModel.current_weekly_total_count;
    const weeklyRemaining = mainModel.current_weekly_usage_count || 0;

    const tip = new vscode.MarkdownString();
    tip.supportHtml = true;
    tip.isTrusted = true;

    // ── 套餐额度 ──
    tip.appendMarkdown(`**剩余额度**  \n`);
    tip.appendMarkdown(`- **${pct}%** · ${used}/${total}  \n`);
    tip.appendMarkdown(`- 重置: ${formatResetCountdown(new Date(mainModel.end_time))}  \n`);

    if (weeklyTotal && weeklyTotal > 0) {
        const weeklyUsed = weeklyTotal - weeklyRemaining;
        const weeklyPct = Math.round((weeklyUsed / weeklyTotal) * 100);
        tip.appendMarkdown(`- 周限额: ${weeklyUsed}/${weeklyTotal} (${weeklyPct}%)  \n`);
    } else {
        tip.appendMarkdown(`- 周限额: 不受限制  \n`);
    }
    tip.appendMarkdown('\n');

    // ── Token 消耗统计 ──
    if (stats) {
        tip.appendMarkdown(`**Token 消耗统计**\n\n`);
        tip.appendMarkdown(`- 昨日: ${formatTokensCN(stats.yesterdayTokens)}\n`);
        tip.appendMarkdown(`- 近7天: ${formatTokensCN(stats.sevenDayTokens)}\n`);
        tip.appendMarkdown(`- 当月: ${formatTokensCN(stats.periodTokens)}\n`);
        tip.appendMarkdown('\n');
    }

    // ── 到期 ──
    if (subscription) {
        tip.appendMarkdown(`到期: 还剩 ${daysUntil(subscription.endTime)} 天 · 点击刷新状态`);
    }

    return tip;
}
