<template>
  <div class="common-right-panel-form translation-post-editor-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ name: 'TranslationPostList' }">
          多语言文章
        </el-breadcrumb-item>
        <el-breadcrumb-item>编辑{{ typeTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-skeleton v-if="loading" :rows="10" animated />
    <div v-else-if="detailData && form.id">
      <el-alert
        v-if="form.pendingReview"
        class="mb20"
        type="warning"
        show-icon
        title="源文章快照已变化，保存并确认复核后会清除待复核状态。"
      />

      <el-descriptions class="mb20" :column="2" border>
        <el-descriptions-item label="语言">
          {{ getLanguageText(form.languageCode) }}
        </el-descriptions-item>
        <el-descriptions-item label="类型">
          <el-tag :type="getPostTypeTagType(form.type)" effect="plain">
            {{ getPostTypeText(form.type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="作者">
          <span class="relation-inline-name">{{ authorName }}</span>
          <el-tooltip
            v-if="authorRecord"
            content="快捷编辑作者"
            placement="top"
          >
            <el-button
              class="relation-inline-edit-button"
              link
              type="primary"
              size="small"
              :icon="EditPen"
              aria-label="快捷编辑作者"
              @click="
                openRelationEditor(getRelationField('author'), authorRecord)
              "
            />
          </el-tooltip>
        </el-descriptions-item>
        <el-descriptions-item label="快照版本">
          v{{ form.snapshotVersion || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="复核状态">
          <el-tag v-if="form.pendingReview" type="warning" effect="plain">
            待复核
          </el-tag>
          <el-tag v-else type="success" effect="plain">正常</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-form :model="form" label-width="90px" @submit.prevent>
        <template v-if="form.type !== 2">
          <el-form-item label="标题" required>
            <el-input v-model="form.title" placeholder="请输入标题" />
          </el-form-item>
          <el-form-item label="文章内容">
            <el-tabs
              v-model="contentTab"
              type="border-card"
              class="w_10 post-editor-body"
              @tab-change="onContentTabChange"
            >
              <el-tab-pane label="富文本" name="richText">
                <RichEditor4
                  v-if="postEditorVersion === 4"
                  v-model:content="form.content"
                  :language-code="form.languageCode"
                />
                <RichEditor5
                  v-else
                  v-model:content="form.content"
                  :isPost="true"
                  :language-code="form.languageCode"
                />
              </el-tab-pane>
              <el-tab-pane label="源代码" name="sourceCode">
                <el-input
                  v-model="contentSource"
                  type="textarea"
                  :rows="30"
                  placeholder="请输入源代码"
                />
              </el-tab-pane>
            </el-tabs>
          </el-form-item>
          <el-form-item label="摘要">
            <el-input
              v-model="form.excerpt"
              type="textarea"
              :rows="5"
              placeholder="请输入摘要"
            />
          </el-form-item>
          <el-form-item label="插入code">
            <el-input
              v-model="form.code"
              type="textarea"
              :rows="5"
              placeholder="请输入插入code"
            />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="推文" required>
            <EmojiTextarea
              v-model:value="form.excerpt"
              placeholder="请输入推文"
              :rows="10"
            />
            <div class="w_10 cGray666">
              ※推文正文使用摘要字段，媒体内容会显示在推文正文区域。
            </div>
          </el-form-item>
        </template>

        <el-form-item
          :label="form.type === 2 ? '媒体内容' : '封面图'"
          class="blok-form-item"
        >
          <div class="cover-image-list">
            <div
              v-for="element in relationRecords.coverImages"
              :key="element._id"
              class="post-cover-image-item"
            >
              <button
                v-if="isImageAttachment(element) && getImagePreviewUrl(element)"
                type="button"
                class="post-cover-image-preview-trigger"
                title="打开预览"
                @click="openMediaPreview(element)"
              >
                <el-image
                  :src="getImagePreviewUrl(element)"
                  fit="contain"
                  style="width: 100%; height: 100%"
                />
              </button>
              <button
                v-else-if="
                  isVideoAttachment(element) && getVideoPreviewUrl(element)
                "
                type="button"
                class="post-cover-image-preview-trigger"
                title="播放视频"
                @click="openMediaPreview(element)"
              >
                <el-image
                  v-if="getVideoCoverUrl(element)"
                  :src="getVideoCoverUrl(element)"
                  fit="cover"
                  style="width: 100%; height: 100%"
                />
                <div v-else class="attachment-cover-empty">无封面</div>
              </button>
              <div v-else class="attachment-file-card">
                <el-icon size="28"><Document /></el-icon>
                <div>{{ getRelationName(element) }}</div>
                <div v-if="element.mediaMode === 'remote'" class="f12 cGray666">
                  远程媒体
                </div>
              </div>
              <div v-if="element.is360Panorama" class="attachment-360-icon">
                360°
              </div>
              <div
                v-if="isVideoAttachment(element)"
                class="attachment-play-icon"
              >
                <el-icon><VideoPlay /></el-icon>
              </div>
              <el-tooltip content="快捷编辑媒体内容" placement="top">
                <el-button
                  class="post-cover-image-item-edit"
                  type="primary"
                  size="small"
                  :icon="EditPen"
                  circle
                  aria-label="快捷编辑媒体内容"
                  @click.stop.prevent="
                    openRelationEditor(getRelationField('coverImages'), element)
                  "
                />
              </el-tooltip>
            </div>
            <span
              v-if="relationRecords.coverImages.length === 0"
              class="translation-media-empty cGray666"
            >
              未关联媒体内容
            </span>
          </div>
        </el-form-item>

        <el-form-item label="分类" v-if="form.type !== 3">
          <RelationSelectedList
            :field="getRelationField('sort')"
            :records="relationRecords.sort"
            @edit="openRelationEditor"
          />
        </el-form-item>

        <template v-if="form.type !== 3">
          <el-form-item label="标签">
            <RelationSelectedList
              :field="getRelationField('tags')"
              :records="relationRecords.tags"
              @edit="openRelationEditor"
            />
          </el-form-item>
          <el-form-item label="地点">
            <RelationSelectedList
              :field="getRelationField('mappointList')"
              :records="relationRecords.mappointList"
              @edit="openRelationEditor"
            />
          </el-form-item>
        </template>

        <div class="config-border-item" v-if="form.type === 2">
          <div class="config-border-item-title">
            <div>推文内关联内容</div>
            <div class="f12 cGray666">※会显示在文章列表页和详情页的正文中</div>
          </div>
          <el-form-item
            v-for="field in tweetContentRelationFields"
            :key="field.field"
            :label="field.label"
          >
            <RelationSelectedList
              :field="field"
              :records="relationRecords[field.field]"
              @edit="openRelationEditor"
            />
          </el-form-item>
        </div>

        <div class="config-border-item">
          <div class="config-border-item-title">
            <div>详情页相关内容</div>
            <div class="f12 cGray666">※仅显示在详情页下方的相关内容</div>
          </div>
          <el-form-item
            v-for="field in detailRelationFields"
            :key="field.field"
            :label="field.label"
          >
            <RelationSelectedList
              :field="field"
              :records="relationRecords[field.field]"
              @edit="openRelationEditor"
            />
          </el-form-item>
        </div>

        <el-form-item label="文章别名">
          <el-input
            v-model="form.alias"
            maxlength="64"
            placeholder="请输入文章别名（用于别名访问）"
          />
          <el-button
            class="mt10"
            type="primary"
            size="small"
            @click="form.alias = buildTypeAlias(form.type)"
          >
            按时间随机别名
          </el-button>
          <el-button
            class="mt10"
            type="primary"
            size="small"
            @click="resetRandomAlias"
          >
            完全随机别名
          </el-button>
        </el-form-item>

        <el-form-item label="模板选择" v-if="form.type === 3">
          <el-select v-model="form.template" clearable placeholder="请选择模板">
            <el-option label="默认模板" value="" />
            <el-option label="友链模板" value="link" />
          </el-select>
        </el-form-item>

        <el-form-item label="发布时间">
          <el-date-picker
            v-model="form.date"
            type="datetime"
            placeholder="选择日期时间"
            style="width: 100%"
          />
          <el-button
            class="mt10"
            type="primary"
            size="small"
            @click="form.date = new Date()"
          >
            此刻
          </el-button>
        </el-form-item>

        <el-form-item label="允许评论">
          <el-switch v-model="form.allowRemark" />
        </el-form-item>
        <el-form-item label="是否置顶" v-if="form.type !== 3">
          <el-switch v-model="form.top" />
        </el-form-item>
        <el-form-item label="分类置顶" v-if="form.type !== 3">
          <el-switch v-model="form.sortop" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">草稿</el-radio>
            <el-radio :value="1">发布</el-radio>
          </el-radio-group>
        </el-form-item>

        <div class="translation-editor-action-bar">
          <div class="translation-editor-action-group">
            <el-button @click="goList">返回列表</el-button>
          </div>

          <div class="translation-editor-action-divider" />

          <div class="translation-editor-action-group">
            <el-button type="success" @click="openAiTranslationDialog">
              AI 翻译
            </el-button>
            <el-button @click="openTranslationJsonExport">JSON 导出</el-button>
            <el-button @click="openTranslationJsonImport">JSON 导入</el-button>
          </div>

          <div class="translation-editor-action-divider" />

          <div class="translation-editor-action-group">
            <el-button
              type="warning"
              plain
              :loading="saving"
              @click="restoreSnapshot"
            >
              同步快照
            </el-button>
            <el-button
              v-if="form.pendingReview"
              type="success"
              plain
              :loading="saving"
              @click="confirmReview"
            >
              确认复核
            </el-button>
          </div>

          <div class="translation-editor-action-spacer" />

          <div
            class="translation-editor-action-group translation-editor-action-group-save"
          >
            <el-button type="primary" :loading="saving" @click="submit(false)">
              保存
            </el-button>
          </div>
        </div>
      </el-form>
    </div>

    <el-dialog
      v-model="exportDialogVisible"
      title="导出翻译 JSON"
      width="min(980px, 96vw)"
      align-center
      destroy-on-close
      append-to-body
    >
      <div class="translation-json-toolbar">
        <div class="translation-dialog-intro">
          <div class="translation-dialog-intro-title">选择导出字段</div>
          <div class="translation-dialog-intro-text">
            勾选需要交给 AI 翻译的字段。富文本会导出为结构化
            JSON，尽量保留编辑器结构与媒体属性。
          </div>
        </div>
        <div class="translation-json-toolbar-actions">
          <el-button size="small" @click="selectAllExportEntries">
            全选
          </el-button>
          <el-button size="small" @click="clearExportEntries">清空</el-button>
        </div>
      </div>
      <el-form class="translation-json-option-form" label-width="110px">
        <el-form-item label="翻译用文章">
          <el-radio-group
            v-model="exportBaseMode"
            :disabled="exportLoading"
            @change="refreshExportEntries"
          >
            <el-radio value="source">源文章</el-radio>
            <el-radio value="current">当前文章</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="切片导出">
          <el-switch v-model="exportUseSlices" />
          <span v-if="exportUseSlices" class="translation-json-slice-label">
            每片文本项
          </span>
          <el-input-number
            v-if="exportUseSlices"
            v-model="exportSliceSize"
            class="ml10"
            :min="1"
            :max="50"
            controls-position="right"
          />
          <div class="w_10 cGray666 mt10">
            启用后会先让你选择导出目录，再一次性写入全部切片文件，避免浏览器批量下载漏文件。
          </div>
        </el-form-item>
      </el-form>
      <el-skeleton v-if="exportLoading" :rows="4" animated />
      <div class="translation-json-selected-count cGray666">
        已选择 {{ selectedExportIds.length }} 项
      </div>
      <div
        v-if="exportSliceSummary"
        class="translation-json-selected-count cGray666"
      >
        当前预计生成 {{ exportSliceSummary.total }} 片，包含
        {{ exportSliceSummary.totalEntries }} 个翻译单元，来自
        {{ exportSliceSummary.sourceEntries }} 个原始条目。
      </div>
      <el-checkbox-group
        v-if="!exportLoading"
        v-model="selectedExportIds"
        class="w_10"
      >
        <div
          v-for="group in exportEntryGroups"
          :key="group.label"
          class="translation-json-group"
        >
          <div class="translation-json-group-header">
            <div class="translation-json-group-heading">
              <div
                v-if="group.meta.eyebrow"
                class="translation-json-group-eyebrow"
              >
                {{ group.meta.eyebrow }}
              </div>
              <div class="translation-json-group-title">
                {{ group.meta.title || group.label || '未命名分组' }}
              </div>
            </div>
            <div class="translation-json-group-count">
              {{ group.entries.length }} 项
            </div>
          </div>
          <div class="translation-json-entry-list">
            <el-checkbox
              v-for="entry in group.entries"
              :key="entry.id"
              :value="entry.id"
              class="translation-json-entry"
            >
              <TranslationEntryMeta :entry="entry" />
              <div class="translation-json-entry-preview">
                {{ entry.previewText }}
              </div>
            </el-checkbox>
          </div>
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="downloadTranslationJson">
          导出 JSON
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      title="导入翻译 JSON"
      width="min(1100px, 96vw)"
      align-center
      destroy-on-close
      append-to-body
    >
      <div class="translation-json-toolbar">
        <div class="translation-dialog-intro">
          <div class="translation-dialog-intro-title">导入翻译内容</div>
          <div class="translation-dialog-intro-text">
            支持直接粘贴 AI 返回的 JSON，也支持粘贴多个切片 JSON
            或一次选择多个本地 JSON
            文件。结构化富文本会先展示回写预览，再二次确认导入。
          </div>
        </div>
        <div class="translation-json-toolbar-actions">
          <el-button size="small" @click="triggerImportFilePicker">
            选择 JSON 文件
          </el-button>
        </div>
      </div>
      <input
        ref="importFileInputRef"
        class="translation-json-hidden-input"
        type="file"
        multiple
        accept=".json,application/json"
        @change="handleImportFileChange"
      />
      <el-input
        v-model="importJsonText"
        type="textarea"
        :rows="12"
        placeholder="请粘贴一个完整 JSON，或粘贴多个切片 JSON（片段之间用空行分隔）"
      />
      <div v-if="importSelectedFileCount > 0" class="mt10 cGray666">
        已选择 {{ importSelectedFileCount }} 个 JSON
        文件，内容已合并到上方输入框。
      </div>
      <div class="mt10">
        <el-button type="primary" @click="parseTranslationJsonImport">
          解析并预览
        </el-button>
      </div>

      <div v-if="importPreview" class="translation-import-preview-section">
        <el-alert
          class="mb20"
          type="warning"
          show-icon
          :closable="false"
          title="确认导入后，会立即写入当前文章和相关关联内容。若当前页存在未保存改动，也会一并提交。"
        />

        <el-descriptions class="mb20" :column="3" border>
          <el-descriptions-item label="可导入变更">
            {{ importPreview.changeCount }}
          </el-descriptions-item>
          <el-descriptions-item label="跳过条目">
            {{ importPreview.skippedCount }}
          </el-descriptions-item>
          <el-descriptions-item label="目标语言">
            {{ getLanguageText(form.languageCode) }}
          </el-descriptions-item>
        </el-descriptions>

        <div
          v-if="importPreview.warningList.length > 0"
          class="translation-json-warning-list"
        >
          <div class="translation-json-group-title">跳过说明</div>
          <div
            v-for="warning in importPreview.warningList"
            :key="warning"
            class="translation-json-warning-item"
          >
            {{ warning }}
          </div>
        </div>

        <div
          v-for="group in importPreviewGroups"
          :key="group.label"
          class="translation-import-preview-group"
        >
          <div class="translation-json-group-header">
            <div class="translation-json-group-heading">
              <div
                v-if="group.meta.eyebrow"
                class="translation-json-group-eyebrow"
              >
                {{ group.meta.eyebrow }}
              </div>
              <div class="translation-json-group-title">
                {{ group.meta.title || group.label || '未命名分组' }}
              </div>
            </div>
            <div class="translation-json-group-count">
              {{ group.entries.length }} 项
            </div>
          </div>
          <div
            v-for="item in group.entries"
            :key="item.id"
            class="translation-import-preview-item"
          >
            <div class="translation-import-preview-item-title">
              <TranslationEntryMeta :entry="item" />
            </div>
            <div class="translation-import-preview-columns">
              <div
                v-if="item.hasSourceValue"
                class="translation-import-preview-panel"
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
                <pre class="translation-import-preview-raw">{{
                  item.sourceValue
                }}</pre>
              </div>
              <div class="translation-import-preview-panel">
                <div class="translation-import-preview-panel-title">当前</div>
                <div
                  v-if="item.currentHtml"
                  class="translation-import-preview-html"
                  v-html="item.currentHtml"
                />
                <pre class="translation-import-preview-raw">{{
                  item.currentValue
                }}</pre>
              </div>
              <div class="translation-import-preview-panel">
                <div class="translation-import-preview-panel-title">导入后</div>
                <div
                  v-if="item.nextHtml"
                  class="translation-import-preview-html"
                  v-html="item.nextHtml"
                />
                <pre class="translation-import-preview-raw">{{
                  item.nextValue
                }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="!importPreview || importPreview.changeCount === 0"
          @click="confirmTranslationJsonImport"
        >
          确认导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="aiDialogVisible"
      title="DeepSeek AI 翻译"
      width="min(1100px, 96vw)"
      align-center
      destroy-on-close
      append-to-body
      :show-close="!isAiBusy"
      :close-on-click-modal="!isAiBusy"
      :close-on-press-escape="!isAiBusy"
      :before-close="handleAiDialogBeforeClose"
    >
      <div
        v-loading="aiApplying"
        element-loading-text="正在写入，请稍候"
        class="ai-translation-dialog-body"
      >
        <el-skeleton v-if="aiLoading" :rows="8" animated />
        <template v-else>
          <el-descriptions class="mb20" :column="3" border>
            <el-descriptions-item label="源语言">
              {{ getLanguageText(currentAiSourceLanguageCode) }}
            </el-descriptions-item>
            <el-descriptions-item label="目标语言">
              {{ getLanguageText(form.languageCode) }}
            </el-descriptions-item>
            <el-descriptions-item label="可翻译条目">
              {{ aiEntryList.length }}
            </el-descriptions-item>
          </el-descriptions>

          <div
            v-if="aiSkippedEntries.length > 0 && !aiImportPreview"
            class="translation-json-warning-list"
          >
            <div class="ai-skipped-header">
              <div class="translation-json-group-title">暂未翻译的关联内容</div>
              <el-button
                v-if="creatableAiSkippedEntries.length > 0"
                size="small"
                type="primary"
                plain
                :loading="creatingAllSkippedTranslations"
                :disabled="isAiBusy"
                @click="createAllSkippedTranslations"
              >
                全部创建
              </el-button>
            </div>
            <div
              v-for="item in aiSkippedEntries"
              :key="item.id"
              class="translation-json-warning-item ai-skipped-item"
            >
              <span>{{
                item.message || `${item.label || item.id}：${item.reason}`
              }}</span>
              <el-button
                v-if="canCreateSkippedTranslation(item)"
                size="small"
                type="primary"
                link
                :loading="isSkippedTranslationCreating(item)"
                :disabled="isAiBusy || creatingAllSkippedTranslations"
                @click="createSkippedTranslation(item)"
              >
                创建
              </el-button>
            </div>
          </div>

          <template v-if="!aiImportPreview">
            <el-form class="translation-json-option-form" label-width="110px">
              <el-form-item label="翻译用文章">
                <el-radio-group
                  v-model="aiBaseMode"
                  :disabled="isAiBusy"
                  @change="handleAiBaseModeChange"
                >
                  <el-radio value="source">源文章</el-radio>
                  <el-radio value="current">当前文章</el-radio>
                </el-radio-group>
              </el-form-item>
            </el-form>
            <div class="translation-json-toolbar">
              <div class="translation-dialog-intro">
                <div class="translation-dialog-intro-title">
                  选择 AI 翻译字段
                </div>
                <div class="translation-dialog-intro-text">
                  已选择
                  {{ selectedAiEntryIds.length }} 项。按分组检查本次会提交给
                  DeepSeek 的字段，关联内容会直接显示所属对象与具体字段。
                </div>
              </div>
              <div class="translation-json-toolbar-actions">
                <el-button
                  size="small"
                  :disabled="isAiBusy"
                  @click="selectAllAiEntries"
                >
                  全选
                </el-button>
                <el-button
                  size="small"
                  :disabled="isAiBusy"
                  @click="clearAiEntries"
                >
                  清空
                </el-button>
              </div>
            </div>

            <el-checkbox-group
              v-model="selectedAiEntryIds"
              class="w_10"
              :disabled="isAiBusy"
            >
              <div
                v-for="group in aiEntryGroups"
                :key="group.label"
                class="translation-json-group"
              >
                <div class="translation-json-group-header">
                  <div class="translation-json-group-heading">
                    <div
                      v-if="group.meta.eyebrow"
                      class="translation-json-group-eyebrow"
                    >
                      {{ group.meta.eyebrow }}
                    </div>
                    <div class="translation-json-group-title">
                      {{ group.meta.title || group.label || '未命名分组' }}
                    </div>
                  </div>
                  <div class="translation-json-group-count">
                    {{ group.entries.length }} 项
                  </div>
                </div>
                <div class="translation-json-entry-list">
                  <el-checkbox
                    v-for="entry in group.entries"
                    :key="entry.id"
                    :value="entry.id"
                    class="translation-json-entry"
                  >
                    <TranslationEntryMeta :entry="entry" />
                    <div class="translation-json-entry-preview">
                      {{ entry.previewText }}
                    </div>
                  </el-checkbox>
                </div>
              </div>
            </el-checkbox-group>

            <el-form class="ai-translation-prompt-form" label-width="110px">
              <el-form-item label="此次提示词">
                <el-input
                  v-model="aiPrompt"
                  type="textarea"
                  :rows="5"
                  :disabled="isAiBusy"
                  placeholder="可补充本次翻译的语气、专有名词、保留词或风格要求"
                />
              </el-form-item>
            </el-form>

            <div
              v-if="aiStreamStatusList.length > 0 || aiStreamContent"
              ref="aiStreamFeedbackRef"
              class="ai-stream-feedback"
            >
              <div class="translation-json-group-title">实时反馈</div>
              <div
                v-for="item in aiStreamStatusList"
                :key="item.id"
                class="ai-stream-status-item"
              >
                {{ item.message }}
              </div>
              <pre v-if="aiStreamContent" class="ai-stream-content">{{
                aiStreamContent
              }}</pre>
            </div>
          </template>

          <div v-else class="translation-import-preview-section">
            <el-alert
              class="mb20"
              type="warning"
              show-icon
              :closable="false"
              title="确认写入后，会立即保存当前文章和相关关联内容。若当前页存在未保存改动，也会一并提交。"
            />

            <el-descriptions class="mb20" :column="3" border>
              <el-descriptions-item label="可写入变更">
                {{ aiImportPreview.changeCount }}
              </el-descriptions-item>
              <el-descriptions-item label="跳过条目">
                {{ aiImportPreview.skippedCount }}
              </el-descriptions-item>
              <el-descriptions-item label="目标语言">
                {{ getLanguageText(form.languageCode) }}
              </el-descriptions-item>
            </el-descriptions>

            <div
              v-if="aiImportPreview.warningList.length > 0"
              class="translation-json-warning-list"
            >
              <div class="translation-json-group-title">跳过说明</div>
              <div
                v-for="warning in aiImportPreview.warningList"
                :key="warning"
                class="translation-json-warning-item"
              >
                {{ warning }}
              </div>
            </div>

            <div
              v-for="group in aiImportPreviewGroups"
              :key="group.label"
              class="translation-import-preview-group"
            >
              <div class="translation-json-group-header">
                <div class="translation-json-group-heading">
                  <div
                    v-if="group.meta.eyebrow"
                    class="translation-json-group-eyebrow"
                  >
                    {{ group.meta.eyebrow }}
                  </div>
                  <div class="translation-json-group-title">
                    {{ group.meta.title || group.label || '未命名分组' }}
                  </div>
                </div>
                <div class="translation-json-group-count">
                  {{ group.entries.length }} 项
                </div>
              </div>
              <div
                v-for="item in group.entries"
                :key="item.id"
                class="translation-import-preview-item"
              >
                <div class="translation-import-preview-item-title">
                  <TranslationEntryMeta :entry="item" />
                </div>
                <div class="translation-import-preview-columns">
                  <div
                    v-if="item.hasSourceValue"
                    class="translation-import-preview-panel"
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
                    <pre class="translation-import-preview-raw">{{
                      item.sourceValue
                    }}</pre>
                  </div>
                  <div class="translation-import-preview-panel">
                    <div class="translation-import-preview-panel-title">
                      当前
                    </div>
                    <div
                      v-if="item.currentHtml"
                      class="translation-import-preview-html"
                      v-html="item.currentHtml"
                    />
                    <pre class="translation-import-preview-raw">{{
                      item.currentValue
                    }}</pre>
                  </div>
                  <div class="translation-import-preview-panel">
                    <div class="translation-import-preview-panel-title">
                      AI 翻译后
                    </div>
                    <div
                      v-if="item.nextHtml"
                      class="translation-import-preview-html"
                      v-html="item.nextHtml"
                    />
                    <pre class="translation-import-preview-raw">{{
                      item.nextValue
                    }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button :disabled="isAiBusy" @click="aiDialogVisible = false">
          取消
        </el-button>
        <el-button
          v-if="aiImportPreview"
          :disabled="isAiBusy"
          @click="resetAiTranslationPreview"
        >
          返回调整
        </el-button>
        <el-button
          v-if="!aiImportPreview"
          type="primary"
          :loading="aiTranslating"
          :disabled="isAiBusy || aiEntryList.length === 0"
          @click="requestAiTranslation"
        >
          开始翻译
        </el-button>
        <el-button
          v-else
          type="primary"
          :loading="aiApplying"
          :disabled="isAiBusy || aiImportPreview.changeCount === 0"
          @click="confirmAiTranslationImport"
        >
          确认写入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="relationEditVisible"
      :title="relationEditTitle"
      width="min(860px, 94vw)"
      align-center
      destroy-on-close
      append-to-body
    >
      <el-form :model="relationEditForm" label-width="110px" @submit.prevent>
        <RelationBusinessFieldEditor
          :fields="relationEditFields"
          :form="relationEditForm"
          :language-code="form.languageCode"
          :record="relationEditRecord"
          @parent-updated="handleRelationParentUpdated"
        />
      </el-form>
      <template #footer>
        <el-button @click="relationEditVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="relationSaving"
          @click="saveRelationEdit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ElButton,
  ElMessage,
  ElMessageBox,
  ElTag,
  ElTooltip
} from 'element-plus'
import { Document, EditPen, VideoPlay } from '@element-plus/icons-vue'
import RichEditor4 from '@/components/RichEditor4.vue'
import RichEditor5 from '@/components/RichEditor5'
import EmojiTextarea from '@/components/EmojiTextarea.vue'
import RelationBusinessFieldEditor from '@/components/RelationBusinessFieldEditor.vue'
import TranslationEntryMeta from '@/components/TranslationEntryMeta.vue'
import { multilingualApi } from '@/api'
import store from '@/store'
import {
  getLanguageText,
  getPostDisplayTitle,
  getPostStatusText,
  getPostTypeTagType,
  getPostTypeText,
  getRelationDisplayName
} from '@/utils/multilingual'
import {
  createApiErrorFromResponse,
  extractApiErrorMessages
} from '@/utils/apiError'
import { groupTranslationEntryList } from '@/utils/translationEntryDisplay'
import { loadAndOpenImg, nowTimestampToBase36WithRandom } from '@/utils/utils'
import {
  getRelationEditFields,
  getRelationFieldInitialValue,
  shouldSubmitRelationEditField
} from '@/utils/relationEditFields'
import {
  buildTranslationExportEntries,
  buildTranslationExportPayload,
  buildTranslationImportPreview,
  buildTranslationJsonFilename,
  buildTranslationJsonSliceFilename,
  buildSourceToTargetTranslationEntries,
  parseTranslationImportPayload
} from '@/utils/translationJson'

const AUTHOR_RELATION_FIELD = {
  label: '作者',
  field: 'author',
  collectionName: 'users',
  multiple: false
}

const BASE_RELATION_FIELDS = [
  { label: '分类', field: 'sort', collectionName: 'sorts', multiple: false },
  { label: '标签', field: 'tags', collectionName: 'tags', multiple: true },
  {
    label: '地点',
    field: 'mappointList',
    collectionName: 'mappoints',
    multiple: true
  },
  {
    label: '媒体内容',
    field: 'coverImages',
    collectionName: 'attachments',
    multiple: true
  }
]

const TWEET_CONTENT_RELATION_FIELDS = [
  {
    label: '关联活动',
    field: 'contentEventList',
    collectionName: 'events',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联投票',
    field: 'contentVoteList',
    collectionName: 'votes',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联博文',
    field: 'contentPostList',
    collectionName: 'posts',
    multiple: true,
    postType: 1,
    relationScope: 'tweetContent'
  },
  {
    label: '关联推文',
    field: 'contentTweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2,
    relationScope: 'tweetContent'
  },
  {
    label: '关联番剧',
    field: 'contentBangumiList',
    collectionName: 'bangumis',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联电影',
    field: 'contentMovieList',
    collectionName: 'movies',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联书籍',
    field: 'contentBookList',
    collectionName: 'books',
    multiple: true,
    relationScope: 'tweetContent'
  },
  {
    label: '关联游戏',
    field: 'contentGameList',
    collectionName: 'games',
    multiple: true,
    relationScope: 'tweetContent'
  }
]

const DETAIL_RELATION_FIELDS = [
  {
    label: '相关活动',
    field: 'eventList',
    collectionName: 'events',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关投票',
    field: 'voteList',
    collectionName: 'votes',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关博文',
    field: 'postList',
    collectionName: 'posts',
    multiple: true,
    postType: 1,
    relationScope: 'detail'
  },
  {
    label: '相关推文',
    field: 'tweetList',
    collectionName: 'posts',
    multiple: true,
    postType: 2,
    relationScope: 'detail'
  },
  {
    label: '相关番剧',
    field: 'bangumiList',
    collectionName: 'bangumis',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关电影',
    field: 'movieList',
    collectionName: 'movies',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关书籍',
    field: 'bookList',
    collectionName: 'books',
    multiple: true,
    relationScope: 'detail'
  },
  {
    label: '相关游戏',
    field: 'gameList',
    collectionName: 'games',
    multiple: true,
    relationScope: 'detail'
  }
]

const ALL_RELATION_FIELDS = [
  AUTHOR_RELATION_FIELD,
  ...BASE_RELATION_FIELDS,
  ...TWEET_CONTENT_RELATION_FIELDS,
  ...DETAIL_RELATION_FIELDS
]

function createRelationRecords() {
  const records = {}
  ALL_RELATION_FIELDS.forEach(field => {
    records[field.field] = []
  })
  return records
}

function getRecordIdList(records) {
  if (!Array.isArray(records)) {
    return []
  }

  return records.map(item => item._id).filter(Boolean)
}

function getRelationRecordDisplayName(record, field = {}) {
  if (!record) {
    return '-'
  }

  if (field.collectionName === 'posts') {
    return getPostDisplayTitle({
      ...record,
      type: record.type || field.postType
    })
  }

  return getRelationDisplayName(record)
}

const RelationSelectedList = defineComponent({
  name: 'RelationSelectedList',
  props: {
    field: { type: Object, required: true },
    records: { type: Array, default: () => [] }
  },
  emits: ['edit'],
  setup(props, { emit }) {
    const getName = record => {
      return getRelationRecordDisplayName(record, props.field)
    }

    return () => {
      const nodes =
        props.records.length > 0
          ? props.records.map(record =>
              h(
                ElTag,
                {
                  key: record._id,
                  class: 'relation-selected-tag'
                },
                {
                  default: () => [
                    h(
                      'span',
                      { class: 'relation-selected-name' },
                      getName(record)
                    ),
                    h(
                      ElTooltip,
                      {
                        content: `快捷编辑${props.field.label}`,
                        placement: 'top'
                      },
                      {
                        default: () =>
                          h(ElButton, {
                            class: 'relation-selected-edit-button',
                            link: true,
                            type: 'primary',
                            size: 'small',
                            icon: EditPen,
                            'aria-label': `快捷编辑${props.field.label}`,
                            onClick: event => {
                              event.stopPropagation()
                              emit('edit', props.field, record)
                            }
                          })
                      }
                    )
                  ]
                }
              )
            )
          : [h('span', { class: 'cGray666' }, '未关联')]

      return h('div', { class: 'relation-selected-list' }, nodes)
    }
  }
})

export default {
  name: 'TranslationPostEditor',
  components: {
    Document,
    EditPen,
    EmojiTextarea,
    RelationSelectedList,
    RichEditor5,
    RichEditor4,
    RelationBusinessFieldEditor,
    TranslationEntryMeta,
    VideoPlay
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const loading = ref(false)
    const saving = ref(false)
    const detailData = ref(null)
    const contentTab = ref('richText')
    const contentSource = ref('')
    const relationRecords = reactive(createRelationRecords())
    const originalEditorVersion = ref(undefined)
    const form = reactive({
      id: '',
      languageCode: '',
      sourceLanguageCode: '',
      sourceSnapshotId: '',
      snapshotVersion: 1,
      pendingReview: false,
      author: null,
      title: '',
      date: null,
      content: '',
      excerpt: '',
      alias: '',
      sort: null,
      type: 1,
      tags: [],
      mappointList: [],
      bangumiList: [],
      movieList: [],
      gameList: [],
      bookList: [],
      postList: [],
      tweetList: [],
      eventList: [],
      voteList: [],
      contentBangumiList: [],
      contentMovieList: [],
      contentGameList: [],
      contentBookList: [],
      contentPostList: [],
      contentTweetList: [],
      contentEventList: [],
      contentVoteList: [],
      top: false,
      sortop: false,
      status: 0,
      allowRemark: false,
      template: '',
      code: '',
      editorVersion: 5,
      coverImages: []
    })

    const postEditorVersion = computed(() => {
      return Number(form.editorVersion || 5)
    })

    const relationEditVisible = ref(false)
    const relationSaving = ref(false)
    const relationEditField = ref(null)
    const relationEditRecord = ref(null)
    const relationEditForm = reactive({})
    const exportDialogVisible = ref(false)
    const exportEntryList = ref([])
    const selectedExportIds = ref([])
    const exportBaseMode = ref('source')
    const exportLoading = ref(false)
    const exportUseSlices = ref(false)
    const exportSliceSize = ref(20)
    const importDialogVisible = ref(false)
    const importJsonText = ref('')
    const importPreview = ref(null)
    const importing = ref(false)
    const importFileInputRef = ref(null)
    const importSelectedFileCount = ref(0)
    const aiDialogVisible = ref(false)
    const aiLoading = ref(false)
    const aiTranslating = ref(false)
    const aiApplying = ref(false)
    const aiEntryList = ref([])
    const aiSkippedEntries = ref([])
    const selectedAiEntryIds = ref([])
    const aiPrompt = ref('')
    const aiBaseMode = ref('source')
    const aiImportPreview = ref(null)
    const sourceReferenceEntries = ref([])
    const aiStreamStatusList = ref([])
    const aiStreamContent = ref('')
    const aiStreamReasoning = ref('')
    const aiStreamFeedbackRef = ref(null)
    const skippedTranslationCreatingIds = ref([])
    const creatingAllSkippedTranslations = ref(false)
    let aiEntryLoadRequestId = 0

    const typeTitle = computed(() => getPostTypeText(form.type))
    const relationEditFields = computed(() => {
      if (!relationEditField.value) {
        return []
      }
      return getRelationEditFields(relationEditField.value.collectionName)
    })
    const relationEditTitle = computed(() => {
      if (!relationEditField.value) {
        return '快捷编辑关联内容'
      }
      return `快捷编辑${relationEditField.value.label}`
    })

    function getRelationField(fieldName) {
      return ALL_RELATION_FIELDS.find(item => item.field === fieldName)
    }

    function getRelationName(record, field = {}) {
      return getRelationRecordDisplayName(record, field)
    }

    const authorRecord = computed(() => relationRecords.author[0] || null)
    const authorName = computed(() => {
      if (!authorRecord.value) {
        return '-'
      }
      return getRelationName(authorRecord.value)
    })
    const exportEntryGroups = computed(() => {
      return groupTranslationEntryList(exportEntryList.value)
    })
    const selectedExportEntryList = computed(() => {
      const selectedIdSet = new Set(selectedExportIds.value)
      return exportEntryList.value.filter(entry => {
        return selectedIdSet.has(entry.id)
      })
    })
    const exportSliceSummary = computed(() => {
      if (
        !exportUseSlices.value ||
        selectedExportEntryList.value.length === 0
      ) {
        return null
      }

      const jsonPayload = buildTranslationExportPayload({
        form: buildCurrentExportForm(),
        selectedEntries: selectedExportEntryList.value,
        sliceOptions: {
          enabled: true,
          size: exportSliceSize.value
        }
      })
      const sliceMeta = jsonPayload.meta?.slice || {}
      const total = Number(sliceMeta.total || 0)
      if (!total) {
        return null
      }

      return {
        total,
        totalEntries: Number(sliceMeta.totalEntries || 0),
        sourceEntries: Number(
          sliceMeta.sourceEntries || selectedExportEntryList.value.length
        )
      }
    })
    const importPreviewGroups = computed(() => {
      return groupTranslationEntryList(importPreview.value?.changeList || [])
    })
    const aiEntryGroups = computed(() => {
      return groupTranslationEntryList(aiEntryList.value)
    })
    const aiImportPreviewGroups = computed(() => {
      return groupTranslationEntryList(aiImportPreview.value?.changeList || [])
    })
    const creatableAiSkippedEntries = computed(() => {
      return aiSkippedEntries.value.filter(item => {
        return canCreateSkippedTranslation(item)
      })
    })
    const isAiBusy = computed(() => {
      return aiLoading.value || aiTranslating.value || aiApplying.value
    })
    const currentAiSourceLanguageCode = computed(() => {
      if (aiBaseMode.value === 'current') {
        return form.languageCode
      }
      return form.sourceLanguageCode
    })

    function buildTranslationEntries(options = {}) {
      if (contentTab.value === 'sourceCode') {
        form.content = contentSource.value
      }

      return buildTranslationExportEntries({
        form,
        relationFields: ALL_RELATION_FIELDS,
        relationRecords,
        includeEmpty: Boolean(options.includeEmpty)
      })
    }

    function buildRelationRecordsFromPost(post) {
      const records = createRelationRecords()
      records.author = post.author ? [post.author] : []
      records.sort = post.sort ? [post.sort] : []
      ALL_RELATION_FIELDS.forEach(field => {
        if (field.field === 'author' || field.field === 'sort') {
          return
        }
        records[field.field] = []
        if (Array.isArray(post[field.field])) {
          records[field.field] = post[field.field].filter(Boolean)
        }
      })
      return records
    }

    function buildSourceSnapshotEntries(sourcePost) {
      const sourceForm = {
        ...sourcePost,
        id: sourcePost._id,
        languageCode: sourcePost.languageCode || sourcePost.sourceLanguageCode,
        sourceLanguageCode: sourcePost.sourceLanguageCode
      }
      return buildTranslationExportEntries({
        form: sourceForm,
        relationFields: ALL_RELATION_FIELDS,
        relationRecords: buildRelationRecordsFromPost(sourcePost)
      })
    }

    async function loadSourceReferenceEntries(options = {}) {
      if (!options.force && sourceReferenceEntries.value.length > 0) {
        return {
          entries: sourceReferenceEntries.value,
          skippedEntries: []
        }
      }

      const sourceSnapshotId = getSourceSnapshotId()
      if (!sourceSnapshotId) {
        return {
          entries: [],
          skippedEntries: []
        }
      }

      const response = await multilingualApi.getSourcePostDetail({
        id: sourceSnapshotId
      })
      const sourceDetail = response.data.data || {}
      const sourcePost = sourceDetail.post
      if (!sourcePost) {
        return {
          entries: [],
          skippedEntries: []
        }
      }

      const sourceEntries = buildSourceSnapshotEntries(sourcePost)
      const targetEntries = buildTranslationEntries({ includeEmpty: true })
      const mappedResult = buildSourceToTargetTranslationEntries({
        sourceEntries,
        targetEntries
      })
      sourceReferenceEntries.value = mappedResult.entries
      return mappedResult
    }

    async function loadTranslationEntriesByBaseMode(mode, options = {}) {
      if (mode === 'current') {
        return {
          entries: buildTranslationEntries(options),
          skippedEntries: []
        }
      }

      return await loadSourceReferenceEntries({
        force: options.force === true
      })
    }

    function isVideoAttachment(record) {
      return Boolean(record?.mimetype && record.mimetype.includes('video'))
    }

    function isImageAttachment(record) {
      return Boolean(record?.mimetype && record.mimetype.includes('image'))
    }

    function isAbsoluteMediaUrl(value) {
      if (!value) {
        return false
      }

      return /^(https?:)?\/\//.test(value) || value.startsWith('/')
    }

    function normalizeMediaUrl(value) {
      if (!value) {
        return ''
      }

      if (isAbsoluteMediaUrl(value)) {
        return value
      }

      return value
    }

    function getFirstMediaUrl(candidateList) {
      for (const item of candidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return previewUrl
        }
      }

      return ''
    }

    function getImagePreviewUrl(record) {
      return getFirstMediaUrl([
        record?.localThumbnailPath,
        record?.localFilepath,
        record?.thumfor,
        record?.filepath,
        record?.remoteFilepath
      ])
    }

    function getImageOriginalUrl(record) {
      return getFirstMediaUrl([
        record?.localFilepath,
        record?.filepath,
        record?.remoteFilepath,
        record?.localThumbnailPath,
        record?.thumfor
      ])
    }

    function getVideoPreviewUrl(record) {
      return getFirstMediaUrl([
        record?.localFilepath,
        record?.filepath,
        record?.remoteFilepath
      ])
    }

    function getVideoCoverUrl(record) {
      return getFirstMediaUrl([record?.localThumbnailPath, record?.thumfor])
    }

    function getPositiveMediaSize(value) {
      const numberValue = Number(value)
      if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue
      }
      return 0
    }

    function getMediaPreviewSize(record) {
      const width =
        getPositiveMediaSize(record?.width) ||
        getPositiveMediaSize(record?.thumWidth)
      const height =
        getPositiveMediaSize(record?.height) ||
        getPositiveMediaSize(record?.thumHeight)

      if (width && height) {
        return { width, height }
      }

      if (isVideoAttachment(record)) {
        return { width: 1280, height: 720 }
      }

      return { width: 1600, height: 900 }
    }

    function buildMediaPreviewItem(record) {
      let previewUrl = ''
      if (isImageAttachment(record)) {
        previewUrl = getImageOriginalUrl(record)
      }
      if (isVideoAttachment(record)) {
        previewUrl = getVideoPreviewUrl(record)
      }
      if (!previewUrl) {
        return null
      }

      const previewSize = getMediaPreviewSize(record)
      return {
        src: previewUrl,
        width: previewSize.width,
        height: previewSize.height,
        mimetype: record?.mimetype || '',
        is360Panorama: Boolean(record?.is360Panorama)
      }
    }

    function openMediaPreview(record) {
      const previewItem = buildMediaPreviewItem(record)
      if (!previewItem) {
        return
      }

      loadAndOpenImg(0, [previewItem])
    }

    function generateRandomString(length) {
      const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let result = ''
      for (let index = 0; index < length; index++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length)
        )
      }
      return result
    }

    function buildTypeAlias(type) {
      const timeRandomText = nowTimestampToBase36WithRandom()
      if (type === 1) {
        return `b-${timeRandomText}`
      }
      if (type === 2) {
        return `t-${timeRandomText}`
      }
      if (type === 3) {
        return `p-${timeRandomText}`
      }
      return timeRandomText
    }

    function resetRandomAlias() {
      let prefix = ''
      if (form.type === 1) {
        prefix = 'b-'
      } else if (form.type === 2) {
        prefix = 't-'
      } else if (form.type === 3) {
        prefix = 'p-'
      }
      form.alias = prefix + generateRandomString(8)
    }

    function setRelationRecordList(fieldName, records) {
      relationRecords[fieldName] = Array.isArray(records)
        ? records.filter(Boolean)
        : []
      syncRelationIds(fieldName)
    }

    function applyPost(post) {
      form.id = post._id
      form.languageCode = post.languageCode
      form.sourceLanguageCode = post.sourceLanguageCode
      form.sourceSnapshotId = post.sourceSnapshotId || ''
      sourceReferenceEntries.value = []
      form.snapshotVersion = post.snapshotVersion
      form.pendingReview = Boolean(post.pendingReview)
      setRelationRecordList('author', post.author ? [post.author] : [])
      form.title = post.title || ''
      form.date = post.date ? new Date(post.date) : null
      form.content = post.content || ''
      form.excerpt = post.excerpt || ''
      form.alias = post.alias || buildTypeAlias(post.type)
      form.type = Number(post.type || 1)
      form.top = Boolean(post.top)
      form.sortop = Boolean(post.sortop)
      form.status = Number(post.status || 0)
      form.allowRemark = Boolean(post.allowRemark)
      form.template = post.template || ''
      form.code = post.code || ''
      originalEditorVersion.value = undefined
      if (
        Object.prototype.hasOwnProperty.call(post, 'editorVersion') &&
        post.editorVersion !== null &&
        typeof post.editorVersion !== 'undefined'
      ) {
        originalEditorVersion.value = Number(post.editorVersion || 5)
      }
      form.editorVersion = originalEditorVersion.value || 5

      setRelationRecordList('sort', post.sort ? [post.sort] : [])
      ALL_RELATION_FIELDS.forEach(field => {
        if (field.field === 'author' || field.field === 'sort') {
          return
        }
        setRelationRecordList(field.field, post[field.field] || [])
      })
      contentSource.value = form.content
    }

    function getPostDetail() {
      loading.value = true
      return multilingualApi
        .getTranslationPostDetail({ id: route.params.id })
        .then(response => {
          detailData.value = response.data.data
          applyPost(detailData.value.post)
        })
        .finally(() => {
          loading.value = false
        })
    }

    function syncRelationIds(fieldName) {
      const field = getRelationField(fieldName)
      if (field && !field.multiple) {
        form[fieldName] = relationRecords[fieldName][0]?._id || null
        return
      }
      form[fieldName] = getRecordIdList(relationRecords[fieldName])
    }

    function fillRelationEditForm(record) {
      Object.keys(relationEditForm).forEach(key => {
        delete relationEditForm[key]
      })
      relationEditFields.value.forEach(item => {
        relationEditForm[item.name] = getRelationFieldInitialValue(item, record)
      })
    }

    function openRelationEditor(field, record) {
      if (!field || !record) {
        return
      }
      relationEditField.value = field
      relationEditRecord.value = record
      fillRelationEditForm(record)
      relationEditVisible.value = true
    }

    function replaceRecordInList(fieldName, record) {
      const index = relationRecords[fieldName].findIndex(
        item => item._id === record._id
      )
      if (index >= 0) {
        relationRecords[fieldName][index] = record
      }
    }

    function saveRelationEdit() {
      const field = relationEditField.value
      const record = relationEditRecord.value
      if (!field || !record) {
        return
      }
      const payload = {}
      relationEditFields.value.forEach(item => {
        if (!shouldSubmitRelationEditField(item)) {
          return
        }
        payload[item.name] = relationEditForm[item.name]
      })
      relationSaving.value = true
      multilingualApi
        .updateTranslationRelation({
          collectionName: field.collectionName,
          id: record._id,
          languageCode: form.languageCode,
          payload
        })
        .then(response => {
          const updatedRecord = response.data.data
          replaceRecordInList(field.field, updatedRecord)
          ElMessage.success('关联内容已保存')
          relationEditVisible.value = false
        })
        .finally(() => {
          relationSaving.value = false
        })
    }

    function handleRelationParentUpdated({ field, parentRecord }) {
      if (!relationEditField.value || !relationEditRecord.value) {
        return
      }
      relationEditRecord.value[field.name] = parentRecord
      replaceRecordInList(
        relationEditField.value.field,
        relationEditRecord.value
      )
    }

    function onContentTabChange(tabName) {
      if (tabName === 'sourceCode') {
        contentSource.value = form.content
        return
      }
      form.content = contentSource.value
    }

    function buildSubmitData(confirmReview) {
      if (contentTab.value === 'sourceCode') {
        form.content = contentSource.value
      }
      return {
        id: form.id,
        languageCode: form.languageCode,
        title: form.title,
        date: form.date,
        content: form.content,
        excerpt: form.excerpt,
        alias: form.alias,
        type: form.type,
        top: form.top,
        sortop: form.sortop,
        status: form.status,
        allowRemark: form.allowRemark,
        template: form.template,
        code: form.code,
        editorVersion: form.editorVersion,
        confirmReview
      }
    }

    function buildImportSubmitData(postPatch) {
      const submitData = {
        ...buildSubmitData(false),
        ...postPatch
      }
      if (typeof originalEditorVersion.value === 'undefined') {
        delete submitData.editorVersion
      } else {
        submitData.editorVersion = originalEditorVersion.value
      }
      return submitData
    }

    function submit(confirmReview) {
      saving.value = true
      multilingualApi
        .updateTranslationPost(buildSubmitData(confirmReview))
        .then(response => {
          detailData.value = response.data.data
          applyPost(detailData.value.post)
          ElMessage.success('保存成功')
        })
        .finally(() => {
          saving.value = false
        })
    }

    function confirmReview() {
      submit(true)
    }

    async function restoreSnapshot() {
      try {
        await ElMessageBox.confirm(
          '确认将当前文章还原为最新源快照内容，并同步作者、分类、标签、地点、媒体、推文内关联内容、详情页相关内容及排序引用？只会更新这些引用索引，不覆盖已编辑的关联内容本身；文章状态会改为草稿，旧关联和旧媒体不会删除。',
          '同步快照',
          {
            type: 'warning',
            confirmButtonText: '同步快照',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }

      saving.value = true
      try {
        const response = await multilingualApi.restoreTranslationPostSnapshot({
          id: form.id,
          sourceSnapshotId: form.sourceSnapshotId,
          languageCode: form.languageCode
        })
        applyPostDetailData(response.data.data)
        ElMessage.success('已同步为最新快照草稿')
      } finally {
        saving.value = false
      }
    }

    function goList() {
      router.push({ name: 'TranslationPostList' })
    }

    async function refreshExportEntries() {
      exportLoading.value = true
      const loadOptions = {}
      // const loadOptions = { force: true }
      try {
        const result = await loadTranslationEntriesByBaseMode(
          exportBaseMode.value,
          loadOptions
        )
        const entryList = result.entries || []
        exportEntryList.value = entryList
        selectedExportIds.value = entryList
          .filter(entry => entry.defaultSelected)
          .map(entry => entry.id)
        if (entryList.length === 0) {
          ElMessage.warning('当前没有可导出的翻译内容')
        }
      } finally {
        exportLoading.value = false
      }
    }

    async function openTranslationJsonExport() {
      exportBaseMode.value = 'source'
      exportEntryList.value = []
      selectedExportIds.value = []
      exportDialogVisible.value = true
      await refreshExportEntries()
    }

    function selectAllExportEntries() {
      selectedExportIds.value = exportEntryList.value.map(entry => entry.id)
    }

    function clearExportEntries() {
      selectedExportIds.value = []
    }

    function buildCurrentExportForm() {
      const exportForm = {
        ...form
      }
      if (exportBaseMode.value === 'current') {
        exportForm.sourceLanguageCode = form.languageCode
      }
      return exportForm
    }

    function downloadJsonPayload(payload, filename) {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8'
      })
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(downloadUrl)
    }

    function buildSliceExportPayload(jsonPayload, slice) {
      return {
        ...jsonPayload,
        meta: {
          ...(jsonPayload.meta || {}),
          slice: {
            ...(jsonPayload.meta?.slice || {}),
            index: slice.index
          }
        },
        slices: [slice]
      }
    }

    async function writeJsonFileToDirectory(
      directoryHandle,
      filename,
      payload
    ) {
      const fileHandle = await directoryHandle.getFileHandle(filename, {
        create: true
      })
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(payload, null, 2))
      await writable.close()
    }

    async function saveSlicedTranslationJsonToDirectory(
      jsonPayload,
      exportForm
    ) {
      const sliceList = jsonPayload.slices || []
      if (sliceList.length === 0) {
        return 0
      }

      const canPickDirectory =
        typeof window !== 'undefined' &&
        typeof window.showDirectoryPicker === 'function'
      if (!canPickDirectory) {
        throw new Error(
          '当前浏览器不支持稳定的切片目录导出，请使用 Chromium 内核浏览器重新导出'
        )
      }

      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite'
      })
      const total = sliceList.length
      for (const slice of sliceList) {
        await writeJsonFileToDirectory(
          directoryHandle,
          buildTranslationJsonSliceFilename(exportForm, slice.index, total),
          buildSliceExportPayload(jsonPayload, slice)
        )
      }

      return total
    }

    async function downloadTranslationJson() {
      if (selectedExportIds.value.length === 0) {
        ElMessage.warning('请至少选择一项导出内容')
        return
      }

      const selectedEntries = selectedExportEntryList.value
      const exportForm = buildCurrentExportForm()
      const jsonPayload = buildTranslationExportPayload({
        form: exportForm,
        selectedEntries,
        sliceOptions: {
          enabled: exportUseSlices.value,
          size: exportSliceSize.value
        }
      })

      try {
        if (exportUseSlices.value && Array.isArray(jsonPayload.slices)) {
          const fileCount = await saveSlicedTranslationJsonToDirectory(
            jsonPayload,
            exportForm
          )
          exportDialogVisible.value = false
          ElMessage.success(`已导出 ${fileCount} 个切片文件`)
          return
        }

        downloadJsonPayload(
          jsonPayload,
          buildTranslationJsonFilename(exportForm)
        )
        exportDialogVisible.value = false
        ElMessage.success('JSON 已导出')
      } catch (error) {
        if (error?.name === 'AbortError') {
          return
        }

        ElMessage.error(error?.message || 'JSON 导出失败')
      }
    }

    function openTranslationJsonImport() {
      importJsonText.value = ''
      importPreview.value = null
      importSelectedFileCount.value = 0
      importDialogVisible.value = true
    }

    function triggerImportFilePicker() {
      importFileInputRef.value && importFileInputRef.value.click()
    }

    function readImportFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = readerEvent => {
          resolve(String(readerEvent.target?.result || ''))
        }
        reader.onerror = () => {
          reject(new Error('JSON 文件读取失败'))
        }
        reader.readAsText(file, 'utf-8')
      })
    }

    async function handleImportFileChange(event) {
      const fileList = Array.from(event.target.files || [])
      event.target.value = ''
      importSelectedFileCount.value = fileList.length
      if (fileList.length === 0) {
        return
      }

      try {
        const textList = await Promise.all(
          fileList.map(file => readImportFile(file))
        )
        importJsonText.value = textList.join('\n\n')
        importPreview.value = null
      } catch (error) {
        ElMessage.error(error?.message || 'JSON 文件读取失败')
      }
    }

    async function parseTranslationJsonImport() {
      if (!importJsonText.value.trim()) {
        ElMessage.warning('请先粘贴或选择 JSON 内容')
        return
      }

      try {
        const referenceResult = await loadSourceReferenceEntries()
        const parsedPayload = parseTranslationImportPayload(
          importJsonText.value
        )
        const preview = buildTranslationImportPreview({
          parsedPayload,
          currentEntries: buildTranslationEntries({ includeEmpty: true }),
          form,
          referenceEntries: referenceResult.entries
        })
        importPreview.value = preview
        if (preview.changeCount === 0) {
          ElMessage.info('JSON 中没有可导入的变更')
        }
      } catch (error) {
        ElMessage.error(error?.message || 'JSON 解析失败')
      }
    }

    async function applyTranslationImportPreview(preview) {
      const relationUpdates = preview.applyPlan.relationUpdates
      if (relationUpdates.length > 0) {
        await Promise.all(
          relationUpdates.map(updateItem => {
            return multilingualApi.updateTranslationRelation({
              collectionName: updateItem.collectionName,
              id: updateItem.id,
              languageCode: form.languageCode,
              payload: updateItem.payload
            })
          })
        )
      }

      const postPatch = preview.applyPlan.postPatch
      if (Object.keys(postPatch).length > 0) {
        await multilingualApi.updateTranslationPost(
          buildImportSubmitData(postPatch)
        )
      }

      await getPostDetail()
    }

    async function confirmTranslationJsonImport() {
      if (!importPreview.value || importPreview.value.changeCount === 0) {
        ElMessage.warning('请先解析出可导入的变更')
        return
      }

      try {
        await ElMessageBox.confirm(
          '确认导入后，将立即写入当前文章与关联内容。请确认本页不存在不希望一并保存的未保存改动。',
          '确认导入',
          {
            type: 'warning',
            confirmButtonText: '确认导入',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }

      importing.value = true
      try {
        await applyTranslationImportPreview(importPreview.value)
        importDialogVisible.value = false
        importJsonText.value = ''
        importPreview.value = null
        ElMessage.success('JSON 导入成功')
      } finally {
        importing.value = false
      }
    }

    function resetAiTranslationState() {
      aiEntryList.value = []
      aiSkippedEntries.value = []
      selectedAiEntryIds.value = []
      aiPrompt.value = ''
      aiBaseMode.value = 'source'
      aiImportPreview.value = null
      sourceReferenceEntries.value = []
      aiStreamStatusList.value = []
      aiStreamContent.value = ''
      aiStreamReasoning.value = ''
      skippedTranslationCreatingIds.value = []
      creatingAllSkippedTranslations.value = false
    }

    function canCreateSkippedTranslation(item) {
      return Boolean(
        item &&
        item.actionType === 'createTranslationPost' &&
        item.sourceSnapshotId &&
        item.relationField
      )
    }

    function isSkippedTranslationCreating(item) {
      return skippedTranslationCreatingIds.value.includes(item.id)
    }

    function setSkippedTranslationCreating(item, isCreating) {
      const idList = skippedTranslationCreatingIds.value.filter(id => {
        return id !== item.id
      })
      if (isCreating) {
        idList.push(item.id)
      }
      skippedTranslationCreatingIds.value = idList
    }

    function applyPostDetailData(nextDetailData) {
      if (!nextDetailData || !nextDetailData.post) {
        return false
      }
      detailData.value = nextDetailData
      applyPost(nextDetailData.post)
      return true
    }

    async function refreshAiTranslationCandidates(nextDetailData = null) {
      const requestId = aiEntryLoadRequestId + 1
      aiEntryLoadRequestId = requestId
      aiLoading.value = true
      const loadOptions = {}
      // sourceReferenceEntries.value = []
      // const loadOptions = { force: true }
      try {
        const isDetailApplied = applyPostDetailData(nextDetailData)
        if (!isDetailApplied) {
          // await getPostDetail()
        }
        const requestMode = aiBaseMode.value
        const mappedResult = await loadTranslationEntriesByBaseMode(
          requestMode,
          loadOptions
        )
        if (
          requestId !== aiEntryLoadRequestId ||
          requestMode !== aiBaseMode.value
        ) {
          return
        }
        aiEntryList.value = mappedResult.entries
        aiSkippedEntries.value = mappedResult.skippedEntries
        selectedAiEntryIds.value = aiEntryList.value
          .filter(entry => entry.defaultSelected)
          .map(entry => entry.id)
      } finally {
        if (requestId === aiEntryLoadRequestId) {
          aiLoading.value = false
        }
      }
    }

    async function createSkippedTranslation(item) {
      if (!canCreateSkippedTranslation(item)) {
        return
      }

      setSkippedTranslationCreating(item, true)
      try {
        const response =
          await multilingualApi.createMissingPostRelationTranslation({
            postId: form.id,
            sourceSnapshotId: item.sourceSnapshotId,
            relationField: item.relationField
          })
        const responseData = response.data.data || {}
        await refreshAiTranslationCandidates(responseData.post)
        ElMessage.success('已创建关联文章语言版本')
      } finally {
        setSkippedTranslationCreating(item, false)
      }
    }

    async function createAllSkippedTranslations() {
      const itemList = creatableAiSkippedEntries.value
      if (itemList.length === 0) {
        return
      }

      creatingAllSkippedTranslations.value = true
      skippedTranslationCreatingIds.value = itemList.map(item => item.id)
      try {
        let lastResponseData = null
        for (const item of itemList) {
          const response =
            await multilingualApi.createMissingPostRelationTranslation({
              postId: form.id,
              sourceSnapshotId: item.sourceSnapshotId,
              relationField: item.relationField
            })
          lastResponseData = response.data.data || null
        }
        await refreshAiTranslationCandidates(lastResponseData?.post || null)
        ElMessage.success(`已创建 ${itemList.length} 个关联文章语言版本`)
      } finally {
        creatingAllSkippedTranslations.value = false
        skippedTranslationCreatingIds.value = []
      }
    }

    function resetAiStreamState() {
      aiStreamStatusList.value = []
      aiStreamContent.value = ''
      aiStreamReasoning.value = ''
    }

    function pushAiStreamStatus(message) {
      if (!message) {
        return
      }
      aiStreamStatusList.value.push({
        id: `${Date.now()}-${aiStreamStatusList.value.length}`,
        message
      })
      scrollAiStreamFeedbackToBottom()
    }

    function scrollAiStreamFeedbackToBottom() {
      nextTick(() => {
        const feedbackElement = aiStreamFeedbackRef.value
        if (!feedbackElement) {
          return
        }
        feedbackElement.scrollTop = feedbackElement.scrollHeight
      })
    }

    function handleAiDialogBeforeClose(done) {
      if (isAiBusy.value) {
        return
      }
      done()
    }

    function getSourceSnapshotId() {
      return form.sourceSnapshotId || detailData.value?.post?.sourceSnapshotId
    }

    function openAiTranslationDialog() {
      const sourceSnapshotId = getSourceSnapshotId()
      if (!sourceSnapshotId) {
        ElMessage.warning('当前文章缺少源快照，无法进行 AI 翻译')
        return
      }

      resetAiTranslationState()
      aiBaseMode.value = 'source'
      aiDialogVisible.value = true
      refreshAiTranslationCandidates().then(() => {
        if (aiEntryList.value.length === 0) {
          ElMessage.warning('没有找到可提交给 AI 的源内容条目')
        }
      })
    }

    function handleAiBaseModeChange() {
      aiImportPreview.value = null
      resetAiStreamState()
      refreshAiTranslationCandidates()
    }

    function selectAllAiEntries() {
      selectedAiEntryIds.value = aiEntryList.value.map(entry => entry.id)
    }

    function clearAiEntries() {
      selectedAiEntryIds.value = []
    }

    function resetAiTranslationPreview() {
      aiImportPreview.value = null
      resetAiStreamState()
    }

    function parseClientSseBlock(block) {
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
      try {
        eventData.data = JSON.parse(dataLines.join('\n'))
      } catch (error) {
        eventData.data = {}
      }
      return eventData
    }

    function findClientSseBoundary(buffer) {
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

    function handleAiStreamEvent(eventData, referenceEntries) {
      if (!eventData) {
        return null
      }
      const data = eventData.data || {}
      if (eventData.eventName === 'status') {
        pushAiStreamStatus(data.message)
      }
      if (eventData.eventName === 'chunk') {
        if (data.reasoningDelta) {
          aiStreamReasoning.value += data.reasoningDelta
        }
        if (data.contentDelta) {
          aiStreamContent.value += data.contentDelta
          scrollAiStreamFeedbackToBottom()
        }
      }
      if (eventData.eventName === 'result') {
        const preview = buildTranslationImportPreview({
          parsedPayload: data.payload,
          currentEntries: buildTranslationEntries({ includeEmpty: true }),
          form,
          referenceEntries
        })
        aiImportPreview.value = preview
        if (preview.changeCount === 0) {
          ElMessage.info('AI 返回结果中没有可写入的变更')
        }
      }
      if (eventData.eventName === 'error') {
        return new Error(data.message || 'AI 翻译失败')
      }
      return null
    }

    async function readAiTranslationStream(response, referenceEntries) {
      if (!response.body) {
        throw new Error('浏览器不支持读取 AI 翻译流')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let streamError = null

      function consumeBuffer() {
        let boundary = findClientSseBoundary(buffer)
        while (boundary.index >= 0) {
          const block = buffer.slice(0, boundary.index)
          buffer = buffer.slice(boundary.index + boundary.length)
          const eventData = parseClientSseBlock(block)
          const error = handleAiStreamEvent(eventData, selectedEntries)
          if (error) {
            streamError = error
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
        const eventData = parseClientSseBlock(buffer)
        const error = handleAiStreamEvent(eventData, referenceEntries)
        if (error) {
          streamError = error
        }
      }

      if (streamError) {
        throw streamError
      }
    }

    async function requestAiTranslation() {
      if (aiLoading.value) {
        ElMessage.warning('正在加载翻译用文章，请稍候')
        return
      }
      if (selectedAiEntryIds.value.length === 0) {
        ElMessage.warning('请至少选择一项翻译内容')
        return
      }

      const selectedIdSet = new Set(selectedAiEntryIds.value)
      const selectedEntries = aiEntryList.value.filter(entry => {
        return selectedIdSet.has(entry.id)
      })

      resetAiStreamState()
      aiImportPreview.value = null
      aiTranslating.value = true
      try {
        const referenceResult = await loadSourceReferenceEntries()
        pushAiStreamStatus('正在开始翻译')
        const response = await fetch(
          '/api/multilingual-admin/translation/post/ai-translate-stream',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${store.getters.adminToken}`
            },
            body: JSON.stringify({
              postId: form.id,
              sourceLanguageCode: currentAiSourceLanguageCode.value,
              targetLanguageCode: form.languageCode,
              prompt: aiPrompt.value,
              entries: selectedEntries
            })
          }
        )

        if (!response.ok) {
          throw await createApiErrorFromResponse(response, 'AI 翻译请求失败')
        }

        await readAiTranslationStream(response, referenceResult.entries || [])
      } catch (error) {
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
      } finally {
        aiTranslating.value = false
      }
    }

    async function confirmAiTranslationImport() {
      if (!aiImportPreview.value || aiImportPreview.value.changeCount === 0) {
        ElMessage.warning('请先完成 AI 翻译预览')
        return
      }

      try {
        await ElMessageBox.confirm(
          '确认写入后，将立即保存 AI 翻译结果。请确认预览内容无误。',
          '确认写入 AI 翻译',
          {
            type: 'warning',
            confirmButtonText: '确认写入',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }

      aiApplying.value = true
      try {
        await applyTranslationImportPreview(aiImportPreview.value)
        aiDialogVisible.value = false
        resetAiTranslationState()
        ElMessage.success('AI 翻译已写入')
      } finally {
        aiApplying.value = false
      }
    }

    watch(importJsonText, value => {
      importPreview.value = null
      if (!value.trim()) {
        importSelectedFileCount.value = 0
      }
    })

    onMounted(() => {
      getPostDetail()
    })

    return {
      Document,
      EditPen,
      VideoPlay,
      aiApplying,
      aiBaseMode,
      aiDialogVisible,
      aiEntryGroups,
      aiEntryList,
      aiImportPreview,
      aiImportPreviewGroups,
      aiLoading,
      aiPrompt,
      aiSkippedEntries,
      aiStreamFeedbackRef,
      aiStreamContent,
      aiStreamStatusList,
      aiTranslating,
      authorName,
      authorRecord,
      canCreateSkippedTranslation,
      clearAiEntries,
      contentSource,
      contentTab,
      creatableAiSkippedEntries,
      createAllSkippedTranslations,
      createSkippedTranslation,
      creatingAllSkippedTranslations,
      confirmAiTranslationImport,
      confirmReview,
      detailData,
      detailRelationFields: DETAIL_RELATION_FIELDS,
      form,
      currentAiSourceLanguageCode,
      exportDialogVisible,
      exportBaseMode,
      exportEntryGroups,
      exportLoading,
      exportSliceSize,
      exportSliceSummary,
      exportUseSlices,
      getImagePreviewUrl,
      getLanguageText,
      getPostStatusText,
      getPostTypeTagType,
      getPostTypeText,
      getRelationField,
      getRelationName,
      getVideoCoverUrl,
      getVideoPreviewUrl,
      goList,
      isImageAttachment,
      isSkippedTranslationCreating,
      isVideoAttachment,
      loading,
      onContentTabChange,
      openMediaPreview,
      openAiTranslationDialog,
      openRelationEditor,
      handleAiBaseModeChange,
      handleAiDialogBeforeClose,
      handleRelationParentUpdated,
      importDialogVisible,
      importFileInputRef,
      importJsonText,
      importPreview,
      importPreviewGroups,
      importSelectedFileCount,
      importing,
      relationEditFields,
      relationEditForm,
      relationEditRecord,
      relationEditTitle,
      relationEditVisible,
      relationRecords,
      relationSaving,
      isAiBusy,
      postEditorVersion,
      resetRandomAlias,
      resetAiTranslationPreview,
      refreshExportEntries,
      restoreSnapshot,
      selectedExportIds,
      selectedAiEntryIds,
      clearExportEntries,
      confirmTranslationJsonImport,
      downloadTranslationJson,
      handleImportFileChange,
      openTranslationJsonExport,
      openTranslationJsonImport,
      parseTranslationJsonImport,
      requestAiTranslation,
      saveRelationEdit,
      saving,
      selectAllAiEntries,
      selectAllExportEntries,
      submit,
      syncRelationIds,
      triggerImportFilePicker,
      tweetContentRelationFields: TWEET_CONTENT_RELATION_FIELDS,
      typeTitle,
      buildTypeAlias
    }
  }
}
</script>

<style scoped>
.translation-post-editor-page {
  max-width: 1180px;
}

.post-editor-body {
  width: 100%;
}

.cover-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.post-cover-image-item {
  width: 100px;
  height: 100px;
  border: 1px solid var(--el-border-color);
  color: #ccc;
  box-sizing: border-box;
  cursor: pointer;
  position: relative;
}

.post-cover-image-preview-trigger {
  width: 100%;
  height: 100%;
  display: block;
  padding: 0;
  overflow: hidden;
  border: 0;
  color: inherit;
  cursor: pointer;
  background: var(--el-fill-color-light);
}

.post-cover-image-preview-trigger:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.attachment-cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-fill-color);
}

.translation-media-empty {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}

.relation-inline-name {
  margin-right: 6px;
}

.relation-inline-edit-button {
  vertical-align: middle;
}

.attachment-360-icon,
.attachment-play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  color: rgba(255, 255, 255, 0.88);
  text-align: center;
  pointer-events: none;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.post-cover-image-item-edit {
  position: absolute;
  right: 3px;
  top: 3px;
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  z-index: 3;
}

.attachment-file-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  text-align: center;
  color: var(--el-text-color-secondary);
  word-break: break-word;
}

.relation-selected-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.relation-selected-tag {
  height: auto;
  min-height: 28px;
  padding: 4px 8px;
  white-space: normal;
}

.relation-selected-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.relation-selected-name {
  display: inline-block;
  max-width: 280px;
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.relation-selected-edit-button {
  width: 22px;
  height: 22px;
  min-height: 22px;
  padding: 0;
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

.translation-json-option-form {
  margin-bottom: 12px;
}

.translation-json-slice-label {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
}

.translation-json-selected-count {
  margin-bottom: 12px;
}

.translation-json-group,
.translation-import-preview-group {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-bg-color);
}

.translation-json-warning-list {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-fill-color-extra-light);
}

.translation-json-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.translation-json-group-heading {
  flex: 1;
  min-width: 0;
}

.translation-json-group-eyebrow {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-color-primary);
}

.translation-json-group-title,
.translation-import-preview-panel-title {
  font-weight: 600;
}

.translation-json-group-title {
  display: flex;
  align-items: center;
  margin: 4px 0 0;
  min-height: 21px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.translation-json-group-count {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 10px;
  min-height: 24px;
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  font-weight: 600;
}

.translation-json-warning-list .translation-json-group-title {
  margin-bottom: 10px;
}

.ai-skipped-header {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.ai-skipped-header .translation-json-group-title {
  margin-bottom: 0;
}

.translation-json-entry-list {
  display: grid;
  gap: 0;
}

.translation-json-entry {
  width: 100%;
  margin-right: 0;
  align-items: flex-start;
  padding: 10px 0;
}

.translation-json-entry + .translation-json-entry {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.translation-json-entry :deep(.el-checkbox__label) {
  width: 100%;
  padding-left: 12px;
}

.translation-json-entry :deep(.el-checkbox__input) {
  margin-top: 4px;
}

.translation-json-entry-preview {
  margin-top: 8px;
  padding-left: 12px;
  border-left: 2px solid var(--el-border-color);
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.translation-json-warning-item {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.translation-json-hidden-input {
  display: none;
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

.translation-import-preview-section {
  margin-top: 20px;
}

.ai-translation-prompt-form {
  margin-top: 18px;
}

.ai-translation-dialog-body {
  min-height: 180px;
}

.ai-stream-feedback {
  margin-top: 16px;
  padding: 14px;
  max-height: 320px;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
}

.ai-stream-status-item {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.ai-stream-content {
  margin: 10px 0 0;
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}

.translation-import-preview-item {
  padding: 16px;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 8px 18px rgb(31 35 41 / 4%);
}

.translation-import-preview-item + .translation-import-preview-item {
  margin-top: 12px;
}

.translation-import-preview-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-import-preview-panel {
  min-width: 0;
}

.translation-import-preview-panel-title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
}

.translation-import-preview-panel-context {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  word-break: break-word;
}

.translation-import-preview-html,
.translation-import-preview-raw {
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.translation-import-preview-html {
  margin-bottom: 8px;
  line-height: 1.7;
  word-break: break-word;
}

.translation-import-preview-html :deep(:not(.w-e-image-group-img-body) > img),
.translation-import-preview-html
  :deep(:not(.w-e-image-group-img-body) > video) {
  max-width: 100%;
  height: auto;
}

.translation-import-preview-raw {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.translation-editor-action-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

.translation-editor-action-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.translation-editor-action-divider {
  width: 1px;
  min-height: 32px;
  background: var(--el-border-color);
}

.translation-editor-action-spacer {
  flex: 1 1 auto;
  min-width: 12px;
}

.translation-editor-action-group-save {
  margin-left: auto;
}

.translation-editor-action-group-save :deep(.el-button) {
  min-width: 112px;
}

@media (max-width: 767px) {
  .translation-post-editor-page {
    max-width: none;
  }

  :deep(.el-form-item) {
    display: block;
  }

  :deep(.el-form-item__label) {
    width: auto !important;
    justify-content: flex-start;
  }

  :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .relation-selected-name {
    max-width: calc(100vw - 150px);
  }

  .translation-json-toolbar,
  .translation-import-preview-columns {
    grid-template-columns: 1fr;
    display: grid;
  }

  .translation-editor-action-bar {
    align-items: stretch;
  }

  .translation-editor-action-divider,
  .translation-editor-action-spacer {
    display: none;
  }

  .translation-editor-action-group,
  .translation-editor-action-group-save {
    width: 100%;
  }

  .translation-editor-action-group {
    flex-direction: column;
    align-items: stretch;
  }

  .translation-editor-action-group-save {
    margin-left: 0;
  }

  .translation-editor-action-group :deep(.el-button) {
    width: 100%;
    margin: 0;
  }

  .translation-editor-action-group-save :deep(.el-button) {
    width: 100%;
  }

  .translation-json-group-header {
    flex-direction: column;
  }

  .translation-json-group-count {
    align-self: flex-start;
  }

  .translation-json-toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .ai-skipped-header,
  .ai-skipped-item {
    align-items: flex-start;
  }

  .ai-skipped-item {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
