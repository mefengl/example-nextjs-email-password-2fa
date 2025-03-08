/**
 * 电子邮件验证模块 - Email Validation Module
 * 
 * 这个模块提供与电子邮件地址相关的功能：
 * - 验证电子邮件地址的基本格式
 * - 检查电子邮件地址是否已被注册
 * 
 * 邮箱验证是用户注册流程中的重要一环，确保用户提供的
 * 电子邮件地址格式有效且未被其他账户使用。
 */

import { db } from "./db";

/**
 * 验证电子邮件地址格式
 * 
 * 这个函数执行两项基本检查：
 * 1. 使用正则表达式验证电子邮件格式（必须包含@符号和至少一个点）
 * 2. 验证长度不超过255个字符
 * 
 * 注意：这只是一个基本的格式验证，不会进行完整的RFC标准验证。
 * 它足以过滤掉明显无效的输入，但最终的有效性验证应该通过
 * 发送验证邮件来确认用户能够访问该邮箱。
 * 
 * 正则表达式 /^.+@.+\..+$/ 的含义：
 * - ^.+ 表示开头必须有一个或多个字符
 * - @ 表示必须包含@符号
 * - .+\. 表示@后必须有一个或多个字符，然后是一个点
 * - .+$ 表示点后必须有一个或多个字符到结尾
 * 
 * @param email 要验证的电子邮件地址
 * @returns 如果格式有效则返回true，否则返回false
 */
export function verifyEmailInput(email: string): boolean {
	return /^.+@.+\..+$/.test(email) && email.length < 256;
}

/**
 * 检查电子邮件地址是否可用（未被注册）
 * 
 * 查询数据库，检查指定的电子邮件地址是否已存在：
 * - 如果没有找到匹配的记录，表示该邮箱可用
 * - 如果找到匹配的记录，表示该邮箱已被其他账户使用
 * 
 * 这个检查通常在用户注册过程中执行，以确保每个电子邮件
 * 只能关联一个账户，避免重复注册。
 * 
 * @param email 要检查的电子邮件地址
 * @returns 如果邮箱未被使用则返回true，否则返回false
 * @throws 如果数据库查询失败
 */
export function checkEmailAvailability(email: string): boolean {
	const row = db.queryOne("SELECT COUNT(*) FROM user WHERE email = ?", [email]);
	if (row === null) {
		throw new Error(); // 数据库查询失败
	}
	return row.number(0) === 0; // 如果计数为0，表示邮箱可用
}
