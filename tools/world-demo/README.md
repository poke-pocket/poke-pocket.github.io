# 本地 Demo

先在仓库根目录安装依赖，再进入 `tools/world-demo` 目录运行开发服务器：

```bash
npm run dev -- --port 4183
```

使用 WASD 移动、Z/C 旋转、空格跳跃、E 交互。右上角可调整场景、天气和时间，顶部可控制音乐。Demo 不包含战斗或宝可梦。

示例事件可以通过 `window.pixelWorldDemo` 的 `on`、`emit` 和 `addInteractable` 注册和监听；这些是 Demo 事件，不会改变游戏存档。
