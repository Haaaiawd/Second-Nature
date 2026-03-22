# Connector System — 实现细节 (L1)

> **文件性质**: L1 实现层 · **对应 L0**: [connector-system.md](./connector-system.md)  
> 本文件仅在 `/forge` 任务明确引用时加载。

---

## 版本历史

| 版本 | 日期 | Changelog |
| ---- | ------------ | --------- |
| v1.0 | 2026-03-22 | 初始版本 |

---

## 本文件章节索引

|   §   | 章节 | 对应 L0 入口 |
| :---: | ---- | :-----------: |
|  §1   | [配置常量](#1-配置常量) | L0 §6 数据模型 |
|  §2   | [完整数据结构](#2-核心数据结构) | L0 §6 数据模型 |
|  §3   | [核心算法](#3-核心算法) | L0 §5 操作契约表 |
|  §4   | [决策树](#4-决策树) | L0 §4 架构图 |
|  §5   | [边缘情况](#5-边缘情况) | L0 §5 / §9 |
|  §6   | [测试辅助](#6-测试辅助) | L0 §11 测试策略 |

---

## §1 配置常量

### 1.1 超时配置

```typescript
export const TIMEOUT_CONFIG = {
  // HTTP 请求超时
  http: {
    connect: 5000,    // 5s 连接超时
    read: 30000,      // 30s 读取超时
    write: 10000,     // 10s 写入超时
  },
  
  // CLI 执行超时
  cli: {
    default: 60000,   // 60s 默认超时
    longRunning: 120000, // 2min 长任务
  },
  
  // Skill 调用超时
  skill: {
    default: 30000,   // 30s
  },
} as const;
```

### 1.2 重试策略

```typescript
export const RETRY_CONFIG = {
  // 指数退避
  exponential: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  
  // 限流特化
  rateLimit: {
    // 使用平台返回的 retry_after
    respectPlatformHeader: true,
    // 如果 header 缺失，默认退避
    defaultDelayMs: 60000,
  },
} as const;
```

### 1.3 平台特有配置

```typescript
export const PLATFORM_CONFIG = {
  instreet: {
    heartbeatIntervalMs: 30 * 60 * 1000,  // 30分钟
    verificationTimeoutMs: 5 * 60 * 1000,   // 5分钟验证窗口
    maxDailyInteractions: 15,
  },
  
  evomap: {
    heartbeatIntervalMs: 15 * 60 * 1000,     // 15分钟
    offlineThresholdMs: 45 * 60 * 1000,      // 45分钟离线
    protocolVersion: '1.0.0',
  },
  
  moltbook: {
    // 文档不稳定，配置留空待填充
    adapterPriority: ['skill', 'cli', 'http'] as const,
  },
} as const;
```

---

## §2 核心数据结构

### 2.1 PlatformCredential 引用

> **Canonical Schema 定义于**: [state-system.detail.md §2.1](./state-system.detail.md)

`connector-system` 通过 `CredentialManager` 接口与 `state-system` 交互，不持有凭据的 canonical 定义。

```typescript
// connector-system 使用的凭据接口（由 state-system 提供）
import type { 
  EncryptedCredential, 
  DecryptedCredential,
  CredentialStatus 
} from '../state-system/types';

// connector-system 只定义凭据相关的业务类型
export type CredentialType = 'api_key' | 'node_secret' | 'oauth_token';

// CredentialManager 接口（由 state-system 实现）
export interface CredentialManager {
  getCredential(platformId: string): Promise<DecryptedCredential | null>;
  setCredential(cred: EncryptedCredential): Promise<void>;
  updateStatus(
    platformId: string, 
    status: CredentialStatus, 
    reason?: string
  ): Promise<void>;
  markAsVerified(platformId: string): Promise<void>;
}
```

**关键约定**:
- `verificationDeadline` 存储于 `platformSpecific`，由 connector 写入、读取
- `failed` 状态由 connector 触发，state-system 持久化
- 凭据类型的具体解释由 connector 根据 `type` 字段决定

### 2.2 ConnectorResult 实现

```typescript
export class ConnectorResult<T> {
  status: ResultStatus;
  data?: T;
  error?: ConnectorError;
  metadata: ResultMetadata;

  private constructor(props: ConnectorResultProps<T>) {
    this.status = props.status;
    this.data = props.data;
    this.error = props.error;
    this.metadata = {
      ...props.metadata,
      timestamp: props.metadata.timestamp || now(),
    };
  }

  // 工厂方法
  static success<T>(data: T, metadata: Partial<ResultMetadata>): ConnectorResult<T> {
    return new ConnectorResult({
      status: 'success',
      data,
      metadata: { platformId: metadata.platformId!, latencyMs: metadata.latencyMs || 0, ...metadata },
    });
  }

  static retryableFailure<T>(
    error: ConnectorError, 
    metadata: Partial<ResultMetadata>
  ): ConnectorResult<T> {
    return new ConnectorResult({
      status: 'retryable_failure',
      error,
      metadata: { platformId: metadata.platformId!, latencyMs: metadata.latencyMs || 0, ...metadata },
    });
  }

  static terminalFailure<T>(
    error: ConnectorError, 
    metadata: Partial<ResultMetadata>
  ): ConnectorResult<T> {
    return new ConnectorResult({
      status: 'terminal_failure',
      error,
      metadata: { platformId: metadata.platformId!, latencyMs: metadata.latencyMs || 0, ...metadata },
    });
  }

  static skipped<T>(reason: string, metadata: Partial<ResultMetadata>): ConnectorResult<T> {
    return new ConnectorResult({
      status: 'skipped',
      error: { type: 'SKIPPED', message: reason },
      metadata: { platformId: metadata.platformId!, latencyMs: 0, ...metadata },
    });
  }

  // 便捷方法
  isSuccess(): boolean {
    return this.status === 'success';
  }

  shouldRetry(): boolean {
    return this.status === 'retryable_failure';
  }

  getRetryAfterMs(): number {
    if (!this.shouldRetry()) return 0;
    return this.error?.retryAfterSeconds ? this.error.retryAfterSeconds * 1000 : 60000;
  }
}
```

### 2.3 PresenceResult 详细结构

```typescript
export interface PresenceResult {
  online: boolean;
  nextHeartbeatMs: number;  // 建议下次心跳时间
  lastHeartbeatAt?: ISO8601String;
  
  pendingEvents: PendingEvent[];
  
  // 平台特有扩展
  platformSpecific: {
    // InStreet 特有
    instreet?: {
      whatToDoNext: string[];        // 推荐动作列表
      unreadNotifications: number;
      unreadMessages: number;
      feedDigest?: string;           // 摘要
    };
    
    // EvoMap 特有
    evomap?: {
      availableWork: AvailableTask[];
      creditBalance: number;
      nodeReputation?: number;
    };
  };
}

export interface PendingEvent {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: ISO8601String;
  payload: Record<string, unknown>;
  
  // 业务方法
  requiresAction(): boolean {
    return this.priority === 'high' || 
           (this.type === 'message' || this.type === 'notification');
  }
}
```

---

## §3 核心算法

### §3.1 InStreetConnector.verifyChallenge()

**对应契约**: L0 §5.1 — `verifyChallenge()`  
**准入理由**: 含不明显的业务规则（验证窗口期、超时处理）

```typescript
async function verifyChallenge(answer: string): Promise<ConnectorResult<void>> {
  /**
   * 验证 InStreet 注册挑战题。
   * 
   * 前置条件:
   * 1. pendingChallenge 必须存在（之前调用 register 成功）
   * 2. 当前时间必须在验证窗口期内（5分钟）
   * 
   * 副作用:
   * - 成功后：凭据状态变为 active，清除 pendingChallenge
   * - 失败后：状态保持 pending_verification，允许重试直到超时
   * - 超时后：状态变为 failed，需重新注册
   */
  
  // Step 1: 状态检查
  if (!this.pendingChallenge) {
    return ConnectorResult.terminalFailure(
      { type: 'CHALLENGE_FAILED', message: 'No pending challenge. Call register() first.' },
      { platformId: this.platformId }
    );
  }
  
  // Step 2: 超时检查
  const now = Date.now();
  if (now > this.pendingChallenge.expiresAt) {
    // 标记为失败状态
    await this.credentialManager.updateStatus(
      this.platformId, 
      'failed',
      'Verification timeout'
    );
    this.pendingChallenge = undefined;
    
    return ConnectorResult.terminalFailure(
      { type: 'CHALLENGE_FAILED', message: 'Challenge expired. Please register again.' },
      { platformId: this.platformId }
    );
  }
  
  // Step 3: 调用验证 API
  const remainingTime = this.pendingChallenge.expiresAt - now;
  const timeout = Math.min(remainingTime, 10000);  // 最多等10秒
  
  const result = await this.httpAdapter.execute({
    action: 'verify',
    params: {
      verification_code: this.pendingChallenge.challenge,
      answer: answer,
    },
    metadata: { timeout },
  });
  
  // Step 4: 处理结果
  if (!result.success) {
    // 区分可重试和不可重试错误
    if (result.error?.platformCode === 'INVALID_ANSWER') {
      // 答案错误，但还有时间，可以重试
      return ConnectorResult.retryableFailure(
        { 
          type: 'CHALLENGE_FAILED', 
          message: 'Incorrect answer. Try again.',
          retryAfterSeconds: 1  // 立即重试
        },
        { platformId: this.platformId, latencyMs: result.metadata.latencyMs }
      );
    }
    
    // 其他错误（网络、服务端等）
    return this.wrapAdapterError(result);
  }
  
  // Step 5: 验证成功，更新状态
  this.pendingChallenge = undefined;
  await this.credentialManager.markAsVerified(this.platformId);
  
  // 触发事件通知 control-plane
  this.eventEmitter.emit('credential:verified', {
    platformId: this.platformId,
    timestamp: now(),
  });
  
  return ConnectorResult.success(
    undefined,
    { platformId: this.platformId, latencyMs: result.metadata.latencyMs }
  );
}
```

> **注意事项**: 
> - 必须在验证窗口期内完成，否则需重新注册
> - 答案错误可重试，但需记录重试次数防止暴力破解
> - 成功后触发事件，让 control-plane 恢复会话

### §3.1.1 InStreetConnector.rehydratePendingChallenge()

**对应契约**: L0 §5.4 — 验证态恢复契约  
**准入理由**: 解决 AI 会话重启后的验证上下文丢失

```typescript
async function rehydratePendingChallenge(): Promise<void> {
  /**
   * 从 state-system 恢复 pending challenge。
   *
   * 调用时机: connector 初始化阶段
   */

  const credential = await this.credentialManager.getCredential(this.platformId);
  if (!credential) return;

  if (credential.metadata.status !== 'pending_verification') return;

  const challenge = credential.platformSpecific.verificationChallenge;
  const deadline = credential.platformSpecific.verificationDeadline;

  // 元数据不完整: 直接标 failed，避免“假 pending”
  if (!challenge || !deadline) {
    await this.credentialManager.updateStatus(
      this.platformId,
      'failed',
      'missing_verification_context'
    );
    return;
  }

  // 已过期: 不再尝试验证
  if (Date.now() > deadline) {
    await this.credentialManager.updateStatus(
      this.platformId,
      'failed',
      'verification_deadline_expired'
    );
    return;
  }

  this.pendingChallenge = {
    challenge,
    expiresAt: deadline,
  };

  this.eventEmitter.emit('credential:verification_rehydrated', {
    platformId: this.platformId,
    expiresAt: deadline,
    timestamp: now(),
  });
}
```

---

### §3.2 EvoMapConnector.buildA2AEnvelope()

**对应契约**: L0 §5.3.2 — A2A envelope 构造  
**准入理由**: 含多步骤副作用链（构造 → 签名 → 序列化）

```typescript
private buildA2AEnvelope<T extends A2APayload>(
  messageType: A2AMessageType,
  payload: T
): A2AEnvelope<T> {
  /**
   * 构造 EvoMap A2A 协议信封。
   * 
   * 前置条件:
   * 1. nodeId 必须已注册（this.nodeId 不为空）
   * 2. 对于非 hello 消息，sender_id 必须是 nodeId
   * 
   * 副作用: 无（纯函数）
   */
  
  // Step 1: 生成唯一 message_id
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const messageId = `msg_${timestamp}_${randomSuffix}`;
  
  // Step 2: 构造 envelope
  const envelope: A2AEnvelope<T> = {
    protocol: 'gep-a2a',
    protocol_version: PLATFORM_CONFIG.evomap.protocolVersion,
    message_type: messageType,
    message_id: messageId,
    sender_id: this.nodeId!,  // 首次 hello 时可能为空
    timestamp: new Date().toISOString(),
    payload,
  };
  
  // Step 3: 验证 sender_id（非 hello 消息）
  if (messageType !== 'hello' && !envelope.sender_id) {
    throw new ProtocolError('sender_id required for non-hello messages');
  }
  
  // Step 4: 序列化检查（预防性）
  try {
    JSON.stringify(envelope);
  } catch (e) {
    throw new ProtocolError(`Envelope serialization failed: ${e.message}`);
  }
  
  return envelope;
}
```

> **注意事项**:
> - sender_id 在首次 hello 时为空，由 Hub 分配
> - 后续所有消息必须使用 Hub 返回的 nodeId
> - 切勿使用 hub_node_id 作为 sender_id（会导致 403 错误）

---

### §3.3 HttpAdapter.execute()

**对应契约**: L0 §3.2 — Adapter 执行  
**准入理由**: 含不明显的业务规则（超时计算、错误映射）

```typescript
async function execute<T>(request: AdapterRequest): Promise<AdapterResult<T>> {
  /**
   * 执行 HTTP 请求，处理超时和错误映射。
   */
  
  const startTime = Date.now();
  const timeout = request.metadata?.timeout || TIMEOUT_CONFIG.http.read;
  
  try {
    // Step 1: 构造请求
    const response = await fetch(this.buildUrl(request.action), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
        'X-Request-ID': generateRequestId(),
      },
      body: JSON.stringify(request.params),
      signal: AbortSignal.timeout(timeout),
    });
    
    // Step 2: 处理 HTTP 状态码
    if (!response.ok) {
      const errorBody = await response.text();
      return this.mapHttpError(response.status, errorBody, startTime);
    }
    
    // Step 3: 解析响应
    const data = await response.json();
    
    // Step 4: 验证响应格式（使用 Zod）
    const validated = this.responseSchema.safeParse(data);
    if (!validated.success) {
      return {
        success: false,
        error: {
          type: 'PROTOCOL_ERROR',
          message: `Invalid response format: ${validated.error.message}`,
        },
        metadata: {
          executionChannel: 'http',
          latencyMs: Date.now() - startTime,
        },
      };
    }
    
    // Step 5: 返回成功
    return {
      success: true,
      data: validated.data,
      metadata: {
        executionChannel: 'http',
        latencyMs: Date.now() - startTime,
        platformCode: response.headers.get('X-Platform-Code') || undefined,
      },
    };
    
  } catch (error) {
    // Step 6: 异常分类
    if (error.name === 'TimeoutError') {
      return {
        success: false,
        error: { type: 'NETWORK_TIMEOUT', message: `Request timeout after ${timeout}ms` },
        metadata: { executionChannel: 'http', latencyMs: timeout },
      };
    }
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: { type: 'NETWORK_ERROR', message: 'Request aborted' },
        metadata: { executionChannel: 'http', latencyMs: Date.now() - startTime },
      };
    }
    
    // 未知错误
    return {
      success: false,
      error: { type: 'UNKNOWN', message: error.message },
      metadata: { executionChannel: 'http', latencyMs: Date.now() - startTime },
    };
  }
}

private mapHttpError(status: number, body: string, startTime: number): AdapterResult<never> {
  const latencyMs = Date.now() - startTime;
  
  // 解析错误体
  let platformCode: string | undefined;
  let retryAfter: number | undefined;
  
  try {
    const parsed = JSON.parse(body);
    platformCode = parsed.code || parsed.error?.code;
    retryAfter = parsed.retry_after_seconds || parsed.retryAfter;
  } catch {
    // 解析失败，使用原始 body
  }
  
  // 状态码映射
  const errorMap: Record<number, { type: PlatformError; defaultMessage: string }> = {
    400: { type: 'PROTOCOL_ERROR', defaultMessage: 'Bad request' },
    401: { type: 'AUTH_FAILED', defaultMessage: 'Authentication failed' },
    403: { type: 'AUTH_FAILED', defaultMessage: 'Forbidden' },
    429: { type: 'RATE_LIMITED', defaultMessage: 'Rate limited' },
    500: { type: 'PLATFORM_UNAVAILABLE', defaultMessage: 'Platform server error' },
    502: { type: 'PLATFORM_UNAVAILABLE', defaultMessage: 'Bad gateway' },
    503: { type: 'PLATFORM_UNAVAILABLE', defaultMessage: 'Service unavailable' },
  };
  
  const mapped = errorMap[status] || { type: 'UNKNOWN', defaultMessage: `HTTP ${status}` };
  
  return {
    success: false,
    error: {
      type: mapped.type,
      message: mapped.defaultMessage,
      platformCode,
      retryAfterSeconds: retryAfter,
    },
    metadata: {
      executionChannel: 'http',
      latencyMs,
      platformCode,
    },
  };
}
```

### §3.4 EndpointModeGuard.resolveMode()

**对应契约**: L0 §5.3 — 执行通道模式矩阵  
**准入理由**: 防止 EvoMap A2A/REST 端点混用导致系统性 4xx

```typescript
export type EndpointMode = 'A2A_ENVELOPE_REQUIRED' | 'REST_JSON_REQUIRED';

const ENDPOINT_MODE_MAP: Array<{ pattern: RegExp; mode: EndpointMode }> = [
  { pattern: /^\/a2a\/(hello|fetch|publish|validate|report|decision|revoke)$/i, mode: 'A2A_ENVELOPE_REQUIRED' },
  { pattern: /^\/a2a\/heartbeat$/i, mode: 'REST_JSON_REQUIRED' },
  { pattern: /^\/task\//i, mode: 'REST_JSON_REQUIRED' },
  { pattern: /^\/a2a\/work\//i, mode: 'REST_JSON_REQUIRED' },
];

function resolveEndpointMode(path: string): EndpointMode {
  const matched = ENDPOINT_MODE_MAP.find(rule => rule.pattern.test(path));
  return matched?.mode ?? 'REST_JSON_REQUIRED';
}

function assertRequestMode(path: string, body: unknown): void {
  const mode = resolveEndpointMode(path);
  const hasA2AEnvelope = Boolean(
    body &&
    typeof body === 'object' &&
    'protocol' in (body as Record<string, unknown>) &&
    'message_type' in (body as Record<string, unknown>)
  );

  if (mode === 'A2A_ENVELOPE_REQUIRED' && !hasA2AEnvelope) {
    throw new ProtocolError(`Endpoint ${path} requires A2A envelope`);
  }

  if (mode === 'REST_JSON_REQUIRED' && hasA2AEnvelope) {
    throw new ProtocolError(`Endpoint ${path} requires plain REST JSON body`);
  }
}
```

---

## §4 决策树

### §4.1 凭据状态流转决策

**对应 L0 Mermaid**: `connector-system.md` §6.2

```typescript
function decideCredentialTransition(
  currentStatus: CredentialStatus,
  event: CredentialEvent
): CredentialStatus | null {
  /**
   * 决定凭据状态流转。
   * null 表示无流转（保持当前状态）。
   */
  
  const transitions: Record<CredentialStatus, Record<CredentialEventType, CredentialStatus | null>> = {
    unregistered: {
      register_started: 'pending_verification',
      register_complete: 'active',
      register_failed: 'failed',
      verify_required: 'pending_verification',
    },
    
    pending_verification: {
      verify_success: 'active',
      verify_failed: null,  // 保持 pending，允许重试
      verify_timeout: 'failed',
      user_cancel: 'failed',
    },
    
    active: {
      refresh_success: 'active',
      refresh_failed: 'expired',
      user_revoke: 'revoked',
      platform_revoke: 'revoked',
    },
    
    expired: {
      refresh_success: 'active',
      refresh_failed: 'failed',
      user_revoke: 'revoked',
    },
    
    failed: {
      retry_register: 'unregistered',
      user_abandon: null,  // 终态
    },
    
    revoked: {
      // 终态，无流转
    },
  };
  
  const nextStatus = transitions[currentStatus]?.[event.type];
  
  // 特殊处理：pending_verification 超时检查
  if (currentStatus === 'pending_verification' && event.type === 'verify_failed') {
    if (event.metadata?.isTimeout) {
      return 'failed';
    }
  }
  
  return nextStatus ?? null;
}
```

---

## §5 边缘情况

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| InStreet 验证挑战 5分钟内未完成 | 账号无法激活，需重新注册 | 超时检查 + 自动标记 failed |
| EvoMap A2A envelope sender_id 误用 hub_node_id | 403 错误，节点被封禁 | 构造时强制检查 sender_id != hub_node_id |
| CLI 输出解析失败 | 无法获取结果，状态未知 | 解析失败时返回 UNKNOWN 错误，不猜测 |
| 凭据解密失败（主密码错误） | 无法访问平台 | 返回 AUTH_FAILED，提示用户验证主密码 |
| 平台返回非 JSON 错误体 | 无法解析具体错误 | 使用 HTTP 状态码映射，原始 body 放入 context |
| 并发初始化同一平台 | 重复注册，凭据覆盖 | 使用 Promise 缓存，确保单实例 |
| AI 会话重启后凭据状态不一致 | 重复验证或跳过验证 | 每次初始化从 state 读取最新状态 |

### §5.1 CLI 输出解析陷阱

```typescript
// ❌ 错误做法：直接 JSON.parse 可能失败
// const result = JSON.parse(stdout);

// ✅ 正确做法：多层容错
function parseCliOutput(stdout: string, stderr: string, exitCode: number): AdapterResult<unknown> {
  // 首先检查退出码
  if (exitCode !== 0) {
    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        message: `CLI exited with code ${exitCode}: ${stderr}`,
      },
      metadata: { executionChannel: 'cli', latencyMs: 0 },
    };
  }
  
  // 尝试解析 stdout
  try {
    const lines = stdout.trim().split('\n');
    // 有些 CLI 输出多行日志，最后一行才是 JSON
    const lastLine = lines[lines.length - 1];
    const data = JSON.parse(lastLine);
    return {
      success: true,
      data,
      metadata: { executionChannel: 'cli', latencyMs: 0 },
    };
  } catch {
    // 解析失败，返回原始输出
    return {
      success: false,
      error: {
        type: 'PROTOCOL_ERROR',
        message: `Failed to parse CLI output: ${stdout.substring(0, 200)}`,
      },
      metadata: { executionChannel: 'cli', latencyMs: 0 },
    };
  }
}
```

---

## §6 测试辅助

### 6.1 工厂函数

```typescript
// 创建测试用凭据
export function makeTestCredential(
  overrides: Partial<EncryptedCredential> = {}
): EncryptedCredential {
  return {
    platformId: 'test-platform',
    type: 'api_key',
    encryptedValue: {
      ciphertext: 'dGVzdC1jaXBoZXJ0ZXh0',
      iv: 'dGVzdC1pdg==',
      tag: 'dGVzdC10YWc=',
      salt: 'dGVzdC1zYWx0',
    },
    metadata: {
      createdAt: '2026-03-22T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
      status: 'active',
    },
    platformSpecific: {},
    ...overrides,
  };
}

// 创建测试用 ConnectorResult
export function makeTestSuccessResult<T>(data: T): ConnectorResult<T> {
  return ConnectorResult.success(data, {
    platformId: 'test-platform',
    latencyMs: 100,
  });
}

export function makeTestRetryableError(message: string): ConnectorResult<never> {
  return ConnectorResult.retryableFailure(
    { type: 'RATE_LIMITED', message, retryAfterSeconds: 60 },
    { platformId: 'test-platform', latencyMs: 50 }
  );
}

// Mock Adapter
export class MockAdapter implements ExecutionAdapter {
  readonly type = 'http';
  private responses: Map<string, AdapterResult<unknown>> = new Map();
  
  setResponse(action: string, result: AdapterResult<unknown>): void {
    this.responses.set(action, result);
  }
  
  async execute<T>(request: AdapterRequest): Promise<AdapterResult<T>> {
    const response = this.responses.get(request.action);
    if (!response) {
      throw new Error(`No mock response for action: ${request.action}`);
    }
    return response as AdapterResult<T>;
  }
  
  async healthCheck(): Promise<boolean> {
    return true;
  }
}
```

### 6.2 测试用例模板

```typescript
describe('InStreetConnector', () => {
  let connector: InStreetConnector;
  let mockAdapter: MockAdapter;
  let mockCredentialManager: MockCredentialManager;
  
  beforeEach(() => {
    mockAdapter = new MockAdapter();
    mockCredentialManager = new MockCredentialManager();
    connector = new InStreetConnector(mockAdapter, mockCredentialManager);
  });
  
  describe('verifyChallenge', () => {
    it('should succeed with correct answer within time window', async () => {
      // Arrange
      mockAdapter.setResponse('verify', makeTestSuccessResult({ verified: true }));
      
      // Act
      const result = await connector.verifyChallenge('42');
      
      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(mockCredentialManager.getStatus('instreet')).toBe('active');
    });
    
    it('should fail when verification window expires', async () => {
      // Arrange: 模拟超时
      const oldChallenge = {
        challenge: 'test',
        expiresAt: Date.now() - 1000,  // 已过期
      };
      connector.setPendingChallenge(oldChallenge);
      
      // Act
      const result = await connector.verifyChallenge('42');
      
      // Assert
      expect(result.status).toBe('terminal_failure');
      expect(result.error?.type).toBe('CHALLENGE_FAILED');
    });
  });
});
```
