import { defineStore } from 'pinia'

const STORAGE_KEY = 'reyherConfigStore'

function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : { csvData: [], downloadList: [] }
  } catch (e) {
    return { csvData: [], downloadList: [] }
  }
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
    downloadList: [] // Array of group objects
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
    clearAll() {
      this.csvData = []
      this.downloadList = []
      saveToStorage(this)
    },
    loadFromStorage() {
      const data = loadFromStorage()
      this.csvData = data.csvData
      this.downloadList = data.downloadList
    }
  }
})

// Auto-load from storage on import
const store = loadFromStorage()
if (store) {
  useReyherConfigStore().csvData = store.csvData
  useReyherConfigStore().downloadList = store.downloadList
}
