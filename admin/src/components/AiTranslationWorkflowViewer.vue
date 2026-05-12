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
            v-for="step in steps"
            :key="step.id"
            type="button"
            class="ai-workflow-step-button"
            :class="getStepButtonClass(step)"
            @click="selectStep(step.id)"
          >
            <span class="ai-workflow-step-index">{{ step.order }}</span>
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
                第 {{ activeStep.order }} 步：{{ activeStep.title }}
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
                v-for="badge in activeStep.badges"
                :key="badge.label + badge.value"
                size="small"
                effect="plain"
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
                v-for="section in activeStep.inputSections"
                :key="section.id || section.title"
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
                  v-for="block in section.textBlocks"
                  :key="block.title"
                  class="ai-workflow-text-block"
                >
                  <div class="ai-workflow-text-title">{{ block.title }}</div>
                  <div class="ai-workflow-text-content">{{ block.text }}</div>
                  <div v-if="block.truncated" class="ai-workflow-text-note">
                    已展示前 {{ block.text.length }} 字，原内容共
                    {{ block.charLength }} 字。
                  </div>
                </div>
                <div v-if="section.items.length" class="ai-workflow-item-list">
                  <div
                    v-for="item in section.items"
                    :key="item.label + item.value"
                    class="ai-workflow-item"
                  >
                    <div class="ai-workflow-item-label">{{ item.label }}</div>
                    <div class="ai-workflow-item-value">{{ item.value }}</div>
                    <div v-if="item.meta?.length" class="ai-workflow-item-meta">
                      <span v-for="meta in item.meta" :key="meta">
                        {{ meta }}
                      </span>
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
                v-for="section in activeStep.outputSections"
                :key="section.id || section.title"
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
                  v-for="block in section.textBlocks"
                  :key="block.title"
                  class="ai-workflow-text-block"
                >
                  <div class="ai-workflow-text-title">{{ block.title }}</div>
                  <div class="ai-workflow-text-content">{{ block.text }}</div>
                  <div v-if="block.truncated" class="ai-workflow-text-note">
                    已展示前 {{ block.text.length }} 字，原内容共
                    {{ block.charLength }} 字。
                  </div>
                </div>
                <div v-if="section.items.length" class="ai-workflow-item-list">
                  <div
                    v-for="item in section.items"
                    :key="item.label + item.value"
                    class="ai-workflow-item"
                  >
                    <div class="ai-workflow-item-label">{{ item.label }}</div>
                    <div class="ai-workflow-item-value">{{ item.value }}</div>
                    <div v-if="item.meta?.length" class="ai-workflow-item-meta">
                      <span v-for="meta in item.meta" :key="meta">
                        {{ meta }}
                      </span>
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
    hasWorkflow() {
      return this.steps.length > 0
    },
    activeStep() {
      return (
        this.steps.find(step => step.id === this.activeStepId) ||
        this.steps[0] ||
        null
      )
    },
    metricList() {
      return [
        {
          label: '工作步骤',
          value: this.summary.stepCount || this.steps.length
        },
        { label: 'AI 调用', value: this.summary.aiCallCount || 0 },
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
        if (!Array.isArray(steps) || steps.length === 0) {
          this.activeStepId = ''
          return
        }
        const hasActiveStep = steps.some(step => step.id === this.activeStepId)
        if (!hasActiveStep) {
          this.activeStepId = this.getPreferredActiveStep(steps).id
        }
      }
    }
  },
  methods: {
    selectStep(stepId) {
      this.activeStepId = stepId
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
      const completedSteps = steps.filter(step => step.status === 'completed')
      if (completedSteps.length > 0) {
        return completedSteps[completedSteps.length - 1]
      }
      return steps[0]
    },
    getStepButtonClass(step) {
      return {
        'is-active': step.id === this.activeStepId,
        'is-completed': step.status === 'completed',
        'is-running': step.status === 'running',
        'is-retrying': step.status === 'retrying',
        'is-stopping': step.status === 'stopping',
        'is-failed': step.status === 'failed',
        'is-pending': step.status === 'pending'
      }
    },
    getStepStatusText(step) {
      if (step?.statusText) {
        return step.statusText
      }
      const statusTextMap = {
        pending: '待执行',
        running: '正在执行',
        retrying: '重试中',
        completed: '已完成',
        failed: '执行失败',
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
        parts.push(step.stage)
      }
      return parts.join(' / ') || '服务端处理步骤'
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
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

.ai-workflow-step-button:hover,
.ai-workflow-step-button.is-active {
  background: var(--el-fill-color-light);
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
.ai-workflow-step-status.is-retrying {
  border-color: var(--el-color-warning-light-5);
  color: var(--el-color-warning);
}

.ai-workflow-step-status.is-stopping,
.ai-workflow-step-status.is-failed {
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}

.ai-workflow-step-status.is-pending {
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-secondary);
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
.ai-workflow-step-button.is-retrying .ai-workflow-step-index {
  border-color: var(--el-color-warning-light-5);
  color: var(--el-color-warning);
}

.ai-workflow-step-button.is-stopping .ai-workflow-step-index,
.ai-workflow-step-button.is-failed .ai-workflow-step-index {
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}

.ai-workflow-step-button.is-active .ai-workflow-step-index {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
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
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
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

  .ai-workflow-detail-header {
    flex-direction: column;
  }

  .ai-workflow-badges {
    justify-content: flex-start;
  }
}
</style>
