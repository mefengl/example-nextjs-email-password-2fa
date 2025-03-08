/**
 * 邮箱验证页面
 * 
 * 这个文件是邮箱验证功能的入口页面，主要职责包括：
 * 1. 限制频繁访问（防止恶意请求）
 * 2. 检查用户登录状态和邮箱验证状态
 * 3. 显示邮箱验证表单和辅助功能
 * 
 * 邮箱验证是用户注册流程中的重要环节，确保用户提供的邮箱
 * 真实可用，从而提高账户安全性和用户认证的可靠性。
 */

// 导入所需的组件和函数
import Link from "next/link";  // Next.js的链接组件，用于页面导航
import { EmailVerificationForm, ResendEmailVerificationCodeForm } from "./components";  // 导入验证表单和重发验证码表单
import { getCurrentSession } from "@/lib/server/session";  // 获取当前用户会话
import { redirect } from "next/navigation";  // 页面重定向函数
import { getUserEmailVerificationRequestFromRequest } from "@/lib/server/email-verification";  // 获取验证请求
import { globalGETRateLimit } from "@/lib/server/request";  // 全局GET请求速率限制

/**
 * 邮箱验证页面组件
 * 
 * 这是Next.js页面组件，用于渲染邮箱验证页面。在渲染前会进行一系列检查：
 * - 是否超过请求速率限制
 * - 用户是否已登录
 * - 用户邮箱是否已经验证过
 * - 是否存在有效的验证请求
 * 
 * @returns 邮箱验证页面内容或重定向指令
 */
export default function Page() {
	// 第一步：检查请求频率，防止频繁访问
	if (!globalGETRateLimit()) {
		return "Too many requests";  // 如果请求过于频繁，显示错误信息
	}
	
	// 第二步：获取当前用户信息
	const { user } = getCurrentSession();
	
	// 如果用户未登录，重定向到登录页面
	if (user === null) {
		return redirect("/login");
	}
	
	// 第三步：获取用户的邮箱验证请求
	// 注意：理想情况下，如果之前的验证码过期，应该自动发送新的验证邮件
	// 但由于无法在服务器组件内设置cookie，所以这里没有实现这个功能
	const verificationRequest = getUserEmailVerificationRequestFromRequest();
	
	// 第四步：如果没有验证请求且用户邮箱已验证，重定向到首页
	if (verificationRequest === null && user.emailVerified) {
		return redirect("/");
	}
	
	// 第五步：渲染邮箱验证页面
	return (
		<>
			{/* 页面标题 */}
			<h1>Verify your email address</h1>
			
			{/* 提示信息，显示验证码发送的邮箱地址 
			   使用可选链操作符(?.)，如果verificationRequest为null，则使用用户当前邮箱 */}
			<p>We sent an 8-digit code to {verificationRequest?.email ?? user.email}.</p>
			
			{/* 验证码输入表单 */}
			<EmailVerificationForm />
			
			{/* 重发验证码表单 */}
			<ResendEmailVerificationCodeForm />
			
			{/* 更改邮箱链接，提供给用户在填写错误邮箱时使用 */}
			<Link href="/settings">Change your email</Link>
		</>
	);
}

/**
 * 邮箱验证页面流程说明：
 * 
 * 1. 用户注册账号后被自动重定向到此页面
 * 2. 系统会向用户注册时填写的邮箱发送一封包含8位验证码的邮件
 * 3. 用户需要登录邮箱，查看验证码并输入到表单中
 * 4. 如果用户未收到验证码，可以点击"Resend code"按钮重新发送
 * 5. 如果用户填写了错误的邮箱，可以点击"Change your email"链接修改邮箱
 * 6. 用户成功验证邮箱后，将根据其状态被重定向到下一个设置页面或主页
 * 
 * 安全考量：
 * - 请求速率限制防止滥用和自动化攻击
 * - 只有已登录用户才能访问此页面
 * - 已验证邮箱的用户会被自动重定向，避免重复验证
 * - 验证失败不会立即显示具体原因，这是防止枚举攻击的安全措施
 */
