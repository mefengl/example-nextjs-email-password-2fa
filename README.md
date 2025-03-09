# Email and password example with 2FA in Next.js

> 这是给 [lucia-auth](https://github.com/lucia-auth/lucia) 官方的样例加上了详细文档和行内注释的版本，建议配合 [lucia-auth 官方文档](https://lucia-auth.com/) 食用。

## 阅读顺序

### 数据库与核心功能

1. [`setup.sql`](./setup.sql) - 数据库表结构和初始化
2. [`lib/server/db.ts`](./lib/server/db.ts) - 数据库连接与操作封装
3. [`lib/server/utils.ts`](./lib/server/utils.ts) - 通用工具函数
4. [`lib/server/encryption.ts`](./lib/server/encryption.ts) - 数据加密相关功能

### 用户认证核心

5. [`lib/server/user.ts`](./lib/server/user.ts) - 用户管理（创建、查询、验证）
6. [`lib/server/email.ts`](./lib/server/email.ts) - 邮件发送服务
7. [`lib/server/password.ts`](./lib/server/password.ts) - 密码管理（哈希、验证、重置）
8. [`lib/server/session.ts`](./lib/server/session.ts) - 会话管理（创建、验证、销毁）

### 扩展功能

9. [`lib/server/email-verification.ts`](./lib/server/email-verification.ts) - 邮箱验证功能
10. [`lib/server/password-reset.ts`](./lib/server/password-reset.ts) - 密码重置流程
11. [`lib/server/2fa.ts`](./lib/server/2fa.ts) - 双因素认证实现
12. [`lib/server/rate-limit.ts`](./lib/server/rate-limit.ts) - 请求限流机制
13. [`lib/server/request.ts`](./lib/server/request.ts) - 请求处理工具

### 应用流程与页面

14. [`app/actions.ts`](./app/actions.ts) - 主要应用级别动作
15. [`app/components.tsx`](./app/components.tsx) - 共享组件
16. [`app/page.tsx`](./app/page.tsx) - 主页面
17. [`app/layout.tsx`](./app/layout.tsx) - 应用布局

### 功能页面模块

18. [`app/signup/`](./app/signup/) - 注册流程
    - [`actions.ts`](./app/signup/actions.ts) - 注册相关操作
    - [`components.tsx`](./app/signup/components.tsx) - 注册页组件
    - [`page.tsx`](./app/signup/page.tsx) - 注册页面

19. [`app/login/`](./app/login/) - 登录流程
    - [`actions.ts`](./app/login/actions.ts) - 登录相关操作
    - [`components.tsx`](./app/login/components.tsx) - 登录页组件
    - [`page.tsx`](./app/login/page.tsx) - 登录页面

20. [`app/2fa/`](./app/2fa/) - 双因素认证
    - [`actions.ts`](./app/2fa/actions.ts) - 2FA相关操作
    - [`components.tsx`](./app/2fa/components.tsx) - 2FA组件
    - [`page.tsx`](./app/2fa/page.tsx) - 2FA页面
    - [`setup/`](./app/2fa/setup/) - 2FA设置
    - [`reset/`](./app/2fa/reset/) - 2FA重置

21. [`app/verify-email/`](./app/verify-email/) - 邮箱验证
    - [`actions.ts`](./app/verify-email/actions.ts) - 邮箱验证操作
    - [`components.tsx`](./app/verify-email/components.tsx) - 邮箱验证组件
    - [`page.tsx`](./app/verify-email/page.tsx) - 邮箱验证页面

22. [`app/forgot-password/`](./app/forgot-password/) - 忘记密码
    - [`actions.ts`](./app/forgot-password/actions.ts) - 忘记密码操作
    - [`components.tsx`](./app/forgot-password/components.tsx) - 忘记密码组件
    - [`page.tsx`](./app/forgot-password/page.tsx) - 忘记密码页面

23. [`app/reset-password/`](./app/reset-password/) - 密码重置
    - [`actions.ts`](./app/reset-password/actions.ts) - 密码重置操作
    - [`components.tsx`](./app/reset-password/components.tsx) - 密码重置组件
    - [`page.tsx`](./app/reset-password/page.tsx) - 密码重置页面

24. [`app/settings/`](./app/settings/) - 用户设置
    - [`actions.ts`](./app/settings/actions.ts) - 设置操作
    - [`components.tsx`](./app/settings/components.tsx) - 设置组件
    - [`page.tsx`](./app/settings/page.tsx) - 设置页面

25. [`app/recovery-code/`](./app/recovery-code/) - 恢复码功能
    - [`page.tsx`](./app/recovery-code/page.tsx) - 恢复码页面

## 使用 msmtpd 邮件服务

在这个项目中集成 SMTP 邮件服务（通过 msmtpd 或其他 SMTP 服务），需要修改以下配置：

### 1. 环境变量配置

在项目根目录创建或修改 `.env` 文件，添加以下配置：

```bash
# SMTP 配置
SMTP_HOST=your-smtp-server-host
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=your-sender-email@example.com
```

### 2. 修改邮件发送代码

修改 [`lib/server/email.ts`](./lib/server/email.ts) 文件，将控制台日志输出改为真实 SMTP 发送：

```typescript
import nodemailer from 'nodemailer';

// 创建 SMTP 传输器
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // 根据端口自动决定是否使用 TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// 发送邮件方法
export async function sendEmail(to: string, subject: string, html: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Email to ${to}:`, { subject, html });
    return;
  }
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send email');
  }
}
```

### 3. 注意事项

- 需安装依赖: `pnpm add nodemailer`
- 开发环境可使用 Mailhog、Mailtrap 等工具进行测试
- 生产环境需确保 SMTP 服务可靠性和连接安全
- 高流量站点考虑使用消息队列处理邮件发送
- 确保在容器化部署时（如 Docker 或 Kubernetes）正确配置网络，使应用能够连接到 SMTP 服务
- 定期监控邮件发送状态和错误日志

---

Built with SQLite.

- Password check with HaveIBeenPwned
- Email verification
- 2FA with TOTP
- 2FA recovery codes
- Password reset
- Login throttling and rate limiting

Emails are just logged to the console. Rate limiting is implemented using JavaScript `Map`.

## Initialize project

Create `sqlite.db` and run `setup.sql`.

```
sqlite3 sqlite.db
```

Create a .env file. Generate a 128 bit (16 byte) string, base64 encode it, and set it as `ENCRYPTION_KEY`.

```bash
ENCRYPTION_KEY="L9pmqRJnO1ZJSQ2svbHuBA=="
```

> You can use OpenSSL to quickly generate a secure key.
>
> ```bash
> openssl rand --base64 16
> ```

Install dependencies and run the application:

```
pnpm i
pnpm dev
```

## Notes

- We do not consider user enumeration to be a real vulnerability so please don't open issues on it. If you really need to prevent it, just don't use emails.
- This example does not handle unexpected errors gracefully.
- There are some major code duplications (specifically for 2FA) to keep the codebase simple.
- TODO: You may need to rewrite some queries and use transactions to avoid race conditions when using MySQL, Postgres, etc.
- TODO: This project relies on the `X-Forwarded-For` header for getting the client's IP address.
- TODO: Logging should be implemented.
