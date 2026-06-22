<template>
  <div class="common-right-panel-form source-post-proper-noun-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item :to="{ name: 'SourcePostImport' }">
          源文章导入
        </el-breadcrumb-item>
        <el-breadcrumb-item>名词管理</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="source-post-term-header mb20">
      <div class="source-post-term-title-block">
        <div class="source-post-term-title">{{ sourcePostTitle }}</div>
        <div class="source-post-term-meta">{{ sourceId || '-' }}</div>
      </div>
      <div class="source-post-term-header-actions">
        <el-button @click="goBack">返回</el-button>
        <ProperNounInternetSearchButton
          button-text="联网检索"
          :term-ids="selectedTermIds"
          :default-language-codes="internetSearchDefaultLanguageCodes"
          :count="selectedTermIds.length"
          :disabled="selectedTermIds.length === 0"
          title="联网检索名词译名"
          @applied="handleInternetSearchApplied"
        />
        <el-button type="primary" plain @click="openOrganizeDialog">
          整理名词
        </el-button>
        <el-dropdown trigger="click" @command="handleImportExportCommand">
          <el-button type="primary" plain>
            导入导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">
                <el-icon><Upload /></el-icon>
                导出名词
              </el-dropdown-item>
              <el-dropdown-item command="template">
                <el-icon><Document /></el-icon>
                导出模板
              </el-dropdown-item>
              <el-dropdown-item divided command="import">
                <el-icon><Download /></el-icon>
                导入名词
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <input
          ref="importFileInputRef"
          type="file"
          accept=".json,application/json"
          class="source-post-term-import-input"
          @change="handleImportFileChange"
        />
      </div>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="source-post-term-search-form"
          @submit.prevent
          @keypress.enter="getTermList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.sourceTextKeyword"
              placeholder="原文名词"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="params.noteKeyword"
              placeholder="备注"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.languageCode"
              placeholder="译名语言"
              clearable
              filterable
              style="width: 180px"
            >
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.isStarred"
              placeholder="标星状态"
              clearable
              style="width: 130px"
            >
              <el-option label="已标星" value="true" />
              <el-option label="未标星" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getTermList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr source-post-term-actions">
        <div class="source-post-term-count">关联名词 {{ relationCount }}</div>
        <div class="source-post-term-action-buttons">
          <el-button @click="getTermList(false)">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button type="primary" plain @click="openBindExistingTermDialog">
            <el-icon><LinkIcon /></el-icon>
            绑定既有名词
          </el-button>
          <el-button type="primary" @click="openCreateTermDialog">
            <el-icon><Plus /></el-icon>
            新增名词
          </el-button>
        </div>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        v-loading="loading"
        :data="termList"
        row-key="_id"
        height="100%"
        border
        @selection-change="handleTermSelectionChange"
      >
        <ResponsiveTableColumn type="selection" width="48" reserve-selection />
        <ResponsiveTableColumn label="标星" width="84" align="center">
          <template #default="{ row }">
            <ProperNounStarButton
              :is-starred="isTermStarred(row)"
              :loading="starUpdatingId === row._id"
              :disabled="Boolean(starUpdatingId) && starUpdatingId !== row._id"
              @click="toggleTermStar(row)"
            />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="原文名词" min-width="240">
          <template #default="{ row }">
            <div class="source-post-term-source-text">
              {{ row.sourceText }}
            </div>
            <div
              v-if="row.relation?.relationSource"
              class="source-post-term-note"
            >
              {{ getRelationSourceText(row.relation.relationSource) }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="原文语言" width="140">
          <template #default="{ row }">
            <span>{{ getSourceLanguageText(row.sourceLanguageCode) }}</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="译名" min-width="280">
          <template #default="{ row }">
            <div
              v-if="getDisplayedTranslationItems(row).length > 0"
              class="source-post-term-translation-list"
            >
              <el-tag
                v-for="translation in getDisplayedTranslationItems(row)"
                :key="translation.displayKey"
                :type="getTranslationTagType(translation)"
                effect="plain"
              >
                {{ getTranslationTagText(translation) }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">暂无译名</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="备注" min-width="200">
          <template #default="{ row }">
            <div v-if="row.note" class="source-post-term-note-cell">
              {{ row.note }}
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="使用情况" width="180">
          <template #default="{ row }">
            <div class="source-post-term-usage">
              <div class="source-post-term-usage-count">
                {{ getCountText(row.usedCount) }} 次
              </div>
              <div class="source-post-term-usage-date">
                最后：{{ getLastUsedAtText(row.lastUsedAt) }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="关联时间" width="180">
          <template #default="{ row }">
            {{ getRelationUpdatedAtText(row) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="410" fixed="right">
          <template #default="{ row }">
            <div class="source-post-term-row-actions">
              <ProperNounInternetSearchButton
                button-text="联网检索"
                size="small"
                :term-ids="getRowTermIds(row)"
                :default-language-codes="internetSearchDefaultLanguageCodes"
                title="联网检索名词译名"
                @applied="handleInternetSearchApplied"
              />
              <el-button
                type="primary"
                size="small"
                @click="openTranslationDialog(row)"
              >
                译名
              </el-button>
              <el-button size="small" @click="openEditTermDialog(row)">
                编辑
              </el-button>
              <el-button size="small" @click="unbindTerm(row)">
                解绑
              </el-button>
              <el-button type="danger" size="small" @click="deleteTerm(row)">
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

    <el-dialog
      v-model="termDialogVisible"
      :title="termDialogTitle"
      width="min(680px, 96vw)"
      append-to-body
      destroy-on-close
    >
      <el-form
        :model="termForm"
        label-width="120px"
        class="source-post-term-form"
      >
        <el-form-item label="原文名词" required>
          <el-input
            v-model="termForm.sourceText"
            maxlength="300"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="原文语言">
          <el-select
            v-model="termForm.sourceLanguageCode"
            clearable
            filterable
            class="w_10"
            placeholder="可不指定"
          >
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="termForm.note" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="termDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="termSaving" @click="submitTerm">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="bindDialogVisible"
      title="绑定既有名词"
      width="min(1040px, 96vw)"
      append-to-body
      destroy-on-close
      @closed="clearBindTermSelection"
    >
      <div class="source-post-term-bind-toolbar common-top-search-form-body">
        <el-form
          :inline="true"
          :model="bindParams"
          class="source-post-term-bind-search-form"
          @submit.prevent
          @keypress.enter="getBindableTermList(true)"
        >
          <el-form-item>
            <el-input
              v-model="bindParams.sourceTextKeyword"
              placeholder="原文名词"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item>
            <el-input
              v-model="bindParams.noteKeyword"
              placeholder="备注"
              clearable
              style="width: 180px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="bindParams.languageCode"
              placeholder="译名语言"
              clearable
              filterable
              style="width: 180px"
            >
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="bindParams.isStarred"
              placeholder="标星状态"
              clearable
              style="width: 130px"
            >
              <el-option label="已标星" value="true" />
              <el-option label="未标星" value="false" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getBindableTermList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <ResponsiveTable
        ref="bindTableRef"
        v-loading="bindLoading"
        :data="bindTermList"
        row-key="_id"
        max-height="420"
        border
        @selection-change="handleBindTermSelectionChange"
      >
        <ResponsiveTableColumn
          type="selection"
          width="48"
          reserve-selection
          :selectable="isBindableTermSelectable"
        />
        <ResponsiveTableColumn label="原文名词" min-width="240">
          <template #default="{ row }">
            <div class="source-post-term-source-text">
              {{ row.sourceText }}
            </div>
            <el-tag
              v-if="isTermBoundToSourcePost(row)"
              class="source-post-term-bound-tag"
              type="success"
              effect="plain"
            >
              已绑定
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="原文语言" width="140">
          <template #default="{ row }">
            <span>{{ getSourceLanguageText(row.sourceLanguageCode) }}</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="译名" min-width="280">
          <template #default="{ row }">
            <div
              v-if="getBindDisplayedTranslationItems(row).length > 0"
              class="source-post-term-translation-list"
            >
              <el-tag
                v-for="translation in getBindDisplayedTranslationItems(row)"
                :key="translation.displayKey"
                :type="getTranslationTagType(translation)"
                effect="plain"
              >
                {{ getTranslationTagText(translation) }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">暂无译名</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="备注" min-width="200">
          <template #default="{ row }">
            <div v-if="row.note" class="source-post-term-note-cell">
              {{ row.note }}
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="使用情况" width="180">
          <template #default="{ row }">
            <div class="source-post-term-usage">
              <div class="source-post-term-usage-count">
                {{ getCountText(row.usedCount) }} 次
              </div>
              <div class="source-post-term-usage-date">
                最后：{{ getLastUsedAtText(row.lastUsedAt) }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>

      <div class="source-post-term-bind-pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="bindTotal"
          :pager-count="5"
          size="small"
          v-model:current-page="bindParams.page"
          v-model:page-size="bindParams.limit"
        />
      </div>

      <template #footer>
        <div class="source-post-term-bind-footer">
          <div class="source-post-term-bind-selected-count">
            已选择 {{ selectedBindableTermIds.length }} 个
          </div>
          <div class="source-post-term-bind-footer-actions">
            <el-button @click="bindDialogVisible = false">取消</el-button>
            <el-button
              type="primary"
              :disabled="selectedBindableTermIds.length === 0"
              :loading="bindSaving"
              @click="bindSelectedTerms"
            >
              绑定
              <span v-if="selectedBindableTermIds.length > 0">
                {{ selectedBindableTermIds.length }}
              </span>
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="translationDialogVisible"
      title="译名管理"
      width="min(920px, 96vw)"
      append-to-body
      align-center
      destroy-on-close
    >
      <div v-if="activeTerm" class="source-post-term-translation-header">
        <div class="source-post-term-source-text">
          {{ activeTerm.sourceText }}
        </div>
        <el-button
          type="primary"
          size="small"
          @click="openCreateTranslationDialog()"
        >
          <el-icon><Plus /></el-icon>
          新增译名
        </el-button>
      </div>
      <ResponsiveTable
        v-loading="translationLoading"
        :data="translationDisplayList"
        row-key="_id"
        border
      >
        <ResponsiveTableColumn label="语言" width="150">
          <template #default="{ row }">
            {{ row.languageLabel || getLanguageText(row.languageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="译名" min-width="220">
          <template #default="{ row }">
            <el-tag
              v-if="row.isMissingTranslation"
              type="danger"
              effect="plain"
            >
              缺少译名
            </el-tag>
            <template v-else>
              <div class="source-post-term-source-text">
                {{ row.translatedText }}
              </div>
              <div v-if="row.note" class="source-post-term-note">
                {{ row.note }}
              </div>
            </template>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="来源" width="150">
          <template #default="{ row }">
            <span v-if="row.isMissingTranslation" class="table-empty-text">
              -
            </span>
            <el-tag v-else effect="plain">
              {{ getTranslationSourceText(row.translationSource) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="使用情况" width="170">
          <template #default="{ row }">
            <span v-if="row.isMissingTranslation" class="table-empty-text">
              -
            </span>
            <div v-else class="source-post-term-usage">
              <div class="source-post-term-usage-count">
                {{ getCountText(row.usedCount) }} 次
              </div>
              <div class="source-post-term-usage-date">
                最后：{{ getLastUsedAtText(row.lastUsedAt) }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.isMissingTranslation"
              type="primary"
              size="small"
              @click="openCreateTranslationDialog(row.languageCode)"
            >
              添加译名
            </el-button>
            <template v-else>
              <el-button size="small" @click="openEditTranslationDialog(row)">
                编辑
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="deleteTranslation(row)"
              >
                删除
              </el-button>
            </template>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </el-dialog>

    <el-dialog
      v-model="translationEditDialogVisible"
      :title="translationDialogTitle"
      width="min(620px, 96vw)"
      append-to-body
      destroy-on-close
    >
      <el-form
        :model="translationForm"
        label-width="120px"
        class="source-post-term-form"
      >
        <el-form-item label="语言" required>
          <el-select
            v-model="translationForm.languageCode"
            class="w_10"
            filterable
            :disabled="translationMode === 'edit'"
          >
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="译名" required>
          <el-input
            v-model="translationForm.translatedText"
            maxlength="300"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="translationForm.note" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="translationEditDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="translationSaving"
          @click="submitTranslation"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <SourcePostTermOrganizeDialog
      v-model="organizeDialogVisible"
      :source-post="sourcePost"
      @created="getTermList(false)"
    />

    <el-dialog
      v-model="exportDialogVisible"
      :title="exportDialogTitle"
      width="min(560px, 96vw)"
      append-to-body
      destroy-on-close
    >
      <el-form label-width="100px" class="source-post-term-export-form">
        <el-form-item label="译名语言" required>
          <el-select
            v-model="exportLanguageCodes"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择要导出的译名语言"
            style="width: 100%"
          >
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <div class="source-post-term-export-tip">
          未维护译名的语言会导出为 null，可作为待填写模板使用。
        </div>
      </el-form>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="exporting" @click="confirmExport">
          {{ exportConfirmButtonText }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importPreviewDialogVisible"
      title="导入预览"
      width="min(880px, 96vw)"
      append-to-body
      destroy-on-close
      :show-close="!importing"
      :close-on-click-modal="false"
      :close-on-press-escape="!importing"
      :before-close="handleImportPreviewBeforeClose"
    >
      <div
        v-loading="importPreviewLoading"
        class="source-post-term-import-preview"
      >
        <el-alert
          v-if="importCrossArticleNote"
          :title="importCrossArticleNote"
          type="warning"
          :closable="false"
          show-icon
          class="mb10"
        />
        <div
          v-if="importPreviewData"
          class="source-post-term-import-preview-summary"
        >
          共 {{ importPreviewData.totalCount }} 个名词，其中新增
          <span class="source-post-term-import-create-count">
            {{ importPreviewData.createCount }}
          </span>
          个，修改
          <span class="source-post-term-import-update-count">
            {{ importPreviewData.updateCount }}
          </span>
          个，无变化
          <span class="source-post-term-import-unchanged-count">
            {{ importPreviewData.unchangedCount }}
          </span>
          个。
        </div>
        <div
          v-if="importPreviewData && !importProgressVisible"
          class="source-post-term-import-preview-toolbar"
        >
          <el-button size="small" @click="selectAllImport">全选</el-button>
          <el-button size="small" @click="clearAllImport">清空</el-button>
          <span class="source-post-term-import-selected-count">
            已选择 {{ selectedImportCount }} 个名词将导入
          </span>
        </div>
        <div
          v-if="importPreviewData"
          class="source-post-term-import-preview-list"
        >
          <div
            v-for="term in importPreviewData.terms"
            :key="term.index"
            class="source-post-term-import-preview-item"
          >
            <div class="source-post-term-import-preview-item-head">
              <el-checkbox
                v-if="isImportTermSelectable(term)"
                :model-value="getImportTermChecked(term)"
                :indeterminate="getImportTermIndeterminate(term)"
                @change="value => handleImportTermCheckedChange(term, value)"
              />
              <el-tag
                size="small"
                :type="getPreviewTermActionType(term.action)"
                effect="dark"
              >
                {{ getPreviewTermActionText(term.action) }}
              </el-tag>
              <span class="source-post-term-import-preview-source-text">
                {{ term.sourceText }}
              </span>
              <span
                v-if="term.sourceLanguageCode"
                class="source-post-term-import-preview-lang"
              >
                {{ getSourceLanguageText(term.sourceLanguageCode) }}
              </span>
              <el-tag
                v-if="term.action !== 'create' && term.alreadyBound"
                size="small"
                type="info"
                effect="plain"
              >
                已关联
              </el-tag>
              <el-tag
                v-if="term.action !== 'create' && !term.alreadyBound"
                size="small"
                type="success"
                effect="plain"
              >
                将关联
              </el-tag>
            </div>
            <div
              v-if="term.isNewTerm"
              class="source-post-term-import-preview-leaf-block"
            >
              <el-checkbox v-model="term.createSelected">
                新增名词并关联到本文章
              </el-checkbox>
              <div
                v-if="term.note"
                class="source-post-term-import-preview-note"
              >
                备注：
                <span class="source-post-term-import-new">
                  {{ getPreviewDisplayText(term.note) }}
                </span>
              </div>
            </div>
            <div
              v-else-if="term.isBindOnly"
              class="source-post-term-import-preview-leaf-block"
            >
              <el-checkbox v-model="term.bindSelected">
                关联到本文章
              </el-checkbox>
            </div>
            <div
              v-else-if="term.termInfoChanged"
              class="source-post-term-import-preview-leaf-block"
            >
              <el-checkbox v-model="term.termInfoSelected">
                名词信息
              </el-checkbox>
              <div
                v-if="term.sourceTextChanged"
                class="source-post-term-import-preview-note"
              >
                原文：
                <span class="source-post-term-import-old">
                  {{ getPreviewDisplayText(term.previousSourceText) }}
                </span>
                →
                <span class="source-post-term-import-new">
                  {{ getPreviewDisplayText(term.sourceText) }}
                </span>
              </div>
              <div
                v-if="term.sourceLanguageCodeChanged"
                class="source-post-term-import-preview-note"
              >
                原文语言：
                <span class="source-post-term-import-old">
                  {{ getSourceLanguageText(term.previousSourceLanguageCode) }}
                </span>
                →
                <span class="source-post-term-import-new">
                  {{ getSourceLanguageText(term.sourceLanguageCode) }}
                </span>
              </div>
              <div
                v-if="term.noteChanged"
                class="source-post-term-import-preview-note"
              >
                备注：
                <span class="source-post-term-import-old">
                  {{ getPreviewDisplayText(term.previousNote) }}
                </span>
                →
                <span class="source-post-term-import-new">
                  {{ getPreviewDisplayText(term.note) }}
                </span>
              </div>
            </div>
            <div
              v-if="term.translations.length > 0"
              class="source-post-term-import-preview-translations"
            >
              <div
                v-for="translation in term.translations"
                :key="translation.languageCode"
                class="source-post-term-import-preview-translation"
              >
                <el-tag
                  size="small"
                  :type="getPreviewTranslationActionType(translation.action)"
                  effect="plain"
                >
                  {{ getPreviewLanguageText(translation.languageCode) }}·{{
                    getPreviewTranslationActionText(translation.action)
                  }}
                </el-tag>
                <div class="source-post-term-import-preview-translation-body">
                  <div class="source-post-term-import-preview-translation-line">
                    <el-checkbox
                      v-if="translation.textChanged"
                      v-model="translation.textSelected"
                      class="source-post-term-import-leaf-checkbox"
                    >
                      译名
                    </el-checkbox>
                    <span
                      v-if="
                        translation.textChanged &&
                        translation.action === 'update'
                      "
                      class="source-post-term-import-preview-translation-diff"
                    >
                      <span class="source-post-term-import-old">
                        {{
                          getPreviewDisplayText(
                            translation.previousTranslatedText
                          )
                        }}
                      </span>
                      →
                      <span class="source-post-term-import-new">
                        {{ getPreviewDisplayText(translation.translatedText) }}
                      </span>
                    </span>
                    <span
                      v-else-if="translation.textChanged"
                      class="source-post-term-import-new"
                    >
                      {{ getPreviewDisplayText(translation.translatedText) }}
                    </span>
                    <span
                      v-else
                      class="source-post-term-import-preview-translation-same"
                    >
                      {{ getPreviewDisplayText(translation.translatedText) }}
                    </span>
                  </div>
                  <div
                    v-if="translation.noteChanged"
                    class="source-post-term-import-preview-translation-line"
                  >
                    <el-checkbox
                      v-model="translation.noteSelected"
                      class="source-post-term-import-leaf-checkbox"
                    >
                      注释
                    </el-checkbox>
                    <span
                      v-if="translation.action === 'update'"
                      class="source-post-term-import-preview-translation-diff"
                    >
                      <span class="source-post-term-import-old">
                        {{ getPreviewDisplayText(translation.previousNote) }}
                      </span>
                      →
                      <span class="source-post-term-import-new">
                        {{ getPreviewDisplayText(translation.note) }}
                      </span>
                    </span>
                    <span v-else class="source-post-term-import-new">
                      {{ getPreviewDisplayText(translation.note) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else-if="
                !term.isNewTerm && !term.isBindOnly && !term.termInfoChanged
              "
              class="source-post-term-import-preview-empty"
            >
              暂无译名
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="importProgressVisible"
        class="source-post-term-import-progress"
      >
        <el-progress :percentage="importProgressPercent" :stroke-width="14" />
        <div class="source-post-term-import-progress-text">
          正在导入 {{ importProgress.processedCount }} /
          {{ importProgress.totalCount }}（新增
          {{ importProgress.createdCount }}，修改
          {{ importProgress.updatedCount }}）
        </div>
      </div>
      <template #footer>
        <el-button
          :disabled="importing"
          @click="importPreviewDialogVisible = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="
            importPreviewLoading ||
            !importPreviewData ||
            selectedImportCount === 0
          "
          @click="confirmImport"
        >
          确认导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  Document,
  Download,
  Link as LinkIcon,
  Plus,
  Refresh,
  Upload
} from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'
import store from '@/store'
import { createApiErrorFromResponse } from '@/utils/apiError'
import { isAbortError, readClientSseStream } from '@/utils/clientSse'
import { formatDate } from '@/utils/utils'
import {
  restoreListSessionParams,
  saveListSessionParams
} from '@/composables/useListSessionParams'
import {
  getLanguageText,
  getPostDisplayTitle,
  SUPPORTED_LANGUAGE_OPTIONS
} from '@/utils/multilingual'
import { buildProperNounTranslationDisplayItems } from '@/utils/properNounTranslation'
import ProperNounInternetSearchButton from '@/components/ProperNounInternetSearchButton.vue'
import ProperNounStarButton from '@/components/ProperNounStarButton.vue'
import SourcePostTermOrganizeDialog from './SourcePostTermOrganizeDialog.vue'

const TRANSLATION_SOURCE_TEXT_MAP = {
  manual: '手动维护',
  internetSearchAi: '联网检索',
  aiKnowledgeBase: 'AI知识库',
  imported: '导入'
}

const RELATION_SOURCE_TEXT_MAP = {
  manual: '手动关联',
  aiOrganize: '文章名词整理',
  translationWorkflow: '翻译工作流'
}

function getInitialTermForm() {
  return {
    id: '',
    sourceText: '',
    sourceLanguageCode: '',
    note: ''
  }
}

function getInitialTranslationForm() {
  return {
    id: '',
    termId: '',
    languageCode: 'zh-CN',
    translatedText: '',
    note: ''
  }
}

function getInitialBindParams() {
  return {
    page: 1,
    limit: 20,
    sourceTextKeyword: '',
    noteKeyword: '',
    languageCode: '',
    isStarred: ''
  }
}

export default {
  name: 'SourcePostProperNounList',
  components: {
    LinkIcon,
    Plus,
    Refresh,
    ArrowDown,
    Document,
    Download,
    Upload,
    ProperNounInternetSearchButton,
    ProperNounStarButton,
    SourcePostTermOrganizeDialog
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const tableRef = ref(null)
    const bindTableRef = ref(null)
    const importFileInputRef = ref(null)
    const importing = ref(false)
    const importPreviewDialogVisible = ref(false)
    const importPreviewLoading = ref(false)
    const importPreviewData = ref(null)
    const pendingImportTerms = ref([])
    const importCrossArticleNote = ref('')
    const importProgressVisible = ref(false)
    const importProgress = ref({
      processedCount: 0,
      totalCount: 0,
      createdCount: 0,
      updatedCount: 0
    })
    const exportDialogVisible = ref(false)
    const exportMode = ref('export')
    const exportLanguageCodes = ref([])
    const exporting = ref(false)
    const loading = ref(false)
    const termList = ref([])
    const total = ref(0)
    const relationCount = ref(0)
    const sourcePost = ref(null)
    const selectedTermRows = ref([])
    const starUpdatingId = ref('')
    const organizeDialogVisible = ref(false)
    const bindDialogVisible = ref(false)
    const bindLoading = ref(false)
    const bindSaving = ref(false)
    const bindTermList = ref([])
    const bindTotal = ref(0)
    const selectedBindTermRows = ref([])
    const params = reactive({
      page: 1,
      limit: 20,
      sourceTextKeyword: '',
      noteKeyword: '',
      languageCode: '',
      isStarred: ''
    })
    const bindParams = reactive(getInitialBindParams())

    const termDialogVisible = ref(false)
    const termSaving = ref(false)
    const termMode = ref('create')
    const termForm = reactive(getInitialTermForm())

    const translationDialogVisible = ref(false)
    const translationEditDialogVisible = ref(false)
    const translationLoading = ref(false)
    const translationSaving = ref(false)
    const translationMode = ref('create')
    const activeTerm = ref(null)
    const translationList = ref([])
    const translationForm = reactive(getInitialTranslationForm())

    const languageOptions = SUPPORTED_LANGUAGE_OPTIONS
    const sourceId = computed(() => {
      return String(route.query.sourceId || route.params.sourceId || '').trim()
    })
    const listSessionKey = computed(() => {
      return `${route.name}:${sourceId.value}`
    })
    const sourcePostTitle = computed(() => {
      const title = getPostDisplayTitle(sourcePost.value)
      if (title && title !== '-') {
        return title
      }
      return sourceId.value || '-'
    })
    const termDialogTitle = computed(() => {
      if (termMode.value === 'edit') {
        return '编辑名词'
      }
      return '新增名词'
    })
    const translationDialogTitle = computed(() => {
      if (translationMode.value === 'edit') {
        return '编辑译名'
      }
      return '新增译名'
    })
    const exportDialogTitle = computed(() => {
      if (exportMode.value === 'template') {
        return '导出名词模板'
      }
      return '导出名词'
    })
    const exportConfirmButtonText = computed(() => {
      if (exportMode.value === 'template') {
        return '导出模板'
      }
      return '导出名词'
    })
    const importProgressPercent = computed(() => {
      const totalCount = importProgress.value.totalCount
      if (!totalCount) {
        return 0
      }
      const percent = Math.round(
        (importProgress.value.processedCount / totalCount) * 100
      )
      return Math.min(100, Math.max(0, percent))
    })
    const selectedImportCount = computed(() => {
      const data = importPreviewData.value
      if (!data || !Array.isArray(data.terms)) {
        return 0
      }
      let count = 0
      data.terms.forEach(term => {
        if (isImportTermIncluded(term)) {
          count += 1
        }
      })
      return count
    })
    const selectedTermIds = computed(() => {
      const idList = []
      selectedTermRows.value.forEach(row => {
        const id = String(row?._id || '')
        if (!id || idList.includes(id)) {
          return
        }
        idList.push(id)
      })
      return idList
    })
    const selectedBindableTermIds = computed(() => {
      const idList = []
      selectedBindTermRows.value.forEach(row => {
        if (!isBindableTermSelectable(row)) {
          return
        }
        const id = String(row?._id || '')
        if (!id || idList.includes(id)) {
          return
        }
        idList.push(id)
      })
      return idList
    })
    const internetSearchDefaultLanguageCodes = computed(() => {
      if (params.languageCode) {
        return [params.languageCode]
      }
      return []
    })
    const translationDisplayList = computed(() => {
      return buildProperNounTranslationDisplayItems({
        translations: translationList.value,
        languageOptions,
        sourceLanguageCode: activeTerm.value?.sourceLanguageCode
      })
    })

    function assignReactive(target, source) {
      Object.keys(target).forEach(key => {
        target[key] = source[key]
      })
    }

    function restoreTermListParams() {
      assignReactive(params, {
        page: 1,
        limit: 20,
        sourceTextKeyword: '',
        noteKeyword: '',
        languageCode: '',
        isStarred: ''
      })
      restoreListSessionParams(route, params, [], listSessionKey.value)
    }

    function getRequestParams() {
      const requestParams = {
        sourceId: sourceId.value,
        page: params.page,
        limit: params.limit
      }
      if (params.sourceTextKeyword) {
        requestParams.sourceTextKeyword = params.sourceTextKeyword
      }
      if (params.noteKeyword) {
        requestParams.noteKeyword = params.noteKeyword
      }
      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }
      if (params.isStarred !== '') {
        requestParams.isStarred = params.isStarred
      }
      return requestParams
    }

    function getBindRequestParams() {
      const requestParams = {
        sourceId: sourceId.value,
        page: bindParams.page,
        limit: bindParams.limit
      }
      if (bindParams.sourceTextKeyword) {
        requestParams.sourceTextKeyword = bindParams.sourceTextKeyword
      }
      if (bindParams.noteKeyword) {
        requestParams.noteKeyword = bindParams.noteKeyword
      }
      if (bindParams.languageCode) {
        requestParams.languageCode = bindParams.languageCode
      }
      if (bindParams.isStarred !== '') {
        requestParams.isStarred = bindParams.isStarred
      }
      return requestParams
    }

    function getTermList(resetPage = false) {
      if (!sourceId.value) {
        return
      }
      if (resetPage === true) {
        clearTermSelection()
      }
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }
      loading.value = true
      multilingualApi
        .getSourcePostProperNounTermList(getRequestParams(), true)
        .then(response => {
          const data = response.data.data || {}
          sourcePost.value = data.sourcePost || null
          termList.value = data.list || []
          total.value = data.total || 0
          relationCount.value = data.relationCount || 0
          saveListSessionParams(route, params, listSessionKey.value)
        })
        .finally(() => {
          loading.value = false
        })
    }

    function getBindableTermList(resetPage = false) {
      if (!sourceId.value || !bindDialogVisible.value) {
        return
      }
      if (resetPage === true) {
        clearBindTermSelection()
      }
      if (resetPage === true && bindParams.page !== 1) {
        bindParams.page = 1
        return
      }
      bindLoading.value = true
      multilingualApi
        .getProperNounTermList(getBindRequestParams(), true)
        .then(response => {
          const data = response.data.data || {}
          bindTermList.value = data.list || []
          bindTotal.value = data.total || 0
          selectedBindTermRows.value = selectedBindTermRows.value.filter(
            row => {
              return isBindableTermSelectable(row)
            }
          )
        })
        .finally(() => {
          bindLoading.value = false
        })
    }

    function preserveTableScrollForNextRefresh() {
      tableRef.value?.preserveScrollOnNextDataRefresh()
    }

    function resetTermForm() {
      assignReactive(termForm, getInitialTermForm())
    }

    function openCreateTermDialog() {
      resetTermForm()
      termMode.value = 'create'
      termDialogVisible.value = true
    }

    function openEditTermDialog(row) {
      resetTermForm()
      termMode.value = 'edit'
      assignReactive(termForm, {
        id: row._id,
        sourceText: row.sourceText || '',
        sourceLanguageCode: row.sourceLanguageCode || '',
        note: row.note || ''
      })
      termDialogVisible.value = true
    }

    function resetBindParams() {
      assignReactive(bindParams, getInitialBindParams())
    }

    function openBindExistingTermDialog() {
      resetBindParams()
      bindTermList.value = []
      bindTotal.value = 0
      selectedBindTermRows.value = []
      bindDialogVisible.value = true
      getBindableTermList(false)
    }

    function submitTerm() {
      termSaving.value = true
      let request = null
      if (termMode.value === 'edit') {
        request = multilingualApi.updateProperNounTerm({ ...termForm })
      } else {
        request = multilingualApi.createSourcePostProperNounTerm({
          ...termForm,
          sourceId: sourceId.value
        })
      }
      request
        .then(() => {
          ElMessage.success('名词已保存')
          termDialogVisible.value = false
          if (termMode.value === 'edit') {
            preserveTableScrollForNextRefresh()
          }
          getTermList(false)
        })
        .finally(() => {
          termSaving.value = false
        })
    }

    async function unbindTerm(row) {
      const relationId = row.relation?._id
      if (!relationId) {
        ElMessage.warning('文章名词关联不存在')
        return
      }
      try {
        await ElMessageBox.confirm(
          `确认将“${row.sourceText}”与该文章解绑？`,
          '解绑名词',
          {
            type: 'warning',
            confirmButtonText: '解绑',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      multilingualApi
        .unbindSourcePostProperNounTerm({ id: relationId }, true)
        .then(() => {
          ElMessage.success('名词已解绑')
          clearTermSelection()
          getTermList(false)
        })
    }

    async function deleteTerm(row) {
      try {
        await ElMessageBox.confirm(
          `确认删除“${row.sourceText}”及其所有译名？`,
          '删除名词',
          {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      multilingualApi.deleteProperNounTerm({ id: row._id }, true).then(() => {
        ElMessage.success('名词已删除')
        clearTermSelection()
        getTermList(false)
      })
    }

    function handleTermSelectionChange(selection) {
      if (!Array.isArray(selection)) {
        selectedTermRows.value = []
        return
      }
      selectedTermRows.value = selection
    }

    function clearTermSelection() {
      selectedTermRows.value = []
      tableRef.value?.clearSelection()
    }

    function clearBindTermSelection() {
      selectedBindTermRows.value = []
      bindTableRef.value?.clearSelection()
    }

    function isTermBoundToSourcePost(row) {
      return row?.isBoundToSourcePost === true
    }

    function isBindableTermSelectable(row) {
      return !isTermBoundToSourcePost(row)
    }

    function handleBindTermSelectionChange(selection) {
      if (!Array.isArray(selection)) {
        selectedBindTermRows.value = []
        return
      }
      selectedBindTermRows.value = selection.filter(row => {
        return isBindableTermSelectable(row)
      })
    }

    async function bindSelectedTerms() {
      const termIds = selectedBindableTermIds.value
      if (termIds.length === 0) {
        ElMessage.warning('请选择可绑定的名词')
        return
      }

      bindSaving.value = true
      try {
        const response =
          await multilingualApi.batchBindSourcePostProperNounTerms(
            {
              sourceId: sourceId.value,
              termIds
            },
            true
          )
        const data = response.data.data || {}
        let boundCount = termIds.length
        if (typeof data.boundCount === 'number') {
          boundCount = data.boundCount
        }
        if (boundCount > 0) {
          ElMessage.success(`已绑定 ${boundCount} 个名词`)
        } else {
          ElMessage.warning('所选名词已绑定')
        }
        bindDialogVisible.value = false
        clearBindTermSelection()
        preserveTableScrollForNextRefresh()
        getTermList(false)
      } finally {
        bindSaving.value = false
      }
    }

    function isTermStarred(row) {
      return row?.isStarred === true
    }

    async function toggleTermStar(row) {
      const id = String(row?._id || '')
      if (!id || starUpdatingId.value) {
        return
      }

      const isStarred = !isTermStarred(row)
      starUpdatingId.value = id
      try {
        const response = await multilingualApi.updateProperNounTermStar(
          { id, isStarred },
          true
        )
        const data = response.data.data || {}
        const term = data.term || {}
        row.isStarred = term.isStarred === true
        ElMessage.success(isStarred ? '名词已标星' : '名词已取消标星')
        if (params.isStarred !== '') {
          getTermList(false)
        }
      } finally {
        starUpdatingId.value = ''
      }
    }

    function openTranslationDialog(row) {
      activeTerm.value = row
      translationDialogVisible.value = true
      getTranslationList()
    }

    function getTranslationList() {
      if (!activeTerm.value) {
        return
      }
      translationLoading.value = true
      multilingualApi
        .getProperNounTranslationList({ termId: activeTerm.value._id }, true)
        .then(response => {
          const data = response.data.data || {}
          translationList.value = data.list || []
        })
        .finally(() => {
          translationLoading.value = false
        })
    }

    function resetTranslationForm() {
      assignReactive(translationForm, getInitialTranslationForm())
      if (activeTerm.value) {
        translationForm.termId = activeTerm.value._id
      }
    }

    function openCreateTranslationDialog(languageCode = '') {
      resetTranslationForm()
      translationMode.value = 'create'
      let selectedLanguageCode = ''
      if (typeof languageCode === 'string') {
        selectedLanguageCode = languageCode.trim()
      }
      if (selectedLanguageCode) {
        translationForm.languageCode = selectedLanguageCode
      }
      translationEditDialogVisible.value = true
    }

    function openEditTranslationDialog(row) {
      resetTranslationForm()
      translationMode.value = 'edit'
      assignReactive(translationForm, {
        id: row._id,
        termId: row.termId,
        languageCode: row.languageCode,
        translatedText: row.translatedText || '',
        note: row.note || ''
      })
      translationEditDialogVisible.value = true
    }

    function submitTranslation() {
      const requestData = { ...translationForm }
      translationSaving.value = true
      let request = null
      if (translationMode.value === 'edit') {
        request = multilingualApi.updateProperNounTranslation(requestData)
      } else {
        request = multilingualApi.createProperNounTranslation(requestData)
      }
      request
        .then(() => {
          ElMessage.success('译名已保存')
          translationEditDialogVisible.value = false
          getTranslationList()
          if (translationMode.value === 'edit') {
            preserveTableScrollForNextRefresh()
          }
          getTermList(false)
        })
        .finally(() => {
          translationSaving.value = false
        })
    }

    async function deleteTranslation(row) {
      try {
        await ElMessageBox.confirm(
          `确认删除“${getLanguageText(row.languageCode)}：${row.translatedText}”？`,
          '删除译名',
          {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      multilingualApi
        .deleteProperNounTranslation({ id: row._id }, true)
        .then(() => {
          ElMessage.success('译名已删除')
          getTranslationList()
          getTermList(false)
        })
    }

    function openOrganizeDialog() {
      organizeDialogVisible.value = true
    }

    function downloadJsonFile(data, fileName) {
      const jsonText = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonText], {
        type: 'application/json;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    function buildExportFileName(templateOnly) {
      if (templateOnly === true) {
        return 'source-post-proper-noun-template.json'
      }
      const idText = sourceId.value || 'unknown'
      return `source-post-proper-noun-${idText}.json`
    }

    function exportProperNounTerms(templateOnly, languageCodes) {
      if (templateOnly !== true && !sourceId.value) {
        ElMessage.warning('未找到源文章信息')
        return
      }
      const requestParams = {
        languageCodes
      }
      if (templateOnly === true) {
        requestParams.templateOnly = true
      } else {
        requestParams.sourceId = sourceId.value
      }
      exporting.value = true
      multilingualApi
        .exportSourcePostProperNounTerms(requestParams)
        .then(response => {
          const data = response.data.data || {}
          downloadJsonFile(data, buildExportFileName(templateOnly))
          exportDialogVisible.value = false
          if (templateOnly === true) {
            ElMessage.success('已导出名词导入模板')
            return
          }
          const exportedTermCount = Array.isArray(data.terms)
            ? data.terms.length
            : 0
          ElMessage.success(`已导出 ${exportedTermCount} 个名词`)
        })
        .finally(() => {
          exporting.value = false
        })
    }

    function getDefaultExportLanguageCodes() {
      if (params.languageCode) {
        return [params.languageCode]
      }
      return languageOptions.map(item => item.value)
    }

    function openExportDialog(mode) {
      if (mode !== 'template' && !sourceId.value) {
        ElMessage.warning('未找到源文章信息')
        return
      }
      exportMode.value = mode
      exportLanguageCodes.value = getDefaultExportLanguageCodes()
      exportDialogVisible.value = true
    }

    function confirmExport() {
      if (exportLanguageCodes.value.length === 0) {
        ElMessage.warning('请至少选择一种译名语言')
        return
      }
      exportProperNounTerms(
        exportMode.value === 'template',
        exportLanguageCodes.value
      )
    }

    function triggerImportFile() {
      if (!sourceId.value) {
        ElMessage.warning('未找到源文章信息')
        return
      }
      const inputElement = importFileInputRef.value
      if (!inputElement) {
        return
      }
      inputElement.value = ''
      inputElement.click()
    }

    function parseImportTermList(parsedContent) {
      if (Array.isArray(parsedContent)) {
        return parsedContent
      }
      if (parsedContent && Array.isArray(parsedContent.terms)) {
        return parsedContent.terms
      }
      return null
    }

    function handleImportStreamEvent(eventData, resultRef) {
      const data = eventData.data || {}
      if (eventData.eventName === 'progress') {
        importProgress.value = {
          processedCount: data.processedCount || 0,
          totalCount: data.totalCount || 0,
          createdCount: data.createdCount || 0,
          updatedCount: data.updatedCount || 0
        }
        return
      }
      if (eventData.eventName === 'result') {
        resultRef.data = data
        return
      }
      if (eventData.eventName === 'error') {
        throw new Error(data.message || '导入失败')
      }
    }

    async function requestImportStream(termList) {
      const response = await fetch(
        '/api/multilingual-admin/source/post/proper-noun/import/stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${store.getters.adminToken}`
          },
          body: JSON.stringify({
            sourceId: sourceId.value,
            terms: termList
          })
        }
      )
      if (!response.ok) {
        throw await createApiErrorFromResponse(response, '导入请求失败')
      }
      const resultRef = { data: null }
      await readClientSseStream(response, eventData => {
        handleImportStreamEvent(eventData, resultRef)
      })
      return resultRef.data
    }

    async function startImport(termList) {
      importing.value = true
      importProgressVisible.value = true
      importProgress.value = {
        processedCount: 0,
        totalCount: termList.length,
        createdCount: 0,
        updatedCount: 0
      }
      try {
        const data = await requestImportStream(termList)
        if (!data) {
          throw new Error('导入没有返回结果')
        }
        ElMessage.success(
          `导入完成：新增 ${data.createdCount || 0} 个，修改 ${
            data.updatedCount || 0
          } 个，新增关联 ${data.boundCount || 0} 个，跳过 ${
            data.skippedCount || 0
          } 个`
        )
        importPreviewDialogVisible.value = false
        pendingImportTerms.value = []
        getTermList(false)
      } catch (error) {
        if (!isAbortError(error)) {
          ElMessage.error(error.message || '导入失败')
        }
      } finally {
        importing.value = false
        importProgressVisible.value = false
      }
    }

    function openImportPreview(termList, parsedContent) {
      pendingImportTerms.value = termList
      importCrossArticleNote.value = ''
      const fileSourceId = String(
        (parsedContent && parsedContent.sourceId) || ''
      ).trim()
      if (fileSourceId && fileSourceId !== sourceId.value) {
        const fileSourceTitle = String(
          (parsedContent && parsedContent.sourcePostTitle) || ''
        ).trim()
        const fileSourceLabel = fileSourceTitle || fileSourceId
        importCrossArticleNote.value = `该文件导出自另一篇文章「${fileSourceLabel}」，导入后将关联到当前文章。`
      }
      importPreviewData.value = null
      importPreviewLoading.value = true
      importPreviewDialogVisible.value = true
      multilingualApi
        .previewImportSourcePostProperNounTerms({
          sourceId: sourceId.value,
          terms: termList
        })
        .then(response => {
          const data = response.data.data || null
          if (data) {
            initImportSelection(data)
          }
          importPreviewData.value = data
        })
        .catch(() => {
          importPreviewDialogVisible.value = false
          pendingImportTerms.value = []
        })
        .finally(() => {
          importPreviewLoading.value = false
        })
    }

    function confirmImport() {
      const selectedTerms = buildSelectedImportTerms()
      if (selectedTerms.length === 0) {
        ElMessage.warning('请至少选择一项要导入的内容')
        return
      }
      startImport(selectedTerms)
    }

    function handleImportPreviewBeforeClose(done) {
      if (importing.value) {
        return
      }
      done()
    }

    function initImportSelection(data) {
      if (!data || !Array.isArray(data.terms)) {
        return
      }
      data.terms.forEach(term => {
        term.termInfoChanged = Boolean(
          term.sourceTextChanged ||
          term.sourceLanguageCodeChanged ||
          term.noteChanged
        )
        term.isNewTerm = term.action === 'create'
        let anyTranslationChanged = false
        term.translations.forEach(translation => {
          translation.changed = translation.action !== 'unchanged'
          if (translation.changed) {
            anyTranslationChanged = true
          }
          translation.textSelected = Boolean(translation.textChanged)
          translation.noteSelected = Boolean(translation.noteChanged)
        })
        term.isBindOnly =
          !term.isNewTerm &&
          !term.alreadyBound &&
          !term.termInfoChanged &&
          !anyTranslationChanged
        term.termInfoSelected = term.termInfoChanged
        term.createSelected = term.isNewTerm
        term.bindSelected = term.isBindOnly
      })
    }

    function getImportTermLeafValues(term) {
      const values = []
      if (term.isNewTerm) {
        values.push(term.createSelected)
        term.translations.forEach(translation => {
          if (translation.textChanged) {
            values.push(translation.textSelected)
          }
          if (translation.noteChanged) {
            values.push(translation.noteSelected)
          }
        })
        return values
      }
      if (term.isBindOnly) {
        values.push(term.bindSelected)
        return values
      }
      if (term.termInfoChanged) {
        values.push(term.termInfoSelected)
      }
      term.translations.forEach(translation => {
        if (translation.textChanged) {
          values.push(translation.textSelected)
        }
        if (translation.noteChanged) {
          values.push(translation.noteSelected)
        }
      })
      return values
    }

    function setImportTermLeafValues(term, selected) {
      if (term.isNewTerm) {
        term.createSelected = selected
      }
      if (term.isBindOnly) {
        term.bindSelected = selected
      }
      if (!term.isNewTerm && !term.isBindOnly && term.termInfoChanged) {
        term.termInfoSelected = selected
      }
      term.translations.forEach(translation => {
        if (translation.textChanged) {
          translation.textSelected = selected
        }
        if (translation.noteChanged) {
          translation.noteSelected = selected
        }
      })
    }

    function isImportTermSelectable(term) {
      return getImportTermLeafValues(term).length > 0
    }

    function getImportTermChecked(term) {
      const values = getImportTermLeafValues(term)
      if (values.length === 0) {
        return false
      }
      return values.every(value => value === true)
    }

    function getImportTermIndeterminate(term) {
      const values = getImportTermLeafValues(term)
      const selectedCount = values.filter(value => value === true).length
      return selectedCount > 0 && selectedCount < values.length
    }

    function handleImportTermCheckedChange(term, selected) {
      setImportTermLeafValues(term, selected)
    }

    function selectAllImport() {
      if (!importPreviewData.value) {
        return
      }
      importPreviewData.value.terms.forEach(term => {
        setImportTermLeafValues(term, true)
      })
    }

    function clearAllImport() {
      if (!importPreviewData.value) {
        return
      }
      importPreviewData.value.terms.forEach(term => {
        setImportTermLeafValues(term, false)
      })
    }

    function isImportTermIncluded(term) {
      if (term.isNewTerm) {
        return term.createSelected === true
      }
      if (term.isBindOnly) {
        return term.bindSelected === true
      }
      if (term.termInfoChanged && term.termInfoSelected) {
        return true
      }
      return term.translations.some(translation => {
        if (!translation.changed) {
          return false
        }
        return (
          translation.textSelected === true || translation.noteSelected === true
        )
      })
    }

    function buildSelectedImportTermTranslations(term) {
      const translations = []
      term.translations.forEach(translation => {
        if (term.isNewTerm) {
          if (translation.textSelected !== true) {
            return
          }
          let note = ''
          if (translation.noteSelected === true) {
            note = translation.note
          }
          translations.push({
            languageCode: translation.languageCode,
            translatedText: translation.translatedText,
            note
          })
          return
        }
        if (!translation.changed) {
          return
        }
        const applyText = translation.textSelected === true
        const applyNote = translation.noteSelected === true
        if (!applyText && !applyNote) {
          return
        }
        let translatedText = translation.previousTranslatedText || ''
        if (applyText) {
          translatedText = translation.translatedText
        }
        let note = translation.previousNote || ''
        if (applyNote) {
          note = translation.note
        }
        translations.push({
          languageCode: translation.languageCode,
          translatedText,
          note
        })
      })
      return translations
    }

    function buildSelectedImportTerms() {
      const data = importPreviewData.value
      const terms = []
      if (!data || !Array.isArray(data.terms)) {
        return terms
      }
      data.terms.forEach(term => {
        if (!isImportTermIncluded(term)) {
          return
        }
        const payloadTerm = {}
        if (term.id) {
          payloadTerm.id = term.id
        }
        if (term.isNewTerm) {
          payloadTerm.sourceText = term.sourceText
          payloadTerm.sourceLanguageCode = term.sourceLanguageCode
          payloadTerm.note = term.note
          payloadTerm.translations = buildSelectedImportTermTranslations(term)
        } else if (term.isBindOnly) {
          payloadTerm.sourceText = term.previousSourceText || term.sourceText
          payloadTerm.sourceLanguageCode = term.previousSourceLanguageCode || ''
          payloadTerm.note = term.previousNote || ''
          payloadTerm.translations = []
        } else {
          const applyTermInfo = term.termInfoChanged && term.termInfoSelected
          if (applyTermInfo) {
            payloadTerm.sourceText = term.sourceText
            payloadTerm.sourceLanguageCode = term.sourceLanguageCode
            payloadTerm.note = term.note
          } else {
            payloadTerm.sourceText = term.previousSourceText || term.sourceText
            payloadTerm.sourceLanguageCode =
              term.previousSourceLanguageCode || ''
            payloadTerm.note = term.previousNote || ''
          }
          payloadTerm.translations = buildSelectedImportTermTranslations(term)
        }
        terms.push(payloadTerm)
      })
      return terms
    }

    function getPreviewTermActionText(action) {
      if (action === 'create') {
        return '新增'
      }
      if (action === 'unchanged') {
        return '无变化'
      }
      return '修改'
    }

    function getPreviewTermActionType(action) {
      if (action === 'create') {
        return 'success'
      }
      if (action === 'unchanged') {
        return 'info'
      }
      return 'warning'
    }

    function getPreviewTranslationActionText(action) {
      if (action === 'create') {
        return '新增'
      }
      if (action === 'update') {
        return '修改'
      }
      return '无变化'
    }

    function getPreviewTranslationActionType(action) {
      if (action === 'create') {
        return 'success'
      }
      if (action === 'update') {
        return 'warning'
      }
      return 'info'
    }

    function getPreviewLanguageText(languageCode) {
      const languageText = getLanguageText(languageCode)
      if (!languageText || languageText === languageCode) {
        return languageCode
      }
      return languageText
    }

    function getPreviewDisplayText(value) {
      if (value === null || value === undefined || value === '') {
        return '（空）'
      }
      return value
    }

    function handleImportFileChange(event) {
      const inputElement = event.target
      const file = inputElement.files && inputElement.files[0]
      if (!file) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        let parsedContent = null
        try {
          parsedContent = JSON.parse(String(reader.result || ''))
        } catch (error) {
          ElMessage.error('文件解析失败，请确认是合法的 JSON 文件')
          inputElement.value = ''
          return
        }
        const termList = parseImportTermList(parsedContent)
        if (!termList) {
          ElMessage.error('文件格式不正确，缺少 terms 名词列表')
          inputElement.value = ''
          return
        }
        if (termList.length === 0) {
          ElMessage.warning('文件中没有可导入的名词')
          inputElement.value = ''
          return
        }
        openImportPreview(termList, parsedContent)
        inputElement.value = ''
      }
      reader.onerror = () => {
        ElMessage.error('文件读取失败')
        inputElement.value = ''
      }
      reader.readAsText(file)
    }

    function handleImportExportCommand(command) {
      if (command === 'export') {
        openExportDialog('export')
        return
      }
      if (command === 'template') {
        openExportDialog('template')
        return
      }
      if (command === 'import') {
        triggerImportFile()
      }
    }

    function handleInternetSearchApplied() {
      preserveTableScrollForNextRefresh()
      getTermList(false)
      if (translationDialogVisible.value && activeTerm.value) {
        getTranslationList()
      }
    }

    function getRowTermIds(row) {
      if (!row?._id) {
        return []
      }
      return [row._id]
    }

    function goBack() {
      router.push({ name: 'SourcePostImport' })
    }

    function getTranslationSourceText(value) {
      return TRANSLATION_SOURCE_TEXT_MAP[value] || value || '未知'
    }

    function getRelationSourceText(value) {
      return RELATION_SOURCE_TEXT_MAP[value] || value || '关联'
    }

    function getCountText(value) {
      const count = Number(value || 0)
      if (!Number.isFinite(count) || count < 0) {
        return '0'
      }
      return String(Math.floor(count))
    }

    function getLastUsedAtText(value) {
      if (!value) {
        return '未使用'
      }
      return formatDate(value)
    }

    function getRelationUpdatedAtText(row) {
      const updatedAt = row?.relation?.updatedAt
      if (!updatedAt) {
        return '-'
      }
      return formatDate(updatedAt)
    }

    function getDisplayedTranslationItems(row) {
      return buildProperNounTranslationDisplayItems({
        translations: row?.translations,
        languageOptions,
        selectedLanguageCode: params.languageCode,
        sourceLanguageCode: row?.sourceLanguageCode
      })
    }

    function getBindDisplayedTranslationItems(row) {
      return buildProperNounTranslationDisplayItems({
        translations: row?.translations,
        languageOptions,
        selectedLanguageCode: bindParams.languageCode,
        sourceLanguageCode: row?.sourceLanguageCode
      })
    }

    function getSourceLanguageText(sourceLanguageCode) {
      if (!sourceLanguageCode) {
        return '-'
      }
      const languageText = getLanguageText(sourceLanguageCode)
      if (!languageText || languageText === sourceLanguageCode) {
        return sourceLanguageCode
      }
      return `${languageText}（${sourceLanguageCode}）`
    }

    function getTranslationTagType(translation) {
      if (translation?.isMissingTranslation) {
        return 'danger'
      }
      return 'primary'
    }

    function getTranslationTagText(translation) {
      const languageText =
        translation?.languageLabel || getLanguageText(translation?.languageCode)
      if (translation?.isMissingTranslation) {
        return `${languageText}：缺少译名`
      }
      return `${languageText}：${translation?.translatedText || ''}`
    }

    restoreTermListParams()

    watch(
      () => [params.page, params.limit],
      () => {
        getTermList(false)
      }
    )

    watch(
      () => [bindParams.page, bindParams.limit],
      () => {
        getBindableTermList(false)
      }
    )

    watch(
      () => sourceId.value,
      () => {
        restoreTermListParams()
        if (bindDialogVisible.value) {
          bindDialogVisible.value = false
        }
        getTermList(false)
      }
    )

    onMounted(() => {
      getTermList(false)
    })

    return {
      activeTerm,
      bindDialogVisible,
      bindLoading,
      bindParams,
      bindSaving,
      bindSelectedTerms,
      bindTableRef,
      bindTermList,
      bindTotal,
      clearBindTermSelection,
      deleteTerm,
      deleteTranslation,
      getBindDisplayedTranslationItems,
      getCountText,
      getBindableTermList,
      getDisplayedTranslationItems,
      getLanguageText,
      getLastUsedAtText,
      getRelationSourceText,
      getRelationUpdatedAtText,
      getRowTermIds,
      getSourceLanguageText,
      getTermList,
      getTranslationList,
      getTranslationSourceText,
      getTranslationTagText,
      getTranslationTagType,
      goBack,
      handleInternetSearchApplied,
      handleBindTermSelectionChange,
      handleImportExportCommand,
      handleImportFileChange,
      handleTermSelectionChange,
      confirmExport,
      exportConfirmButtonText,
      exportDialogTitle,
      exportDialogVisible,
      exportLanguageCodes,
      exporting,
      importFileInputRef,
      importing,
      confirmImport,
      handleImportPreviewBeforeClose,
      importCrossArticleNote,
      importPreviewData,
      importPreviewDialogVisible,
      importPreviewLoading,
      importProgress,
      importProgressPercent,
      importProgressVisible,
      getPreviewTermActionText,
      getPreviewTermActionType,
      getPreviewTranslationActionText,
      getPreviewTranslationActionType,
      getPreviewLanguageText,
      getPreviewDisplayText,
      isImportTermSelectable,
      getImportTermChecked,
      getImportTermIndeterminate,
      handleImportTermCheckedChange,
      selectAllImport,
      clearAllImport,
      selectedImportCount,
      internetSearchDefaultLanguageCodes,
      isBindableTermSelectable,
      isTermBoundToSourcePost,
      isTermStarred,
      languageOptions,
      loading,
      openBindExistingTermDialog,
      openCreateTermDialog,
      openCreateTranslationDialog,
      openEditTermDialog,
      openEditTranslationDialog,
      openOrganizeDialog,
      openTranslationDialog,
      organizeDialogVisible,
      params,
      relationCount,
      selectedBindableTermIds,
      selectedTermIds,
      sourceId,
      sourcePost,
      sourcePostTitle,
      starUpdatingId,
      submitTerm,
      submitTranslation,
      tableRef,
      termDialogTitle,
      termDialogVisible,
      termForm,
      termList,
      termSaving,
      total,
      translationDialogTitle,
      translationDialogVisible,
      translationDisplayList,
      translationEditDialogVisible,
      translationForm,
      translationList,
      translationLoading,
      translationMode,
      translationSaving,
      toggleTermStar,
      unbindTerm
    }
  }
}
</script>

<style scoped>
.source-post-proper-noun-page {
  min-width: 0;
}

.source-post-term-import-input {
  display: none;
}

.source-post-term-export-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
  padding-left: 100px;
}

.source-post-term-import-preview {
  max-height: 60vh;
  min-height: 120px;
  overflow-y: auto;
}

.source-post-term-import-preview-summary {
  color: var(--el-text-color-regular);
  font-size: 14px;
  margin-bottom: 12px;
}

.source-post-term-import-create-count {
  color: var(--el-color-success);
  font-weight: 600;
}

.source-post-term-import-update-count {
  color: var(--el-color-warning);
  font-weight: 600;
}

.source-post-term-import-unchanged-count {
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.source-post-term-import-preview-toolbar {
  align-items: center;
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.source-post-term-import-selected-count {
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.source-post-term-import-preview-leaf-block {
  margin-top: 8px;
}

.source-post-term-import-preview-translation-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.source-post-term-import-preview-translation-line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-post-term-import-leaf-checkbox {
  margin-right: 0;
}

@media (max-width: 767px) {
  .source-post-term-import-preview-item-head {
    align-items: flex-start;
  }

  .source-post-term-import-preview-source-text {
    word-break: break-all;
  }

  .source-post-term-import-preview-note {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    gap: 2px;
    word-break: break-all;
  }

  .source-post-term-import-preview-translation {
    align-items: flex-start;
    /* flex-direction: column; */
  }

  .source-post-term-import-preview-translation-line {
    align-items: flex-start;
    flex-direction: column;
  }

  .source-post-term-import-preview-translation-diff {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    gap: 2px;
    word-break: break-all;
  }

  .source-post-term-import-old,
  .source-post-term-import-new {
    word-break: break-all;
  }

  .source-post-term-import-preview-toolbar {
    flex-wrap: wrap;
  }
}

.source-post-term-import-preview-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-post-term-import-preview-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 10px 12px;
}

.source-post-term-import-preview-item-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-post-term-import-preview-source-text {
  font-weight: 600;
  word-break: break-all;
}

.source-post-term-import-preview-lang {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.source-post-term-import-preview-note {
  color: var(--el-text-color-regular);
  font-size: 13px;
  margin-top: 8px;
}

.source-post-term-import-preview-translations {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.source-post-term-import-preview-translation {
  /* align-items: center; */
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 8px;
}

.source-post-term-import-preview-translation-diff {
  word-break: break-all;
}

.source-post-term-import-old {
  color: var(--el-color-danger);
  text-decoration: line-through;
}

.source-post-term-import-new {
  color: var(--el-color-success);
}

.source-post-term-import-preview-translation-same {
  color: var(--el-text-color-secondary);
}

.source-post-term-import-preview-translation-note {
  color: var(--el-text-color-regular);
  flex-basis: 100%;
  font-size: 12px;
  padding-left: 4px;
  word-break: break-all;
}

.source-post-term-import-preview-empty {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 8px;
}

.source-post-term-import-progress {
  margin-top: 16px;
}

.source-post-term-import-progress-text {
  color: var(--el-text-color-regular);
  font-size: 13px;
  margin-top: 8px;
  text-align: left;
}

.source-post-term-header,
.source-post-term-header-actions,
.source-post-term-actions,
.source-post-term-action-buttons,
.source-post-term-bind-footer,
.source-post-term-bind-footer-actions,
.source-post-term-row-actions,
.source-post-term-translation-header {
  align-items: center;
  display: flex;
  gap: 8px;
}

.source-post-term-header {
  justify-content: space-between;
}

.source-post-term-title-block {
  min-width: 0;
}

.source-post-term-title {
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

.source-post-term-meta,
.source-post-term-count,
.source-post-term-note,
.source-post-term-note-cell,
.source-post-term-usage-date {
  color: var(--el-text-color-secondary);
}

.source-post-term-meta {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}

.source-post-term-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.source-post-term-action-buttons,
.source-post-term-bind-footer-actions,
.source-post-term-row-actions {
  flex-wrap: wrap;
}

.source-post-term-action-buttons :deep(.el-button + .el-button),
.source-post-term-bind-footer-actions :deep(.el-button + .el-button),
.source-post-term-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.source-post-term-count {
  font-size: 13px;
  line-height: 32px;
  white-space: nowrap;
}

.source-post-term-source-text {
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.source-post-term-bound-tag {
  margin-top: 6px;
}

.source-post-term-note {
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-post-term-note-cell {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-post-term-translation-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-post-term-translation-list :deep(.el-tag) {
  height: auto;
  line-height: 18px;
  padding: 2px 9px;
  white-space: normal;
}

.source-post-term-usage {
  line-height: 1.5;
}

.source-post-term-usage-count {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.source-post-term-usage-date {
  font-size: 12px;
  margin-top: 4px;
  word-break: break-word;
}

.source-post-term-translation-header {
  justify-content: space-between;
  margin-bottom: 14px;
}

.source-post-term-bind-toolbar {
  margin-bottom: 12px;
}

.source-post-term-bind-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.source-post-term-bind-footer {
  justify-content: space-between;
  min-width: 0;
}

.source-post-term-bind-footer-actions {
  justify-content: flex-end;
}

.source-post-term-bind-selected-count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 32px;
}

.source-post-term-form {
  max-width: 560px;
}

@media (max-width: 767px) {
  .source-post-term-header,
  .source-post-term-header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .source-post-term-header-actions :deep(.el-button) {
    margin-left: 0;
    width: 100%;
  }

  .common-top-search-form-body {
    float: none !important;
    width: 100%;
  }

  .source-post-term-actions {
    align-items: stretch;
    float: none !important;
    flex-direction: column;
    justify-content: flex-start;
    margin-top: 10px;
    width: 100%;
  }

  .source-post-term-action-buttons {
    justify-content: flex-end;
    width: 100%;
  }

  .source-post-term-search-form :deep(.el-form-item) {
    display: block;
    margin-right: 0;
    width: 100%;
  }

  .source-post-term-search-form :deep(.el-input),
  .source-post-term-search-form :deep(.el-select),
  .source-post-term-bind-search-form :deep(.el-input),
  .source-post-term-bind-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .source-post-term-bind-search-form :deep(.el-form-item) {
    display: block;
    margin-right: 0;
    width: 100%;
  }

  .source-post-term-bind-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .source-post-term-bind-footer-actions {
    justify-content: flex-end;
    width: 100%;
  }

  .source-post-term-bind-selected-count {
    line-height: 1.5;
  }

  .source-post-term-form {
    max-width: none;
  }

  .source-post-term-form :deep(.el-form-item) {
    display: block;
  }

  .source-post-term-form :deep(.el-form-item__label) {
    justify-content: flex-start;
    width: auto !important;
  }

  .source-post-term-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
