# MiniMax Quota Monitor

在 VSCode 状态栏监控 MiniMax API 配额使用情况。

## 功能特性

- **状态栏显示**: 显示已用额度百分比，根据用量自动切换图标和颜色
- **已用额度**: 显示当前周期已用百分比、配额消耗、重置倒计时、周限额状态
- **Token 消耗统计**: 昨日、近7天、当月 Token 消耗量
- **订阅到期**: 显示距到期剩余天数
- **自动刷新**: 可配置刷新间隔（默认 300 秒，最小 10 秒）
- **手动刷新**: 点击状态栏刷新配额
- **视觉指示**: 已用 <50% 无背景色，75-90% 黄色警告，≥90% 红色错误

## 命令

| 命令 | 说明 |
|------|------|
| `MiniMax: Set API Key` | 设置 API 密钥 |
| `MiniMax: Refresh Quota` | 手动刷新配额 |
| `MiniMax: Set Refresh Interval` | 设置刷新间隔（秒） |

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `minimaxQuotaMonitor.apiKey` | string | `""` | MiniMax API 密钥 |
| `minimaxQuotaMonitor.refreshInterval` | number | `300` | 刷新间隔（秒） |

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

## 悬停显示

鼠标悬停在状态栏上会显示：

```
已用额度
- 2% · 10/600
- 重置: 1小时 52分钟后重置
- 周限额: 不受限制

Token 消耗统计
- 昨日: 1542.1万
- 近7天: 1.1亿
- 当月: 4.3亿

到期: 还剩 275 天 · 点击刷新状态
```
