<template>
  <el-dialog
    v-model="showDialog"
    align-center
    :close-on-click-modal="false"
    destroy-on-close
    append-to-body
    title="活动"
    @closed="resetData"
  >
    <div>
      <el-form
        :model="form"
        :rules="rules"
        ref="formRef"
        label-width="80px"
        @submit.prevent
      >
        <!-- 文本 -->
        <el-form-item label="文本" prop="text">
          <el-input v-model="form.text" placeholder="请输入文本"></el-input>
        </el-form-item>
        <!-- 活动选择器 -->
        <el-form-item label="活动" prop="id">
          <el-select
            v-model="form.id"
            placeholder="请选择活动"
            clearable
            filterable
            remote
            :automatic-dropdown="true"
            :remote-method="queryEventList"
            :loading="eventListIsLoading"
          >
            <el-option
              v-for="item in eventList"
              :key="item._id"
              :label="item.title"
              :value="item._id"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="submit"> 提交 </el-button>
      </span>
    </template>
  </el-dialog>
</template>
<script>
import { computed, reactive, ref, watch } from 'vue'
import { multilingualApi } from '@/api'
import { nextTick } from 'vue'
export default {
  props: {
    show: {
      type: Boolean,
      default: false
    },
    id: {
      type: String,
      default: ''
    },
    text: {
      type: String,
      default: ''
    },
    languageCode: {
      type: String,
      default: ''
    }
  },
  emits: ['update:show', 'ok'],
  setup(props, { emit }) {
    const showDialog = computed({
      get() {
        return props.show
      },
      set(val) {
        emit('update:show', val)
      }
    })

    const form = reactive({
      id: null,
      text: ''
    })
    const rules = reactive({
      id: [{ required: true, message: '请选择活动', trigger: 'blur' }],
      text: [{ required: true, message: '请输入文本', trigger: 'blur' }]
    })
    const formRef = ref(null)
    const submit = () => {
      formRef.value.validate(async valid => {
        if (!valid) {
          return false
        }
        showDialog.value = false
        nextTick(() => {
          emit('ok', {
            id: form.id,
            text: form.text
          })
        })
      })
    }

    const resetData = () => {
      form.id = null
      form.text = ''
    }

    // 活动
    const eventList = ref([])
    const eventListIsLoading = ref(false)
    let eventListTimer = null
    const getEventListFromResponse = response => {
      const list = response.data.data?.list || []
      return list.filter(item => {
        return Number(item.status) === 1
      })
    }
    const getEventDetail = id => {
      if (!props.languageCode || !id) {
        eventList.value = []
        return
      }
      eventListIsLoading.value = true
      multilingualApi
        .getTranslationRelationList(
          {
            collectionName: 'events',
            recordKind: 'translation',
            languageCode: props.languageCode,
            keyword: id,
            page: 1,
            limit: 1
          },
          true
        )
        .then(res => {
          const list = getEventListFromResponse(res)
          const matchedItem = list.find(item => {
            return String(item._id) === String(id)
          })
          if (matchedItem) {
            eventList.value = [matchedItem]
            return
          }
          eventList.value = list
        })
        .catch(() => {})
        .finally(() => {
          eventListIsLoading.value = false
        })
    }
    const queryEventList = (query, options = {}) => {
      if (eventListTimer) {
        clearTimeout(eventListTimer)
      }
      eventListTimer = setTimeout(() => {
        if (!props.languageCode) {
          eventList.value = []
          return
        }
        eventListIsLoading.value = true
        const params = {
          collectionName: 'events',
          recordKind: 'translation',
          languageCode: props.languageCode,
          keyword: query,
          page: 1,
          limit: 50,
          ...options
        }
        multilingualApi
          .getTranslationRelationList(params, true)
          .then(res => {
            eventList.value = getEventListFromResponse(res)
          })
          .catch(() => {})
          .finally(() => {
            eventListIsLoading.value = false
          })
      }, 300)
    }
    watch(
      () => props.show,
      val => {
        if (!val) {
          return
        }
        form.id = props.id || null
        form.text = props.text || ''
        if (props.id) {
          getEventDetail(props.id)
          return
        }
        queryEventList('')
      }
    )
    watch(
      () => props.languageCode,
      () => {
        if (showDialog.value) {
          queryEventList('')
        }
      }
    )
    return {
      showDialog,
      form,
      rules,
      formRef,
      submit,
      resetData,
      eventList,
      eventListIsLoading,
      queryEventList
    }
  }
}
</script>
<style lang=""></style>
