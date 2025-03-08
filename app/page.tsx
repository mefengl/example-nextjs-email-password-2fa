/**
 * 应用主页
 * 
 * 这个文件是应用的主页面，用户成功完成所有认证步骤后会看到这个页面。
 * 主要职责包括：
 * 1. 限制频繁访问（防止恶意请求）
 * 2. 检查用户认证状态，未通过各种验证的用户会被重定向
 * 3. 显示欢迎信息和用户名
 * 4. 提供导航链接和登出功能
 */
// 导入所需的组件和函数
import { LogoutButton } from "./components";     // 导入登出按钮组件
import Link from "next/link";                   // Next.js的链接组件，用于页面导航
import { getCurrentSession } from "@/lib/server/session";  // 获取当前用户会话
import { redirect } from "next/navigation";     // 页面重定向函数
import { globalGETRateLimit } from "@/lib/server/request"; // 全局GET请求速率限制

/**
 * 主页面组件
 * 
 * 这是Next.js页面组件，用于渲染应用的主页。在渲染前会进行一系列认证检查，
 * 确保只有完成所有认证步骤的用户才能访问此页面。
 * 
 * @returns 主页内容或重定向指令
 */
export default function Page() {
	// 第一步：检查请求频率，防止频繁访问
	if (!globalGETRateLimit()) {
		return "Too many requests"; // 如果请求过于频繁，显示错误信息
	}
	
	// 第二步：获取当前用户的会话信息
	const { session, user } = getCurrentSession();
	
	// 第三步：检查用户是否已登录
	if (session === null) {
		return redirect("/login"); // 未登录用户重定向到登录页
	}
	
	// 第四步：检查用户是否已验证邮箱
	if (!user.emailVerified) {
		return redirect("/verify-email"); // 邮箱未验证，重定向到邮箱验证页
	}
	
	// 第五步：检查用户是否已设置双因素认证
	if (!user.registered2FA) {
		return redirect("/2fa/setup"); // 未设置双因素认证，重定向到设置页
	}
	
	// 第六步：检查当前会话是否已完成双因素认证
	if (!session.twoFactorVerified) {
		return redirect("/2fa"); // 会话未完成双因素认证，重定向到验证页
	}
	
	// 第七步：所有检查都通过，渲染主页内容
	return (
		<>
			{/* 页面头部导航 */}
			<header>
				<Link href="/">Home</Link>
				<Link href="/settings">Settings</Link>
			</header>
			
			{/* 页面主要内容 */}
			<main>
				{/* 显示欢迎信息和用户名 */}
				<h1>Hi {user.username}!</h1>
				
				{/* 登出按钮 */}
				<LogoutButton />
			</main>
		</>
	);
}

/**
 * 应用安全架构说明：
 * 
 * 这个应用实施了多层安全措施：
 * 1. 邮箱密码认证 - 基础的身份验证
 * 2. 邮箱验证 - 确保用户提供的邮箱是有效的
 * 3. 双因素认证 - 增加额外的安全层，防止密码泄露导致的账号被盗
 * 
 * 用户必须完成所有这些步骤才能访问应用的主要功能。任何中间状态的用户
 * 都会被重定向到相应的页面完成必要的认证步骤。
 * 
 * 这种严格的认证流程确保了应用的高安全性，特别适合处理敏感信息的场景。
 */
