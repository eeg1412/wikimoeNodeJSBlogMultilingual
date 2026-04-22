<template>
  <el-dialog
    v-model="showDialog"
    title="活动"
    width="520px"
    align-center
    :close-on-click-modal="false"
    destroy-on-close
    append-to-body
    @closed="resetData"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <el-form-item label="文本" prop="text">
        <el-input v-model="form.text" placeholder="请输入文本" />
      </el-form-item>
      <el-form-item label="活动" prop="id">
        <el-select
          v-model="form.id"
          placeholder="请选择活动"
          clearable
          filterable
          remote
          :remote-method="queryEventList"
          :loading="eventListIsLoading"
        >
          <el-option
            v-for="item in eventList"
            :key="item._id"
            :label="item.title"
            :value="item._id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="showDialog = false">取消</el-button>
      <el-button type="primary" @click="submit">提交</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, reactive, ref } from 'vue'
import { nextTick } from 'vue'
import { eventApi } from '../api/entity.js'

function flattenEventGroups(groups, fallbackLanguage) {
  const list = []

  for (const group of groups || []) {
    const langs = Array.isArray(group.langs) ? group.langs : []
    let selected = null

    if (fallbackLanguage) {
      selected = langs.find(item => item.languageCode === fallbackLanguage) || null
    }
    if (!selected && langs.length > 0) {
      selected = langs[0]
    }
    if (!selected) {
      continue
    }

    list.push({
      ...selected,
      _id: selected._id,
      title: selected.title || group.sourceId || group.groupKey
    })
  }

  return list
}

export default {
  name: 'RichEditorEventSelectorDialog',
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
    const formRef = ref(null)
    const form = reactive({
      id: '',
      text: ''
    })

    const rules = {
      id: [{ required: true, message: '请选择活动', trigger: 'blur' }],
      text: [{ required: true, message: '请输入文本', trigger: 'blur' }]
    }

    const showDialog = computed({
      get() {
        if (props.id) {
          form.id = props.id
        }
        if (props.text) {
          form.text = props.text
        }
        return props.show
      },
      set(value) {
        emit('update:show', value)
      }
    })

    const eventList = ref([])
    const eventListIsLoading = ref(false)
    let queryTimer = null

    function resetData() {
      form.id = ''
      form.text = ''
      eventList.value = []
    }

    async function fetchEventList(keyword = '') {
      eventListIsLoading.value = true
      try {
        const params = {
          page: 1,
          limit: 20
        }

        if (props.languageCode) {
          params.languageCode = props.languageCode
        }
        if (keyword) {
          params.keyword = keyword
        }

        const res = await eventApi.getList(params)
        eventList.value = flattenEventGroups(res.data?.list || [], props.languageCode)
      } finally {
        eventListIsLoading.value = false
      }
    }

    function queryEventList(keyword) {
      if (queryTimer) {
        clearTimeout(queryTimer)
      }

      queryTimer = setTimeout(() => {
        fetchEventList(keyword)
      }, 200)
    }

    function submit() {
      formRef.value.validate(valid => {
        if (!valid) {
          return false
        }

        showDialog.value = false
        nextTick(() => {
          emit('ok', { id: form.id, text: form.text })
        })
      })
    }

    return {
      showDialog,
      form,
      formRef,
      rules,
      eventList,
      eventListIsLoading,
      queryEventList,
      submit,
      resetData
    }
  }
}
</script>
