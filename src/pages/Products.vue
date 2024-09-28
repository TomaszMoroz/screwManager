<template>
  <q-page class="column content-center">
    <q-table
      flat bordered
      :columns="columns"
      :rows="rows"
      :filter="filter"
      row-key="id"
      :pagination="{ rowsPerPage: 20 }"
      @row-click="showDictionary"
    >
    <template v-slot:top>
      <div style="width: 100%" class="row">
        <div class="col-9">
          <q-toggle v-model="filterToggle.active" val="breakfast" label="Aktywne" />
          <q-toggle v-model="filterToggle.done" val="lunch" label="Opisane" />
          <q-toggle v-model="filterToggle.new" val="dinner" label="Nowe" />
          <q-toggle v-model="showAll" val="showAll" label="Wszystkie" />
        </div>
        <div class="col-3">
        <q-input  dense debounce="400" color="primary" v-model="filter">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
        </div>
      </div>
    </template>

      <template v-slot:header="props">
        <q-tr :props="props">
          <q-th auto-width />
          <q-th
            v-for="col in props.cols"
            :key="col.name"
            :props="props"
          >
            {{ col.label }}
          </q-th>
        </q-tr>
      </template>

      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td auto-width>
            <q-btn size="sm" color="accent" round dense @click="props.expand = !props.expand" :icon="props.expand ? 'remove' : 'add'" />
          </q-td>
          <q-td
            v-for="col in props.cols"
            :key="col.name"
            :props="props"
          >
            {{ col.value }}
          </q-td>
          <td>
            <q-icon name="edit" size="24px" color="blue" @click="editMainDescription(props)"/>
          </td>
        </q-tr>
        <q-tr v-show="props.expand" v-for="product in props.row.products" :key="product.ean" :props="props">
          <q-td>
            <q-icon name="menu_book" size="24px" color="blue" @click="editDictionary(product.tags, product.fullName)"/>
          </q-td>
          <q-td>
            <div class="text-left">{{ product.fullName }}</div>
          </q-td>
          <q-td>
            <div class="text-left">{{ product.pieces }}</div>
          </q-td>
          <q-td>
            <div class="text-left">{{ product.price }}</div>
          </q-td>
        </q-tr>
      </template>

    </q-table>
      <q-dialog v-model="showDimensionsDialog" backdrop-filter="grayscale(100%)">
      <q-card>
        <q-card-section class="row items-center q-pb-none text-h6">
          {{ name }}
        </q-card-section>

        <q-card-section class="column flex-center" style="width: 400px">
          <q-btn v-for="tag in currentTags" :key="tag.Id" :label="tag.Value" @click="showDescriptionOptions(tag)" text-color="primary" class="q-pa-sm q-ma-sm bg-grey-1" style="width: 250px">
            <q-badge floating>{{ `ID: ${tag.Id}` }}</q-badge>
          </q-btn>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showMultiInputDialog" backdrop-filter="grayscale(100%)">
      <q-card>
        <q-card-section class="row items-center q-pb-none text-h6">
          {{ name }}
        </q-card-section>

        <q-card-section class="column flex-center" style="width: 400px">
          <q-btn v-for="tag in dimensions" :key="tag" :label="tag" @click="editDimension(tag)" text-color="primary" class="q-pa-sm q-ma-sm bg-grey-1" style="width: 250px">
          </q-btn>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showDimensionsDictionary" backdrop-filter="grayscale(100%)">
      <q-card>
        <q-card-section class="row items-center q-pb-none text-h6">
          <div v-for="d in dimensions" :key="d" class="row flex-center text-grey-7" :class="dimensionChunk === d ? 'text-black' : ''">
            {{ d }}
          </div>
        </q-card-section>

        <q-card-section class="column flex-center" style="width: 400px">
          <q-select v-model="position" :options="[1, 2, 3, 4]" dense label="Wybierz pozycje parametru" style="width: 250px" />
          <q-input v-model="editedDimension" dense label="Edytuj nazwe paramateru" :placeholder="dimensionChunk" style="width: 250px" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Anuluj" color="primary" v-close-popup />
          <q-btn flat label="Zapisz" color="green-4" @click="addToDimensionsDictionary" v-close-popup></q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, reactive, watch, computed } from 'vue'
import { useQuasar, Loading } from 'quasar';
import { flatten, groupBy, differenceWith, isEqual, sortBy } from 'lodash'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore'
import { useCollection } from 'vuefire'
import { useProductsStore } from 'src/stores/productsStore'

const $q = useQuasar()
const productsStore = useProductsStore()
const { getAll } = productsStore

const firebaseConfig = {
  apiKey: "AIzaSyCzOPasvJmSpk5JkMeYZtbjdZnTwiIaiLY",
  authDomain: "screwmanager-a5f86.firebaseapp.com",
  projectId: "screwmanager-a5f86",
  storageBucket: "screwmanager-a5f86.appspot.com",
  messagingSenderId: "436708356889",
  appId: "1:436708356889:web:f91211e9ae379412cf8b88"
}

 const firebase = initializeApp(firebaseConfig)
 const db = getFirestore(firebase)

const rows = ref([])
const filter = ref('')
const access = ref('')
const data = ref(null)
const categories = ref([])
const products = ref(null)
const existingDB = ref(null)
const show = ref(false)
const showAll = ref(true)
const showDimensionsDialog = ref(false)
const showMultiInputDialog = ref(false)
const showDimensionsDictionary = ref(false)
const currentTags = ref([])
const name = ref('')
const dimensions = ref([])
const dimensionChunk = ref('')
const editedDimensionsChunks = ref([])
const position = ref(1)
const editedDimension = ref('')
const description = reactive({
  initial: [],
  short: [],
  full: []
})
const diemnsionsDictionary = ref([])
const filterToggle = reactive({
  active: false,
  done: false,
  new: false
})

const columns = computed(() => [
  { name: 'name', label: 'Id', field: 'id' },
  { name: 'description', label: 'Opis', field: 'description' },
  { name: 'edit', label: 'Edytuj opis grupy' }
])

function editDictionary (tags, name) {
  // const dimensions = tags.filter(t => t.id === 6)[0]
  showDictionary(tags, name)
}

function showDictionary (tags, n) {
  name.value = n
  currentTags.value = sortBy(tags, 'Id')
  showDimensionsDialog.value = true
}

function editMainDescription (props) {
  $q.dialog({
    backdropFilter: 'grayscale(100%)',
    title: `${props.row.id}`,
        message: 'Edytuj opis grupy',
        prompt: {
          model: '',
          type: 'textarea'
        },
        cancel: true,
        persistent: true
      }).onOk(data => {
        console.log('>>>> OK, received', data)
      }).onCancel(() => {
        console.log('>>>> Cancel')
      }).onDismiss(() => {
        console.log('I am triggered on both OK and Cancel')
      })
}

const singleInputDialog = (tag) => $q.dialog({
    title: `Edytuj pole: ${tag.Value}`,
        prompt: {
          model: '',
          input: 'text'
        },
        cancel: true,
        persistent: true
      }).onOk(data => {
        const index = description.full.findIndex(d => d.Id === tag.Id)
        const update = {
          Id: tag.Id,
          Value: data
        }
        if (index >= 0) {
          description.full[index] = update
        } else description.full.push(update)
      }).onCancel(() => {
        console.log('>>>> Cancel')
      }).onDismiss(() => {
        console.log('I am triggered on both OK and Cancel')
      })
const handleDimensions = (d) => {
  const x = String.fromCharCode(215)
  const chunks = d.split(x)
  const regex = /[A-Z]/g;
  const found = (string) => string.match(regex);
  const bracket = chunks.filter(c => c.startsWith('(') || found(c))
  let bracketChunks
  let result
  if (bracket[0].includes('(')) {
    bracketChunks = bracket[0].split('(')
    result = bracketChunks.map(b => b.replace(')', '')).concat(chunks.filter(c => c !== bracket[0]))
  } else result = chunks
  console.log('bracket', bracket)
  console.log('bracket chunks', bracketChunks)
  console.log('chunks', chunks)
  console.log('result', result)

  return result
}

function showDescriptionOptions (tag) {
  if (tag.Id !== 6) singleInputDialog(tag)
  else {
    dimensions.value = handleDimensions(tag.Value)
    showMultiInputDialog.value = true
  }
}

function editDimension (dimension) {
  dimensionChunk.value = dimension
  showDimensionsDictionary.value = true
}

function addToDimensionsDictionary () {
  const entry = {
    name: editedDimension.value,
    position: position.value
  }

  const existingEntry = editedDimensionsChunks.find(d => d.name === entry.name)
  if(existingEntry) {
    const index = editedDimensionsChunks.findIndex(e => e.name === entry.name)
    editedDimensionsChunks[index] = entry
    editedDimensionsChunks.value = sortBy(editedDimensionsChunks, 'position')
  } else {
    editedDimensionsChunks.value.push(entry)
    editedDimensionsChunks.value = sortBy(editedDimensionsChunks, 'position')
  }
}

onMounted(() => {
  rows.value = getAll
})
</script>
