# Observability System — 实现细节 (L1)

> **对应 L0**: [observability-system.md](./observability-system.md)

---

## 版本历史

| 版本 | 日期 | Changelog |
| ---- | ------------ | --------- |
| v1.0 | 2026-03-22 | 初始版本 |

---

## 章节索引

| § | 章节 | 对应 L0 |
| :---: | ---- | :-----------: |
| §1 | [配置常量](#1-配置常量) | L0 §6 |
| §2 | [数据结构](#2-数据结构) | L0 §6 |
| §3 | [核心算法](#3-核心算法) | L0 §5 |
| §4 | [决策树](#4-决策树) | L0 §4 |
| §5 | [边缘情况](#5-边缘情况) | L0 §5/§9 |
| §6 | [测试辅助](#6-测试辅助) | L0 §11 |

---

## §1 配置常量

```typescript
export const STORAGE_CONFIG = {
  // 存储限制
  maxEventsPerTable: 100000,      // 单表最大事件数
  retentionDays: 90,              // 保留90天
  archiveThreshold: 30,             // 30天前的数据归档
  
  // 性能配置
  batchSize: 100,                 // 批量写入大小
  flushIntervalMs: 5000,          // 刷盘间隔
  maxQueueSize: 1000,             // 内存队列最大长度
} as const;

export const SENSITIVE_PATTERNS = [
  // 精确匹配凭据字段名，降低误匹配风险
  /^api[_-]?key$/i,
  /^secret[_-]?key$/i,
  /^auth[_-]?token$/i,
  /^password$/i,
  /^credential$/i,
  /^node[_-]?secret$/i,
  /^claim[_-]?url$/i,
  /^bearer$/i,
  /^private[_-]?message$/i,
] as const;

export const METRIC_CONFIG = {
  // 指标聚合窗口
  aggregationWindowMinutes: 5,
  
  // 预定义指标
  predefinedMetrics: [
    'connector.latency.p95',
    'connector.error.rate',
    'connector.heartbeat.success_rate',
    'exploration.success_rate',
    'budget.compliance_rate',
  ] as const,
} as const;
```

---

## §2 数据结构

### 2.1 EventLog

```typescript
export interface EventLog {
  id: string;                    // UUID
  timestamp: ISO8601String;      // 事件时间
  type: EventType;               // 事件类型
  
  // 上下文
  platformId?: string;
  sessionId?: string;
  actor: string;                 // 哪个系统产生
  
  // 脱敏后的 payload
  payload: Record<string, unknown>;
  
  // 元数据
  metadata: {
    sourceVersion: string;       // 产生事件的系统版本
    traceId?: string;           // 分布式追踪 ID
  };
}

export type EventType =
  // Connector 调用相关
  | 'connector_call'
  | 'connector_retryable_failure'
  | 'connector_terminal_failure'
  
  // 状态机流转
  | 'state_transition'
  | 'verification_timeout'
  | 'cooling_applied'
  
  // 平台选择与决策
  | 'platform_selected'
  | 'platform_skipped'
  | 'budget_exhausted'
  
  // LLM 相关
  | 'llm_reflection'
  | 'llm_reflection_failed'
  
  // 凭据生命周期
  | 'credential_changed'
  | 'credential_verified'
  | 'credential_failed'
  | 'credential_revoked'
  
  // 系统级
  | 'session_resumed'
  | 'session_archived'
  | 'user_action';

// 事件优先级（用于丢弃策略）
export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export const EVENT_PRIORITY_MAP: Record<EventType, EventPriority> = {
  'credential_changed': 'critical',
  'credential_verified': 'critical',
  'credential_failed': 'critical',
  'credential_revoked': 'critical',
  'verification_timeout': 'high',
  'cooling_applied': 'high',
  'platform_skipped': 'high',
  'connector_terminal_failure': 'high',
  'session_resumed': 'high',
  'state_transition': 'normal',
  'platform_selected': 'normal',
  'budget_exhausted': 'normal',
  'connector_call': 'normal',
  'connector_retryable_failure': 'normal',
  'llm_reflection': 'low',
  'llm_reflection_failed': 'low',
  'session_archived': 'low',
  'user_action': 'low',
};
```

### 2.2 AuditLog

```typescript
export interface AuditLog {
  id: string;
  timestamp: ISO8601String;
  
  // 动作描述
  action: string;               // e.g., "credential.update"
  actor: string;                // e.g., "user:admin" | "system:control-plane"
  resource: {
    type: string;              // e.g., "credential"
    id: string;                // e.g., "instreet"
  };
  
  // 结果
  result: 'success' | 'failure' | 'denied';
  reason?: string;             // 失败/拒绝原因
  
  // 变更前/后（可选）
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}
```

### 2.3 MetricPoint

```typescript
export interface MetricPoint {
  name: string;                 // 指标名
  timestamp: ISO8601String;
  value: number;
  
  // 标签（用于过滤/分组）
  labels: {
    platformId?: string;
    status?: 'success' | 'failure';
    [key: string]: string | undefined;
  };
  
  // 统计类型
  type: 'gauge' | 'counter' | 'histogram';
}
```

---

## §3 核心算法

### §3.1 Logger.sanitizePayload()

**对应契约**: L0 §5.1 — `logEvent()`  
**准入理由**: 含不明显的业务规则（脱敏策略）

```typescript
function sanitizePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  /**
   * 脱敏敏感字段。
   * 
   * 策略:
   * 1. 字段名匹配敏感模式 -> 替换为 "[REDACTED]"
   * 2. 嵌套对象递归处理
   * 3. 数组中的对象同样处理
   */
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(payload)) {
    // 检查字段名是否敏感
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => 
      pattern.test(key)
    );
    
    if (isSensitive) {
      result[key] = '[REDACTED]';
      continue;
    }
    
    // 递归处理嵌套对象
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizePayload(value as Record<string, unknown>);
      continue;
    }
    
    // 递归处理数组中的对象
    if (Array.isArray(value)) {
      result[key] = value.map(item => {
        if (item && typeof item === 'object') {
          return sanitizePayload(item as Record<string, unknown>);
        }
        return item;
      });
      continue;
    }
    
    // 普通值直接保留
    result[key] = value;
  }
  
  return result;
}

// 使用示例
const rawPayload = {
  action: 'register',
  api_key: 'sk-1234567890abcdef',
  user: {
    name: 'test',
    secret_token: 'token123',  // 嵌套对象中的敏感字段
  },
  logs: [
    { message: 'ok', credential: 'cred1' },  // 数组中的敏感字段
  ],
};

const sanitized = sanitizePayload(rawPayload);
// 结果:
// {
//   action: 'register',
//   api_key: '[REDACTED]',
//   user: { name: 'test', secret_token: '[REDACTED]' },
//   logs: [{ message: 'ok', credential: '[REDACTED]' }],
// }
```

> **注意事项**: 脱敏是防御性措施，不应依赖它作为唯一安全层

---

### §3.2 QueryEngine.executeQuery()

**对应契约**: L0 §5.1 — `queryEvents()`

```typescript
async function executeQuery(filter: EventFilter): Promise<EventLog[]> {
  /**
   * 执行事件查询，支持时间范围、类型、平台过滤。
   */
  
  const { startTime, endTime, types, platformId, limit = 100 } = filter;
  
  // 构建 WHERE 子句
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  if (startTime) {
    conditions.push('timestamp >= ?');
    params.push(startTime);
  }
  
  if (endTime) {
    conditions.push('timestamp <= ?');
    params.push(endTime);
  }
  
  if (types && types.length > 0) {
    const placeholders = types.map(() => '?').join(',');
    conditions.push(`type IN (${placeholders})`);
    params.push(...types);
  }
  
  if (platformId) {
    conditions.push('platform_id = ?');  // SQL schema 使用 snake_case
    params.push(platformId);
  }
  
  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';
  
  // 执行查询
  const query = `
    SELECT * FROM events 
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ?
  `;
  params.push(limit);
  
  const rows = await db.query(query, params);
  
  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    type: row.type,
    platformId: row.platform_id,      // snake_case -> camelCase 映射
    sessionId: row.session_id,
    actor: row.actor,
    payload: JSON.parse(row.payload),
    metadata: JSON.parse(row.metadata),
  }));
}
```

---

### §3.3 MetricsCollector.aggregate()

**对应契约**: L0 §4.2 — Metrics Collector

```typescript
async function aggregateMetrics(
  metricName: string,
  startTime: ISO8601String,
  endTime: ISO8601String,
  windowMinutes: number = METRIC_CONFIG.aggregationWindowMinutes
): Promise<MetricSeries> {
  /**
   * 按时间窗口聚合指标。
   */
  
  const windowMs = windowMinutes * 60 * 1000;
  
  const query = `
    SELECT 
      strftime('%Y-%m-%dT%H:%M:00Z', timestamp) as window_start,
      AVG(value) as avg_value,
      MAX(value) as max_value,
      MIN(value) as min_value,
      COUNT(*) as sample_count
    FROM metrics
    WHERE name = ? AND timestamp >= ? AND timestamp <= ?
    GROUP BY window_start
    ORDER BY window_start
  `;
  
  const rows = await db.query(query, [metricName, startTime, endTime]);
  
  return {
    metric: metricName,
    startTime,
    endTime,
    windowMinutes,
    points: rows.map(row => ({
      timestamp: row.window_start,
      avg: row.avg_value,
      max: row.max_value,
      min: row.min_value,
      count: row.sample_count,
    })),
  };
}
```

---

## §4 决策树

### §4.1 写入队列决策

**对应 L0 Mermaid**: 异步写入流程

```typescript
function decideWriteStrategy(event: EventLog): WriteStrategy {
  /**
   * 决定事件写入策略。
   * 基于 L0 §5.3 的优先级分级策略。
   */
  
  const priority = EVENT_PRIORITY_MAP[event.type];
  const queueSize = writeQueue.size();
  
  // Step 1: critical 优先级永不丢弃，队列满时阻塞写入
  if (priority === 'critical') {
    if (queueSize >= STORAGE_CONFIG.maxQueueSize) {
      // 阻塞直到队列有空间
      return { type: 'blocking' };
    }
    return { type: 'sync' };  // 审计必需，同步写入
  }
  
  // Step 2: high 优先级，队列满时同步强制写入
  if (priority === 'high') {
    if (queueSize >= STORAGE_CONFIG.maxQueueSize) {
      return { type: 'sync_force' };
    }
    return { type: 'sync' };
  }
  
  // Step 3: normal 优先级，异步写入
  if (priority === 'normal') {
    if (queueSize >= STORAGE_CONFIG.maxQueueSize) {
      // 延迟处理，等待下一轮调度
      return { type: 'deferred' };
    }
    return { type: 'async' };
  }
  
  // Step 4: low 优先级，队列满时丢弃
  if (priority === 'low') {
    if (queueSize >= STORAGE_CONFIG.maxQueueSize) {
      return { type: 'drop', reason: 'queue_full_low_priority' };
    }
    return { type: 'async' };
  }
  
  // 未知类型，保守处理（不丢弃）
  return { type: 'async' };
}
```

---

## §5 边缘情况

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| 写入队列满 | 事件丢失 | 低优先级丢弃，高优先级同步写入 |
| SQLite 锁定 | 写入失败 | 指数退避重试，最多3次 |
| 查询时间范围过大 | 内存溢出 | 限制最大返回条数（1000） |
| 脱敏正则误匹配 | 正常内容被隐藏 | 维护精确的正则模式，定期 review |
| 导出文件过大 | 磁盘不足 | 分页导出，每文件限制 10MB |
| 并发查询 | 数据库锁定 | 使用 WAL 模式，读不阻塞写 |

### §5.1 脱敏误匹配处理

```typescript
// ❌ 错误：过于宽泛的正则
// /key/i 会匹配 "keyword", "monkey"

// ✅ 正确：统一使用 SENSITIVE_PATTERNS（精确匹配）
// 避免在不同模块维护两套规则，导致脱敏结果不一致
```

---

## §6 测试辅助

```typescript
// 创建测试事件
export function makeTestEvent(
  overrides: Partial<EventLog> = {}
): EventLog {
  return {
    id: generateUUID(),
    timestamp: now(),
    type: 'connector_call',
    platformId: 'test-platform',
    actor: 'test-actor',
    payload: { action: 'test' },
    metadata: { sourceVersion: '1.0.0' },
    ...overrides,
  };
}

// 测试脱敏
export function testSanitization(): void {
  const testCases = [
    {
      input: { api_key: 'secret123', normal: 'value' },
      expected: { api_key: '[REDACTED]', normal: 'value' },
    },
    {
      input: { nested: { auth_token: 'token456' } },
      expected: { nested: { auth_token: '[REDACTED]' } },
    },
  ];
  
  for (const tc of testCases) {
    const result = sanitizePayload(tc.input);
    assert.deepEqual(result, tc.expected);
  }
}

// Mock 存储
export class MockStorage {
  private events: EventLog[] = [];
  
  async insertEvent(event: EventLog): Promise<void> {
    this.events.push(event);
  }
  
  async queryEvents(filter: EventFilter): Promise<EventLog[]> {
    return this.events.filter(e => {
      if (filter.types && !filter.types.includes(e.type)) return false;
      if (filter.platformId && e.platformId !== filter.platformId) return false;
      return true;
    });
  }
  
  clear(): void {
    this.events = [];
  }
}
```
