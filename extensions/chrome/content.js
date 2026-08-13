// content.js
if (window.__OPENFLOW_CONTENT_READY__) {
  console.debug('[OpenFlow] content.js already initialized, skip duplicate injection.');
} else {
window.__OPENFLOW_CONTENT_READY__ = true;

function extractDataFromPage() {
  try {
    // 1. 提取基础信息 (利用 querySelector 匹配网页中的具体结构)
    // 根据 PRD 中的 HTML 结构，寻找包含文本的 span 或 div
    // 这里的选择器需要根据目标网站真实的 DOM 结构微调
    const rawText = document.body.innerText;

    // 动态提取项目名称
    // 动态提取项目名称（从左侧选中的列表项提取）
    let rawTaskName = "";

    // 1. 找到所有可能是任务名称的文本节点（例如：赛诺斯-小火车呜呜呜-华为-0304）
    const candidates = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    while ((textNode = walker.nextNode())) {
        const text = textNode.nodeValue.trim();
        // 匹配含有短横线、没有换行且长度适中的字符串
        if (text.includes('-') && !text.includes('\n') && text.length > 5 && text.length < 80) {
            candidates.push({ node: textNode.parentElement, text: text });
        }
    }

    // 2. 遍历这些候选节点，检查它的容器（向上找几层）是否有被选中的样式（背景色发灰，或包含 active/selected 类名）
    for (const item of candidates) {
        let el = item.node;
        let isSelected = false;
        for (let i = 0; i < 5 && el && el !== document.body; i++) {
            const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
            const bgColor = window.getComputedStyle(el).backgroundColor;

            // 依据类名判断选中状态
            if (className.includes('active') || className.includes('select') || className.includes('current')) {
                isSelected = true;
                break;
            }
            // 依据背景颜色判断（非透明且非白色），并且宽度适中（如左侧列表项）
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && bgColor !== 'rgb(255, 255, 255)') {
                if (el.offsetWidth > 50 && el.offsetWidth < 600) {
                    isSelected = true;
                    break;
                }
            }
            el = el.parentElement;
        }
        if (isSelected) {
            rawTaskName = item.text;
            break;
        }
    }

    // 如果依然没找到选中的列表项提取出名字，退阶使用基础正则
    if (!rawTaskName) {
        const nameMatch = rawText.match(/(?:项目名称|任务名称|项目游戏名称|产品名称)[：:\s]*([a-zA-Z0-9\u4e00-\u9fa5\-\_:]+)/);
        if (nameMatch && nameMatch[1]) {
            rawTaskName = nameMatch[1].trim();
        } else {
            const fallbackMatch = rawText.match(/[\u4e00-\u9fa5A-Za-z0-9]+(?:-[\u4e00-\u9fa5A-Za-z0-9]+){1,}/);
            if (fallbackMatch) {
                rawTaskName = fallbackMatch[0].trim();
            }
        }
    }

    // 此时 rawTaskName 为类似 "赛诺斯-小火车呜呜呜-华为-0304"
    let projectNameStr = rawTaskName || "未知项目";

    // 将项目全名传给后续处理流程，不要破坏原始的 "-" 分割结构，
    // 以便 popup.js 能够进行更精准的最长匹配提取。
    projectNameStr = rawTaskName;

    // 匹配网页文本中的“素材类型：视频”或“平面”
    let materialType = '未知';
    const typeMatch = rawText.match(/素材类型[：:]\s*(视频|平面)/);
    if (typeMatch) {
        materialType = typeMatch[1];
    } else {
        materialType = rawText.includes('视频') ? '视频' : '平面';
    }

    // 提取原创套数（如果页面中有 "原创: 5套" 等相关字眼），默认给 0 或者留空让业务自己算也可以
    let originalCount = 0;
    const originalMatch = rawText.match(/原创.*?(\d+)\s*套/);
    if (originalMatch) {
       originalCount = parseInt(originalMatch[1], 10);
    } else {
       // 未找到明确的“原创: X套”，根据要求有的版位可能单图出几个延展
       // 这是一个保底提取。
    }

    // 2. 提取尺寸列表 (寻找对应的卡片容器)
    const sizeCards = document.querySelectorAll('section.bg-white.p-4.shadow-md');
    let sizeDetails = [];

    sizeCards.forEach(card => {
       const typeName = card.querySelector('.font-bold')?.innerText || '未知版位';
       const items = card.querySelectorAll('.mt-2.p-2'); // 获取每一行尺寸

       items.forEach(item => {
           const spans = item.querySelectorAll('span.flex.items-center.justify-center');
           if(spans.length >= 3) {
               sizeDetails.push({
                   "版位类型": typeName,
                   "分辨率": spans[0].innerText.trim(),
                   "大小限制": spans[1].innerText.trim(),
                   "所需数量": spans[2].innerText.replace('所需数量：', '').trim()
               });
           }
       });
    });

    // 提取更多附加信息 (扩展 JSON 返回内容，把能提取的尽可能都拿出来)
    const extraData = {};
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const keywordsToLookAhead = [
        "任务ID", "需求方", "制作人", "集团名称", "投放媒体", "应用类型",
        "素材用途", "业务分组", "业务承接", "期望完成日期", "预计交付时间", "投放预算",
        "下单人", "下单时间", "优先级", "需求详情", "注意事项", "安装包链接",
        "素材参考链接", "参考图片", "参考视频", "参考文件", "已制素材",
        "下单方式", "素材数"
    ];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 过滤掉纯符号或太短/太长的线
        if (/^[^\w\u4e00-\u9fa5]+$/.test(line) || line.length > 300) continue;

        // 1. 匹配单行内的 "键：值" 或 "键: 值"
        const inlineMatch = line.match(/^([a-zA-Z\u4e00-\u9fa5]{2,10})\s*[：:]\s*(.+)$/);
        if (inlineMatch) {
            let key = inlineMatch[1].trim();
            let val = inlineMatch[2].trim();
            // 不覆盖已有且看起来有意义的值
            if (val && val !== "/" && val !== "无" && !extraData[key]) {
                 extraData[key] = val;
            }
        } else {
            // 2. 匹配上下行的 "键\n值"
            const cleanLine = line.replace(/[：:]$/, '').trim();
            if (keywordsToLookAhead.includes(cleanLine) && i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                // 如果下一行不是关键字且不是常见按钮文字，作为它的值
                if (!keywordsToLookAhead.includes(nextLine.replace(/[：:]$/, '').trim())
                    && nextLine !== "复制" && nextLine !== "查看" && nextLine.length < 500) {
                     if (!extraData[cleanLine] || extraData[cleanLine] === "/" || extraData[cleanLine] === "无") {
                         extraData[cleanLine] = nextLine;
                     }
                }
            }
        }
    }

    // 3. 组装返回数据，将额外数据平铺在最后
    return {
      success: true,
      data: {
        "项目游戏名称": projectNameStr,
        "素材类型": materialType,
        "原创套数": originalCount,
        "尺寸要求明细": sizeDetails,
        ...extraData
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 辅助函数：等待指定的毫秒数 (sleep)
 * @param {number} ms 毫秒数
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getRightPanel() {
  return document.querySelector('.ant-tabs-content-holder') || document.body;
}

const PANEL_FIELD_KEYS = [
  '任务ID', '需求方', '制作人', '制作者', '集团名称', '公司名称', '公司主体', '投放媒体',
  '渠道', '应用类型', '素材用途', '业务分组', '需求归属', '需求属性', '业务承接',
  '期望完成日期', '预计交付时间', '截止日期', '投放日预算', '投放预算', '下单人',
  '下单时间', '素材类型', '下单方式', '优先级', '素材数', '需求详情', '注意事项',
  '安装包链接', '素材参考链接', '参考图片', '参考视频', '参考文件', '已制作素材', '已制素材'
];
const PANEL_SECTION_HEADINGS = new Set(['下单信息', '需求信息', '分辨率-大小-数量', '参考信息']);
const PANEL_ACTION_TEXTS = new Set(['复制', '查看', '下载']);
const PANEL_FIELD_ALIASES = new Map([['已制素材', '已制作素材']]);

function normalizePanelText(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function getElementText(element) {
  return normalizePanelText(element?.innerText ?? element?.textContent ?? '');
}

function canonicalFieldKey(key) {
  return PANEL_FIELD_ALIASES.get(key) || key;
}

function splitFieldLine(line) {
  const normalized = String(line || '').trim();
  for (const key of PANEL_FIELD_KEYS) {
    const match = normalized.match(new RegExp(`^${key}\\s*[：:]\\s*(.*)$`));
    if (match) return { key: canonicalFieldKey(key), value: match[1].trim() };
  }
  return null;
}

function isFieldBoundaryLine(line) {
  const normalized = String(line || '').replace(/[：:]$/, '').trim();
  return PANEL_SECTION_HEADINGS.has(normalized) || PANEL_FIELD_KEYS.includes(normalized) || Boolean(splitFieldLine(line));
}

function cleanFieldValue(value) {
  const lines = normalizePanelText(value).split('\n').filter(Boolean);
  const cleaned = [];
  for (const line of lines) {
    if (PANEL_ACTION_TEXTS.has(line)) continue;
    if (isFieldBoundaryLine(line)) break;
    cleaned.push(line);
  }
  const result = cleaned.join('\n').trim();
  return result === '/' || result === '无' ? '' : result;
}

function extractValueFromFieldText(text, expectedKey) {
  const lines = normalizePanelText(text).split('\n').filter(Boolean);
  if (lines.length === 0) return '';

  const firstField = splitFieldLine(lines[0]);
  if (!firstField || canonicalFieldKey(firstField.key) !== canonicalFieldKey(expectedKey)) return '';

  const valueLines = [];
  if (firstField.value) valueLines.push(firstField.value);
  for (let index = 1; index < lines.length; index += 1) {
    if (isFieldBoundaryLine(lines[index])) break;
    valueLines.push(lines[index]);
  }
  return cleanFieldValue(valueLines.join('\n'));
}

function findFieldContainers(rightPanel) {
  const bestByKey = new Map();
  const elements = Array.from(rightPanel.querySelectorAll?.('span, p, div') || []);

  elements.forEach((element) => {
    const text = getElementText(element);
    if (!text || text.length > 5000) return;
    const firstField = splitFieldLine(text.split('\n')[0]);
    if (!firstField) return;

    const key = canonicalFieldKey(firstField.key);
    const value = extractValueFromFieldText(text, key);
    const otherBoundaryCount = text.split('\n').slice(1).filter(line => {
      const boundary = splitFieldLine(line);
      return boundary && canonicalFieldKey(boundary.key) !== key;
    }).length;
    const score = (otherBoundaryCount * 1000000) + (value ? 0 : 100000) + text.length;
    const current = bestByKey.get(key);
    if (!current || score < current.score) bestByKey.set(key, { element, value, score });
  });

  return bestByKey;
}

function extractFieldsFromLines(rightPanel) {
  const values = {};
  const lines = normalizePanelText(getElementText(rightPanel)).split('\n').filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const field = splitFieldLine(lines[index]);
    if (!field) continue;

    const key = canonicalFieldKey(field.key);
    const valueLines = [];
    if (field.value) valueLines.push(field.value);
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (isFieldBoundaryLine(lines[cursor])) break;
      valueLines.push(lines[cursor]);
    }
    const value = cleanFieldValue(valueLines.join('\n'));
    if (value && !values[key]) values[key] = value;
  }

  return values;
}

function classifyReferenceResource(field, value, element) {
  if (!value) return [];
  const anchors = Array.from(element?.querySelectorAll?.('a[href]') || [])
    .map(anchor => ({ href: anchor.href || anchor.getAttribute?.('href') || '', text: getElementText(anchor) }))
    .filter(anchor => anchor.href);

  if (anchors.length > 0) {
    return anchors.map(anchor => ({
      field,
      kind: /pan\.baidu\.com/i.test(anchor.href) ? 'cloud_link' : 'link',
      url: anchor.href,
      text: anchor.text || value
    }));
  }

  if (/https?:\/\//i.test(value)) {
    const url = value.match(/https?:\/\/\S+/i)?.[0] || value;
    return [{ field, kind: /pan\.baidu\.com/i.test(url) ? 'cloud_link' : 'link', url, text: value }];
  }

  if (field === '参考文件' || value === '附件' || /\.(?:apk|zip|rar|7z|exe|msi|pdf|docx?|xlsx?|pptx?|mp4|mov|png|jpe?g)$/i.test(value)) {
    return [{ field, kind: 'attachment', ...(value !== '附件' ? { fileName: value } : {}), text: value }];
  }

  return [{ field, kind: 'text', text: value }];
}

function hasLoadingSpinner() {
  return Boolean(document.querySelector('.ant-spin-spinning, .ant-spin-blur'));
}

function parseQuantityText(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? match[0] : '';
}

function getPanelSignature(panel = getRightPanel()) {
  const text = panel.innerText || '';
  const sizeCardCount = panel.querySelectorAll('section.bg-white.p-4.shadow-md').length;
  const inputCount = panel.querySelectorAll('input.ant-input').length;
  return `${sizeCardCount}|${inputCount}|${text.slice(0, 3000)}`;
}

function extractDetailItemsFromPanel(rightPanel) {
  const detailItems = [];
  const sizeCards = rightPanel.querySelectorAll('section.bg-white.p-4.shadow-md');

  if (sizeCards.length > 0) {
    sizeCards.forEach(card => {
      const typeName = card.querySelector('.font-bold')?.textContent.trim() || '未知版位';
      const items = card.querySelectorAll('.mt-2.p-2');

      items.forEach(item => {
        const spans = item.querySelectorAll('span.flex.items-center.justify-center');
        if (spans.length >= 3) {
          detailItems.push({
            resolution: spans[0].textContent.trim(),
            sizeLimit: spans[1].textContent.trim(),
            requiredQuantity: parseQuantityText(spans[2].textContent),
            positionType: typeName
          });
        }
      });
    });
  }

  if (detailItems.length === 0) {
    const inputs = Array.from(rightPanel.querySelectorAll('input.ant-input'));
    const resolutionRegex = /\d+\s*[*xX×-]\s*\d+/;
    const resolutionInputs = inputs.filter(input => resolutionRegex.test(input.value));

    resolutionInputs.forEach(resInput => {
      const resolution = resInput.value.trim();
      let sizeLimit = '';
      let requiredQuantity = '';
      const rowWrapper = resInput.closest('.ant-row') || resInput.parentElement?.parentElement;
      if (rowWrapper) {
        const rowInputs = Array.from(rowWrapper.querySelectorAll('input.ant-input'));
        const currentIndex = rowInputs.indexOf(resInput);
        if (currentIndex !== -1) {
          if (rowInputs[currentIndex + 1]) sizeLimit = rowInputs[currentIndex + 1].value.trim();
          if (rowInputs[currentIndex + 2]) requiredQuantity = parseQuantityText(rowInputs[currentIndex + 2].value);
        }
      }
      detailItems.push({ resolution, sizeLimit, requiredQuantity });
    });
  }

  return detailItems;
}

function extractExtraDataFromPanel(rightPanel) {
  const extraData = extractFieldsFromLines(rightPanel);
  const fieldContainers = findFieldContainers(rightPanel);
  fieldContainers.forEach(({ value }, key) => {
    if (value) extraData[key] = value;
  });

  const referenceResources = [];
  ['安装包链接', '素材参考链接', '参考图片', '参考视频', '参考文件'].forEach((field) => {
    const value = extraData[field] || '';
    referenceResources.push(...classifyReferenceResource(field, value, fieldContainers.get(field)?.element));
  });
  if (referenceResources.length > 0) extraData.referenceResources = referenceResources;
  return extraData;
}

function panelLooksUseful(panel) {
  const text = panel.innerText || '';
  return extractDetailItemsFromPanel(panel).length > 0 || /素材类型|制作人|制作者|集团名称|投放媒体|分辨率|尺寸/.test(text);
}

async function loadAllTaskCards(taskList, timeoutMs = 20000) {
  if (!taskList) {
    return Array.from(document.querySelectorAll('.p-4.cursor-pointer'));
  }

  if (Math.ceil(taskList.scrollTop + taskList.clientHeight) >= taskList.scrollHeight - 2) {
    return Array.from(taskList.querySelectorAll('.p-4.cursor-pointer'));
  }

  const startedAt = Date.now();
  let previousCount = -1;
  let stableHits = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const cards = Array.from(taskList.querySelectorAll('.p-4.cursor-pointer'));
    const currentCount = cards.length;
    const reachedBottom = Math.ceil(taskList.scrollTop + taskList.clientHeight) >= taskList.scrollHeight - 2;

    if (currentCount === previousCount && reachedBottom) {
      stableHits += 1;
      if (stableHits >= 3) return cards;
    } else {
      stableHits = 0;
    }

    previousCount = currentCount;
    taskList.scrollTop = taskList.scrollHeight;
    taskList.dispatchEvent(new Event('scroll', { bubbles: true }));
    await sleep(400);
  }

  return Array.from(taskList.querySelectorAll('.p-4.cursor-pointer'));
}

function getTaskId(extraData) {
  return String(extraData?.['任务ID'] || '').trim();
}

function isTaskCardSelected(card) {
  if (!card) return false;
  if (card.getAttribute?.('aria-selected') === 'true') return true;
  const className = String(card.className || '').toLowerCase();
  if (/\b(active|selected|current)\b/.test(className)) return true;
  const inlineBackground = String(card.style?.backgroundColor || '').toLowerCase();
  if (inlineBackground && inlineBackground !== 'transparent' && inlineBackground !== 'rgba(0, 0, 0, 0)') return true;
  return false;
}

function describeTaskCard(card, listIndex, occurrence = 0) {
  const cardText = getElementText(card);
  const projectName = getElementText(card.querySelector?.('.truncate')) || cardText.split('\n')[0] || '未知项目';
  const deadline = cardText.match(/截止日期[：:]\s*(\d{4}-\d{2}-\d{2})/)?.[1] || '';
  const requiredSets = Number.parseInt(cardText.match(/所需(\d+)套/)?.[1] || '0', 10) || 0;
  const status = cardText.split('\n').find(line => ['未开始', '交付中', '完成', '已完成', '已取消', '未过审'].includes(line)) || '';
  const materialType = cardText.includes('视频') ? '视频' : (cardText.includes('平面') ? '平面' : '未知类型');
  return { projectName, deadline, requiredSets, status, materialType, listIndex, occurrence };
}

function getTaskDescriptors(cards) {
  const occurrences = new Map();
  return cards.map((card, listIndex) => {
    const base = describeTaskCard(card, listIndex);
    const signature = `${base.projectName}|${base.deadline}|${base.requiredSets}|${base.materialType}`;
    const occurrence = occurrences.get(signature) || 0;
    occurrences.set(signature, occurrence + 1);
    return { ...base, signature, occurrence };
  });
}

function findTaskCard(taskList, descriptor) {
  const cards = Array.from(taskList?.querySelectorAll?.('.p-4.cursor-pointer') || document.querySelectorAll('.p-4.cursor-pointer'));
  const matches = cards.filter((card, listIndex) => {
    const candidate = describeTaskCard(card, listIndex);
    return candidate.projectName === descriptor.projectName &&
      candidate.deadline === descriptor.deadline &&
      candidate.requiredSets === descriptor.requiredSets &&
      candidate.materialType === descriptor.materialType;
  });
  return matches[descriptor.occurrence] || null;
}

function selectedCardMatchesDescriptor(taskList, descriptor) {
  const selected = Array.from(taskList?.querySelectorAll?.('.p-4.cursor-pointer') || [])
    .find(card => isTaskCardSelected(card));
  if (!selected) return true;
  const selectedDescriptor = describeTaskCard(selected, -1);
  return selectedDescriptor.projectName === descriptor.projectName &&
    selectedDescriptor.deadline === descriptor.deadline &&
    selectedDescriptor.requiredSets === descriptor.requiredSets;
}

function validatePanelIdentity(panel, descriptor, previousTaskId, allowSameTaskId, taskList) {
  const extraData = extractExtraDataFromPanel(panel);
  const taskId = getTaskId(extraData);
  const errors = [];

  if (!taskId) errors.push('详情中没有任务ID');
  if (taskId && previousTaskId && taskId === previousTaskId && !allowSameTaskId) errors.push('详情仍是上一任务ID');
  if (!selectedCardMatchesDescriptor(taskList, descriptor)) errors.push('左侧选中任务与目标任务不一致');

  const panelDeadline = extraData['期望完成日期'] || extraData['预计交付时间'] || extraData['截止日期'] || '';
  if (panelDeadline && panelDeadline !== descriptor.deadline) errors.push(`详情日期为 ${panelDeadline}`);

  const panelMaterialType = extraData['素材类型'] || '';
  if (panelMaterialType && descriptor.materialType !== '未知类型' && !panelMaterialType.includes(descriptor.materialType)) {
    errors.push(`详情素材类型为 ${panelMaterialType}`);
  }

  const panelSets = Number.parseInt(String(extraData['素材数'] || '').match(/\d+/)?.[0] || '0', 10) || 0;
  if (panelSets && descriptor.requiredSets && panelSets !== descriptor.requiredSets) errors.push(`详情素材数为 ${panelSets}套`);

  if (!panelLooksUseful(panel)) errors.push('详情内容尚未完整显示');
  return { valid: errors.length === 0, errors, extraData, taskId };
}

function waitForPanelSignal(panel, timeoutMs = 250) {
  if (typeof MutationObserver !== 'function' || !panel) return sleep(timeoutMs);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(finish);
    observer.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true });
    const timer = setTimeout(finish, timeoutMs);
  });
}

async function waitForDetailPanelReady(previousSignature, descriptor, previousTaskId, options = {}) {
  const timeoutMs = options.timeoutMs || 12000;
  const startedAt = Date.now();
  let stableSignature = '';
  let stableHits = 0;
  let lastPanel = getRightPanel();
  let lastValidation = { valid: false, errors: ['详情尚未就绪'], extraData: {}, taskId: '' };

  while (Date.now() - startedAt < timeoutMs) {
    await waitForPanelSignal(lastPanel, 250);

    if (hasLoadingSpinner()) {
      stableHits = 0;
      continue;
    }

    const panel = getRightPanel();
    lastPanel = panel;
    const signature = getPanelSignature(panel);
    const validation = validatePanelIdentity(panel, descriptor, previousTaskId, options.allowSameTaskId, options.taskList);
    lastValidation = validation;
    const changedOrConfirmed = signature !== previousSignature || validation.taskId !== previousTaskId || options.allowSameTaskId;

    if (changedOrConfirmed && validation.valid) {
      stableHits = signature === stableSignature ? stableHits + 1 : 1;
      stableSignature = signature;
      if (stableHits >= 2) {
        return { panel, timedOut: false, ...validation };
      }
    } else {
      stableHits = 0;
      stableSignature = signature;
    }
  }

  return { panel: lastPanel, timedOut: true, ...lastValidation };
}

async function captureTaskDescriptor(taskList, descriptor, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  let lastErrors = ['详情加载失败'];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const card = findTaskCard(taskList, descriptor);
    if (!card) {
      lastErrors = ['任务卡已离开当前列表，无法重新定位'];
      break;
    }

    card.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    const previousPanel = getRightPanel();
    const previousSignature = getPanelSignature(previousPanel);
    const previousTaskId = getTaskId(extractExtraDataFromPanel(previousPanel));
    const allowSameTaskId = attempt === 1 && isTaskCardSelected(card);
    card.click();

    const waitResult = await waitForDetailPanelReady(previousSignature, descriptor, previousTaskId, {
      allowSameTaskId,
      taskList,
      timeoutMs: options.detailTimeoutMs
    });
    if (!waitResult.timedOut && waitResult.valid) {
      return { success: true, attempt, ...waitResult };
    }
    lastErrors = waitResult.errors?.length ? waitResult.errors : ['详情加载等待超时'];
  }

  return { success: false, attempts: maxAttempts, errors: lastErrors };
}

/**
 * 自动遍历点击并抓取数据的异步核心逻辑
 * @param {Function} sendResponse 用于向后台或 popup 返回通信结果的回调函数
 */
async function extractBulkDataFromPageAsync(sendResponse, options = {}) {
  let taskList = null;
  let originalScrollTop = 0;

  try {
    const extractedDataList = [];
    const extractionWarnings = [];

    const deadline = String(options.deadline || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      sendResponse({ success: false, error: '请指定有效的截止日期', sourceUrl: location.href, extractedAt: new Date().toISOString() });
      return;
    }

    // 先触发无限列表加载到底，再按用户指定的截止日期匹配卡片，不限制状态。
    taskList = document.querySelector('.TaskListScroll');
    originalScrollTop = taskList?.scrollTop || 0;
    const allTaskCards = await loadAllTaskCards(taskList);
    const matchedDescriptors = getTaskDescriptors(allTaskCards).filter(descriptor => descriptor.deadline === deadline);

    if (matchedDescriptors.length === 0) {
      console.log(`[SmartAd 助手] 当前已加载列表中没有截止日期为 ${deadline} 的任务`);
      sendResponse({
        success: true,
        data: [],
        warnings: [`当前已加载列表中没有截止日期为 ${deadline} 的任务`],
        sourceUrl: location.href,
        extractedAt: new Date().toISOString(),
        deadline,
        matchedCount: 0,
        complete: true,
        failedTasks: []
      });
      return;
    }

    console.log(`[SmartAd 助手] 共找到 ${matchedDescriptors.length} 个截止日期为 ${deadline} 的任务，准备开始遍历...`);

    // 循环遍历指定截止日期的任务卡片。
    const failedTasks = [];
    const seenTaskIds = new Map();
    for (let i = 0; i < matchedDescriptors.length; i++) {
        const descriptor = matchedDescriptors[i];
        console.log(`[SmartAd 助手] 正在点击并采集任务: 【${descriptor.projectName}】...`);
        const capture = await captureTaskDescriptor(taskList, descriptor, options);
        if (!capture.success) {
          const message = `${descriptor.projectName} 抓取失败：${capture.errors.join('、')}`;
          extractionWarnings.push(message);
          failedTasks.push({ projectName: descriptor.projectName, code: 'DETAIL_IDENTITY_NOT_CONFIRMED', message, attempts: capture.attempts });
          continue;
        }

        const rightPanel = capture.panel || getRightPanel();
        const detailItems = extractDetailItemsFromPanel(rightPanel);
        const extraData = capture.extraData || extractExtraDataFromPanel(rightPanel);
        const taskId = capture.taskId || getTaskId(extraData);
        const previousDescriptor = seenTaskIds.get(taskId);
        if (previousDescriptor) {
          const message = `${descriptor.projectName} 与 ${previousDescriptor.projectName} 返回了相同任务ID ${taskId}`;
          extractionWarnings.push(message);
          failedTasks.push({ projectName: descriptor.projectName, code: 'DUPLICATE_TASK_ID', message, attempts: capture.attempt });
          continue;
        }
        seenTaskIds.set(taskId, descriptor);

        let materialType = descriptor.materialType;
        if (extraData['素材类型'] && (extraData['素材类型'].includes('平面') || extraData['素材类型'].includes('视频'))) {
          materialType = extraData['素材类型'].includes('视频') ? '视频' : '平面';
        }

        extractedDataList.push({
            projectName: descriptor.projectName,
            taskId,
            materialType,
            requiredSets: descriptor.requiredSets,
            deadline,
            status: descriptor.status,
            details: detailItems,
            ...extraData
        });
    }

    const warnings = [...extractionWarnings];
    extractedDataList.forEach((task, index) => {
        const label = task.projectName || `第 ${index + 1} 个任务`;
        const details = Array.isArray(task.details) ? task.details : [];
        if (details.length === 0) {
            warnings.push(`${label} 缺少尺寸要求`);
            return;
        }
        const missingQuantity = details.filter(detail => !String(detail.requiredQuantity || '').match(/\d+/)).length;
        if (missingQuantity > 0) warnings.push(`${label} 有 ${missingQuantity} 条尺寸缺少数量`);
    });

    console.log('[SmartAd 助手] 批量提取完成！', extractedDataList);
    // 所有循环结束后，返回最终数据
    sendResponse({
        success: true,
        data: extractedDataList,
        warnings,
        sourceUrl: location.href,
        extractedAt: new Date().toISOString(),
        deadline,
        matchedCount: matchedDescriptors.length,
        complete: failedTasks.length === 0 && extractedDataList.length === matchedDescriptors.length,
        failedTasks
      });

  } catch (error) {
    console.error('[SmartAd 助手] 抓取过程中发生异常:', error);
    sendResponse({ success: false, error: error.message, sourceUrl: location.href, extractedAt: new Date().toISOString() });
  } finally {
    if (taskList) taskList.scrollTop = originalScrollTop;
  }
}

// 接收来自 popup.js 的消息并执行提取
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXTRACT_DOM") {
    // 原始单次抓取逻辑
    const result = extractDataFromPage();
    sendResponse(result);
  } else if (request.action === "EXTRACT_BULK_DOM") {
    // 新增批量抓取逻辑
    extractBulkDataFromPageAsync(sendResponse, {
      deadline: request.deadline,
      detailTimeoutMs: request.detailTimeoutMs,
      maxAttempts: request.maxAttempts
    });
    // 必须隐式 return true 告诉 Chrome 使用异步的 sendResponse
    return true;
  }
});
}
