<template>
  <div class="common-right-panel-form translation-job-list-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>AI</el-breadcrumb-item>
        <el-breadcrumb-item>AI 翻译任务</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="translation-search-form"
          @submit.prevent
          @keypress.enter="getJobList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="标题、任务 ID、源 ID"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.jobType"
              placeholder="任务类型"
              clearable
              style="width: 180px"
            >
              <el-option
                v-for="item in jobTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.status"
              placeholder="任务状态"
              clearable
              style="width: 150px"
            >
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getJobList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr translation-actions">
        <div class="translation-action-buttons">
          <el-button
            class="translation-batch-delete-button"
            type="danger"
            size="small"
            :disabled="selectedDeletableJobIds.length === 0"
            :loading="batchDeleting"
            @click="deleteSelectedJobs"
          >
            批量删除
            <span v-if="selectedDeletableJobIds.length > 0">
              {{ selectedDeletableJobIds.length }}
            </span>
          </el-button>
          <el-button
            class="translation-refresh-button"
            size="small"
            @click="refreshJobPage(true)"
          >
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <div
      class="translation-job-storage-panel mb20"
      v-loading="jobStorageSummaryLoading"
    >
      <div class="translation-job-storage-header">
        <div>
          <div class="translation-job-storage-title">AI 翻译任务与日志存储</div>
          <div class="translation-job-storage-subtitle">
            {{ jobStorageUpdatedText }}
          </div>
        </div>
        <el-tooltip content="刷新存储统计" placement="top">
          <el-button text @click="getJobStorageSummary">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
      <div class="translation-job-storage-metrics">
        <div class="translation-job-storage-metric">
          <span>总占用</span>
          <strong>{{ formatBytes(jobStorageTotals.totalSizeBytes) }}</strong>
        </div>
        <div class="translation-job-storage-metric">
          <span>任务表占用</span>
          <strong>{{ formatBytes(jobStorageTotals.databaseSizeBytes) }}</strong>
        </div>
        <div class="translation-job-storage-metric">
          <span>缓存图片</span>
          <strong>{{ formatBytes(jobStorageTotals.cacheSizeBytes) }}</strong>
        </div>
        <div class="translation-job-storage-metric">
          <span>AI日志</span>
          <strong>{{ formatBytes(jobStorageTotals.aiLogSizeBytes) }}</strong>
        </div>
        <div class="translation-job-storage-metric">
          <span>表内文档</span>
          <strong>{{ jobStorageTotals.documentCount || 0 }}</strong>
        </div>
      </div>
      <div class="translation-job-storage-table-list">
        <div
          v-for="table in jobStorageTables"
          :key="table.key"
          class="translation-job-storage-table-row"
        >
          <div>
            <strong>{{ table.label }}</strong>
            <span>{{ table.collectionName }}</span>
          </div>
          <div>
            文档 {{ table.documentCount || 0 }}，平均
            {{ formatBytes(table.avgObjSizeBytes) }}
          </div>
        </div>
        <div
          v-for="cacheItem in jobStorageFileCaches"
          :key="cacheItem.key"
          class="translation-job-storage-table-row"
        >
          <div>
            <strong>{{ cacheItem.label }}</strong>
            <span>{{ getFileCacheTypeText(cacheItem) }}</span>
          </div>
          <div>
            文件 {{ cacheItem.fileCount || 0 }}，目录
            {{ cacheItem.directoryCount || 0 }}，占用
            {{ formatBytes(cacheItem.totalSizeBytes) }}
          </div>
        </div>
      </div>
    </div>

    <el-alert
      v-if="orphanJobs.length > 0"
      class="orphan-job-alert mb20"
      type="error"
      :closable="false"
      show-icon
    >
      <template #title>
        检测到 {{ orphanJobs.length }} 个孤儿任务（其 rootId 未指向有效的 root
        任务，可能由历史 bug
        产生）。它们已在下方列表顶部以红色标出，请确认后删除，或运行
        server/tools/cleanupOrphanTranslationJobs.js 统一清理。
      </template>
    </el-alert>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="jobList"
        row-key="_id"
        height="100%"
        border
        :row-class-name="getJobRowClassName"
        @selection-change="handleJobSelectionChange"
      >
        <ResponsiveTableColumn
          type="selection"
          width="48"
          :selectable="isJobSelectable"
          reserve-selection
        />
        <ResponsiveTableColumn label="任务" min-width="260">
          <template #default="{ row }">
            <div class="source-title">
              {{ row.source?.title || row.target?.title || row._id }}
            </div>
            <div class="source-meta">{{ row._id }}</div>
            <div class="source-meta">
              {{ getJobTypeText(row.jobType) }}
            </div>
            <div
              v-if="getTaskRelationText(row.taskRelation)"
              class="translation-task-relation"
            >
              {{ getTaskRelationText(row.taskRelation) }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="目标" min-width="170">
          <template #default="{ row }">
            <el-tag v-if="row.target?.languageCode" size="small" effect="plain">
              {{ getLanguageText(row.target.languageCode) }}
            </el-tag>
            <div
              v-else-if="row.target?.languageCodes?.length"
              class="table-tag-list"
            >
              <el-tag
                v-for="languageCode in row.target.languageCodes"
                :key="languageCode"
                size="small"
                effect="plain"
              >
                {{ getLanguageText(languageCode) }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="状态" min-width="220">
          <template #default="{ row }">
            <div class="job-status-cell">
              <el-tag :type="getStatusTagType(row.status)" effect="plain">
                {{ row.status }}
              </el-tag>
              <div v-if="row.runtimeState" class="source-meta">
                {{ row.runtimeState }}
              </div>
              <el-tooltip
                v-if="
                  row.status === '执行失败' && getFailureReasonText(row.failure)
                "
                :content="getFailureReasonText(row.failure)"
                placement="top-start"
                :show-after="200"
              >
                <div class="job-status-reason">
                  {{ getFailureReasonText(row.failure) }}
                </div>
              </el-tooltip>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="进度" min-width="170">
          <template #default="{ row }">
            <el-progress
              :percentage="Number(row.progress?.percent || 0)"
              :stroke-width="8"
            />
            <div class="source-meta">
              {{ getProgressStageText(row.progress?.currentStage) }}
            </div>
            <div v-if="row.progress?.currentStep" class="job-progress-step">
              {{ row.progress.currentStep }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="队列" width="120">
          <template #default="{ row }">
            <span v-if="row.queuePosition">#{{ row.queuePosition }}</span>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="330" fixed="right">
          <template #default="{ row }">
            <div class="job-row-actions" @click.stop>
              <el-button type="primary" size="small" @click="openDetail(row)">
                详情
              </el-button>
              <el-button
                v-if="canDeferJob(row)"
                size="small"
                @click="deferJob(row)"
              >
                暂缓
              </el-button>
              <el-button
                v-if="canResumeJob(row)"
                size="small"
                type="primary"
                @click="resumeJob(row)"
              >
                恢复
              </el-button>
              <el-button
                v-if="canRetry(row)"
                size="small"
                type="warning"
                @click="retryJob(row)"
              >
                重试
              </el-button>
              <el-button
                v-if="canStop(row)"
                size="small"
                type="danger"
                @click="stopJob(row)"
              >
                停止
              </el-button>
              <el-button
                v-if="canReject(row)"
                size="small"
                type="warning"
                @click="rejectJob(row)"
              >
                不采纳
              </el-button>
              <el-button
                v-if="canDelete(row)"
                size="small"
                type="danger"
                @click="deleteJob(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>

    <div class="clearfix">
      <el-pagination
        class="fr"
        background
        layout="total, prev, pager, next"
        :total="total"
        :pager-count="5"
        size="small"
        v-model:current-page="params.page"
        v-model:page-size="params.limit"
      />
    </div>

    <el-drawer
      v-model="detailDrawerVisible"
      title="AI 翻译任务"
      size="80%"
      class="translation-job-detail-drawer"
    >
      <template v-if="currentJob">
        <div class="detail-header">
          <div>
            <div class="source-title">
              {{ currentJob.source?.title || currentJob._id }}
            </div>
            <div class="source-meta">{{ currentJob._id }}</div>
          </div>
          <div class="detail-header-actions">
            <el-button @click="refreshDetail"> 刷新 </el-button>
            <el-button v-if="hasAiWorkflow" @click="openAiWorkflowDialog">
              查看 AI 工作流
            </el-button>
            <el-button
              v-if="canCleanupCoverImages"
              :loading="coverImageCleanupLoading"
              @click="cleanupCoverImages"
            >
              清理封面临时文件
            </el-button>
            <el-button
              v-if="canStop(currentJob)"
              type="danger"
              @click="stopJob(currentJob)"
            >
              停止
            </el-button>
            <el-button
              v-if="canApplyCurrentJob"
              type="primary"
              :disabled="selectedEntryKeys.length === 0"
              @click="applySelectedEntries"
            >
              采纳所选
            </el-button>
            <el-button
              v-if="canApplyCurrentJob && isParentReview"
              type="primary"
              @click="applyParentAll"
            >
              采纳全部
            </el-button>
            <el-button
              v-if="isRootOverview"
              type="primary"
              @click="applyFamilyAll"
            >
              采纳全部
            </el-button>
          </div>
        </div>

        <div class="detail-summary">
          <el-tag :type="getStatusTagType(currentJob.status)" effect="plain">
            {{ currentJob.status }}
          </el-tag>
          <span>{{ getJobTypeText(currentJob.jobType) }}</span>
          <span>{{ formatDate(currentJob.createdAt) }}</span>
          <span v-if="currentJob.result?.previewEntries?.length">
            {{ currentJob.result.previewEntries.length }} 项
          </span>
        </div>

        <el-alert
          v-if="aiJsonLogStorageMissing"
          class="ai-json-log-missing-alert"
          :title="aiJsonLogStorageMissingMessage"
          type="warning"
          show-icon
          :closable="false"
        />

        <div v-if="hasExecutionWorkflow" class="job-workflow-panel">
          <div class="job-workflow-panel-header">
            <div>
              <div class="job-workflow-panel-title">执行工作流</div>
              <div class="job-workflow-panel-subtitle">
                <span v-if="currentJob.runtimeState">
                  {{ currentJob.runtimeState }}
                </span>
                <span v-if="currentJob.progress?.currentStage">
                  {{ getProgressStageText(currentJob.progress.currentStage) }}
                </span>
                <span v-if="currentJob.runtime?.heartbeatAt">
                  心跳：{{ formatDate(currentJob.runtime.heartbeatAt) }}
                </span>
              </div>
            </div>
            <div class="job-workflow-panel-tags">
              <el-tag
                v-if="currentWorkflowStep"
                size="small"
                effect="plain"
                :type="getWorkflowStepStatusTagType(currentWorkflowStep)"
              >
                {{ getWorkflowStepStatusText(currentWorkflowStep) }}
              </el-tag>
              <el-tag
                v-if="currentJob.runtime?.attempts"
                size="small"
                effect="plain"
              >
                第 {{ currentJob.runtime.attempts }} 次执行
              </el-tag>
            </div>
          </div>
          <el-progress
            class="job-workflow-progress"
            :percentage="workflowProgressPercent"
            :stroke-width="8"
          />
          <div v-if="currentWorkflowStep" class="job-workflow-current">
            <div class="job-workflow-current-label">当前工作流</div>
            <div class="job-workflow-current-title">
              {{ currentWorkflowStep.title }}
            </div>
            <div class="job-workflow-current-step">
              {{ getWorkflowStepCurrentText(currentWorkflowStep) }}
            </div>
            <div class="job-workflow-current-meta">
              <span v-if="currentWorkflowStep.stage">
                阶段：{{ getProgressStageText(currentWorkflowStep.stage) }}
              </span>
              <span v-if="currentJob.runtime?.workerId">
                Worker：{{ currentJob.runtime.workerId }}
              </span>
              <span v-if="currentJob.runtime?.leaseExpiresAt">
                租约到期：{{ formatDate(currentJob.runtime.leaseExpiresAt) }}
              </span>
            </div>
          </div>
          <div class="job-workflow-timeline">
            <div
              v-for="step in executionWorkflowSteps"
              :key="step.id"
              class="job-workflow-step"
              :class="getWorkflowStepClass(step)"
            >
              <div class="job-workflow-step-index">{{ step.order }}</div>
              <div class="job-workflow-step-content">
                <div class="job-workflow-step-title-row">
                  <div class="job-workflow-step-title">{{ step.title }}</div>
                  <el-tag
                    size="small"
                    effect="plain"
                    :type="getWorkflowStepStatusTagType(step)"
                  >
                    {{ getWorkflowStepStatusText(step) }}
                  </el-tag>
                </div>
                <div class="job-workflow-step-subtitle">
                  {{ getWorkflowStepSubtitle(step) }}
                </div>
              </div>
            </div>
          </div>
          <div v-if="workflowRecentLogs.length" class="job-workflow-log-list">
            <div class="job-workflow-log-title">最近日志</div>
            <div
              v-for="log in workflowRecentLogs"
              :key="log.createdAt + log.message"
              class="job-workflow-log-item"
            >
              <span>{{ formatDate(log.createdAt) }}</span>
              <span>{{ log.message }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="
            currentJob.status === '执行失败' &&
            getFailureReasonText(currentJob.failure)
          "
          class="job-state-panel job-state-panel-danger"
        >
          <div class="job-state-panel-header">
            <div>
              <div class="job-state-panel-title">任务执行失败</div>
              <div class="job-state-panel-subtitle">
                {{ getFailureSubtitle(currentJob.failure) }}
              </div>
            </div>
            <div class="job-state-panel-tags">
              <el-tag
                v-if="currentJob.failure?.errorCode"
                type="danger"
                effect="plain"
                size="small"
              >
                {{ getFailureCodeLabel(currentJob.failure) }}
              </el-tag>
              <el-tag effect="plain" size="small">
                {{
                  currentJob.failure?.retryable === true ? '可重试' : '不可重试'
                }}
              </el-tag>
            </div>
          </div>
          <div class="job-state-panel-message">
            {{ getFailureReasonText(currentJob.failure) }}
          </div>
          <div
            v-if="getFailureCodeMeaning(currentJob.failure)"
            class="job-state-panel-code-hint"
          >
            错误码说明：{{ getFailureCodeMeaning(currentJob.failure) }}
          </div>
          <div class="job-state-panel-meta">
            <span v-if="currentJob.failure?.lastFailedAt">
              失败时间：{{ formatDate(currentJob.failure.lastFailedAt) }}
            </span>
            <span v-if="currentJob.failure?.attempts">
              失败次数：第 {{ currentJob.failure.attempts }} 次
            </span>
            <span v-if="currentJob.failure?.failedStep">
              失败阶段：{{ currentJob.failure.failedStep }}
            </span>
          </div>
        </div>

        <div v-if="conflictList.length" class="conflict-panel">
          <div class="conflict-title">采纳冲突</div>
          <div
            v-for="item in conflictList"
            :key="item.entryKey"
            class="conflict-item"
          >
            <el-tag size="small" type="warning" effect="plain">
              {{ item.code }}
            </el-tag>
            <span>{{ item.label || item.entryKey }}</span>
            <span>{{ item.message }}</span>
          </div>
        </div>

        <div v-if="canApplyCurrentJob" class="apply-toolbar">
          <el-checkbox v-model="applyForm.force">强制覆盖</el-checkbox>
          <el-checkbox v-model="applyForm.publish">采纳后发布</el-checkbox>
          <el-input
            v-model="applyForm.forceReason"
            placeholder="强制覆盖原因"
            clearable
          />
        </div>

        <div v-if="isRootOverview" class="family-parent-card-list">
          <div class="family-parent-card-list-title">
            包含 {{ familyParentCards.length }} 篇文章，点击查看各文章的翻译结果
          </div>
          <div
            v-for="parent in familyParentCards"
            :key="parent._id"
            class="family-parent-card"
            @click="openDetail(parent)"
          >
            <div class="family-parent-card-main">
              <div class="family-parent-card-title">
                {{ parent.source?.title || parent.target?.title || parent._id }}
              </div>
              <div class="family-parent-card-meta">
                {{ getTaskRelationText(parent.taskRelation) }}
              </div>
            </div>
            <div class="family-parent-card-status">
              <el-tag :type="getStatusTagType(parent.status)" effect="plain">
                {{ parent.status }}
              </el-tag>
              <el-icon class="family-parent-card-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>

        <el-tabs
          v-if="reviewLanguageTabs.length > 0 && !isRootOverview"
          v-model="activeReviewLanguageCode"
          class="ai-preview-tabs translation-job-review-tabs"
        >
          <el-tab-pane
            v-for="tab in reviewLanguageTabs"
            :key="tab.languageCode"
            :label="tab.label"
            :name="tab.languageCode"
          >
            <el-descriptions class="mb20" :column="4" border>
              <el-descriptions-item label="可采纳条目">
                {{ tab.entryKeys.length }}
              </el-descriptions-item>
              <el-descriptions-item label="跳过条目">
                {{ tab.skippedEntries.length }}
              </el-descriptions-item>
              <el-descriptions-item label="已采纳条目">
                {{ getAppliedEntryCount(tab.reviewEntries) }}
              </el-descriptions-item>
              <el-descriptions-item label="已选择">
                {{ getSelectedEntryCount(tab.entryKeys) }}
              </el-descriptions-item>
              <el-descriptions-item label="封面图">
                {{ tab.coverImageEntries.length }}
              </el-descriptions-item>
            </el-descriptions>

            <div
              v-if="tab.skippedEntries.length > 0"
              class="translation-json-warning-list"
            >
              <div class="translation-json-group-title">跳过说明</div>
              <TranslationSkippedEntryPreviewList
                :entries="tab.skippedEntries"
                current-label="当前"
                source-label="源文"
              />
            </div>

            <div
              v-if="tab.coverImageEntries.length > 0"
              class="cover-image-review-section"
            >
              <div class="translation-json-group-title">封面图</div>
              <div
                v-for="item in tab.coverImageEntries"
                :key="item.id"
                class="cover-image-review-item"
              >
                <div class="cover-image-review-header">
                  <div class="cover-image-review-title-row">
                    <el-checkbox
                      class="cover-image-review-select"
                      :model-value="selectedEntryKeys.includes(item.id)"
                      :disabled="!canSelectCoverImage(item)"
                      :aria-label="`${item.targetTitle || item.sourceTitle || '未命名封面'} 采纳选择`"
                      @change="checked => setCoverImageSelected(item, checked)"
                    />
                    <div class="cover-image-review-title">
                      {{ item.targetTitle || item.sourceTitle || '未命名封面' }}
                    </div>
                  </div>
                  <el-tag
                    size="small"
                    :type="getCoverImageStatusTagType(item)"
                    effect="plain"
                  >
                    {{ getCoverImageStatusText(item) }}
                  </el-tag>
                </div>
                <div class="cover-image-review-grid">
                  <div class="cover-image-preview-panel">
                    <div class="cover-image-preview-label">源封面</div>
                    <img
                      v-if="item.sourceCoverUrl"
                      class="cover-image-preview-img"
                      :src="item.sourceCoverUrl"
                      alt=""
                    />
                    <div v-else class="cover-image-preview-empty">-</div>
                  </div>
                  <div class="cover-image-preview-panel">
                    <div class="cover-image-preview-label">AI 封面</div>
                    <img
                      v-if="item.generatedCoverUrl"
                      class="cover-image-preview-img"
                      :src="item.generatedCoverUrl"
                      alt=""
                    />
                    <div v-else class="cover-image-preview-empty">-</div>
                  </div>
                </div>
                <div
                  v-if="item.warningMessage || item.recognition?.reason"
                  class="cover-image-review-message"
                >
                  {{ item.warningMessage || item.recognition.reason }}
                </div>
                <div v-if="item.isApplied" class="cover-image-review-adoption">
                  <el-tag size="small" type="success" effect="plain">
                    已采纳
                  </el-tag>
                  <span class="cover-image-review-adoption-text">
                    采纳时间：{{ formatDate(item.appliedAt) }}
                  </span>
                  <span class="cover-image-review-adoption-text">
                    采纳人：{{ item.appliedByName || '-' }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-if="tab.entryKeys.length > 0"
              class="translation-json-toolbar"
            >
              <div class="translation-dialog-intro">
                <div class="translation-dialog-intro-title">选择采纳字段</div>
                <div class="translation-dialog-intro-text">
                  默认仅勾选未采纳条目，已选择
                  {{ getSelectedEntryCount(tab.entryKeys) }}
                  项。重新勾选已采纳条目时会二次确认。
                </div>
              </div>
              <div
                v-if="canApplyCurrentJob"
                class="translation-json-toolbar-actions"
              >
                <el-button size="small" @click="selectAllReviewEntries(tab)">
                  全选
                </el-button>
                <el-button size="small" @click="clearReviewEntries(tab)">
                  清空
                </el-button>
              </div>
            </div>

            <TranslationEntrySelectableGroups
              v-if="tab.groups.length > 0"
              v-model="selectedEntryKeys"
              :groups="tab.groups"
              :disabled="!canApplyCurrentJob"
              :show-adoption-info="true"
              :before-entry-select="beforeReviewEntrySelect"
              :before-group-select="beforeReviewGroupSelect"
              current-preview-label="当前"
              source-preview-label="源文"
              next-preview-label="AI 翻译后"
              class="w_10"
            />

            <el-empty
              v-if="
                tab.groups.length === 0 &&
                tab.skippedEntries.length === 0 &&
                tab.coverImageEntries.length === 0
              "
              description="暂无结果"
            />

            <div v-if="tab.validation" class="translation-validation-card">
              <div class="translation-validation-header">
                <div class="translation-json-group-title">AI 校验报告</div>
                <div class="translation-validation-tags">
                  <el-tag
                    size="small"
                    :type="
                      tab.validation.status === 'completed' ? 'success' : 'info'
                    "
                    effect="plain"
                  >
                    {{
                      tab.validation.status === 'completed'
                        ? '已校验'
                        : '已跳过'
                    }}
                  </el-tag>
                  <el-tag
                    v-if="tab.validation.provider"
                    size="small"
                    effect="plain"
                  >
                    {{ tab.validation.provider }}
                  </el-tag>
                  <el-tag
                    v-if="tab.validation.model"
                    size="small"
                    effect="plain"
                  >
                    {{ tab.validation.model }}
                  </el-tag>
                </div>
              </div>
              <div
                v-if="tab.validation.summary"
                class="translation-validation-summary"
              >
                {{ tab.validation.summary }}
              </div>
              <div class="translation-validation-stats">
                <span
                  >校验条目：{{ tab.validation.stats?.totalEntries || 0 }}</span
                >
                <span
                  >修正条目：{{
                    tab.validation.stats?.changedEntries || 0
                  }}</span
                >
                <span
                  >统一术语：{{ tab.validation.stats?.termCount || 0 }}</span
                >
                <span
                  >问题：{{
                    tab.validation.stats?.confirmedIssueCount || 0
                  }}</span
                >
              </div>
              <div
                v-if="(tab.validation.corrections || []).length > 0"
                class="translation-validation-section"
              >
                <div class="translation-validation-section-title">修正明细</div>
                <div
                  v-for="(item, index) in tab.validation.corrections"
                  :key="`correction-${item.id}-${index}`"
                  class="translation-validation-correction"
                >
                  <div class="translation-validation-correction-label">
                    {{ item.label }}
                  </div>
                  <div
                    v-if="item.reason"
                    class="translation-validation-correction-reason"
                  >
                    <span
                      class="translation-validation-correction-reason-prefix"
                      >修改理由：</span
                    >{{ item.reason }}
                  </div>
                  <div class="translation-validation-correction-diff">
                    <span class="translation-validation-before">
                      <span class="translation-validation-diff-prefix"
                        >修正前：</span
                      >
                      <template v-if="getCorrectionDiff(item).before.length">
                        <span
                          v-for="(seg, segIndex) in getCorrectionDiff(item)
                            .before"
                          :key="`before-${segIndex}`"
                          :class="{
                            'translation-validation-diff-removed': seg.changed
                          }"
                          >{{ seg.text }}</span
                        >
                      </template>
                      <template v-else>-</template>
                    </span>
                    <span class="translation-validation-after">
                      <span class="translation-validation-diff-prefix"
                        >修正后：</span
                      >
                      <template v-if="getCorrectionDiff(item).after.length">
                        <span
                          v-for="(seg, segIndex) in getCorrectionDiff(item)
                            .after"
                          :key="`after-${segIndex}`"
                          :class="{
                            'translation-validation-diff-added': seg.changed
                          }"
                          >{{ seg.text }}</span
                        >
                      </template>
                      <template v-else>-</template>
                    </span>
                  </div>
                </div>
              </div>
              <div
                v-else-if="tab.validation.status === 'completed'"
                class="translation-validation-empty-text"
              >
                校验未发现需要修正的内容。
              </div>
              <div
                v-if="(tab.validation.guideline?.termGlossary || []).length > 0"
                class="translation-validation-section"
              >
                <div class="translation-validation-section-title">
                  术语统一表
                </div>
                <div
                  v-for="(term, index) in tab.validation.guideline.termGlossary"
                  :key="`term-${index}`"
                  class="translation-validation-term"
                >
                  {{ term.source }} =&gt; {{ term.target }}
                  <span
                    v-if="term.note"
                    class="translation-validation-term-note"
                  >
                    （{{ term.note }}）
                  </span>
                </div>
              </div>
              <div
                v-if="
                  (tab.validation.guideline?.confirmedIssues || []).length > 0
                "
                class="translation-validation-section"
              >
                <div class="translation-validation-section-title">问题清单</div>
                <div
                  v-for="(issue, index) in tab.validation.guideline
                    .confirmedIssues"
                  :key="`issue-${index}`"
                  class="translation-validation-issue"
                >
                  <el-tag
                    size="small"
                    effect="light"
                    :type="getConfirmedIssueStatus(issue, tab.validation).type"
                    class="translation-validation-issue-status"
                  >
                    {{ getConfirmedIssueStatus(issue, tab.validation).text }}
                  </el-tag>
                  <span class="translation-validation-issue-type">
                    [{{ getValidationIssueTypeText(issue.issueType) }}]
                  </span>
                  {{ issue.note }}
                </div>
              </div>
              <div
                v-if="tab.validation.guideline?.styleNotes"
                class="translation-validation-section"
              >
                <div class="translation-validation-section-title">风格基调</div>
                <div class="translation-validation-style-notes">
                  {{ tab.validation.guideline.styleNotes }}
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <el-empty
          v-if="previewEntries.length === 0 && !isRootOverview"
          description="暂无结果"
        />
      </template>
    </el-drawer>

    <el-dialog
      v-model="aiWorkflowDialogVisible"
      title="AI 翻译工作流"
      width="min(1160px, 96vw)"
      align-center
      append-to-body
      destroy-on-close
    >
      <AiTranslationWorkflowViewer :workflow="aiWorkflow" />
    </el-dialog>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh, ArrowRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AiTranslationWorkflowViewer from '@/components/AiTranslationWorkflowViewer.vue'
import ResponsiveTable from '@/components/ResponsiveTable.vue'
import ResponsiveTableColumn from '@/components/ResponsiveTableColumn.vue'
import TranslationEntrySelectableGroups from '@/components/TranslationEntrySelectableGroups.vue'
import TranslationSkippedEntryPreviewList from '@/components/TranslationSkippedEntryPreviewList.vue'
import { multilingualApi } from '@/api'
import {
  restoreListSessionParams,
  saveListSessionParams
} from '@/composables/useListSessionParams'
import { getLanguageText as getSharedLanguageText } from '@/utils/multilingual'
import { getProgressStageText } from '@/utils/translationStage'
import { diffTextSegments } from '@/utils/textDiff'
import { getTranslationGroupDisplayMeta } from '@/utils/translationEntryDisplay'
import { renderRichTextDocument } from '@/utils/translationJson'

const jobTypeOptions = [
  { label: '文章 AI 翻译', value: 'post-ai-translation' },
  { label: '源文生成并 AI 翻译', value: 'source-post-ai-import' },
  { label: '源文章名词整理', value: 'source-post-proper-noun-organize' },
  { label: '通用内容 AI 翻译', value: 'content-ai-translation' }
]
const sourcePostProperNounOrganizeJobType = 'source-post-proper-noun-organize'
const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const STRUCTURED_RICH_TEXT_VALUE_TYPE = 'richTextDocument'

const statusOptions = [
  { label: '未开始', value: '未开始' },
  { label: '执行中', value: '执行中' },
  { label: '执行失败', value: '执行失败' },
  { label: '已阻塞', value: '已阻塞' },
  { label: '等待审核', value: '等待审核' },
  { label: '不采纳', value: '不采纳' },
  { label: '部分采纳', value: '部分采纳' },
  { label: '完全采纳', value: '完全采纳' }
]

// 子任务种类文案。
const childKindLabelMap = {
  'proper-noun-organize': '名词整理',
  'single-language-translation': '单语言翻译',
  'cover-image-organize': '封面图整理'
}

const applyStatusSet = new Set(['等待审核', '不采纳', '部分采纳', '完全采纳'])
const deleteStatusSet = new Set([
  '未开始',
  '执行失败',
  '不采纳',
  '部分采纳',
  '完全采纳'
])

const failureCodeMeaningMap = {
  AI_TRANSLATION_FAILED:
    'AI 服务返回失败，或生成结果未通过当前翻译任务的处理与校验流程。',
  AI_TRANSLATION_CANCELLED:
    '任务执行过程中被后台停止，常见于 worker 租约失效、服务重启或人工中断。',
  AI_PROVIDER_CONFIG_REQUIRED: 'AI 服务配置不完整，当前任务无法发起翻译请求。',
  AI_SETTINGS_INVALID: '当前任务的 AI 参数校验失败，无法继续执行。',
  SERVICE_UNAVAILABLE: '依赖服务暂不可用，请稍后重试。'
}

const failureCodeLabelMap = {
  AI_TRANSLATION_FAILED: 'AI 翻译失败',
  AI_TRANSLATION_CANCELLED: 'AI 翻译已停止',
  AI_PROVIDER_CONFIG_REQUIRED: 'AI 服务配置不完整',
  AI_SETTINGS_INVALID: 'AI 设置校验失败',
  SERVICE_UNAVAILABLE: '服务暂不可用'
}

function normalizePreviewText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function getFirstPreviewText(valueList) {
  if (!Array.isArray(valueList)) {
    return ''
  }
  for (const value of valueList) {
    const text = normalizePreviewText(value)
    if (text) {
      return text
    }
  }
  return ''
}

function isRichTextValueType(valueType) {
  if (valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    return true
  }
  return valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE
}

function parseRichTextDocumentValue(value) {
  if (value === null || typeof value === 'undefined') {
    return null
  }
  if (typeof value === 'object') {
    return value
  }

  const text = normalizePreviewText(value)
  if (!text) {
    return null
  }

  try {
    const parsedValue = JSON.parse(text)
    if (parsedValue && typeof parsedValue === 'object') {
      return parsedValue
    }
  } catch {
    return null
  }

  return null
}

function renderRichTextDocumentPreview(value) {
  const documentValue = parseRichTextDocumentValue(value)
  if (!documentValue) {
    return ''
  }

  try {
    return normalizePreviewText(renderRichTextDocument(documentValue))
  } catch {
    return ''
  }
}

function getRichTextPreviewHtml(valueType, rawValues) {
  if (valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    return getFirstPreviewText(rawValues)
  }

  if (valueType !== STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return ''
  }

  if (!Array.isArray(rawValues)) {
    return ''
  }

  for (const rawValue of rawValues) {
    const renderedHtml = renderRichTextDocumentPreview(rawValue)
    if (renderedHtml) {
      return renderedHtml
    }
  }

  return ''
}

function getFullPreviewHtml(options = {}) {
  const html = getFirstPreviewText(options.htmlValues)
  if (html) {
    return html
  }

  return getRichTextPreviewHtml(options.valueType, options.rawValues)
}

function stringifyPreviewValue(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return String(value)
  }
}

function getFullPreviewText(options = {}) {
  if (isRichTextValueType(options.valueType)) {
    return getFirstPreviewText(options.previewValues)
  }

  const rawText = getFirstPreviewText(options.rawValues)
  if (rawText) {
    return rawText
  }

  const fallbackText = normalizePreviewText(
    stringifyPreviewValue(options.fallbackValue)
  )
  if (fallbackText) {
    return fallbackText
  }

  return getFirstPreviewText(options.previewValues)
}

function getJsonValueType(value) {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  return typeof value
}
function getJsonTypeLabel(value) {
  const type = getJsonValueType(value)
  const typeLabelMap = {
    array: '数组',
    object: '对象',
    string: '文本',
    number: '数字',
    boolean: '布尔值',
    null: '空值',
    undefined: '未定义'
  }
  return typeLabelMap[type] || type
}

function getJsonCollectionSummary(value) {
  if (Array.isArray(value)) {
    return `子表格：${value.length} 项`
  }
  if (value && typeof value === 'object') {
    return `子表格：${Object.keys(value).length} 个字段`
  }
  return stringifyPreviewValue(value)
}

function getJsonLeafValue(value) {
  if (value === '') {
    return '空字符串'
  }
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  if (typeof value === 'boolean') {
    if (value) {
      return 'true'
    }
    return 'false'
  }
  return stringifyPreviewValue(value)
}

const EXACT_AI_JSON_FIELD_META_MAP = {
  $: [
    'AI JSON 查看内容',
    '当前任务保存的 AI 结果、AI 调用日志和审核辅助数据。'
  ],
  '$.job': [
    '任务信息',
    '任务本身的基础信息，用于定位这份 AI JSON 属于哪个任务。'
  ],
  '$.job.id': ['任务ID', 'AI 翻译任务在数据库中的唯一 ID。'],
  '$.job.jobType': ['任务类型', '文章翻译、源文生成并翻译或通用内容翻译。'],
  '$.job.status': ['任务状态', '当前任务状态。'],
  '$.job.source': ['源文信息', '任务来源语言、源文章或源内容信息。'],
  '$.job.target': ['目标信息', '任务目标语言、目标文章或目标内容信息。'],
  '$.result': ['任务结果', 'translationJobs.result 中保存的完整结果对象。'],
  '$.result.payload': [
    'AI翻译结果JSON',
    'AI 翻译后经过服务端整理的结构化结果，会用于生成审核预览。'
  ],
  '$.result.payload.entries': [
    'AI翻译条目',
    'AI 返回并被服务端整理后的翻译条目数组。'
  ],
  '$.result.aiJsonLogs': [
    'AI调用JSON日志',
    '每一次 AI 请求保存下来的结构化 JSON 记录。'
  ],
  '$.result.previewEntries': [
    '审核预览条目',
    '给管理端审核抽屉展示和采纳用的预览数据。'
  ],
  '$.result.warningList': [
    '警告列表',
    '任务执行中产生但不一定阻断任务的警告。'
  ],
  '$.result.aiSkipList': [
    'AI跳过列表',
    'AI 判断应跳过、保持原文或无需处理的条目。'
  ],
  '$.result.relatedResults': ['关联结果摘要', '递归或关联内容翻译的结果摘要。'],
  '$.result.languageResults': [
    '多语言结果',
    '多语言任务中每种目标语言的执行结果。'
  ],
  '$.result.translationPostMap': [
    '目标文章映射',
    '源文生成并翻译时记录源文与目标文章的映射关系。'
  ],
  '$.result.coverImageArtifacts': [
    '封面图产物',
    '封面图识别、生成、复用或跳过产生的产物记录。'
  ],
  '$.result.coverImageGenerationMap': [
    '封面生成记录',
    '封面图生成阶段按 generationKey 保存的结果。'
  ],
  '$.result.coverImageRecognitionMap': [
    '封面识别记录',
    '封面图识别阶段按 recognitionKey 保存的结果。'
  ],
  '$.result.aiUsage': [
    'AI用量',
    '当前任务汇总的 AI token、provider 或模型用量信息。'
  ],
  '$.result.model': ['翻译模型', '正文翻译阶段使用的模型。'],
  '$.result.requestId': ['请求ID', '正文翻译阶段 provider 返回的请求 ID。'],
  '$.result.sourceSnapshotId': ['源快照ID', '当前任务使用的源内容快照 ID。'],
  '$.result.validation': [
    '校验报告',
    '校验 AI 对全部译文进行全局校验与修正的结果，包含术语统一表、风格说明、问题清单与修正条目。'
  ],
  '$.result.completedAt': ['完成时间', '任务进入等待审核时的完成时间。']
}

const COMMON_AI_JSON_FIELD_META_MAP = {
  _id: ['数据库ID', 'MongoDB 记录 ID。'],
  id: ['ID', '当前对象的唯一标识。'],
  jobId: ['任务ID', '关联的 AI 翻译任务 ID。'],
  jobType: ['任务类型', '说明任务属于内容翻译、文章翻译或源文导入翻译。'],
  status: ['状态', '当前对象或阶段的状态值。'],
  source: ['源信息', '本次处理的来源对象、语言或内容信息。'],
  target: ['目标信息', '本次处理的目标对象、语言或内容信息。'],
  payload: ['结果JSON', '服务端整理后的 AI 结果 JSON。'],
  entries: ['条目列表', '本次 AI 处理或审核展示的条目数组。'],
  entryKey: ['条目键', '用于定位一个可翻译字段或审核条目的稳定键。'],
  collectionName: ['集合名', '这条内容所属的数据库集合名。'],
  contentId: ['内容ID', '当前内容记录 ID。'],
  sourceId: ['源记录ID', '源语言内容或源数据库记录 ID。'],
  targetId: ['目标记录ID', '目标语言内容记录 ID。'],
  postId: ['文章ID', '文章记录 ID。'],
  sourcePostId: ['源文章ID', '源文章记录 ID。'],
  targetPostId: ['目标文章ID', '目标文章记录 ID。'],
  sourceSnapshotId: ['源快照ID', '翻译时读取的源文章快照 ID。'],
  snapshotVersion: ['快照版本', '翻译时使用的源快照版本号。'],
  languageCode: ['语言Code', '当前对象对应的语言 code。'],
  sourceLanguageCode: ['源语言Code', 'AI 输入内容所属的源语言 code。'],
  targetLanguageCode: ['目标语言Code', '本次 AI 输出对应的目标语言 code。'],
  targetLanguageCodes: [
    '目标语言Code列表',
    '一次任务覆盖的全部目标语言 code。'
  ],
  prompt: ['提示词', '用户为本次 AI 翻译补充的提示词。'],
  promptList: ['提示词列表', '实际提交给 AI 的多段提示词。'],
  promptMessages: ['提示消息', '发送给 AI provider 的消息数组。'],
  baseMode: ['翻译基础内容', '说明翻译读取的是源快照还是当前内容。'],
  provider: ['AI服务商', '产生这段结果的 AI provider。'],
  model: ['AI模型', '产生这段结果的模型名称。'],
  requestId: ['请求ID', 'AI provider 返回或服务端生成的请求标识。'],
  operation: [
    '操作类型',
    '说明这条 JSON 属于翻译、关键词抽取、联网检索或封面图处理。'
  ],
  stage: ['执行阶段', '这条记录对应的任务执行阶段。'],
  createdAt: ['创建时间', '记录创建时间。'],
  updatedAt: ['更新时间', '记录最后更新时间。'],
  completedAt: ['完成时间', '阶段或任务完成时间。'],
  meta: ['调用元信息', '包序号、批次数、条目数量、目标语言等辅助信息。'],
  json: ['AI输出JSON', 'AI 返回或服务端整理后的结构化 JSON 内容。'],
  result: ['结果对象', 'AI provider 返回或服务端归一化后的结果对象。'],
  rawResponse: ['AI原始响应', 'AI provider 返回的原始响应 JSON。'],
  requestSummary: [
    '请求摘要',
    '服务端保存的 AI 请求摘要，便于追踪实际发送内容。'
  ],
  responseSummary: [
    '响应摘要',
    '服务端保存的 AI 响应摘要，便于排查 provider 返回内容。'
  ],
  requestBody: ['请求体', '提交给 AI provider 的请求体。'],
  response: ['响应对象', 'AI provider 返回的响应对象。'],
  usage: ['用量', 'token、计费或模型调用用量。'],
  aiUsage: ['AI用量', '当前任务汇总的 AI 用量信息。'],
  input: ['输入', '服务端提交给该阶段的输入内容。'],
  output: ['输出', '该阶段产生的输出内容。'],
  terms: ['官方译名结果', '名词搜索翻译 AI 输出的原文名词和多语言译名。'],
  normalizedTerms: [
    '规范化关键词',
    '默认 AI 抽词后经服务端清洗、去重、排序的关键词。'
  ],
  termCount: ['名词数量', '本次处理的专有名词数量。'],
  sourceText: ['原文名词', '专有名词的源语言原文。'],
  normalizedSourceText: [
    '规范化原文名词',
    '用于数据库去重和匹配的规范化原文名词。'
  ],
  translatedText: ['译名', '某个语言 code 下保存的官方译名。'],
  translations: ['多语言译名', '以 languageCode 为键保存的官方译名集合。'],
  translationSource: [
    '译名来源',
    '译名来自手动维护、联网检索、AI知识库或导入。'
  ],
  searchMetadata: ['检索元数据', '联网检索时保存的搜索查询和网页依据。'],
  dataUrlSummary: [
    'Base64摘要',
    '图片 data URL 已被移除，只保留类型、长度和用途说明。'
  ],
  omitted: [
    '已省略',
    '该字段原本包含大体积或不可直接持久化的数据，数据库只保存摘要。'
  ],
  contentType: ['内容类型', '被省略内容的 MIME 类型。'],
  encoding: ['编码', '被省略内容原本使用的编码。'],
  charLength: ['字符长度', '被省略字符串的原始字符数。'],
  base64Length: ['Base64长度', '被省略 base64 数据段的字符数。'],
  byteLength: ['字节长度', '被省略二进制内容的字节数。'],
  webSearchQueries: [
    '搜索查询',
    'AI grounding 实际使用或输出的 Google 搜索查询。'
  ],
  groundingChunks: ['网页依据', 'AI grounding 返回的网页标题和链接依据。'],
  title: ['标题', '文章、网页依据或媒体内容标题。'],
  uri: ['链接', '网页依据或资源的 URI。'],
  url: ['URL', '资源访问地址。'],
  note: ['备注', '人工或服务端保存的补充说明。'],
  noteNeedsUpdate: [
    '备注需要修订',
    'AI 联网检索后判断当前名词备注是否需要改写。'
  ],
  shouldUpdateTermNote: [
    '写入修订备注',
    '服务端是否会把 AI 修订后的备注写入专有名词库。'
  ],
  enabled: ['启用状态', '该记录或配置是否启用。'],
  importance: ['重要度', 'AI 抽词阶段给出的 1 到 100 重要度评分。'],
  confidence: ['置信度', 'AI 或服务端判断结果的可信程度。'],
  reason: ['原因', 'AI 或服务端给出的处理原因。'],
  skipReason: ['跳过原因', '该条内容被跳过或无需处理的原因。'],
  actionType: ['动作类型', '审核采纳时要执行的动作类型。'],
  field: ['原字段', '被省略或摘要化内容原本所在的字段名。'],
  fieldName: ['字段名', '被翻译或被写入的业务字段名。'],
  label: ['显示名称', '管理端展示给用户看的字段名称。'],
  valueType: ['值类型', '字段值的结构类型，例如文本、富文本或媒体文件。'],
  sourceValue: ['源值', '翻译前的源语言字段值。'],
  currentValue: ['当前值', '目标语言当前已保存的字段值。'],
  nextValue: ['AI翻译后', 'AI 输出并准备写入的新字段值。'],
  finalValue: ['最终写入值', '确认采纳后准备写入数据库的最终值。'],
  oldValue: ['旧值', '变更前的字段值。'],
  newValue: ['新值', '变更后的字段值。'],
  message: ['消息', '状态、警告或错误消息。'],
  code: ['代码', '状态码、错误码或业务代码。'],
  errorCode: ['错误码', '服务端或 AI provider 返回的错误码。'],
  retryable: ['是否可重试', '失败后是否适合再次执行。'],
  failedStep: ['失败阶段', '任务失败时所在的执行阶段。'],
  attempts: ['尝试次数', '任务或阶段已经尝试执行的次数。'],
  lastFailedAt: ['最近失败时间', '最近一次执行失败的时间。'],
  packageIndex: ['分包序号', '正文切片或抽词包的序号。'],
  packageCount: ['分包总数', '本阶段切分出的总包数。'],
  batchIndex: ['批次序号', '批量处理时的批次序号。'],
  batchCount: ['批次总数', '批量处理时的总批次数。'],
  entryCount: ['条目数量', '本次请求或结果包含的条目数量。'],
  keywordCount: ['关键词数量', '默认 AI 抽取出的关键词数量。'],
  coveredTermCount: ['已覆盖名词数', '数据库已有译名覆盖的名词数量。'],
  missingTermCount: ['缺失名词数', '数据库缺少目标语言译名的名词数量。'],
  aiKnowledgeBaseTermCount: [
    '模型知识确认名词数',
    '名词搜索翻译 AI 通过模型知识直接确认的名词数量。'
  ],
  aiKnowledgeBaseTranslationCount: [
    '模型知识确认译名数',
    '名词搜索翻译 AI 通过模型知识直接确认的译名数量。'
  ],
  searchedTermCount: ['已检索名词数', '实际提交给名词搜索翻译 AI 的名词数量。'],
  internetSearchTermCount: [
    '联网检索确认名词数',
    '名词搜索翻译 AI 通过联网检索确认的名词数量。'
  ],
  internetSearchTranslationCount: [
    '联网检索译名数',
    '名词搜索翻译 AI 通过联网检索确认的译名数量。'
  ],
  internetSearchRequestedTermCount: [
    '联网检索请求名词数',
    '模型知识无法确认后继续提交给联网检索的名词数量。'
  ],
  internetSearchTargetLanguageCodes: [
    '联网检索目标语言',
    '实际提交给联网检索的目标语言列表。'
  ],
  skipInternetSearch: [
    '跳过联网检索',
    '关闭联网检索时，只跳过联网搜索 AI，仍会先使用模型知识确认缺失名词译名。'
  ],
  skippedByNoTranslationCount: [
    '无译名跳过数',
    '因为没有可用译名而未写入术语库的名词数量。'
  ],
  officialTermStats: ['名词库统计', '专有名词库命中、缺失、检索和写库统计。'],
  officialTermGlossaryMarkdown: [
    '当前语言名词库MD',
    '投喂给当前目标语言翻译 AI 的专有名词 Markdown。'
  ],
  officialTermGlossaryMarkdownMap: [
    '多语言名词库MD',
    '按 languageCode 保存的专有名词 Markdown 映射。'
  ],
  sourceCoverUrl: ['源封面图', '源文章或源内容当前使用的封面图地址。'],
  currentCoverUrl: ['当前封面图', '目标文章当前保存的封面图地址。'],
  generatedCoverUrl: ['生成封面图', 'AI 生成或处理后的封面图地址。'],
  coverImageStatus: ['封面图状态', '封面图识别、生成、复用或跳过的状态。'],
  mediaFile: ['媒体文件', '图片、视频或附件等媒体文件信息。']
}

const AI_JSON_INPUT_FIELD_NAMES = new Set([
  'input',
  'prompt',
  'promptList',
  'promptMessages',
  'requestBody',
  'requestSummary',
  'sourceValue',
  'sourceText',
  'sourceImage',
  'sourceCoverUrl',
  'sourceLanguageCode',
  'targetLanguageCode',
  'targetLanguageCodes',
  'officialTermGlossaryMarkdown',
  'officialTermGlossaryMarkdownMap'
])

const AI_JSON_OUTPUT_FIELD_NAMES = new Set([
  'output',
  'json',
  'result',
  'payload',
  'response',
  'responseSummary',
  'rawResponse',
  'translatedText',
  'translations',
  'nextValue',
  'finalValue',
  'generatedImage',
  'generatedCoverUrl'
])

const AI_JSON_TABLE_FILTER_OPTIONS = [
  { label: 'AI输入', value: 'input' },
  { label: 'AI输出', value: 'output' },
  { label: '任务信息', value: 'job' },
  { label: 'AI调用日志', value: 'aiLog' },
  { label: '专有名词', value: 'properNoun' },
  { label: '封面图', value: 'coverImage' },
  { label: '审核预览', value: 'review' },
  { label: '警告错误', value: 'issue' },
  { label: '用量统计', value: 'usage' }
]

function getLastJsonPathToken(path) {
  if (path === '$') {
    return '$'
  }
  const arrayMatch = path.match(/\[(\d+)\]$/)
  if (arrayMatch) {
    return `[${arrayMatch[1]}]`
  }
  const fieldMatch = path.match(/\.([^.[\]]+)$/)
  if (fieldMatch) {
    return fieldMatch[1]
  }
  return path
}

function getParentJsonPath(path) {
  if (path === '$') {
    return ''
  }
  if (/\[\d+\]$/.test(path)) {
    return path.replace(/\[\d+\]$/, '')
  }
  return path.replace(/\.[^.[\]]+$/, '')
}

function getArrayItemMeta(path) {
  const itemMatch = path.match(/^(.*)\[(\d+)\]$/)
  if (!itemMatch) {
    return null
  }
  const parentPath = itemMatch[1]
  const itemNumber = Number(itemMatch[2]) + 1
  if (parentPath.endsWith('aiJsonLogs')) {
    return [
      'AI调用记录 ' + itemNumber,
      '一次 AI 请求保存下来的完整 JSON 日志。'
    ]
  }
  if (parentPath.endsWith('payload.entries')) {
    return ['AI翻译条目 ' + itemNumber, 'AI 翻译 payload 中的一条翻译结果。']
  }
  if (parentPath.endsWith('previewEntries')) {
    return ['审核预览 ' + itemNumber, '管理端审核抽屉中的一条预览数据。']
  }
  if (parentPath.endsWith('warningList')) {
    return ['警告 ' + itemNumber, '任务执行中记录的一条警告信息。']
  }
  if (parentPath.endsWith('aiSkipList')) {
    return [
      '跳过条目 ' + itemNumber,
      'AI 或服务端判断无需翻译、无需生成或保持原值的条目。'
    ]
  }
  if (parentPath.endsWith('relatedResults')) {
    return ['关联结果 ' + itemNumber, '一个关联内容或递归翻译流程的结果摘要。']
  }
  if (parentPath.endsWith('languageResults')) {
    return ['语言结果 ' + itemNumber, '多语言任务中一个目标语言的执行结果。']
  }
  if (parentPath.endsWith('coverImageArtifacts')) {
    return [
      '封面图产物 ' + itemNumber,
      '封面图识别、生成、复用或跳过产生的一条记录。'
    ]
  }
  if (parentPath.endsWith('terms')) {
    return [
      '官方译名项 ' + itemNumber,
      '名词搜索翻译 AI 整理出的一条原文名词及多语言译名。'
    ]
  }
  if (parentPath.endsWith('normalizedTerms')) {
    return [
      '规范化关键词 ' + itemNumber,
      '默认 AI 抽词后经服务端规范化的一条关键词。'
    ]
  }
  if (parentPath.endsWith('groundingChunks')) {
    return [
      '网页依据 ' + itemNumber,
      'AI grounding 返回的一条网页标题和链接依据。'
    ]
  }
  if (parentPath.endsWith('webSearchQueries')) {
    return ['搜索查询 ' + itemNumber, 'AI grounding 使用或输出的一条搜索查询。']
  }
  if (parentPath.endsWith('targetLanguageCodes')) {
    return ['目标语言 ' + itemNumber, '本次任务覆盖的一个目标语言 code。']
  }
  if (parentPath.endsWith('sourceTexts')) {
    return [
      '原文名词 ' + itemNumber,
      '准备对比名词库或提交检索的一个原文名词。'
    ]
  }
  return ['第 ' + itemNumber + ' 项', '父级数组中的一条记录。']
}

function getSpecialAiJsonFieldMeta(path) {
  const aiLogMatch = path.match(/^\$\.result\.aiJsonLogs\[(\d+)\](?:\.(.+))?$/)
  if (aiLogMatch) {
    const itemNumber = Number(aiLogMatch[1]) + 1
    const childPath = aiLogMatch[2] || ''
    if (childPath.startsWith('json.terms')) {
      return [
        '联网译名结果 ' + itemNumber,
        '互联网搜索 AI 整理出的原文名词及各语言译名。'
      ]
    }
    if (childPath.startsWith('json.normalizedTerms')) {
      return [
        '规范化关键词 ' + itemNumber,
        '默认 AI 抽取后经服务端去重规范化的关键词。'
      ]
    }
    if (childPath.startsWith('json.rawResponse')) {
      return ['AI原始响应 ' + itemNumber, 'AI provider 返回的原始响应 JSON。']
    }
  }
  const translationMatch = path.match(/\.translations\.([^.[\]]+)$/)
  if (translationMatch) {
    return [
      '译名：' + translationMatch[1],
      '该 languageCode 对应的专有名词官方译名。'
    ]
  }
  const generationMapMatch = path.match(
    /\.coverImageGenerationMap\.([^.[\]]+)$/
  )
  if (generationMapMatch) {
    return ['封面生成映射项', '按 generationKey 保存的一次封面图生成结果。']
  }
  const recognitionMapMatch = path.match(
    /\.coverImageRecognitionMap\.([^.[\]]+)$/
  )
  if (recognitionMapMatch) {
    return ['封面识别映射项', '按 recognitionKey 保存的一次封面图识别结果。']
  }
  const translationPostMapMatch = path.match(
    /\.translationPostMap\.([^.[\]]+)$/
  )
  if (translationPostMapMatch) {
    return ['文章映射项', '一个源文章到目标语言文章的映射结果。']
  }
  return null
}

function getAiJsonValueTone(path) {
  const lastToken = getLastJsonPathToken(path)
  if (AI_JSON_INPUT_FIELD_NAMES.has(lastToken)) {
    return 'input'
  }
  if (AI_JSON_OUTPUT_FIELD_NAMES.has(lastToken)) {
    return 'output'
  }
  if (/^\$\.result\.aiJsonLogs\[\d+\]\.json(?:\.|$)/.test(path)) {
    return 'output'
  }
  if (/^\$\.result\.aiJsonLogs\[\d+\]\.meta(?:\.|$)/.test(path)) {
    return 'input'
  }
  return ''
}

function getAiJsonNodeCategories(path, valueTone) {
  const categories = []
  const normalizedPath = String(path || '')
  const lastToken = getLastJsonPathToken(normalizedPath)
  if (valueTone) {
    categories.push(valueTone)
  }
  if (normalizedPath.startsWith('$.job')) {
    categories.push('job')
  }
  if (normalizedPath.includes('.aiJsonLogs')) {
    categories.push('aiLog')
  }
  if (
    normalizedPath.includes('officialTerm') ||
    normalizedPath.includes('normalizedTerms') ||
    normalizedPath.includes('.terms') ||
    lastToken === 'translations' ||
    lastToken === 'translatedText' ||
    lastToken === 'translationSource'
  ) {
    categories.push('properNoun')
  }
  if (
    normalizedPath.includes('coverImage') ||
    normalizedPath.includes('CoverImage') ||
    normalizedPath.includes('recognition') ||
    normalizedPath.includes('generation') ||
    normalizedPath.includes('Cover')
  ) {
    categories.push('coverImage')
  }
  if (
    normalizedPath.includes('previewEntries') ||
    normalizedPath.includes('payload.entries') ||
    normalizedPath.includes('aiSkipList')
  ) {
    categories.push('review')
  }
  if (
    normalizedPath.includes('warningList') ||
    normalizedPath.includes('error') ||
    normalizedPath.includes('failure') ||
    lastToken === 'warningMessage' ||
    lastToken === 'errorCode'
  ) {
    categories.push('issue')
  }
  if (
    normalizedPath.includes('aiUsage') ||
    lastToken === 'usage' ||
    lastToken === 'promptTokens' ||
    lastToken === 'completionTokens' ||
    lastToken === 'totalTokens'
  ) {
    categories.push('usage')
  }
  return Array.from(new Set(categories))
}

function getAiJsonFieldMeta(path, value) {
  if (EXACT_AI_JSON_FIELD_META_MAP[path]) {
    return {
      label: EXACT_AI_JSON_FIELD_META_MAP[path][0],
      description: EXACT_AI_JSON_FIELD_META_MAP[path][1]
    }
  }
  const arrayItemMeta = getArrayItemMeta(path)
  if (arrayItemMeta) {
    return {
      label: arrayItemMeta[0],
      description: arrayItemMeta[1]
    }
  }
  const specialMeta = getSpecialAiJsonFieldMeta(path)
  if (specialMeta) {
    return {
      label: specialMeta[0],
      description: specialMeta[1]
    }
  }
  const lastToken = getLastJsonPathToken(path)
  if (COMMON_AI_JSON_FIELD_META_MAP[lastToken]) {
    return {
      label: COMMON_AI_JSON_FIELD_META_MAP[lastToken][0],
      description: COMMON_AI_JSON_FIELD_META_MAP[lastToken][1]
    }
  }
  if (lastToken.startsWith('[')) {
    const parentPath = getParentJsonPath(path)
    const parentToken = getLastJsonPathToken(parentPath)
    return {
      label: lastToken.replace('[', '第 ').replace(']', ' 项'),
      description: `${parentToken} 数组中的一条记录。`
    }
  }
  return {
    label: lastToken,
    description: `服务端保存的 ${lastToken} 字段，类型为 ${getJsonTypeLabel(value)}。`
  }
}

function buildChildJsonPath(parentPath, key) {
  if (!parentPath) {
    return String(key)
  }
  if (/^\d+$/.test(String(key))) {
    return `${parentPath}[${key}]`
  }
  return `${parentPath}.${key}`
}

function buildAiJsonTableNode(path, value) {
  const meta = getAiJsonFieldMeta(path || '$', value)
  const valueTone = getAiJsonValueTone(path || '$')
  const children = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      children.push(buildAiJsonTableNode(buildChildJsonPath(path, index), item))
    })
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.keys(value).forEach(key => {
      children.push(
        buildAiJsonTableNode(buildChildJsonPath(path, key), value[key])
      )
    })
  }
  return {
    id: path || '$',
    label: meta.label,
    description: meta.description,
    typeLabel: getJsonTypeLabel(value),
    valueTone,
    summary: getJsonCollectionSummary(value),
    value: getJsonLeafValue(value),
    children,
    categories: getAiJsonNodeCategories(path || '$', valueTone)
  }
}

function hasAiJsonFilterMatch(node, selectedFilters) {
  if (!Array.isArray(node.categories)) {
    return false
  }
  return node.categories.some(category => selectedFilters.includes(category))
}

function filterAiJsonTableNode(node, selectedFilters) {
  let children = []
  if (Array.isArray(node.children)) {
    children = node.children
      .map(childNode => filterAiJsonTableNode(childNode, selectedFilters))
      .filter(Boolean)
  }
  if (hasAiJsonFilterMatch(node, selectedFilters) || children.length > 0) {
    return {
      ...node,
      children
    }
  }
  return null
}

function filterAiJsonTableTree(nodes, selectedFilters) {
  if (!Array.isArray(nodes)) {
    return []
  }
  if (!Array.isArray(selectedFilters) || selectedFilters.length === 0) {
    return nodes
  }
  return nodes
    .map(node => filterAiJsonTableNode(node, selectedFilters))
    .filter(Boolean)
}

export default {
  name: 'TranslationJobList',
  components: {
    AiTranslationWorkflowViewer,
    Refresh,
    ArrowRight,
    ResponsiveTable,
    ResponsiveTableColumn,
    TranslationEntrySelectableGroups,
    TranslationSkippedEntryPreviewList
  },
  setup() {
    const route = useRoute()
    const tableRef = ref(null)
    const jobList = ref([])
    // 孤儿任务（rootId 未指向有效 root 的 parent/child）：后端在默认列表里单独返回，
    // 前端在列表顶部以红色标出，让管理员能感知到“出现 bug、产生孤儿任务”。
    const orphanJobs = ref([])
    const total = ref(0)
    const selectedJobRows = ref([])
    const batchDeleting = ref(false)
    const jobStorageSummary = ref(null)
    const jobStorageSummaryLoading = ref(false)
    const currentJob = ref(null)
    const detailDrawerVisible = ref(false)
    const activeReviewLanguageCode = ref('')
    const selectedEntryKeys = ref([])
    const conflictList = ref([])
    const coverImageCleanupLoading = ref(false)
    const aiWorkflowDialogVisible = ref(false)
    const params = reactive({
      keyword: '',
      jobType: '',
      status: '',
      page: 1,
      limit: 20
    })
    restoreListSessionParams(route, params)
    const applyForm = reactive({
      force: false,
      publish: false,
      forceReason: ''
    })

    const previewEntries = computed(() => {
      return currentJob.value?.result?.previewEntries || []
    })

    const aiWorkflow = computed(() => {
      return currentJob.value?.result?.aiWorkflow || null
    })

    const aiJsonLogStorageMissing = computed(() => {
      return currentJob.value?.result?.aiJsonLogStorageMissing === true
    })

    const aiJsonLogStorageMissingMessage = computed(() => {
      return (
        currentJob.value?.result?.aiJsonLogStorageError ||
        'AI 任务 JSON 日志文件已缺失，无法展示详细调用日志'
      )
    })

    const hasAiWorkflow = computed(() => {
      return (
        Array.isArray(aiWorkflow.value?.steps) &&
        aiWorkflow.value.steps.length > 0
      )
    })

    const executionWorkflowSteps = computed(() => {
      if (!Array.isArray(aiWorkflow.value?.steps)) {
        return []
      }
      return aiWorkflow.value.steps
    })

    const getCurrentWorkflowStepFromList = steps => {
      if (!Array.isArray(steps) || steps.length === 0) {
        return null
      }
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
    }

    const currentWorkflowStep = computed(() => {
      return getCurrentWorkflowStepFromList(executionWorkflowSteps.value)
    })

    const hasExecutionWorkflow = computed(() => {
      if (!currentJob.value) {
        return false
      }
      if (executionWorkflowSteps.value.length === 0) {
        return false
      }
      if (currentJob.value.status === '执行中') {
        return true
      }
      return currentJob.value.status === '执行失败'
    })

    const workflowProgressPercent = computed(() => {
      const percent = Number(currentJob.value?.progress?.percent || 0)
      if (!Number.isFinite(percent) || percent < 0) {
        return 0
      }
      if (percent > 100) {
        return 100
      }
      return percent
    })

    const workflowRecentLogs = computed(() => {
      const recentLogs = currentJob.value?.progress?.recentLogs || []
      if (!Array.isArray(recentLogs)) {
        return []
      }
      return recentLogs.slice(-6)
    })

    const openAiWorkflowDialog = () => {
      if (!hasAiWorkflow.value) {
        return
      }
      aiWorkflowDialogVisible.value = true
    }

    const getWorkflowStepStatusText = step => {
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
    }

    const getWorkflowStepStatusTagType = step => {
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
    }

    const getWorkflowStepClass = step => {
      return {
        'is-current': step?.id === currentWorkflowStep.value?.id,
        'is-completed': step?.status === 'completed',
        'is-running': step?.status === 'running',
        'is-retrying': step?.status === 'retrying',
        'is-stopping': step?.status === 'stopping',
        'is-failed': step?.status === 'failed',
        'is-pending': step?.status === 'pending'
      }
    }

    const getWorkflowStepSubtitle = step => {
      const parts = []
      if (step?.currentStep) {
        parts.push(step.currentStep)
      }
      if (step?.provider) {
        parts.push(step.provider)
      }
      if (step?.model) {
        parts.push(step.model)
      }
      if (step?.stage) {
        parts.push(getProgressStageText(step.stage))
      }
      if (parts.length > 0) {
        return parts.join(' / ')
      }
      return step?.description || '-'
    }

    const getWorkflowStepCurrentText = step => {
      if (step?.currentStep) {
        return step.currentStep
      }
      if (currentJob.value?.progress?.currentStep) {
        return currentJob.value.progress.currentStep
      }
      return step?.description || '-'
    }

    const adoptionEntryMap = computed(() => {
      const entryMap = new Map()
      const adoptionEntryList = Array.isArray(
        currentJob.value?.adoption?.entries
      )
        ? currentJob.value.adoption.entries
        : []
      adoptionEntryList.forEach(entry => {
        if (!entry?.entryKey) {
          return
        }
        entryMap.set(String(entry.entryKey), entry)
      })
      return entryMap
    })

    const selectableReviewEntries = computed(() => {
      return previewEntries.value.filter(entry => {
        if (!entry || entry.entryType === 'coverImageTranslation') {
          return false
        }
        return entry.entryKey && !entry.aiSkipReason
      })
    })

    const isCoverImageSkipInfoEntry = entry => {
      if (!entry || entry.entryType !== 'coverImageTranslation') {
        return false
      }
      return entry.status === 'not-required'
    }

    const buildCoverImageSkippedEntry = entry => {
      const reason =
        normalizePreviewText(entry.warningMessage) ||
        normalizePreviewText(entry.recognition?.reason) ||
        '封面图无需翻译'
      const sourceCoverUrl = normalizePreviewText(entry.sourceCoverUrl)
      return {
        ...entry,
        id: entry.entryKey || entry.artifactId,
        label: '封面图',
        fieldLabel: '封面图',
        fieldName: 'coverImages',
        groupLabel: '媒体文件 / 封面图',
        groupTitle: '封面图',
        scope: 'post',
        valueType: 'mediaFile',
        sourceMediaUrl: sourceCoverUrl,
        currentMediaUrl: '',
        sourcePreviewText: '',
        currentPreviewText: '',
        hasSourceValue: Boolean(sourceCoverUrl),
        hasCurrentValue: false,
        aiSkipReason: reason,
        reason
      }
    }

    const skippedReviewEntries = computed(() => {
      const entries = previewEntries.value.filter(entry => {
        if (!entry || entry.entryType === 'coverImageTranslation') {
          return false
        }
        return entry.aiSkipReason
      })
      previewEntries.value.forEach(entry => {
        if (isCoverImageSkipInfoEntry(entry)) {
          entries.push(buildCoverImageSkippedEntry(entry))
        }
      })
      return entries
    })

    const coverImageReviewEntries = computed(() => {
      return previewEntries.value
        .filter(entry => {
          if (!entry || entry.entryType !== 'coverImageTranslation') {
            return false
          }
          return !isCoverImageSkipInfoEntry(entry)
        })
        .map(entry => {
          const adoptionEntry = adoptionEntryMap.value.get(
            String(entry.entryKey || '')
          )
          const appliedBy = adoptionEntry?.appliedBy || null
          return {
            ...entry,
            id: entry.entryKey || entry.artifactId,
            adoptionEntry,
            isApplied:
              entry.adopted === true || adoptionEntry?.applied === true,
            appliedAt: adoptionEntry?.appliedAt || entry.adoptedAt || '',
            appliedBy,
            appliedByName: appliedBy?.displayName || appliedBy?.username || ''
          }
        })
    })

    const canCleanupCoverImages = computed(() => {
      const artifactList = currentJob.value?.result?.coverImageArtifacts || []
      return Array.isArray(artifactList) && artifactList.length > 0
    })

    const canSelectCoverImage = entry => {
      if (!canApplyCurrentJob.value) {
        return false
      }
      if (!entry?.id || !entry?.artifactId) {
        return false
      }
      if (entry.status !== 'generated') {
        return false
      }
      return Boolean(entry.generatedCoverUrl)
    }

    const setCoverImageSelected = async (entry, checked) => {
      const entryKey = String(entry?.id || '')
      if (!entryKey || !canSelectCoverImage(entry)) {
        return
      }
      if (checked) {
        if (entry.isApplied === true) {
          const confirmed = await confirmAppliedEntrySelection([entry])
          if (confirmed === false) {
            return
          }
        }
        if (!selectedEntryKeys.value.includes(entryKey)) {
          selectedEntryKeys.value = selectedEntryKeys.value.concat(entryKey)
        }
        return
      }
      selectedEntryKeys.value = selectedEntryKeys.value.filter(item => {
        return item !== entryKey
      })
    }

    const requestEntryMap = computed(() => {
      const map = new Map()
      const entries = currentJob.value?.request?.entries || []
      entries.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
          return
        }
        if (entry.id) {
          map.set(String(entry.id), entry)
        }
        if (entry.entryKey) {
          map.set(String(entry.entryKey), entry)
        }
      })
      return map
    })

    const reviewDisplayEntries = computed(() => {
      return selectableReviewEntries.value.map(entry => {
        const adoptionEntry = adoptionEntryMap.value.get(
          String(entry.entryKey || '')
        )
        const requestEntry =
          requestEntryMap.value.get(String(entry.id || '')) ||
          requestEntryMap.value.get(String(entry.originalEntryKey || '')) ||
          requestEntryMap.value.get(String(entry.entryKey || '')) ||
          {}
        const currentPreviewText = getFullPreviewText({
          valueType: entry.valueType,
          rawValues: [
            entry.currentPreviewRawValue,
            requestEntry.currentPreviewRawValue
          ],
          fallbackValue: entry.targetValueSnapshotAtCompletion,
          previewValues: [
            entry.currentPreviewText,
            requestEntry.currentPreviewText
          ]
        })
        const sourcePreviewText = getFullPreviewText({
          valueType: entry.valueType,
          rawValues: [
            entry.sourcePreviewRawValue,
            requestEntry.sourcePreviewRawValue
          ],
          previewValues: [
            entry.sourcePreviewText,
            requestEntry.sourcePreviewText
          ]
        })
        const nextPreviewText = getFullPreviewText({
          valueType: entry.valueType,
          rawValues: [
            entry.nextPreviewRawValue,
            entry.previewRawValue,
            requestEntry.nextPreviewRawValue,
            requestEntry.previewRawValue
          ],
          fallbackValue: entry.value,
          previewValues: [
            entry.nextPreviewText,
            entry.previewText,
            requestEntry.nextPreviewText,
            requestEntry.previewText
          ]
        })
        const currentPreviewHtml = getFullPreviewHtml({
          valueType: entry.valueType,
          htmlValues: [
            entry.currentPreviewHtml,
            requestEntry.currentPreviewHtml
          ],
          rawValues: [
            entry.currentPreviewRawValue,
            requestEntry.currentPreviewRawValue,
            entry.targetValueSnapshotAtCompletion
          ]
        })
        const sourcePreviewHtml = getFullPreviewHtml({
          valueType: entry.valueType,
          htmlValues: [entry.sourcePreviewHtml, requestEntry.sourcePreviewHtml],
          rawValues: [
            entry.sourcePreviewRawValue,
            requestEntry.sourcePreviewRawValue
          ]
        })
        const nextPreviewHtml = getFullPreviewHtml({
          valueType: entry.valueType,
          htmlValues: [entry.nextPreviewHtml, requestEntry.nextPreviewHtml],
          rawValues: [
            entry.nextPreviewRawValue,
            entry.previewRawValue,
            requestEntry.nextPreviewRawValue,
            requestEntry.previewRawValue,
            entry.value
          ]
        })

        const appliedBy = adoptionEntry?.appliedBy || null
        const appliedByName =
          appliedBy?.displayName || appliedBy?.username || ''

        return {
          ...entry,
          id: entry.entryKey,
          adoptionEntry,
          isApplied: adoptionEntry?.applied === true,
          appliedAt: adoptionEntry?.appliedAt || '',
          appliedBy,
          appliedByName,
          currentPreviewText,
          currentPreviewHtml,
          sourcePreviewText,
          sourcePreviewHtml,
          nextPreviewText,
          nextPreviewHtml
        }
      })
    })

    const getReviewEntryLanguageCode = entry => {
      return (
        entry?.languageCode ||
        currentJob.value?.target?.languageCode ||
        '__default'
      )
    }

    const buildReviewEntryGroups = entries => {
      const groupMap = new Map()
      entries.forEach(entry => {
        const groupLabel = entry.groupLabel || '未分组'
        if (!groupMap.has(groupLabel)) {
          groupMap.set(groupLabel, {
            label: groupLabel,
            groupLabel,
            entries: []
          })
        }
        groupMap.get(groupLabel).entries.push(entry)
      })

      return Array.from(groupMap.values()).map(group => {
        const meta = getTranslationGroupDisplayMeta(
          group.groupLabel,
          group.entries[0]
        )
        return {
          label: group.label,
          entries: group.entries,
          meta
        }
      })
    }

    const resolveTabValidation = languageCode => {
      const validation = currentJob.value?.result?.validation
      if (!validation || validation.enabled !== true) {
        return null
      }
      if (Array.isArray(validation.languageValidations)) {
        const matched = validation.languageValidations.find(item => {
          return item.languageCode === languageCode
        })
        return matched ? matched.validation : null
      }
      const jobLanguageCode =
        currentJob.value?.target?.languageCode || '__default'
      if (languageCode === jobLanguageCode || languageCode === '__default') {
        return validation
      }
      return null
    }

    const reviewLanguageTabs = computed(() => {
      const tabMap = new Map()
      const ensureTab = languageCode => {
        if (!tabMap.has(languageCode)) {
          tabMap.set(languageCode, {
            languageCode,
            label: getLanguageText(languageCode),
            entries: [],
            skippedEntries: []
          })
        }
        return tabMap.get(languageCode)
      }

      reviewDisplayEntries.value.forEach(entry => {
        ensureTab(getReviewEntryLanguageCode(entry)).entries.push(entry)
      })

      skippedReviewEntries.value.forEach(entry => {
        ensureTab(getReviewEntryLanguageCode(entry)).skippedEntries.push(entry)
      })

      coverImageReviewEntries.value.forEach(entry => {
        const tab = ensureTab(getReviewEntryLanguageCode(entry))
        if (!Array.isArray(tab.coverImageEntries)) {
          tab.coverImageEntries = []
        }
        tab.coverImageEntries.push(entry)
      })

      return Array.from(tabMap.values()).map(tab => {
        const selectableCoverImageEntries = (
          tab.coverImageEntries || []
        ).filter(entry => {
          return canSelectCoverImage(entry)
        })
        return {
          ...tab,
          entryKeys: tab.entries
            .map(entry => entry.id)
            .concat(selectableCoverImageEntries.map(entry => entry.id)),
          reviewEntries: tab.entries.concat(tab.coverImageEntries || []),
          groups: buildReviewEntryGroups(tab.entries),
          coverImageEntries: tab.coverImageEntries || [],
          validation: resolveTabValidation(tab.languageCode)
        }
      })
    })

    const selectableEntryKeys = computed(() => {
      return reviewLanguageTabs.value.flatMap(tab => tab.entryKeys)
    })

    const canApplyCurrentJob = computed(() => {
      if (!currentJob.value) {
        return false
      }
      // 根任务（root）不做条目级审核，展示文章父任务卡片下钻；父任务（parent）聚合各语言
      // 子任务结果，允许勾选采纳。
      const role = currentJob.value.taskRelation?.role
      if (role === 'root') {
        return false
      }
      if (currentJob.value.jobType === sourcePostProperNounOrganizeJobType) {
        return false
      }
      return applyStatusSet.has(currentJob.value.status)
    })

    // 当前抽屉是否为根任务总览（展示各文章父任务卡片）。
    const isRootOverview = computed(() => {
      return currentJob.value?.taskRelation?.role === 'root'
    })

    // 当前抽屉是否为文章父任务（聚合各语言子任务审核）。
    const isParentReview = computed(() => {
      return currentJob.value?.taskRelation?.role === 'parent'
    })

    // 根任务下的文章父任务卡片列表。
    const familyParentCards = computed(() => {
      const parents = currentJob.value?.familyParents
      if (!Array.isArray(parents)) {
        return []
      }
      return parents
    })

    const jobStorageTables = computed(() => {
      return jobStorageSummary.value?.tables || []
    })

    const jobStorageFileCaches = computed(() => {
      return jobStorageSummary.value?.fileCaches || []
    })

    const jobStorageTotals = computed(() => {
      return jobStorageSummary.value?.totals || {}
    })

    const jobStorageUpdatedText = computed(() => {
      const updatedAt = jobStorageSummary.value?.updatedAt
      if (!updatedAt) {
        return '等待读取存储统计'
      }

      return `统计时间：${formatDate(updatedAt)}`
    })

    const selectedDeletableJobIds = computed(() => {
      return selectedJobRows.value
        .filter(row => canDelete(row))
        .map(row => String(row._id))
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.jobType) {
        requestParams.jobType = params.jobType
      }
      if (params.status) {
        requestParams.status = params.status
      }
      return requestParams
    }

    const getJobList = resetPage => {
      if (resetPage === true) {
        clearJobSelection()
      }
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }
      return multilingualApi
        .getTranslationJobList(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          // 列表接口已在后端把家族子任务平铺返回，前端无需再为每个 root 单独请求。
          const normalList = responseData.list || []
          orphanJobs.value = responseData.orphanJobs || []
          // 孤儿任务置顶并以红色标出，正常任务紧随其后。
          jobList.value = orphanJobs.value.concat(normalList)
          total.value = responseData.total || 0
          saveListSessionParams(route, params)
        })
        .catch(error => {
          console.log(error)
        })
    }

    // 按家族角色返回行样式类，用行底色 + 左色条体现层级深度。
    const getJobRowClassName = ({ row }) => {
      if (row?.isOrphan === true) {
        return 'translation-job-row--orphan'
      }
      const role = row?.taskRelation?.role
      if (role === 'root') {
        return 'translation-job-row--root'
      }
      if (role === 'parent') {
        return 'translation-job-row--parent'
      }
      if (role === 'child') {
        return 'translation-job-row--child'
      }
      return ''
    }

    const getJobStorageSummary = () => {
      jobStorageSummaryLoading.value = true
      multilingualApi
        .getTranslationJobStorageSummary({}, true)
        .then(response => {
          jobStorageSummary.value = response.data.data || null
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          jobStorageSummaryLoading.value = false
        })
    }

    const refreshJobPage = resetPage => {
      getJobList(resetPage)
      getJobStorageSummary()
    }

    const preserveTableScrollForNextRefresh = () => {
      tableRef.value?.preserveScrollOnNextDataRefresh()
    }

    const loadTranslationJobDetail = (id, options = {}) => {
      if (!id) {
        return Promise.resolve()
      }
      return multilingualApi
        .getTranslationJobDetail({ id })
        .then(response => {
          if (!detailDrawerVisible.value) {
            return
          }
          currentJob.value = response.data.data || null
          if (options.resetSelection === true) {
            selectedEntryKeys.value = buildDefaultSelectedEntryKeys(
              currentJob.value
            )
          }
        })
        .catch(error => {
          console.log(error)
        })
    }

    const openDetail = row => {
      detailDrawerVisible.value = true
      currentJob.value = null
      selectedEntryKeys.value = []
      conflictList.value = []
      loadTranslationJobDetail(row._id, { resetSelection: true })
    }

    const refreshDetail = () => {
      if (!currentJob.value?._id) {
        return Promise.resolve()
      }
      return loadTranslationJobDetail(currentJob.value._id, {
        resetSelection: false
      })
    }

    const closeCurrentDetail = () => {
      detailDrawerVisible.value = false
      currentJob.value = null
      selectedEntryKeys.value = []
      conflictList.value = []
    }

    const runJobAction = (row, action, successText, options = {}) => {
      action({ id: row._id })
        .then(() => {
          ElMessage.success(successText)
          if (options.removeRowFromSelection === true) {
            removeJobFromSelection(row)
          }
          if (options.preserveScroll !== false) {
            preserveTableScrollForNextRefresh()
          }
          getJobList(false)
          getJobStorageSummary()
          const isCurrentDetailJob = currentJob.value?._id === row._id
          if (!isCurrentDetailJob) {
            return
          }
          if (options.closeCurrentDetail === true) {
            closeCurrentDetail()
            return
          }
          if (detailDrawerVisible.value) {
            refreshDetail()
          }
        })
        .catch(error => {
          console.log(error)
        })
    }

    const deferJob = row => {
      runJobAction(row, multilingualApi.deferTranslationJob, '已暂缓')
    }

    const resumeJob = row => {
      runJobAction(row, multilingualApi.resumeTranslationJob, '已恢复')
    }

    const retryJob = row => {
      runJobAction(row, multilingualApi.retryTranslationJob, '已重试')
    }

    const stopJob = row => {
      ElMessageBox.confirm(
        '确认停止该 AI 翻译任务？系统会断开正在进行的 AI 请求。',
        '停止任务',
        {
          type: 'warning',
          confirmButtonText: '停止',
          cancelButtonText: '取消'
        }
      ).then(() => {
        runJobAction(row, multilingualApi.stopTranslationJob, '已请求停止')
      })
    }

    const rejectJob = row => {
      const role = row?.taskRelation?.role
      const isFamilyOrchestrator = role === 'root' || role === 'parent'
      const confirmMessage = isFamilyOrchestrator
        ? '确认不采纳该任务？其下所有等待审核的子任务也会一并标记为不采纳。'
        : '确认不采纳该任务结果？'
      ElMessageBox.confirm(confirmMessage, '确认操作', {
        type: 'warning'
      }).then(() => {
        runJobAction(row, multilingualApi.rejectTranslationJob, '已标记不采纳')
      })
    }

    const deleteJob = row => {
      ElMessageBox.confirm('确认永久删除该任务？', '确认操作', {
        type: 'warning'
      }).then(() => {
        runJobAction(row, multilingualApi.deleteTranslationJob, '已删除', {
          preserveScroll: false,
          closeCurrentDetail: true,
          removeRowFromSelection: true
        })
      })
    }

    const handleJobSelectionChange = selection => {
      if (!Array.isArray(selection)) {
        selectedJobRows.value = []
        return
      }

      selectedJobRows.value = selection.filter(row => canDelete(row))
    }

    const isJobSelectable = row => {
      // 仅顶层任务（独立任务 / 家族根任务）可勾选删除；家族 parent/child 子任务不单独勾选，
      // 删除根任务时会自动级联清理其下全部子任务。
      const role = row?.taskRelation?.role
      if (role === 'parent' || role === 'child') {
        return false
      }
      return canDelete(row)
    }

    const clearJobSelection = () => {
      selectedJobRows.value = []
      tableRef.value?.clearSelection()
    }

    // 单条删除某个任务后，必须把它从选中集合里移除：表格开启了 reserve-selection，会按
    // row-key 跨刷新保留勾选，删除后若不显式取消该行勾选，被删任务的 id 会一直滞留，
    // 导致永远显示“已选中 1 条”。
    const removeJobFromSelection = row => {
      if (!row) {
        return
      }
      const rowId = String(row._id)
      selectedJobRows.value = selectedJobRows.value.filter(item => {
        return String(item._id) !== rowId
      })
      tableRef.value?.toggleRowSelection(row, false)
    }

    const deleteSelectedJobs = async () => {
      const ids = selectedDeletableJobIds.value
      if (ids.length === 0) {
        return
      }

      try {
        await ElMessageBox.confirm(
          `确认永久删除选中的 ${ids.length} 个 AI 翻译任务？`,
          '批量删除',
          {
            type: 'warning'
          }
        )
      } catch (error) {
        return
      }

      batchDeleting.value = true
      try {
        const response = await multilingualApi.batchDeleteTranslationJobs(
          { ids },
          true
        )
        const responseData = response.data.data || {}
        const deletedCount = responseData.deletedCount || ids.length
        ElMessage.success(`已删除 ${deletedCount} 个 AI 翻译任务`)
        if (ids.includes(currentJob.value?._id)) {
          closeCurrentDetail()
        }
        clearJobSelection()
        getJobList(false)
        getJobStorageSummary()
      } catch (error) {
        console.log(error)
      } finally {
        batchDeleting.value = false
      }
    }

    const applySelectedEntries = () => {
      if (!currentJob.value?._id || selectedEntryKeys.value.length === 0) {
        return
      }
      // 父任务聚合审核：所选条目按所属子任务（childJobId）分组，回到各子任务执行采纳。
      if (isParentReview.value) {
        applyParentSelections(selectedEntryKeys.value)
        return
      }
      conflictList.value = []
      multilingualApi
        .applyTranslationJobResult({
          id: currentJob.value._id,
          selectedEntryKeys: selectedEntryKeys.value,
          force: applyForm.force,
          forceOverwriteApplied: applyForm.force,
          forceReason: applyForm.forceReason,
          publish: applyForm.publish
        })
        .then(response => {
          const responseData = response.data.data || {}
          if (responseData.applied === false) {
            conflictList.value = responseData.conflicts || []
            return
          }
          ElMessage.success('已采纳')
          selectedEntryKeys.value = []
          refreshDetail()
          preserveTableScrollForNextRefresh()
          getJobList(false)
        })
        .catch(error => {
          console.log(error)
        })
    }

    // 把父任务聚合视图里的所选条目按 childJobId 分组，调用 apply-family 逐子任务采纳。
    const buildChildSelectionsFromEntryKeys = entryKeys => {
      const entryKeySet = new Set(entryKeys)
      const selectionMap = new Map()
      const previewEntryList = Array.isArray(
        currentJob.value?.result?.previewEntries
      )
        ? currentJob.value.result.previewEntries
        : []
      previewEntryList.forEach(entry => {
        const entryKey = entry?.entryKey || entry?.id
        if (!entryKey || !entryKeySet.has(entryKey)) {
          return
        }
        const childJobId = entry?.childJobId
        if (!childJobId) {
          return
        }
        if (!selectionMap.has(childJobId)) {
          selectionMap.set(childJobId, [])
        }
        selectionMap.get(childJobId).push(entryKey)
      })
      return Array.from(selectionMap.entries()).map(([jobId, keys]) => ({
        jobId,
        selectedEntryKeys: keys
      }))
    }

    const applyParentSelections = entryKeys => {
      const childSelections = buildChildSelectionsFromEntryKeys(entryKeys)
      if (childSelections.length === 0) {
        ElMessage.warning('所选条目无法定位到对应子任务')
        return
      }
      conflictList.value = []
      multilingualApi
        .applyTranslationFamilyResult({
          id: currentJob.value._id,
          childSelections,
          force: applyForm.force,
          publish: applyForm.publish
        })
        .then(response => {
          const responseData = response.data.data || {}
          const failCount = Number(responseData.failCount || 0)
          const successCount = Number(responseData.successCount || 0)
          if (failCount > 0) {
            ElMessage.warning(
              `已采纳 ${successCount} 个子任务，${failCount} 个失败，可重试`
            )
          } else {
            ElMessage.success('已采纳')
          }
          selectedEntryKeys.value = []
          refreshDetail()
          preserveTableScrollForNextRefresh()
          getJobList(false)
        })
        .catch(error => {
          console.log(error)
        })
    }

    // 父任务「采纳全部」：采纳该父任务下所有可采纳条目。
    const applyParentAll = () => {
      if (!isParentReview.value) {
        return
      }
      const allEntryKeys = reviewLanguageTabs.value.flatMap(tab => {
        const keys = Array.isArray(tab.entryKeys) ? tab.entryKeys : []
        const coverKeys = (tab.coverImageEntries || [])
          .filter(item => canSelectCoverImage(item))
          .map(item => item.id)
        return keys.concat(coverKeys)
      })
      if (allEntryKeys.length === 0) {
        ElMessage.warning('没有可采纳的条目')
        return
      }
      ElMessageBox.confirm(
        '将采纳该文章下所有语言的可用译文与封面图，确认继续？',
        '采纳全部',
        {
          confirmButtonText: '采纳全部',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
        .then(() => {
          applyParentSelections(allEntryKeys)
        })
        .catch(error => {
          if (error === 'cancel') {
            return
          }
          console.log(error)
        })
    }

    // 根任务「采纳全部」：对整个家族下所有可采纳子任务统一采纳。
    const applyFamilyAll = () => {
      if (!currentJob.value?._id || !isRootOverview.value) {
        return
      }
      ElMessageBox.confirm(
        '将采纳该任务下所有文章、所有语言的可用译文与封面图，确认继续？',
        '采纳全部',
        {
          confirmButtonText: '采纳全部',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
        .then(() => {
          return multilingualApi.applyTranslationFamilyResult({
            id: currentJob.value._id,
            applyAll: true,
            force: applyForm.force,
            publish: applyForm.publish
          })
        })
        .then(response => {
          const responseData = response.data.data || {}
          const successCount = Number(responseData.successCount || 0)
          const failCount = Number(responseData.failCount || 0)
          if (failCount > 0) {
            ElMessage.warning(
              `已采纳 ${successCount} 个子任务，${failCount} 个失败，可在对应文章中单独重试采纳`
            )
          } else {
            ElMessage.success(`已采纳全部 ${successCount} 个子任务`)
          }
          refreshDetail()
          preserveTableScrollForNextRefresh()
          getJobList(false)
        })
        .catch(error => {
          if (error === 'cancel') {
            return
          }
          console.log(error)
        })
    }

    const buildDefaultSelectedEntryKeys = job => {
      const adoptionMap = new Map()
      const adoptionEntryList = Array.isArray(job?.adoption?.entries)
        ? job.adoption.entries
        : []
      adoptionEntryList.forEach(entry => {
        if (!entry?.entryKey) {
          return
        }
        adoptionMap.set(String(entry.entryKey), entry)
      })

      const previewEntryList = Array.isArray(job?.result?.previewEntries)
        ? job.result.previewEntries
        : []
      return previewEntryList
        .filter(entry => {
          if (!entry?.entryKey || entry.aiSkipReason) {
            return false
          }
          if (entry.entryType === 'coverImageTranslation') {
            if (entry.adopted === true) {
              return false
            }
            if (entry.status !== 'generated') {
              return false
            }
            return Boolean(entry.artifactId && entry.generatedCoverUrl)
          }
          return adoptionMap.get(String(entry.entryKey))?.applied !== true
        })
        .map(entry => String(entry.entryKey))
    }

    const getAppliedEntryCount = entries => {
      return (entries || []).filter(entry => entry?.isApplied).length
    }

    const buildAppliedEntryConfirmMessage = entryList => {
      const appliedEntryList = entryList.filter(entry => entry?.isApplied)
      if (appliedEntryList.length === 0) {
        return ''
      }
      const entryLabelText = appliedEntryList
        .slice(0, 3)
        .map(entry => entry.label || entry.recordLabel || entry.id)
        .filter(Boolean)
        .join('、')
      const suffix =
        appliedEntryList.length > 3 ? ` 等 ${appliedEntryList.length} 项` : ''
      return `以下内容已采纳过：${entryLabelText}${suffix}。继续会再次覆盖当前内容，确定继续吗？`
    }

    const confirmAppliedEntrySelection = async entryList => {
      const appliedEntryList = entryList.filter(entry => entry?.isApplied)
      if (appliedEntryList.length === 0) {
        return true
      }
      try {
        await ElMessageBox.confirm(
          buildAppliedEntryConfirmMessage(appliedEntryList),
          '已采纳条目二次确认',
          {
            type: 'warning',
            confirmButtonText: '继续勾选',
            cancelButtonText: '取消'
          }
        )
        return true
      } catch (error) {
        return false
      }
    }

    const beforeReviewEntrySelect = async ({ entry, checked }) => {
      if (!checked || !entry?.isApplied) {
        return true
      }
      return await confirmAppliedEntrySelection([entry])
    }

    const beforeReviewGroupSelect = async ({ checked, entries }) => {
      if (!checked) {
        return true
      }
      return await confirmAppliedEntrySelection(entries || [])
    }

    const getJobTypeText = jobType => {
      return (
        jobTypeOptions.find(item => item.value === jobType)?.label || jobType
      )
    }

    const getTaskRelationText = taskRelation => {
      if (!taskRelation) {
        return ''
      }
      if (taskRelation.role === 'root') {
        const count = Number(taskRelation.childJobCount || 0)
        return `总任务，包含 ${count} 篇文章`
      }
      if (taskRelation.role === 'parent') {
        const count = Number(taskRelation.childJobCount || 0)
        return `文章父任务，${count} 个子任务`
      }
      if (taskRelation.role === 'child') {
        const kindLabel = childKindLabelMap[taskRelation.childKind] || '子任务'
        if (
          taskRelation.childKind === 'single-language-translation' &&
          taskRelation.childLanguageCode
        ) {
          return `${kindLabel}：${getLanguageText(
            taskRelation.childLanguageCode
          )}`
        }
        return kindLabel
      }
      return ''
    }

    const getLanguageText = languageCode => {
      if (languageCode === '__default') {
        return '全部'
      }
      return getSharedLanguageText(languageCode)
    }

    const getCorrectionDiff = item => {
      if (
        Array.isArray(item?.beforeSegments) &&
        Array.isArray(item?.afterSegments)
      ) {
        return { before: item.beforeSegments, after: item.afterSegments }
      }
      return diffTextSegments(item?.beforePreview, item?.afterPreview)
    }

    const validationIssueTypeTextMap = {
      inconsistent: '术语/译法不一致',
      inaccurate: '语义不准确',
      missing: '漏译',
      tone: '语气偏差',
      other: '其他问题'
    }

    const getValidationIssueTypeText = issueType => {
      const normalized = normalizePreviewText(issueType).toLowerCase()
      if (!normalized) {
        return '问题'
      }
      return validationIssueTypeTextMap[normalized] || issueType
    }

    // 全局校验速览会把长字段拆段展示，AI 返回的 confirmedIssue.entryId 可能带有"（第 N/M 段）"
    // 后缀；而逐条修正明细以基础 entryId（如 post.content）为准。比对问题清单与修正条目是否对应时，
    // 需要去掉段落后缀，否则会把"已修正"误判为"未改动"。
    const normalizeConfirmedIssueEntryId = value => {
      return normalizePreviewText(value).replace(
        /（第\s*\d+\s*\/\s*\d+\s*段）\s*$/,
        ''
      )
    }

    const getConfirmedIssueStatus = (issue, validation) => {
      const entryId = normalizeConfirmedIssueEntryId(issue?.entryId)
      if (!entryId) {
        return { text: '无对应条目', type: 'info' }
      }
      const corrections = Array.isArray(validation?.corrections)
        ? validation.corrections
        : []
      const matched = corrections.some(item => {
        return normalizeConfirmedIssueEntryId(item?.id) === entryId
      })
      // 状态为条目级：仅表示该问题所属的条目是否有修正，不代表这一条问题本身已被处理
      //（精确判定单条问题是否被修复无法可靠实现）。
      if (matched) {
        return { text: '所属条目有修正', type: 'success' }
      }
      return { text: '所属条目未改动', type: 'info' }
    }

    const getSelectedEntryCount = entryKeys => {
      const entryKeySet = new Set(entryKeys || [])
      return selectedEntryKeys.value.filter(entryKey => {
        return entryKeySet.has(entryKey)
      }).length
    }

    const getStatusTagType = status => {
      if (status === '执行中') {
        return 'warning'
      }
      if (status === '执行失败') {
        return 'danger'
      }
      if (status === '已阻塞') {
        return 'info'
      }
      if (status === '等待审核') {
        return 'primary'
      }
      if (status === '完全采纳') {
        return 'success'
      }
      if (status === '不采纳') {
        return 'danger'
      }
      return 'info'
    }

    const getFailureReasonText = failure => {
      const message = String(failure?.errorMessage || '').trim()
      const errorCode = String(failure?.errorCode || '').trim()
      if (message && message !== errorCode) {
        return message
      }
      return getFailureCodeLabel(failure)
    }

    const getFailureCodeLabel = failure => {
      const errorCode = String(failure?.errorCode || '').trim()
      if (!errorCode) {
        return ''
      }
      return failureCodeLabelMap[errorCode] || errorCode
    }

    const getFailureCodeMeaning = failure => {
      const errorCode = String(failure?.errorCode || '').trim()
      if (!errorCode) {
        return ''
      }
      return failureCodeMeaningMap[errorCode] || ''
    }

    const getFailureSubtitle = failure => {
      if (failure?.retryable === true) {
        return '任务已停止，请根据下面的错误信息修复后重试。'
      }
      return '任务已停止，请根据下面的错误信息修复后重新发起。'
    }

    const formatBytes = value => {
      const bytes = Number(value || 0)
      if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B'
      }

      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let size = bytes
      let unitIndex = 0
      while (size >= 1024 && unitIndex < units.length - 1) {
        size = size / 1024
        unitIndex += 1
      }

      if (unitIndex === 0) {
        return `${Math.round(size)} ${units[unitIndex]}`
      }

      let fractionDigits = 2
      if (size >= 10) {
        fractionDigits = 1
      }
      return `${size.toFixed(fractionDigits)} ${units[unitIndex]}`
    }

    const getFileCacheTypeText = cacheItem => {
      if (cacheItem?.key === 'aiLogs') {
        return cacheItem.root || 'server/ailog'
      }
      return '临时文件'
    }

    const formatDate = value => {
      if (!value) {
        return '-'
      }
      return new Date(value).toLocaleString()
    }

    const canRetry = row => {
      // 仅"执行失败"的任务可重试；未失败任务不显示重试。编排节点（root/parent）本身不执行，
      // 不直接重试——用户应重试其下具体失败的子任务（在平铺列表中可见）。
      if (row.status !== '执行失败') {
        return false
      }
      const role = row?.taskRelation?.role
      if (role === 'root' || role === 'parent') {
        return false
      }
      return row.failure?.retryable === true
    }

    // 暂缓 / 恢复 仅对顶层任务（独立任务、家族根任务）开放；家族 parent/child 子任务由家族
    // 按顺序自动调度，不单独暂缓。
    const canDeferJob = row => {
      const role = row?.taskRelation?.role
      if (role === 'parent' || role === 'child') {
        return false
      }
      // 仅真正在可领取队列中（active=true，如规划前的根/独立任务）才可暂缓；编排中的根
      // （active=false）不可暂缓。
      if (row.queueControl?.active !== true) {
        return false
      }
      return row.status === '未开始' && !row.queueControl?.deferred
    }

    const canResumeJob = row => {
      const role = row?.taskRelation?.role
      if (role === 'parent' || role === 'child') {
        return false
      }
      return row.status === '未开始' && row.queueControl?.deferred === true
    }

    const canStop = row => {
      return row?.status === '执行中'
    }

    const canReject = row => {
      if (row.jobType === sourcePostProperNounOrganizeJobType) {
        return false
      }
      return row.status === '等待审核'
    }

    const canDelete = row => {
      // 孤儿任务（rootId 未指向有效 root，bug 残留）允许在前端直接删除以便清理；后端按角色
      // 级联（parent 连子任务）或单删（child），并仍做执行中状态的安全校验。
      if (row?.isOrphan === true) {
        return true
      }
      // 家族 parent/child 子任务不单独删除；删除根任务会级联清理其下全部子任务。
      const role = row?.taskRelation?.role
      if (role === 'parent' || role === 'child') {
        return false
      }
      if (!deleteStatusSet.has(row.status)) {
        return false
      }
      // 家族根任务：当其下子任务仍在执行（running）或排队待执行（pending）时，不允许删除，
      // 避免在子任务执行过程中误删整个家族。
      if (role === 'root') {
        const childStats = row.taskRelation?.childStats || {}
        if (
          Number(childStats.running || 0) > 0 ||
          Number(childStats.pending || 0) > 0
        ) {
          return false
        }
      }
      return true
    }

    const selectAllReviewEntries = async tab => {
      const entryKeys = tab?.entryKeys || selectableEntryKeys.value
      const pendingEntryList = (
        tab?.reviewEntries || reviewDisplayEntries.value
      ).filter(entry => {
        return entry?.id && !selectedEntryKeys.value.includes(entry.id)
      })
      if ((await confirmAppliedEntrySelection(pendingEntryList)) === false) {
        return
      }
      const selectedSet = new Set(selectedEntryKeys.value)
      entryKeys.forEach(entryKey => {
        selectedSet.add(entryKey)
      })
      selectedEntryKeys.value = Array.from(selectedSet)
    }

    const clearReviewEntries = tab => {
      const entryKeys = tab?.entryKeys || selectableEntryKeys.value
      const clearSet = new Set(entryKeys)
      selectedEntryKeys.value = selectedEntryKeys.value.filter(entryKey => {
        return !clearSet.has(entryKey)
      })
    }

    const getCoverImageStatusText = entry => {
      if (entry?.adopted) {
        return '已采纳'
      }
      const status = entry?.status || ''
      if (status === 'generated') {
        return '已生成'
      }
      if (status === 'not-required') {
        return '无需处理'
      }
      if (status === 'recognition-skipped') {
        return '已跳过'
      }
      if (status === 'recognition-failed') {
        return '识别失败'
      }
      if (status === 'generation-failed') {
        return '生成失败'
      }
      if (status === 'cleaned') {
        return '已清理'
      }
      return status || '未知'
    }

    const getCoverImageStatusTagType = entry => {
      if (entry?.adopted) {
        return 'success'
      }
      if (entry?.status === 'generated') {
        return 'primary'
      }
      if (entry?.status === 'not-required') {
        return 'info'
      }
      if (entry?.status === 'recognition-skipped') {
        return 'info'
      }
      return 'warning'
    }

    const cleanupCoverImages = async () => {
      if (!currentJob.value?._id || !canCleanupCoverImages.value) {
        return
      }
      try {
        await ElMessageBox.confirm(
          '确认清理该任务的封面图临时文件？',
          '清理临时文件',
          {
            type: 'warning',
            confirmButtonText: '清理',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      coverImageCleanupLoading.value = true
      try {
        await multilingualApi.cleanupTranslationJobCoverImages({
          jobId: currentJob.value._id
        })
        ElMessage.success('封面图临时文件已清理')
        refreshDetail()
      } finally {
        coverImageCleanupLoading.value = false
      }
    }

    watch(
      reviewLanguageTabs,
      tabs => {
        if (tabs.length === 0) {
          activeReviewLanguageCode.value = ''
          return
        }
        const hasActiveTab = tabs.some(tab => {
          return tab.languageCode === activeReviewLanguageCode.value
        })
        if (!hasActiveTab) {
          activeReviewLanguageCode.value = tabs[0].languageCode
        }
      },
      { immediate: true }
    )

    watch(
      () => [params.page, params.limit],
      () => {
        getJobList(false)
      }
    )

    onMounted(() => {
      getJobList(false)
      getJobStorageSummary()
    })

    return {
      aiWorkflow,
      aiJsonLogStorageMissing,
      aiJsonLogStorageMissingMessage,
      aiWorkflowDialogVisible,
      applyForm,
      activeReviewLanguageCode,
      batchDeleting,
      canApplyCurrentJob,
      isRootOverview,
      isParentReview,
      familyParentCards,
      applyParentAll,
      applyFamilyAll,
      getJobRowClassName,
      canCleanupCoverImages,
      canSelectCoverImage,
      canDelete,
      canReject,
      canRetry,
      canDeferJob,
      canResumeJob,
      canStop,
      beforeReviewEntrySelect,
      beforeReviewGroupSelect,
      conflictList,
      currentJob,
      currentWorkflowStep,
      cleanupCoverImages,
      clearReviewEntries,
      coverImageCleanupLoading,
      deferJob,
      deleteJob,
      deleteSelectedJobs,
      detailDrawerVisible,
      executionWorkflowSteps,
      formatBytes,
      formatDate,
      getJobStorageSummary,
      getJobList,
      getJobTypeText,
      getCoverImageStatusTagType,
      getCoverImageStatusText,
      getFailureCodeLabel,
      getFailureCodeMeaning,
      getFileCacheTypeText,
      getFailureSubtitle,
      getFailureReasonText,
      getLanguageText,
      getAppliedEntryCount,
      getProgressStageText,
      getCorrectionDiff,
      getValidationIssueTypeText,
      getConfirmedIssueStatus,
      getSelectedEntryCount,
      getStatusTagType,
      getTaskRelationText,
      getWorkflowStepClass,
      getWorkflowStepCurrentText,
      getWorkflowStepStatusTagType,
      getWorkflowStepStatusText,
      getWorkflowStepSubtitle,
      handleJobSelectionChange,
      hasAiWorkflow,
      hasExecutionWorkflow,
      isJobSelectable,
      jobList,
      orphanJobs,
      jobStorageFileCaches,
      jobStorageTables,
      jobStorageTotals,
      jobStorageSummaryLoading,
      jobStorageUpdatedText,
      jobTypeOptions,
      openAiWorkflowDialog,
      openDetail,
      params,
      previewEntries,
      refreshJobPage,
      refreshDetail,
      rejectJob,
      reviewLanguageTabs,
      resumeJob,
      retryJob,
      selectAllReviewEntries,
      selectableEntryKeys,
      selectedEntryKeys,
      selectedDeletableJobIds,
      setCoverImageSelected,
      skippedReviewEntries,
      statusOptions,
      stopJob,
      tableRef,
      total,
      workflowProgressPercent,
      workflowRecentLogs,
      applySelectedEntries
    }
  }
}
</script>

<style scoped>
.translation-job-list-page {
  min-width: 0;
}

.translation-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 100%;
  min-width: 0;
}

.translation-action-buttons {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  max-width: 100%;
  min-width: 0;
}

.translation-action-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}

.translation-job-storage-panel {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 14px 16px;
}

.translation-job-storage-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.translation-job-storage-title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.translation-job-storage-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 2px;
}

.translation-job-storage-metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin-top: 14px;
}

.translation-job-storage-metric {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  min-width: 0;
  padding: 10px 12px;
}

.translation-job-storage-metric span {
  color: var(--el-text-color-secondary);
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.translation-job-storage-metric strong {
  color: var(--el-text-color-primary);
  display: block;
  font-size: 18px;
  line-height: 1.4;
  margin-top: 2px;
  word-break: break-all;
}

.translation-job-storage-table-list {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 12px;
  padding-top: 10px;
}

.translation-job-storage-table-row {
  align-items: flex-start;
  color: var(--el-text-color-secondary);
  display: flex;
  flex-wrap: wrap;
  font-size: 12px;
  gap: 8px 14px;
  justify-content: space-between;
  line-height: 1.6;
  word-break: break-word;
}

.translation-job-storage-table-row strong {
  color: var(--el-text-color-primary);
  margin-right: 8px;
}

.translation-job-storage-table-row span {
  word-break: break-all;
}

html.dark .translation-job-storage-panel {
  background: var(--el-fill-color-blank);
}

.source-title {
  font-weight: 600;
  word-break: break-word;
}

.source-meta {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}

.translation-task-relation {
  color: var(--el-color-primary);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
  overflow-wrap: anywhere;
}

/* 根任务总览：文章父任务卡片列表，点击下钻到父任务抽屉。 */
.family-parent-card-list {
  margin-bottom: 16px;
}
.family-parent-card-list-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}
.family-parent-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background-color: var(--el-bg-color);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.family-parent-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.family-parent-card-main {
  min-width: 0;
  flex: 1;
}
.family-parent-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}
.family-parent-card-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.family-parent-card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.family-parent-card-arrow {
  color: var(--el-text-color-secondary);
}

/* 平铺列表中仅用最左侧色块体现家族层级深度（根/文章父任务/子任务），不改行底色。 */
/* 同一色系（primary）：根任务最深 → 文章父任务 → 子任务最浅。 */
/* 注意：色块用 box-shadow（不占用点击区域），缩进只作用在第二列（任务列），
   绝不给第一列（选择框列）加 padding，否则会挤掉子任务的勾选框点击区。 */
:deep(.el-table__row.translation-job-row--root > td:first-child) {
  box-shadow: inset 4px 0 0 0 var(--el-color-primary);
}
:deep(.el-table__row.translation-job-row--parent > td:first-child) {
  box-shadow: inset 4px 0 0 0 var(--el-color-primary-light-3);
}
:deep(.el-table__row.translation-job-row--parent > td:nth-child(2)) {
  padding-left: 24px;
}
:deep(.el-table__row.translation-job-row--child > td:first-child) {
  box-shadow: inset 4px 0 0 0 var(--el-color-primary-light-7);
}
:deep(.el-table__row.translation-job-row--child > td:nth-child(2)) {
  padding-left: 44px;
}
/* 家族 parent/child 子任务不参与勾选删除，隐藏其选择框（仅顶层任务可勾选）。 */
:deep(.el-table__row.translation-job-row--parent > td:first-child .el-checkbox),
:deep(.el-table__row.translation-job-row--child > td:first-child .el-checkbox) {
  display: none;
}

/* 孤儿任务（rootId 未指向有效 root，可能由历史 bug 产生）：整行红色高亮 + 红色左色条，
   置于列表顶部，让管理员一眼感知到出现了孤儿数据，便于排查与清理。 */
:deep(.el-table__row.translation-job-row--orphan > td) {
  background-color: var(--el-color-danger-light-9);
}
:deep(.el-table__row.translation-job-row--orphan > td:first-child) {
  box-shadow: inset 4px 0 0 0 var(--el-color-danger);
}
:deep(
  .el-table__row.translation-job-row--orphan > td:first-child .el-checkbox
) {
  display: none;
}

.job-progress-step {
  margin-top: 4px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.job-status-cell {
  min-width: 0;
}

.job-status-reason {
  margin-top: 6px;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.table-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-empty-text {
  color: var(--el-text-color-secondary);
}

.job-row-actions,
.detail-summary,
.detail-header-actions,
.entry-title-line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.job-row-actions {
  gap: 6px;
}

.detail-header {
  align-items: flex-start;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
}

.detail-summary {
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
  padding: 14px 0;
}

.ai-json-log-missing-alert {
  margin-bottom: 16px;
}

.job-workflow-panel {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.job-workflow-panel-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.job-workflow-panel-title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.job-workflow-panel-subtitle,
.job-workflow-panel-tags,
.job-workflow-current-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.job-workflow-panel-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 2px;
}

.job-workflow-panel-tags {
  justify-content: flex-end;
}

.job-workflow-progress {
  margin-top: 12px;
}

.job-workflow-current {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-primary);
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.job-workflow-current-label {
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.job-workflow-current-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  margin-top: 2px;
  word-break: break-word;
}

.job-workflow-current-step {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.7;
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.job-workflow-current-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 8px;
}

.job-workflow-timeline {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 12px;
}

.job-workflow-step {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  grid-template-columns: 30px minmax(0, 1fr);
  min-width: 0;
  padding: 10px;
}

.job-workflow-step.is-current {
  border-color: var(--el-color-primary-light-5);
}

.job-workflow-step.is-pending {
  background: var(--el-fill-color-lighter);
  border-color: var(--el-border-color-lighter);
}

.job-workflow-step-index {
  align-items: center;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  color: var(--el-text-color-secondary);
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  height: 30px;
  justify-content: center;
  line-height: 1;
  width: 30px;
}

.job-workflow-step.is-completed .job-workflow-step-index {
  border-color: var(--el-color-success-light-5);
  color: var(--el-color-success);
}

.job-workflow-step.is-running .job-workflow-step-index,
.job-workflow-step.is-retrying .job-workflow-step-index {
  border-color: var(--el-color-warning-light-5);
  color: var(--el-color-warning);
}

.job-workflow-step.is-stopping .job-workflow-step-index,
.job-workflow-step.is-failed .job-workflow-step-index {
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}

.job-workflow-step.is-pending .job-workflow-step-index {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
}

.job-workflow-step.is-current .job-workflow-step-index {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

.job-workflow-step-content {
  min-width: 0;
}

.job-workflow-step-title-row {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: space-between;
}

.job-workflow-step-title {
  color: var(--el-text-color-primary);
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  min-width: 120px;
  word-break: break-word;
}

.job-workflow-step-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
  word-break: break-word;
}

.job-workflow-step.is-pending .job-workflow-step-title,
.job-workflow-step.is-pending .job-workflow-step-subtitle {
  color: var(--el-text-color-placeholder);
}

.job-workflow-log-list {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 12px;
  padding-top: 10px;
}

.job-workflow-log-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 6px;
}

.job-workflow-log-item {
  color: var(--el-text-color-secondary);
  display: grid;
  font-size: 12px;
  gap: 8px;
  grid-template-columns: 150px minmax(0, 1fr);
  line-height: 1.6;
}

.job-workflow-log-item span {
  min-width: 0;
  word-break: break-word;
}

html.dark .job-workflow-panel {
  background: var(--el-fill-color-blank);
}

html.dark .job-workflow-step.is-pending {
  background: var(--el-fill-color-extra-light);
}

.apply-toolbar {
  align-items: center;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: grid;
  gap: 12px;
  grid-template-columns: auto auto minmax(180px, 1fr);
  margin-bottom: 16px;
  padding-bottom: 16px;
}

.conflict-panel {
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 6px;
  margin: 16px 0;
  padding: 12px;
}

.job-state-panel {
  border-radius: 10px;
  margin: 16px 0;
  padding: 14px 16px;
}

.job-state-panel-danger {
  background: linear-gradient(
    180deg,
    var(--el-color-danger-light-9),
    var(--el-bg-color)
  );
  border: 1px solid var(--el-color-danger-light-5);
}

.job-state-panel-header,
.job-state-panel-tags,
.job-state-panel-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.job-state-panel-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.job-state-panel-title {
  color: var(--el-color-danger-dark-2);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.job-state-panel-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 2px;
}

.job-state-panel-message {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.7;
  margin-top: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.job-state-panel-code-hint {
  color: var(--el-color-danger-dark-2);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 8px;
}

.job-state-panel-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 10px;
}

html.dark .job-state-panel-danger {
  background: linear-gradient(
    180deg,
    rgba(var(--el-color-danger-rgb), 0.2),
    rgba(var(--el-color-danger-rgb), 0.08)
  );
  border-color: rgba(var(--el-color-danger-rgb), 0.4);
}

html.dark .job-state-panel-title,
html.dark .job-state-panel-code-hint {
  color: var(--el-color-danger-light-3);
}

html.dark .job-state-panel-subtitle,
html.dark .job-state-panel-meta {
  color: var(--el-text-color-regular);
}

.conflict-title {
  color: var(--el-color-warning-dark-2);
  font-weight: 600;
  margin-bottom: 8px;
}

.conflict-item {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  line-height: 1.6;
}

.translation-job-review-tabs {
  margin-top: 16px;
}

.translation-json-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.translation-dialog-intro {
  min-width: 0;
}

.translation-dialog-intro-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.translation-dialog-intro-text {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.translation-json-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.translation-json-warning-list {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-fill-color-extra-light);
}

.translation-json-group-title {
  display: flex;
  align-items: center;
  margin: 4px 0 10px;
  min-height: 21px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.translation-json-warning-item {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.cover-image-review-section {
  margin-bottom: 18px;
}

.translation-validation-card {
  margin-top: 18px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 12px;
  padding: 16px;
  background: var(--el-color-primary-light-9);
}

.translation-validation-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
}

.translation-validation-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.translation-validation-summary {
  margin-top: 10px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.translation-validation-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.translation-validation-section {
  margin-top: 14px;
}

.translation-validation-section-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 8px;
}

.translation-validation-correction {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  padding: 10px 12px;
  margin-bottom: 8px;
}

.translation-validation-correction-label {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.translation-validation-correction-reason {
  margin-top: 4px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.translation-validation-correction-reason-prefix {
  font-weight: 600;
  color: var(--el-color-primary);
}

.translation-validation-correction-diff {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.translation-validation-before {
  display: block;
  color: var(--el-color-danger);
}

.translation-validation-after {
  display: block;
  color: var(--el-color-success);
}

.translation-validation-diff-prefix {
  font-weight: 600;
}

.translation-validation-diff-removed {
  background-color: var(--el-color-danger-light-5);
  border-radius: 2px;
  padding: 0 2px;
  font-weight: 600;
}

.translation-validation-diff-added {
  background-color: var(--el-color-success-light-5);
  border-radius: 2px;
  padding: 0 2px;
  font-weight: 600;
}

.translation-validation-empty-text,
.translation-validation-style-notes {
  margin-top: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.translation-validation-term,
.translation-validation-issue {
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.7;
  word-break: break-word;
}

.translation-validation-issue-status {
  margin-right: 6px;
  vertical-align: middle;
}

.translation-validation-issue-type {
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.translation-validation-term-note {
  color: var(--el-text-color-secondary);
}

html.dark .translation-validation-card {
  background: var(--el-fill-color-darker);
  border-color: var(--el-color-primary-light-3);
}

html.dark .translation-validation-correction {
  background: var(--el-fill-color-blank);
}

.cover-image-review-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 14px;
}

.cover-image-review-header,
.cover-image-review-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
}

.cover-image-review-title-row {
  align-items: center;
  display: flex;
  flex: 1;
  gap: 8px;
  min-width: 0;
}

.cover-image-review-select {
  flex-shrink: 0;
}

.cover-image-review-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  min-width: 0;
  word-break: break-word;
}

.cover-image-review-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 12px;
}

.cover-image-preview-panel {
  min-width: 0;
}

.cover-image-preview-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 6px;
}

.cover-image-preview-img,
.cover-image-preview-empty {
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  color: var(--el-text-color-secondary);
  min-height: 140px;
  width: 100%;
}

.cover-image-preview-img {
  aspect-ratio: 16 / 9;
  display: block;
  object-fit: contain;
}

.cover-image-preview-empty {
  align-items: center;
  display: flex;
  justify-content: center;
}

.cover-image-review-message {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  margin-top: 10px;
  word-break: break-word;
}

.cover-image-review-adoption {
  align-items: center;
  color: var(--el-text-color-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.cover-image-review-adoption-text {
  font-size: 12px;
}

.cover-image-review-actions {
  justify-content: flex-end;
  margin-top: 12px;
}

.ai-skipped-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-skipped-item span {
  min-width: 0;
}

@media (max-width: 767px) {
  .common-top-search-form-body {
    float: none !important;
    width: 100%;
  }

  .translation-search-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }

  .translation-search-form :deep(.el-input),
  .translation-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .translation-actions {
    display: flex;
    flex-direction: column;
    float: none !important;
    justify-content: flex-start;
    align-items: stretch;
    margin-top: 10px;
    width: 100%;
  }

  .translation-action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
    width: 100%;
  }

  .translation-action-buttons :deep(.el-button) {
    flex-shrink: 0;
    margin-left: 0;
    width: auto;
  }

  .translation-batch-delete-button {
    max-width: 100%;
    padding-left: 10px;
    padding-right: 10px;
  }

  .translation-refresh-button {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-width: 44px;
    width: 44px;
    min-height: 32px;
    padding-left: 0;
    padding-right: 0;
  }

  .translation-job-storage-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .translation-job-storage-table-row {
    display: block;
  }

  .detail-header {
    display: block;
  }

  .detail-header-actions {
    margin-top: 12px;
  }

  .apply-toolbar {
    grid-template-columns: 1fr;
  }

  .translation-json-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .job-state-panel-header {
    flex-direction: column;
  }

  .job-workflow-panel-header {
    flex-direction: column;
  }

  .job-workflow-panel-tags {
    justify-content: flex-start;
  }

  .job-workflow-timeline {
    grid-template-columns: 1fr;
  }

  .job-workflow-log-item {
    grid-template-columns: 1fr;
  }

  .cover-image-review-grid {
    grid-template-columns: 1fr;
  }

  .translation-json-toolbar-actions {
    flex-wrap: wrap;
  }
}
</style>
