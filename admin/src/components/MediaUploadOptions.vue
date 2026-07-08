<template>
  <el-popover placement="bottom" :width="220" trigger="click">
    <div>
      <!-- 不压缩图片 -->
      <el-checkbox
        @click.stop
        size="small"
        v-model="options.noCompress"
        label="不压缩图片"
      />
      <!-- 不生成缩略图（与HDR配置互斥） -->
      <el-checkbox
        @click.stop
        size="small"
        v-model="options.noThumbnail"
        :disabled="hdrActive"
        label="不生成缩略图"
      />
      <!-- 是360°全景图片（与HDR配置互斥） -->
      <el-checkbox
        @click.stop
        size="small"
        v-model="options.is360Panorama"
        :disabled="hdrActive"
        label="是360°全景图片"
      />
      <!-- 设置最长边 -->
      <div class="media-upload-option-field">
        <div class="media-upload-option-label">最长边:</div>
        <div class="media-upload-option-value">
          <el-input-number
            v-model="options.imgSettingCompressMaxSize"
            :step="10"
            :precision="0"
            :min="1"
            size="small"
            placeholder="设置最长边"
            clearable
          />
        </div>
      </div>
      <!-- HDR相关设置：与360°全景/不生成缩略图互斥 -->
      <div class="media-upload-option-hdr">
        <div class="media-upload-option-col">
          <div class="media-upload-option-col-label">保留HDR</div>
          <el-radio-group
            v-model="options.keepHDR"
            size="small"
            :disabled="hdrConflict"
            class="media-upload-option-radio"
          >
            <el-radio value="default">按照后台设置</el-radio>
            <el-radio value="keep">保留HDR</el-radio>
            <el-radio value="notKeep" :disabled="options.markAsHDR"
              >不保留HDR</el-radio
            >
          </el-radio-group>
        </div>
        <div class="media-upload-option-col">
          <div class="media-upload-option-col-label">缩略图保留HDR</div>
          <el-radio-group
            v-model="options.thumbnailKeepHDR"
            size="small"
            :disabled="thumbnailKeepHDRDisabled"
            class="media-upload-option-radio"
          >
            <el-radio value="default">按照后台设置</el-radio>
            <el-radio value="keep">保留HDR</el-radio>
            <el-radio value="notKeep">不保留HDR</el-radio>
          </el-radio-group>
        </div>
        <el-checkbox
          @click.stop
          size="small"
          v-model="options.markAsHDR"
          :disabled="markAsHDRDisabled"
          label="标记为HDR"
        />
      </div>
    </div>
    <template #reference>
      <el-button
        size="small"
        :type="optionsCount > 0 ? 'primary' : ''"
        :plain="optionsCount <= 0"
        @click.stop
      >
        <el-icon><Setting /></el-icon>
        <span class="pl3">
          设置<template v-if="optionsCount > 0"
            >（已设置 {{ optionsCount }} 项）</template
          >
        </span>
      </el-button>
    </template>
  </el-popover>
</template>

<script>
import { computed, watch } from 'vue'
import { Setting } from '@element-plus/icons-vue'
import { getMediaUploadOptionsCount } from '@/utils/mediaUploadOptions'

export default {
  name: 'MediaUploadOptions',
  components: {
    Setting
  },
  props: {
    // 上传单独设置对象（由父组件持有，本组件直接修改其属性）
    options: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    // 360°全景或不生成缩略图时，与所有HDR配置冲突
    const hdrConflict = computed(() => {
      return props.options.is360Panorama || props.options.noThumbnail
    })
    // 是否已启用任意HDR配置（用于禁用360°全景与不生成缩略图）
    const hdrActive = computed(() => {
      return (
        props.options.keepHDR !== 'default' ||
        props.options.thumbnailKeepHDR !== 'default' ||
        props.options.markAsHDR
      )
    })
    // 缩略图保留HDR仅当保留HDR明确为「保留」时可选
    const thumbnailKeepHDRDisabled = computed(() => {
      return hdrConflict.value || props.options.keepHDR !== 'keep'
    })
    // 「标记为HDR」与「不保留HDR」互斥；与360°/不生成缩略图也冲突
    const markAsHDRDisabled = computed(() => {
      return hdrConflict.value || props.options.keepHDR === 'notKeep'
    })
    const optionsCount = computed(() => {
      return getMediaUploadOptionsCount(props.options)
    })

    watch(
      () => hdrConflict.value,
      isConflict => {
        if (isConflict) {
          props.options.keepHDR = 'default'
          props.options.thumbnailKeepHDR = 'default'
          props.options.markAsHDR = false
        }
      }
    )
    watch(
      () => props.options.keepHDR,
      value => {
        if (value !== 'keep') {
          props.options.thumbnailKeepHDR = 'default'
        }
        if (value === 'notKeep') {
          props.options.markAsHDR = false
        }
      }
    )

    return {
      hdrConflict,
      hdrActive,
      thumbnailKeepHDRDisabled,
      markAsHDRDisabled,
      optionsCount
    }
  }
}
</script>

<style scoped>
.media-upload-option-field {
  display: flex;
  align-items: center;
}
.media-upload-option-label {
  width: 54px;
  flex-shrink: 0;
}
.media-upload-option-value {
  flex-grow: 1;
}
.media-upload-option-hdr {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.media-upload-option-col {
  margin-bottom: 6px;
}
.media-upload-option-col-label {
  margin-bottom: 2px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.media-upload-option-radio.el-radio-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.media-upload-option-radio :deep(.el-radio) {
  margin-right: 0;
  height: 24px;
}
</style>
