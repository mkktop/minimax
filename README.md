# MiniMax Quota Monitor

[![Version](https://img.shields.io/visual-studio-marketplace/v/mkktop.minimax-quota-monitor)](https://marketplace.visualstudio.com/items?itemName=mkktop.minimax-quota-monitor)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/mkktop.minimax-quota-monitor)](https://marketplace.visualstudio.com/items?itemName=mkktop.minimax-quota-monitor)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/mkktop.minimax-quota-monitor)](https://marketplace.visualstudio.com/items?itemName=mkktop.minimax-quota-monitor)
[![GitHub stars](https://img.shields.io/github/stars/mkktop/minimax-quota-monitor)](https://github.com/mkktop/minimax-quota-monitor)

在 VSCode 状态栏实时监控 MiniMax API 配额使用情况。

![状态栏预览](docs/screenshot.png)

> 截图待补充：将运行时的状态栏截图放到 `docs/screenshot.png` 即可。

## 功能特性

- **状态栏显示**: 显示已用额度百分比，根据用量自动切换图标和颜色
- **已用额度**: 显示当前周期已用百分比、配额消耗、重置倒计时、周限额状态
- **Token 消耗统计**: 昨日、近7天、近30天、累计 Token 消耗量
- **订阅到期**: 显示距到期剩余天数
- **自动刷新**: 可配置刷新间隔（默认 300 秒，最小 10 秒）
- **手动刷新**: 点击状态栏刷新配额
- **视觉指示**: 已用 <50% 无背景色，75-90% 黄色警告，≥90% 红色错误

## 快速开始

1. 在 [MiniMax 开放平台](https://www.minimaxi.com) 申请 API Key
2. 在 VSCode 中安装本扩展
3. 打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`），执行 `MiniMax: Set API Key`
4. 粘贴 API Key 回车保存
5. 状态栏右下角将出现 `MiniMax: X%`，悬停查看详细用量

> 也可直接在 `settings.json` 中配置 `minimaxQuotaMonitor.apiKey`。

## 命令

| 命令 | 说明 |
|------|------|
| `MiniMax: Set API Key` | 设置 API 密钥 |
| `MiniMax: Refresh Quota` | 手动刷新配额 |
| `MiniMax: Set Refresh Interval` | 设置刷新间隔（秒） |

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `minimaxQuotaMonitor.apiKey` | string | `""` | MiniMax API Key |
| `minimaxQuotaMonitor.refreshInterval` | number | `300` | 刷新间隔（秒），最小 10 |

### 通过 settings.json 配置

```json
{
  "minimaxQuotaMonitor.apiKey": "sk-cp-xxxxx",
  "minimaxQuotaMonitor.refreshInterval": 300
}
```

## 状态栏图标

| 已用额度 | 图标 | 背景色 |
|---------|------|--------|
| < 50% | ✓ | 默认 |
| 50% - 75% | ℹ | 默认 |
| 75% - 90% | ⚠ | 警告（黄色） |
| ≥ 90% | ✕ | 错误（红色） |

> 图标遵循 VSCode 主题规范（`$(check)` / `$(info)` / `$(warning)` / `$(error)`），不同主题下视觉可能略有差异。

## 悬停显示

鼠标悬停在状态栏上会显示：

```
已用额度
- 2% · 2/100
- 重置: 1小时 52分钟后重置
- 周限额: 不受限制

Token 消耗统计
- 昨日: 1542.1万
- 近7天: 1.1亿
- 近30天: 4.3亿
- 累计: 7.1亿

到期: 还剩 275 天 · 点击刷新状态
```

## 常见问题

### 状态栏显示 "MiniMax: Set Key"
尚未设置 API Key。执行 `MiniMax: Set API Key` 命令，或在 settings 中配置 `minimaxQuotaMonitor.apiKey`。

### 一直显示 "Loading..."
通常是网络或凭据问题，请检查：
- 能否正常访问 `minimaxi.com`
- 防火墙 / 代理是否放行
- API Key 是否有效（可重新设置一次）

### 状态栏显示 "Error"
悬停查看具体错误：
- `Invalid API Key`：API Key 无效或已过期
- `Rate limited`：请求频率过高，尝试调大 `refreshInterval`
- `HTTP <code>`：其他 HTTP 错误，附具体状态码

## 隐私与安全

- API Key 仅保存在本机 VSCode 全局配置中，**不会上传到任何第三方**
- 扩展只向 `minimaxi.com` 发起请求，不会收集或上报任何使用数据
- 源码完全开源，欢迎审计：[GitHub 仓库](https://github.com/mkktop/minimax-quota-monitor)

## 更新日志

每个版本的变更请查看 [GitHub Releases](https://github.com/mkktop/minimax-quota-monitor/releases)。
