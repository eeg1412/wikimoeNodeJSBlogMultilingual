<template>
  <div class="ai-json-nested-table-shell" :class="{ 'is-root': level === 0 }">
    <table class="ai-json-nested-table">
      <colgroup>
        <col class="ai-json-field-col" />
        <col class="ai-json-description-col" />
        <col class="ai-json-value-col" />
      </colgroup>
      <thead v-if="level === 0">
        <tr>
          <th>字段</th>
          <th>说明</th>
          <th>内容</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="node in nodes" :key="node.id">
          <tr :class="{ 'is-branch': hasChildren(node) }">
            <td class="ai-json-field-cell">
              <span class="ai-json-field-name">{{ node.label }}</span>
              <span class="ai-json-field-type">{{ node.typeLabel }}</span>
            </td>
            <td class="ai-json-description-cell">{{ node.description }}</td>
            <td class="ai-json-value-cell" :class="getValueCellClass(node)">
              <span v-if="hasChildren(node)" class="ai-json-collection-summary">
                {{ node.summary }}
              </span>
              <span v-else>{{ node.value }}</span>
            </td>
          </tr>
          <tr v-if="hasChildren(node)" class="ai-json-child-row">
            <td colspan="3" class="ai-json-child-cell">
              <AiJsonNestedTable :nodes="node.children" :level="level + 1" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'AiJsonNestedTable',
  props: {
    nodes: {
      type: Array,
      default: () => []
    },
    level: {
      type: Number,
      default: 0
    }
  },
  methods: {
    hasChildren(node) {
      return Array.isArray(node?.children) && node.children.length > 0
    },
    getValueCellClass(node) {
      if (node?.valueTone === 'input') {
        return 'is-ai-input'
      }
      if (node?.valueTone === 'output') {
        return 'is-ai-output'
      }
      return ''
    }
  }
}
</script>

<style scoped>
.ai-json-nested-table-shell {
  box-sizing: border-box;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.5;
  max-width: 100%;
  width: 100%;
}

.ai-json-nested-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.ai-json-field-col {
  width: 24%;
}

.ai-json-description-col {
  width: 34%;
}

.ai-json-value-col {
  width: 42%;
}

.ai-json-nested-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.ai-json-nested-table th,
.ai-json-nested-table td {
  border-bottom: 1px solid var(--el-border-color-lighter);
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  white-space: pre-wrap;
  word-break: break-all;
}

.ai-json-nested-table tr.is-branch > td {
  background: var(--el-fill-color-extra-light);
}

.ai-json-field-cell {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-json-field-name {
  color: var(--el-color-primary);
  font-weight: 600;
}

.ai-json-field-type {
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  color: var(--el-text-color-secondary);
  display: inline-flex;
  font-size: 11px;
  line-height: 1;
  padding: 3px 5px;
}

.ai-json-description-cell {
  color: var(--el-text-color-secondary);
}

.ai-json-value-cell {
  color: var(--el-text-color-regular);
}

.ai-json-value-cell.is-ai-input {
  background: var(--el-color-info-light-9);
  border-left: 3px solid var(--el-color-info-light-5);
}

.ai-json-value-cell.is-ai-output {
  background: var(--el-color-success-light-9);
  border-left: 3px solid var(--el-color-success-light-5);
}

.ai-json-collection-summary {
  color: var(--el-text-color-secondary);
}

.ai-json-child-cell {
  padding: 0 0 8px 18px !important;
}

.ai-json-child-cell > .ai-json-nested-table-shell {
  border-left: 2px solid var(--el-border-color-light);
}

.ai-json-child-row > td {
  background: var(--el-bg-color);
}

@media (max-width: 760px) {
  .ai-json-field-col {
    width: 22%;
  }

  .ai-json-description-col {
    width: 32%;
  }

  .ai-json-value-col {
    width: 46%;
  }

  .ai-json-child-cell {
    padding-left: 10px !important;
  }
}
</style>
