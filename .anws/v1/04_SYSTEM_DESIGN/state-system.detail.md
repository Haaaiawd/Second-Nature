# State System — 实现细节 (L1)

> **对应 L0**: [state-system.md](./state-system.md)

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
export const CRYPTO_CONFIG = {
  // 加密算法
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32,                    // 256 bits
  ivLength: 16,                     // 128 bits
  tagLength: 16,                    // 128 bits
  
  // PBKDF2 密钥派生
  pbkdf2: {
    iterations: 100000,             // 100k 迭代
    saltLength: 32,                 // 256 bits
    digest: 'sha256' as const,
  },
} as const;

export const STORAGE_CONFIG = {
  // 数据库配置
  dbPath: './data/state.db',
  busyTimeout: 5000,                // 5s 超时
  
  // 性能配置
  cacheSize: 10000,                 // 页缓存大小
  journalMode: 'WAL' as const,      // WAL 模式
  synchronous: 'NORMAL' as const,
} as const;

export const BACKUP_CONFIG = {
  // 备份配置
  format: 'json.enc' as const,      // 加密 JSON
  compression: false,               // 首版不压缩
  maxBackups: 10,                   // 保留最近10个备份
} as const;
```

---

## §2 数据结构

### 2.1 PlatformCredential（加密存储）

```typescript
export interface EncryptedCredential {
  platformId: string;
  
  // 凭据类型（影响解密后如何使用）
  type: 'api_key' | 'node_secret' | 'oauth_token';
  
  // 加密后的值（包含 IV 和 auth tag）
  encryptedValue: {
    ciphertext: Base64String;       // 加密数据
    iv: Base64String;              // 初始化向量
    tag: Base64String;             // GCM auth tag
    salt: Base64String;            // PBKDF2 salt
  };
  
  // 明文元数据
  metadata: {
    createdAt: ISO8601String;
    updatedAt: ISO8601String;
    expiresAt?: ISO8601String;
    lastUsedAt?: ISO8601String;
    // 统一状态枚举：包含 failed 以支持 connector 状态流转
    status: 'unregistered' | 'pending_verification' | 'active' | 'expired' | 'revoked' | 'failed';
  };
  
  // 平台特有（明文）
  platformSpecific: {
    // EvoMap
    nodeId?: string;               
    claimUrl?: string;             
    claimUsed?: boolean;
    
    // InStreet
    username?: string;             
    verificationChallenge?: string; 
    verificationDeadline?: number;   // 时间戳，用于超时检查
  };
}

export interface DecryptedCredential {
  platformId: string;
  type: 'api_key' | 'node_secret' | 'oauth_token';
  value: string;                    // 解密后的凭据值
  metadata: EncryptedCredential['metadata'];
  platformSpecific: EncryptedCredential['platformSpecific'];
}
```

### 2.2 ExplorationSession（持久化模型）

> **运行时模型定义于**: [control-plane-system.detail.md §2.1](./control-plane-system.detail.md)
> 
> 本模型是运行时模型的持久化投影，支持 AI 会话间状态恢复。

```typescript
export interface ExplorationSession {
  // 基础信息
  id: string;                       // UUID
  platformId: string;
  state: ExplorationState;
  
  // 时间
  startTime: ISO8601String;
  endTime?: ISO8601String;
  
  // 预算快照（与运行时模型一致）
  budgetSnapshot: {
    globalRemaining: number;
    platformRemaining: number;
    interactionsRemaining: number;
  };
  
  // 动作链（JSON 序列化，与运行时 SessionAction[] 对应）
  actionsJson: string;
  
  // 反思结果（JSON 序列化，与运行时 ReflectionResult 对应）
  reflectionJson?: string;
  
  // 会话上下文（JSON 序列化，用于状态恢复）
  // 包含：选择理由、平台评分、用户目标等
  contextJson: string;
  
  // 版本号（用于迁移）
  schemaVersion: number;
  
  // 创建/更新时间
  createdAt: ISO8601String;
  updatedAt: ISO8601String;
}

// 序列化/反序列化契约
export const SessionSerializer = {
  version: 1,
  
  serializeRuntime(runtime: RuntimeExplorationSession): ExplorationSession {
    return {
      id: runtime.id,
      platformId: runtime.platformId,
      state: runtime.state,
      startTime: runtime.startTime,
      endTime: runtime.endTime,
      budgetSnapshot: runtime.budgetSnapshot,
      actionsJson: JSON.stringify(runtime.actions),
      reflectionJson: runtime.reflection ? JSON.stringify(runtime.reflection) : undefined,
      contextJson: JSON.stringify(runtime.context),
      schemaVersion: this.version,
      createdAt: runtime.startTime,
      updatedAt: new Date().toISOString(),
    };
  },
  
  deserializeToRuntime(persisted: ExplorationSession): RuntimeExplorationSession {
    // 版本检查
    if (persisted.schemaVersion !== this.version) {
      throw new SchemaVersionError(
        `Session schema version mismatch: expected ${this.version}, got ${persisted.schemaVersion}`
      );
    }
    
    return {
      id: persisted.id,
      platformId: persisted.platformId,
      state: persisted.state,
      startTime: persisted.startTime,
      endTime: persisted.endTime,
      budgetSnapshot: persisted.budgetSnapshot,
      actions: JSON.parse(persisted.actionsJson),
      reflection: persisted.reflectionJson ? JSON.parse(persisted.reflectionJson) : undefined,
      context: JSON.parse(persisted.contextJson),
    };
  },
};
```

### 2.3 LongTermMemory

```typescript
export interface LongTermMemory {
  id: string;
  type: 'session_summary' | 'insight' | 'preference';
  
  // 内容
  content: string;
  summary?: string;
  
  // 来源
  sourceSessionId?: string;
  sourcePlatformId?: string;
  
  // 时间
  createdAt: ISO8601String;
  expiresAt?: ISO8601String;        // 可选过期
  
  // 向量嵌入（可选，用于语义检索）
  embedding?: number[];
}
```

---

## §3 核心算法

### §3.1 EncryptionService.encrypt()

**对应契约**: L0 §5.1 — `setCredential()`  
**准入理由**: 含不明显的业务规则（GCM 加密流程）

```typescript
function encryptCredential(
  plaintext: string,
  masterPassword: string
): EncryptedCredential['encryptedValue'] {
  /**
   * 使用 AES-256-GCM 加密凭据。
   * 
   * 流程:
   * 1. 生成随机 salt
   * 2. PBKDF2 派生密钥
   * 3. 生成随机 IV
   * 4. AES-GCM 加密
   * 5. 返回 ciphertext + iv + tag + salt
   */
  
  // Step 1: 生成 salt
  const salt = crypto.randomBytes(CRYPTO_CONFIG.pbkdf2.saltLength);
  
  // Step 2: 派生密钥
  const key = crypto.pbkdf2Sync(
    masterPassword,
    salt,
    CRYPTO_CONFIG.pbkdf2.iterations,
    CRYPTO_CONFIG.keyLength,
    CRYPTO_CONFIG.pbkdf2.digest
  );
  
  // Step 3: 生成 IV
  const iv = crypto.randomBytes(CRYPTO_CONFIG.ivLength);
  
  // Step 4: 加密
  const cipher = crypto.createCipheriv(
    CRYPTO_CONFIG.algorithm,
    key,
    iv
  );
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  // Step 5: 获取 auth tag
  const tag = cipher.getAuthTag();
  
  // Step 6: 返回
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64'),
  };
}
```

> **注意事项**: salt 必须随机且每次不同，不能硬编码

---

### §3.2 EncryptionService.decrypt()

**对应契约**: L0 §5.1 — `getCredential()`

```typescript
function decryptCredential(
  encrypted: EncryptedCredential['encryptedValue'],
  masterPassword: string
): string {
  /**
   * 解密凭据。
   * 
   * 前置条件: masterPassword 必须正确
   * 副作用: 无（纯函数）
   */
  
  // Step 1: 解码 base64
  const salt = Buffer.from(encrypted.salt, 'base64');
  const iv = Buffer.from(encrypted.iv, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  
  // Step 2: 派生密钥（同样的 salt 和参数）
  const key = crypto.pbkdf2Sync(
    masterPassword,
    salt,
    CRYPTO_CONFIG.pbkdf2.iterations,
    CRYPTO_CONFIG.keyLength,
    CRYPTO_CONFIG.pbkdf2.digest
  );
  
  // Step 3: 创建 decipher
  const decipher = crypto.createDecipheriv(
    CRYPTO_CONFIG.algorithm,
    key,
    iv
  );
  decipher.setAuthTag(tag);
  
  // Step 4: 解密
  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch (error) {
    // Auth tag 验证失败（密码错误或数据篡改）
    throw new DecryptionError('Invalid master password or corrupted data');
  }
}
```

> **注意事项**: 捕获所有错误并归类为 DecryptionError，不暴露内部细节

---

### §3.3 StateManager.getCredential()

**对应契约**: L0 §5.1 — 凭据读取

```typescript
async function getCredential(
  platformId: string,
  masterPassword: string
): Promise<DecryptedCredential | null> {
  /**
   * 读取并解密凭据。
   * 
   * 副作用: 更新 lastUsedAt
   */
  
  // Step 1: 读取加密数据
  const row = await db.query(
    'SELECT * FROM credentials WHERE platform_id = ?',
    [platformId]
  );
  
  if (!row) {
    return null;
  }
  
  // Step 2: 解析元数据
  const metadata = JSON.parse(row.metadata);
  const platformSpecific = JSON.parse(row.platform_specific || '{}');
  
  // Step 3: 解密（可能抛出错误）
  const encryptedValue = JSON.parse(row.encrypted_value);
  const value = decryptCredential(encryptedValue, masterPassword);
  
  // Step 4: 更新 lastUsedAt（异步，不阻塞返回）
  const now = new Date().toISOString();
  db.exec(
    'UPDATE credentials SET metadata = json_set(metadata, "$.lastUsedAt", ?) WHERE platform_id = ?',
    [now, platformId]
  ).catch(err => logger.warn('Failed to update lastUsedAt:', err));
  
  return {
    platformId,
    value,
    metadata,
    platformSpecific,
  };
}
```

---

## §4 决策树

### §4.1 备份策略选择

**对应 L0**: 数据导出流程

```typescript
function decideBackupStrategy(): BackupStrategy {
  /**
   * 决定备份策略。
   */
  
  const dbSize = getDatabaseSize();
  const maxSize = 50 * 1024 * 1024;  // 50MB
  
  if (dbSize > maxSize) {
    // 数据库过大，警告用户
    return {
      type: 'full',
      warning: 'Database size exceeds 50MB, backup may take longer',
      compression: true,  // 强制压缩
    };
  }
  
  // 正常备份
  return {
    type: 'full',
    compression: BACKUP_CONFIG.compression,
  };
}
```

---

## §5 边缘情况

| 场景 | 风险 | 处理方式 |
| ---- | ---- | -------- |
| 主密码错误 | 无法解密 | 抛出 DecryptionError，提示用户验证 |
| 数据库文件损坏 | 数据丢失 | 从备份恢复，或重新开始 |
| 并发写入冲突 | 数据不一致 | WAL 模式，事务隔离 |
| 凭据解密后内存残留 | 安全风险 | 使用 Buffer，使用后手动清零 |
| 备份文件丢失 | 无法恢复 | 保留最近 10 个备份，定期导出 |
| 密码忘记 | 永久丢失 | 明确提示用户：无法恢复 |

### §5.1 内存安全处理

```typescript
// ❌ 错误：密码明文存储在内存
// const password = getPassword();

// ✅ 正确：使用 Buffer，及时清零
function securePasswordInput(): Buffer {
  const password = readPasswordHidden();  // 隐藏输入
  const buffer = Buffer.from(password);
  
  // 使用后清零
  function cleanup() {
    buffer.fill(0);
  }
  
  try {
    // 使用密码...
    const result = usePassword(buffer);
    return result;
  } finally {
    cleanup();
  }
}
```

---

## §6 测试辅助

```typescript
// 创建测试用加密凭据
export function makeTestEncryptedCredential(
  masterPassword: string = 'test-password'
): EncryptedCredential {
  const plaintext = 'test-api-key-12345';
  const encryptedValue = encryptCredential(plaintext, masterPassword);
  
  return {
    platformId: 'test-platform',
    encryptedValue,
    metadata: {
      createdAt: '2026-03-22T00:00:00Z',
      updatedAt: '2026-03-22T00:00:00Z',
      status: 'active',
    },
    platformSpecific: {},
  };
}

// 测试加密/解密往返
export function testEncryptDecryptRoundtrip(): void {
  const password = 'my-secure-password';
  const plaintext = 'secret-api-key';
  
  // 加密
  const encrypted = encryptCredential(plaintext, password);
  
  // 解密
  const decrypted = decryptCredential(encrypted, password);
  
  // 验证
  assert.strictEqual(decrypted, plaintext);
  
  // 错误密码应该失败
  assert.throws(() => {
    decryptCredential(encrypted, 'wrong-password');
  }, DecryptionError);
}

// Mock 数据库
export class MockStorage {
  private data = new Map<string, unknown>();
  
  async get(key: string): Promise<unknown | null> {
    return this.data.get(key) ?? null;
  }
  
  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
  
  clear(): void {
    this.data.clear();
  }
}
```
