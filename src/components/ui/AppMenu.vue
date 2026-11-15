<script setup lang="ts">
import type { Component } from 'vue'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
import { Check } from '@lucide/vue'

export interface MenuEntry {
  label: string
  icon?: Component
  action: () => void
  hidden?: boolean
  /** shown with a tick: a setting that is on */
  checked?: boolean
  separatorBefore?: boolean
}

defineProps<{ items: MenuEntry[], label: string, side?: 'top' | 'bottom', align?: 'start' | 'end' }>()
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger class="btn btn-ghost btn-icon" :aria-label="label">
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="menu" :side="side ?? 'bottom'" :align="align ?? 'start'" :side-offset="6" :collision-padding="8">
        <template v-for="item in items.filter(i => !i.hidden)" :key="item.label">
          <DropdownMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-line" />
          <DropdownMenuItem class="menu-item" @select="item.action">
            <component :is="item.icon" v-if="item.icon" :size="16" class="text-muted" />
            <span class="flex-1">{{ item.label }}</span>
            <Check v-if="item.checked" :size="16" class="text-accent" />
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
