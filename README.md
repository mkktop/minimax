# MiniMax Quota Monitor

在 VSCode 状态栏监控 MiniMax API 配额使用情况。

## 功能特性

- **状态栏显示**: 显示 API 使用率百分比，根据使用率自动切换图标
- **悬停提示**: Markdown 格式显示详细信息（模型名、使用量、重置时间）
- **自动刷新**: 可配置刷新间隔（默认 300 秒，最小 10 秒）
- **手动刷新**: 点击状态栏或使用命令刷新
- **视觉指示**: 根据使用率显示不同颜色

## 安装

### 从 VSIX 文件安装

```bash
# 打包
npx @vscode/vsce package --no-dependencies

# 在 VSCode 中安装 .vsix 文件
```

### 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听变化
npm run watch
```

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

| 使用率 | 图标 | 背景色 |
|--------|------|--------|
| 0% - 49% | ✓ | 默认 |
| 50% - 74% | ℹ | 默认 |
| 75% - 89% | ⚠ | 警告（黄色） |
| 90% - 100% | ✕ | 错误（红色） |

## 悬停显示

鼠标悬停在状态栏上会显示：

```
MiniMax Quota Monitor

Model: MiniMax-M*
Usage: 99.5%

Used: 597 / 600
Resets at: 2025/3/24 22:00:00

---
Click to refresh
```

## API 信息

- 端点: `https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains`
- 认证: `Authorization: Bearer <API Key>`

## License

MIT
