/**
 * 用户注册页面
 * 
 * 这个文件是注册功能的入口页面，主要职责包括：
 * 1. 限制频繁访问（防止恶意请求）
 * 2. 检查用户当前是否已登录，已登录用户会被重定向
 * 3. 显示注册表单和相关说明
 * 4. 提供返回登录页的链接
 */

// 导入所需的组件和函数
import { SignUpForm } from "./components";   // 导入注册表单组件
import Link from "next/link";               // Next.js的链接组件，用于页面导航
import { getCurrentSession } from "@/lib/server/session";  // 获取当前用户会话
import { redirect } from "next/navigation";  // 页面重定向函数
import { globalGETRateLimit } from "@/lib/server/request"; // 全局GET请求速率限制

/**
 * 注册页面组件
 * 
 * 这是Next.js页面组件，用于渲染注册页面。在渲染前会进行一系列检查：
 * - 是否超过请求速率限制
 * - 用户是否已登录
 * - 用户是否需要完成其他步骤（如邮箱验证、设置双因素认证）
 * 
 * @returns 注册页面内容或重定向指令
 */
export default function Page() {
	// 第一步：检查请求频率，防止频繁访问
	if (!globalGETRateLimit()) {
		return "Too many requests"; // 如果请求过于频繁，显示错误信息
	}
	
	// 第二步：获取当前用户的会话信息（如果已登录）
	const { session, user } = getCurrentSession();
	
	// 第三步：如果用户已登录，根据用户状态重定向到合适的页面
	if (session !== null) { // 用户已登录
		// 如果邮箱未验证，重定向到邮箱验证页面
		if (!user.emailVerified) {
			return redirect("/verify-email");
		}
		
		// 如果尚未设置双因素认证，重定向到双因素认证设置页面
		if (!user.registered2FA) {
			return redirect("/2fa/setup");
		}
		
		// 如果当前会话未完成双因素认证，重定向到双因素认证页面
		if (!session.twoFactorVerified) {
			return redirect("/2fa");
		}
		
		// 如果一切正常（用户已完成所有认证步骤），重定向到首页
		return redirect("/");
	}
	
	// 第四步：用户未登录，显示注册页面内容
	return (
		<>
			{/* 页面标题 */}
			<h1>Create an account</h1>
			
			{/* 注册说明文字 */}
			<p>Your username must be at least 3 characters long and your password must be at least 8 characters long.</p>
			
			{/* 注册表单组件 */}
			<SignUpForm />
			
			{/* 登录页面链接，适用于已有账号的用户 */}
			<Link href="/login">Sign in</Link>
		</>
	);
}

/**
 * 用户注册流程完整说明：
 * 
 * 1. 用户访问注册页面
 * 2. 系统检查用户是否已登录
 *   - 已登录用户会根据其状态被重定向到适当的页面
 *   - 未登录用户可以看到注册表单
 * 3. 用户填写用户名、邮箱和密码，提交表单
 * 4. 表单数据发送到服务器（由components.tsx中的表单提交到actions.ts处理）
 * 5. 服务器验证数据并创建用户账号
 * 6. 用户创建成功后会被自动登录并重定向到下一步（设置双因素认证）
 * 
 * 安全考量：
 * - 请求速率限制防止暴力破解和滥用
 * - 服务器端验证所有用户输入
 * - 严格的重定向逻辑确保用户完成所有必要的安全步骤
 */
