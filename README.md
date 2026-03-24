# MiniMax Quota Monitor

在 VSCode 状态栏监控 MiniMax API 配额使用情况。

## 功能特性

- **状态栏显示**: 显示 API 剩余额度百分比，根据剩余量自动切换图标和颜色
- **悬停提示**: 显示 token 剩余百分比、配额消耗、下次重置时间
- **自动刷新**: 可配置刷新间隔（默认 300 秒，最小 10 秒）
- **手动刷新**: 点击状态栏刷新配额（无通知弹窗）
- **视觉指示**: 剩余 >50% 无背景色，25-50% 黄色警告，<10% 红色错误


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

| 剩余额度 | 图标 | 背景色 |
|---------|------|--------|
| > 50% | ✓ | 默认 |
| 25% - 50% | ℹ | 默认 |
| 10% - 25% | ⚠ | 警告（黄色） |
| < 10% | ✕ | 错误（红色） |

## 悬停显示

鼠标悬停在状态栏上会显示：

```
MiniMax API 配额

token剩余：99%

配额消耗：4/600

下次重置：2小时30分钟后
```

