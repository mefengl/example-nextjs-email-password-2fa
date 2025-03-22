"use client"; // 声明这是一个客户端组件，会在浏览器中运行而不是服务器上

/**
 * 双因素认证设置页面的组件
 * =====================
 * 
 * 本文件实现了用户设置双因素认证(2FA)时使用的表单组件。
 * 这个组件允许用户输入他们从身份验证器应用（如Google Authenticator）
 * 中获取的验证码，以验证他们已经正确设置了身份验证器应用。
 */

import { setup2FAAction } from "./actions";
import { useFormState } from "react-dom";

/**
 * 表单初始状态
 * 定义了表单的初始状态，最开始没有任何消息显示
 */
const initial2FASetUpState = {
	message: ""
};

/**
 * 双因素认证设置表单组件
 * 
 * @param props.encodedTOTPKey - Base64编码的TOTP密钥，这个密钥是在服务器上生成的
 *                               并通过QR码展示给用户扫描，同时也需要隐藏在表单中提交
 * 
 * 当用户提交表单时，会调用setup2FAAction函数验证用户输入的验证码
 */
export function TwoFactorSetUpForm(props: { encodedTOTPKey: string }) {
	// 使用React的useFormState钩子处理表单状态和提交
	// state包含表单的当前状态，比如验证消息
	// action是绑定到表单的处理函数
	const [state, action] = useFormState(setup2FAAction, initial2FASetUpState);
	
	return (
		<form action={action}>
			{/* 隐藏的输入字段，存储TOTP密钥 */}
			<input name="key" value={props.encodedTOTPKey} hidden required />
			
			{/* 用户输入验证码的字段 */}
			<label htmlFor="form-totp.code">Verify the code from the app</label>
			<input id="form-totp.code" name="code" required />
			<br />
			
			{/* 提交按钮 */}
			<button>Save</button>
			
			{/* 显示操作结果消息，比如错误提示或成功消息 */}
			<p>{state.message}</p>
		</form>
	);
}

/**
 * 使用说明：
 * 1. 用户打开2FA设置页面后，会看到一个QR码和这个表单
 * 2. 用户使用身份验证器应用（如Google Authenticator）扫描QR码
 * 3. 应用会显示一个6位数的验证码，用户将其输入到此表单中
 * 4. 用户点击"Save"按钮提交表单
 * 5. 如果验证码正确，表单会提交成功，用户的2FA将被激活
 * 6. 如果验证码错误，表单将显示错误消息
 */
