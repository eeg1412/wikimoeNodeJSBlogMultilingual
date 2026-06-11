<template>
  <div class="ai-workflow-viewer">
    <el-empty v-if="!hasWorkflow" description="暂无 AI 工作流" />
    <template v-else>
      <div class="ai-workflow-summary">
        <div class="ai-workflow-summary-main">
          <div class="ai-workflow-summary-title">
            {{ summary.title || 'AI 翻译任务' }}
          </div>
          <div class="ai-workflow-summary-meta">
            <span v-if="summary.sourceLanguage">
              源语言：{{ summary.sourceLanguage }}
            </span>
            <span v-if="summary.targetLanguage">
              目标语言：{{ summary.targetLanguage }}
            </span>
            <span v-if="summary.status">状态：{{ summary.status }}</span>
          </div>
        </div>
        <div class="ai-workflow-metrics">
          <div
            v-for="metric in metricList"
            :key="metric.label"
            class="ai-workflow-metric"
          >
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
      </div>

      <div class="ai-workflow-body">
        <div class="ai-workflow-step-list" aria-label="AI 工作流步骤">
          <button
            v-for="step in visibleSteps"
            :key="step.id"
            type="button"
            class="ai-workflow-step-button"
            :class="getStepButtonClass(step)"
            @click="selectStep(step.id)"
          >
            <span class="ai-workflow-step-index">
              {{ getStepOrderText(step) }}
            </span>
            <span class="ai-workflow-step-copy">
              <span class="ai-workflow-step-title-row">
                <span class="ai-workflow-step-title">{{ step.title }}</span>
                <span
                  v-if="getStepStatusText(step)"
                  class="ai-workflow-step-status"
                  :class="getStepStatusClass(step)"
                >
                  {{ getStepStatusText(step) }}
                </span>
              </span>
              <span class="ai-workflow-step-subtitle">
                {{ getStepSubtitle(step) }}
              </span>
            </span>
          </button>
        </div>

        <div v-if="activeStep" class="ai-workflow-detail">
          <div class="ai-workflow-detail-header">
            <div>
              <div class="ai-workflow-detail-title">
                {{ getDetailTitle(activeStep) }}
              </div>
              <div class="ai-workflow-detail-description">
                {{ activeStep.description }}
              </div>
            </div>
            <div class="ai-workflow-badges">
              <el-tag
                v-if="getStepStatusText(activeStep)"
                size="small"
                effect="plain"
                :type="getStepStatusTagType(activeStep)"
              >
                {{ getStepStatusText(activeStep) }}
              </el-tag>
              <el-tag
                v-for="badge in getDisplayBadges(activeStep)"
                :key="badge.key"
                size="small"
                effect="plain"
                :type="badge.type || 'info'"
              >
                {{ badge.label }}：{{ badge.value }}
              </el-tag>
            </div>
          </div>

          <div class="ai-workflow-io-grid">
            <section class="ai-workflow-io-panel is-input">
              <div class="ai-workflow-io-heading">
                {{ getInputHeading(activeStep) }}
              </div>
              <div
                v-if="activeStep.inputSections.length === 0"
                class="ai-workflow-empty-text"
              >
                {{ getInputEmptyText(activeStep) }}
              </div>
              <div
                v-for="(section, sectionIndex) in activeStep.inputSections"
                :key="getSectionKey(section, sectionIndex, 'input')"
                class="ai-workflow-section"
                :class="getSectionClass(section)"
              >
                <div class="ai-workflow-section-title-row">
                  <div>
                    <div class="ai-workflow-section-title">
                      {{ section.title }}
                    </div>
                    <div
                      v-if="section.description"
                      class="ai-workflow-section-description"
                    >
                      {{ section.description }}
                    </div>
                  </div>
                  <el-tag v-if="section.total" size="small" effect="plain">
                    {{ section.total }} 项
                  </el-tag>
                </div>
                <div
                  v-for="(block, blockIndex) in section.textBlocks"
                  :key="getBlockKey(block, blockIndex, sectionIndex, 'input')"
                  class="ai-workflow-text-block"
                >
                  <div class="ai-workflow-text-title">{{ block.title }}</div>
                  <div class="ai-workflow-text-content">{{ block.text }}</div>
                  <div v-if="block.truncated" class="ai-workflow-text-note">
                    已展示前 {{ block.text.length }} 字，原内容共
                    {{ block.charLength }} 字。
                  </div>
                </div>
                <div
                  v-if="section.images?.length"
                  class="ai-workflow-image-grid"
                >
                  <div
                    v-for="(image, imageIndex) in section.images"
                    :key="getImageKey(image, imageIndex, sectionIndex, 'input')"
                    class="ai-workflow-image-card"
                  >
                    <div class="ai-workflow-image-title">
                      {{ image.label }}
                    </div>
                    <img
                      class="ai-workflow-image"
                      :src="image.src"
                      :alt="getImageAlt(image)"
                    />
                    <div
                      v-if="image.description"
                      class="ai-workflow-image-description"
                    >
                      {{ image.description }}
                    </div>
                  </div>
                </div>
                <div v-if="section.items.length" class="ai-workflow-item-list">
                  <div
                    v-for="(item, itemIndex) in section.items"
                    :key="getItemKey(item, itemIndex, sectionIndex, 'input')"
                    class="ai-workflow-item"
                  >
                    <div class="ai-workflow-item-label">{{ item.label }}</div>
                    <div class="ai-workflow-item-value">{{ item.value }}</div>
                    <div v-if="item.meta?.length" class="ai-workflow-item-meta">
                      <span v-for="meta in item.meta" :key="meta">
                        {{ meta }}
                      </span>
                    </div>
                    <div
                      v-if="item.images?.length"
                      class="ai-workflow-image-grid is-item"
                    >
                      <div
                        v-for="(image, imageIndex) in item.images"
                        :key="
                          getImageKey(
                            image,
                            imageIndex,
                            itemIndex,
                            'input-item'
                          )
                        "
                        class="ai-workflow-image-card"
                      >
                        <div class="ai-workflow-image-title">
                          {{ image.label }}
                        </div>
                        <img
                          class="ai-workflow-image"
                          :src="image.src"
                          :alt="getImageAlt(image)"
                        />
                        <div
                          v-if="image.description"
                          class="ai-workflow-image-description"
                        >
                          {{ image.description }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section class="ai-workflow-io-panel is-output">
              <div class="ai-workflow-io-heading">
                {{ getOutputHeading(activeStep) }}
              </div>
              <div
                v-if="activeStep.outputSections.length === 0"
                class="ai-workflow-empty-text"
              >
                {{ getOutputEmptyText(activeStep) }}
              </div>
              <div
                v-for="(section, sectionIndex) in activeStep.outputSections"
                :key="getSectionKey(section, sectionIndex, 'output')"
                class="ai-workflow-section"
                :class="getSectionClass(section)"
              >
                <div class="ai-workflow-section-title-row">
                  <div>
                    <div class="ai-workflow-section-title">
                      {{ section.title }}
                    </div>
                    <div
                      v-if="section.description"
                      class="ai-workflow-section-description"
                    >
                      {{ section.description }}
                    </div>
                  </div>
                  <el-tag v-if="section.total" size="small" effect="plain">
                    {{ section.total }} 项
                  </el-tag>
                </div>
                <div
                  v-for="(block, blockIndex) in section.textBlocks"
                  :key="getBlockKey(block, blockIndex, sectionIndex, 'output')"
                  class="ai-workflow-text-block"
                >
                  <div class="ai-workflow-text-title">{{ block.title }}</div>
                  <div class="ai-workflow-text-content">{{ block.text }}</div>
                  <div v-if="block.truncated" class="ai-workflow-text-note">
                    已展示前 {{ block.text.length }} 字，原内容共
                    {{ block.charLength }} 字。
                  </div>
                </div>
                <div
                  v-if="section.images?.length"
                  class="ai-workflow-image-grid"
                >
                  <div
                    v-for="(image, imageIndex) in section.images"
                    :key="
                      getImageKey(image, imageIndex, sectionIndex, 'output')
                    "
                    class="ai-workflow-image-card"
                  >
                    <div class="ai-workflow-image-title">
                      {{ image.label }}
                    </div>
                    <img
                      class="ai-workflow-image"
                      :src="image.src"
                      :alt="getImageAlt(image)"
                    />
                    <div
                      v-if="image.description"
                      class="ai-workflow-image-description"
                    >
                      {{ image.description }}
                    </div>
                  </div>
                </div>
                <div v-if="section.items.length" class="ai-workflow-item-list">
                  <div
                    v-for="(item, itemIndex) in section.items"
                    :key="getItemKey(item, itemIndex, sectionIndex, 'output')"
                    class="ai-workflow-item"
                  >
                    <div class="ai-workflow-item-label">{{ item.label }}</div>
                    <div class="ai-workflow-item-value">{{ item.value }}</div>
                    <div v-if="item.meta?.length" class="ai-workflow-item-meta">
                      <span v-for="meta in item.meta" :key="meta">
                        {{ meta }}
                      </span>
                    </div>
                    <div
                      v-if="item.images?.length"
                      class="ai-workflow-image-grid is-item"
                    >
                      <div
                        v-for="(image, imageIndex) in item.images"
                        :key="
                          getImageKey(
                            image,
                            imageIndex,
                            itemIndex,
                            'output-item'
                          )
                        "
                        class="ai-workflow-image-card"
                      >
                        <div class="ai-workflow-image-title">
                          {{ image.label }}
                        </div>
                        <img
                          class="ai-workflow-image"
                          :src="image.src"
                          :alt="getImageAlt(image)"
                        />
                        <div
                          v-if="image.description"
                          class="ai-workflow-image-description"
                        >
                          {{ image.description }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { getProgressStageText } from '@/utils/translationStage'

export default {
  name: 'AiTranslationWorkflowViewer',
  props: {
    workflow: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      activeStepId: ''
    }
  },
  computed: {
    summary() {
      return this.workflow?.summary || {}
    },
    steps() {
      if (!Array.isArray(this.workflow?.steps)) {
        return []
      }
      return this.workflow.steps
    },
    visibleSteps() {
      const list = []
      this.steps.forEach(step => {
        list.push({ ...step, displayLevel: 0 })
        if (!Array.isArray(step.children)) {
          return
        }
        step.children.forEach(child => {
          const hasMissingParentMetadata = !child.parentId || !child.parentTitle
          list.push({
            ...child,
            displayLevel: 1,
            parentId: child.parentId || step.id,
            parentTitle: child.parentTitle || step.title,
            hasMissingParentMetadata
          })
        })
      })
      return list
    },
    hasWorkflow() {
      return this.visibleSteps.length > 0
    },
    activeStep() {
      return (
        this.visibleSteps.find(step => step.id === this.activeStepId) ||
        this.visibleSteps[0] ||
        null
      )
    },
    metricList() {
      return [
        {
          label: '大步骤',
          value: this.getRequiredSummaryMetric('majorStepCount')
        },
        {
          label: '子步骤',
          value: this.getRequiredSummaryMetric('childStepCount')
        },
        {
          label: 'AI 调用',
          value: this.getRequiredSummaryMetric('aiCallCount')
        },
        {
          label: '流程警告',
          value: this.summary.workflowWarningCount || 0
        },
        { label: '审核条目', value: this.summary.previewEntryCount || 0 },
        { label: '跳过内容', value: this.summary.skippedEntryCount || 0 },
        { label: '警告', value: this.summary.warningCount || 0 }
      ]
    }
  },
  watch: {
    steps: {
      immediate: true,
      handler(steps) {
        const visibleSteps = this.visibleSteps
        if (!Array.isArray(visibleSteps) || visibleSteps.length === 0) {
          this.activeStepId = ''
          return
        }
        const hasActiveStep = visibleSteps.some(
          step => step.id === this.activeStepId
        )
        if (!hasActiveStep) {
          this.activeStepId = this.getPreferredActiveStep(visibleSteps).id
        }
      }
    }
  },
  methods: {
    selectStep(stepId) {
      this.activeStepId = stepId
    },
    getSectionKey(section, index, area) {
      if (section?.id) {
        return `${area}-section-${section.id}`
      }
      return `${area}-section-${index}-${section?.title || 'untitled'}`
    },
    getBlockKey(block, blockIndex, sectionIndex, area) {
      return `${area}-block-${sectionIndex}-${blockIndex}-${
        block?.title || 'untitled'
      }`
    },
    getItemKey(item, itemIndex, sectionIndex, area) {
      return `${area}-item-${sectionIndex}-${itemIndex}-${
        item?.label || 'unlabeled'
      }`
    },
    getImageKey(image, imageIndex, ownerIndex, area) {
      return `${area}-image-${ownerIndex}-${imageIndex}-${
        image?.src || image?.label || 'unlabeled'
      }`
    },
    getImageAlt(image) {
      return image?.alt || image?.label || 'AI 工作流图片'
    },
    getDisplayBadges(step) {
      const displayBadges = []
      if (!Array.isArray(step?.badges)) {
        return displayBadges
      }
      step.badges.forEach((badge, badgeIndex) => {
        const label = badge?.label || ''
        const value = badge?.value || ''
        if (label === '目标语言' && typeof value === 'string') {
          const languageValues = value
            .split('、')
            .map(item => item.trim())
            .filter(Boolean)
          if (languageValues.length > 1) {
            languageValues.forEach((languageValue, languageIndex) => {
              displayBadges.push({
                ...badge,
                value: languageValue,
                key: `${badgeIndex}-${languageIndex}-${label}-${languageValue}`
              })
            })
            return
          }
        }
        displayBadges.push({
          ...badge,
          key: `${badgeIndex}-${label}-${value}`
        })
      })
      return displayBadges
    },
    getRequiredSummaryMetric(key) {
      if (Object.prototype.hasOwnProperty.call(this.summary, key)) {
        return this.summary[key]
      }
      return '缺失'
    },
    getPreferredActiveStep(steps) {
      const stoppingStep = steps.find(step => step.status === 'stopping')
      if (stoppingStep) {
        return stoppingStep
      }
      const runningStep = steps.find(step => {
        return step.status === 'running' || step.status === 'retrying'
      })
      if (runningStep) {
        return runningStep
      }
      const failedStep = steps.find(step => step.status === 'failed')
      if (failedStep) {
        return failedStep
      }
      const warningStep = steps.find(step => step.status === 'warning')
      if (warningStep) {
        return warningStep
      }
      const completedSteps = steps.filter(step => step.status === 'completed')
      if (completedSteps.length > 0) {
        return completedSteps[completedSteps.length - 1]
      }
      return steps[0]
    },
    getStepButtonClass(step) {
      return {
        'is-active': step.id === this.activeStepId,
        'is-child': Number(step.displayLevel || 0) > 0,
        'is-service': step.kind === 'service',
        'is-ai-call': step.isAiCall === true,
        'is-recorded': step.status === 'recorded',
        'is-completed': step.status === 'completed',
        'is-running': step.status === 'running',
        'is-retrying': step.status === 'retrying',
        'is-stopping': step.status === 'stopping',
        'is-failed': step.status === 'failed',
        'is-warning': step.status === 'warning',
        'is-pending': step.status === 'pending'
      }
    },
    getStepOrderText(step) {
      return step?.displayOrder || step?.order || ''
    },
    getDetailTitle(step) {
      const orderText = this.getStepOrderText(step)
      if (Number(step?.displayLevel || 0) > 0) {
        return `子步骤 ${orderText}：${step.title}`
      }
      return `第 ${orderText} 步：${step.title}`
    },
    getStepStatusText(step) {
      if (step?.statusText) {
        return step.statusText
      }
      const statusTextMap = {
        pending: '待执行',
        running: '正在执行',
        retrying: '重试中',
        recorded: '已记录',
        completed: '已完成',
        failed: '执行失败',
        warning: '日志警告',
        stopping: '正在停止',
        skipped: '已跳过'
      }
      return statusTextMap[step?.status] || step?.status || ''
    },
    getStepStatusClass(step) {
      const status = step?.status || ''
      return `is-${status}`
    },
    getStepStatusTagType(step) {
      if (step?.status === 'completed') {
        return 'success'
      }
      if (step?.status === 'running') {
        return 'warning'
      }
      if (step?.status === 'retrying') {
        return 'warning'
      }
      if (step?.status === 'recorded') {
        return 'info'
      }
      if (step?.status === 'warning') {
        return 'warning'
      }
      if (step?.status === 'stopping') {
        return 'danger'
      }
      if (step?.status === 'failed') {
        return 'danger'
      }
      return 'info'
    },
    getStepSubtitle(step) {
      const parts = []
      if (Number(step?.displayLevel || 0) > 0 && step.parentTitle) {
        parts.push(`上级：${step.parentTitle}`)
      }
      if (step.hasMissingParentMetadata) {
        parts.push('日志缺少父级信息')
      }
      if (Number(step?.displayLevel || 0) === 0 && step.childCount) {
        parts.push(`${step.childCount} 个子步骤`)
      }
      if (Number(step?.displayLevel || 0) === 0 && step.aiCallCount) {
        parts.push(`${step.aiCallCount} 次 AI 调用`)
      }
      if (step.currentStep) {
        parts.push(step.currentStep)
      }
      if (step.provider) {
        parts.push(step.provider)
      }
      if (step.model) {
        parts.push(step.model)
      }
      if (step.stage) {
        parts.push(getProgressStageText(step.stage))
      }
      return parts.join(' / ') || '日志缺少摘要信息'
    },
    getInputHeading(step) {
      if (step?.kind === 'runtime') {
        return '执行状态'
      }
      return '给 AI 的内容'
    },
    getOutputHeading(step) {
      if (step?.kind === 'runtime') {
        return '执行结果'
      }
      return 'AI 输出的内容'
    },
    getInputEmptyText(step) {
      if (step?.kind === 'runtime') {
        return '这一步没有保存可展示的执行状态。'
      }
      return '这一步没有保存可展示的输入内容。'
    },
    getOutputEmptyText(step) {
      if (step?.kind === 'runtime') {
        return '这一步还没有保存完成结果。'
      }
      return '这一步没有保存可展示的输出内容。'
    },
    getSectionClass(section) {
      return {
        'is-input': section?.tone === 'input',
        'is-output': section?.tone === 'output',
        'is-warning': section?.tone === 'warning'
      }
    }
  }
}
</script>

<style scoped>
.ai-workflow-viewer {
  color: var(--el-text-color-regular);
  max-width: 100%;
  min-width: 0;
}

.ai-workflow-summary {
  align-items: flex-start;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
  padding: 16px;
}

.ai-workflow-summary-title {
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.ai-workflow-summary-meta {
  color: var(--el-text-color-secondary);
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 8px 14px;
  line-height: 1.6;
  margin-top: 8px;
}

.ai-workflow-metrics {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
}

.ai-workflow-metric {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  min-width: 0;
  padding: 10px;
}

.ai-workflow-metric span {
  color: var(--el-text-color-secondary);
  display: block;
  font-size: 12px;
  line-height: 1.4;
}

.ai-workflow-metric strong {
  color: var(--el-text-color-primary);
  display: block;
  font-size: 18px;
  line-height: 1.4;
  margin-top: 3px;
}

.ai-workflow-body {
  display: grid;
  gap: 16px;
  grid-template-columns: 260px minmax(0, 1fr);
  margin-top: 16px;
}

.ai-workflow-step-list {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  max-height: min(66vh, 720px);
  overflow: auto;
  padding: 8px;
}

.ai-workflow-step-button {
  align-items: flex-start;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  display: grid;
  gap: 10px;
  grid-template-columns: 28px minmax(0, 1fr);
  padding: 10px;
  text-align: left;
  width: 100%;
}

.ai-workflow-step-button.is-child {
  border-left: 2px solid var(--el-border-color-lighter);
  grid-template-columns: 34px minmax(0, 1fr);
  margin-left: 18px;
  padding-bottom: 8px;
  padding-top: 8px;
  width: calc(100% - 18px);
}

.ai-workflow-step-button.is-child .ai-workflow-step-index {
  border-radius: 6px;
  font-size: 11px;
  height: 24px;
  width: 34px;
}

.ai-workflow-step-button.is-child .ai-workflow-step-title {
  font-size: 12px;
  font-weight: 600;
}

.ai-workflow-step-button.is-service .ai-workflow-step-index {
  border-color: var(--el-color-info-light-5);
  color: var(--el-color-info);
}

.ai-workflow-step-button.is-pending {
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-placeholder);
}

.ai-workflow-step-button:hover,
.ai-workflow-step-button.is-active {
  background: var(--el-fill-color-light);
}

.ai-workflow-step-button.is-pending:hover,
.ai-workflow-step-button.is-pending.is-active {
  background: var(--el-fill-color-lighter);
}

.ai-workflow-step-button.is-active .ai-workflow-step-index {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

.ai-workflow-step-index {
  align-items: center;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  color: var(--el-text-color-secondary);
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  height: 28px;
  justify-content: center;
  line-height: 1;
  width: 28px;
}

.ai-workflow-step-copy {
  min-width: 0;
}

.ai-workflow-step-title-row {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.ai-workflow-step-title {
  color: var(--el-text-color-primary);
  display: block;
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  min-width: 120px;
  overflow-wrap: anywhere;
}

.ai-workflow-step-status {
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.4;
  padding: 1px 7px;
}

.ai-workflow-step-status.is-completed {
  border-color: var(--el-color-success-light-5);
  color: var(--el-color-success);
}

.ai-workflow-step-status.is-running,
.ai-workflow-step-status.is-retrying,
.ai-workflow-step-status.is-warning {
  border-color: var(--el-color-warning-light-5);
  color: var(--el-color-warning);
}

.ai-workflow-step-status.is-stopping,
.ai-workflow-step-status.is-failed {
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}

.ai-workflow-step-status.is-pending,
.ai-workflow-step-status.is-recorded {
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-secondary);
}

.ai-workflow-step-status.is-pending {
  color: var(--el-text-color-placeholder);
}

.ai-workflow-step-subtitle {
  color: var(--el-text-color-secondary);
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 2px;
  overflow-wrap: anywhere;
}

.ai-workflow-step-button.is-completed .ai-workflow-step-index {
  border-color: var(--el-color-success-light-5);
  color: var(--el-color-success);
}

.ai-workflow-step-button.is-running .ai-workflow-step-index,
.ai-workflow-step-button.is-retrying .ai-workflow-step-index,
.ai-workflow-step-button.is-warning .ai-workflow-step-index {
  border-color: var(--el-color-warning-light-5);
  color: var(--el-color-warning);
}

.ai-workflow-step-button.is-stopping .ai-workflow-step-index,
.ai-workflow-step-button.is-failed .ai-workflow-step-index {
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}

.ai-workflow-step-button.is-pending .ai-workflow-step-index {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
}

.ai-workflow-step-button.is-pending .ai-workflow-step-title,
.ai-workflow-step-button.is-pending .ai-workflow-step-subtitle {
  color: var(--el-text-color-placeholder);
}

.ai-workflow-step-button.is-active .ai-workflow-step-index {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

.ai-workflow-step-button.is-pending.is-active .ai-workflow-step-index {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
}

.ai-workflow-detail {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  min-width: 0;
  padding: 16px;
}

.ai-workflow-detail-header {
  align-items: flex-start;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding-bottom: 14px;
}

.ai-workflow-detail-header > div:first-child {
  min-width: 0;
}

.ai-workflow-detail-title {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
}

.ai-workflow-detail-description {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
  margin-top: 4px;
}

.ai-workflow-badges {
  display: flex;
  flex: 0 1 min(420px, 48%);
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  max-width: 48%;
  min-width: 0;
}

.ai-workflow-badges :deep(.el-tag) {
  height: auto;
  max-width: 100%;
  min-height: 24px;
  white-space: normal;
}

.ai-workflow-badges :deep(.el-tag__content) {
  line-height: 1.4;
  overflow-wrap: anywhere;
  white-space: normal;
}

.ai-workflow-io-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16px;
}

.ai-workflow-io-panel {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  min-width: 0;
  padding: 12px;
}

.ai-workflow-io-panel.is-input {
  border-top: 3px solid var(--el-color-info-light-5);
}

.ai-workflow-io-panel.is-output {
  border-top: 3px solid var(--el-color-success-light-5);
}

.ai-workflow-io-heading {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  margin-bottom: 10px;
}

.ai-workflow-section {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin-top: 10px;
  min-width: 0;
  padding: 12px;
}

.ai-workflow-section.is-input {
  border-left: 3px solid var(--el-color-info-light-5);
}

.ai-workflow-section.is-output {
  border-left: 3px solid var(--el-color-success-light-5);
}

.ai-workflow-section.is-warning {
  border-left: 3px solid var(--el-color-warning-light-5);
}

.ai-workflow-section-title-row {
  align-items: flex-start;
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.ai-workflow-section-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
}

.ai-workflow-section-description {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 2px;
}

.ai-workflow-text-block {
  margin-top: 10px;
}

.ai-workflow-text-title {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  margin-bottom: 4px;
}

.ai-workflow-text-content {
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  line-height: 1.7;
  max-height: 260px;
  overflow: auto;
  overflow-wrap: anywhere;
  padding: 10px;
  white-space: pre-wrap;
}

.ai-workflow-text-note {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}

.ai-workflow-image-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-top: 10px;
}

.ai-workflow-image-grid.is-item {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.ai-workflow-image-card {
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  min-width: 0;
  overflow: hidden;
}

.ai-workflow-image-title {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
  padding: 8px 9px 6px;
}

.ai-workflow-image {
  aspect-ratio: 16 / 9;
  background: var(--el-fill-color-lighter);
  display: block;
  object-fit: contain;
  width: 100%;
}

.ai-workflow-image-description {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  padding: 7px 9px 8px;
}

.ai-workflow-item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.ai-workflow-item {
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  min-width: 0;
  padding: 9px 10px;
}

.ai-workflow-item-label {
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ai-workflow-item-value {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.6;
  margin-top: 3px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.ai-workflow-item-meta {
  color: var(--el-text-color-secondary);
  display: flex;
  flex-wrap: wrap;
  font-size: 12px;
  gap: 6px 10px;
  line-height: 1.5;
  margin-top: 6px;
  word-break: break-all;
}

.ai-workflow-empty-text {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
  padding: 8px 0;
}

@media (max-width: 1023px) {
  .ai-workflow-summary,
  .ai-workflow-body,
  .ai-workflow-io-grid {
    grid-template-columns: 1fr;
  }

  .ai-workflow-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ai-workflow-step-list {
    max-height: none;
  }
}

@media (max-width: 767px) {
  .ai-workflow-summary,
  .ai-workflow-detail {
    padding: 12px;
  }

  .ai-workflow-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-workflow-step-button.is-child {
    margin-left: 10px;
    width: calc(100% - 10px);
  }

  .ai-workflow-detail-header {
    flex-direction: column;
  }

  .ai-workflow-badges {
    justify-content: flex-start;
    max-width: 100%;
    width: 100%;
  }
}
</style>
