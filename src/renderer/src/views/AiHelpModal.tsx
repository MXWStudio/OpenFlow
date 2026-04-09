import { Modal, Accordion, Code, Text, Stack, Title, List, ThemeIcon, CopyButton, Button, ActionIcon, Tooltip } from '@mantine/core';
import { Copy, Check, ExternalLink } from 'lucide-react';

export function AiHelpModal({ opened, onClose }: { opened: boolean, onClose: () => void }) {
  const defaultPrompt = `你是一个极简的游戏素材分类机器。请分析图片并严格输出两个中文短语，用短横线 "-" 连接。

【提取规则】
1. 第一部分：画面主体或画风（如：橡皮人、跑车、农场、废土、二次元）。
2. 第二部分：核心玩法或游戏类型（如：射击、竞速、生存、角色扮演、跑酷）。

【严格限制】
1. 只能输出形如 "词1-词2" 的字符串。
2. 绝对不能有任何前缀（如"这是："）、标点符号、换行符或结尾句号。
3. 词汇需尽量简短。无法识别时输出"通用-游戏"。`;

  return (
    <Modal opened={opened} onClose={onClose} title={<Title order={4}>AI 配置使用说明</Title>} size="xl" scrollAreaComponent={Modal.NativeScrollArea}>
      <Stack gap="md">
        <Text size="sm">
          在此配置您的 AI 视觉大模型以启用“AI识图”自动命名与分类功能。
        </Text>

        <Accordion variant="separated" defaultValue="fields">
          <Accordion.Item value="fields">
            <Accordion.Control icon={<Title order={6} mb={0}>1</Title>}>配置项填写指南</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Text size="sm"><b>API 服务地址 (Base URL):</b> AI 服务商的接口调用地址。不同的服务商有不同的地址，如果使用代理服务，请填写代理地址。</Text>
                <Text size="sm"><b>API 密钥 (API Key):</b> 您在 AI 平台申请的鉴权秘钥，用于验证身份和扣费。</Text>
                <Text size="sm"><b>模型名称 (Model):</b> 您想要使用的具体大模型名称，该模型<b>必须支持视觉/识图能力（Vision）</b>。</Text>
                <Text size="sm"><b>系统提示词 (System Prompt):</b> 指导 AI 如何分析图片并返回符合您重命名模板的文本格式。</Text>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="providers">
            <Accordion.Control icon={<Title order={6} mb={0}>2</Title>}>主流平台配置示例</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <Text size="sm" c="dimmed">请前往以下平台注册账号并获取 API Key：</Text>

                <Title order={6} mt="xs">🌐 OpenAI (ChatGPT)</Title>
                <List size="sm" spacing="xs">
                  <List.Item><b>获取地址:</b> <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI Platform</a></List.Item>
                  <List.Item><b>Base URL:</b> <Code>https://api.openai.com/v1</Code> (国内可能需要代理地址)</List.Item>
                  <List.Item><b>推荐模型:</b> <Code>gpt-4o</Code> 或 <Code>gpt-4o-mini</Code></List.Item>
                </List>

                <Title order={6} mt="xs">🚀 DeepSeek (深度求索)</Title>
                <List size="sm" spacing="xs">
                  <List.Item><b>获取地址:</b> <a href="https://platform.deepseek.com/" target="_blank" rel="noreferrer">DeepSeek 开放平台</a></List.Item>
                  <List.Item><b>Base URL:</b> <Code>https://api.deepseek.com/v1</Code></List.Item>
                  <List.Item><b>推荐模型:</b> <Text span size="xs" c="red">注意：DeepSeek 官方 API 目前可能不支持直接识图，建议使用其他支持 Vision 的模型。</Text></List.Item>
                </List>

                <Title order={6} mt="xs">☁️ 阿里云百炼 (通义千问)</Title>
                <List size="sm" spacing="xs">
                  <List.Item><b>获取地址:</b> <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noreferrer">阿里云百炼控制台</a></List.Item>
                  <List.Item><b>Base URL:</b> <Code>https://dashscope.aliyuncs.com/compatible-mode/v1</Code></List.Item>
                  <List.Item><b>推荐模型:</b> <Code>qwen-vl-max</Code> 或 <Code>qwen-vl-plus</Code></List.Item>
                </List>

                <Title order={6} mt="xs">🧠 智谱 AI (GLM)</Title>
                <List size="sm" spacing="xs">
                  <List.Item><b>获取地址:</b> <a href="https://bigmodel.cn/" target="_blank" rel="noreferrer">智谱开放平台</a></List.Item>
                  <List.Item><b>Base URL:</b> <Code>https://open.bigmodel.cn/api/paas/v4</Code></List.Item>
                  <List.Item><b>推荐模型:</b> <Code>glm-4v</Code></List.Item>
                </List>

                <Title order={6} mt="xs">🌌 Google Gemini</Title>
                <List size="sm" spacing="xs">
                  <List.Item><b>获取地址:</b> <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a></List.Item>
                  <List.Item><b>Base URL:</b> <Code>https://generativelanguage.googleapis.com/v1beta/openai/</Code> (利用其兼容接口)</List.Item>
                  <List.Item><b>推荐模型:</b> <Code>gemini-1.5-pro</Code> 或 <Code>gemini-1.5-flash</Code></List.Item>
                </List>

                <Title order={6} mt="xs">🎭 Anthropic Claude</Title>
                <List size="sm" spacing="xs">
                  <List.Item><b>获取地址:</b> <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">Anthropic Console</a></List.Item>
                  <List.Item><b>说明:</b> 通常建议通过第三方中转平台 (如 OpenAI 兼容代理) 使用，直接使用需要填写其专属 Base URL。</List.Item>
                  <List.Item><b>推荐模型:</b> <Code>claude-3-5-sonnet-20240620</Code></List.Item>
                </List>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="prompt">
            <Accordion.Control icon={<Title order={6} mb={0}>3</Title>}>推荐系统提示词 (System Prompt)</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <Text size="sm">
                  请注意：在“命名模板”设置中，AI 识别命名通常配置为 <b>画风-玩法-横竖-作者-(序号)</b>。
                  因此，系统提示词只需让 AI 输出 <b>画风-玩法</b>，后续的横竖、作者和序号将由软件自动补充（详见预览效果）。
                </Text>

                <CopyButton value={defaultPrompt} timeout={2000}>
                  {({ copied, copy }) => (
                    <Button color={copied ? 'teal' : 'blue'} onClick={copy} variant="light" leftSection={copied ? <Check size={16} /> : <Copy size={16} />}>
                      {copied ? '已复制推荐提示词' : '一键复制推荐提示词'}
                    </Button>
                  )}
                </CopyButton>

                <Code block>{defaultPrompt}</Code>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Modal>
  );
}
