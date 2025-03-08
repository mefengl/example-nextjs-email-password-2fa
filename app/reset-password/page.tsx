/**
 * 密码重置页面
 * 
 * 这个文件是密码重置流程的最后一步页面，主要职责包括：
 * 1. 限制频繁访问（防止恶意请求）
 * 2. 验证密码重置会话的有效性
 * 3. 确保用户完成了所有前置验证步骤（邮箱验证和可能的2FA验证）
 * 4. 显示密码重置表单
 * 
 * 此页面仅在用户通过所有安全验证后才能访问，是整个密码重置流程的最终环节。
 */

// 导入所需的组件和函数
import { PasswordResetForm } from "./components";  // 导入密码重置表单组件
import { validatePasswordResetSessionRequest } from "@/lib/server/password-reset";  // 验证密码重置会话
import { globalGETRateLimit } from "@/lib/server/request";  // 全局GET请求速率限制
import { redirect } from "next/navigation";  // 页面重定向

/**
 * 密码重置页面组件
 * 
 * 这是Next.js页面组件，用于渲染密码重置页面。在渲染前会进行一系列严格的检查，
 * 确保只有完成了所有前置验证步骤的合法用户才能访问此页面。
 * 
 * @returns 密码重置页面内容或重定向指令
 */
export default function Page() {
	// 第一步：检查请求频率，防止频繁访问
	if (!globalGETRateLimit()) {
		return "Too many requests";  // 如果请求过于频繁，显示错误信息
	}
	
	// 第二步：验证密码重置会话
	// 这个函数检查密码重置会话的有效性，包括会话是否存在、是否过期等
	const { session, user } = validatePasswordResetSessionRequest();
	
	// 如果没有有效的密码重置会话，重定向到忘记密码页面
	// 用户需要重新发起密码重置流程
	if (session === null) {
		return redirect("/forgot-password");
	}
	
	// 第三步：检查用户是否已完成邮箱验证
	// 如果未完成邮箱验证，重定向到邮箱验证页面
	if (!session.emailVerified) {
		return redirect("/reset-password/verify-email");
	}
	
	// 第四步：检查2FA验证状态
	// 如果用户已设置2FA但尚未在当前重置流程中通过2FA验证，重定向到2FA验证页面
	if (user.registered2FA && !session.twoFactorVerified) {
		return redirect("/reset-password/2fa");
	}
	
	// 第五步：所有验证都已通过，渲染密码重置表单页面
	return (
		<>
			{/* 页面标题 */}
			<h1>Enter your new password</h1>
			
			{/* 密码重置表单组件 */}
			<PasswordResetForm />
		</>
	);
}

/**
 * 密码重置页面流程说明：
 * 
 * 1. 用户在提交忘记密码请求并完成所有验证步骤后被导向此页面：
 *    - 邮箱验证（必需步骤）
 *    - 2FA验证（如果用户已设置2FA）
 * 
 * 2. 在此页面，用户可以设置新密码
 * 
 * 3. 提交新密码后，系统会：
 *    - 验证密码强度
 *    - 更新用户密码
 *    - 使所有现有会话失效（安全措施）
 *    - 为用户创建新的登录会话（自动登录）
 *    - 重定向用户到首页
 * 
 * 安全考量：
 * - 严格的路径保护确保用户必须完成所有身份验证步骤
 * - 每个验证步骤都有单独的重定向路径，确保流程完整性
 * - 请求速率限制防止暴力破解和自动化攻击
 * - 重置会话的状态跟踪确保用户不能跳过验证步骤
 */
