# Rust Warning Cross-Platform Cleanup

## 目标

消除当前 Rust 编译日志列出的未使用 import、可变绑定、常量和函数 warning，同时保持 Windows 的 MinGit、CLI shim、debug HMR 补丁及 profile clone 能力不受影响。

## 完成结果

在对应平台编译时，只包含该平台实际使用的符号；通用代码不再保留无效 import 或多余 `mut`。Windows 专属能力继续在 Windows target 下参与编译和测试。

## 范围与排除项

允许修改 `src-tauri/src/config/`、`src-tauri/src/service/cli/`、`src-tauri/src/service/patch/`、`src-tauri/src/service/plugin/`、`src-tauri/src/service/workflow/`、`src-tauri/src/service/download/` 和 `src-tauri/src/service/profile/` 内与 warning 直接对应的条件编译或局部声明。

不修改依赖、锁文件、应用行为、网络下载协议、CLI shim 内容或公开 Tauri command 契约；不删除 Windows 专属能力，只使其按目标平台编译。

## 已确认事实

- 当前 macOS 编译日志中的 warning 集中在 Windows 专属 MinGit、`.cmd`/`.ps1` shim、debug HMR fallback，以及少量跨平台 import 和局部绑定。
- 源码中 MinGit 下载器和 shim 构建函数仍有实际调用链；warning 的直接原因是当前非 Windows target 未编译其调用点。
- `profile::clone` 存在定义，需核实是否为未注册 command 或仅缺少条件属性后再决定处理方式。
- 工作区已有一项未提交的 `packages/dsh-tauri-tsdown/src/index.ts` 构建修复，本任务不触及或回滚该文件。

## 技术方案

以 `#[cfg(windows)]` 精确约束 Windows-only 的常量、导入、模块、安装任务分支和辅助函数；对 debug-only HMR 补丁采用现有项目的 debug 条件模式；删除已证实不需要的 import 与 `mut`。仅当 `profile::clone` 被证明无调用且没有公开注册契约时，才讨论删除或可见性收窄。

## 验收与验证

- 当前 host target 的 `cargo check` 不再报告本任务涉及的 warning。
- 对 Windows-only 改动至少执行 `cargo check --target x86_64-pc-windows-gnu`；若目标或 linker 未安装，记录为环境未验证，不将其误报为通过。
- 运行受影响 Rust 单元测试；最终执行项目已有 `cargo check` 和 `cargo test`。
- 检查 diff，确认没有修改依赖和既有 TypeScript 构建修复。

## 风险与回退

错误的条件编译可能使 Windows 构建缺少下载器或 shim。回退方式是撤销本任务涉及的条件属性和局部清理；不影响现有 TypeScript 改动。
