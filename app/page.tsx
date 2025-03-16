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
 * 这是应用的首页，作为用户进入应用的第一个页面。
 * 主要功能：
 * 1. 展示用户的认证状态
 * 2. 提供导航到其他功能页面的入口
 * 3. 显示用户基本信息（如已登录）
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getUser } from "@/lib/server/user";
import { UserInfo } from "./components";

/**
 * Home 组件 - 应用首页
 * 
 * 服务端渲染的页面组件，用于：
 * - 验证用户会话
 * - 获取并显示用户信息
 * - 处理未认证用户的重定向
 * 
 * @returns {Promise<JSX.Element>} 渲染的页面内容
 */
export default async function Home() {
	// 获取用户会话信息
	const session = await getSession();

	// 如果用户未登录，重定向到登录页
	if (!session) {
		redirect("/login");
	}

	// 获取已登录用户的详细信息
	const user = await getUser(session.userId);

	// 渲染用户信息组件
	return <UserInfo user={user} />;
}

/**
 * 页面说明：
 * 
 * 1. 认证流程
 *    - 检查用户会话状态
 *    - 未登录用户自动重定向到登录页
 *    - 已登录用户显示其个人信息
 * 
 * 2. 数据获取
 *    - 使用服务端函数获取会话信息
 *    - 基于会话获取用户详细数据
 * 
 * 3. 安全考虑
 *    - 所有数据获取在服务端完成
 *    - 确保敏感信息不暴露给客户端
 */
