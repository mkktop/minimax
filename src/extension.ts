import * as vscode from 'vscode';
import * as https from 'https';

// MiniMax API response interfaces
interface MiniMaxModelRemain {
    model_name: string;
    current_interval_total_count: number;
    current_interval_usage_count: number;
    start_time: number;
    end_time: number;
    remains_time: number;
}

interface MiniMaxResponse {
    model_remains: MiniMaxModelRemain[];
    base_resp: {
        status_code: number;
        status_msg: string;
    };
}

interface QuotaData {
    models: MiniMaxModelRemain[];
    mainModel: {
        name: string;
        used: number;
        total: number;
        percentage: number;
    };
    resetTime: Date;
}

let statusBarItem: vscode.StatusBarItem;
let refreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('MiniMax Quota Monitor is now active!');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'minimaxQuota.refreshQuota';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('minimaxQuota.setApiKey', setApiKey),
        vscode.commands.registerCommand('minimaxQuota.refreshQuota', () => refreshQuota(true)),
        vscode.commands.registerCommand('minimaxQuota.setRefreshInterval', setRefreshInterval)
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('minimaxQuotaMonitor.refreshInterval')) {
                setupRefreshTimer();
            }
            if (e.affectsConfiguration('minimaxQuotaMonitor.apiKey')) {
                refreshQuota();
            }
        })
    );

    // Initial setup
    updateStatusBarDefault();
    setupRefreshTimer();
    refreshQuota();
}

function updateStatusBarDefault() {
    const config = vscode.workspace.getConfiguration('minimaxQuotaMonitor');
    const apiKey = config.get<string>('apiKey', '');

    if (!apiKey) {
        statusBarItem.text = '$(key) MiniMax: Set Key';
        statusBarItem.tooltip = new vscode.MarkdownString('**MiniMax Quota Monitor**\n\nClick to set your API key');
        statusBarItem.backgroundColor = undefined;
    } else {
        statusBarItem.text = '$(sync~spin) MiniMax: Loading...';
    }
}

function setupRefreshTimer() {
    // Clear existing timer
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }

    const config = vscode.workspace.getConfiguration('minimaxQuotaMonitor');
    const interval = Math.max(10, config.get<number>('refreshInterval', 300));

    refreshTimer = setInterval(() => {
        refreshQuota();
    }, interval * 1000);
}

async function setApiKey() {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your MiniMax API Key',
        password: true,
        placeHolder: 'sk-...'
    });

    if (apiKey !== undefined) {
        const config = vscode.workspace.getConfiguration('minimaxQuotaMonitor');
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('MiniMax API Key saved successfully!');
        refreshQuota();
    }
}

async function setRefreshInterval() {
    const config = vscode.workspace.getConfiguration('minimaxQuotaMonitor');
    const currentInterval = config.get<number>('refreshInterval', 300);

    const input = await vscode.window.showInputBox({
        prompt: 'Enter refresh interval in seconds',
        value: currentInterval.toString(),
        placeHolder: '300',
        validateInput: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 10) {
                return 'Please enter a number >= 10';
            }
            return null;
        }
    });

    if (input !== undefined) {
        const interval = parseInt(input, 10);
        await config.update('refreshInterval', interval, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Refresh interval set to ${interval} seconds`);
    }
}

async function refreshQuota(showMessage: boolean = false) {
    const config = vscode.workspace.getConfiguration('minimaxQuotaMonitor');
    const apiKey = config.get<string>('apiKey', '');

    if (!apiKey) {
        updateStatusBarDefault();
        return;
    }

    try {
        const quotaData = await fetchMiniMaxQuota(apiKey);
        updateStatusBar(quotaData);

        if (showMessage) {
            vscode.window.showInformationMessage(
                `MiniMax Quota: ${quotaData.mainModel.name} - ${quotaData.mainModel.used}/${quotaData.mainModel.total}`
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        statusBarItem.text = '$(error) MiniMax: Error';
        statusBarItem.tooltip = new vscode.MarkdownString(`**MiniMax Error**\n\n${errorMessage}`);
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');

        if (showMessage) {
            vscode.window.showErrorMessage(`Failed to fetch MiniMax quota: ${errorMessage}`);
        }
    }
}

function fetchMiniMaxQuota(apiKey: string): Promise<QuotaData> {
    return new Promise((resolve, reject) => {
        const timeout = 10000;

        const options: https.RequestOptions = {
            hostname: 'www.minimaxi.com',
            port: 443,
            path: '/v1/api/openplatform/coding_plan/remains',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: timeout
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const jsonData: MiniMaxResponse = JSON.parse(data);

                        if (jsonData.base_resp?.status_code !== 0) {
                            reject(new Error(jsonData.base_resp?.status_msg || 'API error'));
                            return;
                        }

                        const models = jsonData.model_remains || [];

                        // Find the main model (MiniMax-M* or first with usage)
                        let mainModelData = models.find(m => m.model_name.startsWith('MiniMax-M'));
                        if (!mainModelData) {
                            mainModelData = models.find(m => m.current_interval_total_count > 0);
                        }
                        if (!mainModelData && models.length > 0) {
                            mainModelData = models[0];
                        }

                        if (!mainModelData) {
                            reject(new Error('No quota data available'));
                            return;
                        }

                        const used = mainModelData.current_interval_usage_count || 0;
                        const total = mainModelData.current_interval_total_count || 1;
                        const percentage = total > 0 ? (used / total) * 100 : 0;

                        const quotaData: QuotaData = {
                            models: models,
                            mainModel: {
                                name: mainModelData.model_name,
                                used: used,
                                total: total,
                                percentage: percentage
                            },
                            resetTime: new Date(mainModelData.end_time)
                        };

                        resolve(quotaData);
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else if (res.statusCode === 401) {
                    reject(new Error('Invalid API Key'));
                } else if (res.statusCode === 429) {
                    reject(new Error('Rate limited'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

function updateStatusBar(quotaData: QuotaData) {
    const { mainModel, models, resetTime } = quotaData;
    const percentage = mainModel.percentage;

    // Choose icon based on usage percentage
    let icon: string;
    if (percentage < 50) {
        icon = '$(check)';
    } else if (percentage < 75) {
        icon = '$(info)';
    } else if (percentage < 90) {
        icon = '$(warning)';
    } else {
        icon = '$(error)';
    }

    // Status bar text: show percentage
    statusBarItem.text = `${icon} MiniMax: ${percentage.toFixed(1)}%`;

    // Set background color based on usage
    if (percentage >= 90) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (percentage >= 75) {
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.backgroundColor = undefined;
    }

    // Build tooltip markdown
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown('**MiniMax API 配额**\n\n');
    tooltip.appendMarkdown(`token使用率：${percentage.toFixed(0)}%\n\n`);
    tooltip.appendMarkdown(`配额消耗：${mainModel.used}/${mainModel.total}\n\n`);

    // Calculate time until reset
    const now = new Date();
    const diffMs = resetTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs > 0) {
        tooltip.appendMarkdown(`下次重置：${diffHours}小时${diffMinutes}分钟后`);
    } else {
        tooltip.appendMarkdown('下次重置：即将重置');
    }

    statusBarItem.tooltip = tooltip;
}

export function deactivate() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
