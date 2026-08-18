/**
 * AI 诊断引擎 - 核心模块
 * 通过 Prompt 工程驱动云端大模型对学生解题步骤进行过程式诊断
 * 支持数学/物理/化学三科,采用 OpenAI 兼容接口,可切换不同厂商模型
 */
import type { AnalyzeRequest, AnalyzeResponse, DiagnosisType, Subject } from '../../shared/types.js';

// 模型配置(从环境变量读取)
function getAIConfig() {
  return {
    apiBase: process.env.AI_API_BASE || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o',
  };
}

export function isAIConfigured(): boolean {
  return !!process.env.AI_API_KEY;
}

// 各学科的教师角色配置
const SUBJECT_PROFILES: Record<Subject, {
  role: string;
  subjectName: string;
  knowledgeDesc: string;
  tagExamples: string;
}> = {
  math: {
    role: '初中数学教师',
    subjectName: '数学',
    knowledgeDesc: '初中数学课本的具体知识点',
    tagExamples: '"符号运算""去括号""移项变号""公式应用""分类讨论"',
  },
  physics: {
    role: '初中物理教师',
    subjectName: '物理',
    knowledgeDesc: '初中物理课本的具体知识点,注意公式、单位、受力分析、电路分析等',
    tagExamples: '"公式应用""单位换算""受力分析""电路识别""实验现象""成像判断"',
  },
  chemistry: {
    role: '初中化学教师',
    subjectName: '化学',
    knowledgeDesc: '初中化学课本的具体知识点,注意化学方程式、反应类型、物质性质、实验操作等',
    tagExamples: '"化学方程式配平""方程式书写""反应类型判断""物质分类""实验现象""质量分数计算"',
  },
};

// 按学科构建系统提示词
function buildSystemPrompt(subject: Subject): string {
  const p = SUBJECT_PROFILES[subject];
  return `你是一位经验丰富的${p.role}。你的职责是审阅学生的${p.subjectName}解题步骤,进行过程式诊断与指导。

【核心原则】
1. 苏格拉底式启发:你给方向、给提问、给提示,但绝不直接给出完整答案或完整解题过程。你要引导学生自己思考。
2. 精准定位:如果存在错误,必须指出具体是第几步出错,以及错在哪里。
3. 结构化输出:你必须且只能输出一个 JSON 对象,不要输出任何额外文字、解释或 markdown 代码块标记。
4. 知识点关联:每次诊断都要关联到${p.knowledgeDesc}。
5. 薄弱标签:根据错误类型生成精炼的薄弱标签(2-4个字的短语,如${p.tagExamples}等)。

【判错前必须逐步验证 - 极其重要】
在判定学生答案错误之前,你必须先在 reasoning 字段中逐步验证学生的答案是否其实正确:
${subject === 'chemistry' ? `- 化学方程式配平:在 reasoning 中必须逐一数清左边和右边每种元素的原子个数(注意系数乘以下标,如 2O2 = 4个氧原子, 3Fe = 3个铁原子, Fe3O4 = 3个铁原子+4个氧原子)。如果左右两边各元素原子数都相等,就是正确配平,必须判为 correct。` : ''}
${subject === 'math' ? `- 数学计算:在 reasoning 中必须先亲自验算每一步的计算结果(如 3+5=8 不是 9, 2x=8 则 x=4),确认学生的计算确实有误才能判错。如果计算正确就不能判错。` : ''}
${subject === 'physics' ? `- 物理计算:在 reasoning 中必须先核对公式是否正确、单位是否统一、代入数值和计算结果是否准确,确认确实有错才能判错。` : ''}
- 宁可漏判错误,不可误判正确为错误。如果不确定学生是否错了,倾向于认为学生正确。

【一致性要求】
- coreError(核心错误)与 guidance(指导)内容必须一致,不能自相矛盾。
- 如果 coreError 说某处有错,guidance 就不能说该处是对的。
- 如果 isCorrect 为 true,coreError 必须为空字符串。

【诊断类型】
- stuck:学生做到一半卡住了,需要思路启发
- calc_error:步骤中存在计算错误(算术算错、公式代值算错)
- logic_error:推理过程有逻辑缺陷(如受力分析错误、反应类型判断错误)
- skip_step:步骤之间缺少必要的过渡,跳步了(如缺公式、缺单位换算、缺反应条件)
- no_idea:学生完全没思路,需要从题目条件出发构建分析框架
- correct:解题完全正确

【输出 JSON 格式】
{
  "reasoning": "你的逐步验证过程:先列出学生答案中的关键数值/原子计数,逐一核对是否正确,然后得出结论。这一步必须详细写出计算过程。",
  "diagnosisType": "上述类型之一",
  "errorStep": 出错步骤的序号(整数,从1开始;若无错误或为no_idea/stuck可为null),
  "coreError": "核心错误点的精炼描述,一句话点明关键问题;若正确则为空字符串",
  "guidance": "给学生的指导思路,启发式,不给答案。用第二人称'你'来写,语气鼓励且具体",
  "knowledgePoints": ["相关课本知识点1", "知识点2"],
  "weakTags": ["薄弱标签1", "标签2"],
  "isCorrect": true或false
}

【重要】先在 reasoning 中详细写出验证过程,再根据验证结果填写其他字段。只输出 JSON,不要有任何其他内容。`;
}

// 将 Unicode 下标字符转为普通数字(如 O₂ → O2, Fe₃O₄ → Fe3O4)
// 大模型对 Unicode 下标解析能力差,转成 ASCII 数字后能正确数原子个数
function normalizeSubscripts(text: string): string {
  const subscriptMap: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  };
  return text.replace(/[₀-₉]/g, ch => subscriptMap[ch] || ch);
}

// 构建用户消息
function buildUserMessage(req: AnalyzeRequest): string {
  const modeText = req.mode === 'guide'
    ? '【当前情况】学生正在解题过程中遇到了困难,请求思路指导。请启发学生下一步该怎么想、往哪个方向走,但不要替学生算出答案。'
    : '【当前情况】学生认为自己已经做完,请你作为教师审阅全部步骤,检查是否有计算错误、逻辑错误或跳步,并给出诊断。';

  const stepsText = req.steps.length === 0
    ? '(学生尚未写出任何步骤,完全无思路)'
    : req.steps.map((s, i) => `第${i + 1}步: ${normalizeSubscripts(s)}`).join('\n');

  return `${modeText}

【题目】
${normalizeSubscripts(req.question)}

【学生的解题步骤】
${stepsText}

请输出诊断 JSON。`;
}

// 调用大模型
async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const config = getAIConfig();
  const url = `${config.apiBase.replace(/\/$/, '')}/chat/completions`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI 接口错误 ${resp.status}: ${errText}`);
  }

  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

// 解析 LLM 返回的 JSON(容错处理)
function parseDiagnosis(raw: string): AnalyzeResponse {
  let text = raw.trim();
  // 去除可能的 markdown 代码块标记
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  // 尝试提取 JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];

  const parsed = JSON.parse(text);

  const validTypes: DiagnosisType[] = ['stuck', 'calc_error', 'logic_error', 'skip_step', 'no_idea', 'correct'];
  const diagnosisType = validTypes.includes(parsed.diagnosisType) ? parsed.diagnosisType : 'logic_error';

  return {
    diagnosisType,
    errorStep: typeof parsed.errorStep === 'number' ? parsed.errorStep : undefined,
    coreError: String(parsed.coreError || ''),
    guidance: String(parsed.guidance || ''),
    knowledgePoints: Array.isArray(parsed.knowledgePoints) ? parsed.knowledgePoints.map(String) : [],
    weakTags: Array.isArray(parsed.weakTags) ? parsed.weakTags.map(String) : [],
    isCorrect: parsed.diagnosisType === 'correct' || !!parsed.isCorrect,
  };
}

// 各学科模拟诊断内容
const MOCK_GUIDE: Record<Subject, { noIdea: { guidance: string; kps: string[]; tags: string[] }; stuck: (n: number) => { guidance: string; kps: string[]; tags: string[] } }> = {
  math: {
    noIdea: {
      guidance: '让我们从题目条件出发:已知什么?要求什么?你能把题目中的关键信息列出来吗?试试看把已知条件和求解目标分别写出来,然后想想它们之间有什么联系。',
      kps: ['审题与分析', '方程思想'],
      tags: ['审题', '分析思路'],
    },
    stuck: (n) => ({
      guidance: `你已经写到了第${n}步,思路方向不错。接下来想想:这一步得到的结果,和题目要求的目标之间还差什么?能否用你已经列出的关系,把未知量表示出来?`,
      kps: ['方程思想', '代数运算'],
      tags: ['思路推进'],
    }),
  },
  physics: {
    noIdea: {
      guidance: '让我们先分析题目:这道物理题考的是什么知识点?题目给了哪些已知量(注意数值和单位)?要求什么?你能先把已知量和未知量用符号列出来,再想想该用哪个物理公式把它们联系起来吗?',
      kps: ['受力分析', '公式选择'],
      tags: ['审题', '公式选择'],
    },
    stuck: (n) => ({
      guidance: `你写到了第${n}步,方向可以。接下来检查:用到的公式是否正确?各物理量的单位是否统一?代入数值时有没有遗漏?把公式、代入、结果三步分开写清楚试试。`,
      kps: ['公式应用', '单位换算'],
      tags: ['公式应用', '单位换算'],
    }),
  },
  chemistry: {
    noIdea: {
      guidance: '让我们先看题目考的是什么:是化学方程式、物质性质还是计算?题目中涉及哪些物质和反应?你能先把反应物和生成物写出来,再思考反应条件和反应类型吗?',
      kps: ['化学方程式', '反应类型'],
      tags: ['审题', '反应分析'],
    },
    stuck: (n) => ({
      guidance: `你写到了第${n}步。接下来检查:化学方程式是否配平?反应条件(加热、催化剂等)是否标注?元素符号和化学式是否正确?把方程式完整写出来再核对一遍原子个数。`,
      kps: ['化学方程式', '配平'],
      tags: ['方程式配平', '方程式书写'],
    }),
  },
};

// 无 API Key 时的模拟诊断(便于开发测试,按学科给出贴合内容)
function mockDiagnosis(req: AnalyzeRequest): AnalyzeResponse {
  const m = MOCK_GUIDE[req.subject] || MOCK_GUIDE.math;
  if (req.mode === 'guide') {
    if (req.steps.length === 0) {
      return {
        diagnosisType: 'no_idea',
        coreError: '',
        guidance: m.noIdea.guidance,
        knowledgePoints: m.noIdea.kps,
        weakTags: m.noIdea.tags,
        isCorrect: false,
      };
    }
    const s = m.stuck(req.steps.length);
    return {
      diagnosisType: 'stuck',
      coreError: '',
      guidance: s.guidance,
      knowledgePoints: s.kps,
      weakTags: s.tags,
      isCorrect: false,
    };
  }

  // check 模式 - 简单模拟
  return {
    diagnosisType: 'correct',
    coreError: '',
    guidance: '解题过程完整,步骤清晰,逻辑正确。继续保持!你也可以思考一下是否有更简洁的解法。',
    knowledgePoints: ['综合运用'],
    weakTags: [],
    isCorrect: true,
  };
}

// 主入口:诊断学生解题步骤
export async function analyzeSolution(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (!isAIConfigured()) {
    return mockDiagnosis(req);
  }

  const systemPrompt = buildSystemPrompt(req.subject);
  const userMessage = buildUserMessage(req);
  const raw = await callLLM(systemPrompt, userMessage);

  try {
    return parseDiagnosis(raw);
  } catch {
    // JSON 解析失败,返回兜底
    return {
      diagnosisType: 'logic_error',
      coreError: '诊断结果解析异常,请重试',
      guidance: raw.slice(0, 500),
      knowledgePoints: [],
      weakTags: [],
      isCorrect: false,
    };
  }
}
