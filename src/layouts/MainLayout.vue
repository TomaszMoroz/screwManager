<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title>
          Handle Products
        </q-toolbar-title>

        <div> v{{ $q.version }}</div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
    >
      <q-list>
        <q-item-label
          header
        >
          Essential Links
        </q-item-label>

        <EssentialLink
          v-for="link in linksList"
          :key="link.title"
          v-bind="link"
          @click="redirect(link.path)"
        />
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import EssentialLink from 'components/EssentialLink.vue'

const $router = useRouter()

const linksList = [
  {
    title: 'Pobierz',
    caption: 'token/ dane',
    icon: 'download',
    path: 'load'
  },
  {
    title: 'Pordukty',
    caption: 'kontrola/ edycja',
    icon: 'handyman',
    path: 'products'
  },
  {
    title: 'Slownik',
    caption: 'nazwy norm',
    icon: 'menu_book',
    path: 'dictionary'
  }
]

const leftDrawerOpen = ref(false)

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

function redirect(p) {
  toggleLeftDrawer()

  $router.push({ path: `/${p}` })
}
</script>
