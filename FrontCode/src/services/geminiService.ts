import { GoogleGenAI } from "@google/genai";
import { ThreatEvent } from "../types";

const apiKey = process.env.API_KEY || ''; 

let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateThreatReport = async (threats: ThreatEvent[], type: string): Promise<string> => {
  const reportTypeName = type === 'Daily' ? '日报' : type === 'Weekly' ? '周报' : '专项分析报告';

  if (!ai) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(`**SentinelGuard 威胁情报${reportTypeName}**

**生成时间:** ${new Date().toLocaleString()}
**分析对象:** ${threats.length} 个安全事件

**1. 威胁综述**
在本报告周期内，系统共拦截了 ${threats.length} 次攻击尝试。其中高风险事件占比 ${(threats.filter(t => t.riskLevel === 'High').length / threats.length * 100).toFixed(0)}%。主要威胁类型集中在 ${threats[0]?.type || 'DDoS 攻击'}，表明攻击者正在针对基础设施层进行试探。

**2. 关键发现**
*   **高频攻击源:** 监测到 IP ${threats[0]?.sourceIp} 活动频繁，建议立即封禁。
*   **漏洞利用:** 针对 Web 应用的 SQL 注入尝试有所增加。

**3. 处置建议**
*   立即更新 WAF 规则库，阻断来自高危地区的流量。
*   对服务器进行全面漏洞扫描，修补 OpenSSH 相关漏洞。
*   加强对管理员账号的审计。

*（注：此为模拟生成内容，请配置 API Key 以获取实时 AI 分析）*`);
      }, 2500);
    });
  }

  try {
    const prompt = `
      你是一个资深网络安全专家。请根据以下 JSON 格式的威胁情报数据，撰写一份专业的中文安全态势感知${reportTypeName}。
      
      数据：${JSON.stringify(threats.slice(0, 10))}

      报告结构要求：
      1. **执行摘要**：简要概述当前安全态势。
      2. **威胁态势分析**：分析攻击类型分布、攻击源地域分布。
      3. **关键事件溯源**：挑选 1-2 个高风险事件进行深入技术分析。
      4. **防御与加固建议**：给出具体的战术和战略建议。

      语气要求：专业、客观、紧迫感适中。使用 Markdown 格式。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "AI 分析模块未能返回有效内容。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "连接 AI 引擎失败，请检查网络或 API 配额。";
  }
};