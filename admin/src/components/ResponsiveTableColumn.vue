<template>
  <el-table-column v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData" />
    </template>
  </el-table-column>
</template>

<script>
export default {
  name: 'ResponsiveTableColumn',
  inheritAttrs: false
}
</script>
