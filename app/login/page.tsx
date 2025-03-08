/**
 * 用户登录页面
 * 
 * 这个文件是登录功能的入口页面，主要职责包括：
 * 1. 限制频繁访问（防止恶意请求）
 * 2. 检查用户当前是否已登录，已登录用户会被重定向
 * 3. 显示登录表单
 * 4. 提供注册新账号和忘记密码的链接
 */

// 导入所需的组件和函数
import { LoginForm } from "./components";   // 导入登录表单组件
import Link from "next/link";               // Next.js的链接组件，用于页面导航
import { getCurrentSession } from "@/lib/server/session";  // 获取当前用户会话
import { redirect } from "next/navigation";  // 页面重定向函数
import { globalGETRateLimit } from "@/lib/server/request"; // 全局GET请求速率限制

/**
 * 登录页面组件
 * 
 * 这是Next.js页面组件，用于渲染登录页面。在渲染前会进行一系列检查：
 * - 是否超过请求速率限制
 * - 用户是否已登录
 * - 用户是否需要完成其他步骤（如邮箱验证、设置双因素认证）
 * 
 * @returns 登录页面内容或重定向指令
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
	
	// 第四步：用户未登录，显示登录页面内容
	return (
		<>
			{/* 页面标题 */}
			<h1>Sign in</h1>
			
			{/* 登录表单组件 */}
			<LoginForm />
			
			{/* 注册新账号链接 */}
			<Link href="/signup">Create an account</Link>
			
			{/* 忘记密码链接 */}
			<Link href="/forgot-password">Forgot password?</Link>
		</>
	);
}

/**
 * 登录页面流程完整说明：
 * 
 * 1. 用户访问登录页面
 * 2. 系统检查用户是否已登录
 *    - 已登录用户会根据其状态被重定向到适当的页面
 *    - 未登录用户可以看到登录表单
 * 3. 用户可以：
 *    - 填写邮箱和密码登录
 *    - 点击链接注册新账号
 *    - 点击忘记密码链接找回密码
 * 4. 登录表单提交后的处理逻辑在components.tsx和actions.ts中实现
 * 
 * 安全考量：
 * - 请求速率限制防止暴力破解和滥用
 * - 严格的重定向逻辑确保用户完成所有必要的安全步骤
 * - 提供忘记密码功能，避免用户因忘记密码而创建多个账号
 */
