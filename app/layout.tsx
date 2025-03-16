/**
 * 根布局组件
 * 
 * 这个文件定义了整个应用的根布局结构，是所有页面的外层容器。
 * 主要职责：
 * 1. 定义HTML文档的基本结构
 * 2. 设置页面元数据（标题、描述等）
 * 3. 提供全局样式和布局
 * 4. 包含所有页面共享的UI元素
 */

import "./globals.css";  // 导入全局样式
import { Inter } from "next/font/google";  // 导入 Google Font

// 配置 Inter 字体
const inter = Inter({ subsets: ["latin"] });

// 定义页面元数据
export const metadata = {
	title: "认证系统示例",
	description: "基于 Next.js 的完整认证系统，包含邮箱密码登录和双因素认证"
};

/**
 * RootLayout 组件
 * 
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件，将被渲染在布局中
 * @returns {JSX.Element} 完整的页面布局结构
 */
export default function RootLayout({
	children
}: {
	children: React.ReactNode;
}) {
	return (
		// lang="en" 设置页面默认语言
		<html lang="en">
			{/* 应用 Inter 字体到整个页面主体 */}
			<body className={inter.className}>
				{/* 主要内容区域 */}
				<div className="container">
					{children}
				</div>
			</body>
		</html>
	);
}

/**
 * 布局说明：
 * 
 * 1. 布局结构
 *    - HTML文档使用英语作为默认语言
 *    - 使用 Inter 字体提供现代化的文字显示
 *    - 所有页面内容都被包含在一个带有container类的div中
 * 
 * 2. 样式处理
 *    - 通过 globals.css 提供全局样式定义
 *    - 使用 next/font/google 实现字体优化和预加载
 * 
 * 3. 性能考虑
 *    - 字体使用子集化优化加载性能
 *    - 布局结构简单，确保快速渲染
 */
