-- ========================================================================
-- 数据库初始化脚本
-- 这个文件定义了我们网站需要的所有数据表结构
-- ========================================================================

-- ========================================================================
-- 用户表：存储所有用户的基本信息
-- ========================================================================
CREATE TABLE user (
    id INTEGER NOT NULL PRIMARY KEY,  -- 用户的唯一标识符(数字)，主键
    email TEXT NOT NULL UNIQUE,       -- 用户的电子邮箱地址，必须唯一
    username TEXT NOT NULL,           -- 用户名
    password_hash TEXT NOT NULL,      -- 密码的哈希值(加密后的密码)，不存储原始密码
    email_verified INTEGER NOT NULL DEFAULT 0,  -- 电子邮箱是否已验证：0表示未验证，1表示已验证
    totp_key BLOB,                   -- 双因素认证的密钥，可以为空(表示用户未设置双因素认证)
    recovery_code BLOB NOT NULL      -- 账号恢复码，用于在无法使用双因素认证时恢复账号
);

-- 创建邮箱索引，加速通过邮箱查询用户的速度
CREATE INDEX email_index ON user(email);

-- ========================================================================
-- 会话表：记录用户的登录状态
-- ========================================================================
CREATE TABLE session (
    id TEXT NOT NULL PRIMARY KEY,     -- 会话的唯一标识符
    user_id INTEGER NOT NULL REFERENCES user(id),  -- 关联到用户表的用户ID
    expires_at INTEGER NOT NULL,      -- 会话过期时间(时间戳)
    two_factor_verified INTEGER NOT NULL DEFAULT 0  -- 是否已完成双因素认证：0表示未完成，1表示已完成
);

-- ========================================================================
-- 电子邮箱验证请求表：存储邮箱验证的相关信息
-- ========================================================================
CREATE TABLE email_verification_request (
    id TEXT NOT NULL PRIMARY KEY,     -- 验证请求的唯一标识符
    user_id INTEGER NOT NULL REFERENCES user(id),  -- 关联到用户表的用户ID
    email TEXT NOT NULL,              -- 需要验证的电子邮箱地址
    code TEXT NOT NULL,               -- 验证码
    expires_at INTEGER NOT NULL       -- 验证请求的过期时间(时间戳)
);

-- ========================================================================
-- 密码重置会话表：存储密码重置流程的相关信息
-- ========================================================================
CREATE TABLE password_reset_session (
    id TEXT NOT NULL PRIMARY KEY,     -- 密码重置会话的唯一标识符
    user_id INTEGER NOT NULL REFERENCES user(id),  -- 关联到用户表的用户ID
    email TEXT NOT NULL,              -- 用户的电子邮箱地址
    code TEXT NOT NULL,               -- 验证码
    expires_at INTEGER NOT NULL,      -- 重置会话的过期时间(时间戳)
    email_verified INTEGER NOT NULL DEFAULT 0,  -- 是否已验证邮箱：0表示未验证，1表示已验证
    two_factor_verified INTEGER NOT NULL DEFAULT 0  -- 是否已完成双因素认证：0表示未完成，1表示已完成
);

-- ========================================================================
-- 数据表关系说明:
-- 1. user表是核心表，存储所有用户信息
-- 2. session表记录用户的登录状态，每个session关联到一个用户
-- 3. email_verification_request表用于邮箱验证流程，关联到用户
-- 4. password_reset_session表用于密码重置流程，关联到用户
--
-- 举例说明:
-- 当小明注册账号时，会在user表中添加一条记录
-- 当小明登录时，会在session表中添加一条记录，关联到小明的用户ID
-- 当小明需要验证邮箱时，会在email_verification_request表中添加一条记录
-- 当小明忘记密码时，会在password_reset_session表中添加一条记录进行密码重置
-- ========================================================================