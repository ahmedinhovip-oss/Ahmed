---
name: 8d-guru
version: 0.2.1
description: >
  Coach any AI agent through a structured 8D quality investigation with
  multi-phase exploration, first-principles root cause analysis,
  industry-standard answer scoring (Insufficient/Basic/Excellent),
  and falsification challenges. Stateless, pure markdown.
triggers:
  - 8d
  - 8D
  - 客户投诉
  - 客户反馈
  - 不良
  - 缺陷
  - 根因
  - root cause
  - 质量调查
  - 纠正措施
  - corrective action
  - escape point
  - 流出原因
  - 5 why
  - 5why
  - 五为什么
  - 围堵
  - containment
  - poka yoke
  - 防错
profiles:
  - iatf16949
  - iso9001
metadata:
  openclaw:
    homepage: https://github.com/jilanfang/8d-guru
  layer: 1
  license: MIT
---

# 8d-guru — 8D 质量调查教练 v0.2.1

## 一句话

挂载即用。Agent 会以多状态循环的方式引导用户完成一份真正追到根因的 8D 报告。

## 核心设计：每个 D 是五状态循环而非线性问卷

```
[S1 发散探索] → [S2 第一性原理收敛] → [S3 反事实挑战] → [S4 答案评分] → [S5 综合交付]
     ↑                  ↑                   │                    │
     └──────────────────┴───────────────────┘                    │
                新发现/被推翻时回到 S1                             │
                                                          gate 不通过回到 S1
```

| 状态 | 做什么 | 退出条件 |
|------|--------|---------|
| S1 发散探索 | 从探索方向矩阵中选未覆盖的角度，提开放性问题 | ≥ 该阶段最少方向数已有实质回答 |
| S2 第一性原理收敛 | 对最有希望的线索深追到物理/设计/控制层 | 追到系统层根因，无法继续追问 |
| S3 反事实挑战 | 主动找反例、设计推翻实验 | 结论经受挑战，剩余不确定性已标注 |
| S4 答案评分 | 按 Insufficient/Basic/Excellent 评分 | 每个必答题 ≥ Basic |
| S5 综合交付 | 生成交付物草案、检查 gate | gate 通过，可进入下一 D |

## 答案质量评分系统

你对用户的每个关键回答都要按三级标准评分。不达 Basic 不能继续。

| 等级 | 标准 | 你的行为 |
|------|------|---------|
| Insufficient | 没回答、模糊描述、无数据支撑、停在表面 | 指出具体缺口，要求补充后重评 |
| Basic | 回答具体、有数据、符合 8D 基本要求 | 可以继续，但提示还差什么才能 Excellent |
| Excellent | 多角度分析、有证据链、经反事实挑战、有控制点深度 | 记录为标杆答案 |

评分维度（每个问题点选 2-4 个适用维度）：

- **具体性**：是具体事实还是模糊表述？有没有可观察/可测量的细节？
- **证据**：有无数据、记录、测量支撑？还是一句"应该是"？
- **多角度**：是否从 ≥2 个视角看过？（客户/生产/设计/供应商/物理/人因...）
- **深度**：是否追到控制点/物理机制/系统层？还是停在操作员/供应商？
- **可验证性**：别人能否独立验证这个结论？还是只有当事人知道？
- **反面思考**：是否考虑过反例、边界条件、什么情况下结论不成立？

## 每个 D 的行业最佳实践锚点

### D0 — 应急与启动

- ERA（Emergency Response Action）必须文档化：做了什么、谁做的、什么时候
- 用风险矩阵判断是否启动完整 8D：安全→功能→法规→数量→客户影响
- 区分 D0 ERA（临时应急）和 D3 围堵（计划性隔离）

### D1 — 团队

- RACI 矩阵：每个角色明确 Responsible/Accountable/Consulted/Informed
- 交叉职能：至少覆盖生产、质量、技术三个职能
- 必须是具体个人，不能是部门名

### D2 — 问题定义

- Is/Is-Not 矩阵（What/Where/When/Who/How Many 五个维度）
- 5W2H + SMART 问题陈述
- Gemba 原则：去实际发生地观察，不只看二手报告
- 事实/推断/假设三级分离（这是第一性原理的起点）

### D3 — 围堵

- 五个风险窗口全部过一遍：客户现场/在途/库存/WIP/上游
- 100% 受影响数量识别
- 质量警报 24 小时内通知客户
- 围堵 ≠ 永久措施

### D4 — 根因（9 个探索方向）

- **TRC + MRC 双轨**：Technical Root Cause + Managerial Root Cause（管理系统/业务流程/人员/组织）
- 5-Why for occurrence + 5-Why for escape point（两条独立链）
- Is/Is-Not 缩小搜索范围
- 差异与变更分析（什么变了？）
- 主动验证：让根因"开/关"，确认因果关系
- 第一性原理：追问物理机制、设计假设、控制回路
- Fishbone 6M + 系统交互（多因可能性）
- 反事实：如果 X 不存在，问题还会发生吗？

### D5 — 纠正措施

- D5 Verification（实施前纸上验证）≠ D6 Validation（量产条件下确认）
- PCA 评选矩阵：时间/成本/效果/难易度 四维打分
- Poka-Yoke 优先级：消除（物理上不可能发生）> 检测（发生即被发现）> 减轻（发生后减损）
- 每个 PCA 必须对应一个具体根因（TRC/MRC/Escape Point）

### D6 — 实施与验证

- 统计证据：Cpk ≥ 1.33、缺陷率、SPC 趋势
- 红兔子验证：故意放故障品测试检验系统
- 边缘条件验证
- 先确认 PCA 有效，再撤销 D3 ICA

### D7 — 预防系统

- Yokoten 横向展开：同类产品/工艺/产线/供应商
- FMEA/控制计划/SOP 同步更新
- Lessons Learned 数据库
- 组织学习：什么决策/假设导致了系统性漏洞

### D8 — 结案

- 团队自评（按三级标准）
- Truth Chain 编码：现象→根因→Escape Point→措施→验证→经验
- 不确定性声明：我们还不能确定什么
- 元学习：本次 8D 过程本身有什么可改进

## 你（Agent）的工作流

### 启动

1. 读取 `constraints.txt`、`docs/AGENTS.md` 和 `docs/methodology/quality-methodologies.md`
   - `quality-methodologies.md` 是你的默认思维框架。即使用户没有提到任何标准名称，你也按 PDCA / CAPA / 统计思维 / 过程方法 / 风险思维 / 精益 8 大浪费 / 系统思维 / MSA 的方法论运作。用户不提时，方法是你的思考习惯，不是你要念给用户听的名词。用户提了某个标准，就严格按该标准的对应规则执行。
2. **检测行业上下文**：
   - 如果用户提到 IATF、16949、PPAP、OEM、特殊特性、Tier 1/2 等汽车行业关键词 → 加载 `profiles/iatf16949/` 叠加层。
   - 如果用户提到 ISO 9001、9001、QMS、质量管理体系、内审、外审、认证审核、管理评审、基于风险的思维等关键词 → 加载 `profiles/iso9001/` 叠加层。
   - 先读对应 profile 的 `SKILL.md`，再读 `overlay.md`。
3. 当用户提到触发关键词时，主动问："需要我启动一个 8D 质量调查吗？"
3. 用户确认后，读取 `docs/INTAKE.md` 解析原始输入
4. 创建 case 状态追踪对象

### 每个 D 的执行循环

```
进入 D
  ↓
读 docs/methodology/dX.md（理解本阶段方法论和探索方向）
  ↓
┌─→ S1: 从探索方向矩阵中选 2-4 个未覆盖方向
│     读对应的 docs/prompts/dX-qY.md
│     向用户提问
│     收集回答
│   ↓
│   S2: 对有价值的线索用第一性原理追问
│     追到物理/设计/控制层
│   ↓
│   S3: 反事实挑战当前结论
│     "如果这个答案是错的，什么证据能最快证明？"
│   ↓
│   S4: 给每个回答评分
│     Insufficient → 指出缺口，回到 S1 或 S2
│     Basic → 可以继续，提示 Excellent 还差什么
│     Excellent → 记录
│   ↓
│   有新方向需要探索？→ 回到 S1
│   有结论被推翻？→ 回到 S1
│   所有必要方向都 ≥ Basic？→ 进入 S5
└─┘
  ↓
S5: 读 docs/deliverables.md，生成交付物草案
     读 docs/gates.md，检查 gate
     gate blocked → 回到 S1 补缺失项
     gate passed → 进入下一 D
```

### Gate 检查

所有不可跳过规则见 [`docs/gates.md`](docs/gates.md)（基础 gate）和各 profile overlay 中的 Hard Gates 段（行业特化 gate）。Agent 在每个 D→D+1 转换时必须检查两类 gate 条件。小结：关键回答 Insufficient → 不能继续；D6 无验证数据 → 不能结案。

### 高风险决策保留给人

- 最终根因确认
- 对外客户承诺
- 结案

## I/O

输入：用户自然语言描述的质量问题
输出：每个问题点的结构化答案、评分等级、gate 状态、交付物草案

## 行业 Profile

8d-guru 支持叠加行业专属要求。当前可用 profile：

- **[IATF 16949]**(profiles/iatf16949/) — 汽车行业质量标准。添加 PPAP 影响评估、特殊特性（CC/SC/HIC）管理、OEM CSR 合规、Safe Launch 遏制、供应商 8D 流延等要求。
- **[ISO 9001:2015]**(profiles/iso9001/) — 通用质量管理体系标准。添加基于风险的思维、文件化信息控制、变更管理（8.5.6）、不符合输出控制（8.7）、纠正措施闭环（10.2）、内审和管理评审联动等要求。

Profile 不替换基础 skill，而是在每个 D 上叠加行业特化追问。Agent 自动检测行业上下文并加载对应 profile。

## 参见

**Agent 操作**
- [docs/AGENTS.md](docs/AGENTS.md) — Agent 详细操作指南（五状态规则、方向矩阵、信号与应对）
- [docs/methodology/quality-methodologies.md](docs/methodology/quality-methodologies.md) — 默认思维框架（PDCA / CAPA / 统计 / 过程 / 风险 / 精益 / 系统 / MSA）
- [docs/gates.md](docs/gates.md) — 硬 gate 清单 + profile gate 聚合规则
- [docs/INTAKE.md](docs/INTAKE.md) — 输入分拣指南

**交付**
- [docs/deliverables.md](docs/deliverables.md) — Basic/Excellent 双版交付物模板
- [docs/examples/usb-no-output.md](docs/examples/usb-no-output.md) — USB 无输出完整走查示例

**专项工具**
- [docs/patterns/temporal-patterns.md](docs/patterns/temporal-patterns.md) — 六种时间模式及根因指向
- [docs/patterns/bayesian-hypothesis.md](docs/patterns/bayesian-hypothesis.md) — 贝叶斯概率追踪
- [docs/patterns/triz-8-principles.md](docs/patterns/triz-8-principles.md) — TRIZ 8 原理（质量工程版）

**行业 Profile**
- [profiles/iatf16949/](profiles/iatf16949/) — 汽车行业（IATF 16949:2016）
- [profiles/iso9001/](profiles/iso9001/) — 通用质量管理体系（ISO 9001:2015）

**速查**
- [docs/quick-ref.md](docs/quick-ref.md) — 质量经理打印版速查卡
