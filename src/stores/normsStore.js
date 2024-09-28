import { defineStore } from 'pinia';

export const useNormsStore = defineStore('norms', {
  state: () => ({
    norms: [],
  }),
  getters: {
    getAll: (state) => state.norms,
  },
  actions: {
    setNorms(norms) {
      this.norms = norms
    },
    addNorm(norm) {
      this.norms.push(norm);
    },
    updateNorm(obj) {
      const normToUpdate = this.norms.findIndex(n => n.id === obj.id)
      this.norms[normToUpdate] = obj
    }
  },
});
