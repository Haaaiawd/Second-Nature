# Wave 55 Review — T-BTS.C.3

## 最高严重度

none

## 变更清单

| 文件 | 变更 |
|------|------|
| `src/core/second-nature/body/behavior-promotion/behavior-promotion-loop.ts` | 新增：BehaviorPromotionLoop 状态机 |
| `src/storage/db/migrations/v7-004-behavior-promotion.ts` | 新增：behavior_promotion 表 |
| `src/storage/db/migrations/index.ts` | 更新：注册 v7-004 |
| `tests/unit/body/behavior-promotion-loop.test.ts` | 新增：9 个单元测试 |

## 回归检查

- `node --test dist/tests/unit/body/behavior-promotion-loop.test.js` — 9/9 pass
- 无预先存在失败

## 测试矩阵

| 测试文件 | 通过 | 失败 |
|---------|:----:|:----:|
| `tests/unit/body/behavior-promotion-loop.test.ts` | 9 | 0 |
| **合计** | **9** | **0** |

## 设计一致性

- T-BTS.C.3:
  - submitPromotion → candidate (7-day TTL from submission)
  - approvePromotion: candidate→approved, idempotent on already-approved
  - rejectPromotion: candidate→rejected with reason; idempotent on already-rejected
  - rejected/expired immutable → throws `promotion_immutable` on approve/reject attempts
  - expireStaleCandidates: bulk-updates candidate→expired where expires_at < now
  - Does NOT grant execution authorization (ADR-004)

## 安全与治理

- No credential or sensitive data in promotion rows
- rejectReason stored in plain text (operator-facing, not user-facing)

## 下一步

- INT-S2 (S2 集成验证) 或 T-CP.C.1 (EmbodiedContextAssembler)
