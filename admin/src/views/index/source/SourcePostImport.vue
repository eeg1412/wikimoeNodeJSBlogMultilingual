<template>
  <div class="common-right-panel-form source-post-import-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>源文章导入</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="source-post-search-form"
          @submit.prevent
          @keypress.enter="getSourceDatabasePostList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="标题、alias、摘要、源 ID"
              clearable
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.type"
              placeholder="类型"
              clearable
              style="width: 120px"
            >
              <el-option
                v-for="item in postTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.status"
              placeholder="状态"
              clearable
              style="width: 120px"
            >
              <el-option
                v-for="item in postStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getSourceDatabasePostList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr source-post-actions">
        <el-button @click="getSourceDatabasePostList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="sourcePostList"
        row-key="sourceId"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="getPostTypeTagType(row.type)" effect="plain">
              {{ getPostTypeText(row.type) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源文章" min-width="280">
          <template #default="{ row }">
            <div class="source-title">
              {{ getPostDisplayTitle(row) }}
            </div>
            <div class="source-meta">{{ row.sourceId }}</div>
            <div
              v-if="row.excerpt && Number(row.type) !== 2"
              class="source-excerpt"
            >
              {{ row.excerpt }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="作者" min-width="140">
          <template #default="{ row }">
            {{ row.author?.nickname || row.author?.username || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn prop="alias" label="Alias" min-width="150" />
        <ResponsiveTableColumn label="分类" min-width="160">
          <template #default="{ row }">
            {{ row.sort?.sortname || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="标签" min-width="220">
          <template #default="{ row }">
            <div v-if="row.tags?.length" class="table-tag-list">
              <el-tag
                v-for="tag in row.tags"
                :key="tag._id"
                size="small"
                effect="plain"
              >
                #{{ tag.tagname }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="地点" min-width="220">
          <template #default="{ row }">
            <div v-if="row.mappointList?.length" class="table-tag-list">
              <el-tag
                v-for="mappoint in row.mappointList"
                :key="mappoint._id"
                size="small"
                effect="plain"
              >
                {{ mappoint.title }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="关联与相关内容" min-width="420">
          <template #default="{ row }">
            <PostRelationSummary :post="row" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getPostStatusTagType(row.status)" effect="plain">
              {{ getPostStatusText(row.status) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="快照状态" min-width="190">
          <template #default="{ row }">
            <div
              v-if="row.snapshotSummary?.length"
              class="snapshot-language-tags"
            >
              <el-tag
                v-for="snapshot in row.snapshotSummary"
                :key="snapshot._id"
                type="success"
                size="small"
                effect="plain"
              >
                {{ getLanguageText(snapshot.sourceLanguageCode) }} / v{{
                  snapshot.snapshotVersion || 1
                }}
              </el-tag>
            </div>
            <el-tag v-else type="info" effect="plain">未生成</el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源更新时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.updatedAt || row.date || row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.hasSnapshot"
              type="primary"
              size="small"
              :loading="rowActionLoadingMap[row.sourceId]"
              @click="openLanguageDialog(row, 'import')"
            >
              生成快照
            </el-button>
            <el-button
              v-if="row.hasSnapshot"
              type="warning"
              size="small"
              :loading="rowActionLoadingMap[row.sourceId]"
              @click="openLanguageDialog(row, 'overwrite')"
            >
              覆盖快照
            </el-button>
            <el-button
              v-if="row.hasSnapshot"
              size="small"
              @click="goSnapshot(row)"
            >
              查看快照
            </el-button>
            <el-button
              v-if="!row.hasSnapshot"
              type="success"
              size="small"
              :loading="rowActionLoadingMap[getAiActionKey(row)]"
              :disabled="rowActionLoadingMap[row.sourceId]"
              @click="openAiImportDialog(row)"
            >
              生成并AI翻译
            </el-button>
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

    <el-dialog
      v-model="resultDialogVisible"
      title="快照生成结果"
      width="760px"
      align-center
    >
      <template v-if="result">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="源快照 ID">
            {{ result.sourceSnapshotId }}
          </el-descriptions-item>
          <el-descriptions-item label="翻译组 ID">
            {{ result.translationGroupId }}
          </el-descriptions-item>
          <el-descriptions-item label="快照版本">
            {{ result.snapshotVersion }}
          </el-descriptions-item>
          <el-descriptions-item label="待复核翻译">
            {{ result.sourceChangedTranslations || 0 }}
          </el-descriptions-item>
        </el-descriptions>
        <div class="mt20" v-if="copiedCountRows.length > 0">
          <div class="result-title">复制统计</div>
          <div class="copied-count-grid">
            <div
              v-for="item in copiedCountRows"
              :key="item.collectionName"
              class="copied-count-item"
            >
              <div class="copied-count-name">{{ item.collectionName }}</div>
              <div class="copied-count-values">
                创建 {{ item.created }} / 复用 {{ item.reused }} / 更新
                {{ item.updated }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="aiDialogVisible"
      title="生成并AI翻译"
      width="min(1120px, 96vw)"
      align-center
      destroy-on-close
      append-to-body
      :show-close="!isAiImportBusy"
      :close-on-click-modal="!isAiImportBusy"
      :close-on-press-escape="!isAiImportBusy"
      :before-close="handleAiDialogBeforeClose"
      @closed="resetAiImportState"
    >
      <div
        v-loading="aiApplying"
        element-loading-text="正在保存，请稍候"
        class="ai-import-dialog-body"
      >
        <template v-if="aiStep === 'setup'">
          <el-form
            :model="aiForm"
            label-width="120px"
            class="ai-import-form"
            @submit.prevent
          >
            <el-form-item label="源语言" required>
              <el-select
                v-model="aiForm.sourceLanguageCode"
                class="w_10"
                filterable
                :disabled="isAiImportBusy"
                @change="handleAiSourceLanguageChange"
              >
                <el-option
                  v-for="item in languageOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="翻译为" required>
              <el-checkbox-group
                v-model="aiForm.targetLanguageCodes"
                :disabled="isAiImportBusy"
                class="ai-language-checks"
              >
                <el-checkbox
                  v-for="item in targetLanguageOptions"
                  :key="item.value"
                  :label="item.value"
                >
                  {{ item.label }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="此次提示词">
              <el-input
                v-model="aiForm.prompt"
                type="textarea"
                :rows="5"
                :disabled="isAiImportBusy"
                placeholder="可补充本次翻译的语气、专有名词、保留词或风格要求"
              />
            </el-form-item>
            <el-form-item label="名词检索">
              <el-switch
                v-model="aiForm.searchOfficialTermTranslations"
                :disabled="isAiImportBusy || officialTermSearchDefaultLoading"
                active-text="联网检索官方译名"
              />
            </el-form-item>
          </el-form>
        </template>

        <template v-if="aiStep === 'running'">
          <el-descriptions class="mb20" :column="3" border>
            <el-descriptions-item label="源文章">
              {{ aiRow ? getPostDisplayTitle(aiRow) : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="源语言">
              {{ getLanguageText(aiForm.sourceLanguageCode) }}
            </el-descriptions-item>
            <el-descriptions-item label="目标语言">
              {{ aiForm.targetLanguageCodes.length }}
            </el-descriptions-item>
          </el-descriptions>
          <div ref="aiStreamFeedbackRef" class="ai-stream-feedback">
            <div class="translation-json-group-title">实时进度</div>
            <div
              v-for="item in aiProgressList"
              :key="item.id"
              class="ai-stream-status-item"
            >
              {{ item.message }}
            </div>
            <pre
              v-if="aiStreamContent"
              ref="aiStreamContentRef"
              class="ai-stream-content"
              >{{ aiStreamContent }}</pre
            >
          </div>
        </template>

        <template v-if="aiStep === 'preview'">
          <el-alert
            class="mb20"
            type="warning"
            show-icon
            :closable="false"
            title="确认保存后，会写入所选语言版本和关联内容。"
          />

          <el-form label-width="120px" class="ai-import-form" @submit.prevent>
            <el-form-item label="采用语言">
              <el-checkbox-group
                v-model="selectedAiResultLanguageCodes"
                :disabled="isAiImportBusy"
                class="ai-language-checks"
              >
                <el-checkbox
                  v-for="item in aiResultList"
                  :key="item.languageCode"
                  :label="item.languageCode"
                >
                  {{ getLanguageText(item.languageCode) }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="保存后发布">
              <el-checkbox-group
                v-model="aiPublishLanguageCodes"
                :disabled="isAiImportBusy"
                class="ai-language-checks"
              >
                <el-checkbox
                  v-for="item in aiResultList"
                  :key="item.languageCode"
                  :label="item.languageCode"
                  :disabled="
                    !selectedAiResultLanguageCodes.includes(item.languageCode)
                  "
                >
                  {{ getLanguageText(item.languageCode) }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </el-form>

          <el-tabs
            v-model="activeAiPreviewLanguageCode"
            class="ai-preview-tabs"
          >
            <el-tab-pane
              v-for="resultItem in aiResultList"
              :key="resultItem.languageCode"
              :label="getLanguageText(resultItem.languageCode)"
              :name="resultItem.languageCode"
            >
              <el-descriptions class="mb20" :column="4" border>
                <el-descriptions-item label="可写入变更">
                  {{ getPreviewTotalChangeCount(resultItem.preview) }}
                </el-descriptions-item>
                <el-descriptions-item label="跳过条目">
                  {{ resultItem.preview.skippedCount }}
                </el-descriptions-item>
                <el-descriptions-item label="暂未翻译">
                  {{ resultItem.skippedEntries.length }}
                </el-descriptions-item>
                <el-descriptions-item label="处理内容">
                  {{ resultItem.entryCount }}
                </el-descriptions-item>
              </el-descriptions>

              <el-alert
                v-if="!hasPreviewChanges(resultItem.preview)"
                class="mb20"
                type="info"
                show-icon
                :closable="false"
                title="内容与源内容一致，仍可采用并发布。"
              />

              <div
                v-if="
                  resultItem.preview.aiSkipList.length > 0 ||
                  resultItem.skippedEntries.length > 0 ||
                  resultItem.preview.warningList.length > 0
                "
                class="translation-json-warning-list"
              >
                <div
                  v-for="item in resultItem.preview.aiSkipList"
                  :key="item.id"
                  class="translation-skip-preview-card"
                >
                  <div class="translation-import-preview-item-title">
                    <TranslationEntryMeta :entry="item" />
                  </div>
                  <div class="translation-skip-preview-columns">
                    <div
                      v-if="item.hasSourceValue"
                      class="translation-skip-preview-panel"
                    >
                      <div class="translation-import-preview-panel-title">
                        源文
                        <div
                          v-if="
                            item.sourceRecordLabel &&
                            item.sourceRecordLabel !== item.recordLabel
                          "
                          class="translation-import-preview-panel-context"
                        >
                          {{ item.sourceRecordLabel }}
                        </div>
                      </div>
                      <div
                        v-if="item.sourceHtml"
                        class="translation-import-preview-html"
                        v-html="item.sourceHtml"
                      />
                      <pre
                        v-if="!item.sourceHtml"
                        class="translation-import-preview-raw"
                        >{{ item.sourceValue }}</pre
                      >
                    </div>
                    <div class="translation-skip-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        当前
                      </div>
                      <div
                        v-if="item.targetHtml"
                        class="translation-import-preview-html"
                        v-html="item.targetHtml"
                      />
                      <pre
                        v-if="!item.targetHtml"
                        class="translation-import-preview-raw"
                        >{{ item.targetValue }}</pre
                      >
                    </div>
                    <div class="translation-skip-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        跳过说明
                      </div>
                      <div class="translation-skip-reason">
                        {{ item.reason }}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-for="item in resultItem.skippedEntries"
                  :key="item.id"
                  class="translation-skip-preview-card"
                >
                  <div class="translation-import-preview-item-title">
                    <TranslationEntryMeta :entry="item" />
                  </div>
                  <div class="translation-skip-preview-columns">
                    <div
                      v-if="item.hasSourceValue"
                      class="translation-skip-preview-panel"
                    >
                      <div class="translation-import-preview-panel-title">
                        源文
                        <div
                          v-if="
                            item.sourceRecordLabel &&
                            item.sourceRecordLabel !== item.recordLabel
                          "
                          class="translation-import-preview-panel-context"
                        >
                          {{ item.sourceRecordLabel }}
                        </div>
                      </div>
                      <div
                        v-if="item.sourceHtml"
                        class="translation-import-preview-html"
                        v-html="item.sourceHtml"
                      />
                      <pre
                        v-if="!item.sourceHtml"
                        class="translation-import-preview-raw"
                        >{{ item.sourceValue }}</pre
                      >
                    </div>
                    <div class="translation-skip-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        当前
                        <div
                          v-if="
                            item.targetRecordLabel &&
                            item.targetRecordLabel !== item.recordLabel
                          "
                          class="translation-import-preview-panel-context"
                        >
                          {{ item.targetRecordLabel }}
                        </div>
                      </div>
                      <template v-if="item.hasCurrentValue">
                        <div
                          v-if="item.targetHtml"
                          class="translation-import-preview-html"
                          v-html="item.targetHtml"
                        />
                        <pre
                          v-if="!item.targetHtml"
                          class="translation-import-preview-raw"
                          >{{ item.targetValue }}</pre
                        >
                      </template>
                      <div v-else class="translation-import-preview-empty">
                        不存在当前语言内容（未导入）
                      </div>
                    </div>
                    <div class="translation-skip-preview-panel">
                      <div class="translation-import-preview-panel-title">
                        跳过说明
                      </div>
                      <div class="translation-skip-reason">
                        {{ item.reason || item.message }}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-for="warning in resultItem.preview.warningList"
                  :key="warning"
                  class="translation-json-warning-item"
                >
                  {{ warning }}
                </div>
              </div>

              <div
                v-if="getAiResultCoverImageEntries(resultItem).length > 0"
                class="cover-image-review-section"
              >
                <div class="translation-json-group-title">封面图</div>
                <div
                  v-for="item in getAiResultCoverImageEntries(resultItem)"
                  :key="item.id"
                  class="cover-image-review-item"
                >
                  <div class="cover-image-review-header">
                    <div class="cover-image-review-title-row">
                      <el-checkbox
                        class="cover-image-review-select"
                        :model-value="
                          getSelectedAiResultEntryIds(
                            resultItem.languageCode
                          ).includes(item.id)
                        "
                        :disabled="!canSelectCoverImage(item)"
                        :aria-label="`${item.targetTitle || item.sourceTitle || '未命名封面'} 采纳选择`"
                        @change="
                          checked =>
                            setAiResultCoverImageSelected(
                              resultItem,
                              item,
                              checked
                            )
                        "
                      />
                      <div class="cover-image-review-title">
                        {{
                          item.targetTitle || item.sourceTitle || '未命名封面'
                        }}
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
                </div>
              </div>

              <div
                v-if="getAiResultSelectableEntryIds(resultItem).length > 0"
                class="translation-json-toolbar"
              >
                <div class="translation-dialog-intro">
                  <div class="translation-dialog-intro-title">选择采纳字段</div>
                  <div class="translation-dialog-intro-text">
                    已采纳
                    {{ getSelectedAiResultEntryCount(resultItem) }}
                    项。采纳粒度和文章 AI 翻译前字段选择一致。
                  </div>
                </div>
                <div class="translation-json-toolbar-actions">
                  <el-button
                    size="small"
                    :disabled="isAiImportBusy"
                    @click="setAllAiResultEntriesSelected(resultItem, true)"
                  >
                    全选
                  </el-button>
                  <el-button
                    size="small"
                    :disabled="isAiImportBusy"
                    @click="setAllAiResultEntriesSelected(resultItem, false)"
                  >
                    清空
                  </el-button>
                </div>
              </div>

              <div
                v-if="(resultItem.relatedResults || []).length > 0"
                class="translation-related-preview-list"
              >
                <div class="translation-dialog-intro">
                  <div class="translation-dialog-intro-title">
                    关联博文/推文预览
                  </div>
                  <div class="translation-dialog-intro-text">
                    共
                    {{ (resultItem.relatedResults || []).length }}
                    篇，保存主文章时将一并保存。
                  </div>
                </div>

                <div
                  v-for="relatedItem in resultItem.relatedResults"
                  :key="`related:${relatedItem.sourceId}`"
                  class="translation-related-preview-card"
                >
                  <div class="translation-related-preview-header">
                    {{ getRelatedPostTypeLabel(relatedItem.sourcePost) }}：
                    {{ getAiResultPostTitle(relatedItem.sourcePost) }}
                  </div>
                  <el-descriptions :column="3" border class="mb10">
                    <el-descriptions-item label="变更字段">
                      {{ getPreviewTotalChangeCount(relatedItem.preview) }}
                    </el-descriptions-item>
                    <el-descriptions-item label="跳过字段">
                      {{ relatedItem.preview.skippedCount }}
                    </el-descriptions-item>
                    <el-descriptions-item label="处理内容">
                      {{ relatedItem.entryCount }}
                    </el-descriptions-item>
                  </el-descriptions>

                  <div
                    v-if="getAiRelatedCoverImageEntries(relatedItem).length > 0"
                    class="cover-image-review-section"
                  >
                    <div class="translation-json-group-title">封面图</div>
                    <div
                      v-for="item in getAiRelatedCoverImageEntries(relatedItem)"
                      :key="item.id"
                      class="cover-image-review-item"
                    >
                      <div class="cover-image-review-header">
                        <div class="cover-image-review-title-row">
                          <el-checkbox
                            class="cover-image-review-select"
                            :model-value="
                              getSelectedAiRelatedEntryIds(
                                resultItem.languageCode,
                                relatedItem.sourceId
                              ).includes(item.id)
                            "
                            :disabled="!canSelectCoverImage(item)"
                            :aria-label="`${item.targetTitle || item.sourceTitle || '未命名封面'} 采纳选择`"
                            @change="
                              checked =>
                                setAiRelatedCoverImageSelected(
                                  resultItem,
                                  relatedItem,
                                  item,
                                  checked
                                )
                            "
                          />
                          <div class="cover-image-review-title">
                            {{
                              item.targetTitle ||
                              item.sourceTitle ||
                              '未命名封面'
                            }}
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
                    </div>
                  </div>

                  <div
                    v-if="
                      getAiRelatedSelectableEntryIds(relatedItem).length > 0
                    "
                    class="translation-json-toolbar"
                  >
                    <div class="translation-dialog-intro">
                      <div class="translation-dialog-intro-title">
                        选择关联内容采纳字段
                      </div>
                      <div class="translation-dialog-intro-text">
                        已采纳
                        {{
                          getSelectedAiRelatedEntryCount(
                            resultItem,
                            relatedItem
                          )
                        }}
                        项。
                      </div>
                    </div>
                    <div class="translation-json-toolbar-actions">
                      <el-button
                        size="small"
                        :disabled="isAiImportBusy"
                        @click="
                          setAllAiRelatedEntriesSelected(
                            resultItem,
                            relatedItem,
                            true
                          )
                        "
                      >
                        全选
                      </el-button>
                      <el-button
                        size="small"
                        :disabled="isAiImportBusy"
                        @click="
                          setAllAiRelatedEntriesSelected(
                            resultItem,
                            relatedItem,
                            false
                          )
                        "
                      >
                        清空
                      </el-button>
                    </div>
                  </div>

                  <TranslationEntrySelectableGroups
                    v-if="hasPreviewTextChanges(relatedItem.preview)"
                    :model-value="
                      getSelectedAiRelatedEntryIds(
                        resultItem.languageCode,
                        relatedItem.sourceId
                      )
                    "
                    :groups="relatedItem.previewGroups"
                    :disabled="isAiImportBusy"
                    current-preview-label="写入前"
                    source-preview-label="源文"
                    next-preview-label="AI 翻译后"
                    class="w_10"
                    @update:model-value="
                      entryIds =>
                        setSelectedAiRelatedEntryIds(
                          resultItem.languageCode,
                          relatedItem.sourceId,
                          entryIds
                        )
                    "
                  />
                </div>
              </div>

              <TranslationEntrySelectableGroups
                v-if="hasPreviewTextChanges(resultItem.preview)"
                :model-value="
                  getSelectedAiResultEntryIds(resultItem.languageCode)
                "
                :groups="resultItem.previewGroups"
                :disabled="isAiImportBusy"
                current-preview-label="写入前"
                source-preview-label="源文"
                next-preview-label="AI 翻译后"
                class="w_10"
                @update:model-value="
                  entryIds =>
                    setSelectedAiResultEntryIds(
                      resultItem.languageCode,
                      entryIds
                    )
                "
              />
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>

      <template #footer>
        <el-button :disabled="isAiImportBusy" @click="aiDialogVisible = false">
          取消
        </el-button>
        <el-button
          v-if="aiStep === 'preview'"
          :disabled="isAiImportBusy"
          @click="backToAiSetup"
        >
          返回调整
        </el-button>
        <el-button
          v-if="aiStep === 'running'"
          type="danger"
          :disabled="!aiRunning"
          @click="stopAiImportTranslation"
        >
          停止翻译
        </el-button>
        <el-button
          v-if="aiStep !== 'preview'"
          type="primary"
          plain
          :disabled="isAiImportBusy"
          @click="createSourcePostAiImportJob"
        >
          创建后台任务
        </el-button>
        <el-button
          v-if="aiStep !== 'preview'"
          type="primary"
          :loading="aiRunning"
          :disabled="isAiImportBusy"
          @click="startAiImportTranslation"
        >
          开始
        </el-button>
        <el-button
          v-else
          type="primary"
          :loading="aiApplying"
          :disabled="
            isAiImportBusy || selectedAiResultLanguageCodes.length === 0
          "
          @click="confirmAiImportApply"
        >
          保存所选结果
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="languageDialogVisible"
      :title="languageDialogTitle"
      width="480px"
      align-center
      destroy-on-close
    >
      <el-form :model="languageForm" label-width="110px" @submit.prevent>
        <el-form-item label="快照语言" required>
          <el-select v-model="languageForm.sourceLanguageCode" class="w_10">
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="languageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmLanguageAction">
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { multilingualApi } from '@/api'
import PostRelationSummary from '@/components/PostRelationSummary.vue'
import TranslationEntrySelectableGroups from '@/components/TranslationEntrySelectableGroups.vue'
import TranslationEntryMeta from '@/components/TranslationEntryMeta.vue'
import ls from '@/utils/ls'
import store from '@/store'
import {
  createApiErrorFromResponse,
  extractApiErrorMessages
} from '@/utils/apiError'
import {
  POST_STATUS_OPTIONS,
  POST_TYPE_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getPostStatusTagType,
  getPostStatusText,
  getPostDisplayTitle,
  getPostTypeTagType,
  getPostTypeText
} from '@/utils/multilingual'
import { groupTranslationEntryList } from '@/utils/translationEntryDisplay'
import { getOfficialTermSearchDefaultValue } from '@/utils/internetSearchAiSettings'
import {
  buildTranslationImportPreview,
  renderRichTextDocument
} from '@/utils/translationJson'
import {
  buildPreviewPostFromSource,
  buildPostTranslationEntries,
  buildSourceMappedTranslationEntries,
  buildTranslationEntryDeduplicationKey,
  buildTranslationPostForm
} from '@/utils/translationPostAiWorkflow'

const SOURCE_IMPORT_LANGUAGE_STORAGE_KEY = 'wikimoe-source-import-language'
const AI_IMPORT_SOURCE_LANGUAGE_STORAGE_KEY =
  'wikimoe-ai-import-source-language'
const AI_IMPORT_TARGET_LANGUAGES_STORAGE_KEY =
  'wikimoe-ai-import-target-languages'
const AI_COVER_IMAGE_ENTRY_TYPE = 'coverImageTranslation'
const POST_RELATION_FIELD_LIST = [
  'postList',
  'tweetList',
  'contentPostList',
  'contentTweetList'
]

export default {
  components: {
    PostRelationSummary,
    TranslationEntrySelectableGroups,
    TranslationEntryMeta
  },
  setup() {
    const router = useRouter()
    const tableRef = ref(null)
    const sourcePostList = ref([])
    const total = ref(0)
    const result = ref(null)
    const resultDialogVisible = ref(false)
    const languageDialogVisible = ref(false)
    const aiDialogVisible = ref(false)
    const languageAction = ref('import')
    const languageRow = ref(null)
    const aiRow = ref(null)
    const aiStep = ref('setup')
    const aiRunning = ref(false)
    const aiApplying = ref(false)
    const aiResultList = ref([])
    const selectedAiResultLanguageCodes = ref([])
    const selectedAiResultEntryIdsMap = ref({})
    const selectedAiRelatedEntryIdsMap = ref({})
    const aiPublishLanguageCodes = ref([])
    const activeAiPreviewLanguageCode = ref('')
    const aiProgressList = ref([])
    const aiStreamContent = ref('')
    const aiAbortController = ref(null)
    const aiStreamFeedbackRef = ref(null)
    const aiStreamContentRef = ref(null)
    const officialTermSearchDefaultLoading = ref(false)
    const rowActionLoadingMap = reactive({})
    let officialTermSearchDefaultRequestId = 0
    const languageForm = reactive({
      sourceLanguageCode: 'zh-CN'
    })
    const aiForm = reactive({
      sourceLanguageCode: 'zh-CN',
      targetLanguageCodes: [],
      prompt: '',
      searchOfficialTermTranslations: false
    })
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      type: '',
      status: ''
    })

    const languageDialogTitle = computed(() => {
      if (languageAction.value === 'overwrite') {
        return '选择要覆盖的快照语言'
      }
      return '选择源文章快照语言'
    })

    const isAiImportBusy = computed(() => {
      return aiRunning.value || aiApplying.value
    })

    const isAiAbortError = error => {
      if (!error) {
        return false
      }
      const errorName = String(error.name || '')
      if (errorName === 'AbortError') {
        return true
      }
      const errorCode = String(error.code || '')
      if (errorCode === 'ERR_CANCELED') {
        return true
      }
      const errorMessage = String(error.message || '')
      if (errorMessage.includes('AI_IMPORT_ABORTED')) {
        return true
      }
      return errorMessage.includes('aborted')
    }

    const throwAiAbortIfNeeded = abortSignal => {
      if (abortSignal && abortSignal.aborted) {
        const abortError = new Error('AI_IMPORT_ABORTED')
        abortError.name = 'AbortError'
        throw abortError
      }
    }

    const targetLanguageOptions = computed(() => {
      return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
        return item.value !== aiForm.sourceLanguageCode
      })
    })

    const copiedCountRows = computed(() => {
      const copiedCounts = result.value?.copiedCounts || {}
      return Object.keys(copiedCounts).map(collectionName => {
        const item = copiedCounts[collectionName] || {}
        return {
          collectionName,
          created: item.created || 0,
          reused: item.reused || 0,
          updated: item.updated || 0
        }
      })
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.type !== '') {
        requestParams.type = params.type
      }
      if (params.status !== '') {
        requestParams.status = params.status
      }
      return requestParams
    }

    const getSourceDatabasePostList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      multilingualApi
        .getSourceDatabasePostList(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          sourcePostList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
        })
        .catch(error => {
          console.log(error)
        })
    }

    const setRowLoading = (row, value) => {
      rowActionLoadingMap[row.sourceId] = value
    }

    const syncRowSnapshot = (row, data) => {
      row.hasSnapshot = true
      row.snapshot = {
        _id: data.sourceSnapshotId,
        sourceId: row.sourceId,
        sourceLanguageCode: data.sourceLanguageCode,
        translationGroupId: data.translationGroupId,
        snapshotVersion: data.snapshotVersion,
        sourceSnapshotAt: new Date()
      }
      row.snapshotSummary = [
        ...(row.snapshotSummary || []).filter(snapshot => {
          return snapshot.sourceLanguageCode !== data.sourceLanguageCode
        }),
        row.snapshot
      ]
    }

    const getStoredSourceLanguageCode = () => {
      const storedValue = ls.getItem(SOURCE_IMPORT_LANGUAGE_STORAGE_KEY)
      const matched = SUPPORTED_LANGUAGE_OPTIONS.find(item => {
        return item.value === storedValue
      })
      if (matched) {
        return matched.value
      }
      return 'zh-CN'
    }

    const rememberSourceLanguageCode = sourceLanguageCode => {
      ls.setItem(SOURCE_IMPORT_LANGUAGE_STORAGE_KEY, sourceLanguageCode)
    }

    const getStoredAiSourceLanguageCode = () => {
      const storedValue = ls.getItem(AI_IMPORT_SOURCE_LANGUAGE_STORAGE_KEY)
      const matched = SUPPORTED_LANGUAGE_OPTIONS.find(item => {
        return item.value === storedValue
      })
      if (matched) {
        return matched.value
      }
      return getStoredSourceLanguageCode()
    }

    const getStoredAiTargetLanguageCodes = sourceLanguageCode => {
      const storedValue = ls.getItem(AI_IMPORT_TARGET_LANGUAGES_STORAGE_KEY)
      let storedList = []
      if (storedValue) {
        try {
          const parsedValue = JSON.parse(storedValue)
          if (Array.isArray(parsedValue)) {
            storedList = parsedValue
          }
        } catch (error) {
          storedList = String(storedValue)
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        }
      }
      const supportedCodeSet = new Set(
        SUPPORTED_LANGUAGE_OPTIONS.map(item => item.value)
      )
      const targetList = storedList.filter(languageCode => {
        return (
          supportedCodeSet.has(languageCode) &&
          languageCode !== sourceLanguageCode
        )
      })
      if (targetList.length > 0) {
        return targetList
      }
      const firstTarget = SUPPORTED_LANGUAGE_OPTIONS.find(item => {
        return item.value !== sourceLanguageCode
      })
      return firstTarget ? [firstTarget.value] : []
    }

    const rememberAiImportOptions = () => {
      ls.setItem(
        AI_IMPORT_SOURCE_LANGUAGE_STORAGE_KEY,
        aiForm.sourceLanguageCode
      )
      ls.setItem(
        AI_IMPORT_TARGET_LANGUAGES_STORAGE_KEY,
        JSON.stringify(aiForm.targetLanguageCodes)
      )
    }

    const openLanguageDialog = (row, action) => {
      languageRow.value = row
      languageAction.value = action
      languageForm.sourceLanguageCode = getStoredSourceLanguageCode()
      languageDialogVisible.value = true
    }

    const resetAiImportState = () => {
      if (aiAbortController.value) {
        aiAbortController.value.abort()
        aiAbortController.value = null
      }
      aiRow.value = null
      aiStep.value = 'setup'
      aiRunning.value = false
      aiApplying.value = false
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      selectedAiResultEntryIdsMap.value = {}
      selectedAiRelatedEntryIdsMap.value = {}
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
      aiForm.prompt = ''
      aiForm.searchOfficialTermTranslations = false
      officialTermSearchDefaultLoading.value = false
      officialTermSearchDefaultRequestId += 1
    }

    const applyOfficialTermSearchDefault = async () => {
      const requestId = officialTermSearchDefaultRequestId + 1
      officialTermSearchDefaultRequestId = requestId
      officialTermSearchDefaultLoading.value = true
      try {
        const defaultValue =
          await getOfficialTermSearchDefaultValue(multilingualApi)
        if (requestId !== officialTermSearchDefaultRequestId) {
          return
        }
        if (!aiDialogVisible.value) {
          return
        }
        aiForm.searchOfficialTermTranslations = defaultValue
      } catch (error) {
        if (requestId === officialTermSearchDefaultRequestId) {
          extractApiErrorMessages(error).forEach(message => {
            ElMessage.error(message)
          })
        }
      } finally {
        if (requestId === officialTermSearchDefaultRequestId) {
          officialTermSearchDefaultLoading.value = false
        }
      }
    }

    const openAiImportDialog = row => {
      aiRow.value = row
      aiStep.value = 'setup'
      aiRunning.value = false
      aiApplying.value = false
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      selectedAiResultEntryIdsMap.value = {}
      selectedAiRelatedEntryIdsMap.value = {}
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
      aiForm.sourceLanguageCode = getStoredAiSourceLanguageCode()
      aiForm.targetLanguageCodes = getStoredAiTargetLanguageCodes(
        aiForm.sourceLanguageCode
      )
      aiForm.prompt = ''
      aiForm.searchOfficialTermTranslations = false
      aiDialogVisible.value = true
      applyOfficialTermSearchDefault()
    }

    const handleAiSourceLanguageChange = () => {
      aiForm.targetLanguageCodes = aiForm.targetLanguageCodes.filter(
        languageCode => languageCode !== aiForm.sourceLanguageCode
      )
      if (aiForm.targetLanguageCodes.length === 0) {
        aiForm.targetLanguageCodes = getStoredAiTargetLanguageCodes(
          aiForm.sourceLanguageCode
        )
      }
    }

    const getAiActionKey = row => {
      return `ai:${row.sourceId}`
    }

    const setAiRowLoading = value => {
      if (!aiRow.value) {
        return
      }
      rowActionLoadingMap[getAiActionKey(aiRow.value)] = value
    }

    const pushAiProgress = message => {
      if (!message) {
        return
      }
      aiProgressList.value.push({
        id: `${Date.now()}-${aiProgressList.value.length}`,
        message
      })
      scrollAiStreamFeedbackToBottom()
    }

    const scrollAiStreamFeedbackToBottom = () => {
      nextTick(() => {
        window.requestAnimationFrame(() => {
          const feedbackElement = aiStreamFeedbackRef.value
          if (feedbackElement) {
            feedbackElement.scrollTop = feedbackElement.scrollHeight
          }
          const contentElement = aiStreamContentRef.value
          if (contentElement) {
            contentElement.scrollTop = contentElement.scrollHeight
          }
        })
      })
    }

    const handleAiDialogBeforeClose = done => {
      if (isAiImportBusy.value) {
        return
      }
      done()
    }

    const backToAiSetup = () => {
      aiStep.value = 'setup'
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      selectedAiResultEntryIdsMap.value = {}
      selectedAiRelatedEntryIdsMap.value = {}
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
    }

    const stopAiImportTranslation = () => {
      if (!aiRunning.value) {
        return
      }
      if (!aiAbortController.value) {
        return
      }
      aiAbortController.value.abort()
      pushAiProgress('已请求停止翻译，正在中断任务...')
    }

    const getAiImportPreviewCoverEntries = preview => {
      if (!Array.isArray(preview?.coverImagePreviewEntries)) {
        return []
      }
      return preview.coverImagePreviewEntries.filter(Boolean)
    }

    const buildCoverImageReviewEntries = preview => {
      return getAiImportPreviewCoverEntries(preview).map(entry => {
        return {
          ...entry,
          id: String(entry?.entryKey || entry?.artifactId || ''),
          isApplied: entry?.adopted === true
        }
      })
    }

    const canSelectCoverImage = entry => {
      if (!entry?.id || !entry?.artifactId) {
        return false
      }
      if (entry.isApplied === true) {
        return false
      }
      if (entry.status !== 'generated') {
        return false
      }
      return Boolean(entry.generatedCoverUrl)
    }

    const getAiResultCoverImageEntries = resultItem => {
      return buildCoverImageReviewEntries(resultItem?.preview)
    }

    const getAiRelatedCoverImageEntries = relatedItem => {
      return buildCoverImageReviewEntries(relatedItem?.preview)
    }

    const getSelectableCoverImageIds = preview => {
      return buildCoverImageReviewEntries(preview)
        .filter(entry => {
          return canSelectCoverImage(entry)
        })
        .map(entry => entry.id)
        .filter(Boolean)
    }

    const getAiResultSelectableEntryIds = resultItem => {
      const changeList = resultItem?.preview?.changeList || []
      return changeList
        .map(item => item.id)
        .filter(Boolean)
        .concat(getSelectableCoverImageIds(resultItem?.preview))
    }

    const getSelectedAiResultEntryIds = languageCode => {
      return selectedAiResultEntryIdsMap.value[languageCode] || []
    }

    const setSelectedAiResultEntryIds = (languageCode, entryIds) => {
      selectedAiResultEntryIdsMap.value = {
        ...selectedAiResultEntryIdsMap.value,
        [languageCode]: Array.from(new Set(entryIds.filter(Boolean)))
      }
    }

    const getAiRelatedSelectionKey = (languageCode, sourceId) => {
      return `${languageCode}:${sourceId}`
    }

    const getAiRelatedSelectableEntryIds = relatedItem => {
      const changeList = relatedItem?.preview?.changeList || []
      return changeList
        .map(item => item.id)
        .filter(Boolean)
        .concat(getSelectableCoverImageIds(relatedItem?.preview))
    }

    const getSelectedAiRelatedEntryIds = (languageCode, sourceId) => {
      const key = getAiRelatedSelectionKey(languageCode, sourceId)
      return selectedAiRelatedEntryIdsMap.value[key] || []
    }

    const setSelectedAiRelatedEntryIds = (languageCode, sourceId, entryIds) => {
      const key = getAiRelatedSelectionKey(languageCode, sourceId)
      selectedAiRelatedEntryIdsMap.value = {
        ...selectedAiRelatedEntryIdsMap.value,
        [key]: Array.from(new Set(entryIds.filter(Boolean)))
      }
    }

    const setAiResultCoverImageSelected = (resultItem, entry, checked) => {
      const entryKey = String(entry?.id || '')
      if (!entryKey || !canSelectCoverImage(entry)) {
        return
      }
      const nextSelectedIds = new Set(
        getSelectedAiResultEntryIds(resultItem.languageCode)
      )
      if (checked) {
        nextSelectedIds.add(entryKey)
      } else {
        nextSelectedIds.delete(entryKey)
      }
      setSelectedAiResultEntryIds(
        resultItem.languageCode,
        Array.from(nextSelectedIds)
      )
    }

    const setAiRelatedCoverImageSelected = (
      resultItem,
      relatedItem,
      entry,
      checked
    ) => {
      const entryKey = String(entry?.id || '')
      if (!entryKey || !canSelectCoverImage(entry)) {
        return
      }
      const nextSelectedIds = new Set(
        getSelectedAiRelatedEntryIds(
          resultItem.languageCode,
          relatedItem.sourceId
        )
      )
      if (checked) {
        nextSelectedIds.add(entryKey)
      } else {
        nextSelectedIds.delete(entryKey)
      }
      setSelectedAiRelatedEntryIds(
        resultItem.languageCode,
        relatedItem.sourceId,
        Array.from(nextSelectedIds)
      )
    }

    const initSelectedAiResultEntryIds = resultList => {
      const nextMap = {}
      const nextRelatedMap = {}
      resultList.forEach(resultItem => {
        nextMap[resultItem.languageCode] =
          getAiResultSelectableEntryIds(resultItem)
        ;(resultItem.relatedResults || []).forEach(relatedItem => {
          const key = getAiRelatedSelectionKey(
            resultItem.languageCode,
            relatedItem.sourceId
          )
          nextRelatedMap[key] = getAiRelatedSelectableEntryIds(relatedItem)
        })
      })
      selectedAiResultEntryIdsMap.value = nextMap
      selectedAiRelatedEntryIdsMap.value = nextRelatedMap
    }

    const getSelectedAiResultEntryCount = resultItem => {
      const selectableIdSet = new Set(getAiResultSelectableEntryIds(resultItem))
      return getSelectedAiResultEntryIds(resultItem.languageCode).filter(id => {
        return selectableIdSet.has(id)
      }).length
    }

    const setAllAiResultEntriesSelected = (resultItem, checked) => {
      setSelectedAiResultEntryIds(
        resultItem.languageCode,
        checked ? getAiResultSelectableEntryIds(resultItem) : []
      )
    }

    const getSelectedAiRelatedEntryCount = (resultItem, relatedItem) => {
      const selectableIdSet = new Set(
        getAiRelatedSelectableEntryIds(relatedItem)
      )
      return getSelectedAiRelatedEntryIds(
        resultItem.languageCode,
        relatedItem.sourceId
      ).filter(id => {
        return selectableIdSet.has(id)
      }).length
    }

    const setAllAiRelatedEntriesSelected = (
      resultItem,
      relatedItem,
      checked
    ) => {
      setSelectedAiRelatedEntryIds(
        resultItem.languageCode,
        relatedItem.sourceId,
        checked ? getAiRelatedSelectableEntryIds(relatedItem) : []
      )
    }

    const buildSelectedAiImportPayload = resultItem => {
      const selectedIdSet = new Set(
        getSelectedAiResultEntryIds(resultItem.languageCode)
      )
      const selectableIdSet = new Set(getAiResultSelectableEntryIds(resultItem))
      return {
        ...resultItem.payload,
        entries: (resultItem.payload?.entries || []).filter(entry => {
          return selectableIdSet.has(entry.id) && selectedIdSet.has(entry.id)
        })
      }
    }

    const buildSelectedCoverImagePreviewEntries = (preview, selectedIds) => {
      const selectedIdSet = new Set(
        (selectedIds || []).map(item => String(item))
      )
      return buildCoverImageReviewEntries(preview).filter(entry => {
        return selectedIdSet.has(entry.id) && canSelectCoverImage(entry)
      })
    }

    const buildSelectedCoverImageArtifacts = (preview, selectedIds) => {
      const selectedArtifactIdSet = new Set(
        buildSelectedCoverImagePreviewEntries(preview, selectedIds)
          .map(entry => String(entry?.artifactId || ''))
          .filter(Boolean)
      )
      const artifactList = Array.isArray(preview?.coverImageArtifacts)
        ? preview.coverImageArtifacts
        : []
      return artifactList.filter(artifact => {
        return selectedArtifactIdSet.has(String(artifact?.artifactId || ''))
      })
    }

    const buildSelectedAiRelatedImportPayload = (resultItem, relatedItem) => {
      const selectedIdSet = new Set(
        getSelectedAiRelatedEntryIds(
          resultItem.languageCode,
          relatedItem.sourceId
        )
      )
      const selectableIdSet = new Set(
        getAiRelatedSelectableEntryIds(relatedItem)
      )
      return {
        ...relatedItem.payload,
        entries: (relatedItem.payload?.entries || []).filter(entry => {
          return selectableIdSet.has(entry.id) && selectedIdSet.has(entry.id)
        })
      }
    }

    const normalizePreviewText = value => {
      if (value === null || typeof value === 'undefined') {
        return ''
      }
      return String(value).trim()
    }

    const isPreviewSnapshotId = snapshotId => {
      const normalizedSnapshotId = normalizePreviewText(snapshotId)
      if (!normalizedSnapshotId) {
        return false
      }
      return normalizedSnapshotId.startsWith('preview-source-')
    }

    const hasCurrentSnapshotVersion = post => {
      const snapshotId = normalizePreviewText(post?.sourceSnapshotId)
      if (!snapshotId) {
        return false
      }
      return !isPreviewSnapshotId(snapshotId)
    }

    const getRelatedPostTypeLabel = post => {
      const postType = Number(post?.type)
      if (postType === 1) {
        return '关联博文'
      }
      if (postType === 2) {
        return '关联推文'
      }
      return '关联内容'
    }

    const htmlToPreviewText = html => {
      const text = normalizePreviewText(html)
      if (!text) {
        return ''
      }
      const container = document.createElement('div')
      container.innerHTML = text
      return normalizePreviewText(container.textContent || container.innerText)
    }

    const getEntryPreviewText = (entry, rawFieldName, htmlFieldName) => {
      const htmlText = htmlToPreviewText(entry?.[htmlFieldName])
      if (htmlText) {
        return htmlText
      }
      return normalizePreviewText(entry?.[rawFieldName])
    }

    const buildAiResultPreviewGroupsWithContext = (preview, targetPost) => {
      const hideCurrentPreview = !hasCurrentSnapshotVersion(targetPost)
      return groupTranslationEntryList(preview.changeList || []).map(group => {
        return {
          ...group,
          entries: group.entries.map(entry => {
            const currentPreviewText = getEntryPreviewText(
              entry,
              'currentValue',
              'currentHtml'
            )
            const sourcePreviewText = getEntryPreviewText(
              entry,
              'sourceValue',
              'sourceHtml'
            )
            const nextPreviewText = getEntryPreviewText(
              entry,
              'nextValue',
              'nextHtml'
            )
            const currentPreviewHtml = normalizePreviewText(entry.currentHtml)
            const sourcePreviewHtml = normalizePreviewText(entry.sourceHtml)
            const nextPreviewHtml = normalizePreviewText(entry.nextHtml)
            let finalCurrentPreviewText = currentPreviewText
            let finalCurrentPreviewHtml = currentPreviewHtml
            if (hideCurrentPreview) {
              finalCurrentPreviewText = ''
              finalCurrentPreviewHtml = ''
            } else if (
              currentPreviewText &&
              sourcePreviewText &&
              currentPreviewText === sourcePreviewText
            ) {
              finalCurrentPreviewText = ''
              finalCurrentPreviewHtml = ''
            }
            return {
              ...entry,
              currentPreviewText: finalCurrentPreviewText,
              currentPreviewHtml: finalCurrentPreviewHtml,
              sourcePreviewText,
              sourcePreviewHtml,
              nextPreviewText,
              nextPreviewHtml
            }
          })
        }
      })
    }

    const getRecordSourceId = record => {
      if (!record || typeof record !== 'object') {
        return ''
      }
      const sourceId = String(record.sourceId || record._id || '').trim()
      if (!sourceId) {
        return ''
      }
      return sourceId
    }

    const getAiResultPostTitle = post => {
      const title = normalizePreviewText(getPostDisplayTitle(post || {}))
      if (title && title !== '-') {
        return title
      }
      const sourceId = getRecordSourceId(post)
      if (sourceId) {
        return `${getRelatedPostTypeLabel(post)} ${sourceId}`
      }
      return getRelatedPostTypeLabel(post)
    }

    const getRelatedSourceIdsForTranslate = (sourcePost, targetPost) => {
      const sourceIdSet = new Set()
      POST_RELATION_FIELD_LIST.forEach(fieldName => {
        const sourceRelationList = Array.isArray(sourcePost[fieldName])
          ? sourcePost[fieldName]
          : []
        const targetRelationList = Array.isArray(targetPost[fieldName])
          ? targetPost[fieldName]
          : []
        const targetRelationMap = new Map()
        targetRelationList.forEach(record => {
          const sourceId = getRecordSourceId(record)
          if (!sourceId) {
            return
          }
          targetRelationMap.set(sourceId, record)
        })

        sourceRelationList.forEach(record => {
          const sourceId = getRecordSourceId(record)
          if (!sourceId) {
            return
          }
          const targetRecord = targetRelationMap.get(sourceId)
          if (!targetRecord) {
            sourceIdSet.add(sourceId)
            return
          }
          if (targetRecord.aiTranslationSkip === true) {
            return
          }
          sourceIdSet.add(sourceId)
        })
      })
      return Array.from(sourceIdSet)
    }

    const confirmLanguageAction = () => {
      const row = languageRow.value
      if (!row) {
        return
      }
      rememberSourceLanguageCode(languageForm.sourceLanguageCode)
      languageDialogVisible.value = false
      if (languageAction.value === 'overwrite') {
        overwriteRow(row, languageForm.sourceLanguageCode)
        return
      }
      importRow(row, languageForm.sourceLanguageCode)
    }

    const importRow = async (row, sourceLanguageCode) => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.importSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode,
          overwrite: false
        })
        result.value = response.data.data
        result.value.sourceLanguageCode = sourceLanguageCode
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照生成成功')
        getSourceDatabasePostList(false)
      } catch (error) {
        await handleImportError(row, error, sourceLanguageCode)
      } finally {
        setRowLoading(row, false)
      }
    }

    const assertAiRowCanPreview = row => {
      if (!row) {
        throw new Error('请选择源文章')
      }
      if (row.hasSnapshot || (row.snapshotSummary || []).length > 0) {
        throw new Error('该文章已经生成快照，不能使用导入并翻译')
      }
    }

    const loadSourceDatabasePostById = async ({
      sourceId,
      ensureNoSnapshot
    }) => {
      const response = await multilingualApi.getSourceDatabasePostDetail(
        {
          id: String(sourceId),
          sourceLanguageCode: aiForm.sourceLanguageCode
        },
        true
      )
      const sourcePost = response.data.data?.post
      if (!sourcePost) {
        throw new Error('源文章不存在')
      }
      if (ensureNoSnapshot) {
        assertAiRowCanPreview(sourcePost)
      }
      return sourcePost
    }

    const loadSourceDatabasePost = async row => {
      return await loadSourceDatabasePostById({
        sourceId: row.sourceId,
        ensureNoSnapshot: true
      })
    }

    const parseClientSseBlock = block => {
      const eventData = {
        eventName: 'message',
        data: {}
      }
      const dataLines = []
      block.split(/\r?\n/).forEach(line => {
        if (line.startsWith('event:')) {
          eventData.eventName = line.slice(6).trim()
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
      })
      if (dataLines.length === 0) {
        return null
      }
      eventData.data = JSON.parse(dataLines.join('\n'))
      return eventData
    }

    const findClientSseBoundary = buffer => {
      const lfIndex = buffer.indexOf('\n\n')
      const crlfIndex = buffer.indexOf('\r\n\r\n')
      if (lfIndex < 0 && crlfIndex < 0) {
        return { index: -1, length: 0 }
      }
      if (lfIndex < 0) {
        return { index: crlfIndex, length: 4 }
      }
      if (crlfIndex < 0) {
        return { index: lfIndex, length: 2 }
      }
      if (lfIndex < crlfIndex) {
        return { index: lfIndex, length: 2 }
      }
      return { index: crlfIndex, length: 4 }
    }

    const buildPreviewPayloadForPost = (payload, post, languageCode) => {
      return {
        ...(payload || {}),
        meta: {
          ...(payload?.meta || {}),
          postId: String(post._id || post.id || ''),
          contentId: String(post._id || post.id || ''),
          languageCode,
          sourceLanguageCode: aiForm.sourceLanguageCode
        }
      }
    }

    const normalizeAiCoverWarningList = warningList => {
      if (!Array.isArray(warningList)) {
        return []
      }
      return warningList
        .map(item => {
          if (typeof item === 'string') {
            return item.trim()
          }
          if (item && typeof item.message === 'string') {
            return item.message.trim()
          }
          return ''
        })
        .filter(Boolean)
    }

    const isGeneratedAiCoverPreviewEntry = entry => {
      return Boolean(
        entry &&
        entry.entryType === AI_COVER_IMAGE_ENTRY_TYPE &&
        entry.status === 'generated' &&
        entry.generatedCoverUrl
      )
    }

    const buildAiImportPreview = ({
      data,
      languageCode,
      targetPost,
      referenceEntries,
      currentEntries
    }) => {
      const payload = buildPreviewPayloadForPost(
        data?.payload,
        targetPost,
        languageCode
      )
      const preview = buildTranslationImportPreview({
        parsedPayload: payload,
        currentEntries,
        form: buildTranslationPostForm(targetPost),
        referenceEntries
      })
      const coverImagePreviewEntries = Array.isArray(
        data?.coverImagePreviewEntries
      )
        ? data.coverImagePreviewEntries.filter(Boolean)
        : []
      const coverImageArtifacts = Array.isArray(data?.coverImageArtifacts)
        ? data.coverImageArtifacts.filter(Boolean)
        : []
      const coverImageWarnings = normalizeAiCoverWarningList(
        data?.coverImageWarnings
      )
      const coverImageChangeCount = coverImagePreviewEntries.filter(entry => {
        return isGeneratedAiCoverPreviewEntry(entry)
      }).length

      return {
        ...preview,
        coverImagePreviewEntries,
        coverImageArtifacts,
        coverImageWarnings,
        coverImageChangeCount,
        totalChangeCount: preview.changeCount + coverImageChangeCount,
        warningList: preview.warningList.concat(coverImageWarnings),
        skippedCount:
          preview.aiSkipList.length +
          preview.warningList.length +
          coverImageWarnings.length
      }
    }

    const getPreviewCoverImageChangeCount = preview => {
      return Number(preview?.coverImageChangeCount || 0)
    }

    const getPreviewTotalChangeCount = preview => {
      const totalChangeCount = Number(preview?.totalChangeCount)
      if (Number.isFinite(totalChangeCount)) {
        return totalChangeCount
      }

      return (
        Number(preview?.changeCount || 0) +
        getPreviewCoverImageChangeCount(preview)
      )
    }

    const hasPreviewTextChanges = preview => {
      return Number(preview?.changeCount || 0) > 0
    }

    const hasPreviewChanges = preview => {
      return getPreviewTotalChangeCount(preview) > 0
    }

    const getCoverImageStatusText = entry => {
      if (entry?.adopted || entry?.isApplied) {
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
      if (entry?.adopted || entry?.isApplied) {
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

    const handleAiStreamEvent = (
      eventData,
      languageCode,
      targetPost,
      referenceEntries,
      currentEntries,
      progressContextLabel = ''
    ) => {
      if (!eventData) {
        return null
      }
      const data = eventData.data || {}
      if (eventData.eventName === 'status') {
        const contextPrefix = progressContextLabel
          ? `${progressContextLabel}：`
          : ''
        pushAiProgress(
          `${getLanguageText(languageCode)}：${contextPrefix}${data.message}`
        )
      }
      if (eventData.eventName === 'chunk') {
        if (data.contentDelta) {
          aiStreamContent.value += data.contentDelta
          scrollAiStreamFeedbackToBottom()
        }
      }
      if (eventData.eventName === 'chunkRollback') {
        const contentLength = Number(data.contentLength || 0)
        if (contentLength > 0) {
          aiStreamContent.value = aiStreamContent.value.slice(
            0,
            Math.max(aiStreamContent.value.length - contentLength, 0)
          )
        }
      }
      if (eventData.eventName === 'result') {
        const preview = buildAiImportPreview({
          data,
          languageCode,
          targetPost,
          referenceEntries,
          currentEntries
        })
        const payload = buildPreviewPayloadForPost(
          data.payload,
          targetPost,
          languageCode
        )
        return { preview, payload }
      }
      if (eventData.eventName === 'error') {
        throw new Error(data.message || 'AI 翻译失败')
      }
      return null
    }

    const readAiTranslationStream = async ({
      response,
      languageCode,
      targetPost,
      referenceEntries,
      currentEntries,
      progressContextLabel = ''
    }) => {
      if (!response.body) {
        throw new Error('当前浏览器无法读取翻译进度')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let preview = null
      let payload = null

      const consumeBuffer = () => {
        let boundary = findClientSseBoundary(buffer)
        while (boundary.index >= 0) {
          const block = buffer.slice(0, boundary.index)
          buffer = buffer.slice(boundary.index + boundary.length)
          const result = handleAiStreamEvent(
            parseClientSseBlock(block),
            languageCode,
            targetPost,
            referenceEntries,
            currentEntries,
            progressContextLabel
          )
          if (result?.preview) {
            preview = result.preview
            payload = result.payload
          }
          boundary = findClientSseBoundary(buffer)
        }
      }

      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) {
          buffer += decoder.decode(result.value, { stream: !done })
          consumeBuffer()
        }
      }

      if (buffer.trim()) {
        const result = handleAiStreamEvent(
          parseClientSseBlock(buffer),
          languageCode,
          targetPost,
          referenceEntries,
          currentEntries,
          progressContextLabel
        )
        if (result?.preview) {
          preview = result.preview
          payload = result.payload
        }
      }

      if (!preview) {
        throw new Error(`${getLanguageText(languageCode)} 没有生成预览`)
      }
      return { preview, payload }
    }

    const canAiKeepOriginalEntry = entry => {
      return entry.scope !== 'post' && entry.valueType !== 'richTextDocument'
    }

    const shouldSubmitAiImportEntry = entry => {
      return entry.aiTranslationSkip !== true
    }

    const buildEntryPreviewHtml = (valueType, value) => {
      if (valueType === 'richTextDocument') {
        return normalizePreviewText(renderRichTextDocument(value))
      }
      if (valueType === 'richTextLite') {
        return normalizePreviewText(value)
      }
      return ''
    }

    const buildAiSkippedEntryPreview = ({ entry, reason, message, id }) => {
      return {
        id,
        scope: entry.scope,
        label: entry.label || entry.recordLabel || entry.id,
        groupLabel: entry.groupLabel,
        groupCategory: entry.groupCategory,
        groupTitle: entry.groupTitle,
        valueType: entry.valueType,
        fieldName: entry.fieldName,
        fieldLabel: entry.fieldLabel,
        recordLabel: entry.recordLabel,
        relationTypeLabel: entry.relationTypeLabel,
        collectionName: entry.collectionName,
        postType: entry.postType,
        optional: entry.optional,
        entryKind: entry.entryKind,
        segmentIndex: entry.segmentIndex,
        segmentTotal: entry.segmentTotal,
        hasSourceValue: true,
        hasCurrentValue: true,
        sourceRecordLabel: entry.recordLabel || '',
        sourceValue: entry.sourcePreviewRawValue,
        sourceHtml: buildEntryPreviewHtml(entry.valueType, entry.value),
        targetRecordLabel: entry.recordLabel || '',
        targetValue: entry.currentPreviewRawValue,
        targetHtml: buildEntryPreviewHtml(entry.valueType, entry.currentValue),
        reason,
        message
      }
    }

    const buildAiTranslationSkipEntries = entries => {
      const skippedEntryMap = new Map()
      entries.forEach(entry => {
        if (entry.aiTranslationSkip !== true) {
          return
        }
        const key = [
          entry.scope || '',
          entry.collectionName || '',
          entry.recordId || '',
          entry.fieldName || entry.id || ''
        ].join(':')
        if (skippedEntryMap.has(key)) {
          return
        }
        const label = entry.label || entry.recordLabel || entry.id
        skippedEntryMap.set(
          key,
          buildAiSkippedEntryPreview({
            entry,
            id: `aiTranslationSkip:${key}`,
            reason: 'AI翻译时跳过',
            message: `${label}：已标记为 AI 翻译时跳过`
          })
        )
      })
      return Array.from(skippedEntryMap.values())
    }

    const getEntrySourceId = entry => {
      return normalizePreviewText(entry?.sourceId)
    }

    const shouldSkipRelatedPostRelationEntry = (entry, relatedSourceIdSet) => {
      if (entry.scope !== 'relation' || entry.collectionName !== 'posts') {
        return false
      }
      const sourceId = getEntrySourceId(entry)
      return Boolean(sourceId && relatedSourceIdSet.has(sourceId))
    }

    const deduplicateAiImportEntries = ({
      entries,
      sourcePostId,
      relatedSourceIds,
      translatedEntryKeySet
    }) => {
      const relatedSourceIdSet = new Set(
        relatedSourceIds.map(sourceId => String(sourceId))
      )
      const nextEntries = []
      const skippedEntries = []
      const skippedEntryKeySet = new Set()

      entries.forEach(entry => {
        const entryKey = buildTranslationEntryDeduplicationKey(entry, {
          sourcePostId
        })
        if (
          shouldSkipRelatedPostRelationEntry(entry, relatedSourceIdSet) === true
        ) {
          const skipKey = `relatedPost:${entryKey || entry.id}`
          if (!skippedEntryKeySet.has(skipKey)) {
            skippedEntryKeySet.add(skipKey)
            const label = entry.label || entry.recordLabel || entry.id
            skippedEntries.push(
              buildAiSkippedEntryPreview({
                entry,
                id: `aiRelatedPostDuplicate:${skipKey}`,
                reason: '关联文章独立翻译',
                message: `${label}：关联文章会作为独立文章翻译，已跳过当前关联字段`
              })
            )
          }
          return
        }

        if (!entryKey) {
          nextEntries.push(entry)
          return
        }

        if (translatedEntryKeySet.has(entryKey)) {
          const skipKey = `duplicate:${entryKey}`
          if (!skippedEntryKeySet.has(skipKey)) {
            skippedEntryKeySet.add(skipKey)
            const label = entry.label || entry.recordLabel || entry.id
            skippedEntries.push(
              buildAiSkippedEntryPreview({
                entry,
                id: `aiDuplicate:${skipKey}`,
                reason: '本次已处理',
                message: `${label}：本次翻译已处理相同内容，已跳过重复请求`
              })
            )
          }
          return
        }

        translatedEntryKeySet.add(entryKey)
        nextEntries.push(entry)
      })

      return {
        entries: nextEntries,
        skippedEntries
      }
    }

    const loadAiImportPreviewContext = async ({ sourcePost, languageCode }) => {
      const response =
        await multilingualApi.getSourcePostAiImportPreviewContext(
          {
            sourceId: String(sourcePost.sourceId || sourcePost._id),
            sourceLanguageCode: aiForm.sourceLanguageCode,
            targetLanguageCode: languageCode
          },
          true
        )
      const data = response.data.data || {}
      if (!data.sourcePost || !data.targetPost) {
        throw new Error(`${getLanguageText(languageCode)} 预览上下文缺失`)
      }
      return data
    }

    const translateOnePostForLanguage = async ({
      sourcePost,
      languageCode,
      abortSignal,
      progressContextLabel,
      translatedEntryKeySet
    }) => {
      throwAiAbortIfNeeded(abortSignal)
      const previewContext = await loadAiImportPreviewContext({
        sourcePost,
        languageCode
      })
      throwAiAbortIfNeeded(abortSignal)
      const sourcePostId = String(
        previewContext.sourcePost.sourceId ||
          previewContext.sourcePost._id ||
          ''
      )
      const sourcePreviewPost = buildPreviewPostFromSource({
        sourcePost: previewContext.sourcePost,
        sourceLanguageCode: aiForm.sourceLanguageCode,
        languageCode: aiForm.sourceLanguageCode,
        previewId: `preview-source-${
          previewContext.sourcePost.sourceId || previewContext.sourcePost._id
        }`
      })
      const targetPreviewPost = previewContext.targetPost
      const mappedResult = buildSourceMappedTranslationEntries(
        sourcePreviewPost,
        targetPreviewPost
      )
      const relatedSourceIds = getRelatedSourceIdsForTranslate(
        previewContext.sourcePost,
        targetPreviewPost
      )
      const aiTranslationSkippedEntries = buildAiTranslationSkipEntries(
        mappedResult.entries
      )
      const deduplicationResult = deduplicateAiImportEntries({
        entries: mappedResult.entries.filter(shouldSubmitAiImportEntry),
        sourcePostId,
        relatedSourceIds,
        translatedEntryKeySet
      })
      const entries = deduplicationResult.entries.map(entry => {
        const aiEntry = { ...entry }
        if (canAiKeepOriginalEntry(entry)) {
          aiEntry.skipAllowed = true
        }
        return aiEntry
      })

      throwAiAbortIfNeeded(abortSignal)
      const postTitle = getPostDisplayTitle(previewContext.sourcePost)
      const postLabel =
        postTitle && postTitle !== '-' ? postTitle : sourcePostId
      const progressContextWithPost = `${progressContextLabel}「${postLabel}」`
      pushAiProgress(
        `${getLanguageText(languageCode)}：正在翻译${progressContextWithPost}`
      )
      const response = await fetch(
        '/api/multilingual-admin/source/post/ai-import-translate-stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${store.getters.adminToken}`
          },
          signal: abortSignal,
          body: JSON.stringify({
            sourceId: sourcePostId,
            sourceLanguageCode: aiForm.sourceLanguageCode,
            targetLanguageCode: languageCode,
            targetLanguageCodes: aiForm.targetLanguageCodes,
            prompt: aiForm.prompt,
            skipUsageLog: true,
            searchOfficialTermTranslations:
              aiForm.searchOfficialTermTranslations,
            translateCoverImage: false,
            allowEmptyEntries: true,
            entries
          })
        }
      )

      if (!response.ok) {
        throw await createApiErrorFromResponse(response, 'AI 翻译请求失败')
      }

      const streamResult = await readAiTranslationStream({
        response,
        languageCode,
        targetPost: targetPreviewPost,
        referenceEntries: entries,
        currentEntries: buildPostTranslationEntries(targetPreviewPost, {
          includeEmpty: true
        }),
        progressContextLabel: progressContextWithPost
      })

      return {
        sourceId: sourcePostId,
        sourcePost: previewContext.sourcePost,
        targetPost: targetPreviewPost,
        languageCode,
        payload: streamResult.payload,
        preview: streamResult.preview,
        coverImagePreviewEntries:
          streamResult.preview?.coverImagePreviewEntries || [],
        coverImageArtifacts: streamResult.preview?.coverImageArtifacts || [],
        coverImageWarnings: streamResult.preview?.coverImageWarnings || [],
        previewGroups: buildAiResultPreviewGroupsWithContext(
          streamResult.preview,
          targetPreviewPost
        ),
        skippedEntries: [
          ...(mappedResult.skippedEntries || []),
          ...aiTranslationSkippedEntries,
          ...deduplicationResult.skippedEntries
        ],
        relatedSourceIds,
        entryCount: entries.length
      }
    }

    const buildAiImportCoverRequestKey = (languageCode, sourceId) => {
      return [languageCode, sourceId]
        .map(item => {
          return String(item || '').trim()
        })
        .join(':')
    }

    const getCoverPreviewEntriesForCoverRequest = resultItem => {
      const entries = []
      if (Array.isArray(resultItem?.payload?.entries)) {
        entries.push(...resultItem.payload.entries.filter(Boolean))
      }
      if (Array.isArray(resultItem?.preview?.changeList)) {
        entries.push(...resultItem.preview.changeList.filter(Boolean))
      }
      return entries
    }

    const collectAiImportCoverRequestItems = resultList => {
      const items = []
      resultList.forEach(resultItem => {
        const sourceId = String(resultItem?.sourceId || '').trim()
        const languageCode = String(resultItem?.languageCode || '').trim()
        if (sourceId && languageCode) {
          items.push({
            requestKey: buildAiImportCoverRequestKey(languageCode, sourceId),
            sourceId,
            targetLanguageCode: languageCode,
            previewEntries: getCoverPreviewEntriesForCoverRequest(resultItem)
          })
        }

        const relatedResults = Array.isArray(resultItem?.relatedResults)
          ? resultItem.relatedResults
          : []
        relatedResults.forEach(relatedItem => {
          const relatedSourceId = String(relatedItem?.sourceId || '').trim()
          if (!relatedSourceId || !languageCode) {
            return
          }
          items.push({
            requestKey: buildAiImportCoverRequestKey(
              languageCode,
              relatedSourceId
            ),
            sourceId: relatedSourceId,
            targetLanguageCode: languageCode,
            previewEntries: getCoverPreviewEntriesForCoverRequest(relatedItem)
          })
        })
      })
      return items
    }

    const mergeAiImportCoverResultIntoPreview = (preview, coverItem) => {
      const coverImagePreviewEntries = Array.isArray(
        coverItem?.coverImagePreviewEntries
      )
        ? coverItem.coverImagePreviewEntries.filter(Boolean)
        : []
      const coverImageArtifacts = Array.isArray(coverItem?.coverImageArtifacts)
        ? coverItem.coverImageArtifacts.filter(Boolean)
        : []
      const coverImageWarnings = normalizeAiCoverWarningList(
        coverItem?.coverImageWarnings
      )
      const coverImageChangeCount = coverImagePreviewEntries.filter(entry => {
        return isGeneratedAiCoverPreviewEntry(entry)
      }).length
      const warningList = Array.isArray(preview?.warningList)
        ? preview.warningList.slice()
        : []
      const skippedCount = Number(preview?.skippedCount || 0)

      return {
        ...preview,
        coverImagePreviewEntries,
        coverImageArtifacts,
        coverImageWarnings,
        coverImageChangeCount,
        totalChangeCount:
          Number(preview?.changeCount || 0) + coverImageChangeCount,
        warningList: warningList.concat(coverImageWarnings),
        skippedCount: skippedCount + coverImageWarnings.length
      }
    }

    const applyAiImportCoverResultToItem = (resultItem, coverItemMap) => {
      const sourceId = String(resultItem?.sourceId || '').trim()
      const languageCode = String(resultItem?.languageCode || '').trim()
      const requestKey = buildAiImportCoverRequestKey(languageCode, sourceId)
      const coverItem = coverItemMap.get(requestKey)
      if (coverItem) {
        resultItem.preview = mergeAiImportCoverResultIntoPreview(
          resultItem.preview,
          coverItem
        )
      }

      const relatedResults = Array.isArray(resultItem?.relatedResults)
        ? resultItem.relatedResults
        : []
      relatedResults.forEach(relatedItem => {
        const relatedSourceId = String(relatedItem?.sourceId || '').trim()
        const relatedRequestKey = buildAiImportCoverRequestKey(
          languageCode,
          relatedSourceId
        )
        const relatedCoverItem = coverItemMap.get(relatedRequestKey)
        if (!relatedCoverItem) {
          return
        }
        relatedItem.preview = mergeAiImportCoverResultIntoPreview(
          relatedItem.preview,
          relatedCoverItem
        )
      })
    }

    const applyAiImportCoverBatchResult = (resultList, data) => {
      const itemList = Array.isArray(data?.items) ? data.items : []
      const coverItemMap = new Map()
      itemList.forEach(item => {
        const requestKey = String(item?.requestKey || '').trim()
        if (requestKey) {
          coverItemMap.set(requestKey, item)
        }
      })
      resultList.forEach(resultItem => {
        applyAiImportCoverResultToItem(resultItem, coverItemMap)
      })
    }

    const requestAiImportCoverTranslations = async ({
      resultList,
      abortSignal
    }) => {
      const items = collectAiImportCoverRequestItems(resultList)
      if (items.length === 0) {
        return
      }
      pushAiProgress('正在对比所有语言标题并翻译封面图')
      const response = await fetch(
        '/api/multilingual-admin/source/post/ai-import-cover-translate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${store.getters.adminToken}`
          },
          signal: abortSignal,
          body: JSON.stringify({
            sourceLanguageCode: aiForm.sourceLanguageCode,
            items
          })
        }
      )

      if (!response.ok) {
        throw await createApiErrorFromResponse(response, 'AI 封面图翻译失败')
      }

      const responseBody = await response.json()
      const data = responseBody?.data || {}
      applyAiImportCoverBatchResult(resultList, data)
      if (data?.dedupe?.duplicateTitleCount > 0) {
        pushAiProgress(
          `封面图标题去重完成：${data.dedupe.groupCount}/${data.dedupe.taskCount}`
        )
      }
    }

    const translateOneLanguage = async ({
      sourcePost,
      languageCode,
      abortSignal
    }) => {
      const rootSourceId = String(sourcePost.sourceId || sourcePost._id || '')
      const queue = [
        {
          sourceId: rootSourceId,
          sourcePost,
          isRoot: true
        }
      ]
      const visited = new Set()
      const postResultList = []
      const translatedEntryKeySet = new Set()

      while (queue.length > 0) {
        throwAiAbortIfNeeded(abortSignal)
        const currentTask = queue.shift()
        if (!currentTask || !currentTask.sourceId) {
          continue
        }
        if (visited.has(currentTask.sourceId)) {
          continue
        }
        visited.add(currentTask.sourceId)

        let currentSourcePost = currentTask.sourcePost
        if (!currentSourcePost) {
          currentSourcePost = await loadSourceDatabasePostById({
            sourceId: currentTask.sourceId,
            ensureNoSnapshot: false
          })
        }
        throwAiAbortIfNeeded(abortSignal)

        let progressContextLabel = '主文章'
        if (currentTask.isRoot !== true) {
          progressContextLabel = getRelatedPostTypeLabel(currentSourcePost)
        }

        const postResult = await translateOnePostForLanguage({
          sourcePost: currentSourcePost,
          languageCode,
          abortSignal,
          progressContextLabel,
          translatedEntryKeySet
        })
        postResult.isRoot = currentTask.isRoot === true
        postResultList.push(postResult)
        ;(postResult.relatedSourceIds || []).forEach(relatedSourceId => {
          if (!relatedSourceId) {
            return
          }
          if (visited.has(relatedSourceId)) {
            return
          }
          queue.push({
            sourceId: relatedSourceId,
            sourcePost: null,
            isRoot: false
          })
        })
      }

      const rootResult = postResultList.find(item => item.isRoot)
      if (!rootResult) {
        throw new Error(`${getLanguageText(languageCode)} 没有可用翻译结果`)
      }

      return {
        ...rootResult,
        relatedResults: postResultList.filter(item => !item.isRoot)
      }
    }

    const startAiImportTranslation = async () => {
      const row = aiRow.value
      if (!row) {
        return
      }
      if (!aiForm.sourceLanguageCode) {
        ElMessage.warning('请选择源语言')
        return
      }
      if (aiForm.targetLanguageCodes.length === 0) {
        ElMessage.warning('请至少选择一个目标语言')
        return
      }

      rememberAiImportOptions()
      aiRunning.value = true
      aiStep.value = 'running'
      aiResultList.value = []
      selectedAiResultLanguageCodes.value = []
      selectedAiResultEntryIdsMap.value = {}
      selectedAiRelatedEntryIdsMap.value = {}
      aiPublishLanguageCodes.value = []
      activeAiPreviewLanguageCode.value = ''
      aiProgressList.value = []
      aiStreamContent.value = ''
      setAiRowLoading(true)
      aiAbortController.value = new AbortController()
      try {
        assertAiRowCanPreview(row)
        const sourcePost = await loadSourceDatabasePost(row)
        const resultList = []
        for (const languageCode of aiForm.targetLanguageCodes) {
          resultList.push(
            await translateOneLanguage({
              sourcePost,
              languageCode,
              abortSignal: aiAbortController.value.signal
            })
          )
        }
        await requestAiImportCoverTranslations({
          resultList,
          abortSignal: aiAbortController.value.signal
        })
        aiResultList.value = resultList
        initSelectedAiResultEntryIds(resultList)
        selectedAiResultLanguageCodes.value = resultList.map(
          item => item.languageCode
        )
        aiPublishLanguageCodes.value = []
        activeAiPreviewLanguageCode.value = resultList[0]?.languageCode || ''
        aiStep.value = 'preview'
        if (
          resultList.length > 0 &&
          resultList.every(item => {
            if (hasPreviewChanges(item.preview)) {
              return false
            }
            return (item.relatedResults || []).every(relatedItem => {
              return !hasPreviewChanges(relatedItem.preview)
            })
          })
        ) {
          ElMessage.info('AI 返回内容与源内容一致，可仍然采用并发布')
        }
      } catch (error) {
        if (isAiAbortError(error)) {
          ElMessage.warning('已停止 AI 翻译')
          aiStep.value = 'setup'
          return
        }
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
        aiStep.value = 'setup'
      } finally {
        aiAbortController.value = null
        aiRunning.value = false
        setAiRowLoading(false)
      }
    }

    const createSourcePostAiImportJob = async () => {
      const row = aiRow.value
      if (!row) {
        return
      }
      if (!aiForm.sourceLanguageCode) {
        ElMessage.warning('请选择源语言')
        return
      }
      if (aiForm.targetLanguageCodes.length === 0) {
        ElMessage.warning('请至少选择一个目标语言')
        return
      }

      rememberAiImportOptions()
      try {
        await multilingualApi.createTranslationJob({
          jobType: 'source-post-ai-import',
          source: {
            postId: row.sourceId,
            languageCode: aiForm.sourceLanguageCode,
            title: getPostDisplayTitle(row)
          },
          target: {
            languageCodes: aiForm.targetLanguageCodes,
            title: getPostDisplayTitle(row)
          },
          request: {
            prompt: aiForm.prompt,
            options: {
              translateCoverImage: true,
              searchOfficialTermTranslations:
                aiForm.searchOfficialTermTranslations
            },
            targetLanguageCodes: aiForm.targetLanguageCodes,
            recursion: {
              maxDepth: aiForm.recursionMaxDepth || 3
            }
          }
        })
        ElMessage.success('后台任务已创建')
        aiDialogVisible.value = false
      } catch (error) {
        console.log(error)
      }
    }

    const confirmAiImportApply = async () => {
      if (selectedAiResultLanguageCodes.value.length === 0) {
        ElMessage.warning('请至少选择一个可保存的语言')
        return
      }

      try {
        await ElMessageBox.confirm(
          '确认保存所选 AI 翻译结果？',
          '保存翻译结果',
          {
            type: 'warning',
            confirmButtonText: '保存',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }

      const selectedLanguageSet = new Set(selectedAiResultLanguageCodes.value)
      const publishLanguageSet = new Set(aiPublishLanguageCodes.value)
      const selectedResults = aiResultList.value.filter(item => {
        return selectedLanguageSet.has(item.languageCode)
      })
      const emptySelectedResult = selectedResults.find(item => {
        return (
          hasPreviewChanges(item.preview) &&
          getSelectedAiResultEntryCount(item) === 0
        )
      })
      if (emptySelectedResult) {
        ElMessage.warning(
          `请至少采纳 ${getLanguageText(
            emptySelectedResult.languageCode
          )} 的一个翻译条目，或取消选择该语言`
        )
        activeAiPreviewLanguageCode.value = emptySelectedResult.languageCode
        return
      }
      aiApplying.value = true
      try {
        const response = await multilingualApi.applySourcePostAiImport(
          {
            sourceId: String(aiRow.value.sourceId),
            sourceLanguageCode: aiForm.sourceLanguageCode,
            results: selectedResults.map(resultItem => {
              const shouldPublish = publishLanguageSet.has(
                resultItem.languageCode
              )
              const selectedEntryIds = getSelectedAiResultEntryIds(
                resultItem.languageCode
              )
              return {
                languageCode: resultItem.languageCode,
                payload: buildSelectedAiImportPayload(resultItem),
                publish: shouldPublish,
                coverImagePreviewEntries: buildSelectedCoverImagePreviewEntries(
                  resultItem.preview,
                  selectedEntryIds
                ),
                coverImageArtifacts: buildSelectedCoverImageArtifacts(
                  resultItem.preview,
                  selectedEntryIds
                ),
                relatedPostResults: (resultItem.relatedResults || []).map(
                  relatedItem => {
                    const selectedRelatedEntryIds =
                      getSelectedAiRelatedEntryIds(
                        resultItem.languageCode,
                        relatedItem.sourceId
                      )
                    return {
                      sourceId: relatedItem.sourceId,
                      payload: buildSelectedAiRelatedImportPayload(
                        resultItem,
                        relatedItem
                      ),
                      publish: shouldPublish,
                      coverImagePreviewEntries:
                        buildSelectedCoverImagePreviewEntries(
                          relatedItem.preview,
                          selectedRelatedEntryIds
                        ),
                      coverImageArtifacts: buildSelectedCoverImageArtifacts(
                        relatedItem.preview,
                        selectedRelatedEntryIds
                      )
                    }
                  }
                )
              }
            })
          },
          true
        )
        const snapshot = response.data.data?.snapshot
        if (!snapshot) {
          throw new Error('保存结果缺少源快照信息')
        }
        syncRowSnapshot(aiRow.value, snapshot)
        aiDialogVisible.value = false
        ElMessage.success('AI 翻译已保存')
        getSourceDatabasePostList(false)
      } finally {
        aiApplying.value = false
      }
    }

    const overwriteRow = (row, sourceLanguageCode) => {
      ElMessageBox.confirm(
        `确认覆盖源文章「${getPostDisplayTitle(row)}」的 ${sourceLanguageCode} 快照？旧关联和旧媒体不会自动删除。`,
        '确认覆盖源快照',
        {
          type: 'warning',
          confirmButtonText: '覆盖',
          cancelButtonText: '取消'
        }
      )
        .then(() => submitOverwrite(row, sourceLanguageCode))
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
    }

    const submitOverwrite = async (row, sourceLanguageCode) => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.overwriteSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode,
          overwrite: true
        })
        result.value = response.data.data
        result.value.sourceLanguageCode = sourceLanguageCode
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照覆盖成功')
        getSourceDatabasePostList(false)
      } finally {
        setRowLoading(row, false)
      }
    }

    const handleImportError = async (row, error, sourceLanguageCode) => {
      const responseData = error?.response?.data || {}
      const errorList = responseData.errorList || []
      const existsError = errorList.find(item => item.code === 'SOURCE_EXISTS')
      if (!existsError) {
        return
      }

      row.hasSnapshot = true
      row.snapshot = {
        _id: responseData.sourceSnapshotId,
        sourceId: row.sourceId,
        snapshotVersion: responseData.snapshotVersion || 1
      }
      try {
        await ElMessageBox.confirm(
          `该源文章已存在快照，当前版本为 ${responseData.snapshotVersion || '-'}。是否立即覆盖？`,
          '源快照已存在',
          {
            type: 'warning',
            confirmButtonText: '覆盖',
            cancelButtonText: '取消'
          }
        )
        await submitOverwrite(row, sourceLanguageCode)
      } catch (confirmError) {
        if (confirmError !== 'cancel' && confirmError !== 'close') {
          console.log(confirmError)
        }
      }
    }

    const goSnapshot = row => {
      router.push({
        name: 'SourcePostSnapshotList',
        query: {
          keyword: String(row.sourceId)
        }
      })
    }

    watch(
      () => params.page,
      () => {
        getSourceDatabasePostList(false)
      }
    )

    watch(selectedAiResultLanguageCodes, languageCodes => {
      const selectedSet = new Set(languageCodes)
      aiPublishLanguageCodes.value = aiPublishLanguageCodes.value.filter(
        languageCode => selectedSet.has(languageCode)
      )
    })

    watch(aiStreamContent, () => {
      scrollAiStreamFeedbackToBottom()
    })

    onMounted(() => {
      getSourceDatabasePostList(false)
    })

    return {
      tableRef,
      params,
      sourcePostList,
      total,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      postTypeOptions: POST_TYPE_OPTIONS,
      postStatusOptions: POST_STATUS_OPTIONS,
      result,
      resultDialogVisible,
      aiApplying,
      aiDialogVisible,
      aiForm,
      aiProgressList,
      aiPublishLanguageCodes,
      aiResultList,
      aiRow,
      aiRunning,
      aiStep,
      aiStreamContent,
      aiStreamContentRef,
      aiStreamFeedbackRef,
      activeAiPreviewLanguageCode,
      selectedAiResultLanguageCodes,
      selectedAiResultEntryIdsMap,
      selectedAiRelatedEntryIdsMap,
      languageDialogVisible,
      languageDialogTitle,
      languageForm,
      copiedCountRows,
      isAiImportBusy,
      officialTermSearchDefaultLoading,
      rowActionLoadingMap,
      targetLanguageOptions,
      getLanguageText,
      getPostTypeTagType,
      getPostTypeText,
      getPostStatusText,
      getPostStatusTagType,
      getPostDisplayTitle,
      getAiRelatedCoverImageEntries,
      getAiResultCoverImageEntries,
      getAiRelatedSelectableEntryIds,
      getAiResultSelectableEntryIds,
      getCoverImageStatusTagType,
      getCoverImageStatusText,
      getAiImportPreviewCoverEntries,
      getAiResultPostTitle,
      getRelatedPostTypeLabel,
      getSelectedAiResultEntryIds,
      getSelectedAiResultEntryCount,
      getSelectedAiRelatedEntryIds,
      getSelectedAiRelatedEntryCount,
      getPreviewCoverImageChangeCount,
      getPreviewTotalChangeCount,
      hasPreviewChanges,
      hasPreviewTextChanges,
      canSelectCoverImage,
      setSelectedAiResultEntryIds,
      setSelectedAiRelatedEntryIds,
      setAiResultCoverImageSelected,
      setAiRelatedCoverImageSelected,
      setAllAiResultEntriesSelected,
      setAllAiRelatedEntriesSelected,
      getSourceDatabasePostList,
      confirmLanguageAction,
      backToAiSetup,
      confirmAiImportApply,
      createSourcePostAiImportJob,
      getAiActionKey,
      handleAiDialogBeforeClose,
      handleAiSourceLanguageChange,
      openAiImportDialog,
      openLanguageDialog,
      resetAiImportState,
      stopAiImportTranslation,
      startAiImportTranslation,
      goSnapshot
    }
  }
}
</script>

<style scoped>
.source-post-import-page {
  min-height: 100%;
}

.source-title {
  font-weight: 600;
  line-height: 1.5;
}

.source-meta,
.snapshot-meta,
.source-excerpt {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.source-excerpt {
  max-width: 560px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.snapshot-language-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-empty-text {
  color: var(--el-text-color-secondary);
}

.result-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.copied-count-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.copied-count-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-bg-color);
}

.copied-count-name {
  font-weight: 600;
  margin-bottom: 6px;
}

.copied-count-values {
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.ai-import-dialog-body {
  min-height: 260px;
  max-height: min(72vh, 760px);
  overflow: auto;
  padding-right: 4px;
}

.ai-import-form {
  max-width: 880px;
}

.ai-language-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}

.ai-preview-tabs {
  margin-top: 8px;
}

.ai-stream-feedback {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-fill-color-lighter);
}

.ai-stream-status-item {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.ai-stream-content {
  margin: 10px 0 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.translation-json-warning-list {
  margin-bottom: 18px;
}

.translation-json-warning-item {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
}

.translation-skip-preview-card {
  margin-bottom: 12px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-color-warning-light-9);
}

.translation-skip-preview-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-skip-preview-panel {
  min-width: 0;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-bg-color);
}

.translation-skip-reason {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;
}

.translation-json-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.translation-dialog-intro {
  min-width: 0;
}

.translation-dialog-intro-title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.translation-json-group-title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.translation-dialog-intro-text {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.translation-json-toolbar-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.translation-import-preview-item-title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.translation-import-preview-panel-title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.cover-image-review-section {
  margin-bottom: 18px;
}

.cover-image-review-item {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 14px;
}

.cover-image-review-header {
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

.translation-import-preview-panel-context {
  margin-top: 2px;
  color: var(--el-text-color-placeholder);
  font-weight: 400;
}

.translation-import-preview-empty {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.translation-related-preview-list {
  margin-top: 18px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 14px;
}

.translation-related-preview-card {
  margin-top: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
  background: var(--el-bg-color-page);
}

.translation-related-preview-header {
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.translation-import-preview-html,
.translation-import-preview-raw {
  overflow: auto;
  word-break: break-word;
}

.translation-import-preview-html {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.translation-import-preview-raw {
  max-height: 260px;
  margin: 0;
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.6;
}

.translation-import-preview-html + .translation-import-preview-raw {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.translation-import-preview-html :deep(:not(.w-e-image-group-img-body) > img),
.translation-import-preview-html
  :deep(:not(.w-e-image-group-img-body) > video) {
  max-width: 100%;
  height: auto;
}

@media (max-width: 767px) {
  .source-post-actions {
    float: none;
  }

  .cover-image-review-grid,
  .translation-skip-preview-columns {
    grid-template-columns: 1fr;
  }

  .translation-json-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
