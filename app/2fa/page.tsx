/**
 * 双因素认证(2FA)验证页面
 * 
 * 这个文件是双因素认证功能的主页面，用户需要在此页面输入验证器应用生成的
 * 验证码，以完成登录过程中的第二步验证。主要职责包括：
 * 1. 限制频繁访问（防止恶意请求）
 * 2. 检查用户会话状态，确保用户处于需要进行2FA验证的正确状态
 * 3. 显示2FA验证表单
 * 4. 提供恢复码链接，用于用户无法使用验证器时的备用方案
 */

// 导入所需的组件和函数
import Link from "next/link";               // Next.js的链接组件，用于页面导航
import { TwoFactorVerificationForm } from "./components";  // 导入2FA验证表单组件
import { getCurrentSession } from "@/lib/server/session";  // 获取当前用户会话
import { redirect } from "next/navigation";  // 页面重定向函数
import { globalGETRateLimit } from "@/lib/server/request"; // 全局GET请求速率限制

/**
 * 双因素认证页面组件
 * 
 * 这是Next.js页面组件，用于渲染双因素认证验证页面。在渲染前会进行一系列检查：
 * - 是否超过请求速率限制
 * - 用户是否已登录
 * - 用户是否已验证邮箱
 * - 用户是否已设置2FA
 * - 用户当前会话是否已通过2FA验证
 * 
 * @returns 2FA验证页面内容或重定向指令
 */
export default function Page() {
	// 第一步：检查请求频率，防止频繁访问
	if (!globalGETRateLimit()) {
		return "Too many requests"; // 如果请求过于频繁，显示错误信息
	}
	
	// 第二步：获取当前用户的会话信息
	const { session, user } = getCurrentSession();
	
	// 第三步：进行一系列状态检查，确保用户处于正确的流程中
	
	// 如果用户未登录，重定向到登录页面
	if (session === null) {
		return redirect("/login");
	}
	
	// 如果用户邮箱未验证，重定向到邮箱验证页面
	if (!user.emailVerified) {
		return redirect("/verify-email");
	}
	
	// 如果用户尚未设置2FA，重定向到2FA设置页面
	if (!user.registered2FA) {
		return redirect("/2fa/setup");
	}
	
	// 如果当前会话已通过2FA验证，重定向到首页（无需再次验证）
	if (session.twoFactorVerified) {
		return redirect("/");
	}
	
	// 第四步：用户已通过密码登录但尚未完成2FA验证，显示2FA验证页面
	return (
		<>
			{/* 页面标题 */}
			<h1>Two-factor authentication</h1>
			
			{/* 页面说明文字 */}
			<p>Enter the code from your authenticator app.</p>
			
			{/* 2FA验证表单组件 */}
			<TwoFactorVerificationForm />
			
			{/* 恢复码链接 - 用于用户无法访问验证器应用时的备用登录方式 */}
			<Link href="/2fa/reset">Use recovery code</Link>
		</>
	);
}

/**
 * 双因素认证完整流程说明：
 * 
 * 1. 用户先通过用户名和密码登录
 * 2. 如果密码验证成功，且用户已设置2FA，系统自动引导到此页面
 * 3. 用户需要打开之前设置2FA时配置的验证器应用（如Google Authenticator）
 * 4. 用户输入验证器应用中显示的6位数验证码
 * 5. 如果验证成功，用户完成整个登录流程，被重定向到首页
 * 6. 如果用户无法访问验证器应用，可以点击"Use recovery code"链接
 *    使用之前保存的恢复码进行登录
 * 
 * 安全考量：
 * - 严格的重定向逻辑确保用户必须按正确顺序完成认证流程
 * - 提供恢复码选项，确保用户在丢失设备时仍能访问账号
 * - 请求速率限制防止暴力破解和滥用
 * - 验证码是基于时间和用户密钥动态生成的，每30秒更新一次
 */
