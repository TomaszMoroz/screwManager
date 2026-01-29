import { defineStore } from 'pinia'

const STORAGE_KEY = 'reyherConfigStore'
const GROUPS_KEY = 'reyherGroupsList'


function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : { csvData: [], downloadList: [] }
  } catch (e) {
    return { csvData: [], downloadList: [] }
  }
}

function loadGroupsFromStorage() {
  try {
    const data = localStorage.getItem(GROUPS_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    return []
  }
}

function saveGroupsToStorage(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
}

function saveToStorage(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    csvData: state.csvData,
    downloadList: state.downloadList
  }))
}

export const useReyherConfigStore = defineStore('reyherConfig', {
  state: () => ({
    csvData: [], // Array of values from first column
    downloadList: [], // Array of group keys for download
    groupsList: [] // Array of group objects for q-table
  }),
  actions: {
    setCsvData(data) {
      this.csvData = data
      saveToStorage(this)
    },
    addToDownloadList(group) {
      this.downloadList.push(group)
      saveToStorage(this)
    },
    removeFromDownloadList(index) {
      this.downloadList.splice(index, 1)
      saveToStorage(this)
    },
    setDownloadList(list) {
      this.downloadList = list
      saveToStorage(this)
    },
    setGroupsList(list) {
      this.groupsList = list
      saveGroupsToStorage(list)
    },
    clearAll() {
      this.csvData = []
      this.downloadList = []
      this.groupsList = []
      saveToStorage(this)
      saveGroupsToStorage([])
    },
    loadFromStorage() {
      const data = loadFromStorage()
      this.csvData = data.csvData
      this.downloadList = data.downloadList
      this.groupsList = loadGroupsFromStorage()
    }
  }
})

// Auto-load from storage on import
const store = loadFromStorage()
if (store) {
  useReyherConfigStore().csvData = store.csvData
  useReyherConfigStore().downloadList = store.downloadList
  useReyherConfigStore().groupsList = loadGroupsFromStorage()
}
