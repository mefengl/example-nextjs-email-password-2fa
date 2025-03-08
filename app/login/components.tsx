/**
 * 用户登录表单组件
 * 
 * 这个文件实现了登录页面的表单组件，它包含：
 * 1. 电子邮箱输入框
 * 2. 密码输入框
 * 3. 提交按钮
 * 4. 错误消息展示
 * 
 * 当用户填写并提交表单时，数据会发送到服务器进行验证和处理。
 */

"use client"; // 这个标记表示这是一个客户端组件，会在浏览器中运行

// 导入必要的函数和钩子
import { loginAction } from "./actions"; // 导入处理登录的服务器动作
import { useFormState } from "react-dom"; // 导入表单状态管理钩子

/**
 * 表单初始状态
 * 
 * 定义了表单的初始状态，包含一个空的错误消息
 * 这个状态会在表单提交后被更新，用于显示登录失败的原因
 */
const initialState = {
	message: "" // 初始时没有消息
};

/**
 * 登录表单组件
 * 
 * 这个组件创建一个登录表单，收集用户的邮箱和密码并提交给服务器
 * 
 * @returns React组件，显示登录表单界面
 */
export function LoginForm() {
	// useFormState钩子用于管理表单状态
	// - loginAction: 表单提交时调用的服务器动作函数
	// - initialState: 表单的初始状态
	// - state: 当前表单状态，包含服务器返回的消息
	// - action: 提交表单时调用的函数
	const [state, action] = useFormState(loginAction, initialState);

	return (
		// 表单元素，action属性设置为上面定义的action函数
		<form action={action}>
			{/* 电子邮箱输入字段 */}
			<label htmlFor="form-login.email">Email</label>
			<input 
				type="email" // 输入类型为email，浏览器会验证格式
				id="form-login.email" // 输入框的ID，与label关联
				name="email" // 输入框的名称，服务器会用这个名称获取值
				autoComplete="username" // 浏览器自动填充提示，这里用username因为email常用作登录标识
				required // 必填字段
			/>
			<br />
			
			{/* 密码输入字段 */}
			<label htmlFor="form-login.password">Password</label>
			<input 
				type="password" // 密码类型，输入会显示为圆点
				id="form-login.password" // 输入框的ID
				name="password" // 输入框的名称
				autoComplete="current-password" // 浏览器自动填充提示，指明这是当前密码字段
				required // 必填字段
			/>
			<br />
			
			{/* 提交按钮 */}
			<button>Continue</button>
			
			{/* 显示登录状态消息，如错误提示 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 组件工作流程:
 * 
 * 1. 用户填写电子邮箱和密码
 * 2. 用户点击"Continue"按钮提交表单
 * 3. 表单数据被发送到loginAction函数处理
 * 4. 如果有错误，loginAction返回包含错误消息的state
 * 5. 错误消息显示在表单底部
 * 6. 如果登录成功，用户会被重定向到新页面（在actions.ts中处理）
 * 
 * 注意: 这是一个简洁的登录表单，没有包含"忘记密码"链接，
 * 也没有"记住我"选项。这些功能可以根据需要添加。
 * 
 * 安全说明:
 * - 真正的安全验证在服务器端actions.ts中进行
 * - 密码通过HTTPS加密传输到服务器
 * - 自动完成属性帮助浏览器正确识别表单字段，提高用户体验
 * - required属性确保用户不会提交空表单
 */
